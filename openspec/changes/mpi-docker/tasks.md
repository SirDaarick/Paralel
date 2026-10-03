# Tasks: MPI Solver Mode + Docker Containerization

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500 (200 + 80 + 220) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend MPI solver + health endpoint + tests | PR 1 | base: main; tests/docs included |
| 2 | Docker files + server MPI endpoints | PR 2 | base: main; depends on PR 1 |
| 3 | Frontend mode toggle + dynamic UI | PR 3 | base: main; depends on PR 2 |

## Phase 1: PR 1 — Backend MPI Solver

- [x] 1.1 Create `backend/src/tetris/solver_mpi.h` — `BruteForceSolverMPI` inherits `BruteForceSolver`
- [x] 1.2 Create `backend/src/tetris/solver_mpi.cpp` — stride over 40 positions, `MPI_Allreduce(MPI_MINLOC)`
- [x] 1.3 Create `backend/src/mpi_solver_main.cpp` — CLI `--lookahead`/`--seed`, rank-0 JSON stdout
- [x] 1.4 Modify `backend/src/tetris/simulation.h` — make `runAlgorithm` public
- [x] 1.5 Modify `backend/Makefile` — auto-detect `mpicxx`, add `paralel-mpi-solver` target
- [x] 1.6 Modify `backend/src/main.cpp` — add `mpi`/`mpiProcesses` to `/api/health`
- [x] 1.7 RED: Add failing tests in `test_tetris.cpp` for stride, determinism, JSON shape
- [x] 1.8 GREEN: Implement `solver_mpi.cpp` until `make test` passes
- [x] 1.9 REFACTOR: Clean up; verify `make test` green, `make` builds both binaries

## Phase 2: PR 2 — Docker & Server MPI Endpoints

- [x] 2.1 Create `Dockerfile` — multi-stage build with OpenMPI runtime
- [x] 2.2 Create `docker-compose.yml` — master + 2 workers on bridge network
- [x] 2.3 Create `docker-entrypoint.sh` — local ranks or `--hostfile` mode
- [x] 2.4 Create `backend/mpi-hosts` — template hostfile for compose
- [x] 2.5 Create `docs/MPI_SETUP.md` — native cluster, single-container, compose guides
- [x] 2.6 Modify `backend/src/main.cpp` — add `/api/simular-mpi`, status, resultados endpoints
- [x] 2.7 Modify `backend/src/tetris/simulation.cpp` — expose `runAlgorithm` if still private
- [ ] 2.8 Verify `docker build` succeeds and `docker compose up` completes a simulation

## Phase 3: PR 3 — Frontend MPI Mode

- [x] 3.1 Modify `frontend/src/hooks/api-types.ts` — add `MpiSimulationResult`, `MpiStatusResponse`
- [x] 3.2 Create `frontend/src/hooks/useMpiSimulation.ts` — mirror `useSimulation` for MPI endpoints
- [x] 3.3 Modify `frontend/src/App.tsx` — mode state, branch to `useSimulation` or `useMpiSimulation`
- [x] 3.4 Modify `frontend/src/components/MenuPage.tsx` — mode toggle (Clásico / MPI / CUDA)
- [x] 3.5 Modify `frontend/src/components/ProgressBars.tsx` — accept `algorithms` prop, remove hardcoded arrays
- [x] 3.6 Modify `frontend/src/components/ResultsPage.tsx` — derive labels/colors from `ALGO_META` map
- [x] 3.7 Modify `frontend/src/components/ComparisonChart.tsx` — derive metadata dynamically from replays
- [x] 3.8 Verify `npm run lint` + `npm run build` green; classic mode byte-identical
