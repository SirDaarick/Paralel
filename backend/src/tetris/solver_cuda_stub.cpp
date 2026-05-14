#include "solver_cuda.h"

SearchResult BruteForceSolverCUDA::findBestMove(
    const Board& board, PieceType current,
    const std::vector<PieceType>& upcoming, int lookAhead)
{
    return BruteForceSolver::findBestMove(board, current, upcoming, lookAhead);
}
