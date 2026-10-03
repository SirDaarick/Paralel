# Exploration v2: MPI Solver as Independent Simulation Mode

## Current State

The backend runs a single HTTP server (`paralel-server`) on port 8080. `SimulationManager` orchestrates three sequential phases inside a detached thread:

1. Sequential brute-force (`BruteForceSolver`)
2. OpenMP brute-force (`BruteForceSolverOMP`) — compile-time enabled via `-fopenmp`
3. CUDA brute-force (`BruteForceSolverCUDA`) — compile-time enabled via `-DUSE_CUDA`, auto-detected with `which nvcc`

Each solver implements `virtual SearchResult findBestMove(...)` and is instantiated locally inside `runSimulation()`. The frontend polls `/api/simular/{id}/status` every 500ms and renders side-by-side panels (`SimulationPage` maps `replays` → `SimulationPanel`). Progress bars, results table, and comparison chart all hardcode `seq`, `omp`, `cuda`.

The CUDA solver uses a BFS-style GPU kernel: it enumerates all `40^(maxDepth+1)` paths in parallel, with each thread evaluating one complete path. For `lookAhead > 3`, it caps depth to 3 to avoid explosion.

There is no Docker or containerization today. The Makefile is the source of truth for builds.

## What Changed from v1

The previous exploration (v1) proposed adding MPI as a **4th phase inside the existing simulation flow**, using an embedded `MPI_Init` approach. User feedback mandates three key changes:

1. **MPI is a SEPARATE simulation mode**, not integrated into the seq→omp→cuda flow.
2. **Compare MPI vs CUDA only** — because with high lookahead (4–5), sequential and OpenMP take too long to be practical.
3. **Real multi-machine execution** — the architecture must support running across multiple physical computers, not just local ranks in a single container.

## Affected Areas

- `backend/Makefile` — Add `paralel-mpi-solver` target, MPI auto-detection, hostfile support
- `backend/src/tetris/solver_mpi.h` — New: `BruteForceSolverMPI` class declaration
- `backend/src/tetris/solver_mpi.cpp` — New: MPI implementation (first-level distribution)
- `backend/src/mpi_solver_main.cpp` — New: standalone MPI solver entry point (full simulation)
- `backend/src/main.cpp` — New `/api/simular-mpi` endpoint, subprocess spawning, status polling
- `backend/src/tetris/simulation.h` / `simulation.cpp` — Reuse `runAlgorithm` for MPI binary; no changes to 3-phase flow
- `frontend/src/hooks/useSimulation.ts` — Reuse or extend for MPI mode
- `frontend/src/hooks/api-types.ts` — Add MPI types
- `frontend/src/components/MenuPage.tsx` — Add "MPI vs CUDA" mode selection
- `frontend/src/components/ProgressBars.tsx` — Dynamic 2-algorithm mode
- `frontend/src/components/ResultsPage.tsx` — MPI labels
- `frontend/src/components/ComparisonChart.tsx` — MPI colors
- `Dockerfile` — New: multi-stage build with OpenMPI
- `docker-compose.yml` — New: master + N worker services
- `backend/mpi-hosts` — New: template hostfile for multi-machine

---

## 1. MPI Parallelization Pattern Analysis

### Current Brute-Force Algorithm Recap

For each piece:
- Enumerate all `(position_x, rotation)` combinations: 10 × 4 = 40 positions.
- For each position, recursively evaluate `N` future pieces (lookahead).
- Complexity: ~40^N evaluations per decision.
- At N=4: ~2.5M evaluations. At N=5: ~100M evaluations.

### Option A: First-Level Distribution (Like OpenMP, Across Nodes)

**How it works:**
- All MPI ranks execute the same `runAlgorithm()` with the same piece sequence.
- Inside `findBestMove()`, each rank evaluates a **stride** of the 40 top-level positions:
  `for (int idx = rank; idx < 40; idx += size)`.
- For each assigned position, that rank performs the **full recursive lookahead locally**.
- `MPI_Allreduce` with `MPI_MINLOC` finds the global best move.
- All ranks place the same piece (since they all agree on the best move) and proceed identically.
- Only rank 0 writes the final replay JSON.

**Pros:**
- Mirrors OpenMP pattern exactly — just `size` (node count) instead of `omp_get_max_threads()`.
- Minimal communication: one `Allreduce` per piece (~12 bytes × ranks), plus the broadcast is implicit because all ranks already have the same parameters.
- Excellent for educational clarity: "each machine gets some positions to try."
- At high lookahead (4–5), each rank does enormous local work, so communication overhead is negligible.

**Cons:**
- Load imbalance possible: some positions may be invalid (can't place) and skip recursion quickly, while others recurse deeply.
- With only 40 top-level positions, if `size > 40`, some ranks get zero work. (Mitigation: MPI mode targets 2–8 machines, so `size ≤ 8` is fine.)

**Effort: Low**

### Option B: Work-Pool Distribution

**How it works:**
- Rank 0 maintains a queue of work items `(piece, board_state, depth)`.
- Worker ranks request work when idle via `MPI_Send`/`MPI_Recv`.
- Dynamic load balancing.

**Pros:**
- Perfect load balancing.

**Cons:**
- High communication overhead: every recursive branch could trigger a round-trip.
- MPI is **terrible** for fine-grained dynamic work distribution. Latency between nodes is microseconds to milliseconds; recursion branches are nanoseconds.
- Complex to implement and debug.
- Educational value is low — hard to explain.

**Effort: High**

### Option C: BFS-Level Distribution

**How it works:**
- Generate all possible board states after placing the current piece (up to 40 states).
- Distribute those states across ranks.
- Each rank evaluates its subset recursively.
- Reduce at the end.

**Pros:**
- Explicit state distribution, could be visualized.

**Cons:**
- Effectively identical to Option A in work distribution, just with an explicit intermediate state array.
- Requires serializing and broadcasting up to 40 board states instead of 1.
- More memory and code complexity with no real benefit.

**Effort: Medium**

### Recommendation: Option A (First-Level Distribution)

| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Educational clarity | **Excellent** — mirrors OpenMP | Poor | Good |
| Speedup on 2–8 machines | **Excellent** (coarse-grained, low comm) | Poor (high comm) | Good |
| Implementation simplicity | **Low effort** | High effort | Medium effort |
| Load balance | Acceptable | Perfect | Acceptable |

**Rationale:** For this project's goals (educational visualization, high lookahead, 2–8 machines), Option A is the clear winner. The communication pattern is minimal and intuitive. Students can look at the OpenMP solver and the MPI solver side-by-side and see the exact same loop structure, with `omp parallel for` replaced by `idx += size` and `MPI_Allreduce`.

---

## 2. Architecture for Separate MPI Mode

### Key Design Decision: Standalone MPI Solver Binary

Because the user requires **real multi-machine execution**, embedding MPI into the HTTP server process (v1 approach) is architecturally wrong. The HTTP server runs on one machine; MPI ranks must span multiple machines. The clean solution is a **separate binary** that the server spawns.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌─────────────┐     ┌─────────────────────┐                     │
│  │ Normal Mode │     │ MPI vs CUDA Mode    │                     │
│  │ (seq/omp/cuda)│    │ (mpi + cuda only)   │                     │
│  └──────┬──────┘     └──────────┬──────────┘                     │
│         │                        │                                │
│         ▼                        ▼                                │
│  /api/simular           /api/simular-mpi                         │
│         │                        │                                │
│         │         ┌────────────┴────────────┐                   │
│         │         │      BACKEND SERVER     │                   │
│         │         │   (paralel-server)      │                   │
│         │         │   Port 8080             │                   │
│         │         │   No MPI linked         │                   │
│         │         └────────────┬────────────┘                   │
│         │                      │                                │
│         │         ┌────────────┴────────────┐                   │
│         │         │  Spawn subprocess:      │                   │
│         │         │  mpirun -np M -host...  │                   │
│         │         │  ./paralel-mpi-solver   │                   │
│         │         │  --lookahead N         │                   │
│         │         └────────────┬────────────┘                   │
│         │                      │                                │
│         │         ┌────────────┴────────────┐                   │
│         │         │  MPI CLUSTER (2-N nodes)│                   │
│         │         │  All ranks run same code  │                   │
│         │         │  Rank 0 outputs JSON      │                   │
│         │         └───────────────────────────┘                   │
│         │                                                         │
│  [seq, omp, cuda]          [mpi] (from stdout)                    │
│         │                      │                                │
│         │         ┌────────────┴────────────┐                   │
│         │         │  Server also runs CUDA  │                   │
│         │         │  locally (existing code)  │                   │
│         │         └───────────────────────────┘                   │
│         │                                                         │
│         └──────────────┬──────────────────────────────────────┘
│                        │
│                        ▼
│              [cuda replay, mpi replay]
│                        │
│                        ▼
│              Side-by-side visualization
└─────────────────────────────────────────────────────────────────┘
```

### Backend Details

#### New Endpoint: `POST /api/simular-mpi`

Body: `{lookAhead: 1-5, mpiProcesses: M}`
Response: `{simulationId: "uuid", mpiAvailable: true, mpiProcesses: M}`

The server:
1. Reads `MPI_HOSTFILE` env var (default: `/etc/mpi/hosts` or `backend/mpi-hosts`).
2. Validates that `mpirun` and `paralel-mpi-solver` are available.
3. Spawns: `mpirun -np {mpiProcesses} --hostfile {hostfile} ./paralel-mpi-solver --lookahead {lookAhead} --seed {seed}`
4. Returns simulation ID immediately.
5. Server also starts local CUDA simulation in parallel (if CUDA available).
6. Polls both until complete.

#### New Endpoint: `GET /api/simular-mpi/{id}/status`

Response: `{status: "running|completed|error", progress: 0-100, currentAlgorithm: "mpi|cuda", mpiProgress: 0-100, cudaProgress: 0-100}`

#### Standalone MPI Solver (`paralel-mpi-solver`)

This is a NEW executable, separate from the HTTP server.

```cpp
// backend/src/mpi_solver_main.cpp
int main(int argc, char** argv) {
    MPI_Init(&argc, &argv);
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    // Parse args: --lookahead N --seed S
    int lookAhead = parseLookAhead(argc, argv);
    unsigned int seed = parseSeed(argc, argv);

    // All ranks generate the same piece sequence
    BagRandomizer bag(seed);
    std::vector<PieceType> pieceSequence;
    for (int i = 0; i < 200; ++i) pieceSequence.push_back(bag.next());

    // All ranks run the full simulation
    BruteForceSolverMPI solver(size, rank); // stride-based
    ReplayData replay = runAlgorithm(solver, "mpi", lookAhead, seed, ...);

    // Only rank 0 prints JSON to stdout
    if (rank == 0) {
        std::cout << replayToJson(replay) << std::endl;
    }

    MPI_Finalize();
    return 0;
}
```

Key insight: `runAlgorithm()` from `simulation.cpp` is **reused verbatim**. The only new code is `BruteForceSolverMPI::findBestMove()`, which adds the MPI stride and reduce.

#### Why Not Embed MPI in the Server?

| Approach | Multi-Machine? | Server Complexity | Process Spawn Overhead |
|----------|---------------|-------------------|------------------------|
| Embed MPI in server | No (server is single-node) | High (MPI_INIT in HTTP proc) | None |
| Standalone binary | **Yes** | Low (subprocess spawn) | One per simulation (~1s) |

The standalone binary approach cleanly separates concerns:
- The HTTP server knows nothing about MPI internals.
- The MPI solver knows nothing about HTTP.
- They communicate via stdin/stdout (JSON), the simplest possible contract.

### Frontend Details

#### Mode Selection on MenuPage

The menu gets a toggle:
- **"Modo Clásico"**: seq + omp + cuda (existing)
- **"Modo MPI vs CUDA"**: mpi + cuda only (new)

When MPI mode is selected:
- Look-ahead slider still works (1–5).
- A new readout shows: `MPI: Detectado (M procesos en {hostfile})` or `MPI: No disponible`.
- The "Comenzar" button triggers `/api/simular-mpi` instead of `/api/simular`.

#### ProgressBars for MPI Mode

Instead of 3 hardcoded bars, `ProgressBars` becomes dynamic based on the expected algorithms:
- Classic mode: 3 bars (seq, omp, cuda) — existing behavior.
- MPI mode: 2 bars (mpi, cuda).

The `ALGOS` array should be derived from the simulation mode, not hardcoded.

#### SimulationPage

Already dynamic (maps `replays` array to panels). For MPI mode it will render 2 panels side-by-side. CSS grid may need a 2-column override.

#### ResultsPage & ComparisonChart

Add MPI mappings:
- Color: e.g., `#ffaa00` (orange) to distinguish from CUDA cyan.
- Label: `MPI (Multi-Node)`.
- Comparison chart should handle dynamic algorithm lists instead of hardcoded `ORDER = ["seq", "omp", "cuda"]`.

---

## 3. Docker Multi-Machine Strategy

### Option C: Hybrid — Best of Both Worlds (Recommended)

This project needs **two deployment targets**:
1. **Single-container demo** (for students who just want to run `docker run`)
2. **Multi-container / multi-machine** (for the real distributed execution goal)

#### Single-Container Demo

A single Docker image runs both the server and local MPI ranks.

```dockerfile
# Dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y build-essential libopenmpi-dev openmpi-bin

WORKDIR /app
COPY backend/ ./
RUN make all && make mpi-solver  # builds both binaries

ENV MPI_PROCS=4
EXPOSE 8080

# Entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
```

```bash
# docker-entrypoint.sh
#!/bin/bash
# Start server in background
./build/paralel-server &
SERVER_PID=$!

# Create local hostfile for single-container demo
echo "localhost slots=${MPI_PROCS}" > /tmp/hosts
export MPI_HOSTFILE=/tmp/hosts

wait $SERVER_PID
```

For single-container, MPI ranks run as local processes inside the same container. This is **not** real multi-machine, but it proves MPI works and is perfect for demos.

#### Docker Compose (Multi-Service on Single Host)

```yaml
# docker-compose.yml
version: "3.8"
services:
  master:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MPI_HOSTFILE=/app/mpi-hosts
    volumes:
      - ./backend/mpi-hosts:/app/mpi-hosts:ro
    command: ["/app/build/paralel-server"]
    networks:
      - mpi-net

  worker1:
    build: .
    command: ["sleep", "infinity"]  # MPI worker: mpirun will SSH in
    networks:
      - mpi-net
    volumes:
      - ./backend/mpi-hosts:/app/mpi-hosts:ro

  worker2:
    build: .
    command: ["sleep", "infinity"]
    networks:
      - mpi-net
    volumes:
      - ./backend/mpi-hosts:/app/mpi-hosts:ro

networks:
  mpi-net:
    driver: bridge
```

```
# backend/mpi-hosts (template)
master slots=1
worker1 slots=4
worker2 slots=4
```

**Challenge**: OpenMPI between Docker containers requires passwordless SSH. Solutions:
- Share an SSH key pair via volume mount.
- Or use `mpirun` with the `docker` executor (not standard).
- Or use `mpirun --host` with hostnames and pre-shared keys.

**Simpler alternative for Compose**: Use the **MPI daemon mode** (orte-dvm) or just document that Compose demonstrates the architecture but real multi-machine needs the host networking approach below.

#### Real Multi-Machine (Recommended for Classrooms)

For actual multiple computers (e.g., a lab with 4 Raspberry Pis or 4 VMs):

1. Build the image once: `docker build -t paralel-mpi .`
2. Push to registry (or `docker save` / `docker load`).
3. On **each machine**, run:
   ```bash
   docker run -d --network host --name paralel-node \
     -v $(pwd)/mpi-hosts:/app/mpi-hosts:ro \
     paralel-mpi sleep infinity
   ```
4. On the **master machine**, also run the server:
   ```bash
   docker run -d --network host -p 8080:8080 \
     -v $(pwd)/mpi-hosts:/app/mpi-hosts:ro \
     -e MPI_HOSTFILE=/app/mpi-hosts \
     paralel-mpi ./build/paralel-server
   ```
5. Ensure passwordless SSH between all nodes (share `~/.ssh/id_rsa` into containers or use host SSH).

**Even Simpler for Classrooms**: Skip Docker for the real multi-machine case. Just compile natively on each machine, share an NFS directory for the binary, and run `mpirun --hostfile ...` directly. Docker adds complexity here without much benefit for true HPC clusters. The Dockerfile is best for the **demo/development** case.

### Docker Strategy Recommendation

| Scenario | Strategy |
|----------|----------|
| Local dev / single laptop | `docker run` with local MPI ranks inside container |
| CI / automated testing | `docker-compose up` with 1 master + 2 workers (shared network) |
| Real classroom cluster | Native compilation + `mpirun --hostfile` (documented) |

Provide all three in documentation. The `Dockerfile` and `docker-compose.yml` target the first two. A `docs/MPI_CLUSTER.md` file explains the third.

---

## 4. MPI Communication Flow (Pseudocode)

### Data Broadcast

In the standalone binary approach, **no explicit broadcast is needed** for `board`, `current`, or `upcoming`. Here's why:

1. All ranks execute `runAlgorithm()` with the **same parameters** (they parse the same `--seed` and `--lookahead` from argv).
2. `BagRandomizer` is deterministic; all ranks generate the **identical** `pieceSequence`.
3. `Board` starts empty on all ranks.
4. After each `findBestMove`, all ranks receive the **same result** via `Allreduce`, so they all place the same piece.

The only "broadcast" is the implicit synchronization of the deterministic state machine.

### What IS Communicated Explicitly

```cpp
// BruteForceSolverMPI::findBestMove()

// Each rank evaluates a subset of the 40 positions
int localBestH = INF;
int localBestIdx = -1;  // encodes x and rot

for (int idx = rank_; idx < 40; idx += size_) {
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
        eval = evaluateRecursive(clone, upcoming[0], upcoming, 1, maxDepth);
    }
    
    if (eval < localBestH) {
        localBestH = eval;
        localBestIdx = idx;  // 0..39
    }
}

// --- MPI Communication: one Allreduce per piece ---
// Use MPI_MINLOC to find the rank with minimum heuristic AND its index
struct { int h; int idx; } local = {localBestH, localBestIdx};
struct { int h; int idx; } global;

MPI_Allreduce(&local, &global, 1, MPI_2INT, MPI_MINLOC, MPI_COMM_WORLD);

SearchResult result;
result.bestHeuristic = global.h;
result.bestX = global.idx / NUM_ROTATIONS;
result.bestRotation = global.idx % NUM_ROTATIONS;
return result;
```

### Communication Summary Per Decision

| Operation | Data Size | Count | Pattern |
|-----------|-----------|-------|---------|
| Implicit state sync | None (deterministic) | 0 | Same seed + same algorithm |
| Reduce best move | 2 × `int` = 8 bytes | 1 | `MPI_Allreduce` with `MPI_MINLOC` |
| **Total per piece decision** | **8 bytes** | **1 collective call** | Negligible |

At 200 pieces, total MPI traffic per simulation: **200 × 8 bytes = 1.6 KB**. Even over a slow network, this is instantaneous.

### Serialization Format for Board State

Since board state is implicit (all ranks keep identical state), we **do not need** to serialize the board over MPI. However, for the HTTP ↔ MPI binary interface (subprocess spawn), the server passes parameters via command-line flags, not by serializing the board.

If we ever needed to serialize `BoardState` (e.g., for checkpointing):
```cpp
// BoardState is int[20][10] = 200 ints = 800 bytes
// Flatten to int[200] for MPI_Send/MPI_Recv
int flat[200];
for (int y = 0; y < 20; ++y)
    for (int x = 0; x < 10; ++x)
        flat[y*10 + x] = state.grid[y][x];
// MPI_Bcast(flat, 200, MPI_INT, 0, MPI_COMM_WORLD);
```

But again, **not needed** for the recommended architecture.

---

## 5. Scope Estimation

### New Files

| File | Approx Lines | Purpose |
|------|-------------|---------|
| `backend/src/tetris/solver_mpi.h` | 15 | `BruteForceSolverMPI` declaration |
| `backend/src/tetris/solver_mpi.cpp` | 55 | MPI stride + Allreduce implementation |
| `backend/src/mpi_solver_main.cpp` | 75 | Standalone MPI solver entry point |
| `backend/src/mpi_hostfile_template` | 5 | Template for multi-machine hostfile |
| `backend/Makefile` | +35 | `paralel-mpi-solver` target, MPI detection |
| `Dockerfile` | 40 | Multi-stage build with OpenMPI |
| `docker-compose.yml` | 30 | Master + workers |
| `docker-entrypoint.sh` | 15 | Single-container startup script |
| `frontend/src/hooks/useMpiSimulation.ts` | 65 | MPI mode polling hook |
| `frontend/src/hooks/api-types.ts` | +10 | MPI status types |
| `frontend/src/components/MpiConfigModal.tsx` | 45 | MPI node/process display |
| `frontend/src/components/ProgressBars.tsx` | +25 | Dynamic algorithm array support |
| `frontend/src/components/ResultsPage.tsx` | +15 | MPI label mappings |
| `frontend/src/components/ComparisonChart.tsx` | +15 | MPI color/label mappings |
| `docs/MPI_SETUP.md` | 50 | Documentation for cluster setup |

### Modified Files

| File | Approx Lines | Purpose |
|------|-------------|---------|
| `backend/src/main.cpp` | +50 | `/api/simular-mpi`, subprocess spawn, status |
| `backend/src/tetris/simulation.cpp` | +10 | Extract `runAlgorithm` to be callable from mpi_main |
| `frontend/src/App.tsx` | +35 | MPI mode routing/state |
| `frontend/src/components/MenuPage.tsx` | +25 | Mode toggle, MPI info display |
| `frontend/src/components/SimulationPage.tsx` | +10 | 2-panel layout support |

### Totals

- **New lines**: ~500
- **Modified lines**: ~155
- **Total changed**: ~655 lines

### PR Split Recommendation

This exceeds the 400-line review budget. Split into **3 chained PRs**:

1. **PR 1 — Backend MPI Solver** (~220 lines)
   - `solver_mpi.h`, `solver_mpi.cpp`
   - `mpi_solver_main.cpp`
   - `Makefile` changes
   - `simulation.cpp` extraction (if needed)
   - Test: `mpirun -np 4 ./build/paralel-mpi-solver --lookahead 2`

2. **PR 2 — Docker & Orchestration** (~120 lines)
   - `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`
   - `backend/src/main.cpp` MPI spawn endpoints
   - `mpi-hosts` template
   - `docs/MPI_SETUP.md`

3. **PR 3 — Frontend MPI Mode UI** (~315 lines)
   - `useMpiSimulation.ts`, `api-types.ts`
   - `MenuPage.tsx`, `MpiConfigModal.tsx`
   - `ProgressBars.tsx`, `ResultsPage.tsx`, `ComparisonChart.tsx`, `SimulationPage.tsx`
   - `App.tsx` routing changes

---

## 6. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Subprocess spawn latency** | Medium | `mpirun` startup can take 1–3 seconds. Acceptable for educational use. Cache compiled binary to avoid recompilation. |
| **MPI not available at runtime** | Medium | Server checks `which mpirun` and `paralel-mpi-solver` before accepting `/api/simular-mpi`. Return `mpiAvailable: false` in health check. |
| **Passwordless SSH for multi-node** | High | Document SSH key setup in `MPI_SETUP.md`. Provide `setup-ssh.sh` script. For single-container demo, no SSH needed. |
| **Hostfile configuration error** | Medium | Validate hostfile exists before spawn. Return clear error message to frontend if spawn fails. |
| **Frontend hardcoded 3-algorithm assumptions** | Medium | Refactor `ProgressBars`, `ResultsPage`, `ComparisonChart` to derive algorithms from data, not hardcode. Do this in PR 3. |
| **MPI + CUDA link conflicts** | Low | `paralel-mpi-solver` only links MPI. `paralel-server` only links CUDA (if available). No single binary links both. |
| **Load imbalance with 40 positions** | Low | With 2–8 ranks, each rank gets 5–20 positions. Even with slight imbalance, total time is dominated by deep recursion. |
| **Deterministic randomizer drift** | Low | Use identical `BagRandomizer` seed on all ranks. Verify with unit test that ranks produce identical sequences. |
| **No MPI implementation installed** | Medium | Provide clear `Dockerfile` with OpenMPI. Document `apt-get install` command for native builds. |

---

## Ready for Proposal

**Yes.**

The orchestrator should tell the user:

1. **MPI will be a standalone binary**, not embedded in the HTTP server. This cleanly enables real multi-machine execution via `mpirun`.
2. **The parallelization pattern is first-level distribution**, identical to OpenMP but across nodes. This is the simplest, most educational, and most performant choice for coarse-grained lookahead.
3. **Docker strategy is hybrid**: single container for demos (`docker run`), Docker Compose for multi-service on one host, and native compilation with hostfile for real multi-machine clusters.
4. **Comparison is MPI vs CUDA only** in the new mode. The existing 3-phase mode remains untouched.
5. **Chained PRs recommended**: ~655 lines across backend solver, Docker orchestration, and frontend UI.
