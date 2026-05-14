#include <cuda_runtime.h>
#include <device_launch_parameters.h>
#include <limits>

#include "solver_cuda.h"

// Piece definitions in GPU constant memory (cached, faster reads for all threads)
__constant__ int c_piece_blocks[8][4][4][2] = {
    {}, // 0 = empty
    { // I
        {{0,1},{1,1},{2,1},{3,1}},
        {{2,0},{2,1},{2,2},{2,3}},
        {{0,2},{1,2},{2,2},{3,2}},
        {{1,0},{1,1},{1,2},{1,3}},
    },
    { // O
        {{0,0},{1,0},{0,1},{1,1}},
        {{0,0},{1,0},{0,1},{1,1}},
        {{0,0},{1,0},{0,1},{1,1}},
        {{0,0},{1,0},{0,1},{1,1}},
    },
    { // T
        {{1,0},{0,1},{1,1},{2,1}},
        {{1,0},{1,1},{2,1},{1,2}},
        {{0,1},{1,1},{2,1},{1,2}},
        {{1,0},{0,1},{1,1},{1,2}},
    },
    { // S
        {{1,0},{2,0},{0,1},{1,1}},
        {{0,0},{0,1},{1,1},{1,2}},
        {{1,1},{2,1},{0,2},{1,2}},
        {{0,1},{1,1},{1,2},{2,2}},
    },
    { // Z
        {{0,0},{1,0},{1,1},{2,1}},
        {{1,0},{0,1},{1,1},{0,2}},
        {{0,1},{1,1},{1,2},{2,2}},
        {{1,0},{2,1},{1,1},{0,2}},
    },
    { // J
        {{0,0},{0,1},{1,1},{2,1}},
        {{0,0},{1,0},{0,1},{0,2}},
        {{0,1},{1,1},{2,1},{2,2}},
        {{1,0},{1,1},{0,2},{1,2}},
    },
    { // L
        {{2,0},{0,1},{1,1},{2,1}},
        {{0,0},{0,1},{0,2},{1,2}},
        {{0,1},{1,1},{2,1},{0,2}},
        {{0,0},{1,0},{1,1},{1,2}},
    },
};

__device__ bool d_canPlace(const int* board, int piece, int rot, int x, int y) {
    for (int i = 0; i < 4; ++i) {
        int px = x + c_piece_blocks[piece][rot][i][0];
        int py = y + c_piece_blocks[piece][rot][i][1];
        if (px < 0 || px >= 10 || py < 0 || py >= 20) return false;
        if (board[py * 10 + px] != 0) return false;
    }
    return true;
}

__device__ int d_findDropY(const int* board, int piece, int rot, int x) {
    int y = 0;
    while (y + 1 < 20 && d_canPlace(board, piece, rot, x, y + 1)) {
        ++y;
    }
    if (d_canPlace(board, piece, rot, x, y)) return y;
    return -1;
}

__device__ void d_place(int* board, int piece, int rot, int x, int y) {
    for (int i = 0; i < 4; ++i) {
        int px = x + c_piece_blocks[piece][rot][i][0];
        int py = y + c_piece_blocks[piece][rot][i][1];
        if (px >= 0 && px < 10 && py >= 0 && py < 20) {
            board[py * 10 + px] = piece;
        }
    }
}

__device__ void d_clearLines(int* board, int& linesCleared) {
    linesCleared = 0;
    int writeY = 19;
    for (int readY = 19; readY >= 0; --readY) {
        bool full = true;
        for (int x = 0; x < 10; ++x) {
            if (board[readY * 10 + x] == 0) { full = false; break; }
        }
        if (!full) {
            if (writeY != readY) {
                for (int x = 0; x < 10; ++x) {
                    board[writeY * 10 + x] = board[readY * 10 + x];
                }
            }
            --writeY;
        } else {
            ++linesCleared;
        }
    }
    for (int y = 0; y <= writeY; ++y) {
        for (int x = 0; x < 10; ++x) {
            board[y * 10 + x] = 0;
        }
    }
}

__device__ int d_getHeight(const int* board) {
    for (int y = 0; y < 20; ++y) {
        for (int x = 0; x < 10; ++x) {
            if (board[y * 10 + x] != 0) return 20 - y;
        }
    }
    return 0;
}

__device__ int d_countHoles(const int* board) {
    int holes = 0;
    for (int x = 0; x < 10; ++x) {
        bool foundBlock = false;
        for (int y = 0; y < 20; ++y) {
            if (board[y * 10 + x] != 0) {
                foundBlock = true;
            } else if (foundBlock) {
                ++holes;
            }
        }
    }
    return holes;
}

__global__ void bruteForceKernel(
    const int* g_board,
    const int* g_pieceSeq,
    int g_numPieces,
    int g_maxDepth,
    int* g_bestHeuristic,
    int* g_bestX,
    int* g_bestRot
) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;

    const int NUM_POS = 40; // 10 cols * 4 rots
    int pow40[6];
    pow40[0] = 1;
    for (int i = 1; i < 6; ++i) pow40[i] = pow40[i-1] * NUM_POS;

    int totalPaths = pow40[g_maxDepth + 1];
    int stride = gridDim.x * blockDim.x;

    for (int pathId = tid; pathId < totalPaths; pathId += stride) {
        int board[200];
        for (int i = 0; i < 200; ++i) board[i] = g_board[i];

        bool valid = true;
        int path = pathId;

        for (int level = 0; level <= g_maxDepth && valid; ++level) {
            int choice = path % NUM_POS;
            path /= NUM_POS;

            int x = choice / 4;
            int rot = choice % 4;
            int pieceType = g_pieceSeq[level];

            int dropY = d_findDropY(board, pieceType, rot, x);
            if (dropY < 0) { valid = false; break; }

            d_place(board, pieceType, rot, x, dropY);
            int linesCleared;
            d_clearLines(board, linesCleared);
        }

        if (!valid) continue;

        int heuristic = d_getHeight(board) + d_countHoles(board);

        int firstChoice = pathId % NUM_POS;
        int firstIdx = firstChoice / 4;
        int firstRot = firstChoice % 4;

        if (heuristic < g_bestHeuristic[firstChoice]) {
            g_bestHeuristic[firstChoice] = heuristic;
            g_bestX[firstChoice] = firstIdx;
            g_bestRot[firstChoice] = firstRot;
        }
    }
}

static void memCpyBoard(int* dst, const Board& src) {
    for (int y = 0; y < 20; ++y)
        for (int x = 0; x < 10; ++x)
            dst[y * 10 + x] = src.getCell(x, y);
}

SearchResult BruteForceSolverCUDA::findBestMove(
    const Board& board, PieceType current,
    const std::vector<PieceType>& upcoming, int lookAhead)
{
    int maxDepth = lookAhead;
    if (maxDepth > static_cast<int>(upcoming.size())) {
        maxDepth = static_cast<int>(upcoming.size());
    }

    if (maxDepth > 3) maxDepth = 3;

    const int MAX_DEPTH = maxDepth + 1;
    int pieceSeq[6];
    pieceSeq[0] = static_cast<int>(current);
    for (int i = 0; i < maxDepth; ++i) {
        pieceSeq[i + 1] = static_cast<int>(upcoming[i]);
    }

    int hostBoard[200];
    memCpyBoard(hostBoard, board);

    int* d_board;
    int* d_pieceSeq;
    int* d_bestHeuristic;
    int* d_bestX;
    int* d_bestRot;

    cudaMalloc(&d_board, 200 * sizeof(int));
    cudaMalloc(&d_pieceSeq, 6 * sizeof(int));
    cudaMalloc(&d_bestHeuristic, 40 * sizeof(int));
    cudaMalloc(&d_bestX, 40 * sizeof(int));
    cudaMalloc(&d_bestRot, 40 * sizeof(int));

    cudaMemcpy(d_board, hostBoard, 200 * sizeof(int), cudaMemcpyHostToDevice);
    cudaMemcpy(d_pieceSeq, pieceSeq, 6 * sizeof(int), cudaMemcpyHostToDevice);

    const int INIT_H = 999999;
    int initH[40];
    for (int i = 0; i < 40; ++i) initH[i] = INIT_H;
    cudaMemcpy(d_bestHeuristic, initH, 40 * sizeof(int), cudaMemcpyHostToDevice);
    cudaMemcpy(d_bestX, initH, 40 * sizeof(int), cudaMemcpyHostToDevice);

    int total = 1;
    for (int i = 0; i <= maxDepth; ++i) total *= 40;

    // Use optimal block size for this GPU (GTX 1650: 256-512 threads/block)
    int minGridSize, blockSize;
    cudaOccupancyMaxPotentialBlockSize(&minGridSize, &blockSize,
        bruteForceKernel, 0, 0);
    if (blockSize > 256) blockSize = 256; // cap for register pressure
    int blocks = (total + blockSize - 1) / blockSize;
    if (blocks > 65535) blocks = 65535;

    bruteForceKernel<<<blocks, blockSize>>>(
        d_board, d_pieceSeq, MAX_DEPTH, maxDepth,
        d_bestHeuristic, d_bestX, d_bestRot);

    cudaDeviceSynchronize();

    int bestH[40], bestX[40], bestR[40];
    cudaMemcpy(bestH, d_bestHeuristic, 40 * sizeof(int), cudaMemcpyDeviceToHost);
    cudaMemcpy(bestX, d_bestX, 40 * sizeof(int), cudaMemcpyDeviceToHost);
    cudaMemcpy(bestR, d_bestRot, 40 * sizeof(int), cudaMemcpyDeviceToHost);

    cudaFree(d_board);
    cudaFree(d_pieceSeq);
    cudaFree(d_bestHeuristic);
    cudaFree(d_bestX);
    cudaFree(d_bestRot);

    SearchResult best;
    best.bestHeuristic = std::numeric_limits<int>::max();
    best.bestX = 3;
    best.bestRotation = 0;

    for (int i = 0; i < 40; ++i) {
        if (bestH[i] < best.bestHeuristic && bestH[i] < INIT_H) {
            int dropY = findDropY(board, current, bestR[i], bestX[i]);
            if (dropY >= 0) {
                best.bestHeuristic = bestH[i];
                best.bestX = bestX[i];
                best.bestRotation = bestR[i];
            }
        }
    }

    return best;
}
