# Anexo: Codigo Fuente

---

## Estructura del Proyecto

```
paralel/
├── backend/
│   ├── Makefile                            # Build system (g++, nvcc, mpicxx)
│   ├── src/
│   │   ├── main.cpp                        # Servidor HTTP (cpp-httplib), endpoints REST
│   │   ├── httplib.h                       # Biblioteca HTTP header-only (vendored)
│   │   ├── mpi_solver_main.cpp             # Entry point para ejecución MPI standalone
│   │   ├── tests/
│   │   │   └── test_tetris.cpp             # Tests unitarios custom (macro TEST/CHECK)
│   │   └── tetris/
│   │       ├── types.h                     # Constantes, PieceType enum, BoardState, Block
│   │       ├── board.h / board.cpp         # Clase Board: place, clearLines, getHeight, countHoles
│   │       ├── pieces.h / pieces.cpp       # Definiciones de las 7 piezas (rotaciones)
│   │       ├── randomizer.h / randomizer.cpp # BagRandomizer (7-bag shuffle)
│   │       ├── scorer.h / scorer.cpp       # Puntuación por líneas eliminadas
│   │       ├── solver.h / solver.cpp       # BruteForceSolver (secuencial, baseline)
│   │       ├── solver_omp.h / solver_omp.cpp # BruteForceSolverOMP (OpenMP)
│   │       ├── solver_cuda.h / solver_cuda.cu # BruteForceSolverCUDA (kernel GPU)
│   │       ├── solver_cuda_stub.cpp        # Stub de CUDA cuando nvcc no está disponible
│   │       ├── solver_mpi.h / solver_mpi.cpp # BruteForceSolverMPI (MPI)
│   │       ├── solver_mpi_stub.cpp         # Stub de MPI cuando mpicxx no está disponible
│   │       └── simulation.h / simulation.cpp # SimulationManager: orquesta las 3 fases
│   └── static/                             # Frontend compilado (servido por el backend)
├── frontend/
│   ├── package.json                        # Dependencias npm
│   ├── vite.config.ts                      # Proxy /api -> localhost:8080
│   ├── tsconfig.json                        # TypeScript config (verbatimModuleSyntax)
│   └── src/
│       ├── App.tsx                          # Routing, estado de simulación, historial
│       ├── hooks/
│       │   ├── useSimulation.ts            # Polling hook para el ciclo de simulación
│       │   └── api-types.ts                # Tipos TypeScript (API responses)
│       ├── components/                      # Componentes de UI (React)
│       └── tetris/                          # Constantes del juego (colores, piezas)
└── reporte_tecnico/                         # Secciones del reporte final
    ├── 00_portada.md
    ├── 01_resumen.md
    ├── ...
    └── 13_codigo_fuente.md                  # Este archivo
```

---

## Descripcion de Archivos Principales

| Archivo | Descripcion |
|---------|-------------|
| `solver.h/solver.cpp` | Solver secuencial (baseline). Recorre las 40 posiciones de la pieza actual, clona el tablero, evalua la heuristica `altura + huecos`. Para look-ahead > 0, llama recursivamente a `evaluateRecursive`. |
| `solver_omp.h/solver_omp.cpp` | Solver OpenMP. Hereda de `BruteForceSolver` y sobreescribe `findBestMove`. Aplana el bucle anidado a un solo iterador y paraleliza con `#pragma omp parallel for`. Seccion critica para actualizar el mejor resultado. |
| `solver_cuda.h/solver_cuda.cu` | Solver CUDA. Codifica cada camino del arbol como un entero en base 40. Kernel `bruteForceKernel` procesa caminos en grid-strided loop. Piezas en `__constant__` memory. Tablero en registros por thread. Resultados en memoria global sin atomicos (condicion de carrera benigna). |
| `solver_mpi.h/solver_mpi.cpp` | Solver MPI. Distribuye las 40 posiciones entre procesos via stride. Cada proceso evalua su subconjunto y reduce con `MPI_Allreduce(MPI_MINLOC)`. |
| `mpi_solver_main.cpp` | Entry point para ejecucion MPI standalone. Parsea argumentos, genera secuencia de piezas con semilla broadcast, ejecuta el solver, y rank 0 imprime JSON. |
| `simulation.h/simulation.cpp` | Orquestador que ejecuta las 3 fases (secuencial, OpenMP, CUDA) secuencialmente sobre la misma secuencia de piezas. Cada fase corre en un thread separado. |
| `main.cpp` | Servidor HTTP con cpp-httplib. Expone endpoints REST (`/api/health`, `/api/simular`, `/api/simular/{id}/status`, `/api/simular/{id}/resultados`). Serializa resultados a JSON manualmente. |
| `board.h/board.cpp` | Clase Board: representa el tablero 10x20. Metodos `canPlace`, `place`, `clearLines`, `getHeight`, `countHoles`, `clone`, `isGameOver`. |

---

## Instrucciones de Compilacion

### Dependencias del sistema

| Dependencia | Version | Proposito |
|-------------|---------|-----------|
| g++ | 11+ | Compilador C++17 (requerido) |
| nvcc | 12.0+ | Compilador CUDA (opcional, solo si hay GPU NVIDIA) |
| mpicxx | Open MPI 4+ | Compilador MPI (opcional, solo para ejecucion distribuida) |
| Node.js | 18+ | Frontend React (compilacion con Vite) |
| npm | 9+ | Gestor de paquetes frontend |

### Compilacion del backend

```bash
cd backend

# Compilar todo (servidor + tests)
make

# Compilar con soporte CUDA (requiere nvcc en PATH)
make   # deteccion automatica: si nvcc esta en PATH, compila solver_cuda.cu

# Compilar con soporte MPI (requiere mpicxx en PATH)
make mpi

# Compilar y ejecutar tests
make test

# Ejecutar el servidor en puerto 8080
make run

# Limpiar build/
make clean

# Verificar disponibilidad de CUDA y MPI
make info
```

El Makefile detecta automaticamente si `nvcc` y `mpicxx` estan disponibles en `$PATH`. Si CUDA no esta disponible, compila `solver_cuda_stub.cpp` (fallback a solver secuencial). Si MPI no esta disponible, compila `solver_mpi_stub.cpp` (fallback a solver secuencial).

### Compilacion del frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Servidor de desarrollo con proxy a backend
npm run dev

# Compilar para produccion (typecheck + build)
npm run build

# Lint
npm run lint
```

### Ejecucion MPI

```bash
# 2 procesos en localhost
mpirun -np 2 ./build/paralel-mpi-solver --lookahead 3 --seed 42

# 4 procesos en nodos especificados en mpi-hosts
mpirun -np 4 --hostfile mpi-hosts ./build/paralel-mpi-solver --lookahead 3

# Ver ayuda
mpirun -np 1 ./build/paralel-mpi-solver --help
```

---

## Fragmentos de Codigo Clave

### 1. Solver secuencial: busqueda exhaustiva con evaluacion recursiva

```cpp
// solver.cpp — Evaluacion recursiva del arbol de busqueda
int BruteForceSolver::evaluateRecursive(Board board, PieceType piece,
                                         const std::vector<PieceType>& upcoming,
                                         size_t depth, int maxDepth) {
    int bestEval = std::numeric_limits<int>::max();

    for (int x = 0; x < BOARD_WIDTH; ++x) {
        for (int rot = 0; rot < NUM_ROTATIONS; ++rot) {
            int dropY = findDropY(board, piece, rot, x);
            if (dropY < 0) continue;

            Board clone = board.clone();
            clone.place(piece, rot, x, dropY);
            clone.clearLines();

            int eval;
            if (static_cast<int>(depth) >= maxDepth || depth >= upcoming.size()) {
                eval = clone.getHeight() + clone.countHoles();
            } else {
                eval = evaluateRecursive(clone, upcoming[depth],
                                         upcoming, depth + 1, maxDepth);
            }
            if (eval < bestEval) {
                bestEval = eval;
            }
        }
    }
    return bestEval;
}
```

**Caracteristicas clave:**
- Recorre las 40 posiciones (10 columnas x 4 rotaciones) por cada nivel de profundidad.
- Clona el tablero para cada posicion: cada rama del arbol opera sobre su propia copia.
- La heuristica `altura + huecos` evalua el tablero resultante en las hojas.
- Complejidad: $O(40^{N+1})$ para un look-ahead de profundidad $N$.

### 2. Solver OpenMP: paralelizacion del nivel externo

```cpp
// solver_omp.cpp — Paralelizacion con OpenMP del nivel 0 del arbol
SearchResult BruteForceSolverOMP::findBestMove(const Board& board,
                                                PieceType current,
                                                const std::vector<PieceType>& upcoming,
                                                int lookAhead) {
    int bestHeuristic = std::numeric_limits<int>::max();
    int bestX = 3;
    int bestRotation = 0;

    #pragma omp parallel for
    for (int idx = 0; idx < BOARD_WIDTH * NUM_ROTATIONS; ++idx) {
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
            eval = evaluateRecursive(clone, upcoming[0],
                                     upcoming, 1, maxDepth);
        }

        #pragma omp critical
        {
            if (eval < bestHeuristic) {
                bestHeuristic = eval;
                bestX = x;
                bestRotation = rot;
            }
        }
    }

    best.bestHeuristic = bestHeuristic;
    best.bestX = bestX;
    best.bestRotation = bestRotation;
    return best;
}
```

**Caracteristicas clave:**
- Aplanamiento del bucle anidado: `idx = x * 4 + rot` distribuye uniformemente 40 iteraciones entre 8 hilos (~5 por hilo).
- Variables `idx`, `x`, `rot`, `dropY`, `eval`, `clone` son privadas por hilo (automaticas en `parallel for`).
- Seccion critica serializa la actualizacion de `bestHeuristic`: overhead despreciable (8 accesos en total).
- Sin false sharing: cada hilo opera sobre su propia copia del tablero en el stack.

### 3. Solver CUDA: kernel GPU con codificacion base-40

```cpp
// solver_cuda.cu — Kernel de busqueda exhaustiva en GPU
__global__ void bruteForceKernel(
    const int* g_board,
    const int* g_pieceSeq,
    int g_numPieces,
    int g_maxDepth,
    int* g_bestHeuristic,
    int* g_bestX,
    int* g_bestRot)
{
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    const int NUM_POS = 40;
    int pow40[6];
    pow40[0] = 1;
    for (int i = 1; i < 6; ++i) pow40[i] = pow40[i-1] * NUM_POS;

    int totalPaths = pow40[g_maxDepth + 1];
    int stride = gridDim.x * blockDim.x;

    for (int pathId = tid; pathId < totalPaths; pathId += stride) {
        // Copiar tablero inicial a registros locales
        int board[200];
        for (int i = 0; i < 200; ++i) board[i] = g_board[i];

        bool valid = true;
        int path = pathId;

        // Decodificar camino en base 40
        for (int level = 0; level <= g_maxDepth && valid; ++level) {
            int choice = path % NUM_POS;
            path /= NUM_POS;

            int x = choice / 4;
            int rot = choice % 4;
            int pieceType = g_pieceSeq[level];

            int dropY = d_findDropY(board, pieceType, rot, x);
            if (dropY < 0) { valid = false; break; }
            d_place(board, pieceType, rot, x, dropY);
            int linesCleared;
            d_clearLines(board, linesCleared);
        }

        if (!valid) continue;

        int heuristic = d_getHeight(board) + d_countHoles(board);
        int firstChoice = pathId % NUM_POS;

        // Condicion de carrera benigna: sin atomicMin
        if (heuristic < g_bestHeuristic[firstChoice]) {
            g_bestHeuristic[firstChoice] = heuristic;
            g_bestX[firstChoice] = firstChoice / 4;
            g_bestRot[firstChoice] = firstChoice % 4;
        }
    }
}
```

**Caracteristicas clave:**
- Grid-strided loop: cada thread procesa multiples caminos, reutilizando registros.
- Codificacion base-40: cada camino se representa como un entero donde cada digito es una posicion (columna x rotacion).
- `int board[200]` en register file: 800 bytes por thread, sin heap ni memoria compartida.
- Memoria constante (`__constant__`) para las piezas: broadcast a todos los hilos sin contencion.
- Condicion de carrera benigna: `g_bestHeuristic` se escribe sin `atomicMin` porque ambos resultados son validos y la comparacion es idempotente.

### 4. Solver MPI: distribucion stride y reduccion colectiva

```cpp
// solver_mpi.cpp — Distribucion stride con MPI_Allreduce
SearchResult BruteForceSolverMPI::findBestMove(
    const Board& board, PieceType current,
    const std::vector<PieceType>& upcoming, int lookAhead)
{
    int rank, worldSize;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &worldSize);

    struct {
        int score;
        int index;   // codifica x * NUM_ROTATIONS + rot
    } localBest, globalBest;

    localBest.score = std::numeric_limits<int>::max();
    localBest.index = 0;

    const int totalPositions = BOARD_WIDTH * NUM_ROTATIONS; // 40

    // Distribucion stride: cada proceso evalua posiciones donde idx % worldSize == rank
    for (int idx = rank; idx < totalPositions; idx += worldSize) {
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
            eval = evaluateRecursive(clone, upcoming[0],
                                     upcoming, 1, maxDepth);
        }

        if (eval < localBest.score) {
            localBest.score = eval;
            localBest.index = idx;
        }
    }

    // Recoleccion global: MPI_MINLOC retorna el indice del proceso con el minimo
    MPI_Allreduce(&localBest, &globalBest, 1, MPI_2INT,
                  MPI_MINLOC, MPI_COMM_WORLD);

    SearchResult result;
    result.bestX = globalBest.index / NUM_ROTATIONS;
    result.bestRotation = globalBest.index % NUM_ROTATIONS;
    result.bestHeuristic = globalBest.score;
    return result;
}
```

**Caracteristicas clave:**
- Distribucion stride sin `MPI_Scatter`: cada proceso calcula sus indices localmente, sin overhead de serializacion.
- `MPI_Allreduce` con `MPI_MINLOC`: reduce el minimo global y retorna el indice del proceso que lo proporciono, en una sola operacion colectiva.
- `MPI_2INT`: tipo derivado que empaqueta `{score, index}` para la reduccion.
- Sin comunicacion punto a punto: la unica comunicacion es la reduccion final, minimizando latencia de red.

### 5. Tipos y constantes compartidos

```cpp
// types.h — Constantes y tipos del dominio
constexpr int BOARD_WIDTH = 10;
constexpr int BOARD_HEIGHT = 20;

enum PieceType : int {
    PIECE_I = 1, PIECE_O = 2, PIECE_T = 3,
    PIECE_S = 4, PIECE_Z = 5, PIECE_J = 6, PIECE_L = 7,
};

constexpr int NUM_PIECE_TYPES = 7;
constexpr int NUM_ROTATIONS = 4;

struct SearchResult {
    int bestX;
    int bestRotation;
    int bestHeuristic;
};
```

### 6. Jerarquia de clases del solver

```
BruteForceSolver (base, secuencial)
    ├── BruteForceSolverOMP  (override findBestMove, OpenMP)
    ├── BruteForceSolverCUDA  (override findBestMove, CUDA)
    └── BruteForceSolverMPI   (override findBestMove, MPI)
```

Todos los solver heredan `findDropY` y `evaluateRecursive` de la clase base `BruteForceSolver`. Solo `findBestMove` se sobreescribe, encapsulando la estrategia de paralelizacion en cada implementacion.