#include "solver_mpi.h"
#include <mpi.h>
#include <limits>

SearchResult BruteForceSolverMPI::findBestMove(
    const Board& board, PieceType current,
    const std::vector<PieceType>& upcoming, int lookAhead)
{
    int rank, worldSize;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &worldSize);

    int maxDepth = lookAhead;
    if (maxDepth > static_cast<int>(upcoming.size())) {
        maxDepth = static_cast<int>(upcoming.size());
    }

    // local best: pair of (score, index) where index encodes x * 4 + rotation
    struct {
        int score;
        int index;
    } localBest, globalBest;

    localBest.score = std::numeric_limits<int>::max();
    localBest.index = 0;

    // Stride over 40 positions (10 cols × 4 rotations)
    // Each rank evaluates positions where (positionIndex % worldSize) == rank
    const int totalPositions = BOARD_WIDTH * NUM_ROTATIONS; // 40

    for (int idx = rank; idx < totalPositions; idx += worldSize) {
        int x = idx / NUM_ROTATIONS;
        int rot = idx % NUM_ROTATIONS;

        int dropY = findDropY(board, current, rot, x);
        if (dropY < 0) continue;

        Board clone = board.clone();
        clone.place(current, rot, x, dropY);
        clone.clearLines();

        int eval;
        if (maxDepth == 0) {
            eval = clone.getHeight() + clone.countHoles();
        } else {
            eval = evaluateRecursive(clone, upcoming[0],
                                     upcoming, 1, maxDepth);
        }

        if (eval < localBest.score) {
            localBest.score = eval;
            localBest.index = idx; // encodes x * NUM_ROTATIONS + rot
        }
    }

    // MPI_Allreduce with MPI_MINLOC: finds the minimum score across all ranks
    // and returns the index from the rank that provided the minimum
    MPI_Allreduce(&localBest, &globalBest, 1, MPI_2INT, MPI_MINLOC,
                  MPI_COMM_WORLD);

    // No rank found any valid move — return fallback
    SearchResult result;
    if (globalBest.score == std::numeric_limits<int>::max()) {
        result.bestHeuristic = board.getHeight() + board.countHoles();
        result.bestX = 3;
        result.bestRotation = 0;
    } else {
        result.bestHeuristic = globalBest.score;
        result.bestX = globalBest.index / NUM_ROTATIONS;
        result.bestRotation = globalBest.index % NUM_ROTATIONS;
    }
    return result;
}
