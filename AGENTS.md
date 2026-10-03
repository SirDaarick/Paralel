# AGENTS.md

## Project

**paralel** — Educational Tetris visualization comparing sequential, OpenMP, and CUDA brute-force solvers side-by-side. Backend runs all 3 algorithms on the same piece sequence; frontend replays them simultaneously.

## Architecture

```
backend/          C++17 HTTP server (cpp-httplib) + Tetris engine
frontend/         React 19 + TypeScript + Vite 8 SPA
```

- **Backend** listens on `:8080`, serves static files from `backend/static/`
- **Frontend dev** proxies `/api/*` to `http://localhost:8080` via Vite config
- Frontend polls backend every 500ms for simulation progress
- Simulations run **sequentially** (not parallel) on the backend — the parallelism is within each solver (OpenMP threads, CUDA kernels)

## Commands

### Backend (run from `backend/`)

| Command | What it does |
|---------|-------------|
| `make` | Build server (`build/paralel-server`) + test binary |
| `make test` | Build and run tests |
| `make run` | Build and start server on `:8080` |
| `make clean` | Remove `build/` |
| `make info` | Show CUDA availability |

### Frontend (run from `frontend/`)

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server with API proxy |
| `npm run build` | Type-check (`tsc -b`) then build to `dist/` |
| `npm run lint` | ESLint |

### Full dev workflow

1. `cd backend && make run` — start backend
2. `cd frontend && npm run dev` — start frontend (proxied to backend)

## Backend Quirks

- **Build system is Makefile**, not CMake (specs mention CMake but Makefile is the source of truth)
- **CUDA auto-detected**: if `nvcc` is on `$PATH`, it compiles `solver_cuda.cu` with `-DUSE_CUDA`. Otherwise `solver_cuda_stub.cpp` is used (falls back to sequential solver)
- **No JSON library**: all JSON is hand-rolled string concatenation in `main.cpp`
- **HTTP library**: `src/httplib.h` is cpp-httplib (header-only, vendored)
- **Test framework is custom**: `src/tests/test_tetris.cpp` uses custom macros (`TEST`, `CHECK`, `PASS`, `FAIL`) — no Catch2/GTest dependency
- **Solver hierarchy**: `BruteForceSolver` (base/sequential) → `BruteForceSolverOMP` (OpenMP) → `BruteForceSolverCUDA` (CUDA). All share `findBestMove()` interface
- **Shared types**: `src/tetris/types.h` defines `PieceType` enum (1-7), `Board` (10x20 grid), `Block`, `MoveResult`

## Frontend Quirks

- **`verbatimModuleSyntax`** is enabled in tsconfig — use `import type` for type-only imports, not bare `import`
- **`noUnusedLocals` + `noUnusedParameters`** — unused vars are compile errors
- **Routing**: `react-router-dom` v7 with `BrowserRouter` (despite specs saying "no router")
- **No frontend tests** — no test framework configured
- **Component pattern**: page components in `src/components/`, hooks in `src/hooks/`, Tetris constants in `src/tetris/`
- **History**: completed simulations are saved to `localStorage` (key: `paralel_history`, max 10 entries)
- **Demo Mode (`DEMO_MODE` / `VITE_DEMO_MODE`)**: Setting `DEMO_MODE=true` in `frontend/.env.local` (or environment) enables 100% standalone frontend mode. Uses `MockSimulationService` and `demoReplayData.ts` without requiring C++ backend or CUDA/MPI/OpenMP toolchains.
- **Service Layer**: `src/services/` provides `ISimulationService` with `HttpSimulationService` and `MockSimulationService` implementations injected via `services/index.ts`.

## API Contract

| Method | Route | Body / Response |
|--------|-------|-----------------|
| `GET` | `/api/health` | `{openmp, ompThreads, cuda}` |
| `POST` | `/api/simular` | `{"lookAhead": 1-5}` → `{"simulationId": "uuid"}` |
| `GET` | `/api/simular/{id}/status` | `{status, progress, currentAlgorithm}` |
| `GET` | `/api/simular/{id}/resultados` | `{replays: [{algorithm, moves[], finalScore, totalPieces, totalTimeMs}]}` |

## Key Files

| Path | Purpose |
|------|---------|
| `backend/src/main.cpp` | HTTP server, REST endpoints, JSON serialization |
| `backend/src/tetris/simulation.h` | `SimulationManager` — orchestrates 3-phase runs |
| `backend/src/tetris/solver.cpp` | Sequential brute-force with look-ahead |
| `backend/src/tetris/solver_omp.cpp` | OpenMP parallelization (`#pragma omp parallel for`) |
| `backend/src/tetris/solver_cuda.cu` | CUDA kernel (only compiled with nvcc) |
| `backend/src/tetris/types.h` | Shared types: `PieceType`, `BoardState`, `Block` |
| `frontend/src/App.tsx` | Routing, simulation state, history management |
| `frontend/src/hooks/useSimulation.ts` | Polling hook for backend simulation lifecycle |
| `frontend/src/hooks/api-types.ts` | TypeScript types matching backend API responses |
| `frontend/vite.config.ts` | Dev proxy config (`/api` → `:8080`) |

## Conventions

- Documentation and UI text are in **Spanish**
- No CI/CD pipeline or pre-commit hooks configured
- `backend/static/` holds a deployed frontend build — update manually after `npm run build`
- `backend/server.log` is tracked in git (not gitignored)
