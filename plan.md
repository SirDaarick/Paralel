# Plan de Implementación — "paralel"

Cada módulo entrega una feature funcional y testeable.

---

## Módulo 1 — Scaffolding + Health Check
**Feature**: Proyecto corriendo. Frontend y backend se comunican.

| Frontend | Backend |
|----------|---------|
| `npm create vite@latest paralel-frontend -- --template react-ts` | `CMakeLists.txt` con Crow/cpp-httplib |
| Componente `App` básico con fetch a `/api/health` | Endpoint `GET /api/health` que responde `{"openmp": true, "cuda": false}` |
| Muestra estado del backend en pantalla (texto simple) | Ejecutable que levanta en `localhost:8080` |
| Proxy de Vite configurado para apuntar al backend | |

**Verificación**: Abrir navegador → texto "Backend: conectado. OpenMP: sí, CUDA: no".

---

## Módulo 2 — Motor de Tetris (Backend Puro)
**Feature**: Motor de juego completo programáticamente testeable.

- `Board`: matriz 10×20, `placePiece()`, `clearLines()`, `isGameOver()`, `clone()`
- `Piece`: 7 piezas con 4 rotaciones c/u, `getBlocks(pieceType, rotation)`
- `BagRandomizer`: bolsa con las 7 piezas, se baraja, se repite
- `Scorer`: 100/300/500/800 por 1/2/3/4 líneas
- Tests unitarios con un framework ligero (Catch2 o Google Test)

**Verificación**: Ejecutar tests → todos pasan. Se puede simular un juego completo desde terminal.

---

## Módulo 3 — Renderizado de Tablero (Frontend)
**Feature**: Componente React que dibuja un tablero de Tetris 10×20 con colores.

- `BoardRenderer.tsx`: recibe `grid: number[][]`, renderiza 10×20 celdas como `<div>` coloreados
- `PieceRenderer.tsx`: muestra la pieza actual y las siguientes N piezas como miniaturas
- `colors.ts`: mapeo pieza → color (cyan, amarillo, magenta, naranja, azul, verde, rojo)
- Datos dummy: un tablero predefinido con piezas acumuladas para probar el renderizado

**Verificación**: Abrir navegador → tablero de 10×20 con piezas de colores visibles.

---

## Módulo 4 — Algoritmo Secuencial + API de Simulación
**Feature**: Simulación funcional con 1 algoritmo. Juego completo con replay.

| Backend | Frontend |
|----------|----------|
| `BruteForceSolver`: fuerza bruta secuencial con look-ahead N (SPEC 10) | `SimulationPage`: 1 panel con tablero + pieza siguiente |
| `ReplayRecorder`: graba pieza, rotación, x, `decisionTimeMs` | `useSimulation()` hook: `POST /api/simular`, polling a `/status` y `/resultados` |
| `SimulationManager`: ejecuta simulación secuencial, devuelve replay | Reproduce replay: por cada movimiento, espera `decisionTimeMs`, coloca pieza |
| Endpoints: `POST /api/simular`, `GET /api/simular/{id}/status`, `GET /api/simular/{id}/resultados` | |

**Verificación**: Darle "Comenzar" (hardcodeado N=2) → 1 panel con Tetris jugando, piezas cayendo y colocándose con delays visibles, líneas desapareciendo, puntaje actualizándose.

---

## Módulo 5 — OpenMP + Segundo Panel
**Feature**: Comparación secuencial vs OpenMP lado a lado.

- Backend: `BruteForceSolverOMP` con `#pragma omp parallel for` (SPEC 11)
- Backend: `SimulationManager` ahora ejecuta ambas fases sobre la misma seed
- Frontend: Layout 2 paneles con etiquetas "SEQ" y "OMP"
- Frontend: Reproduce ambos replays simultáneamente
- Frontend: Indicador "pensando..." si `decisionTimeMs > threshold`

**Verificación**: 2 paneles corriendo. El panel OMP visiblemente más rápido (menos pausas).

---

## Módulo 6 — CUDA + Tercer Panel
**Feature**: Los 3 algoritmos comparados. Demostración completa del cómputo paralelo.

- Backend: `BruteForceSolverCUDA` con kernel CUDA (SPEC 12)
- Backend: `CMakeLists.txt` con `find_package(CUDA)`, compilación condicional
- Backend: `SimulationManager` ejecuta las 3 fases
- Backend: Health check reporta `"cuda": true/false` según compilación/disponibilidad
- Frontend: Layout 3 paneles con etiquetas "SEQ", "OMP", "CUDA"
- Frontend: Si CUDA no disponible, ese panel muestra "CUDA no disponible"
- Frontend: 3 replays simultáneos

**Verificación**: 3 paneles corriendo. Diferencia de velocidad clara: CUDA > OMP > SEQ.

---

## Módulo 7 — Menú Principal
**Feature**: Punto de entrada completo con configuración.

- `MenuPage.tsx`: título "paralel" en ASCII art, slider 1–5, botón COMENZAR
- Navegación con estado (`currentPage: "menu" | "simulation" | "results"`)
- Slider estilizado tipo TUI (CSS puro, barras de caracteres █)
- Botón con efecto hover/press de bloque sólido

**Verificación**: Abrir app → menú con título, slider funcional, botón COMENZAR → transiciona a simulación.

---

## Módulo 8 — Animaciones
**Feature**: Simulación visualmente pulida.

- Animación de colocación: destello/blink de 300ms en celdas de la pieza colocada
- Animación de línea completa: parpadeo 2x (400ms), luego las líneas superiores caen (`transform: translateY`) en 300ms
- Indicador "pensando": borde punteado parpadeante alrededor de la pieza siguiente
- Transiciones CSS `transition` para suavidad, sin librerías de animación externas

**Verificación**: Durante la simulación: destellos al colocar, líneas que parpadean y caen, indicador de espera visible en el algoritmo más lento.

---

## Módulo 9 — Pantalla de Resultados
**Feature**: Flujo completo menú → simulación → resultados → menú.

- `ResultsPage.tsx`: tabla 3 columnas con puntaje, piezas, tiempo total, tiempo promedio
- Botón "VOLVER AL MENÚ" → resetea estado y vuelve al menú
- Datos tomados del último frame de cada replay

**Verificación**: Simulación termina → tabla comparativa con datos reales → botón volver → menú.

---

## Módulo 10 — Estética Retro Completa + Pulido
**Feature**: Apariencia final tipo monitor IBM PC.

- Fondo `#0C0C0C`, bordes `#1A1A2E`, scrollbars estilizados
- Tipografía: `"Courier New", "IBM Plex Mono", monospace` en todo
- Efecto scanlines CSS (gradiente lineal semitransparente)
- Slider y botones con estética TUI pura (bordes de bloques ▓▒░, colores cyan/magenta/amarillo)
- Bordes de 2px sólidos en paneles
- Título "paralel" con arte ASCII responsivo
- Layout responsive: en desktop 3 columnas, en pantallas pequeñas se apila vertical

**Verificación**: Toda la app con look and feel retro cohesivo y funcional en desktop.

---

## Resumen de dependencias entre módulos

```
M1 (scaffolding)
 └─► M2 (motor tetris backend) ──┐
     M3 (renderizado frontend) ──┤
                                  └─► M4 (secuencial + API) ──► M5 (OpenMP) ──► M6 (CUDA)
                                                                                     │
M7 (menú) ◄──────────────────────────────────────────────────────────────────────────┘
 └─► M8 (animaciones) ──► M9 (resultados) ──► M10 (estética final)
```
