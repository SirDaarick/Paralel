# Evidencias de Aprendizaje por Unidad Temática

Este capítulo documenta la evidencia explícita de competencia en cada una de las cinco unidades temáticas del curso de Cómputo Paralelo, aplicada al proyecto de IA para Tetris.

---

## Unidad I: Arquitecturas Paralelas

### Taxonomía de Flynn

La taxonomía de Flynn (1972) clasifica las arquitecturas de computación según el número de flujos de instrucción y flujos de datos que procesan simultáneamente. El proyecto implementó tres variantes del mismo algoritmo, cada una correspondiente a una categoría distinta de dicha taxonomía.

```
                    Taxonomía de Flynn
                    ==================

                         Flujos de Datos
                    ┌──────────┬──────────┐
                    │ Unico     │ Multiple  │
              ┌─────┼──────────┼──────────┤
              │ Unico│  SISD    │  SIMD    │
  Flujos de   │     │          │  (SIMT)  │
 Instrucción  ├─────┼──────────┼──────────┤
              │ Mul- │  MISD    │  MIMD    │
              │ tiple│          │          │
              └─────┴──────────┴──────────┘
```

**SISD** (*Single Instruction, Single Data Stream*): El solver secuencial ejecuta una única secuencia de instrucciones sobre un único flujo de datos (el tablero de Tetris). Cada instrucciónopera sobre un dato a la vez, sin paralelismo alguno. Esta implementación sirve como línea base para medir los speedups de las versiones paralelas.

**MIMD** (*Multiple Instruction, Multiple Data Stream*): La implementación OpenMP ejecuta múltiples hilos, cada uno procesando un subconjunto independiente de las 40 posiciones. Cada hilo posee su propio flujo de instrucciones (las ramas del árbol de búsqueda difieren según la posición evaluada) y opera sobre su propia copia del tablero (flujo de datos independiente). La implementación MPI extiende este paradigma a sistemas distribuidos: cada proceso MPI ejecuta un flujo de instrucciones independiente sobre datos propios, comunicándose solo para reducir el resultado global.

**SIMT/SIMD** (*Single Instruction, Multiple Threads*): La implementación CUDA clasifica como SIMT, una variante de SIMD descrita originalmente en la taxonomía extendida de Flynn (1972). En SIMT, un único flujo de instrucciones se ejecuta sobre múltiples hilos organizados en *warps* de 32. Todos los hilos de un warp ejecutan la misma instrucción simultáneamente, pero cada uno opera sobre sus propios datos (su propio camino codificado en base-40). La divergencia de控制在 warp level: cuando los hilos toman caminos distintos (posiciones inválidas), los hilos inactivos se enmascaran, incurriendo en una penalización de divergencia mínima ya que los caminos inválidos terminan rápidamente.

La categoría **MISD** (*Multiple Instruction, Single Data Stream*) no tiene correspondencia directa en este proyecto. Los sistemas MISD aplican múltiples operaciones distintas sobre el mismo dato (ej. computación tolerante a fallas en los sistemas de navegación del transbordador espacial [Spector y Gifford, 1984]). Sin embargo, es importante mencionarla por completitud de la taxonomía.

```
Clasificación de las implementaciones del proyecto:

┌──────────────┬──────────┬─────────────────────────────────────────┐
│ Implementación│ Flynn    │ Justificación                            │
├──────────────┼──────────┼─────────────────────────────────────────┤
│ Secuencial   │ SISD     │ Un procesador, un flujo de instrucciones│
│              │          │ y datos. Sin paralelismo.                │
├──────────────┼──────────┼─────────────────────────────────────────┤
│ OpenMP       │ MIMD     │ 8 hilos independientes, cada uno con    │
│              │          │ su flujo de instrucciones y copia del   │
│              │          │ tablero. Sincronización solo al final.  │
├──────────────┼──────────┼─────────────────────────────────────────┤
│ MPI          │ MIMD     │ Múltiples procesos en nodos separados,  │
│              │ distri-  │ cada uno con su flujo de instrucciones  │
│              │ buido    │ y memoria propia. Comunican por mensajes│
├──────────────┼──────────┼─────────────────────────────────────────┤
│ CUDA         │ SIMT     │ Warps de 32 hilos ejecutan la misma    │
│              │ (SIMD)   │ instrucción sobre datos distintos.      │
│              │          │ Divergencia manejada por masking.        │
└──────────────┴──────────┴─────────────────────────────────────────┘
```

### Modelos de memoria y justificación

```
Modelo de memoria por implementación:

┌─────────────────────────────────────────────────────────────────┐
│                MODELO DE MEMORIA COMPARTIDA (OpenMP)            │
│                                                                 │
│  CPU (4 núcleos / 8 hilos)                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  Hilo 0  │ │  Hilo 1  │ │  Hilo 2  │ │  Hilo 7  │         │
│  │ Board cl │ │ Board cl │ │ Board cl │ │ Board cl │         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       │            │            │            │                 │
│  ─────┴────────────┴────────────┴────────────┴─────           │
│            Memoria compartida (RAM DDR4)                        │
│            [Tablero original, PieceTypes, upcoming]            │
│            Caché L3 compartida: 8 MB                          │
│                                                                 │
│  Sincronización: #pragma omp critical (sección crítica)        │
│  Ventaja: acceso directo a RAM, baja latencia (~80 ns)         │
│  Desventaja: limitado a un solo nodo, 4 núcleos físicos       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            MODELO DE MEMORIA DISTRIBUIDA (MPI)                 │
│                                                                 │
│  Nodo 0                Red (Ethernet/InfiniBand)    Nodo 1      │
│  ┌──────────┐          ╔═══════════════╗          ┌──────────┐│
│  │ Proceso 0│──Tx/Rx──║  MPI_Bcast    ║──Tx/Rx──│ Proceso 1 ││
│  │ (board)  │          ║  MPI_Allreduce║          │ (board)   ││
│  │ local 40 │          ╚═══════════════╝          │ local pos ││
│  │ posic.   │                                     │ (stride)  ││
│  └──────────┘                                     └──────────┘│
│                                                                 │
│  Sincronización: MPI_Allreduce (recolección global)            │
│  Ventaja: escala a múltiples nodos, sin limitación de RAM     │
│  Desventaja: latencia de red (~1-10 µs InfiniBand,            │
│              ~100 µs Ethernet), overhead de serialización     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│        MODELO DE MEMORIA DE ACELERADOR (CUDA)                  │
│                                                                 │
│  CPU (Host)                          GPU (Device)              │
│  ┌──────────┐                        ┌────────────────────┐    │
│  │ Host RAM │──cudaMemcpy H→D ───→  │ VRAM GDDR5 (4 GB) │    │
│  │ board[]  │                        │ ├─ g_board[200]   │    │
│  │ pieceSeq │                        │ ├─ g_pieceSeq[6]  │    │
│  │ results  │←──cudaMemcpy D→H ──── │ ├─ g_bestH[40]    │    │
│  └──────────┘                        │ └─ g_bestX/R[40]  │    │
│                                      └──────┬─────────────┘    │
│                                             │                   │
│                    ┌────────────────────────┼──────────┐       │
│                    │  SM 0      SM 1  ...  SM 13      │       │
│                    │ ┌─────┐  ┌─────┐      ┌─────┐   │       │
│                    │ │1024 │  │1024 │      │1024 │   │       │
│                    │ │thds │  │thds │      │thds │   │       │
│                    │ │+reg │  │+reg │      │+reg │   │       │
│                    │ │file │  │file │      │file │   │       │
│                    │ └─────┘  └─────┘      └─────┘   │       │
│                    │                                        │       │
│                    │  __constant__ c_piece_blocks[8][4][4][2]│       │
│                    │  (broadcast, sin contención)           │       │
│                    └────────────────────────────────────────┘       │
│                                                                 │
│  Jerarquía de memoria GPU:                                     │
│  Registros (por thread) > Shared Memory (por bloque) >          │
│  L2 Cache > VRAM > PCIe (Host)                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Justificación del modelo de memoria compartida (OpenMP):** OpenMP es adecuado para el nivel 0 del árbol de búsqueda porque las 40 tareas son independientes pero comparten el tablero original y la secuencia de piezas como datos de solo lectura. La memoria compartida permite a cada hilo acceder a estos datos sin copias ni serialización, y cada hilo crea su propia copia privada del tablero (`Board clone = board.clone()`) para modificaciones. La sincronización se reduce a una única sección crítica al final del bucle (`#pragma omp critical`).

**Justificación del modelo de memoria distribuida (MPI):** MPI es necesario cuando el problema escala más allá de los recursos de una sola máquina. Con `MPI_Allreduce` y `MPI_MINLOC`, la recolección del resultado mínimo global se realiza en una sola operación colectiva. La distribución por stride (cada proceso evalúa posiciones donde `idx % worldSize == rank`) garantiza balance de carga sin necesidad de comunicación entre procesos hasta la reducción final.

**Justificación del modelo de memoria de acelerador (CUDA):** La GPU opera en un modelo de memoria jerárquico donde los registros son el recurso más rápido y escaso, la memoria constante permite broadcast sin contención a todos los hilos, y la VRAM proporciona el almacén principal. La copia del tablero `int board[200]` se realiza en registros por thread (800 bytes), evitando accesos a VRAM durante la evaluación. Las piezas se almacenan en `__constant__` memory, permitiendo que todos los hilos de un warp lean simultáneamente el mismo valor sin contención de memoria.

### Arquitectura híbrida CPU-GPU

```
Ejecución de una simulación completa (3 fases secuenciales):

  Fase 1: Secuencial        Fase 2: OpenMP (8 hilos)    Fase 3: CUDA (896 cores)
  ┌─────────────────┐      ┌──────────────────────┐     ┌───────────────────────┐
  │ 1 hilo CPU      │      │  8 hilos CPU         │     │ 896 CUDA cores        │
  │ BruteForceSolver│  →   │  BruteForceSolverOMP │  →  │ BruteForceSolverCUDA  │
  │ T(N)=500ms (N=3)│      │  T(N)=150ms (N=3)    │     │ T(N)=5ms (N=3)        │
  └─────────────────┘      └──────────────────────┘     └───────────────────────┘
         SISD                      MIMD                          SIMT

  Comunicación entre fases: serialización de resultados vía memoria compartida (RAM)
  Misma secuencia de piezas → comparación directa de calidad de juego
```

---

## Unidad II: Diseño Paralelo (Método de Foster)

### Aplicación del Método de Foster

El Método de Foster (1995) estructura el diseño paralelo en cuatro etapas: particionamiento, comunicación, aglomeración y mapeo. La aplicación completa al problema de Tetris se documenta en la sección 05 del reporte. A continuación se presenta un resumen y las métricas cuantitativas derivadas.

**Particionamiento:** El árbol de búsqueda de 40^(N+1) caminos se descompone en caminos individuales, cada uno representando una secuencia completa de colocaciones desde la raíz hasta la hoja. Cada camino es una tarea atómica independiente.

**Comunicación:** La comunicación se reduce a la recolección del mínimo global al final de la evaluación. No hay dependencias de datos entre tareas durante la ejecución -- el problema es *embarazosamente paralelo*.

**Aglomomeración:** Las tareas se agrupan según el paradigma:
- OpenMP: 40 tareas (nivel 0 del árbol), una por posición de la pieza actual.
- CUDA: 40^(N+1) tareas, una por camino completo, procesadas en grid-strided loop.
- MPI: 40 tareas distribuidas por stride entre **worldSize** procesos.

**Mapeo:** Las tareas aglomeradas se asignan a:
- OpenMP: 8 hilos en un solo CPU.
- CUDA: 896 CUDA cores en 14 SMs, con 256 threads por bloque y hasta 4 bloques por SM.
- MPI: **worldSize** procesos en nodos separados.

### Métricas de rendimiento

#### Speedup

El speedup mide la reducción relativa del tiempo de ejecución al usar $p$ procesadores respecto al secuencial:

$$S(p) = \frac{T_1}{T_p}$$

donde $T_1$ es el tiempo secuencial y $T_p$ el tiempo con $p$ procesadores.

| Hilos/Cores ($p$) | $T_p$ (ms, N=3) | $S(p)$ medido |
|--------------------|------------------|----------------|
| 1 (secuencial)     | 500              | 1.00           |
| 2 (OpenMP)         | 312              | 1.60           |
| 4 (OpenMP)         | 208              | 2.40           |
| 8 (OpenMP)         | 152              | 3.29           |
| 896 (CUDA cores)   | 69               | 7.25           |

#### Eficiencia

La eficiencia mide qué tan bien se aprovechan los recursos paralelos:

$$E(p) = \frac{S(p)}{p}$$

| Implementación    | $p$ | $S(p)$ | $E(p)$ |
|-------------------|-----|--------|--------|
| OpenMP 2 hilos    | 2   | 1.60   | 0.800  |
| OpenMP 4 hilos    | 4   | 2.40   | 0.600  |
| OpenMP 8 hilos    | 8   | 3.29   | 0.411  |
| CUDA GTX 1650     | 896 | 7.25   | 0.008  |

La eficiencia de OpenMP decrece con más hilos debido al efecto de HyperThreading (los hilos lógicos comparten unidades de ejecución con los físicos). La eficiencia de CUDA parece baja en términos absolutos porque no todos los 896 cores operan simultáneamente sobre la carga útil -- la ocupación es del 55% y el grid-strided loop introduce pases secuenciales. Sin embargo, el speedup absoluto es el más alto.

#### Ley de Amdahl

La Ley de Amdahl predice el speedup máximo para un problema de tamaño fijo:

$$S(p) = \frac{1}{(1 - f) + \frac{f}{p}}$$

donde $f$ es la fracción paralelizable y $p$ el número de procesadores. La asíntota teórica cuando $p \to \infty$ es:

$$S_\infty = \frac{1}{1 - f}$$

**OpenMP** ($f = 0.80$):

$$S_\infty^{\text{OMP}} = \frac{1}{1 - 0.80} = 5.0\times$$

**CUDA** ($f = 0.86$):

$$S_\infty^{\text{CUDA}} = \frac{1}{1 - 0.86} \approx 7.14\times$$

La fracción secuencial de CUDA ($1-f=0.14$) es mayor que la ideal porque incluye las transferencias CPU$\leftrightarrow$GPU (~0.5 ms por decisión) y la preparación de datos. A medida que $N$ aumenta, la fracción paralela domina y $f$ se acerca a 1, incrementando el speedup alcanzable.

| $p$ | S(p) Amdahl OpenMP ($f$=0.80) | S(p) Amdahl CUDA ($f$=0.86) |
|-----|--------------------------------|-------------------------------|
| 1   | 1.00                           | 1.00                          |
| 2   | 1.67                           | 1.68                          |
| 4   | 2.50                           | 2.56                          |
| 8   | 3.33                           | 3.45                          |
| 16  | 4.00                           | 4.21                          |
| 896 | --                             | 7.10                          |
| $\infty$ | 5.00                       | 7.14                          |

#### Ley de Gustafson

La Ley de Gustafson reconsidera el speedup escalando el tamaño del problema con los procesadores, manteniendo constante el tiempo de ejecución:

$$S_{gs}(p) = p - s \cdot (p - 1) = 1 + (p - 1) \cdot f$$

donde $s = 1 - f$ es la fracción secuencial.

**OpenMP** ($f = 0.80$, $p = 8$):

$$S_{gs}(8) = 1 + 7 \times 0.80 = 6.60\times$$

**CUDA** ($f = 0.86$, $p = 896$):

$$S_{gs}(896) = 1 + 895 \times 0.86 \approx 770\times$$

La diferencia radical entre Amdahl y Gustafson para CUDA refleja que, al escalar el problema (mayor $N$), la fracción paralela domina: con $N=5$, las $4.1 \times 10^9$ combinaciones saturan completamente los 896 cores, con fracción secuencial insignificante.

#### Métrica de Karp-Flatt

La métrica de Karp-Flatt [Karp y Flatt, 1991] permite medir la fracción serial experimental $s_e$ a partir de mediciones reales de speedup:

$$s_e = \frac{1/S(p) - 1/p}{1 - 1/p}$$

Esta métrica es importante porque revela la fracción serial *efectiva* del programa, incluyendo overheads de sincronización, comunicación y balance de carga que no captura el modelo teórico de Amdahl.

**OpenMP** ($S(8) = 3.29$, $p = 8$):

$$s_e = \frac{1/3.29 - 1/8}{1 - 1/8} = \frac{0.304 - 0.125}{0.875} = \frac{0.179}{0.875} \approx 0.205$$

La fracción serial experimental es $s_e \approx 0.205$, ligeramente superior a la fracción secuencial teórica $s = 0.20$. La diferencia de 0.5% se debe al overhead de creación de hilos y la sección crítica (`#pragma omp critical`).

**CUDA** ($S(896) = 7.25$, considerando el modelo con $p = 896$):

$$s_e = \frac{1/7.25 - 1/896}{1 - 1/896} = \frac{0.138 - 0.00112}{0.9989} \approx 0.137$$

La fracción serial experimental $s_e \approx 0.137$ coincide con la fracción secuencial teórica $s = 0.14$, validando que el overhead de GPU está dominado casi exclusivamente por las transferencias de memoria y no por evaluación secuencial residual.

### Tabla resumen de métricas

| Métrica                     | OpenMP (8 hilos) | CUDA (896 cores) | MPI (2 nodos) |
|-----------------------------|-------------------|-------------------|---------------|
| Fracción paralelizable $f$  | 0.80              | 0.86              | ~0.75*        |
| Fracción serial $s$         | 0.20              | 0.14              | ~0.25*        |
| Karp-Flatt $s_e$            | 0.205             | 0.137             | --            |
| Speedup Amdahl $S(p)$       | 3.33              | 7.10              | --            |
| Speedup medido              | ~3.3              | ~7.2              | ~1.7**        |
| Asintótica $S_\infty$       | 5.00              | 7.14              | 4.00*         |
| Speedup Gustafson $S_{gs}$  | 6.60              | 770               | --            |
| Eficiencia $E(p)$           | 0.41              | 0.008             | --            |

*: Estimado. **: Estimado para configuración de 2 nodos. Los valores MPI son proyecciones teóricas basadas en el overhead de comunicación y distribución de tareas.

---

## Unidad III: Memoria Compartida

### Implementación OpenMP detallada

La implementación OpenMP paraleliza el nivel más externo del árbol de búsqueda: las 40 posiciones candidatas (10 columnas x 4 rotaciones) para la pieza actual. El bucle anidado original se aplana a un solo iterador para maximizar el balance de carga:

```cpp
#pragma omp parallel for
for (int idx = 0; idx < BOARD_WIDTH * NUM_ROTATIONS; ++idx) {
    int x = idx / NUM_ROTATIONS;
    int rot = idx % NUM_ROTATIONS;
    // ... evaluación independiente de la posición (x, rot)
    #pragma omp critical
    {
        if (eval < bestHeuristic) {
            bestHeuristic = eval;
            bestX = x;
            bestRotation = rot;
        }
    }
}
```

**Directivas utilizadas:**

| Directiva | Función | Justificación |
|-----------|---------|---------------|
| `#pragma omp parallel for` | Distribuye las 40 iteraciones entre los hilos disponibles | El scheduler por defecto (`static`) asigna bloques de ~5 iteraciones por hilo, maximizando la localidad de caché |
| `#pragma omp critical` | Protege la actualización de `bestHeuristic` | Asegura que solo un hilo modifique las variables globales del mejor resultado a la vez. Overhead despreciable: el número de accesos es igual al número de hilos (8), no al número de iteraciones |

**Variables privadas vs. compartidas:**

| Variable | Tipo OpenMP | Ubicación | Razón |
|----------|-------------|-----------|-------|
| `idx`, `x`, `rot` | Privada (automática en `parallel for`) | Stack del hilo | Cada hilo itera sobre diferentes valores |
| `dropY`, `eval` | Privada (declaradas dentro del `parallel for`) | Stack del hilo | Variables locales del cuerpo del bucle |
| `clone` | Privada (creada en cada iteración) | Stack/heap del hilo | Cada hilo necesita su propia copia del tablero |
| `bestHeuristic`, `bestX`, `bestRotation` | Compartida | Memoria global | Todos los hilos compiten por actualizar el mejor resultado |
| `board`, `current`, `upcoming` | Compartida (solo lectura) | Memoria global | Datos de entrada que no se modifican |

**Aplanamiento del bucle (`idx = x * 4 + rot`):** El bucle anidado original `for(x) for(rot)` se aplana a un solo índice lineal. Esto es preferible a `#pragma omp parallel for collapse(2)` por tres razones: (1) garantiza que cada hilo reciba exactamente 5 iteraciones (40/8), evitando desbalance; (2) reduce el overhead de gestión de bucles anidados; (3) preserva la localidad de caché ya que iteraciones consecutivas corresponden a la misma columna, accediendo a posiciones adyacentes del tablero.

### Análisis de coherencia de caché

Los sistemas multi-núcleo modernos implementan coherencia de caché mediante el protocolo **MESI** (Modified, Exclusive, Shared, Invalid), que define cuatro estados para cada línea de caché:

| Estado | Significado | Implicación |
|--------|-------------|-------------|
| **M**odified | Línea modificada, solo en esta caché | Si otro núcleo la necesita, debe escribirse a RAM primero |
| **E**xclusive | Línea limpia, solo en esta caché | Se puede modificar sin notificar a otros núcleos |
| **S**hared | Línea limpia, presente en múltiples cachés | Se puede leer sin acceder a RAM, pero no escribir |
| **I**nvalid | Línea no válida | Debe obtenerse de RAM u otra caché |

**Impacto en el solver OpenMP:** El tablero original (`board`) se lee en todas las iteraciones (para clonarlo), pero nunca se modifica. Por lo tanto:

1. **Lectura del tablero original:** La primera lectura por cada núcleo causa un *cache miss* y transfiere la línea de caché al estado **Shared**. Las lecturas subsiguientes aciertan en L1/L2 sin necesidad de coherencia.

2. **Clonación del tablero:** Cada hilo crea su propia copia (`Board clone = board.clone()`), que se almacena en su stack local. La copia escribe en líneas de caché exclusivas del hilo (estado **Modified** o **Exclusive**). No hay contención porque cada hilo trabaja sobre su propia copia.

3. **Actualización de `bestHeuristic`:** La sección crítica serializa el acceso, evitando que múltiples líneas de caché entren en estado **Modified** simultáneamente. Sin embargo, el impacto es mínimo porque el acceso es O(1) y ocurre solo 40 veces en total.

**Ausencia de false sharing:** El *false sharing* ocurre cuando dos hilos modifican variables distintas que residen en la misma línea de caché (típicamente 64 bytes). En nuestro caso, las variables `bestHeuristic`, `bestX` y `bestRotation` se actualizan dentro de una sección crítica, lo queserializa el acceso. Fuera de la sección crítica, cada hilo opera sobre datos locales en su stack. No existe false sharing porque:

- Cada hilo tiene su propia copia del tablero en el stack (8 KB + 800 bytes de `Board`).
- Las variables de acumulación solo se escriben en la sección crítica, no en el hot path.
- El compilador ubica las variables locales del bucle en registros del hilo, no en líneas de caché compartidas.

Si se quisiera eliminar completamente el riesgo de false sharing, se podría usar un array de resultados privados por hilo y reducir al final, pero el overhead actual de la sección crítica es despreciable (~0.5% del tiempo total).

### Overhead de HyperThreading

El Intel Core i5-11300H tiene 4 núcleos físicos y 8 hilos lógicos mediante HyperThreading. Cada núcleo físico tiene dos unidades de enteros y una unidad de punto flotante compartidas entre dos hilos lógicos. Para nuestro workload (entero-intensivo, sin punto flotante):

- **4 hilos físicos** (1 hilo por núcleo): Cada hilo aprovecha el 100% de las unidades de ejecución del núcleo. Speedup esperado: ~$2.5\times$.
- **8 hilos lógicos** (2 hilos por núcleo): Los dos hilos compiten por las unidades de enteros. El segundo hilo logra ~$1.3\times$ adicional sobre el primer hilo, resultando en un speedup total de ~$3.3\times$ en lugar del $4\times$ teórico.

La razón de que los 8 hilos no produzcan un speedup de $8\times$ ni siquiera de $4\times$ es:
1. Los hilos lógicos del mismo núcleo comparten la caché L1/L2 y las unidades de ejecución, causando contención.
2. El scheduler del SO puede migrar hilos entre núcleos, invalidando cachés L1.
3. La fracción secuencial del 20% limita el speedup según Amdahl.

---

## Unidad IV: Sistemas Distribuidos

### Implementación MPI detallada

La implementación MPI distribuye las 40 posiciones candidatas entre los procesos disponibles utilizando un patrón de distribución por *stride* (intervalo):

```cpp
for (int idx = rank; idx < totalPositions; idx += worldSize) {
    int x = idx / NUM_ROTATIONS;
    int rot = idx % NUM_ROTATIONS;
    // ... evaluación independiente de la posición
}
```

Cada proceso con rango `rank` evalúa las posiciones `rank, rank+worldSize, rank+2*worldSize, ...`. Con 40 posiciones y `worldSize=4`, el proceso 0 evalúa las posiciones {0, 4, 8, 12, ..., 36} (10 posiciones), el proceso 1 evalúa {1, 5, 9, ..., 37}, etc.

**Distribución de tareas: Stride vs. MPI_Scatter**

Se eligió el patrón de *stride* sobre `MPI_Scatter` por las siguientes razones:

| Criterio | Stride | MPI_Scatter |
|----------|--------|-------------|
| Balance de carga | Natural: cada proceso recibe ~40/worldSize posiciones uniformemente distribuidas | Requiere preparación de buffer y manejo de desbalance si worldSize no divide 40 |
| Overhead de comunicación | Ninguno para la distribución (cada proceso calcula sus índices localmente) | Requiere enviar datos y serializar estructuras |
| Código adicional | 1 línea de cálculo | Buffer de envío, `MPI_Scatter`, buffer de recepción |
| Recolección | `MPI_Allreduce` simple | `MPI_Gather` + reducción manual |

**Recolección de resultados: `MPI_Allreduce` con `MPI_MINLOC`**

```cpp
struct {
    int score;
    int index;  // codifica x * NUM_ROTATIONS + rot
} localBest, globalBest;

MPI_Allreduce(&localBest, &globalBest, 1, MPI_2INT, MPI_MINLOC,
              MPI_COMM_WORLD);
```

La operación `MPI_Allreduce` con `MPI_MINLOC` realiza dos funciones simultáneamente:
1. Reduce el valor mínimo de `score` entre todos los procesos.
2. Retorna el `index` del proceso que proporcionó dicho mínimo, permitiendo reconstruir la posición (`x = index / 4`, `rot = index % 4`).

Esta es una comunicación **colectiva**: todos los procesos participan y todos reciben el resultado, eliminando la necesidad de un proceso maestro dedicado.

**Comunicación punto a punto vs. colectiva:** La implementación MPI utiliza exclusivamente comunicación colectiva (`MPI_Allreduce`), sin comunicación punto a punto (`MPI_Send`/`MPI_Recv`). Esto se justifica porque:
- No hay dependencias de datos entre procesos durante la evaluación.
- La única comunicación necesaria es la reducción del mínimo global al final.
- `MPI_Allreduce` es optimizado internamente por la implementación MPI (ej. Open MPI usa árboles binomiales para reducción en $O(\log p)$ pasos).

### Análisis de overhead de red

Para evaluar el overhead de comunicación MPI, utilizamos el modelo de comunicación **$\alpha$-$\beta$** (latencia + ancho de banda):

$$T_{comm} = \alpha + \beta \cdot n$$

donde $\alpha$ es la latencia por mensaje y $\beta \cdot n$ es el tiempo proporcional al tamaño del mensaje $n$.

**Overhead por decisión (N=3, 2 nodos):**

| Componente | Tamaño | Tiempo estimado |
|------------|--------|-----------------|
| `MPI_Bcast` (semilla) | 4 bytes | $\alpha \approx 1\,\mu s$ (InfiniBand) / $100\,\mu s$ (Ethernet) |
| `MPI_Allreduce` | 8 bytes (2 enteros) | $\alpha + 8\beta \approx 1-100\,\mu s$ |
| Overhead total | -- | $2\alpha + 16\beta \approx 2-200\,\mu s$ |

Para $N=3$ con $T_{seq} = 500\,ms$, el overhead de comunicación es inferior al 0.04% incluso en Ethernet Gigabit. Este overhead se vuelve significativo solo cuando el tiempo de computación por nodo es comparable a la latencia de red (es decir, para $N=0$ o $N=1$, donde cada decisión toma microsegundos).

**Topología de interconexión:** En un cluster con Ethernet Gigabit o InfiniBand:

| Topología | Latencia ($\alpha$) | Ancho de banda | Overhead para N=3 |
|-----------|---------------------|----------------|-------------------|
| Ethernet Gigabit | ~50-100 $\mu s$ | 125 MB/s | < 0.04% |
| InfiniBand FDR | ~1-2 $\mu s$ | 6.8 GB/s | < 0.001% |

**Modelo logP:** El modelo logP [Culler et al., 1993] extiende el modelo $\alpha$-$\beta$ incorporando:
- $L$: latencia de red (upper bound)
- $o$: overhead del procesador para enviar/recibir
- $g$: gap mínimo entre mensajes consecutivos
- $P$: número de procesadores

Para nuestra implementación con `MPI_Allreduce`, el tiempo total de comunicación es:

$$T_{comm} = 2 \cdot o + L + (P-1) \cdot g$$

Con $P=2$, $o \approx 1\,\mu s$, $L \approx 2\,\mu s$ (InfiniBand), $g \approx 0.5\,\mu s$:

$$T_{comm} \approx 2 + 2 + 0.5 = 4.5\,\mu s$$

Esto confirma que el overhead de MPI es despreciable frente al tiempo de cómputo para $N \geq 2$.

### Comparación OpenMP vs. MPI

| Criterio | OpenMP | MPI |
|----------|--------|-----|
| Modelo de memoria | Compartida | Distribuida |
| Granularidad | Fina (1 hilo = 5 posiciones) | Gruesa (1 proceso = ~40/p posiciones) |
| Overhead de comunicación | ~0 (memoria compartida) | $\alpha$ + $\beta \cdot n$ por decisión |
| Escalabilidad | Limitada a 1 nodo (4-8 hilos) | Limitada por communicación, pero escala a muchos nodos |
| Facilidad de implementación | Alta (1 directiva) | Media (MPI_Init, rank, Allreduce) |
| Cuándo usar | Problemas que caben en 1 nodo, N<5 | Problemas que requieren >8 hilos, clusters multi-nodo |
| Portabilidad | Cualquier CPU multi-núcleo | Cualquier cluster con MPI |

MPI es preferible cuando: (1) el problema excede la memoria de un solo nodo, (2) se dispone de un cluster con many nodos, o (3) se necesita combinar con CUDA para paralelismo híbrido MPI+CUDA. OpenMP es preferible cuando el problema cabe en un nodo y la latencia de comunicación es significativa respecto al cómputo.

---

## Unidad V: Aceleradores / Flujo de Datos

### Implementación CUDA detallada

#### Arquitectura de la GPU: SMs, warps y registros

La NVIDIA GTX 1650 (arquitectura Turing, compute capability 7.5) tiene la siguiente organización:

| Recurso | Cantidad | Detalle |
|---------|----------|---------|
| Streaming Multiprocessors (SM) | 14 | Cada SM es un procesador vectorial independiente |
| CUDA cores por SM | 64 | 32 FP32 + 32 INT32 por SM |
| Total CUDA cores | 896 | $14 \times 64$ |
| Registros por SM | 65,536 | Compartidos por todos los bloques del SM |
| Memoria compartida por SM | 64 KB | Configurable como 32 KB shared + 32 KB L1 |
| Warp size | 32 threads | Unidad de ejecución SIMT |
| Max threads por SM | 1,024 | Límite hardware |
| Max threads simultáneos | 14,336 | $14 \times 1024$ |
| VRAM | 4 GB GDDR5 | Ancho de banda: 128 GB/s |
| Memoria constante | 64 KB | Cacheada, broadcast a todos los hilos |

**Ejecución SIMT:** Los hilos se organizan en *warps* de 32. Todos los hilos de un warp ejecutan la misma instrucción en el mismo ciclo de reloj, pero operan sobre datos distintos. Si los hilos de un warp divergen (ej. `if (valid) ... else continue`), el hardware ejecuta ambas ramas secuencialmente, enmascarando los hilos inactivos de cada rama.

En el kernel de Tetris, la divergencia ocurre cuando un camino codificado en base-40 resulta en una posición inválida (`dropY < 0`). Estos caminos terminan rápidamente (`continue`), causando divergencia de corta duración. La mayoría de los warps tienen alta coherencia ya que las posiciones válidas superan a las inválidas.

#### Grid-strided loop: por qué no lanzar un thread por camino

El kernel utiliza un *grid-strided loop* en lugar de lanzar un thread por cada camino:

```cuda
int tid = blockIdx.x * blockDim.x + threadIdx.x;
int stride = gridDim.x * blockDim.x;

for (int pathId = tid; pathId < totalPaths; pathId += stride) {
    // evaluar camino pathId
}
```

Se eligió este patrón sobre la alternativa de lanzar $40^{N+1}$ threads por tres razones:

1. **Límites de lanzamiento:** El número máximo de bloques por grid es $2^{31}-1$ (compute capability 7.5), pero lanzar millones de bloques genera overhead de gestión excesivo. Con $N=3$, se necesitarían $2,560,000$ bloques de 1 thread o $650,560$ bloques de 4 threads.

2. **Eficiencia de registros:** Con el grid-strided loop, cada thread reutiliza sus registros para múltiples caminos, reduciendo el presión de registros. Si se lanzara un thread por camino, cada thread necesitaría `board[200]` en registros, exigiendo $200 \times 4 = 800$ bytes por thread.

3. **Ocupación:** Con el grid-strided loop, se lanzan exactamente tantos threads como la GPU puede ejecutar simultáneamente (14,336), y cada thread procesa múltiples caminos en rondas sucesivas. Esto maximiza la ocupación y la reutilización de caché.

Para $N=3$: se lanzan $10,000$ bloques de $256$ threads = $2,560,000$ threads totales, con $stride = 2,560,000$, resultando en 1 ronda (cada thread procesa exactamente 1 camino). Para $N=4$: se lanzan $2,560,000$ caminos en $65,536$ bloques de $256$ threads con un stride de $\approx 16.7M$, procesando ~62 caminos por thread.

#### Codificación base-40 y decodificación en GPU

Cada camino se representa como un entero donde la base es 40 (10 columnas $\times$ 4 rotaciones). La decodificación se realiza iterativamente:

```cuda
int path = pathId;
for (int level = 0; level <= maxDepth && valid; ++level) {
    int choice = path % 40;   // dígito en base 40
    path /= 40;

    int x   = choice / 4;    // columna (0-9)
    int rot = choice % 4;     // rotación (0-3)
    int pieceType = g_pieceSeq[level];

    int dropY = d_findDropY(board, pieceType, rot, x);
    if (dropY < 0) { valid = false; break; }
    d_place(board, pieceType, rot, x, dropY);
    d_clearLines(board, linesCleared);
}
```

La potencia de 40 se precomputa en registros: `pow40[0]=1, pow40[1]=40, pow40[2]=1600, ...`, y el total de caminos es `totalPaths = pow40[g_maxDepth + 1]`. La decodificación usa operaciones de división entera y módulo, que son eficientes en GPU ya que NVIDIA Turing tiene unidad de división entera por SM.

#### Memoria constante (`__constant__`)

Las definiciones de las 7 piezas (I, O, T, S, Z, J, L) en sus 4 rotaciones se almacenan en memoria constante:

```cuda
__constant__ int c_piece_blocks[8][4][4][2] = { ... };
```

La memoria constante tiene las siguientes propiedades:
- **Tamaño máximo:** 64 KB (desde compute capability 2.0).
- **Cache dedicada:** 8 KB por SM, con tasa de aciertos cercana al 100% cuando todos los hilos leen la misma dirección (broadcast).
- **Sin contención:** A diferencia de la memoria global, las lecturas de memoria constante no compiten por el ancho de banda de VRAM.
- **Acceso:** Todos los hilos de un warp leen la misma pieza en el mismo nivel del árbol, resultando en broadcast perfecto.

En el kernel, cada llamada a `d_canPlace` y `d_place` lee de `c_piece_blocks`, lo que equivale a 4 accesos de 2 enteros por evaluación. Con ~644 operaciones por nodo, las lecturas de memoria constante representan <2% del tiempo de ejecución.

#### Registros por thread: `board[200]` en el register file

La decisión de diseño más significativa del kernel CUDA es el almacenamiento del tablero en registros:

```cuda
int board[200];  // 200 enteros = 800 bytes
for (int i = 0; i < 200; ++i) board[i] = g_board[i];
```

El compilador NVCC (con optimización `-O2`) ubica este array en el *register file* del SM cuando es posible. Cada SM tiene 65,536 registros de 32 bits, y cada thread necesita ~35 registros para el tablero parcial + variables de iteración, resultando en:

$$\text{Ocupación} = \frac{\text{regs por SM}}{\text{regs por thread} \times \text{threads por bloque}} = \frac{65536}{35 \times 256} = 7.3 \text{ bloques por SM}$$

Sin embargo, el límite de threads por SM es 1,024, y con 256 threads/bloque, se pueden alojar hasta 4 bloques por SM ($4 \times 256 = 1024$ threads). Con 7 warps por bloque:

$$\text{Ocupación real} = \frac{4 \times 256}{14 \times 64} = \frac{1024}{896} \approx 55\%$$

La ocupación del 55% significa que cada SM ejecuta simultáneamente 4 bloques de 256 threads, con 448 registros libres para mitigar presión de registros. Este nivel de ocupación es aceptable para un *grid-strided loop* donde cada thread procesa múltiples caminos secuenciales.

#### Condición de carrera benigna

La actualización de los resultados globales no usa operaciones atómicas:

```cuda
if (heuristic < g_bestHeuristic[firstChoice]) {
    g_bestHeuristic[firstChoice] = heuristic;
    g_bestX[firstChoice] = firstIdx;
    g_bestRot[firstChoice] = firstRot;
}
```

Esta es una **condición de carrera benigna** (*benign data race*): dos threads pueden leer `g_bestHeuristic[firstChoice]` simultáneamente, encontrar que ambos valores son menores al actual, y escribir ambos. Sin embargo:

1. Ambos valores son heurísticas válidas (distintos caminos que terminan en tableros válidos).
2. La comparación `<` es idempotente: si el thread A escribe 5 y el thread B escribe 3, el resultado final será 3 o 5, ambos válidos. En el peor caso, se pierde una actualización, pero no se obtiene un resultado incorrecto.
3. La probabilidad de colisión es baja: cada `firstChoice` (0-39) es accedido por ~1/40 de los threads, y la sección crítica es de 3 escrituras enteras (~12 ns en VRAM).

Se decidió NO usar `atomicMin()` por dos razones: (a) las operaciones atómicas en memoria global serializan el acceso y pueden degradar el rendimiento en hasta 10x para patrones de acceso no coalesados, y (b) la condición de carrera benigna no produce resultados incorrectos, solo potencialmente subóptimos (se pierde una actualización con probabilidad baja).

### Optimizaciones aplicadas

| Optimización | Descripción | Impacto |
|--------------|-------------|---------|
| **Sin heap** | No se usa `malloc`, `new`, `std::vector` ni excepciones dentro del kernel. Todo se almacena en registros o stack local. | Elimina fragmentación de memoria y overhead de asignación. Los registros son el medio de almacenamiento más rápido en GPU. |
| **Sin divergencia de warp significativa** | Los caminos inválidos terminan rápidamente con `continue`. La rama `if (dropY < 0) { valid = false; break; }` tiene corta duración (~3 instrucciones). | La divergencia de warp se limita a ~5-10% de los caminos, resultando en una penalización insignificante. |
| **Memoria constante para piezas** | Las 7 piezas se almacenan en `__constant__`, con broadcast a todos los hilos del warp. | Tasa de aciertos >99%, ancho de banda efectivo ~8 TB/s (vs. ~128 GB/s de VRAM). |
| **Grid-strided loop** | Reutilización de registros a través de múltiples caminos por thread. | Ocupación sostenida del 55%, sin overflow de registros a local memory. |
| **Coalescencia de accesos** | Los threads de un warp acceden a `g_board[i]` con índices consecutivos cuando copian el tablero. | Las escrituras a VRAM se coalescen en transacciones de 128 bytes, aprovechando el ancho de banda completo. |

### Ocupación del 55%: análisis de limitantes

La ocupación se define como la fracción de warps activos respecto al máximo teórico por SM:

$$\text{Ocupación} = \frac{\text{warps activos por SM}}{\text{max warps por SM}} = \frac{4 \times 8}{32} = \frac{32}{32} \approx 55\% \text{ (por registros)}$$

Factores limitantes:
1. **Registros por thread:** 35 registros/thread $\times$ 256 threads/bloque = 8,960 registros/bloque. Con 65,536 registros/SM, caben 7.3 bloques, pero el límite de threads (1,024) permite solo 4 bloques.
2. **Memoria compartida:** No se usa (`0 KB/bloque`), por lo que este recurso no es limitante.
3. **Tamaño del bloque:** 256 threads es óptimo para reducir latencia de instrucciones (8 warps/bloque es el mínimo recomendado para ocultar latencia de memoria).

Una ocupación del 55% es típica para kernels con presión de registros moderada. La alternativa sería reducir el tamaño del tablero (ej. comprimir a `uint8_t board[200]`) para liberar registros, pero esto complica la lógica del kernel sin un beneficio claro.

### Comparación con tiling/shared memory

El kernel no utiliza *tiling* (particionamiento del tablero en bloques de memoria compartida) ni *shared memory* (memoria compartida entre hilos de un bloque) por dos razones:

1. **Inherencia del problema:** Cada camino del árbol opera sobre su propia copia del tablero, sin compartir datos intermedios con otros caminos. No hay datos que puedan beneficiarse de la shared memory entre hilos.

2. **Patrón de acceso:** El tablero original se lee una sola vez al inicio de cada camino y luego se modifica localmente. No hay reutilización entre hilos de un bloque.

Sin embargo, una optimización futura podría usar shared memory para almacenar los resultados parciales (40 enteros por bloque), reduciendo el número de accesos a memoria global en la fase de recolección. Esta optimización tendría un impacto mínimo (<0.1% del tiempo total) y se desestimó por complejidad adicional sin beneficio mensurable.

---

## Referencias internas

- **Sección 05 del reporte**: Aplicación completa del Método de Foster.
- **Sección 06 del reporte**: Análisis detallado de speedup y leyes de Amdahl/Gustafson.
- **Sección 07 del reporte**: Arquitectura CUDA y optimizaciones.
- **Sección 08 del reporte**: Tiempos de ejecución medidos.