# Análisis de Complejidad

## Factor de ramificación

En cada nivel del árbol de búsqueda, el algoritmo evalúa todas las posiciones candidatas para la pieza correspondiente. Una posición queda definida por la columna de colocación ($x \in [0, 9]$, 10 opciones) y la rotación de la pieza ($r \in [0, 3]$, 4 opciones). El producto de ambas dimensiones define el **factor de ramificación** del árbol:

$$b = 10 \times 4 = 40$$

Este factor es constante en todos los niveles del árbol y no depende de la profundidad ni del estado del tablero. Algunas de las 40 posiciones pueden ser inválidas (la pieza excede los límites del tablero o colisiona con bloques existentes), pero el algoritmo debe verificar todas para descartar las inválidas, por lo que el costo de verificación es $\Theta(40)$ por nivel independientemente del número de posiciones válidas.

### Nodos por nivel

| Nivel $k$ | Correspondencia | Nodos ($40^{k+1}$) | Notación |
|-----------|-----------------|---------------------|----------|
| 0 | Pieza actual | 40 | $40^1$ |
| 1 | 1ª pieza futura | 1,600 | $40^2$ |
| 2 | 2ª pieza futura | 64,000 | $40^3$ |
| 3 | 3ª pieza futura | 2,560,000 | $40^4$ |
| 4 | 4ª pieza futura | 102,400,000 | $40^5$ |
| 5 | 5ª pieza futura | 4,096,000,000 | $40^6$ |

La tabla anterior revela la naturaleza exponencial del problema. Con $N=3$, el árbol ya supera los 2.5 millones de nodos; con $N=5$, se alcanzan más de 4 mil millones. Este crecimiento hace inviables las profundidades altas en ejecución secuencial y motiva la paralelización.

## Complejidad temporal asintótica

El número total de nodos evaluados para una profundidad de *look-ahead* $N$ es la suma geométrica:

$$T(N) = \sum_{k=1}^{N+1} 40^k = 40 + 40^2 + 40^3 + \cdots + 40^{N+1}$$

Usando la fórmula de la serie geométrica con razón $r = 40$:

$$T(N) = \frac{40^{N+2} - 40}{39}$$

Dado que el término dominante es $40^{N+1}$, la complejidad asintótica es:

$$T(N) \in \Theta(40^{N+1})$$

Cada incremento unitario en $N$ **multiplica el tiempo de ejecución por 40**. Esto tiene implicaciones directas:

- $N=0 \to N=1$: el costo se multiplica por $\approx 40\times$
- $N=2 \to N=3$: idem, $\approx 40\times$
- $N=3 \to N=4$: idem, $\approx 40\times$

Para $N=5$, el árbol alcanza más de 4 mil millones de evaluaciones, lo cual es impracticable en ejecución secuencial (estimado en $\approx 10$ minutos por decisión) pero factible con paralelización masiva (estimado en $\approx 5$ segundos con CUDA).

## Conteo detallado de operaciones escalares

Cada nodo del árbol de búsqueda ejecuta una secuencia de operaciones elementales. A continuación se descompone el costo por nodo para las operaciones involucradas en la evaluación de una posición candidata $(x, r)$:

### Operaciones por nodo

| Operación | Descripción detallada | Operaciones escalares |
|-----------|----------------------|----------------------|
| `findDropY` | ~15 iteraciones de caída $\times$ 4 bloques $\times$ 3 verificaciones (límites, colisión, vacío) | $\approx 180$ |
| `clone` | Copiar tablero $10 \times 20 = 200$ celdas (1 asignación cada una) | $200$ |
| `place` | Escribir 4 bloques en posiciones $(x + dx, y + dy)$ | $4$ |
| `clearLines` | Escaneo de 20 filas $\times$ 10 columnas + compactación (desplazar filas hacia abajo) | $\approx 260$ |
| **Subtotal por nodo** | | **$\approx 644$** |

### Operaciones adicionales en nodos hoja

Los nodos hoja (nivel $N$) ejecutan las operaciones anteriores y, además, evalúan la heurística:

| Operación | Descripción | Operaciones escalares |
|-----------|-------------|----------------------|
| `getHeight` | Recorrer $10$ columnas de arriba a abajo, buscar primera celda ocupada | $\approx 100$ |
| `countHoles` | Recorrer $10$ columnas, para cada una contar celdas vacías bajo un bloque | $\approx 150$ |
| **Subtotal hoja** | | **$\approx 250$ |

### Costo total por camino

Un camino desde la raíz hasta una hoja de profundidad $N$ cruza $N+1$ nodos. Los primeros $N$ nodos ejecutan $\approx 644$ operaciones cada uno; el último (hoja) ejecuta $\approx 644 + 250 = 894$. El costo por camino es:

$$C_{\text{camino}}(N) = N \times 644 + 894$$

Para $N=3$: $C_{\text{camino}} = 3 \times 644 + 894 = 2{,}826$ operaciones escalares por camino.

### Operaciones totales por nivel de look-ahead

Multiplicando el número de caminos ($40^{N+1}$) por el costo por camino (que incluye el costo de los nodos internos en caminos compartidos), se obtiene el total de operaciones escalares:

| $N$ | Nodos totales | Hojas ($40^{N+1}$) | Ops. totales (estimado) |
|-----|--------------|---------------------|------------------------|
| 0 | 40 | 40 | $\approx 2.6 \times 10^4$ |
| 1 | 1,640 | 1,600 | $\approx 1.1 \times 10^6$ |
| 2 | 65,640 | 64,000 | $\approx 4.4 \times 10^7$ |
| 3 | 2,625,640 | 2,560,000 | $\approx 1.8 \times 10^9$ |
| 4 | 105,025,640 | 102,400,000 | $\approx 7.2 \times 10^{10}$ |
| 5 | 4,201,025,640 | 4,096,000,000 | $\approx 2.9 \times 10^{12}$ |

Para $N=3$: aproximadamente **1.8 mil millones** de operaciones escalares por decisión. Para $N=5$: aproximadamente **2.9 billones** ($2.9 \times 10^{12}$) de operaciones escalares por decisión.

## Complejidad espacial

Cada nivel de la recursión mantiene una copia independiente del tablero. Un tablero se representa como una matriz de enteros de dimensiones $10 \times 20 = 200$ celdas:

$$\text{Copia del tablero} = 200 \text{ enteros} \times 4 \text{ bytes} = 800 \text{ bytes}$$

La profundidad máxima de recursión es $N+1$ (desde la pieza actual hasta la hoja). El uso de memoria en stack es:

$$S(N) = (N+1) \times 800 \text{ bytes}$$

| $N$ | Niveles en stack | Memoria de stack |
|-----|------------------|-----------------|
| 0 | 1 | 800 B |
| 1 | 2 | 1.6 KB |
| 3 | 4 | 3.2 KB |
| 5 | 6 | 4.8 KB |

La complejidad espacial es **$O(N)$**, perfectamente manejable. Incluso con $N=100$, el uso de memoria de stack sería inferir a 80 KB. Esta es una propiedad favorable del algoritmo: el cuello de botella es temporal, no espacial.

## Naturaleza del paralelismo

El algoritmo exhibe **paralelismo de datos puro** en dos niveles de granularidad:

### Granularidad gruesa: nivel 0

Las 40 evaluaciones del primer nivel (pieza actual) son **completamente independientes**: cada una opera sobre una copia privada del tablero, no lee ni modifica datos de las demás, y no requiere sincronización hasta la recolección del resultado final. Esto produce 40 tareas de tamaño aproximadamente uniforme (cada una evalúa $\approx 40^N$ sub-árboles), ideal para distribución sobre hilos CPU.

### Granularidad fina: árbol completo

Los $40^{N+1}$ caminos desde la raíz hasta las hojas son **totalmente independientes** entre sí. Cada camino simula una secuencia completa de colocaciones sobre su propia copia del tablero, sin comunicación con otros caminos. La única operación colectiva es la reducción final (encontrar el mínimo global del primer nivel). Esto clasifica al problema como *embarrassingly parallel* y lo hace especialmente adecuado para ejecución masivamente paralela en GPU.

### Escalamiento con look-ahead

La relación directa entre $N$ y la carga computacional tiene implicaciones fundamentales para la paralelización:

$$\frac{T(N+1)}{T(N)} \approx 40$$

Cada incremento unitario en la profundidad de *look-ahead* multiplica el trabajo disponible por 40. Esto significa que:

1. **La paralelización no acelera una profundidad fija**: según la ley de Amdahl, el speedup está acotado por la fracción secuencial ($S_\infty = 1/(1-f)$). Para OpenMP con $f=0.80$, el límite es $5.0\times$; para CUDA con $f=0.86$, es $7.14\times$.

2. **La paralelización habilita profundidades mayores**: según la ley de Gustafson, al escalar el problema con los procesadores disponibles, el speedup efectivo crece linealmente. Con 896 CUDA cores y $f=0.86$: $S_{gs} = 1 + (896-1) \times 0.86 \approx 770\times$. Esto significa que donde la CPU evaluía $N=3$ (2.56M combinaciones en 500 ms), la GPU podría evaluar el equivalente a $770 \times 2.56M \approx 1{,}970M$ combinaciones en el mismo tiempo, potencialmente alcanzando $N=5$.

3. **El "grano" del paralelismo crece con $N$**: para $N=0$, hay solo 40 tareas independientes (insuficiente para saturar una GPU). Para $N=3$, hay $2{,}560{,}000$ caminos independientes (suficiente para mantener ocupados los 896 CUDA cores con $\approx 2{,}850$ caminos por core). Para $N=5$, hay más de 4 mil millones de caminos, saturando cualquier hardware actual.

Esta propiedad -- que el paralelismo disponible escala con el tamaño del problema -- es la característica que hace de este problema un caso de estudio ideal para comparar OpenMP, CUDA y MPI bajo las leyes de Amdahl y Gustafson.