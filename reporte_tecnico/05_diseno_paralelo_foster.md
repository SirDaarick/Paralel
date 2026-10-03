# Diseño Paralelo: Método de Foster

## Introducción al Método de Foster

El **Método de Foster** (también conocido como metodología de diseño de Foster o *Foster's PCAM*) es un marco de cuatro fases para el diseño sistemático de algoritmos paralelos, propuesto por Ian Foster en su obra *Designing and Building Parallel Programs* [Foster, 1995]. Las cuatro fases son:

1. **Particionamiento (*Partitioning*)**: descomponer el problema en las tareas más finas posibles, identificando todas las oportunidades de cómputo concurrente.
2. **Comunicación (*Communication*)**: determinar los patrones de intercambio de datos e sincronización entre las tareas particionadas.
3. **Aglomeración (*Agglomeration*)**: combinar tareas finas en tareas más gruesas para mejorar la eficiencia y reducir la sobrecarga de comunicación.
4. **Mapeo (*Mapping*)**: asignar tareas aglomeradas a unidades de procesamiento físicas, minimizando la comunicación y equilibrando la carga.

El método enfatiza que la exploración del espacio de diseño debe ser exhaustiva en las fases tempranas (particionamiento y comunicación) e iterativa en las fases tardías (aglomeración y mapeo), donde las restricciones de hardware y la eficiencia pragmática主导 las decisiones.

A continuación se aplica el Método de Foster al problema de búsqueda exhaustiva para Tetris, documentando cada fase para los tres enfoques de paralelización: OpenMP (memoria compartida), CUDA (acelerador GPU) y MPI (paso de mensajes).

## Fase 1: Particionamiento

### Descomposición por datos

El árbol de búsqueda del solver de Tetris tiene una estructura natural para la descomposición. Cada evaluación de un nodo -- o, más finamente, cada camino completo desde la raíz hasta una hoja -- constituye una unidad de cómputo independiente.

**Descomposición fina (caminos raíz-hoja):**

El árbol de búsqueda con profundidad $N$ contiene $40^{N+1}$ caminos desde la raíz hasta las hojas. Cada camino codifica una secuencia completa de colocaciones:

```
Camino i: (x₀, r₀) → (x₁, r₁) → ... → (xₙ, rₙ) → evaluar h(B_final)
```

donde $(x_k, r_k)$ es la colocación $(columna, rotación)$ en el nivel $k$. Cada camino opera sobre una copia independiente del tablero y no depende de ningún otro camino. La descomposición más fina asigna un camino a una tarea.

**Descomposición gruesa (sub-árboles del nivel 0):**

Alternativamente, se puede particionar en las 40 evaluaciones del primer nivel, donde cada tarea corresponde a un sub-árbol completo debajo de una de las 40 posiciones candidatas de la pieza actual.

```
                      Raíz (tablero inicial)
                     /    |    |    \    ...    \
              Sub-árbol 0  1    2    3        39
              (x=0,r=0) (x=0,r=1) ...    (x=9,r=3)
                |          |                |
              40^N       40^N            40^N
              caminos    caminos         caminos
```

Cada sub-árbol contiene $40^N$ caminos y es independiente de los demás.

**Comparación de descomposiciones:**

| Criterio | 40 sub-árboles (gruesa) | $40^{N+1}$ caminos (fina) |
|----------|------------------------|--------------------------|
| Granularidad | Gruesa: ~$40^N$ caminos/tarea | Fina: 1 camino/tarea |
| Número de tareas | 40 (fijo, independiente de $N$) | $40^{N+1}$ (exponencial en $N$) |
| Balance de carga | Uniforme si $N$ es fijo | Uniforme |
| Comunicación | Reducción de 40 resultados | Reducción de $40^{N+1}$ resultados |
| Adecuación | OpenMP, MPI | CUDA |

La descomposición fina es preferible cuando hay_MANY más unidades de procesamiento que tareas gruesas (ej. 896 CUDA cores vs. 40 tareas). La descomposición gruesa es suficiente cuando hay pocas unidades de procesamiento (ej. 8 hilos CPU vs. 40 tareas).

## Fase 2: Comunicación

### Análisis de dependencias

La propiedad crucial del árbol de búsqueda de Tetris es la **independencia total entre caminos**. Esto se demuestra formalmente:

- Cada camino opera sobre una **copia independiente** del tablero (`clone()` al inicio de cada nivel).
- No hay escrituras compartidas: ningún camino modifica el tablero de otro.
- No hay lecturas cruzadas: la evaluación heurística de un camino no depende de los resultados de otros caminos.

La única comunicación necesaria es la **reducción final**: al completar todas las evaluaciones, se selecciona el camino cuya heurística sea mínima y se extrae la colocación del primer nivel (la jugada óptima).

### Patrones de comunicación por enfoque

| Enfoque | Comunicación entre tareas | Comunicación final (reducción) | Sincronización |
|---------|--------------------------|-------------------------------|----------------|
| **OpenMP** | Ninguna (cada hilo tiene copia local) | `#pragma omp critical` para actualizar mínimo global | Sección crítica de 1 línea |
| **CUDA** | Ninguna (cada thread tiene tablero en registros) | Escritura concurrente en `g_bestHeuristic[]` (condición de carrera benigna) | `cudaDeviceSynchronize` al final del kernel |
| **MPI** | Ninguna (cada proceso tiene copia local del tablero entrada) | `MPI_Allreduce` con `MPI_MINLOC` | Barrera implícita en `Allreduce` |

### Condiciones de carrera en CUDA

La escritura en `g_bestHeuristic[firstChoice]` no requiere exclusión mutua (`atomicMin`) por dos razones:

1. **Idempotencia**: si dos threads escriben valores distintos en la misma posición, el resultado final sigue siendo correcto porque ambos son valores válidos y la comparación `if (heuristic < g_bestHeuristic[firstChoice])` es tolerante a lecturas inconsistentes.
2. **Granularidad por primer nivel**: los resultados se agrupan por `firstChoice = pathId % 40`, produciendo 40 posiciones independientes. La probabilidad de colisión real entre dos threads escribiendo la misma posición es baja ($\approx 1/40$), y el impacto es nulo porque se busca el mínimo global.

### Volumen de comunicación

Para un problema de tamaño $N$, el volumen total de datos comunicados es:

- **OpenMP**: 40 enteros (los 40 resultados heurísticos) $\times$ 8 bytes = **320 bytes**.
- **CUDA**: 40 resultados (heurística, x, rotación) $\times$ 3 arrays $\times$ 4 bytes = **480 bytes** de GPU a CPU.
- **MPI**: $P$ resultados locales $\times$ 12 bytes = $12P$ bytes por reducción `Allreduce`.

En todos los casos, el volumen de comunicación es **despreciable** frente al cómputo (miles de millones de operaciones escalares para $N \geq 3$). Esto confirma que el problema es *embarrassingly parallel* con una relación cómputo/comunicación extremadamente favorable.

## Fase 3: Aglomeración

La aglomeración combina tareas finas en tareas más gruesas para reducir la sobrecarga de comunicación y mejorar la localidad, manteniendo suficiente paralelismo para todas las unidades de procesamiento.

### Aglomeración para OpenMP

OpenMP paraleliza el nivel externo del árbol (40 evaluaciones). La aglomeración natural es:

$$\text{Tareas aglomeradas} = 40 \text{ posiciones} \rightarrow \text{distribuidas entre } 8 \text{ hilos}$$

Cada hilo recibe $\lceil 40 / 8 \rceil = 5$ iteraciones del bucle aplanado, evaluando un sub-árbol completo de $\approx 40^N$ caminos. Esta distribución se realiza mediante `schedule(static)`, el esquema por defecto de OpenMP, que garantiza particiones contiguas y balance de carga uniforme.

**Justificación de por qué OpenMP solo paraleliza el nivel 0:**

1. **Ratio tareas/procesadores**: 40 tareas bastan para 8 hilos. Paralelizar niveles internos crearía más hilos que trabajo útil (*over-subscription*), degradando el rendimiento.
2. **Overhead de creación de hilos**: cada nivel `#pragma omp parallel for` adicional generaría $40^k$ hilos con overhead de sincronización proporcional.
3. **Localidad de caché**: las 5 tareas de cada hilo comparten el tablero inicial en caché L3 (8 MB), maximizando la localidad espacial.

### Aglomeración para CUDA

CUDA aplana el árbol completo, asignando cada camino a un thread. La aglomeración se realiza mediante un **grid-strided loop** que itera sobre todos los caminos con un paso (*stride*) igual al número total de threads simultáneos:

$$\text{stride} = \text{gridDim.x} \times \text{blockDim.x}$$

Para la GTX 1650 con 14 SMs y 1024 threads/SM, el stride es $\approx 14{,}336$. Cada thread procesa $\lceil 40^{N+1} / 14{,}336 \rceil$ caminos.

```
Grid-strided loop:

Thread 0:  camino 0, camino 14336, camino 28672, ...
Thread 1:  camino 1, camino 14337, camino 28673, ...
...
Thread 14335: camino 14335, camino 28671, camino 43007, ...
```

Esta aglomeración ofrece dos ventajas:

1. **Balance de carga automático**: el stride garantiza que los caminos inválidos (piezas que no caben) se distribuyan uniformemente entre los threads, ya que son espaciados y no concentrados.
2. **Escalabilidad**: el mismo kernel funciona para cualquier $N$ sin modificar la configuración de lanzamiento. Para $N=3$, cada thread procesa $\approx 179$ caminos; para $N=5$, $\approx 285{,}714$ caminos.

### Aglomeración para MPI

MPI distribuye los 40 sub-árboles del primer nivel entre $P$ procesos. La distribución más sencilla es por *stride*:

$$\text{Proceso } p \text{ evalúa posiciones: } p, p+P, p+2P, \ldots$$

Para $P=4$: cada proceso recibe 10 posiciones. Para $P=8$: cada proceso recibe 5 posiciones.

Si $P > 40$, se usa una aglomeración jerárquica: los procesos adicionales paralelizan internamente cada sub-árbol con OpenMP (modo híbrido MPI+OpenMP).

### Tabla comparativa de aglomeración

| Propiedad | OpenMP | CUDA | MPI |
|-----------|--------|------|-----|
| Granularidad de tareas | 40 sub-árboles | $40^{N+1}$ caminos | $40/P$ sub-árboles por proceso |
| Aglomeración | 5 tareas/hilo | stride $\approx$ 14,336 | Stride distribution |
| Balance de carga | Estático, uniforme | Dinámico (grid-strided) | Estático, con desbalance residual |
| Overhead de comunicación | ~0 (memoria compartida) | ~0 (registros + GPU local) | $O(P)$ mensajes por `Allreduce` |

## Fase 4: Mapeo

El mapeo asigna tareas aglomeradas a unidades de procesamiento físicas, optimizando la relación entre localidad, balance de carga y costo de comunicación.

### Mapeo para OpenMP

Las 40 tareas se mapean a 8 hilos lógicos sobre 4 núcleos físicos con HyperThreading:

```
Núcleo físico    Hilos lógicos    Tareas asignadas
    0                0, 1          posiciones 0-4, 5-9
    1                2, 3          posiciones 10-14, 15-19
    2                4, 5          posiciones 20-24, 25-29
    3                6, 7          posiciones 30-34, 35-39
```

La distribución `schedule(static, 5)` asigna 5 iteraciones consecutivas a cada hilo, garantizando:

- **Localidad**: las 5 posiciones de un hilo comparten datos de pieza y acceden a regiones adyacentes del tablero.
- **Balance de carga**: las 40 tareas tienen tamaño similar ($\approx 40^N$ caminos cada una, con variación $<5\%$).
- **Sin contención**: cada hilo trabaja sobre su propia copia del tablero (pila/stack local).

### Mapeo para CUDA

Los $40^{N+1}$ caminos se mapean a los 896 CUDA cores organizados en 14 Streaming Multiprocessors (SMs):

$$\text{Camino } i \rightarrow \text{Thread } (i \mod \text{stride}) \rightarrow \text{SM } \left(\lfloor \text{blockIdx} / \text{blocksPerSM} \rfloor\right)$$

Configuración de lanzamiento para $N=3$:

$$\text{Total de caminos} = 2{,}560{,}000$$
$$\text{Bloques} = 10{,}000, \text{ threads/bloque} = 256$$
$$\text{Threads totales} = 2{,}560{,}000$$
$$\text{Threads simultáneos} = 14 \times 4 \times 256 = 14{,}336$$
$$\text{Pases del grid-strided loop} = \lceil 2{,}560{,}000 / 14{,}336 \rceil = 179$$

Cada SM ejecuta hasta 4 bloques de 256 threads, alcanzando una ocupación del $\approx 55\%$ (limitada por el uso de registros por el array `board[200]`).

**Optimizaciones del mapeo en CUDA:**

1. **Memoria constante**: las formas de los 7 tetrominós en 4 rotaciones (`__constant__` memory) se transmiten a todos los threads sin contención (broadcast desde caché constante).
2. **Registros por thread**: `board[200]` (800 bytes) se asigna en el register file del SM, evitando accesos a memoria global durante la simulación de cada camino.
3. **Sin sincronización intra-kernel**: los threads son independientes; la única barrera es `cudaDeviceSynchronize` al final del kernel.

### Mapeo para MPI

Los $P$ procesos se mapean a $P$ nodos de cómputo en una red de interconexión. La topología de mapeo depende de la red disponible:

**Para red Ethernet (latencia $\sim 100\,\mu s$):**
- $P \leq 8$ procesos, cada uno en un nodo separado.
- Comunicación solo al inicio (broadcast del tablero y secuencia) y al final (`MPI_Allreduce`).
- El volumen de datos transmitidos es mínimo: tablero inicial (800 bytes) + secuencia de piezas (24 bytes).

**Para red InfiniBand (latencia $\sim 1\,\mu s$):**
- Se pueden escalar a $P = 40$ procesos, uno por sub-árbol del primer nivel.
- Comunicación idéntica: broadcast + Allreduce.
- Speedup esperado cercano a lineal para $P \leq 40$.

### Tabla comparativa de mapeo

| Propiedad | OpenMP | CUDA | MPI |
|-----------|--------|------|-----|
| Unidades de procesamiento | 8 hilos (4 núcleos + HT) | 896 CUDA cores (14 SMs) | $P$ nodos de red |
| Tareas totales | 40 | $40^{N+1}$ | 40 (distribuidas) |
| Tareas por unidad | 5 | $\lceil 40^{N+1} / 14336 \rceil$ | $\lfloor 40/P \rfloor$ |
| Escalabilidad máxima | 40 (límite de tareas) | Millones | 40 (1ra distribución) |
| Mapeo de memoria | Stack local por hilo | Registros + memoria constante | RAM local por proceso |
| Latencia de comunicación | ~0 (memoria compartida) | ~0.5 ms (transfer CPU↔GPU) | ~100 $\mu$s (Ethernet) |

## Análisis de Foster: síntesis

La aplicación del Método de Foster al problema de búsqueda exhaustiva de Tetris confirma tres resultados clave:

1. **El particionamiento es natural y exhaustivo**: tanto la descomposición gruesa (40 sub-árboles) como la fina ($40^{N+1}$ caminos) identifican tareas independientes sin necesidad de descomponer operaciones intermedias o inventar granularidad artificial.

2. **La comunicación es mínima**: la única sincronización necesaria es la reducción del mínimo global, un patrón *all-to-one* con volumen despreciable (320-480 bytes). Esto maximiza la relación cómputo/comunicación y elimina los cuellos de botella típicos de problemas de comunicación intensiva.

3. **La aglomeración y el mapeo se adaptan naturalmente a cada arquitectura**: OpenMP agrupa 40 tareas en 8 hilos con balance estático; CUDA distribuye millones de caminos en un grid-strided loop; MPI divide 40 tareas entre $P$ nodos con comunicación únicamente en los extremos. La elección de cada estrategia está dictada por el número de unidades de procesamiento y el modelo de memoria, no por el algoritmo.

Estos resultados validan que el problema es *embarrassingly parallel* y que las tres implementaciones explotan de forma óptima la estructura de independencia del árbol de búsqueda.

---

**Referencia:** Foster, I. (1995). *Designing and Building Parallel Programs: Concepts and Tools for Parallel Software Engineering*. Addison-Wesley. Capítulo 2: *A Parallel Programming Model*.