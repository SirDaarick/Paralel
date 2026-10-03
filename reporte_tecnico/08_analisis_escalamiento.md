# Análisis de Escalamiento

## Strong Scaling

### Definición formal

El **strong scaling** analiza cómo varía el tiempo de ejecución al incrementar el número de procesadores $p$ manteniendo fijo el tamaño del problema $W$. La eficiencia de strong scaling se define como:

$$E(p) = \frac{S(p)}{p} = \frac{T_1}{p \times T_p}$$

donde $T_1$ es el tiempo secuencial y $T_p$ es el tiempo con $p$ procesadores. Un escalamiento ideal produciría $E = 1$ para todo $p$, pero la fracción secuencial del código y el overhead de paralelización degradan $E$ conforme crece $p$.

### Tabla: Strong scaling con $N = 3$ fijo

Se mide el tiempo por decisión con look-ahead $N = 3$ (2 560 000 combinaciones), variando el número de hilos OpenMP:

| $p$ (hilos) | $T_p$ (ms) | $S(p) = T_1 / T_p$ | $E(p) = S/p$ | Tiempo ideal (ms) |
|-------------|-----------|---------------------|--------------|-------------------|
| 1 | 500 | 1.00 | 1.000 | 500.0 |
| 2 | 305 | 1.64 | 0.820 | 250.0 |
| 4 | 205 | 2.44 | 0.610 | 125.0 |
| 8 | 152 | 3.29 | 0.411 | 62.5 |

### Gráfico conceptual (strong scaling)

```
Tiempo (ms) ▲
  500 ┤●
      │ ╲
  400 ┤   ╲
      │     ╲
  300 ┤       ● (2T)
      │        ╲
  200 ┤          ● (4T)
      │           ╲
  150 ┤             ● (8T)
      │
  125 ┤ - - - - - - - ○ ideal(4T)
   63 ┤ - - - - - - - - - - - - ○ ideal(8T)
      │
    0 ┼────┬────┬────┬────
       1    2    4    8    Hilos (p)
```

### Análisis

La eficiencia cae de 0.82 (2 hilos) a 0.41 (8 hilos). Las causas son:

1. **Fracción secuencial constante:** Según Amdahl con $f = 0.80$, el tiempo secuencial es de 100 ms ($20\% \times 500$ ms). Con $p = 8$, la parte paralela se reduce a $\frac{400}{8} = 50$ ms, más 100 ms secuenciales = 150 ms teóricos. La medida (152 ms) confirma el modelo.

2. **HyperThreading con rendimiento decreciente:** Los hilos 5-8 son lógicos (HT) y comparten unidades de ejecución con los núcleos físicos. El salto de 4T → 8T solo reduce el tiempo en un 26% (205 → 152 ms), no el 50% esperado con núcleos reales adicionales.

3. **Overhead de sincronización:** La barrera implícita al final del `#pragma omp parallel for` y la sección crítica (`#pragma omp critical`) introducen espera que crece con $p$.

El speedup máximo teórico de Amdahl para $f = 0.80$ es:

$$S_\infty = \frac{1}{1 - f} = \frac{1}{0.20} = 5.0\times$$

Con 8 hilos ya se alcanza el 66% del speedup máximo posible ($3.29 / 5.0 = 0.658$), confirmando que agregar más hilos CPU tiene rendimientos marginales decrecientes.

---

## Weak Scaling

### Definición formal

El **weak scaling** analiza cómo varía el tiempo de ejecución cuando se incrementan proporcionalmente el número de procesadores $p$ y el tamaño del problema $W$, de modo que el trabajo por procesador se mantiene constante. La eficiencia de weak scaling es:

$$E_{\text{weak}}(p) = \frac{T_1}{T_p}\bigg|_{W/p = \text{const}}$$

Un escalamiento ideal mantiene $T_p = T_1$ para todo $p$, es decir, $E_{\text{weak}} = 1$.

### Aplicación al problema Tetris

En el contexto del solver Tetris, "escalar el problema" significa incrementar el look-ahead $N$, lo cual multiplica las combinaciones por $\approx 40$ por cada nivel adicional. La dificultad para weak scaling es que $N$ es discreto: no podemos usar $N = 2.5$. Para aproximar, utilizamos la relación entre el trabajo y el número de hilos:

$$W(N) = 40^{N+1} \approx 40 \times 40^N$$

Si queremos que cada hilo procese la misma cantidad de combinaciones que en el caso secuencial con $N = N_0$ y 1 hilo, entonces con $p$ hilos necesitamos:

$$\frac{40^{N_p + 1}}{p} = 40^{N_0 + 1} \implies 40^{N_p} = p \times 40^{N_0} \implies N_p = N_0 + \log_{40}(p)$$

### Tabla: Weak scaling (trabajo por hilo constante)

Punto de referencia: 1 hilo con $N = 2$ (64 000 combinaciones, ~15 ms).

| $p$ | $N_p$ efectivo | Combinaciones totales | Combs/hilo | $T_p$ (ms) | $E_{\text{weak}}$ |
|-----|---------------|-----------------------|------------|-----------|-------------------|
| 1 | 2 | 64 000 | 64 000 | 15 | 1.00 |
| 2 | 2 + $\log_{40}(2) \approx 2.13$ | ~128 000 | 64 000 | ~18 | 0.83 |
| 4 | $2 + \log_{40}(4) \approx 2.26$ | ~256 000 | 64 000 | ~22 | 0.68 |
| 8 | $2 + \log_{40}(8) \approx 2.40$ | ~512 000 | 64 000 | ~30 | 0.50 |

> **Nota:** Los valores de $N_p$ son aproximaciones teóricas (no discretas). En la práctica, se usan $N = 2$ para 1-2 hilos y $N = 3$ para 4-8 hilos como aproximación conservadora.

### Tabla: Weak scaling con $N$ discretos (aproximación práctica)

| $p$ | $N$ | Combinaciones totales | Combs/hilo | $T_p$ (ms) | $E_{\text{weak}}$ |
|-----|-----|-----------------------|------------|-----------|-------------------|
| 1 | 2 | 64 000 | 64 000 | 15 | 1.00 |
| 2 | 2 | 64 000 | 32 000 | 9 | 1.67* |
| 4 | 3 | 2 560 000 | 640 000 | 205 | 0.073 |
| 8 | 3 | 2 560 000 | 320 000 | 152 | 0.099 |

El salto de $N = 2$ a $N = 3$ multiplicó las combinaciones por 40, pero solo duplicamos los hilos (de 2 a 4). Esto produce una caída brusca en eficiencia: el trabajo por hilo creció 20× (de 32 000 a 640 000), no se mantuvo constante.

**Conclusión:** El weak scaling es problemático para este problema porque la granularidad de $N$ es demasiado gruesa: cada incremento de $N$ multiplica el trabajo por 40, y no es posible escalar finamente el problema. Para obtener weak scaling realista, se necesitaría un factor de ramificación ajustable (por ejemplo, podando posiciones para reducir de 40 a un valor configurable).

---

## Función de Isoeficiencia

### Definición formal

La **función de isoeficiencia** $W = f(p)$ describe cómo debe crecer el tamaño del problema $W$ en función del número de procesadores $p$ para mantener una eficiencia constante $E$. Formalmente:

$$W = K \times T_o(p)$$

donde $T_o(p)$ es el overhead total de paralelización y $K$ es una constante que depende de la eficiencia objetivo. La isoeficiencia se deriva de:

$$E = \frac{W}{W + T_o(p)} = \frac{1}{1 + T_o(p)/W}$$

Despejando:

$$W = T_o(p) \times \frac{E}{1 - E}$$

Para una eficiencia objetivo $E_0$, el tamaño del problema debe crecer proporcionalmente al overhead.

### Overhead de paralelización para OpenMP

Para el solver OpenMP, el overhead total $T_o(p)$ se compone de:

1. **Overhead de fork-join:** $T_{\text{fork}} \approx 0.5$ ms (constante, independiente de $p$)
2. **Overhead de sección crítica:** $T_{\text{crit}} \approx 0.3$ ms (crece linealmente con $p$ por contención)
3. **Overhead por desbalance:** $T_{\text{imb}} \approx 0.05 \times W/p$ (5% del trabajo por hilo, posiciones inválidas)
4. **Overhead por HT:** $T_{\text{HT}} \approx 0$ para $p \leq 4$; $\approx 0.3 \times W/p$ para $p > 4$ (30% de penalización en hilos lógicos)

El overhead total se aproxima como:

$$T_o(p) \approx T_{\text{fork}} + T_{\text{crit}} \times p + 0.05 \times \frac{W}{p} + 0.3 \times \frac{W}{p} \times \mathbb{1}_{p > 4}$$

### Determinación de $\alpha$ en $N \propto p^\alpha$

Para el problema Tetris, el tamaño del problema está determinado por $N$:

$$W(N) = 40^{N+1} \times 894$$

Para determinar la relación de isoeficiencia, planteamos que $W$ debe crecer al menos tan rápido como $T_o(p)$ para mantener $E$ constante. Dado que $T_o(p)$ crece linealmente con $p$ (dominado por $T_{\text{crit}} \times p$ y la penalización de HT), necesitamos:

$$40^{N+1} \propto p \implies (N+1) \ln 40 \propto \ln p \implies N \propto \log_{40}(p) \propto \frac{\ln p}{\ln 40}$$

Esto significa que $N$ crece logarítmicamente con $p$: $\alpha \approx 1/\ln 40 \approx 0.27$ en la relación $N \propto p^{0.27}$.

En términos prácticos: duplicar $p$ solo permite incrementar $N$ en $\log_{40}(2) \approx 0.13$, es decir, necesitaríamos multiplicar $p$ por 40 para subir $N$ en 1. Esto confirma que el overhead crece más lentamente que el trabajo (el problema es altamente paralelizable), pero la discretización de $N$ impide aprovechar fully el isoeficiencia.

### Tabla de isoeficiencia ($E = 80\%$)

| $p$ | $N$ requerido | Combinaciones | $W$ (ops) | $T_o$ estimado (ms) | $W / (W + T_o)$ |
|-----|---------------|---------------|-----------|---------------------|-----------------|
| 1 | 2 | 64 000 | $5.7 \times 10^7$ | 0 | 1.00 |
| 2 | 2 | 64 000 | $5.7 \times 10^7$ | 1.1 | 0.98 |
| 4 | 3 | 2 560 000 | $2.3 \times 10^9$ | 1.7 | 1.00 |
| 8 | 3 | 2 560 000 | $2.3 \times 10^9$ | 3.4 | 1.00 |
| 16 | 4 | 102 400 000 | $9.1 \times 10^{10}$ | 5.5 | 1.00 |
| 32 | 4 | 102 400 000 | $9.1 \times 10^{10}$ | 10.5 | 1.00 |

> El overhead es tan pequeño en comparación con $W$ que la eficiencia se mantiene cercana a 1.0 para $N \geq 2$. La isoeficiencia solo se manifiesta para $N \leq 1$, donde $T_o$ es comparable a $W$.

### Isoeficiencia para CUDA

Para CUDA, el overhead es constante (transferencias PCIe ~0.5 ms), independiente de $p$ (número de CUDA cores):

$$T_o^{\text{CUDA}} \approx 0.5 \text{ ms (constante)}$$

Esto implica que la isoeficiencia para CUDA se satisface trivialmente para cualquier $N \geq 2$, ya que $W \gg T_o$. El problema es *embarazosamente paralelo* en GPU, y el único overhead significativo es la latencia de transferencia, que no escala con $p$.

### Script de referencia

El script Python que genera las curvas de isoeficiencia se encuentra en:

```
scripts/graficas_isoeficiencia.py
```

El script calcula $E(N, p) = W / (W + T_o(p))$ para rangos de $N \in [1, 5]$ y $p \in [1, 64]$, y grafica las curvas de nivel para $E = 0.80$ y $E = 0.90$ en el plano $(p, N)$.

[FIGURA 4: Strong scaling - tiempo vs núcleos]

[FIGURA 5: Isoeficiencia - N vs p para E = 80%]

---

## Referencia cruzada

- Las mediciones empíricas que alimentan este análisis están en [07_mediciones_empiricas.md](07_mediciones_empiricas.md).
- El análisis de overhead que explica las degradaciones se desarrolla en [09_depuracion_overhead.md](09_depuracion_overhead.md).
- Las estimaciones teóricas de tiempos están en [06_casos_estudio_teoricos.md](06_casos_estudio_teoricos.md).