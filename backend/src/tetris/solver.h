#pragma once

#include "types.h"
#include "board.h"
#include <vector>
#include <cstdint>

struct SearchResult {
    int bestX;
    int bestRotation;
    int bestHeuristic;
};

class BruteForceSolver {
public:
    virtual SearchResult findBestMove(const Board& board, PieceType current,
                                      const std::vector<PieceType>& upcoming,
                                      int lookAhead);

    int findDropY(const Board& board, PieceType piece, int rotation, int x);

protected:
    int evaluateRecursive(Board board, PieceType piece,
                          const std::vector<PieceType>& upcoming,
                          size_t depth, int maxDepth);
};
