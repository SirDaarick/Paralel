# Exploration: MPI Solver + Docker Containerization

## Current State

The backend runs a single HTTP server (`paralel-server`) on port 8080. `SimulationManager` orchestrates three sequential phases inside a detached thread:

1. Sequential brute-force (`BruteForceSolver`)
2. OpenMP brute-force (`BruteForceSolverOMP`) — compile-time enabled via `-fopenmp`
3. CUDA brute-force (`BruteForceSolverCUDA`) — compile-time enabled via `-DUSE_CUDA`, auto-detected with `which nvcc`. Falls back to `solver_cuda_stub.cpp`.

Each solver implements `virtual SearchResult findBestMove(...)` and is instantiated locally inside `runSimulation()`. The frontend polls `/api/simular/{id}/status` every 500ms and renders 3 side-by-side panels (`SimulationPage` maps `replays` → `SimulationPanel`). Progress bars, results table, and comparison chart all hardcode `seq`, `omp`, `cuda` as the three algorithms.

There is no Docker or containerization today. The Makefile is the source of truth for builds.

## Affected Areas

- `backend/Makefile` — Add MPI auto-detection, conditional compilation, linking flags
- `backend/src/tetris/solver_mpi.h` — New: BruteForceSolverMPI class declaration
- `backend/src/tetris/solver_mpi.cpp` — New: MPI implementation (scatter search space, reduce best heuristic)
- `backend/src/tetris/solver_mpi_stub.cpp` — New: fallback to sequential when MPI unavailable
- `backend/src/tetris/simulation.h` / `simulation.cpp` — Add MPI as 4th phase; update progress percentages
- `backend/src/main.cpp` — Conditionally call `MPI_Init`/`MPI_Finalize`; update `/api/health` with `mpi` and `mpiProcesses`
- `frontend/src/components/ProgressBars.tsx` — Add MPI phase; dynamic phase ranges
- `frontend/src/components/ResultsPage.tsx` — Add MPI label to `ALGORITHM_LABELS` and `ALGORITHM_ORDER`
- `frontend/src/components/ComparisonChart.tsx` — Add MPI color/label mappings
- `frontend/src/components/MenuPage.tsx` — New MPI info/config section showing detected processes
- `Dockerfile` — New: multi-stage build with OpenMPI
- `docker-compose.yml` — New: orchestrate container with env vars for MPI process count

## Approaches

### 1. Embedded MPI Solver (Compile-Time Toggle)

The server binary itself is compiled with MPI. `main()` calls `MPI_Init` before launching the HTTP server. Rank 0 runs the server and `SimulationManager`. When an MPI simulation runs, `BruteForceSolverMPI::findBestMove()` uses `MPI_Bcast` to broadcast the board/piece sequence to all ranks, each rank evaluates a subset of `(x, rotation)` positions, and `MPI_Allreduce` finds the global best.

- **Pros**: Mirrors existing CUDA/OpenMP pattern exactly; single binary; no external process management; rank 0 naturally becomes the API server.
- **Cons**: The binary **must** be launched with `mpirun` even if MPI is never used; `MPI_Init` changes process semantics; HTTP server thread + MPI communication need `MPI_THREAD_MULTIPLE` support; if compiled with MPI but run without `mpirun`, `MPI_Init` may abort.
- **Effort**: Medium
- **Docker strategy**: Single container. `ENTRYPOINT ["mpirun", "--allow-run-as-root", "-np", "4", "./paralel-server"]`.

### 2. External MPI Worker (Subprocess Spawn)

Keep the main server single-process, non-MPI. Build a separate `paralel-mpi-worker` binary that is MPI-only. When an MPI simulation starts, the server spawns `mpirun -np N ./paralel-mpi-worker <json-args>`, the worker computes the full replay, prints JSON to stdout, and the server parses it.

- **Pros**: Main server unchanged for non-MPI users; no `MPI_Init` in HTTP process; can spawn different `-np` per request (real "configure").
- **Cons**: Heavy per-simulation overhead (process spawn + MPI init); complex IPC (parsing stdout robustly); breaks the existing `findBestMove()` per-move pattern because the worker must run the entire algorithm externally; significantly more code.
- **Effort**: High
- **Docker strategy**: Same image contains both binaries; compose can vary worker count.

### 3. Hybrid — MPI-Optional Runtime Startup

Compile with MPI but add a runtime flag. At startup, try `MPI_Init` gracefully. If it succeeds and `MPI_Comm_size > 1`, enable MPI solver. If it fails or `size == 1`, disable MPI and run as normal server. Use `MPI_Init_thread` with `MPI_THREAD_MULTIPLE`.

- **Pros**: One binary handles both MPI and non-MPI deployment; docker run without `mpirun` still works.
- **Cons**: Complex error handling; `MPI_Init` is not truly optional in many implementations (may abort on missing daemon); more `#ifdef` spaghetti in `main.cpp`.
- **Effort**: Medium-High

### Docker Multi-Node vs Single-Container

| Strategy | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Single container, local ranks** | `docker run` just works; no networking/SSH setup; perfect for demo | Not "real" cluster computing | **Recommended** |
| **Docker Compose, multiple services** | Realistic multi-node MPI; better educational value for HPC | Requires SSH key exchange, shared volumes, precise `mpirun --host` syntax; fragile | Future enhancement |

## Recommendation

**Approach 1 (Embedded MPI)** with **single-container Docker**.

Rationale:
- The project is educational, not a production HPC scheduler. The goal is to visualize MPI speedup side-by-side with OpenMP/CUDA. A single container with 4 local MPI ranks achieves this with minimal complexity.
- The existing architecture strongly favors compile-time feature toggles (`USE_CUDA`, `_OPENMP`). Adding `USE_MPI` is the consistent pattern.
- The external worker approach violates the current `findBestMove()` abstraction and introduces process-spawn fragility.
- MPI process count will be configured at container startup (`docker run -e MPI_PROCS=8`), not per-request. The frontend "configuration" will display the detected MPI capability from `/api/health`.

### Build Details

- Auto-detect `mpicxx` via `shell which mpicxx` (or `mpic++`).
- If found, set `CXX = mpicxx`, add `-DUSE_MPI`, and link `-lmpi` / `-lmpi++`.
- Add `solver_mpi.cpp` to `TETRIS_SRCS`.
- If not found, compile `solver_mpi_stub.cpp`.
- In `main.cpp`:
  ```cpp
  #ifdef USE_MPI
  #include <mpi.h>
  #endif
  ```
  At top of `main()`:
  ```cpp
  #ifdef USE_MPI
  int provided;
  MPI_Init_thread(nullptr, nullptr, MPI_THREAD_MULTIPLE, &provided);
  int rank;
  MPI_Comm_rank(MPI_COMM_WORLD, &rank);
  if (rank != 0) {
      // Worker loop: wait for bcast from rank 0
      solverMpiWorkerLoop(); // blocks forever
      MPI_Finalize();
      return 0;
  }
  #endif
  ```

### Solver MPI Implementation

`BruteForceSolverMPI` inherits from `BruteForceSolver`. `findBestMove()`:
1. Gather local best heuristic, x, rot (same as OpenMP).
2. `MPI_Allreduce` with `MPI_MINLOC` to find global best.

Note: Since `evaluateRecursive` is called inside `findBestMove`, and MPI is coarse-grained, we should parallelize at the top-level `BOARD_WIDTH * NUM_ROTATIONS` loop only (same pattern as OpenMP). Each rank handles a stride of the 40 positions.

### Frontend Changes

- `/api/health` returns `mpi: boolean, mpiProcesses: number`.
- `MenuPage` adds a small "Capacidades Detectadas" box below look-ahead showing OpenMP threads, CUDA, MPI processes.
- `ProgressBars`, `ResultsPage`, `ComparisonChart` replace hardcoded 3-element arrays with arrays that include `mpi` when present. Since the backend already returns `replays` dynamically based on compile flags, the frontend should derive algorithm lists from the data rather than hardcoding.
- `SimulationPage` is already dynamic (maps `replays`), but CSS grid may need adjustment for 4 panels.

### Risks

1. **MPI threading model**: `MPI_THREAD_MULTIPLE` is required because the HTTP server runs in a background thread while the simulation thread calls MPI. Not all MPI implementations support this well. OpenMPI does, but MPICH may require `MPI_THREAD_SERIALIZED` and explicit locking.
2. **Graceful degradation**: If compiled with MPI but launched without `mpirun`, many MPI libraries abort. We may need a wrapper script or graceful `MPI_Comm_size == 1` fallback.
3. **Docker root requirement**: `mpirun` inside Docker often needs `--allow-run-as-root`. This is acceptable for a demo container but should be documented.
4. **Progress granularity**: Adding a 4th phase means progress goes 0→25→50→75→100 instead of 0→33→66→100. The frontend hardcodes phase ranges; needs refactor to be dynamic.
5. **Frontend layout**: 4 panels may not fit well on smaller screens. CSS `grid-template-columns` in `SimulationPage.css` needs to become responsive or switch to 2x2 layout.
6. **CUDA + MPI link ordering**: Linking both `-lcudart` and `-lmpi` can cause symbol conflicts on some platforms. Order: `-lmpi` before `-lcudart`.
7. **Stub pattern inconsistency**: CUDA stub inherits from base and calls `BruteForceSolver::findBestMove()`. MPI stub should do the same, but since `BruteForceSolver` base is non-virtual (wait, `findBestMove` IS virtual but not pure virtual), this works fine.

### Scope Estimation

| File | Action | Approx Lines |
|------|--------|--------------|
| `solver_mpi.h` | Create | 10 |
| `solver_mpi.cpp` | Create | 60 |
| `solver_mpi_stub.cpp` | Create | 8 |
| `Makefile` | Modify | +30 |
| `simulation.h` | Modify | +5 |
| `simulation.cpp` | Modify | +40 |
| `main.cpp` | Modify | +35 |
| `Dockerfile` | Create | 35 |
| `docker-compose.yml` | Create | 20 |
| `frontend/src/hooks/api-types.ts` | Modify | +2 |
| `frontend/src/components/ProgressBars.tsx` | Modify | +20 |
| `frontend/src/components/ResultsPage.tsx` | Modify | +15 |
| `frontend/src/components/ComparisonChart.tsx` | Modify | +20 |
| `frontend/src/components/MenuPage.tsx` | Modify | +30 |
| `frontend/src/components/SimulationPage.css` | Modify | +10 |
| **Total** | | **~340 new, ~197 modified = ~537** |

**This exceeds the 400-line review budget.** Chained PRs are recommended:
- **PR 1**: Backend MPI solver + Makefile + simulation changes (~240 lines)
- **PR 2**: Docker containerization (~55 lines)
- **PR 3**: Frontend MPI panel support + configuration UI (~242 lines)

### Dependencies and Prerequisites

- **System**: OpenMPI or MPICH development libraries (`libopenmpi-dev` or `mpich`)
- **Build**: `mpicxx` (or `mpic++`) on `$PATH` for auto-detection
- **Docker**: Docker Engine 20.10+ (for buildkit multi-stage)
- **Testing**: MPI backend tests must be run with `mpirun -np 2 ./build/test_tetris` (the custom test framework may need adjustment if `main()` calls `MPI_Init`).
- **Knowledge**: Team must understand that MPI is a **program-level** paradigm, not a per-call library like OpenMP. This changes how the server is deployed.

## Ready for Proposal

**Yes**, with the following guidance for the user:

1. **MPI is program-level**: Unlike OpenMP, the server binary must be launched with `mpirun`. The Docker container handles this transparently.
2. **Process count is startup-time, not run-time**: The frontend can *display* MPI info but cannot change the number of processes without restarting the container. If runtime configurability is required, we must switch to the External Worker approach, which significantly increases scope.
3. **Chained PRs recommended**: Estimated ~537 changed lines exceeds the 400-line review budget. We should split into backend solver, Docker, and frontend UI as separate reviewable units.
4. **MPI implementation choice**: We recommend OpenMPI over MPICH for Docker because its `--allow-run-as-root` flag makes single-container demos straightforward.
