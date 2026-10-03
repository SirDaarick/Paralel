#pragma once

#include "solver.h"

class BruteForceSolverMPI : public BruteForceSolver {
public:
    SearchResult findBestMove(const Board& board, PieceType current,
                              const std::vector<PieceType>& upcoming,
                              int lookAhead) override;
};
