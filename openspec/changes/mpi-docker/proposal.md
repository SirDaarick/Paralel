# Proposal: MPI Solver Mode + Docker Containerization

## Intent

The project compares 3 solvers (seq, OMP, CUDA) in one flow and ships only as native binaries. Add a **separate MPI-vs-CUDA simulation mode** for real distributed execution, plus **Docker** packaging for zero-friction deployment. The 3-phase flow stays untouched.

## Scope

### In Scope
- Standalone `paralel-mpi-solver` (stride over 40 top-level positions, one `MPI_Allreduce` per piece, ~1.6 KB total/sim).
- `POST /api/simular-mpi` + status; server spawns `mpirun` as subprocess.
- `/api/health` gains `mpi` field.
- Frontend toggle (Clásico vs MPI vs CUDA); dynamic algorithm arrays in `ProgressBars`/`ResultsPage`/`ComparisonChart`.
- `Dockerfile`, `docker-compose.yml` (master + 2 workers), `docker-entrypoint.sh`, `backend/mpi-hosts`, `docs/MPI_SETUP.md`.

### Out of Scope
- Modifying the 3-phase flow, endpoints, or replays.
- Work-pool load balancing, MPI+CUDA hybrid kernels, fault tolerance, RDMA, auth, HTTPS. Frontend tests (no runner).

## Capabilities

> Contract with `sdd-spec`. Each new entry becomes `openspec/specs/<name>/spec.md`.

### New Capabilities
- `mpi-distributed-solver`: `BruteForceSolverMPI` + standalone binary contract — JSON on stdout, deterministic `BagRandomizer` across ranks, `MPI_Allreduce`/`MPI_MINLOC` for global best-move, first-level distribution over 40 top-level positions.
- `mpi-simulation-mode`: end-to-end MPI-vs-CUDA lifecycle — `/api/simular-mpi` start, subprocess spawn via `mpirun --hostfile`, status polling, replay parsing, frontend mode toggle, 2-panel layout, `mpi` key in results + chart (color `#ffaa00`).
- `container-deployment`: single-container demo (1 image, 4 local ranks), compose stack (master + 2 workers on a bridge network), `mpi-hosts` template, docs for native `mpirun --hostfile` on real clusters.

### Modified Capabilities
- None. `openspec/specs/` is empty; 3-phase flow unchanged. The dynamic-UI refactor is implementation cleanup supporting `mpi-simulation-mode`, not a spec-level change.

## Approach

Reuse `runAlgorithm()` from `simulation.cpp` verbatim; the new binary calls it with `BruteForceSolverMPI` that mirrors the OpenMP stride pattern using MPI world size + `MPI_Allreduce`. The HTTP server is MPI-free (no `MPI_Init`); it talks to the binary only via subprocess + stdout JSON, supporting arbitrary host topologies through `--hostfile`. Docker uses a hybrid strategy: one image serves `docker run` (local ranks), `docker compose up` (shared network), and documented native `mpirun --hostfile` for real clusters (recommended for Pi/lab-VM classrooms where Docker adds friction).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/Makefile` | Modified | `paralel-mpi-solver` target, MPI auto-detect. |
| `backend/src/tetris/solver_mpi.{h,cpp}` | New | `BruteForceSolverMPI` — stride + `Allreduce`. |
| `backend/src/mpi_solver_main.cpp` | New | Standalone entry; rank 0 prints JSON. |
| `backend/src/main.cpp` | Modified | `/api/simular-mpi`, spawn, health field. |
| `backend/src/tetris/simulation.{h,cpp}` | Modified | Expose `runAlgorithm`. |
| `backend/src/tests/test_tetris.cpp` | Modified | Stride, determinism, JSON-shape tests. |
| `frontend/src/hooks/{useSimulation,api-types}.ts` | Modified | Dynamic algo array, `mpi` types. |
| `frontend/src/components/{MenuPage,ProgressBars,ResultsPage,ComparisonChart,App}.tsx` | Modified | Toggle, dynamic UI, routing. |
| `Dockerfile` / `docker-compose.yml` / `docker-entrypoint.sh` | New | Build, orchestration, single-container boot. |
| `backend/mpi-hosts` / `docs/MPI_SETUP.md` | New | Template + cluster guide. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `mpirun` spawn latency 1–3s | Med | Acceptable; cache binary; "Iniciando MPI…" status. |
| MPI not installed on host | Med | Probe `mpirun` + binary; UI greys out mode. |
| Passwordless SSH friction for multi-node | High | Documented; native `mpirun --hostfile` is recommended real-cluster path. |
| Frontend hardcoded 3-algo assumptions | Med | Refactor to derive from `replays`; PR 3 tests both modes. |
| `BagRandomizer` drift between ranks | Low | Unit test verifies identical sequences from same seed. |
| MPI + CUDA link conflict | Low | Two separate binaries; server links CUDA, solver links MPI. |

## Rollback Plan

Each of the 3 chained PRs is independently revertable. **PR 1 (backend solver)**: revert drops `solver_mpi.*`, `mpi_solver_main.cpp`, Makefile target — 3-phase flow untouched. **PR 2 (Docker + endpoints)**: revert drops container files, `/api/simular-mpi` routes, `mpi` field in `/api/health`. **PR 3 (frontend mode)**: revert removes toggle + dynamic-array refactor, restores hardcoded `["seq","omp","cuda"]` constants. Full rollback: revert in reverse order; no data loss since the 3-phase flow is unchanged throughout.

## Dependencies

- **OpenMPI** ≥ 4.0 (auto-detected; build OK without, target skipped).
- **CUDA** (unchanged, optional). **Docker** ≥ 24 + Compose v2 (containers only).
- **Passwordless SSH** (real multi-machine only).
- **No new npm packages** — reuses `react-router-dom` + React 19 state.

## Success Criteria

- [ ] `make` builds both binaries; `make test` green with new stride/determinism/JSON tests.
- [ ] `mpirun -np 4 ./build/paralel-mpi-solver --lookahead 2` prints valid replay JSON.
- [ ] `/api/simular-mpi` returns id; final result has 2 replays with identical `moves`.
- [ ] `/api/health` = `{openmp, ompThreads, cuda, mpi, mpiProcesses}`; `mpi:false` when absent.
- [ ] `docker run` + `docker compose up` both complete an MPI-vs-CUDA sim.
- [ ] UI disables MPI mode when `mpi===false`; classic mode byte-identical to `main`.
- [ ] `npm run build` + `npm run lint` + `make test` green.
- [ ] `docs/MPI_SETUP.md` covers all 3 deployment paths.
- [ ] Chained PRs land in order, each ≤ 400 lines (forecast: 220 / 120 / 315).

## Estimated Effort

~500 new + ~155 modified = **~655 total** across ~15 files, **3 chained PRs** (backend 220 / Docker 120 / frontend 315). Per-PR review risk: **Low**; cumulative Medium.
