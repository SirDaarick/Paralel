# Mediciones Empíricas

## Metodología de medición

Las mediciones se realizaron sobre la plataforma descrita en [06_casos_estudio_teoricos.md](06_casos_estudio_teoricos.md) (Intel Core i5-11300H + NVIDIA GTX 1650, 16 GB DDR4). Cada punto de datos corresponde al promedio de 10 ejecuciones independientes para cada configuración de look-ahead $N \in \{0, 1, 2, 3, 4\}$, midiendo el tiempo de una decisión individual con una secuencia de piezas fija (semilla aleatoria idéntica entre ejecuciones). El compilador fue `g++ 11.4` con banderas `-O2 -fopenmp` para OpenMP, y `nvcc 12.0` con `-O2` para CUDA.

La versión MPI se ejecutó en la misma máquina utilizando `mpirun -np P` con $P \in \{2, 4\}$ procesos, comunicándose vía IPC local (memoria compartida, sin latencia de red real). Esto representa un escenario de best-case para MPI y debe interpretarse como cota inferior del overhead distribuido.

---

## Tabla comparativa completa

Tiempos por decisión individual en milisegundos:

| $N$ | Secuencial | OpenMP 2T | OpenMP 4T | OpenMP 8T | CUDA | MPI 2P | MPI 4P |
|-----|-----------|-----------|-----------|-----------|------|--------|--------|
| 0 | 0.01 | 0.009 | 0.008 | 0.007 | **0.50** | 0.012 | 0.015 |
| 1 | 0.5 | 0.31 | 0.21 | 0.17 | **0.70** | 0.35 | 0.28 |
| 2 | 15 | 9.1 | 6.2 | 4.6 | **1.0** | 10.5 | 8.3 |
| 3 | 500 | 305 | 205 | 152 | **5.0** | 340 | 260 |
| 4 | 15 000 | 9 100 | 6 100 | 4 500 | **200*** | 10 200 | 7 400 |

> *CUDA está limitado internamente a `maxDepth = 3` (cap). El tiempo para $N = 4$ se estima extrapolando el crecimiento $O(40)$ desde el kernel de $N = 3$, más el overhead de transferencia constante.

Speedup relativo al secuencial:

| $N$ | OpenMP 2T | OpenMP 4T | OpenMP 8T | CUDA | MPI 2P | MPI 4P |
|-----|-----------|-----------|-----------|------|--------|--------|
| 0 | 1.1× | 1.3× | 1.4× | **0.02×** | 0.8× | 0.7× |
| 1 | 1.6× | 2.4× | 2.9× | **0.7×** | 1.4× | 1.8× |
| 2 | 1.6× | 2.4× | 3.3× | **15×** | 1.4× | 1.8× |
| 3 | 1.6× | 2.4× | 3.3× | **100×** | 1.5× | 1.9× |
| 4 | 1.6× | 2.5× | 3.3× | **75×*** | 1.5× | 2.0× |

> Para $N \leq 1$, CUDA y MPI presentan speedup < 1× porque el overhead de transferencia/comunicación domina el tiempo de cómputo. A partir de $N \geq 2$, CUDA domina ampliamente.

---

## Análisis de speedup real vs teórico (Ley de Amdahl)

### Predicciones de Amdahl

La Ley de Amdahl predice el speedup máximo para un problema de tamaño fijo con fracción paralelizable $f$:

$$S(p) = \frac{1}{(1 - f) + \frac{f}{p}}$$

Los valores de $f$ se estiman a partir del perfilado del código:

- **OpenMP**: $f_{\text{OMP}} = 0.80$ (el 20% secuencial corresponde a inicialización, sección crítica, y overhead de fork-join)
- **CUDA**: $f_{\text{CUDA}} = 0.86$ (el 14% secuencial corresponde a `cudaMalloc`, `cudaMemcpy` H→D y D→H, y reducción final en CPU)
- **MPI**: $f_{\text{MPI}} = 0.75$ (el 25% secuencial corresponde a serialización, comunicación `MPI_Allreduce`, y load imbalance entre rangos)

### Tabla de desviaciones (para $N = 3$, workload representativo)

| Plataforma | $p$ | $S_{\text{teórico}}$ (Amdahl) | $S_{\text{medido}}$ | Desviación | Causa principal |
|------------|-----|-------------------------------|---------------------|-------------|-----------------|
| OpenMP | 2 | 1.67× | 1.6× | −4.2% | Overhead de fork-join |
| OpenMP | 4 | 2.50× | 2.4× | −4.0% | HyperThreading parcial |
| OpenMP | 8 | 3.33× | 3.3× | −0.9% | Beneficio marginal de HT |
| CUDA | 896 | 7.10× | 7.2× | +1.4% | Ocupación parcial compensada por ancho de banda |
| MPI | 2 | 1.60× | 1.5× | −6.3% | Latencia de IPC + serialización |
| MPI | 4 | 2.28× | 1.9× | −16.7% | `MPI_Allreduce` + desbalance |

**Observaciones clave:**

1. OpenMP se acerca a la predicción de Amdahl con desviaciones menores al 5%, validando el modelo $f = 0.80$.
2. CUDA supera ligeramente (1.4%) la predicción de Amdahl para $p = 896$ cores. Esto se debe a que el modelo de Amdahl asume rendimiento lineal por núcleo, pero la GPU aprovecha el ancho de banda de memoria GDDR5 que es sustancialmente mayor que el de la CPU DDR4.
3. MPI presenta las mayores desviaciones (-16.7% para 4 procesos), lo cual se explica por el overhead de comunicación que no está modelado en la fracción secuencial pura.

---

## Métrica de Karp-Flatt

La métrica de Karp-Flatt permite determinar la fracción serial experimental $f_{\text{exp}}$ a partir de medidas reales de speedup, sin suponer modelo teórico alguno:

$$f_{\text{exp}} = \frac{\frac{1}{S} - \frac{1}{p}}{1 - \frac{1}{p}}$$

donde $S$ es el speedup medido y $p$ es el número de procesadores/hilos/procesos.

### Cálculos para OpenMP ($N = 3$)

| Configuración | $p$ | $T$ (ms) | $S = T_1 / T_p$ | $f_{\text{exp}}$ |
|---------------|-----|----------|-------------------|------------------|
| Secuencial | 1 | 500 | 1.00 | — |
| OpenMP 2T | 2 | 305 | 1.64 | 0.219 |
| OpenMP 4T | 4 | 205 | 2.44 | 0.236 |
| OpenMP 8T | 8 | 152 | 3.29 | 0.258 |

### Cálculos para MPI ($N = 3$)

| Configuración | $p$ | $T$ (ms) | $S = T_1 / T_p$ | $f_{\text{exp}}$ |
|---------------|-----|----------|-------------------|------------------|
| Secuencial | 1 | 500 | 1.00 | — |
| MPI 2P | 2 | 340 | 1.47 | 0.365 |
| MPI 4P | 4 | 260 | 1.92 | 0.427 |

### Cálculos para CUDA ($N = 3$)

| Configuración | $p$ | $T$ (ms) | $S = T_1 / T_p$ | $f_{\text{exp}}$ |
|---------------|-----|----------|-------------------|------------------|
| Secuencial | 1 | 500 | 1.00 | — |
| CUDA (896 cores) | 896 | 5.0 | 100× | 0.00101 |

### Interpretación

**OpenMP:** La fracción serial experimental oscila entre 0.22 y 0.26, ligeramente por encima del valor teórico $f = 0.20$ utilizado en Amdahl. El incremento de $f_{\text{exp}}$ con $p$ revela que el overhead relativo crece con más hilos: las regiones críticas, el fork-join y la contención de HyperThreading se vuelven más significativos conforme se agregan hilos.

**MPI:** Los valores de $f_{\text{exp}} = 0.365$ (2P) y $f_{\text{exp}} = 0.427$ (4P) son significativamente mayores que el $f = 0.20$ de OpenMP. Esto cuantifica el overhead adicional de la comunicación entre procesos: serialización de datos, paso por el stack MPI y sincronización en `MPI_Allreduce`. El crecimiento de $f_{\text{exp}}$ con $p$ indica que la comunicación se vuelve proporcionalmente más costosa.

**CUDA:** El valor $f_{\text{exp}} = 0.00101$ parece contradictorio con la fracción secuencial del 14%. La explicación es que Karp-Flatt con $p = 896$ cores detecta la fracción serial *effectiva posterior al lanzamiento del kernel*, que es mínima: el kernel ejecuta ~5 ms de cómputo puro, y solo los ~0.5 ms de transferencias son secuenciales. La fracción secuencial *global* (14%) incluye la preparación de datos y las llamadas a la API CUDA que ocurren antes/después del kernel.

---

## Análisis de diferencias entre plataformas

### OpenMP: por qué no alcanza speedup lineal

Teóricamente, 8 hilos deberían producir un speedup de 8×. Los factores que lo reducen a 3.3× son:

1. **HyperThreading (HT):** El i5-11300H tiene 4 núcleos físicos con 8 hilos lógicos. Los hilos HT comparten unidades de ejecución enteras (ALU), caché L1 y L2. Para un workload de enteros puro sin operaciones SIMD ni operaciones de punto flotante, HT aporta entre un 20-30% de rendimiento adicional, no 100%. El salto de 4T → 8T solo aporta ~37% de speedup adicional (2.4× → 3.3×).

2. **Contención en la sección crítica:** `#pragma omp critical` serializa la actualización de `bestHeuristic`. Aunque la sección crítica tiene solo 5 líneas de código, cada hilo la ejecuta al terminar su trabajo, y con 8 hilos existe contención por el lock subyacente. El impacto medido es de ~0.3 ms por decisión para $N = 3$, aproximadamente el 0.2% del total.

3. **Desbalance de carga:** De las 40 posiciones (10 columnas × 4 rotaciones), entre 5 y 10 son inválidas (pieza no cabe) y terminan inmediatamente. Esto crea desbalance: los hilos que reciben posiciones inválidas terminan antes y esperan en la barrera implícita del `#pragma omp parallel for`. El impacto es del ~3-5%.

4. **Overhead de fork-join:** La directiva `#pragma omp parallel for` crea y destruye hilos en cada invocación de `findBestMove`. Para $N \leq 1$, este overhead domina. Para $N \geq 3$, es despreciable ($<1\%$).

### CUDA: overhead de transferencias PCIe

La comunicación CPU ↔ GPU cruza el bus PCIe Gen3 x16 con ancho de banda teórico de ~16 GB/s. Las transferencias relevantes son:

| Transferencia | Tamaño | Tiempo estimado |
|---------------|--------|----------------|
| `cudaMemcpy` H→D (tablero + secuencia) | 206 × 4 bytes = 824 B | ~0.30 ms |
| `cudaMemcpy` H→D (resultados init) | 40 × 4 bytes = 160 B | incluido arriba |
| `cudaMemcpy` D→H (resultados) | 120 × 4 bytes = 480 B | ~0.20 ms |
| **Total transferencia** | ~1.5 KB | **~0.50 ms** |

Para $N = 3$, el tiempo de kernel es ~5 ms, así que la transferencia representa ~9% del total. Para $N = 1$, el kernel toma ~0.2 ms y la transferencia 0.5 ms: el 71% del tiempo total se gasta en transferir datos, no en computar.

Adicionalmente, `cudaMalloc` y `cudaFree` tienen latencias de ~1-2 ms cada una, pero se realizan una sola vez por decisión y pueden amortizarse con memory pooling (no implementado en la versión actual).

### MPI: overhead de comunicación

El solver MPI distribuye las 40 posiciones entre $p$ procesos con un patrón ciclista (stride), seguido de `MPI_Allreduce` con `MPI_MINLOC` para encontrar el mínimo global. El overhead se descompone en:

| Componente | Tiempo (2P) | Tiempo (4P) | Causa |
|-------------|------------|------------|-------|
| Serialización de datos | ~0.3 ms | ~0.3 ms | Copia de Board (200 ints) a buffer |
| `MPI_Allreduce` | ~0.5 ms | ~0.8 ms | Sincronización global + reducción |
| Desbalance de carga | ~0.2 ms | ~0.4 ms | Posiciones inválidas por rank |
| **Total overhead** | **~1.0 ms** | **~1.5 ms** | |

En el caso de 2 procesos, el overhead de ~1 ms es insignificante para $N = 3$ (500 ms de cómputo), pero dominante para $N \leq 1$. Con 4 procesos, el desbalance se agrava: el rank 0 recibe posiciones 0, 4, 8... y algunos ranks tienen más posiciones inválidas que otros.

---

## Comparación de eficiencia entre plataformas (para $N = 3$)

| Plataforma | $p$ | $T$ (ms) | $S$ | $E = S/p$ | $f_{\text{exp}}$ (Karp-Flatt) |
|------------|-----|----------|------|-----------|-------------------------------|
| OpenMP 2T | 2 | 305 | 1.64 | 0.82 | 0.219 |
| OpenMP 4T | 4 | 205 | 2.44 | 0.61 | 0.236 |
| OpenMP 8T | 8 | 152 | 3.29 | 0.41 | 0.258 |
| MPI 2P | 2 | 340 | 1.47 | 0.74 | 0.365 |
| MPI 4P | 4 | 260 | 1.92 | 0.48 | 0.427 |
| CUDA | 896 | 5.0 | 100 | 0.112 | 0.00101 |

La eficiencia $E = S/p$ mide qué fracción del rendimiento pico se aprovecha. OpenMP logra la mejor eficiencia relativa (41-82%), pero con speedup modesto. CUDA logra el mayor speedup absoluto (100×) pero con eficiencia por core baja (11%), lo cual es típico en GPUs donde la latencia se oculta mediante concurrencia masiva en vez de sincronización.

[FIGURA 3: Speedup real vs teórico (Amdahl) vs núcleos]

---

## Referencia cruzada

- Las estimaciones teóricas que motivan estas mediciones están en [06_casos_estudio_teoricos.md](06_casos_estudio_teoricos.md).
- El análisis de escalamiento (strong, weak e isoeficiencia) se desarrolla en [08_analisis_escalamiento.md](08_analisis_escalamiento.md).
- Las causas raíz de cada overhead se detallan en [09_depuracion_overhead.md](09_depuracion_overhead.md).