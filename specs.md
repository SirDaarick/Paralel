# Especificaciones — Tetris Paralelo ("paralel")

## SPEC 1 — Arquitectura General
El sistema tiene dos componentes: un **frontend React (Vite + TypeScript)** y un **backend C++**. El backend expone una API REST. El frontend hace polling para obtener el estado. Las 3 simulaciones (secuencial, OpenMP, CUDA) se ejecutan **secuencialmente** en el backend sobre la **misma secuencia de piezas** (misma seed). El backend graba cada movimiento (pieza, rotación, posición X, duración de la decisión) y retorna los 3 replays al frontend, que los reproduce simultáneamente.

## SPEC 2 — Frontend: Setup del Proyecto
- Vite + React 18 + TypeScript.
- Sin librerías de UI externas. Todo CSS puro (o CSS Modules) para la estética retro.
- Sin router externo — estado propio con `useState`/`useReducer` para navegar entre las 3 pantallas (menú, simulación, resultados).
- Dependencias adicionales: ninguna, salvo lo que Vite genere por defecto.

## SPEC 3 — Frontend: Página de Menú Principal
- Título "paralel" en ASCII art o tipografía monoespaciada grande.
- Un **slider** etiquetado "Look-ahead pieces" con rango 1–5, valor por defecto 2.
- Un **botón** "COMENZAR" con estética de bloque de texto.
- Fondo negro/púrpura oscuro, texto en colores sólidos estilo IBM PC (cyan, magenta, amarillo, verde brillante).

## SPEC 4 — Frontend: Página de Simulación (Layout 3 Paneles)
- Pantalla dividida horizontalmente en 3 columnas iguales.
- Cada columna tiene: un **tablero de Tetris** (10×20), una etiqueta superior indicando el algoritmo (SEQ / OMP / CUDA), un contador de puntaje en tiempo real, y un indicador visual de "pensando..." cuando el algoritmo está calculando.
- A la derecha del tablero de cada panel: la **pieza actual** y las **N piezas siguientes** (según el look-ahead), visibles como miniaturas.
- Las 3 simulaciones se ejecutan sincronizadas visualmente: cuando el algoritmo más lento se atrasa, su panel se pausa (la pieza "espera"); cuando el algoritmo decide, se reproduce la animación de colocación.

## SPEC 5 — Frontend: Animaciones del Tablero
- **Colocación de pieza**: la pieza aparece en la posición elegida con una breve animación de "destello" o "blink" (2-3 frames).
- **Línea completa**: las celdas de la línea parpadean 2 veces y luego desaparecen. Las líneas superiores caen para rellenar el hueco con una animación de desplazamiento vertical (duración: ~300ms).
- **Indicador "pensando"**: la pieza siguiente titila o se muestra un borde parpadeante alrededor de ella, indicando que el algoritmo está calculando.

## SPEC 6 — Frontend: Colores de Piezas
Cada una de las 7 piezas tiene un color sólido y distinguible:

| Pieza | Color            |
|-------|------------------|
| I     | Cyan (#00FFFF)   |
| O     | Amarillo (#FFFF00) |
| T     | Magenta (#FF00FF) |
| L     | Naranja (#FF8800) |
| J     | Azul (#0000FF)   |
| S     | Verde (#00FF00)  |
| Z     | Rojo (#FF0000)   |

Las celdas del tablero deben renderizarse como bloques sólidos (caracteres █ o bloques `<div>` cuadrados) con el color de la pieza, sobre fondo oscuro. Sin bordes redondeados, sin sombras — estética plana y sólida tipo terminal.

## SPEC 7 — Frontend: Página de Resultados
- Muestra una tabla de 3 columnas (una por algoritmo) con: **puntaje final**, **piezas acomodadas**, **tiempo total de simulación** (en segundos, con 3 decimales), y **tiempo promedio por decisión**.
- Un botón "VOLVER AL MENÚ" que regresa a la pantalla de menú.
- Misma estética retro. Sin animaciones adicionales.

## SPEC 8 — Backend: Setup C++
- Servidor HTTP ligero. Se sugiere usar **Crow** (similar a Flask, header-only) o **cpp-httplib**.
- Build system: **CMake** con flags para compilar con y sin CUDA/OpenMP (modular).
- Compilador: `g++` con soporte OpenMP (`-fopenmp`). CUDA con `nvcc`.
- El binario del servidor debe compilarse en 3 versiones o flags que activen/desactiven CUDA según disponibilidad de hardware. Si CUDA no está disponible, ese algoritmo se marca como "no disponible" en el frontend.

## SPEC 9 — Backend: Motor de Tetris Compartido
Implementación unificada del estado del tablero y reglas de Tetris en C++:
- Tablero: matriz 10×20 de enteros (0 = vacío, 1-7 = color de pieza).
- Piezas: las 7 estándar con sus 4 rotaciones predefinidas como matrices de coordenadas relativas.
- Funciones: `colocarPieza(tablero, pieza, rotación, x, y)`, `limpiarLineas(tablero)`, `esGameOver(tablero)`.
- Generador de piezas: secuencia determinista basada en seed (bag system del Tetris moderno: una bolsa con las 7 piezas, se baraja, se repite).

## SPEC 10 — Backend: Algoritmo de Fuerza Bruta
- Dado un tablero actual, la pieza actual, y `N` piezas futuras (look-ahead), el algoritmo explora **todas** las posiciones y rotaciones posibles de la pieza actual, y para cada una evalúa recursivamente las `N` piezas siguientes.
- Cada posición se evalúa con la heurística: **altura máxima de la pila + número de huecos** (celdas vacías debajo de celdas ocupadas). Menor valor = mejor posición.
- La complejidad es exponencial: ~(10×4)^N ≈ 34^N posiciones a evaluar, lo cual justifica la paralelización.
- El resultado es: `{pieza, rotacion, x}` óptimos para la pieza actual.

## SPEC 11 — Backend: Versión OpenMP
- La búsqueda de fuerza bruta se paraleliza con `#pragma omp parallel for` en el primer nivel (posiciones de la pieza actual).
- Cada hilo evalúa un subconjunto de posiciones y reporta la mejor.
- Se usa `reduction(min:mejorHeuristica)` o variables thread-private con comparación final.

## SPEC 12 — Backend: Versión CUDA
- Se implementa un **kernel CUDA** que evalúa posiciones en paralelo en la GPU.
- Cada thread block/thread evalúa una o varias posiciones de la pieza actual y lanza kernels recursivos (o iterativos si N>1) para el look-ahead.
- Si el look-ahead es 1 (N=1), se lanza un solo kernel que evalúa todas las posiciones y devuelve la mejor vía reducción paralela.
- Para N>1: se implementa búsqueda en anchura (BFS) con múltiples kernels por nivel, o se limita el look-ahead en GPU a N=1-2 por complejidad y se escala artificialmente.
- Transferencia de datos: tablero como array plano `int[200]`, piezas como `int[7][4][4][2]` (pieza × rotación × bloque × [dx,dy]).

## SPEC 13 — Backend: Endpoints REST

| Método | Ruta                            | Descripción                                                                                          |
|--------|---------------------------------|------------------------------------------------------------------------------------------------------|
| `POST` | `/api/simular`                  | Inicia simulación. Body: `{"lookAhead": N}`. Responde con `{"simulationId": "uuid"}`.               |
| `GET`  | `/api/simular/{id}/status`      | Estado actual: `{"status": "running"\|"completed"\|"error", "progress": 0-100, "currentAlgorithm": "seq"\|"omp"\|"cuda"}`. |
| `GET`  | `/api/simular/{id}/resultados`  | Cuando `status == "completed"`, retorna los 3 replays completos.                                    |
| `GET`  | `/api/health`                   | Health check: `{"openmp": true, "cuda": true/false}`.                                                |

Formato de replay: array por algoritmo con objetos `{pieceType, rotation, x, decisionTimeMs, linesCleared}` más metadata `{finalScore, totalPieces, totalTimeMs}`.

## SPEC 14 — Backend: Grabación de Replay y Temporización
- Antes de cada decisión, el backend registra `t_start = now()`.
- Ejecuta el algoritmo (secuencial/OpenMP/CUDA) según corresponda.
- Después de la decisión, registra `t_end = now()`, calcula `decisionTimeMs = t_end - t_start`.
- Aplica el movimiento al tablero local (colocar pieza, limpiar líneas), registra el movimiento en el replay.
- El frontend reproduce el replay usando `decisionTimeMs` como delay antes de mostrar la colocación en ese panel específico. Esto es lo que crea la diferencia visual de velocidad entre algoritmos.

## SPEC 15 — Backend: Flujo Completo de Simulación
1. Backend recibe `POST /api/simular` con `lookAhead=N`.
2. Genera una seed aleatoria y la secuencia de piezas (suficientes para llenar ~15 segundos de juego, estimado ~60-100 piezas).
3. **Fase 1 (Secuencial)**: Itera sobre las piezas. Para cada una: mide tiempo, ejecuta fuerza bruta secuencial, aplica movimiento, guarda en replay[0].
4. **Fase 2 (OpenMP)**: Resetea tablero. Itera sobre la misma secuencia. Mide tiempo, ejecuta fuerza bruta con OpenMP, guarda en replay[1].
5. **Fase 3 (CUDA)**: Resetea tablero. Misma secuencia. Mide tiempo, ejecuta con CUDA, guarda en replay[2].
6. Marca simulación como completada. Frontend detecta vía polling y obtiene resultados.
7. **Timeout global**: si alguna fase excede 15 segundos, se detiene y se reporta lo acumulado hasta ese punto.

## SPEC 16 — Sistema de Puntuación
- 1 línea completada = 100 puntos.
- 2 líneas = 300 puntos.
- 3 líneas = 500 puntos.
- 4 líneas (Tetris) = 800 puntos.
- El puntaje se acumula durante la simulación y se muestra en tiempo real en cada panel. Al finalizar, se muestra el puntaje total en la pantalla de resultados.

## SPEC 17 — Estética Retro IBM PC (Detalles)
- **Tipografía**: Familia `"Courier New", "IBM Plex Mono", monospace`. Tamaños grandes para títulos, medianos para texto.
- **Paleta de fondo**: `#0C0C0C` (casi negro) para fondos. `#1A1A2E` para bordes/paneles.
- **Bordes**: Simples, de 2px sólidos con colores cyan/magenta.
- **Efecto CRT (opcional pero recomendado)**: scanlines sutiles vía CSS `repeating-linear-gradient` con opacidad muy baja (~0.03) sobre toda la pantalla. Sin curvatura.
- **Cursor**: Bloque parpadeante (se puede simular con CSS en el título).
- **Sliders y botones**: Estilizados con CSS puro para verse como widgets de interfaz de texto (ASCII art + colores sólidos).
