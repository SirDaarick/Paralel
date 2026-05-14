#include "solver.h"
#include <limits>

int BruteForceSolver::findDropY(const Board& board, PieceType piece,
                                 int rotation, int x) {
    int y = 0;
    while (y + 1 < BOARD_HEIGHT && board.canPlace(piece, rotation, x, y + 1)) {
        ++y;
    }
    if (board.canPlace(piece, rotation, x, y)) {
        return y;
    }
    return -1;
}

int BruteForceSolver::evaluateRecursive(Board board, PieceType piece,
                                         const std::vector<PieceType>& upcoming,
                                         size_t depth, int maxDepth) {
    int bestEval = std::numeric_limits<int>::max();

    for (int x = 0; x < BOARD_WIDTH; ++x) {
        for (int rot = 0; rot < NUM_ROTATIONS; ++rot) {
            int dropY = findDropY(board, piece, rot, x);
            if (dropY < 0) continue;

            Board clone = board.clone();
            clone.place(piece, rot, x, dropY);
            clone.clearLines();

            int eval;
            if (static_cast<int>(depth) >= maxDepth || depth >= upcoming.size()) {
                eval = clone.getHeight() + clone.countHoles();
            } else {
                eval = evaluateRecursive(clone, upcoming[depth],
                                         upcoming, depth + 1, maxDepth);
            }
            if (eval < bestEval) {
                bestEval = eval;
            }
        }
    }

    return bestEval == std::numeric_limits<int>::max()
               ? board.getHeight() + board.countHoles()
               : bestEval;
}

SearchResult BruteForceSolver::findBestMove(const Board& board, PieceType current,
                                             const std::vector<PieceType>& upcoming,
                                             int lookAhead) {
    SearchResult best;
    best.bestHeuristic = std::numeric_limits<int>::max();
    best.bestX = 3;
    best.bestRotation = 0;

    int maxDepth = lookAhead;
    if (maxDepth > static_cast<int>(upcoming.size())) {
        maxDepth = static_cast<int>(upcoming.size());
    }

    for (int x = 0; x < BOARD_WIDTH; ++x) {
        for (int rot = 0; rot < NUM_ROTATIONS; ++rot) {
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

            if (eval < best.bestHeuristic) {
                best.bestHeuristic = eval;
                best.bestX = x;
                best.bestRotation = rot;
            }
        }
    }

    return best;
}
