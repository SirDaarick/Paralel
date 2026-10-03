#include "solver_mpi.h"

SearchResult BruteForceSolverMPI::findBestMove(
    const Board& board, PieceType current,
    const std::vector<PieceType>& upcoming, int lookAhead)
{
    // Fallback: delegate to sequential solver when MPI is unavailable
    return BruteForceSolver::findBestMove(board, current, upcoming, lookAhead);
}
