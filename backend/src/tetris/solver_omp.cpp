#include "solver_omp.h"
#include <limits>
#include <omp.h>

SearchResult BruteForceSolverOMP::findBestMove(const Board& board,
                                                PieceType current,
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

    int bestHeuristic = std::numeric_limits<int>::max();
    int bestX = 3;
    int bestRotation = 0;

    #pragma omp parallel for
    for (int idx = 0; idx < BOARD_WIDTH * NUM_ROTATIONS; ++idx) {
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

        #pragma omp critical
        {
            if (eval < bestHeuristic) {
                bestHeuristic = eval;
                bestX = x;
                bestRotation = rot;
            }
        }
    }

    best.bestHeuristic = bestHeuristic;
    best.bestX = bestX;
    best.bestRotation = bestRotation;
    return best;
}
