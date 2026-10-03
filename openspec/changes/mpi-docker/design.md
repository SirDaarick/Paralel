# Design: MPI Solver Mode + Docker Containerization

## Technical Approach

Reuse `SimulationManager::runAlgorithm()` verbatim. The standalone binary `paralel-mpi-solver` calls it with `BruteForceSolverMPI`, mirroring the OpenMP stride pattern over 40 top-level positions but replacing `#pragma omp critical` with `MPI_Allreduce(MPI_MINLOC)`. The HTTP server stays MPI-free; it spawns `mpirun` via `popen`, reads the JSON replay from stdout, and forwards it to the frontend. Docker packages both server and solver in one image with OpenMPI runtime.

## Architecture Decisions

### Decision: Standalone MPI Binary vs MPI-Linked Server

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Standalone binary | Clean separation; server stays MPI-free; easy multi-node Docker | **Chosen** |
| MPI-linked server | Simpler IPC but server requires `mpirun`; blocks HTTP scaling | Rejected |

### Decision: Subprocess Spawning Mechanism

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `popen()` | Simple line read; sufficient for single JSON payload | **Chosen** |
| `fork/exec` | More control but verbose; no need for extra pipes | Rejected |
| `MPI_Comm_spawn` | Dynamic processes; overkill for educational scope | Rejected |

### Decision: Board State Synchronization

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Same seed + deterministic `BagRandomizer` | Zero network traffic; implicit sync; ~1.6 KB total comm | **Chosen** |
| `MPI_Bcast` each turn | Explicit but wastes bandwidth for tiny state | Rejected |

### Decision: Frontend Dynamic Algorithm Arrays

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Derive from `replays` + metadata map | Removes all hardcoded 3-algo constants; future-proof | **Chosen** |
| Conditional `if (mpiMode)` branches | Duplicates UI logic; harder to maintain | Rejected |

### Decision: Docker Base Image

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `ubuntu:22.04` + `libopenmpi-dev` | Lightweight; no NVIDIA dependency; MPI demo everywhere | **Chosen** |
| `nvidia/cuda:12-devel` | Heavier; needed only if containerized CUDA desired | Rejected for base |

## Data Flow

### MPI Mode

```
Client → POST /api/simular-mpi → main.cpp spawn mpirun
                                    │
                                    ↓
                         MPI ranks (local or containers)
                                    │
                                    ↓
                    stdout JSON replay
                                    │
                    Client ← result endpoint
```

### MPI Solver Internal

```
Rank 0                All Ranks
  │                      │
  ├─ same seed ────────┤  (implicit sync)
  │                      │
  ├─ loop over pieces ──┤
  │   stride 40 pos      │
  │   local best eval     │
  │                      │
  └── MPI_Allreduce ────┤  (global best via MPI_MINLOC)
                         │
                         └─ rank 0 prints JSON replay
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/tetris/solver_mpi.{h,cpp}` | Create | `BruteForceSolverMPI` with stride + `MPI_Allreduce` |
| `backend/src/mpi_solver_main.cpp` | Create | CLI parser, `MPI_Init`, run loop, JSON stdout |
| `backend/src/tetris/simulation.h` | Modify | Make `runAlgorithm` public for binary reuse |
| `backend/src/tetris/simulation.cpp` | Modify | Expose `runAlgorithm` (no logic change) |
| `backend/src/main.cpp` | Modify | `/api/simular-mpi`, spawn, health `mpi` field |
| `backend/Makefile` | Modify | `MPICXX` auto-detect, `paralel-mpi-solver` target |
| `backend/src/tests/test_tetris.cpp` | Modify | Stride, determinism, JSON-shape tests |
| `frontend/src/hooks/useMpiSimulation.ts` | Create | Mirror `useSimulation` for MPI endpoints |
| `frontend/src/hooks/api-types.ts` | Modify | Add `MpiSimulationResult`, `MpiStatusResponse` |
| `frontend/src/components/MenuPage.tsx` | Modify | Mode toggle (Clásico / MPI / CUDA) |
| `frontend/src/components/ProgressBars.tsx` | Modify | Accept `algorithms` prop; remove hardcoded arrays |
| `frontend/src/components/ResultsPage.tsx` | Modify | Derive labels from replay + `ALGO_META` map |
| `frontend/src/components/ComparisonChart.tsx` | Modify | Derive colors/labels from replay + metadata |
| `frontend/src/App.tsx` | Modify | Mode state, branch to `useSimulation` or `useMpiSimulation` |
| `Dockerfile` | Create | Multi-stage builder → runtime with OpenMPI |
| `docker-compose.yml` | Create | `master` + `worker1` + `worker2` on bridge network |
| `docker-entrypoint.sh` | Create | Switch `$MODE`: server, mpi-local, or sshd worker |
| `backend/mpi-hosts` | Create | Template hostfile for compose |
| `docs/MPI_SETUP.md` | Create | Native cluster, single-container, compose guides |

## Interfaces / Contracts

### MPI Binary CLI

```bash
./paralel-mpi-solver --lookahead 2 --seed 123456
```

- `--lookahead`: 1–5 (default 2)
- `--seed`: unsigned int (optional; 0 = random)
- **stdout**: exactly one JSON replay object
- **stderr**: OpenMPI noise; ignored by parser
- **exit code**: 0 = success, non-zero = error

### MPI Binary JSON Output

```json
{
  "algorithm": "mpi",
  "moves": [ { "pieceType":1, "rotation":0, "x":3, "dropY":18, "decisionTimeMs":0.5, "linesCleared":0 } ],
  "finalScore": 1200,
  "totalPieces": 200,
  "totalTimeMs": 4500.0
}
```

### New API Endpoints

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| `POST` | `/api/simular-mpi` | `{"lookAhead":2}` | `{"simulationId":"mpi-..."}` |
| `GET` | `/api/simular-mpi/{id}/status` | — | `{"status":"running","progress":0,"currentAlgorithm":"mpi"}` |
| `GET` | `/api/simular-mpi/{id}/resultados` | — | `{"replays":[mpiReplay, cudaReplay?]}` |

### Health Response Extension

```json
{ "openmp": true, "ompThreads": 8, "cuda": true, "mpi": true, "mpiProcesses": 4 }
```

### Frontend Algorithm Metadata

```typescript
const ALGO_META: Record<string, { label: string; color: string }> = {
  seq:  { label: "SECUENCIAL",   color: "#ff3333" },
  omp:  { label: "OpenMP (CPU)", color: "#00ff00" },
  cuda: { label: "CUDA (GPU)",   color: "#00ffff" },
  mpi:  { label: "MPI",          color: "#ffaa00" },
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `BruteForceSolverMPI` stride correctness | Custom macro: rank-0 result matches sequential for same seed |
| Unit | Determinism across ranks | Custom macro: 4-rank run yields identical `moves` arrays |
| Unit | JSON output shape | Custom macro: parse stdout, assert required fields |
| Integration | `/api/simular-mpi` end-to-end | Manual/curl: start, poll, verify replay presence |
| E2E | Docker compose stack | Manual: `docker compose up`, run simulation from UI |

## Migration / Rollout

No data migration required. The classic 3-phase flow is untouched. MPI mode is additive:
1. Backend solver + Makefile target.
2. Docker files + server endpoints.
3. Frontend toggle + dynamic UI.
Each PR is independently revertable.

## Open Questions

- [ ] Should the MPI binary stream intermediate `{"progress":N}` lines, or is final-JSON-only sufficient?
- [ ] Do we include CUDA runtime in the Docker image for a unified GPU+MPI container, or document host passthrough as optional?
