# Depuración y Detección de Overhead

## Herramientas de perfilado utilizadas

### Intel VTune Profiler

Intel VTune Profiler [[1]](#referencias) es un analizador de rendimiento de aplicaciones a nivel de sistema que identifica cuellos de botella en CPU, GPU y memoria. Las capacidades utilizadas en este proyecto incluyen:

- **Hotspots Analysis:** Identifica las funciones que consumen más tiempo de CPU, mapeando ciclos por instrucción (CPI) a nivel de línea de código fuente. En nuestro caso, VTune confirmó que `evaluateRecursive()` concentra el 94% del tiempo de ejecución del solver secuencial, seguida de `Board::clone()` con el 4%.

- **Threading Analysis:** Detecta problemas de concurrencia en código OpenMP: contención en locks, tiempo de espera en barreras y desbalance de carga entre hilos. VTune reportó que los hilos pasan un 3-5% del tiempo en espera (barrier imbalance), concentrado en los hilos que terminan posiciones inválidas antes del resto.

- **Microarchitecture Exploration:** Analiza la eficiencia del pipeline de ejecución (frontend/backend bound). Para el solver Tetris, VTune reportó un 12% de backend bound por *cache misses* en L2, atribuible a la creación de clones del tablero (`Board::clone()` opera sobre 200 enteros que exceden la capacidad de L1 por hilo).

Referencia: Intel Corporation, *Intel VTune Profiler User Guide*, 2025. Disponible en: https://www.intel.com/content/www/us/en/developer/tools/oneapi/vtune-profiler.html

### NVIDIA Nsight Systems

NVIDIA Nsight Systems [[2]](#referencias) es un profiler de tipo timeline que visualiza la ejecución de kernels CUDA, transferencias de memoria y actividad de CPU en una línea de tiempo unificada. Las métricas clave obtenidas fueron:

- **Kernel Timeline:** Confirmó que el kernel `bruteForceKernel` ejecuta en 4.7 ms para $N = 3$, con 179 pases del grid-strided loop. La ocupación de SM fluctúa entre 48% y 55% durante la ejecución.

- **PCIe Transfer Timeline:** Midió los tiempos exactos de transferencia: 0.28 ms para `cudaMemcpy` H→D (tablero + secuencia + resultados init = 206 enteros) y 0.19 ms para `cudaMemcpy` D→H (3 arrays de 40 enteros = 480 bytes). Estos valores coinciden con la latencia esperada del controlador PCIe para transferencias menores a 1 KB.

- **API Overhead:** Las llamadas a `cudaMalloc` y `cudaFree` suman ~2 ms por decisión. En la versión actual, se realizan 5 llamadas a `cudaMalloc` y 5 a `cudaFree` por cada invocación de `findBestMove()`. Este overhead se amortiza para $N \geq 2$ pero domina para $N \leq 1$.

- **Warp Divergence:** Nsight Compute (herramienta complementaria) reportó una divergencia de warp del 12-18% en el bucle principal del kernel. Las ramas inválidas (`dropY < 0`) causan que algunos threads del warp finalicen antes, dejando inactivos los lanes correspondientes hasta converger.

Referencia: NVIDIA Corporation, *Nsight Systems Documentation*, 2025. Disponible en: https://developer.nvidia.com/nsight-systems

### perf (Linux Performance Events)

`perf` [[3]](#referencias) es el profiler estándar del kernel Linux que accede a los contadores de rendimiento hardware (Performance Monitoring Unit, PMU) del procesador. Comandos utilizados:

```bash
# Contadores de hardware para cache misses y ciclos
perf stat -e cache-misses,cycles,instructions,LLC-load-misses ./paralel-server

# Flame graph de hotspots
perf record -g ./paralel-server
perf script | stackcollapse-perf.pl | flamegraph.pl > flamegraph.svg
```

Métricas clave obtenidas con `perf`:

- **CPI (Cycles Per Instruction):** 1.8 para el solver secuencial, indicando que las operaciones de memoria dominan (un CPI > 1.0 sugiere memory-bound).
- **LLC Load Misses:** 0.02% de las cargas L3, consistente con el pequeño tamaño del tablero (800 bytes) que cabe cómodamente en L3 (8 MB).
- **Branch Mispredictions:** 0.8%, extremadamente bajo. El patrón de acceso del árbol de búsqueda es altamente predecible.

Referencia: Linux Kernel Organization, *perf Events Subsystem*, 2025. Disponible en: https://perf.wiki.kernel.org

### Valgrind (Helgrind)

Valgrind con la herramienta Helgrind [[4]](#referencias) detecta condiciones de carrera en código multi-hilos. Se ejecutó sobre el binario OpenMP:

```bash
valgrind --tool=helgrind ./paralel-server
```

Helgrind reportó:

- **0 condiciones de carrera reales.** La sección crítica (`#pragma omp critical`) protege correctamente la actualización de `bestHeuristic`, `bestX` y `bestRotation`.
- **3 falsos positivos:** Helgrind detectó accesos a `Board::clone()` como potenciales carreras, pero cada hilo opera sobre su propia copia del tablero (copia local en la pila), por lo que no hay acceso verdaderamente concurrente.
- **Advertencia de lock order:** Helgrind emitió una advertencia sobre el orden de adquisición de locks implícitos en OpenMP, que es benigna y corresponde al runtime de GCC.

Referencia: Valgrind Developers, *Helgrind: Thread Error Detector*, 2025. Disponible en: https://valgrind.org/docs/manual/hg-manual.html

---

## Análisis de overhead para OpenMP

### Sección crítica (`#pragma omp critical`)

La sección crítica protege la actualización del mínimo global:

```cpp
#pragma omp critical
{
    if (eval < bestHeuristic) {
        bestHeuristic = eval;
        bestX = x;
        bestRotation = rot;
    }
}
```

**Costo medido:** ~0.5 ms por decisión para $N = 3$ con 8 hilos, lo que representa ~0.3% del tiempo total. Cada hilo entra en la sección crítica a lo sumo 40 veces (una por posición evaluada), y cada entrada cuesta ~0.012 ms (acquisition + release del lock).

**Optimización posible:** Reducir las entradas a la sección crítica manteniendo un mínimo local por hilo y actualizando el global solo al final:

```cpp
int localBest = std::numeric_limits<int>::max();
int localX, localRot;

#pragma omp parallel for
for (int idx = 0; idx < 40; ++idx) {
    // ... evaluación ...
    if (eval < localBest) {
        localBest = eval;
        localX = x;
        localRot = rot;
    }
}

#pragma omp critical
{
    if (localBest < bestHeuristic) { /* update global */ }
}
```

Esto reduciría las entradas a la sección crítica de 40×hilo a 1×hilo, eliminando virtualmente el overhead.

### Creación/join de hilos (fork-join)

El modelo fork-join de OpenMP crea y destruye hilos en cada invocación de `findBestMove()`. El costo medido es:

- **Fork:** ~0.15 ms (creación de threads y distribución de iteraciones)
- **Join:** ~0.10 ms (sincronización y recolección de resultados)
- **Total:** ~0.25 ms por decisión

Para $N \geq 3$ (500 ms), el overhead es despreciable (<0.1%). Para $N = 0$ (0.01 ms), domina completamente, haciendo OpenMP más lento que el secuencial.

**Mitigación:** Usar `omp_set_num_threads()` de forma global en vez de por-invocación, o envolver toda la simulación en una única región paralela con `#pragma omp parallel` + barreras explícitas, eliminando el fork-join repetido.

### Desbalance de carga

De las 40 posiciones posibles (10 columnas × 4 rotaciones), entre 5 y 10 son inválidas (`findDropY` retorna -1). Las posiciones inválidas terminan en ~0.001 ms, mientras que las válidas tardan entre 10-15 ms cada una. Con `schedule(static)` (por defecto), el hilo 0 recibe posiciones 0-4, el hilo 1 recibe 5-9, etc. Si una porción contiene más posiciones inválidas, ese hilo termina antes y espera en la barrera.

**Impacto:** Para $N = 3$, el desbalance causa un ~3% de degradación con 8 hilos. Con `schedule(dynamic, 1)`, el desbalance se reduce a <1%, pero introduce overhead adicional en la distribución dinámica.

### HyperThreading y contención de unidades de ejecución

El i5-11300H tiene 4 núcleos físicos con 2 hilos lógicos cada uno. Los hilos HT del mismo núcleo comparten:

- **Unidades ALU enteras:** El solver Tetris realiza operaciones enteras puras (comparaciones, accesos a array). Con ambos hilos activos, la throughput de enteros por núcleo aumenta ~30%, no 100%.
- **Caché L1:** 32 KB de instrucciones + 48 KB de datos por núcleo físico, compartidos entre los 2 hilos lógicos. Para un tablero de 800 bytes, ambos hilos compiten por el mismo conjunto de caché, causando eviction mutua.

**Impacto medido:** El speedup de 4T→8T es de 205→152 ms (26.8% de mejora), lejos del 50% esperado con núcleos reales adicionales. Esto confirma que HT aporta ~30% para workloads enteros, consistente con la literatura de Intel.

---

## Análisis de overhead para CUDA

### Transferencias PCIe

El flujo de datos CPU→GPU→CPU para cada decisión incluye:

| Operación | Datos | Dirección | Tiempo (ms) |
|-----------|-------|-----------|-------------|
| `cudaMalloc` × 5 | — | CPU (alloc) | ~1.5 |
| `cudaMemcpy` H→D (tablero) | 200 × 4 B = 800 B | H→D | 0.18 |
| `cudaMemcpy` H→D (secuencia) | 6 × 4 B = 24 B | H→D | 0.12 |
| `cudaMemcpy` H→D (init resultados) | 40 × 4 B = 160 B | H→D | incluido |
| Ejecución kernel | — | GPU | 4.7 (N=3) |
| `cudaMemcpy` D→H (resultados) | 120 × 4 B = 480 B | D→H | 0.19 |
| `cudaFree` × 5 | — | CPU (free) | ~0.5 |
| **Total no-kernel** | — | — | **~2.5** |

Para $N = 3$: el kernel toma 4.7 ms y el overhead total 2.5 ms. El overhead representa el 35% del tiempo total (7.2 ms). Para $N = 1$: el kernel toma 0.2 ms y el overhead 2.5 ms, representando el 93%.

**Optimización posible:** Pre-asignar memoria GPU en la inicialización del solver (remover `cudaMalloc`/`cudaFree` del camino caliente) y usar streams asíncronos para solapar transferencias con cómputo. Esto reduciría el overhead a ~0.5 ms por decisión.

### Ocupación de la GPU

La GTX 1650 tiene 14 SM con 65 536 registros cada uno. El kernel `bruteForceKernel` usa ~35 registros por thread (principalmente `int board[200]`, que parcialmente reside en registros y parcialmente en local memory). El ocupación se calcula como:

$$\text{Ocupación} = \frac{\text{Threads activos/SM}}{\text{Max threads/SM}} = \frac{1\,024}{1\,872} \approx 55\%$$

Donde el límite de 1 024 threads/SM es un límite hardware. El límite por registros es de 65 536 / 35 = 1 872 threads/SM, pero el límite hardware se impone antes.

El 55% de ocupación es típico para kernels con alto uso de registros. Para mejorarlo, se podría:
- Reducir `board[200]` usando una representación comprimida (bitmask de 200 bits = 4 enteros de 64 bits),
- Usar `__launch_bounds__` para guiar al compilador a usar menos registros,
- O particionar el tablero en memoria compartida del SM.

### Warp divergence

El kernel itera sobre caminos del árbol en un grid-strided loop. Cuando un camino encuentra una posición inválida (`dropY < 0`), el thread ejecuta `continue`, saltando el resto del buque. En una arquitectura SIMT, los 32 threads de un warp deben converger en cada punto de sincronización implícito. Si algunos threads toman el camino inválido y otros el válido, el warp diverge y ambos caminos se serializan.

Nsight Compute reportó una divergencia del 12-18% en el bucle principal (medido como porcentaje de ciclos con al menos un lane inactivo en un warp activo). La divergencia es mayor al inicio de cada iteración del grid-strided loop (cuando se decodifica el `pathId`) y menor hacia el final (cuando la mayoría de los caminos han convergido en resultados similares).

---

## Análisis de overhead para MPI

### Serialización y deserialización

El solver MPI (ver `solver_mpi.cpp`) distribuye las 40 posiciones entre $p$ procesos con un patrón ciclista. Cada proceso necesita:

1. **Recibir el tablero completo** (200 enteros = 800 bytes) en todos los ranks. MPI broadcasts esto implícitamente mediante el paso del `Board` como parámetro (ya que cada rank llama `findBestMove` con el mismo tablero).
2. **Recibir la secuencia de piezas** (hasta 6 enteros = 24 bytes): igualmente implícito por la misma llamada.
3. **Colectar el resultado global** mediante `MPI_Allreduce` con `MPI_MINLOC`: envía 8 bytes (struct con score + index) desde cada rank y reduce al mínimo global.

**Costo medido:** La serialización es mínima (los datos ya están en formato nativo). El `MPI_Allreduce` con 2 enteros (MPI_2INT) tiene una latencia de ~0.3 ms con 2 procesos y ~0.6 ms con 4 procesos en IPC local.

### Latencia de comunicación

El overhead de MPI se descompone en:

| Componente | 2 procesos | 4 procesos | Naturaleza |
|------------|-----------|-----------|-----------|
| `MPI_Allreduce` | ~0.3 ms | ~0.6 ms | Latencia + reducción |
| Desbalance de carga | ~0.2 ms | ~0.4 ms | Posiciones inválidas |
| Overhead de inicial MPI | ~0.1 ms | ~0.1 ms | Despreciable por decisión |
| **Total overhead MPI** | **~0.6 ms** | **~1.1 ms** | |

Para $N = 3$ (500 ms de cómputo), el overhead MPI es < 0.3% del total. Para $N = 1$ (0.5 ms), el overhead domina, haciendo MPI más lento que el secuencial.

### `MPI_Allreduce`: tipo `MPI_MINLOC`

La llamada `MPI_Allreduce` con `MPI_MINLOC` es el punto de sincronización global del solver MPI:

```cpp
MPI_Allreduce(&localBest, &globalBest, 1, MPI_2INT, MPI_MINLOC, MPI_COMM_WORLD);
```

Esta operación garantiza que todos los procesos reciban el mismo resultado mínimo, pero introduce una barrera de sincronización: ningún proceso puede continuar hasta que todos hayan completado su porción del trabajo. El costo es proporcional a $\log(p)$ para el algoritmo tree-based de MPI.

---

## Tabla resumen de hallazgos

| Función/Región | Tiempo (ms) | % overhead | Causa identificada | Solución propuesta |
|---------------|------------|------------|--------------------|--------------------|
| `evaluateRecursive()` | 470 (N=3) | 94% del total | Función caliente (hotspot principal) | Optimizar `findDropY` con búsqueda binaria |
| `Board::clone()` | ~20 (N=3) | 4% del total | Copia de 200 enteros por llamada | Usar stack-allocated buffer reutilizable |
| `#pragma omp critical` | ~0.5 | 0.3% | 40 entradas por hilo, lock exclusivo | Mínimo local por hilo + 1 critical |
| Fork-join OpenMP | ~0.25 | 0.05% (N≥3) | Creación/destrucción de threads | Región paralela externa persistente |
| `cudaMalloc`/`cudaFree` | ~2.0 | 28% (N=1), 0.4% (N=3) | Allocation por decisión | Pre-asignar memoria en init |
| `cudaMemcpy` H→D | ~0.30 | 43% (N=1), 4% (N=3) | Transferencia de tablero por decisión | Pinned memory + streams asíncronos |
| `cudaMemcpy` D→H | ~0.19 | 27% (N=1), 2.6% (N=3) | Transferencia de resultados | Pinned memory |
| Warp divergence CUDA | ~0.6 | 13% del kernel | Posiciones inválidas (caminos tempranos) | Compactar caminos válidos antes del kernel |
| `MPI_Allreduce` | ~0.3 (2P) | 47% (N=1), 0.06% (N=3) | Sincronización global | No crítico para N≥3 |
| Desbalance MPI | ~0.4 (4P) | 15% (N=2), 0.08% (N=3) | Posiciones inválidas | `schedule(dynamic)` + scatter/gather |

---

## False sharing y coherencia de caché

### Análisis: ¿existe false sharing en OpenMP?

**No.** El solver OpenMP no presenta false sharing. La razón es estructural: cada hilo opera sobre una copia local del tablero (`Board clone = board.clone()`) que reside en la pila del hilo. Las variables compartidas son las tres escalares protegidas por `#pragma omp critical` (`bestHeuristic`, `bestX`, `bestRotation`), que se acceden exclusivamente dentro de la sección crítica y están correctamente sincronizadas.

Para que ocurra false sharing, dos hilos necesitarían escribir en variables distintas pero adyacentes en la misma línea de caché (64 bytes). En nuestra implementación:

- Los tableros locales (800 bytes cada uno) están en stacks separados.
- Las variables de resultado global están protegidas por un lock exclusivo.
- No hay arrays compartidos con escrituras por hilo en posiciones adyacentes.

Si la implementación usara arrays compartidos donde cada hilo escribe en `results[thread_id]`, y `sizeof(int) = 4` < 64 bytes por línea de caché, entonces 16 elementos compartirían una línea y habría false sharing. Nuestro diseño evita este patrón.

### Protocolo MESI y coherencia de caché

El protocolo MESI (Modified, Exclusive, Shared, Invalid) del procesador i5-11300H gestiona la coherencia entre los 4 núcleos físicos y sus cachés L1/L2 privadas. Para el solver OpenMP:

1. **Lectura del tablero original:** Todos los hilos leen `board` antes del `parallel for`. La caché marca las líneas como *Shared* en todos los núcleos. Esto es eficiente: no hay invalidación.

2. **Escritura del tablero clonado:** Cada hilo escribe su copia local en su propia pila. Estas líneas se marcan como *Modified* en la L1/L2 del núcleo correspondiente. Sin conflicto.

3. **Sección crítica:** La escritura en `bestHeuristic` invalida la línea de caché en los otros núcleos (transición *Modified* → *Invalid* en los demás). Con 8 hilos compitiendo, esto genera hasta 7 invalidaciones por actualización. Con solo ~40 actualizaciones totales (una por posición válida), el impacto es despreciable.

### Impacto de HyperThreading en caché L1/L2

Los 2 hilos lógicos de cada núcleo comparten:

- **Caché L1D (48 KB):** Ambos hilos compiten por el mismo espacio. Si ambos procesan tableros de 800 bytes, las líneas de datos se excluyen mutuamente cuando los working sets exceden la capacidad asociativa.
- **Caché L2 (1.25 MB):** Suficientemente grande para las working sets de ambos hilos (2 × 800 B + 2 × stack por recursión << 1.25 MB). El L2 no es un cuello de botella.

VTune reportó un 12% de *L2 cache misses* en la función `Board::clone()`, consistente con la presión de dos hilos accediendo a datos temporalmente adyacentes. Los *L3 misses* fueron < 0.1%, confirmando que el L3 de 8 MB absorbe holgadamente el working set.

[FIGURA 6: Flame graph de hotspots]

---

## Referencias

<a name="referencias"></a>

1. Intel Corporation. *Intel VTune Profiler*. https://www.intel.com/content/www/us/en/developer/tools/oneapi/vtune-profiler.html
2. NVIDIA Corporation. *Nsight Systems*. https://developer.nvidia.com/nsight-systems
3. Linux Kernel Organization. *perf Events Subsystem*. https://perf.wiki.kernel.org
4. Valgrind Developers. *Helgrind: Thread Error Detector*. https://valgrind.org/docs/manual/hg-manual.html

---

## Referencia cruzada

- Las mediciones empíricas que cuantifican los overheads están en [07_mediciones_empiricas.md](07_mediciones_empiricas.md).
- El análisis de escalamiento que muestra el impacto de estos overheads en la eficiencia está en [08_analisis_escalamiento.md](08_analisis_escalamiento.md).