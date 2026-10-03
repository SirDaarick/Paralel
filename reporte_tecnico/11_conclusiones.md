# Conclusiones y Recomendaciones

---

## Conclusiones

**1. El problema de búsqueda exhaustiva en Tetris es inherentemente paralelizable.** El árbol de búsqueda de complejidad $O(40^{N+1})$ está compuesto por caminos completamente independientes desde la raíz hasta las hojas, sin dependencias de datos ni requisitos de comunicación entre ellos. Esto constituye la definición de un problema *embarazosamente paralelo* [Foster, 1995], la clase más favorable para la paralelización. La evidencia experimental confirma que la comunicación se reduce a una sola operación de reducción (`#pragma omp critical` en OpenMP, `MPI_Allreduce` en MPI, condición de carrera benigna en CUDA), validando que la fracción secuencial es mínima.

**2. La complejidad exponencial hace de la paralelización una necesidad, no un lujo.** Con un factor de ramificación de 40, cada incremento unitario en *look-ahead* multiplica el tiempo de ejecución por ~40. Para $N=3$, una decisión toma 500 ms secuencialmente -- inaceptable para interacción en tiempo real (<100 ms). Solo la paralelización habilita profundidades de análisis que producen un juego de calidad competente. La evidencia directa es que CUDA con $N=3$ toma ~5 ms por decisión, viable a 200 FPS, mientras que el secuencial con $N=3$ solo logra 2 decisiones por segundo.

**3. Los speedups medidos validan las leyes teóricas de Amdahl y Gustafson.** Para $N=3$, los speedups medidos son ~3.3 (OpenMP, 8 hilos) y ~7.2 (CUDA, 896 cores), coincidiendo con las predicciones de Amdahl ($S(8) = 3.33$ para $f=0.80$, $S(896) = 7.10$ para $f=0.86$) con una desviación menor al 3%. La métrica de Karp-Flatt confirmó que la fracción serial experimental ($s_e = 0.205$ para OpenMP, $s_e = 0.137$ para CUDA) es consistente con los valores teóricos. Bajo Gustafson, el speedup escalado potencial de CUDA es ~770, demostrando que al escalar el problema con el hardware, el speedup crece linealmente sin la asíntota restrictiva de Amdahl.

**4. Los tres paradigmas de paralelismo ofrecen soluciones complementarias con distintos perfiles de costo-beneficio.** OpenMP requiere 3 líneas adicionales de código (`#pragma omp parallel for`, `#pragma omp critical`, aplanamiento del bucle) para un speedup de ~3.3, saturando un CPU de consumo. CUDA requiere ~250 líneas de código de kernel pero logra ~7.2 de speedup en una GPU de gama de entrada, con potencial de 770 bajo Gustafson. MPI escala a múltiples nodos con un overhead de comunicación despreciable (<0.04% para $N \geq 2$), pero introduce complejidad de despliegue. Cada paradigma corresponde a una categoría distinta de la taxonomía de Flynn (MIMD, SIMT, MIMD distribuido), evidenciando que el mismo problema puede abordarse desde arquitecturas fundamentalmente distintas.

**5. El proyecto demuestra que la computación paralela en hardware de consumo produce resultados significativos.** Un laptop con i5-11300H + GTX 1650 logra evaluar 2.56 millones de combinaciones en 5 ms (CUDA, $N=3$), un resultado que secuencialmente tomaría 500 ms. Esto demuestra que la computación paralela no requiere supercomputadoras: con la arquitectura y las APIs adecuadas, hardware de consumo puede resolver problemas combinatorios intratables secuencialmente.

---

## Resumen de speedups alcanzados

| Implementación | $T_{N=3}$ (ms) | $S$ medido | $S$ Amdahl | $S$ Gustafson | $S_\infty$ |
|----------------|-----------------|------------|------------|---------------|-------------|
| Secuencial     | 500             | 1.00       | --         | --            | --          |
| OpenMP (8T)    | 152             | 3.29       | 3.33       | 6.60          | 5.00        |
| CUDA (896C)    | 69              | 7.25       | 7.10       | 770           | 7.14        |

La paralelización no solo acelera -- eleva el techo de calidad de juego alcanzable: donde el secuencial alcanza $N=2$ (64,000 combinaciones evaluadas por decisión), CUDA permite $N=3$ viable en tiempo real (2.56 millones de combinaciones), un incremento de 40 en la profundidad de análisis que se traduce en decisiones significativamente mejores.

---

## Limitaciones del trabajo actual

1. **Cap de profundidad CUDA en $N=3$:** El kernel está limitado a `maxDepth=3` para garantizar decisiones bajo 10 ms. Sin el cap, $N=4$ tomaría ~200 ms y $N=5$ ~8 s. Esto limita la ventaja de CUDA a $N \leq 3$.
2. **Heurística simple:** La función de evaluación `altura + huecos` no considera bumpiness (rugosidad de la superficie), altura por columna, ni pozos profundos. Una heurística más sofisticada podría requerir menos profundidad de look-ahead para igual calidad.
3. **MPI no ejecutado en cluster real:** Las mediciones de MPI son proyecciones teóricas basadas en modelos de comunicación. No se dispone de un cluster multi-núcleo para validación empírica del speedup distribuido.
4. **Ocupación GPU del 55%:** La presión de registros (`board[200]` en register file) limita la ocupación al 55%, dejando recursos GPU subutilizados.
5. **Sin pruning ni poda alfa-beta:** El algoritmo evalúa exhaustivamente los 40^(N+1) caminos sin descartar ramas dominadas o simétricas. Un factor de ramificación efectivo de ~10-15 (mediante poda) reduciría el árbol en órdenes de magnitud.

---

## Recomendaciones de trabajo futuro

1. **Eliminar el cap de CUDA con multi-stream:** Implementar el kernel con CUDA streams asíncronos para procesar $N > 3$ en tandas, solapando cómputo y transferencias. Con dos streams, $N=4$ (~200 ms) podría dividirse en dos fases de ~100 ms, manteniendo la responsividad.

2. **Implementar poda alfa-beta o movimientos simétricos:** Reducir el factor de ramificación efectivo de 40 a ~10-15 descartando posiciones equivalentes (ej. pieza I horizontal en $x=0$ y $x=1$ producen el mismo resultado) y podando ramas donde la heurística ya supera el mejor valor encontrado. Esto reduciría $N=4$ de 102M a ~10M combinaciones, viable en CPU.

3. **Heurística ponderada por columna:** Incorporar las métricas *aggregate height*, *bumpiness* (diferencia de altura entre columnas adyacentes) y *well depth* (profundidad de pozos inaccesibles) con pesos optimizables. Esto mejoraría la calidad de juego sin incrementar $N$.

4. **Paralelismo híbrido MPI+CUDA:** Distribuir subárboles entre nodos de un cluster, con cada nodo usando CUDA para evaluar su subárbol en GPU. Esto combinaria el escalamiento distribuido de MPI con el rendimiento masivo de CUDA, alcanzando speedups teóricos de $770 \times p$ donde $p$ es el número de nodos con GPU.

5. **Inferencia con red neuronal en GPU:** Entrenar una red neuronal ligera (ej. MLP de 3 capas) para aproximar la heurística y ejecutar inferencia en GPU mediante TensorRT o cuDNN. Esto reemplazaría la búsqueda exhaustiva con evaluación directa en ~0.1 ms por decisión, sacrificando optimalidad teórica por viabilidad en tiempo real para $N > 5$.

---

## Reflexión sobre la relevancia del problema para IA

La búsqueda exhaustiva con evaluación heurística es un patrón fundamental en IA: desde Deep Blue [Campbell et al., 2002] que evaluó ~200 millones de posiciones por segundo en ajedrez, hasta AlphaGo [Silver et al., 2016] que combinó búsqueda Monte Carlo con redes neuronales. Este proyecto replica a escala didáctica el mismo principio: la calidad de la decisión es función de la profundidad de análisis, y la profundidad viable es función de la capacidad computacional paralela. La paralelización no es un optimización menor -- es la diferencia entre un agente miope ($N=0$, 40 combinaciones) y uno competente ($N=3$, 2.56 millones de combinaciones). En este sentido, el proyecto evidencia que la computación paralela es un habilitador fundamental para la inteligencia artificial, y que las leyes que gobiernan sus límites (Amdahl, Gustafson) son tan relevantes como los algoritmos mismos.