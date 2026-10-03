# Casos de Estudio Teóricos

## Caso 1: Hardware conocido $\rightarrow$ Estimación de tiempos

### Especificaciones del hardware de pruebas

La plataforma de desarrollo empleada para las mediciones empíricas y las estimaciones teóricas es la siguiente:

**CPU: Intel Core i5-11300H (Tiger Lake, 10 nm)**

| Parámetro | Valor |
|-----------|-------|
| Núcleos físicos | 4 |
| Hilos lógicos (HyperThreading) | 8 |
| Frecuencia base | 3.10 GHz |
| Frecuencia turbo (1 núcleo) | 4.40 GHz |
| Frecuencia turbo (todos los núcleos) | ~3.80 GHz |
| Caché L1 | 32 KB (instrucccciones) + 48 KB (datos) por núcleo |
| Caché L2 | 1.25 MB por núcleo |
| Caché L3 (compartida) | 8 MB |
| TDP | 35 W |

**GPU: NVIDIA GeForce GTX 1650 (TU117, arquitectura Turing)**

| Parámetro | Valor |
|-----------|-------|
| Streaming Multiprocessors (SM) | 14 |
| CUDA cores por SM | 64 (FP32) |
| CUDA cores totales | 896 |
| Reloj base | 1 395 MHz |
| Reloj boost | 1 560 MHz |
| VRAM | 4 GB GDDR5 |
| Ancho de banda memoria | 128 GB/s |
| Compute Capability | 7.5 |
| Warp size | 32 |
| Max threads/bloque | 1 024 |
| Max threads simultáneos | 14 × 1 024 = 14 336 |
| Registros por SM | 65 536 |

### Estimación de rendimiento sostenido (GOPS)

Para estimar el rendimiento sostenido en operaciones escalares de alto nivel (accesos a memoria, comparaciones, asignaciones), se consideran las operaciones que realiza cada nodo del árbol de búsqueda:

| Operación por nodo | Ops estimadas |
|--------------------|---------------|
| `findDropY` (gravedad) | ~180 |
| `clone` (copiar tablero 10×20) | 200 |
| `place` (escribir 4 bloques) | 4 |
| `clearLines` (20 filas × 10 cols + compactación) | ~260 |
| Subtotal por nodo intermedio | ~644 |
| Evaluación heurística (hoja) | ~250 |
| **Total por hoja** | ~894 |

**CPU (i5-11300H):** Se asume un rendimiento sostenido de ~3.5 GOPS para el workload mixto (enteros + accesos a memoria), creciendo a ~6.2 GOPS para $N$ grandes gracias a mejor localidad de caché (el tablero de 200 enteros cabe en L2).

**GPU (GTX 1650):** Cada thread ejecuta un camino completo del árbol, con ~894 ops por hoja. El rendimiento sostenido de la arquitectura Turing para enteros es de aproximadamente 4.5 TOPS (896 cores × 1 560 MHz), pero la ocupación efectiva del 55% y el overhead de gestión de threads reducen el rendimiento sostenido a ~2.5 TOPS para este workload.

### Cálculo de tiempos por decisión

Para cada nivel de look-ahead $N$, el número de hojas es $40^{N+1}$. Los tiempos se estiman como:

$$T_{\text{seq}}(N) = \frac{40^{N+1} \times 894}{3.5 \times 10^9}$$

Para OpenMP con $p$ hilos y fracción paralelizable $f = 0.80$:

$$T_{\text{OMP}}(N) = T_{\text{seq}}(N) \times \frac{1}{(1 - f) + f/p}$$

Para CUDA, los tiempos incluyen overhead de transferencia $T_{\text{transfer}} \approx 0.3$ ms (H→D) + $0.2$ ms (D→H):

$$T_{\text{CUDA}}(N) = T_{\text{transfer}} + \frac{40^{N+1} \times 894}{2.5 \times 10^{12}}$$

### Tabla comparativa de tiempos estimados

| $N$ | Combinaciones | $T_{\text{seq}}$ (ms) | $T_{\text{OMP 2T}}$ (ms) | $T_{\text{OMP 4T}}$ (ms) | $T_{\text{OMP 8T}}$ (ms) | $T_{\text{CUDA}}$ (ms) |
|-----|---------------|----------------------|--------------------------|--------------------------|--------------------------|------------------------|
| 0 | 40 | ~0.01 | 0.008 | 0.006 | 0.005 | **0.50** |
| 1 | 1 600 | ~0.5 | 0.30 | 0.20 | 0.15 | **0.70** |
| 2 | 64 000 | ~15 | 9.0 | 6.0 | 4.5 | **1.0** |
| 3 | 2 560 000 | ~500 | 300 | 200 | 150 | **5.0** |
| 4 | 102 400 000 | ~15 000 | 9 000 | 6 000 | 4 500 | **200** |
| 5 | 4 096 000 000 | ~600 000 | 360 000 | 240 000 | 180 000 | **8 000** |

> **Nota:** Los tiempos de CUDA para $N \leq 1$ incluyen overhead de transferencia que domina el cómputo. Los tiempos de OpenMP para 8 hilos asumen HyperThreading activo (4 núcleos físicos + 4 lógicos).

### Análisis: CUDA más lento para $N \leq 1$

Para $N = 0$, el tiempo secuencial es de apenas ~0.01 ms (40 evaluaciones), mientras que CUDA requiere transferir datos al dispositivo (~0.3 ms H→D), ejecutar el kernel (~0.01 ms) y recuperar resultados (~0.2 ms D→H). El overhead total de $\approx 0.5$ ms supera en **50×** al tiempo de cómputo secuencial. Este fenómeno es característico de la paralelización en GPU: la transferencia PCIe Gen3 x16 tiene una latencia mínima de ~4 $\mu$s por llamada a `cudaMemcpy`, más el ancho de banda efectivo de ~12 GB/s para transferencias pequeñas (menores a 1 MB), donde domina la latencia sobre el throughput.

Para $N = 1$, el cómputo CUDA (~0.2 ms) comienza a compensar el overhead, pero aún es comparable al secuencial. A partir de $N = 2$, el cómputo masivamente paralelo compensa con creces el overhead: la GPU evalúa 64 000 caminos en ~1 ms, superando al secuencial por 15×.

Esta observación confirma la regla práctica: **la paralelización en GPU solo es rentable cuando el tiempo de cómputo excede significativamente el overhead de transferencia**, lo que para nuestra arquitectura ocurre a partir de $N \geq 2$.

[FIGURA 1: Gráfico de barras comparativo - incluir en figuras/figura1_tiempos.png]

---

## Caso 2: Plazo fijo $\rightarrow$ Hardware necesario

### Restricción temporal: $\leq 100$ ms por decisión

Se establece como restricción operativa que cada decisión del algoritmo debe completarse en no más de 100 ms, umbral que permite un juego interactivo a $\geq 10$ decisiones por segundo. Este es el criterio estándar para sistemas de respuesta en tiempo real suave.

### Rendimiento requerido por nivel de look-ahead

El rendimiento necesario en operaciones por segundo se calcula como:

$$\text{GOPS}_{\text{req}}(N) = \frac{40^{N+1} \times 894}{0.1 \text{s} \times 10^9}$$

| $N$ | Combinaciones | Ops totales | GOPS requeridos | ¿Viable en hardware actual? |
|-----|---------------|-------------|-----------------|------------------------------|
| 0 | 40 | $3.6 \times 10^4$ | 0.0004 | Sí (cualquier CPU) |
| 1 | 1 600 | $1.4 \times 10^6$ | 0.014 | Sí (cualquier CPU) |
| 2 | 64 000 | $5.7 \times 10^7$ | 0.57 | Sí (CPU mono-núcleo) |
| 3 | 2 560 000 | $2.3 \times 10^9$ | 23 | Sí (CPU multi-núcleo, OpenMP) |
| 4 | 102 400 000 | $9.1 \times 10^{10}$ | 910 | Sí (GPU) |
| 5 | 4 096 000 000 | $3.7 \times 10^{12}$ | 36 600 | Solo multi-GPU o cluster |

### Propuesta de hardware mínimo por nivel de look-ahead

**Para $N = 3$ (2.3 GOPS requeridos):**

Cualquier CPU de escritorio de 4+ núcleos con OpenMP satisface el requerimiento. Con un i5-11300H y 8 hilos, el tiempo estimado es de ~150 ms, ligeramente por encima del umbral. Alternativas:

| Plataforma | Costo aprox. | Tiempo est. $N{=}3$ | Viabilidad |
|------------|-------------|---------------------|-----------|
| Intel Core i5-11300H (8T) | Existente | ~150 ms | Marginal |
| AMD Ryzen 5 5600X (12T) | ~\$180 | ~90 ms | Cumple |
| Intel Core i7-12700K (20T) | ~\$300 | ~60 ms | Sobrado |

**Para $N = 4$ (910 GOPS requeridos):**

Se requiere aceleración por GPU. La GTX 1650 actual lo logra en ~200 ms (marginalmente por encima de 100 ms). Alternativas:

| Plataforma | CUDA cores | Tiempo est. $N{=}4$ | Viabilidad |
|------------|-----------|---------------------|-----------|
| GTX 1650 | 896 | ~200 ms | Marginal |
| RTX 3060 (Ampere) | 3 584 | ~50 ms | Cumple holgadamente |
| RTX 4060 (Ada Lovelace) | 3 072 | ~55 ms | Cumple |

**Para $N = 5$ (36 600 GOPS requeridos):**

Ninguna GPU de consumo individual satisface el requerimiento en $\leq 100$ ms. Se requieren arquitecturas distribuidas:

| Plataforma | Recursos | Tiempo est. | Viabilidad |
|------------|----------|-------------|-----------|
| RTX 4090 (paralelo masivo) | 16 384 cores | ~2 000 ms | Insuficiente |
| 4× RTX 4090 (multi-GPU) | 65 536 cores | ~500 ms | Aún insuficiente |
| Cluster MPI (10 nodos × 8 núcleos) | 80 cores CPU | ~18 000 ms | No viable |
| Cluster MPI (10 nodos × RTX 3060) | ~35 000 cores | ~300 ms | Marginal |

La complejidad $O(40^{N+1})$ hace que $N = 5$ sea prohibitivo para tiempo real en hardware actual. La solución práctica es poda alfa-beta (reduce el factor de ramificación efectivo de 40 a ~10-15) o heurísticas aproximadas.

[FIGURA 2: Curva de rendimiento requerido vs look-ahead]

---

## Referencia cruzada

- Las mediciones empíricas reales que validan (o desmienten) estas estimaciones se presentan en [07_mediciones_empiricas.md](07_mediciones_empiricas.md).
- El análisis de escalamiento con más detalles se encuentra en [08_analisis_escalamiento.md](08_analisis_escalamiento.md).
- La descripción formal del algoritmo y complejidad está en la propuesta completa (`propuesta_paralelizacion_completa.md`, secciones 3 y 4).