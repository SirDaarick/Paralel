# Descripción Formal del Problema

## Reglas de Tetris y mecánica del juego

Tetris es un videojuego de puzzle en el cual piezas compuestas por cuatro celdas (tetrominós) caen desde la parte superior de un tablero rectangular de $10 \times 20$ celdas. El jugador controla la posición horizontal (columna $x$, con $0 \leq x \leq 9$) y la rotación del tetrominó (4 orientaciones posibles: $0^\circ$, $90^\circ$, $180^\circ$, $270^\circ$) antes de su colocación definitiva. Una vez posicionada, la pieza cae por gravedad hasta la posición más baja disponible (*gravedad*). Si una fila se completa en su totalidad (las 10 celdas ocupadas), dicha fila se elimina y todas las filas superiores descienden una posición. El juego termina cuando una nueva pieza no puede colocarse en la posición de aparición (fila superior) por falta de espacio.

### Los siete tetrominós

Existen 7 tipos de tetrominós, cada uno con una forma geométrica distintiva:

| Tetrominó | Forma | Rotaciones únicas |
|-----------|-------|-------------------|
| I (línea) | `████` | 2 |
| O (cuadrado) | `██` `██` | 1 |
| T | ` █` `███` | 4 |
| S | ` ██` `██` | 2 |
| Z | `██` ` ██` | 2 |
| L | `█` `███` | 4 |
| J | `  █` `███` | 4 |

Aunque algunas piezas tienen menos de 4 rotaciones geométricamente distintas, el algoritmo considera sistemáticamente las 4 rotaciones para todas las piezas. Las rotaciones inválidas (donde la pieza excede los límites del tablero) son descartadas por la función de gravedad `findDropY`.

### Restricciones formales

El problema se define sobre los siguientes parámetros fijos:

- **Tablero**: matriz $B$ de dimensiones $10 \times 20$, donde $B[x][y] \in \{0, 1\}$ (0 = vacía, 1 = ocupada).
- **Pieza actual**: $p_{\text{actual}} \in \{1, 2, 3, 4, 5, 6, 7\}$ (tipo de tetrominó).
- **Piezas futuras**: secuencia $[p_1, p_2, \ldots, p_N]$ de $N$ piezas siguientes.
- **Posiciones candidatas por nivel**: $10 \text{ columnas} \times 4 \text{ rotaciones} = 40$ posiciones.
- **Profundidad de look-ahead**: $N \in \{0, 1, 2, 3, 4, 5\}$ (parámetro configurable).

## Modelo matemático del algoritmo de búsqueda

### Función heurística

La función heurística evalúa la calidad de un tablero después de colocar una pieza. Se define como:

$$h(B) = \text{altura}_\text{máx}(B) + \text{huecos}(B)$$

donde:
- $\text{altura}_\text{máx}(B)$ es la menor fila $y$ (contada desde arriba) que contiene al menos una celda ocupada. Representa la altura de la pila más alta.
- $\text{huecos}(B)$ es el número de celdas vacías que tienen al menos una celda ocupada encima de ellas en la misma columna. Los huecos son estructuralmente problemáticos porque no pueden llenarse sin eliminar las líneas superiores.

Un valor menor de $h(B)$ indica una mejor posición del tablero. El algoritmo busca minimizar esta función.

#### Ejemplo visual

```
Tablero A (bueno):          Tablero B (malo):
+----------+                +----------+
| . . . . .|                | . . . . .|
| . . . . .|                | # . . . .|
| # . . . #|                | # # . . .|
| # # . . #|                | # # . . .|
+----------+                +----------+
 altura = 3                  altura = 3
 huecos = 2                  huecos = 3
 h(B) = 5                   h(B) = 6  ← PEOR
```

En el Tablero A, los huecos (celdas vacías bajo bloques) son 2 (columnas 2 y 3 en la fila inferior). En el Tablero B, la columna 2 tiene un hueco adicional bajo `# #`. La heurística prefiere el Tablero A porque presenta un menor valor combinado de altura y huecos.

### Simulación de gravedad: `findDropY`

Para cada posición candidata $(x, r)$ de una pieza $p$, el algoritmo simula la caída de la pieza por gravedad:

$$\text{findDropY}(B, p, r, x) = \max\{ y \in [0, 19] : \text{cabe}(B, p, r, x, y) \}$$

Si no existe $y$ válido (la pieza no cabe en ninguna fila), la función retorna $-1$ y la posición se descarta. Esto elimina un grado de libertad del problema (la altura), reduciendo el espacio de búsqueda de $10 \times 20 \times 4$ a $10 \times 4 = 40$ posiciones por nivel.

### Árbol de búsqueda exhaustiva

El algoritmo construye un árbol de búsqueda donde:

- **Cada nivel** corresponde a una pieza: la pieza actual (nivel 0) y las $N$ piezas siguientes.
- **Cada nodo** representa una posible colocación: $40$ hijos por nodo.
- **Cada hoja** (nivel $N$) se evalúa con la heurística $h(B)$.
- **La propagación** hacia arriba selecciona el mínimo en cada nivel (minimax sin oponente).

```
                              Pieza actual (nivel 0)
                              /       |        \
                    (x=0,r=0)  (x=0,r=1)  ...  (x=9,r=3)    ← 40 hijos
                       |           |              |
              1ra pieza futura             1ra pieza futura
              /   |   \                    /   |   \
        (0,0) (0,1) ... (9,3)      (0,0) (0,1) ... (9,3)    ← 40² nodos
          |                 |          |
    2da pieza         2da pieza                                ← 40³ nodos
    /   |   \         /   |   \
  ...  ...  ...     ...  ... ...
    |
  HOJA: evalúa h(B)                                      ← 40^(N+1) hojas
```

La propagación de resultados sigue el esquema:

$$\text{eval}(nodo) = \begin{cases}
h(B_{\text{final}}) & \text{si es hoja} \\
\displaystyle\min_{c \in \text{hijos}(nodo)} \text{eval}(c) & \text{si es nodo interno}
\end{cases}$$

La jugada óptima para la pieza actual es la que produce el menor valor de $\text{eval}$ entre los 40 hijos del nodo raíz:

$$\text{mejorJugada} = \arg\min_{i \in [0, 39]} \text{eval}(hijo_i)$$

## Pseudocódigo del solver secuencial

El algoritmo se implementa mediante dos funciones: `findBestMove` (punto de entrada) y `evaluarRecursivo` (evaluación recursiva del subárbol).

```
findBestMove(tablero B, pieza_actual p, piezas_futuras P, profundidad N):
    mejor_heuristica ← ∞
    mejor_x ← 0
    mejor_rot ← 0

    para cada columna x en [0, 9]:
        para cada rotación r en [0, 3]:
            y ← findDropY(B, p, r, x)
            si y < 0:    // La pieza no cabe
                continuar

            B' ← B.clonar()
            B'.colocar(p, r, x, y)
            B'.eliminarLineas()

            si N = 0:
                eval ← altura_máx(B') + huecos(B')
            sino:
                eval ← evaluarRecursivo(B', P[0], P, 1, N)

            si eval < mejor_heuristica:
                mejor_heuristica ← eval
                mejor_x ← x
                mejor_rot ← r

    retornar (mejor_x, mejor_rot)


evaluarRecursivo(tablero B, pieza p, piezas_futuras P,
                  profundidad d, profundidad_máx N):
    mejor ← ∞

    para cada columna x en [0, 9]:
        para cada rotación r en [0, 3]:
            y ← findDropY(B, p, r, x)
            si y < 0: continuar

            B' ← B.clonar()
            B'.colocar(p, r, x, y)
            B'.eliminarLineas()

            si d ≥ N:    // HOJA del árbol
                eval ← altura_máx(B') + huecos(B')
            sino:         // NODO INTERNO: recursión
                eval ← evaluarRecursivo(B', P[d], P, d+1, N)

            si eval < mejor:
                mejor ← eval

    retornar mejor
```

### Variables de entrada

| Variable | Tipo | Descripción |
|----------|------|-------------|
| $B$ | Matriz $10 \times 20$ | Estado actual del tablero |
| $p_{\text{actual}}$ | Enum $\{1..7\}$ | Tipo de la pieza actual |
| $P = [p_1, \ldots, p_N]$ | Arreglo de enums | Secuencia de piezas futuras |
| $N$ | Entero $\geq 0$ | Profundidad de *look-ahead* |

### Variables de salida

| Variable | Tipo | Descripción |
|----------|------|-------------|
| $\text{mejor}_x$ | Entero $[0, 9]$ | Columna óptima para la pieza actual |
| $\text{mejor}_r$ | Entero $[0, 3]$ | Rotación óptima para la pieza actual |

## Por qué es un problema de IA

El solver de Tetris comparte estructura fundamental con problemas clásicos de inteligencia artificial en teoría de juegos:

1. **Búsqueda en árbol con evaluación heurística**, al igual que Deep Blue para ajedrez [Campbell *et al.*, 2002], donde cada nodo expande posiciones candidatas y las evalúa con una función heurística.

2. **Factor de ramificación elevado** (40 posiciones por nivel), mayor que el ajedrez (~35 movimientos legales en promedio) y comparable a Go (~250 movimientos).

3. **Look-ahead como mecanismo de planificación**: la profundidad del análisis determina directamente la calidad de la decisión, pero cada nivel adicional multiplica el costo computacional por 40, creando una tensión fundamental entre calidad y viabilidad temporal.

4. **Naturaleza combinatoria**: el espacio de búsqueda crece exponencialmente, haciendo inviable la exploración secuencial para profundidades moderadas ($N \geq 3$) y motivando la paralelización como habilitador de mayor profundidad analítica.

La diferencia crucial con juegos adversariales como ajedrez es que Tetris no tiene oponente: el algoritmo minimiza directamente la heurística sin necesidad de maximizar alternadamente (*minimax*). Esto simplifica la estructura de propagación (solo mínimos) pero no reduce la complejidad: el factor de ramificación de 40 hace que incluso *look-ahead* de profundidad 3 requiera evaluar 2.56 millones de posiciones por decisión.