# Introducción

## El cómputo paralelo en la era de la inteligencia artificial

La inteligencia artificial y el cómputo paralelo están intrínsecamente ligados. Desde los primeros sistemas expertos que requerían enumerar combinaciones prohibitivas, hasta los modelos de lenguaje contemporáneos que entrenan en clusters de miles de GPUs, la necesidad de procesar múltiples caminos de computación de forma simultánea ha sido un habilitador fundamental del progreso en IA. La historia de la IA es, en buena medida, la historia de la búsqueda de estrategias para explorar espacios combinatorios cada vez más grandes en tiempos razonables.

El hito fundacional de esta relación fue **Deep Blue**, el supercomputador de IBM que en 1997 derrotó al campeón mundial de ajedrez Garry Kasparov. Deep Blue era un sistema RS/6000 SP con 30 procesadores PowerPC y 480 chips VLSI especializados, capaz de evaluar 200 millones de posiciones por segundo mediante búsqueda paralela *alpha-beta* con hardware dedicado [Campbell *et al.*, 2002]. La fuerza bruta -- no la elegancia algorítmica -- fue su ventaja competitiva: cada posición de ajedrez se evaluaba con funciones heurísticas simples, pero el volumen de evaluaciones por segundo hacía innecesaria una comprensión profunda del juego.

Casi dos décadas después, **AlphaGo** [Silver *et al.*, 2016] representó un cambio de paradigma: en lugar de búsqueda exhaustiva pura, combinó redes neuronales profundas con búsqueda de árbol Monte Carlo (*MCTS*). Sin embargo, AlphaGo todavía dependía críticamente del paralelismo. Su versión distribuida utilizó 1,920 CPUs y 280 GPUs, evaluando millones de movimientos simultáneamente. La versión AlphaZero (2017) demostró que un mismo algoritmo podía dominar ajedrez, shogi y Go sin datos humanos, pero nuevamente requirió horas de autójuego masivamente paralelo en TPUs especializadas [Silver *et al.*, 2018]. En todos estos casos, la capacidad de evaluar caminos de búsqueda en paralelo fue la diferencia entre la viabilidad y la imposibilidad.

Esta relación entre IA y paralelismo se extiende más allá de los juegos. La síntesis de fármacos mediante *docking* molecular, la optimización de portafolios financieros con simulación Monte Carlo, la planificación robótica con búsqueda en árboles de estados, y el entrenamiento de redes neuronales profundas comparten un denominador común: la necesidad de explorar espacios de búsqueda exponenciales donde cada camino es potencialmente independiente y evaluable en paralelo.

## Motivación: Tetris como problema de IA paralelizable

Tetris, propuesto por Alekséi Pázhitnov en 1984, es un juego aparentemente simple: piezas compuestas por cuatro bloques (tetrominós) caen en un tablero de $10 \times 20$ celdas y el jugador debe acomodarlas para completar líneas. Sin embargo, Tetris ha sido demostrado como **NP-difícil** en su variante de decisión [Breukelaar *et al.*, 2004]: determinar si existe una secuencia de colocaciones que mantenga el tablero vivo indefinidamente es computacionalmente intratable. Esta complejidad lo convierte en un excelente caso de estudio para algoritmos de búsqueda con evaluación heurística.

Un algoritmo de IA para Tetrsis que utilice búsqueda exhaustiva con *look-ahead* de profundidad $N$ debe evaluar todas las combinaciones posibles de colocación para la pieza actual y las $N$ piezas siguientes. Dado que en cada nivel existen $10 \text{ columnas} \times 4 \text{ rotaciones} = 40$ posiciones candidatas, el número de caminos en el árbol de búsqueda crece como $40^{N+1}$, una función exponencial con base 40. Para $N=3$, esto implica evaluar aproximadamente 2.56 millones de posiciones por decisión; para $N=5$, más de 4 mil millones. Este crecimiento exponencial es el desafío central: un algoritmo secuencial simplemente no puede enfrentar profundidades mayores a $N=2$ en tiempos interactivos.

Lo que hace a este problema particularmente atractivo desde la perspectiva del cómputo paralelo es su **estructura de independencia total**: cada camino del árbol se evalúa sobre una copia independiente del tablero, sin dependencias de datos entre caminos. No hay sincronización necesaria durante la evaluación; la única comunicación es la comparación final del resultado mínimo. Esto clasifica al problema como *embarrassingly parallel* -- la clase más favorable para la paralelización -- y lo convierte en un laboratorio ideal para estudiar y comparar distintos paradigmas de cómputo paralelo.

## Objetivos del proyecto

Este proyecto se plantea los siguientes objetivos:

1. **Implementar un solver secuencial** de búsqueda exhaustiva para Tetris con evaluación heurística, como línea base medible y verificable.

2. **Paralelizar el solver con tres enfoques** fundamentales de cómputo paralelo:
   - **OpenMP** (memoria compartida): paralelizar las 40 evaluaciones del nivel externo del árbol de búsqueda sobre los 8 hilos lógicos del CPU (Intel Core i5-11300H).
   - **CUDA** (acelerador GPU): aplanar el árbol completo, codificando cada camino raíz-hoja como un número en base 40, y distribuir la evaluación entre los 896 CUDA cores de la GPU (NVIDIA GTX 1650).
   - **MPI** (paso de mensajes): distribuir subárboles entre nodos de cómputo en un entorno distribuido.

3. **Validar experimentalmente las leyes teóricas** de escalamiento: la ley de Amdahl (speedup con tamaño de problema fijo) y la ley de Gustafson (speedup con tamaño de problema escalado), comparando las predicciones teóricas con mediciones de rendimiento en hardware real.

4. **Analizar formalmente el paralelismo** mediante el Método de Foster, documentando las fases de particionamiento, comunicación, aglomeración y mapeo para cada enfoque.

5. **Comparar cuantitativamente** los tres paradigmas de paralelismo en términos de speedup, eficiencia, escalabilidad y complejidad de implementación.

## Estructura del documento

El resto de este reporte está organizado de la siguiente manera:

- **Sección 3** formaliza la descripción del problema: reglas de Tetris, modelo matemático del solver, función heurística, árbol de búsqueda y pseudocódigo secuencial.
- **Sección 4** presenta el análisis de complejidad: factor de ramificación, conteo de operaciones escalares, complejidad temporal asintótica y complejidad espacial.
- **Sección 5** desarrolla el diseño paralelo mediante el Método de Foster a través de sus cuatro fases para cada enfoque (OpenMP, CUDA, MPI).
- **Sección 6** estudia casos teóricos: estimación de tiempos con hardware conocido y Hardware necesario para cumplir restricciones temporales.
- **Sección 7** reporta las mediciones empíricas: tablas comparativas de tiempo, speedup real vs. teórico, y métrica de Karp-Flatt.
- **Sección 8** analiza la escalabilidad: *strong scaling*, *weak scaling* y función de isoeficiencia.
- **Sección 9** documenta la depuración y *overhead*: herramientas utilizadas, hallazgos y *flame graphs*.
- **Sección 10** presenta las evidencias de aprendizaje por unidad temática.
- **Sección 11** formula las conclusiones y recomendaciones.
- **Sección 12** lista las referencias bibliográficas.
- **Sección 13** anexa el código fuente completo.