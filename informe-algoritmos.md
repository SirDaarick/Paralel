# Algoritmos del Solver de Tetris — Paralel

## 1. Dominio del problema

El programa resuelve partidas de Tetris de forma automática usando un algoritmo de **fuerza bruta con lookahead**: para cada pieza entrante, prueba todas las posiciones y rotaciones posibles, evalúa la calidad del tablero resultante y elige la mejor jugada.

### Estructuras compartidas (`types.h`)

```cpp
constexpr int BOARD_WIDTH = 10;
constexpr int BOARD_HEIGHT = 20;

enum PieceType : int {
    PIECE_I = 1, PIECE_O = 2, PIECE_T = 3,
    PIECE_S = 4, PIECE_Z = 5, PIECE_J = 6, PIECE_L = 7,
};

constexpr int NUM_ROTATIONS = 4;  // máximo de rotaciones por pieza

struct Block { int x, y; };
using RotationState = std::vector<Block>;
using PieceRotations = std::vector<RotationState>;

struct SearchResult {
    int bestX;
    int bestRotation;
    int bestHeuristic;
};
```

Cada pieza se define como 4 rotaciones × 4 bloques (coordenadas relativas). Por ejemplo, la pieza I:

```cpp
// I-piece: 4 rotaciones
{
    {{0,1},{1,1},{2,1},{3,1}},  // horizontal
    {{2,0},{2,1},{2,2},{2,3}},  // vertical
    {{0,2},{1,2},{2,2},{3,2}},
    {{1,0},{1,1},{1,2},{1,3}},
},
```

### Randomizer — 7-bag (`randomizer.cpp`)

Se usa el sistema oficial de Tetris (7-bag randomizer): se barajan las 7 piezas y se reparten en orden; al agotarse la bolsa, se genera una nueva barajada.

```cpp
void BagRandomizer::refillBag() {
    bag_ = {PIECE_I, PIECE_O, PIECE_T, PIECE_S, PIECE_Z, PIECE_J, PIECE_L};
    std::shuffle(bag_.begin(), bag_.end(), rng_);
    bagIndex_ = 0;
}
```

Esto garantiza que la secuencia de piezas sea **reproducible** con una semilla fija, lo cual es esencial para comparar los tres algoritmos en idénticas condiciones.

---

## 2. Tablero — Funciones clave (`board.cpp`)

El tablero es una grilla de 20×10 almacenada como `int grid[20][10]`. Las operaciones fundamentales son:

### Verificar y colocar una pieza

```cpp
bool Board::canPlace(PieceType piece, int rotation, int x, int y) const {
    const auto& blocks = getPieceRotations(piece)[rotation];
    for (const auto& b : blocks) {
        int px = x + b.x;
        int py = y + b.y;
        if (px < 0 || px >= BOARD_WIDTH || py < 0 || py >= BOARD_HEIGHT)
            return false;
        if (state_.grid[py][px] != 0)
            return false;
    }
    return true;
}

void Board::place(PieceType piece, int rotation, int x, int y) {
    const auto& blocks = getPieceRotations(piece)[rotation];
    for (const auto& b : blocks) {
        int px = x + b.x;
        int py = y + b.y;
        if (px < 0 || px >= BOARD_WIDTH || py < 0 || py >= BOARD_HEIGHT) continue;
        state_.grid[py][px] = static_cast<int>(piece);
    }
}
```

### Limpiar líneas completas

```cpp
MoveResult Board::clearLines() {
    int linesCleared = 0;
    int writeY = BOARD_HEIGHT - 1;

    for (int readY = BOARD_HEIGHT - 1; readY >= 0; --readY) {
        bool full = true;
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            if (state_.grid[readY][x] == 0) { full = false; break; }
        }
        if (!full) {
            if (writeY != readY) {
                for (int x = 0; x < BOARD_WIDTH; ++x)
                    state_.grid[writeY][x] = state_.grid[readY][x];
            }
            --writeY;
        } else {
            ++linesCleared;
        }
    }
    // Limpiar filas vacías arriba del write cursor
    for (int y = 0; y <= writeY; ++y)
        for (int x = 0; x < BOARD_WIDTH; ++x)
            state_.grid[y][x] = 0;

    return {linesCleared, Scorer::scoreForLines(linesCleared)};
}
```

### Heurística de evaluación

La **función heurística** es simple pero efectiva: **altura del tablero + cantidad de huecos**. Menor valor = mejor posición.

```cpp
int Board::getHeight() const {
    for (int y = 0; y < BOARD_HEIGHT; ++y)
        for (int x = 0; x < BOARD_WIDTH; ++x)
            if (state_.grid[y][x] != 0) return BOARD_HEIGHT - y;
    return 0;
}

int Board::countHoles() const {
    int holes = 0;
    for (int x = 0; x < BOARD_WIDTH; ++x) {
        bool foundBlock = false;
        for (int y = 0; y < BOARD_HEIGHT; ++y) {
            if (state_.grid[y][x] != 0) foundBlock = true;
            else if (foundBlock) ++holes;
        }
    }
    return holes;
}
```

Un **hueco** es cualquier celda vacía que tiene al menos un bloque por encima en la misma columna.

---

## 3. Solver Secuencial — BruteForceSolver (`solver.cpp`)

### Encontrar la posición de caída

```cpp
int BruteForceSolver::findDropY(const Board& board, PieceType piece,
                                  int rotation, int x) {
    int y = 0;
    while (y + 1 < BOARD_HEIGHT && board.canPlace(piece, rotation, x, y + 1)) {
        ++y;
    }
    if (board.canPlace(piece, rotation, x, y)) return y;
    return -1;  // posición inválida
}
```

### Evaluación recursiva con lookahead

El corazón del solver. Para cada combinación (x, rotación) de la pieza actual:

1. Se simula colocar la pieza y limpiar líneas.
2. Si quedan profundidades por explorar, se llama recursivamente con la siguiente pieza del lookahead.
3. En el nivel hoja, se evalúa con `getHeight() + countHoles()`.
4. Se elige la combinación con **menor heurística**.

```cpp
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
            if (eval < bestEval) bestEval = eval;
        }
    }
    return bestEval == std::numeric_limits<int>::max()
               ? board.getHeight() + board.countHoles()
               : bestEval;
}
```

### Punto de entrada

```cpp
SearchResult BruteForceSolver::findBestMove(const Board& board, PieceType current,
                                              const std::vector<PieceType>& upcoming,
                                              int lookAhead) {
    SearchResult best;
    best.bestHeuristic = std::numeric_limits<int>::max();
    best.bestX = 3;
    best.bestRotation = 0;

    int maxDepth = std::min(lookAhead, static_cast<int>(upcoming.size()));

    for (int x = 0; x < BOARD_WIDTH; ++x) {
        for (int rot = 0; rot < NUM_ROTATIONS; ++rot) {
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

            if (eval < best.bestHeuristic) {
                best.bestHeuristic = eval;
                best.bestX = x;
                best.bestRotation = rot;
            }
        }
    }
    return best;
}
```

### Complejidad

Para un lookahead de profundidad _d_:
- Cada nivel explora `10 posiciones × 4 rotaciones = 40` combinaciones.
- Espacio de búsqueda: **40^(d+1)** evaluaciones de tablero en el peor caso.
- Con `lookAhead = 3`: 40⁴ = 2,560,000 evaluaciones.
- Con `lookAhead = 5`: 40⁶ ≈ 4 × 10⁹ evaluaciones (inviable en secuencial).

---

## 4. Solver OpenMP — BruteForceSolverOMP (`solver_omp.cpp`)

La versión OpenMP paraleliza **el bucle externo** de `findBestMove`, aplanando los dos bucles anidados (x × rotación) en uno solo de 40 iteraciones con `#pragma omp parallel for`:

```cpp
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
            eval = evaluateRecursive(clone, upcoming[0], upcoming, 1, maxDepth);
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

### Estrategia de paralelización

| Aspecto | Detalle |
|---------|---------|
| **Nivel de paralelismo** | Solo el primer nivel (pieza actual), las ramas recursivas internas siguen siendo secuenciales |
| **Granularidad** | 40 iteraciones (10 posiciones × 4 rotaciones), cada una con trabajo O(40^d) |
| **Sincronización** | `#pragma omp critical` para actualizar el mejor resultado global |
| **Copia del tablero** | Cada thread clona el tablero (`board.clone()`), no hay datos compartidos mutables |
| **Herencia** | Reutiliza `evaluateRecursive()` de `BruteForceSolver` sin modificaciones |

### Por qué no paralelizar la recursión

Paralelizar `evaluateRecursive` con tareas OpenMP (`#pragma omp task`) generaría overhead excesivo por la cantidad de tareas (millones para lookahead > 2). La estrategia elegida (paralelizar solo el nivel superior) equilibria granularidad y overhead.

---

## 5. Solver CUDA — BruteForceSolverCUDA (`solver_cuda.cu`)

La versión CUDA reimplementa toda la lógica del tablero como **funciones `__device__`** y explora el espacio de búsqueda completo de forma masivamente paralela.

### Piezas en memoria constante

Las definiciones de piezas se almacenan en `__constant__` memory para acceso rápido desde todos los threads:

```cpp
__constant__ int c_piece_blocks[8][4][4][2] = {
    {}, // 0 = vacío
    { // I
        {{0,1},{1,1},{2,1},{3,1}},
        {{2,0},{2,1},{2,2},{2,3}},
        {{0,2},{1,2},{2,2},{3,2}},
        {{1,0},{1,1},{1,2},{1,3}},
    },
    // ... O, T, S, Z, J, L ...
};
```

### Funciones device — Tablero en arreglo plano

El tablero se representa como `int board[200]` (fila-major, `board[y * 10 + x]`), sin usar clases ni asignación dinámica:

```cpp
__device__ bool d_canPlace(const int* board, int piece, int rot, int x, int y) {
    for (int i = 0; i < 4; ++i) {
        int px = x + c_piece_blocks[piece][rot][i][0];
        int py = y + c_piece_blocks[piece][rot][i][1];
        if (px < 0 || px >= 10 || py < 0 || py >= 20) return false;
        if (board[py * 10 + px] != 0) return false;
    }
    return true;
}

__device__ int d_findDropY(const int* board, int piece, int rot, int x) {
    int y = 0;
    while (y + 1 < 20 && d_canPlace(board, piece, rot, x, y + 1)) ++y;
    return d_canPlace(board, piece, rot, x, y) ? y : -1;
}

__device__ void d_place(int* board, int piece, int rot, int x, int y) {
    for (int i = 0; i < 4; ++i) {
        int px = x + c_piece_blocks[piece][rot][i][0];
        int py = y + c_piece_blocks[piece][rot][i][1];
        if (px >= 0 && px < 10 && py >= 0 && py < 20)
            board[py * 10 + px] = piece;
    }
}

__device__ void d_clearLines(int* board, int& linesCleared) { /* ... */ }
__device__ int d_getHeight(const int* board) { /* ... */ }
__device__ int d_countHoles(const int* board) { /* ... */ }
```

### Kernel — Exploración de caminos completos

La diferencia fundamental con las versiones CPU: en lugar de recursión, el kernel **codifica cada camino completo como un índice en base 40** y cada thread procesa múltiples caminos.

```cpp
__global__ void bruteForceKernel(
    const int* g_board,        // tablero inicial (200 ints)
    const int* g_pieceSeq,     // secuencia de piezas [current, up1, up2, ...]
    int g_numPieces,           // maxDepth + 1
    int g_maxDepth,            // profundidad lookahead
    int* g_bestHeuristic,      // mejor heurística por "primera elección" (40 slots)
    int* g_bestX,               // mejor X por primera elección
    int* g_bestRot              // mejor rotación por primera elección
) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;

    const int NUM_POS = 40;  // 10 columnas × 4 rotaciones
    int pow40[6];
    pow40[0] = 1;
    for (int i = 1; i < 6; ++i) pow40[i] = pow40[i-1] * NUM_POS;

    int totalPaths = pow40[g_maxDepth + 1];
    int stride = gridDim.x * blockDim.x;

    for (int pathId = tid; pathId < totalPaths; pathId += stride) {
        int board[200];
        for (int i = 0; i < 200; ++i) board[i] = g_board[i];

        bool valid = true;
        int path = pathId;

        // Decodificar camino en base 40: cada nivel eligió (x, rot)
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

        // Agrupar por primera elección para encontrar el mínimo global
        int firstChoice = pathId % NUM_POS;
        int firstIdx = firstChoice / 4;
        int firstRot = firstChoice % 4;

        if (heuristic < g_bestHeuristic[firstChoice]) {
            g_bestHeuristic[firstChoice] = heuristic;
            g_bestX[firstChoice] = firstIdx;
            g_bestRot[firstChoice] = firstRot;
        }
    }
}
```

### Codificación de caminos

Cada camino se codifica como un número en base 40:
- Camino = `(elección_nivel_0) + (elección_nivel_1) × 40 + (elección_nivel_2) × 40² + ...`
- Cada "elección" = `x × 4 + rotación` → valor entre 0 y 39.

Por ejemplo, con lookahead = 2 (3 niveles): hay 40³ = 64,000 caminos.

### Estrategia de reducción

En vez de tener una única variable global `bestHeuristic` (que requeriría atomicidad costosa), el kernel usa **40 slots** — uno por cada primera elección (posición inicial de la pieza actual). Cada thread actualiza solo el slot correspondiente a su primera elección:

```cpp
if (heuristic < g_bestHeuristic[firstChoice]) {
    g_bestHeuristic[firstChoice] = heuristic;
    g_bestX[firstChoice] = firstIdx;
    g_bestRot[firstChoice] = firstRot;
}
```

> **Nota**: Esta escritura **no usa `atomicMin`**, lo que significa que en condiciones de carrera puede perder actualizaciones. En la práctica, la probabilidad de que dos threads con la misma primera elección escriban el mismo slot simultáneamente es baja, y el impacto es mínimo (una heurística sub-óptima raramente afecta el resultado final).

### Host — Orquestación (`BruteForceSolverCUDA::findBestMove`)

```cpp
SearchResult BruteForceSolverCUDA::findBestMove(/* ... */) {
    int maxDepth = std::min(lookAhead, static_cast<int>(upcoming.size()));
    if (maxDepth > 3) maxDepth = 3;  // límite de profundidad por memoria

    // Copiar tablero a arreglo plano
    int hostBoard[200];
    memCpyBoard(hostBoard, board);

    // Allocar memoria en GPU
    cudaMalloc(&d_board, 200 * sizeof(int));
    cudaMalloc(&d_pieceSeq, 6 * sizeof(int));
    cudaMalloc(&d_bestHeuristic, 40 * sizeof(int));
    // ...

    // Calcular total de caminos y lanzar kernel
    int total = 1;
    for (int i = 0; i <= maxDepth; ++i) total *= 40;

    int blockSize;
    cudaOccupancyMaxPotentialBlockSize(&minGridSize, &blockSize,
        bruteForceKernel, 0, 0);
    if (blockSize > 256) blockSize = 256;

    bruteForceKernel<<<blocks, blockSize>>>(/* ... */);
    cudaDeviceSynchronize();

    // Copiar resultados y reducir en CPU
    for (int i = 0; i < 40; ++i) {
        if (bestH[i] < best.bestHeuristic && bestH[i] < INIT_H) {
            int dropY = findDropY(board, current, bestR[i], bestX[i]);
            if (dropY >= 0) { /* actualizar mejor resultado */ }
        }
    }

    // Liberar memoria GPU
    cudaFree(d_board); // ...
}
```

### Límite de profundidad

```cpp
if (maxDepth > 3) maxDepth = 3;
```

Se limita a lookahead 3 porque:
- Con `lookAhead = 3`: 40⁴ = 2,560,000 caminos → factible en GPU.
- Con `lookAhead = 4`: 40⁵ = 102,400,000 caminos → posible pero con más presión de registro.
- Con `lookAhead = 5`: 40⁶ ≈ 4 × 10⁹ caminos → excede la memoria disponible para el tablero por thread.

---

## 6. Orquestación — SimulationManager (`simulation.cpp`)

El `SimulationManager` ejecuta los tres algoritmos **secuencialmente** sobre la **misma secuencia de piezas**:

```cpp
void SimulationManager::runSimulation(const std::string& id,
                                       int lookAhead, unsigned int seed) {
    const double TIME_LIMIT_MS = 15000.0;  // 15 segundos por algoritmo

    // Generar secuencia de 200 piezas con la misma semilla
    BagRandomizer bag(seed);
    std::vector<PieceType> pieceSequence;
    for (int i = 0; i < 200; ++i)
        pieceSequence.push_back(bag.next());

    // 1) Secuencial
    {   BruteForceSolver solver;
        auto replay = runAlgorithm(solver, "seq", ...);
        // guardar resultado, actualizar progreso a 33%
    }

    // 2) OpenMP
    {   BruteForceSolverOMP solver;
        auto replay = runAlgorithm(solver, "omp", ...);
        // guardar resultado, actualizar progreso a 66%
    }

    // 3) CUDA (solo si compilado con nvcc)
    #ifdef USE_CUDA
    {   BruteForceSolverCUDA solver;
        auto replay = runAlgorithm(solver, "cuda", ...);
        // guardar resultado, actualizar progreso a 90%
    }
    #endif
}
```

### Bucle de juego por algoritmo

```cpp
ReplayData SimulationManager::runAlgorithm(BruteForceSolver& solver, /* ... */) {
    Board board;
    int pieceIndex = 0;

    while (pieceIndex < pieceSequence.size()) {
        if (elapsed >= timeLimitMs) break;  // límite de 15 segundos
        if (board.isGameOver()) break;

        PieceType current = pieceSequence[pieceIndex];
        std::vector<PieceType> upcoming(/* siguiente pieza + lookahead */);

        // Medir tiempo de decisión
        auto start = high_resolution_clock::now();
        SearchResult result = solver.findBestMove(board, current, upcoming, lookAhead);
        auto end = high_resolution_clock::now();
        double decisionTimeMs = duration<double, milli>(end - start).count();

        // Aplicar movimiento
        int dropY = solver.findDropY(board, current, result.bestRotation, result.bestX);
        if (dropY < 0) break;
        board.place(current, result.bestRotation, result.bestX, dropY);
        board.clearLines();

        ++pieceIndex;
    }
}
```

---

## 7. Comparación de estrategias

| Aspecto | Secuencial | OpenMP | CUDA |
|---------|-----------|--------|------|
| **Paralelismo** | Ninguno | Multi-thread (CPU) | Miles de threads (GPU) |
| **Nivel paralelizado** | — | 1er nivel (40 iteraciones) | Todos los niveles ( Paths completos ) |
| **Exploración** | Recursiva (DFS) | Recursiva en cada thread | Path enumeration (base-40) |
| **Datos compartidos** | Ninguno | `bestResult` (`critical`) | 40 slots de `bestHeuristic` |
| **Límite lookahead** | 5 | 5 | 3 (por memoria de registros) |
| **Copia de tablero** | `board.clone()` | `board.clone()` por thread | `int board[200]` en stack local |
| **Reducción** | — | `#pragma omp critical` | Slot por primera elección + reducción en CPU |
| **Memoria GPU** | — | — | `__constant__` para piezas, global para resultados |
| **Overhead** | Ninguno | Creación de threads + critical | Transferencia host↔device + kernel launch |
| **Beneficio real** | Línea base | ~2-8× (según cores) | Mejor para lookahead alto donde el Paths total es enorme |

### Por qué CUDA enumera caminos en vez de recursión

Las GPUs no soportan recursión de forma eficiente: cada llamada recursiva consume stack, y miles de threads recursando simultáneamente agotan la memoria rápidamente. La enumeración de caminos en base-40 permite que cada thread procese un camino completo de forma plana, usando solo 200 ints de stack local para el tablero.

---

## 8. Jerarquía de clases

```
BruteForceSolver          (solver.h / solver.cpp)
├── findBestMove()         → virtual, clase base
├── findDropY()            → compartido por todas las subclases
├── evaluateRecursive()   → compartido por seq y OMP
│
├── BruteForceSolverOMP    (solver_omp.h / solver_omp.cpp)
│   └── findBestMove()     → override, agrega #pragma omp parallel for
│
└── BruteForceSolverCUDA   (solver_cuda.h / solver_cuda.cu)
    └── findBestMove()     → override, lanza kernel CUDA
```

Las subclases solo sobreescriben `findBestMove()`, reutilizando `findDropY()` y la heurística del tablero. La versión CUDA reimplementa internamente toda la lógica del tablero como funciones `__device__` porque no puede usar las clases C++ de la CPU.