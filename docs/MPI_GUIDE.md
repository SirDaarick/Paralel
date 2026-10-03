# Guía MPI — paralel

> **Guía definitiva** para el solucionador MPI del proyecto paralel.  
> Cubre desde los conceptos teóricos hasta el despliegue en cluster real.

---

## Tabla de contenidos

1. [Introducción](#1-introducción)
2. [Cómo funciona la paralelización](#2-cómo-funciona-la-paralelización)
3. [Arquitectura del sistema](#3-arquitectura-del-sistema)
4. [Guía de instalación y ejecución](#4-guía-de-instalación-y-ejecución)
5. [Uso del frontend](#5-uso-del-frontend)
6. [Configuración avanzada](#6-configuración-avanzada)
7. [API Reference](#7-api-reference)
8. [Troubleshooting](#8-troubleshooting)
9. [Comparación de performance](#9-comparación-de-performance)
10. [Para desarrolladores](#10-para-desarrolladores)

---

## 1. Introducción

### Qué es MPI y por qué usarlo para Tetris

**MPI (Message Passing Interface)** es el estándar de facto para programación paralela distribuida. A diferencia de OpenMP (que paraleliza dentro de un solo proceso usando hilos) o CUDA (que usa miles de núcleos en una GPU), MPI permite distribuir trabajo entre **múltiples máquinas** conectadas por red.

En el contexto de paralel, el solver MPI demuestra un patrón fundamental de computación paralela: **distribución por dominio con reducción global**. Cada proceso MPI evalúa un subconjunto de las posiciones posibles y luego todos colaboran para encontrar el mínimo global.

### Comparación con OpenMP y CUDA

| Característica | Secuencial | OpenMP | CUDA | MPI |
|---|---|---|---|---|
| **Unidad de paralelismo** | — | Hilos CPU | Núcleos GPU | Procesos |
| **Memoria** | Compartida | Compartida | Dispositivo | Distribuida |
| **Escalabilidad** | 1 máquina | 1 máquina (sockets) | 1 GPU | N máquinas |
| **Comunicación** | — | Implícita | Implícita | Explícita (mensajes) |
| **Caso de uso** | Baseline | Servidor multicore | Workstation con GPU | Cluster / laboratorio |

### Cuándo usar MPI vs los otros algoritmos

- **MPI es ideal** cuando no hay GPU disponible pero tenés acceso a varias máquinas (laboratorio de cómputo, Raspberry Pis, VMs en la nube).
- **MPI es educativo** porque expone explícitamente la comunicación entre procesos — ves exactamente cuándo y cómo se sincronizan los ranks.
- **MPI tiene overhead** de comunicación que lo hace menos eficiente que CUDA para lookahead bajo, pero escala linealmente con más nodos.

> 💡 **Regla práctica**: usá MPI cuando querés demostrar paralelismo distribuido o cuando no tenés GPU. Usá CUDA cuando busques máximo rendimiento en una sola máquina.

---

## 2. Cómo funciona la paralelización

### Patrón de distribución por primer nivel

El solver MPI paraleliza la **búsqueda del mejor movimiento** para cada pieza. Para una pieza dada, hay **40 posiciones posibles** a evaluar:

```
10 columnas × 4 rotaciones = 40 combinaciones
```

En lugar de evaluar las 40 posiciones secuencialmente, MPI las **reparte entre los ranks disponibles** usando un patrón de stride (salto):

```
Rank 0 evalúa: posiciones 0, 4, 8, 12, 16, 20, 24, 28, 32, 36
Rank 1 evalúa: posiciones 1, 5, 9, 13, 17, 21, 25, 29, 33, 37
Rank 2 evalúa: posiciones 2, 6, 10, 14, 18, 22, 26, 30, 34, 38
Rank 3 evalúa: posiciones 3, 7, 11, 15, 19, 23, 27, 31, 35, 39
```

> ℹ️ El stride garantiza **balance de carga perfecto**: cada rank evalúa exactamente `40 / worldSize` posiciones (o `40 / worldSize + 1` si no es divisible).

### MPI_Allreduce por cada decisión

Después de que cada rank encuentra su mejor posición local, se ejecuta una **reducción global** con `MPI_Allreduce` usando `MPI_MINLOC`:

```
┌──────────────────────────────────────────────────────┐
│                   MPI_Allreduce                       │
│                                                       │
│  Rank 0: (score=15, index=8)  ─┐                     │
│  Rank 1: (score=12, index=5)  ─┤                     │
│  Rank 2: (score=18, index=22) ─┼──► (score=12, idx=5)│
│  Rank 3: (score=20, index=31) ─┘                     │
│                                                       │
│  MINLOC: devuelve el par (score, index) del mínimo    │
│  Todos los ranks reciben el resultado global          │
└──────────────────────────────────────────────────────┘
```

`MPI_2INT` + `MPI_MINLOC` es una operación atómica que encuentra el mínimo score y preserva el índice asociado — exactamente lo que necesitamos para saber qué posición (columna + rotación) ganó.

### Sincronización implícita (misma seed)

Todos los ranks generan la **misma secuencia de piezas** porque comparten el seed:

1. Si el usuario provee `--seed`, todos lo usan directamente.
2. Si no, rank 0 genera un seed aleatorio y lo broadcastea con `MPI_Bcast`.

Esto es crucial: como todos los ranks ven las mismas piezas en el mismo orden, pueden trabajar en paralelo sin necesidad de comunicarse el estado del tablero.

### Diagrama de flujo completo

```
                    ┌─────────────┐
                    │  mpirun -np │
                    │   N ranks   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ Rank 0 │  │ Rank 1 │  │ Rank N │
         └───┬────┘  └───┬────┘  └───┬────┘
             │           │           │
     ┌───────┴───────────┴───────────┴───────┐
     │  1. MPI_Bcast(seed) — todos comparten  │
     │     la misma secuencia de piezas       │
     └───────┬───────────┬───────────┬───────┘
             │           │           │
     ┌───────┴───────────┴───────────┴───────┐
     │  2. Para cada pieza:                   │
     │     a. Cada rank evalúa posiciones     │
     │        donde (idx % worldSize) == rank │
     │     b. MPI_Allreduce(MINLOC)           │
     │     c. Todos conocen la mejor posición │
     │     d. Todos colocan la pieza          │
     │        (tablero idéntico en cada rank) │
     └───────┬───────────┬───────────┬───────┘
             │           │           │
     ┌───────┴───────────┴───────────┴───────┐
     │  3. Rank 0 serializa el replay a JSON  │
     │     y lo imprime por stdout            │
     └───────────────────┬───────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  JSON replay por    │
              │  stdout → servidor  │
              └─────────────────────┘
```

---

## 3. Arquitectura del sistema

### Binario standalone `paralel-mpi-solver`

El solver MPI se compila como un **binario independiente** (`paralel-mpi-solver`) que:

- Se ejecuta exclusivamente bajo `mpirun`
- Recibe parámetros por CLI: `--lookahead`, `--seed`, `--pieces-count`
- Imprime el resultado como JSON por stdout
- No tiene dependencias de red ni HTTP

```bash
mpirun -np 4 ./paralel-mpi-solver --lookahead 2 --seed 42
# → {"algorithm":"mpi","finalScore":1250,"totalPieces":200,...}
```

### Servidor HTTP (sin MPI) spawnea mpirun

El servidor HTTP (`paralel-server`) **NO** se ejecuta dentro de un entorno MPI. En su lugar:

1. Recibe una petición `POST /api/simular-mpi`
2. Construye un comando `mpirun` con los parámetros adecuados
3. Lo ejecuta con `popen()` y captura stdout
4. Parsea el JSON resultante

```
┌──────────────────────────────────────────────────────┐
│                  paralel-server                       │
│                  (proceso normal)                     │
│                                                       │
│  POST /api/simular-mpi                                │
│       │                                               │
│       ▼                                               │
│  popen("mpirun -np 4 ./paralel-mpi-solver ...")       │
│       │                                               │
│       ├──► stdout → JSON replay                       │
│       │                                               │
│       ▼                                               │
│  Parse JSON → ReplayData → almacenar en MpiSimState   │
│                                                       │
│  GET /api/simular-mpi/{id}/status → progreso          │
│  GET /api/simular-mpi/{id}/resultados → replays       │
└──────────────────────────────────────────────────────┘
```

> ⚠️ **Importante**: el servidor HTTP no necesita ser compilado con MPI. Solo necesita que `mpirun` y `paralel-mpi-solver` estén disponibles en el PATH.

### Comunicación por stdout

La comunicación entre el solver MPI y el servidor HTTP es **unidireccional por stdout**. El solver imprime un único JSON object al completar la simulación. El servidor lo parsea con un parser JSON hand-rolled (sin dependencias externas).

### Frontend con modo dual

El frontend ofrece dos modos de simulación:

- **Modo Clásico**: ejecuta secuencial → OpenMP → CUDA (3 algoritmos en serie)
- **Modo MPI vs CUDA**: ejecuta MPI (vía mpirun) y luego CUDA local con la misma seed, para comparación directa

---

## 4. Guía de instalación y ejecución

### Opción A: Docker (recomendado para demo)

La forma más rápida de probar MPI sin instalar nada en el host.

**Requisitos:**
- Docker ≥ 24
- Sin dependencia de CUDA ni MPI en el host

#### Single-container (todo local)

```bash
# Construir la imagen
docker build -t paralel .

# Ejecutar con 4 ranks MPI (default)
docker run --rm -p 8080:8080 paralel

# Con más ranks
docker run --rm -p 8080:8080 -e MPI_PROCESSES=8 paralel
```

Abrí `http://localhost:8080` en el navegador. El endpoint `/api/health` mostrará `"mpi": true`.

#### Docker Compose (multi-contenedor)

Simula un cluster con master + workers en contenedores separados:

```bash
# Iniciar con 2 workers (default)
docker compose up

# Escalar a 4 workers
docker compose up --scale worker=4
```

El compose levanta:
- `paralel-master`: servidor HTTP + ranks MPI locales
- `paralel-worker1`, `paralel-worker2`: solo SSH daemon para recibir ranks MPI

Todos conectados por la red bridge `mpi-net`.

#### Verificar manualmente dentro del contenedor

```bash
docker exec -it paralel-master \
  mpirun --allow-run-as-root -np 4 \
  ./paralel-mpi-solver --lookahead 2 --seed 42
```

---

### Opción B: Compilación nativa (para cluster real)

Para aulas con Raspberry Pi, laboratorios con VMs, o clusters reales.

**Requisitos:**
- g++ con soporte C++17
- OpenMPI ≥ 4.0 (`mpicxx` y `mpirun` en PATH)
- SSH sin contraseña del master a todos los workers

#### Paso 1: Compilar

```bash
cd backend
make          # Construye paralel-server + paralel-mpi-solver
make info     # Verifica: "MPI available: 1"
```

#### Paso 2: Configurar hostfile

Copiá `backend/mpi-hosts` y personalizalo con los hostnames de tu cluster:

```
node01 slots=4
node02 slots=4
node03 slots=4
```

#### Paso 3: Sincronizar binarios

```bash
for node in node01 node02 node03; do
    scp -r build/ pi@$node:~/paralel/build/
done
```

> ⚠️ Los binarios deben estar en el **mismo path absoluto** en todos los nodos.

#### Paso 4: Probar MPI standalone

```bash
mpirun --hostfile mpi-hosts -np 12 \
  ./build/paralel-mpi-solver --lookahead 2 --seed 42
```

Deberías ver un JSON replay en stdout.

#### Paso 5: Iniciar el servidor

```bash
export MPI_SOLVER_PATH=./build/paralel-mpi-solver
export MPI_HOSTS=./mpi-hosts
export MPI_PROCESSES=12

./build/paralel-server
```

#### Paso 6: Verificar

```bash
curl http://localhost:8080/api/health
# → {"openmp": true, "ompThreads": 8, "cuda": false, "mpi": true, "mpiProcesses": 4}
```

---

### Opción C: Desarrollo local

Para trabajar en el código con hot-reload en el frontend.

**Requisitos:**
- Todo lo de la Opción B (g++, OpenMPI)
- Node.js ≥ 18

```bash
# Terminal 1: backend
cd backend && make run

# Terminal 2: frontend (proxy a :8080)
cd frontend && npm run dev
```

El frontend en `http://localhost:5173` hace proxy de `/api/*` al backend en `:8080` vía la configuración de Vite.

---

## 5. Uso del frontend

### Menú principal: toggle de modo

El menú principal muestra un **toggle de modo de simulación** cuando MPI está disponible:

```
┌─────────────────────────┐
│  MODO DE SIMULACION     │
└─────────────────────────┘

  [ CLÁSICO ]    [ MPI vs CUDA ]
```

- **CLÁSICO**: ejecuta la simulación tradicional (Secuencial → OpenMP → CUDA)
- **MPI vs CUDA**: ejecuta MPI y CUDA con la misma seed para comparación directa

> ℹ️ Si MPI no está disponible en el servidor (`/api/health` → `"mpi": false`), el botón "MPI vs CUDA" aparece deshabilitado con un tooltip explicativo.

### Configuración

El control de **Look-ahead** (1-5) funciona igual en ambos modos. Mayor valor = decisiones más inteligentes pero más lentas.

### Simulación

En modo MPI, la pantalla de simulación muestra **2 paneles lado a lado**:

- **Panel izquierdo**: replay del solver MPI (naranja `#ffaa00`)
- **Panel derecho**: replay del solver CUDA (cyan `#00ffff`)

Ambos replays usan la **misma secuencia de piezas** (mismo seed), lo que garantiza una comparación justa.

### Resultados

Al completar la simulación se muestra:

- **Tabla comparativa**: score final, piezas jugadas, tiempo total, líneas limpiadas
- **Gráfico de speedup**: tiempo MPI vs tiempo CUDA
- **Replay interactivo**: podés avanzar/retroceder pieza por pieza

### Historial

Las simulaciones completadas se guardan en `localStorage` (clave: `paralel_history`, máximo 10 entradas) y son accesibles desde el menú principal.

---

## 6. Configuración avanzada

### Variables de entorno Docker

| Variable | Default | Descripción |
|---|---|---|
| `MPI_PROCESSES` | `4` | Número de ranks MPI (`-np` en mpirun) |
| `MPI_HOSTS` | *(vacío)* | Path a hostfile para MPI distribuido |
| `HTTP_PORT` | `8080` | Puerto del servidor HTTP |
| `MPI_SOLVER_PATH` | `./paralel-mpi-solver` | Path al binario MPI solver |

### Variables de entorno del servidor

Las mismas variables aplican cuando ejecutás `paralel-server` directamente:

```bash
export MPI_SOLVER_PATH=./build/paralel-mpi-solver
export MPI_HOSTS=./mpi-hosts
export MPI_PROCESSES=12
./build/paralel-server
```

### Formato del hostfile

```
# Comentarios con #
hostname1 slots=4
hostname2 slots=4
hostname3 slots=8
```

- **hostname**: debe ser reachable por SSH desde el master
- **slots**: máximo de ranks MPI en esa máquina (generalmente = número de cores)

### SSH passwordless para multi-nodo

```bash
# En el master
ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
ssh-copy-id user@node01   # Repetir para cada worker
```

### Firewall rules para MPI

OpenMPI usa puertos dinámicos para comunicación entre ranks. En un cluster con firewall:

```bash
# Permitir todo el tráfico entre nodos del cluster
sudo ufw allow from 192.168.1.0/24
# O específicamente los rangos de puertos MPI
sudo ufw allow 1024:65535/tcp
```

> 💡 En redes aisladas (laboratorio), lo más simple es deshabilitar el firewall entre nodos internos.

---

## 7. API Reference

### Endpoints MPI

#### `GET /api/health`

Devuelve la disponibilidad de cada tecnología, incluyendo MPI.

**Respuesta:**

```json
{
  "openmp": true,
  "ompThreads": 8,
  "cuda": false,
  "mpi": true,
  "mpiProcesses": 4
}
```

#### `POST /api/simular-mpi`

Inicia una simulación MPI vs CUDA con la misma seed.

**Body:**

```json
{
  "lookAhead": 2
}
```

**Respuesta:**

```json
{
  "simulationId": "mpi-1a2b3c4d-0"
}
```

#### `GET /api/simular-mpi/{id}/status`

Devuelve el progreso de la simulación MPI.

**Respuesta:**

```json
{
  "status": "running",
  "progress": 50,
  "currentAlgorithm": "mpi"
}
```

**Estados posibles:**

| `status` | `progress` | `currentAlgorithm` | Significado |
|---|---|---|---|
| `running` | 0-10 | `mpi` | Inicializando mpirun |
| `running` | 10-50 | `mpi` | Solver MPI ejecutando |
| `running` | 50-60 | `cuda` | Transición a CUDA |
| `running` | 60-100 | `cuda` | Solver CUDA ejecutando |
| `completed` | 100 | `done` | Ambos completados |
| `failed` | — | — | Error (ver errorMessage) |

#### `GET /api/simular-mpi/{id}/resultados`

Devuelve los replays de ambos algoritmos.

**Respuesta:**

```json
{
  "replays": [
    {
      "algorithm": "mpi",
      "finalScore": 1250,
      "totalPieces": 200,
      "totalTimeMs": 8432.5,
      "moves": [
        {
          "pieceType": 3,
          "rotation": 1,
          "x": 4,
          "dropY": 18,
          "decisionTimeMs": 12.3,
          "linesCleared": 0
        }
      ]
    },
    {
      "algorithm": "cuda",
      "finalScore": 1250,
      "totalPieces": 200,
      "totalTimeMs": 2100.8,
      "moves": [...]
    }
  ]
}
```

> ℹ️ Si CUDA no está disponible (`USE_CUDA` no definido), el array `replays` contiene solo el resultado MPI.

### Formato de ReplayMove

| Campo | Tipo | Descripción |
|---|---|---|
| `pieceType` | `int` (1-7) | Tipo de pieza (I=1, O=2, T=3, S=4, Z=5, J=6, L=7) |
| `rotation` | `int` (0-3) | Rotación aplicada |
| `x` | `int` (0-9) | Columna de colocación |
| `dropY` | `int` | Fila donde cayó la pieza |
| `decisionTimeMs` | `float` | Tiempo de cómputo para esta decisión |
| `linesCleared` | `int` | Líneas eliminadas con esta pieza |

---

## 8. Troubleshooting

### "mpirun not found" o "command not found"

**Causa**: OpenMPI no está instalado o no está en el PATH.

**Solución:**

```bash
# Ubuntu/Debian
sudo apt install libopenmpi-dev openmpi-bin

# macOS
brew install open-mpi

# Verificar
which mpirun
which mpicxx
```

### "MPI_Init failed"

**Causa**: el binario `paralel-mpi-solver` se ejecutó directamente en lugar de bajo `mpirun`.

**Solución**: siempre ejecutar con `mpirun`:

```bash
# ✗ Incorrecto
./paralel-mpi-solver --lookahead 2

# ✓ Correcto
mpirun -np 4 ./paralel-mpi-solver --lookahead 2
```

### Docker: "permission denied"

**Causa**: el usuario no tiene permisos para ejecutar Docker.

**Solución:**

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Docker: "mpirun exited with code 1"

**Causa**: el contenedor necesita `--allow-run-as-root` porque corre como root.

**Solución**: ya está incluido en el comando que genera el servidor. Si ejecutás manualmente:

```bash
mpirun --allow-run-as-root -np 4 ./paralel-mpi-solver --lookahead 2 --seed 42
```

### Multi-nodo: SSH timeout o "Permission denied (publickey)"

**Causa**: SSH sin contraseña no está configurado del master a los workers.

**Solución:**

```bash
# En el master
ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
ssh-copy-id user@node01
ssh-copy-id user@node02
# Verificar
ssh user@node01 "hostname"
```

### Multi-nodo: "mpirun was unable to find the specified executable"

**Causa**: el binario `paralel-mpi-solver` no existe en el mismo path en los workers.

**Solución**: sincronizar binarios a todos los nodos:

```bash
for node in node01 node02 node03; do
    scp -r build/ user@$node:~/paralel/build/
done
```

### Frontend no conecta con el backend

**Causa**: el proxy de Vite no está configurado o el backend no está corriendo.

**Solución:**

```bash
# Verificar que el backend responde
curl http://localhost:8080/api/health

# Verificar vite.config.ts tiene el proxy
# server.proxy: { "/api": "http://localhost:8080" }

# Reiniciar frontend
cd frontend && npm run dev
```

### "mpi: false" en /api/health

**Causa**: el servidor fue compilado sin soporte MPI (`USE_MPI` no definido).

**Solución**: verificar que `mpicxx` está en el PATH al compilar:

```bash
cd backend
make clean
make info     # Debe mostrar "MPI available: 1"
make
```

### Tests fallan

```bash
cd backend && make test
```

Si los tests de MPI fallan, verificá que `mpicxx` esté disponible. Los tests se compilan condicionalmente cuando MPI está detectado.

---

## 9. Comparación de performance

### Speedup esperado

| Ranks MPI | Speedup teórico | Speedup real | Overhead |
|---|---|---|---|
| 1 | 1.0x | 1.0x | — |
| 2 | 2.0x | ~1.8x | ~10% |
| 4 | 4.0x | ~3.5x | ~12% |
| 8 | 8.0x | ~6.5x | ~19% |
| 16 | 16.0x | ~11x | ~31% |

> ℹ️ Valores estimados para lookahead=2 en hardware homogéneo. El overhead crece con más ranks porque `MPI_Allreduce` se ejecuta **por cada pieza** (200 veces por simulación).

### Overhead de comunicación

- **Por pieza**: 1 llamada a `MPI_Allreduce` con `MPI_2INT` (~8 bytes de datos útiles)
- **Por simulación**: 200 llamadas a `MPI_Allreduce` (para 200 piezas)
- **Latencia dominante**: no es el volumen de datos sino la latencia de red en cada reducción

### Cuándo MPI supera a CUDA

| Escenario | Ganador | Razón |
|---|---|---|
| Lookahead alto (4-5) + sin GPU | **MPI** | El árbol de búsqueda es tan grande que la distribución compensa el overhead |
| Lookahead bajo (1-2) + GPU | **CUDA** | Miles de cores GPU evalúan en paralelo sin overhead de red |
| Cluster de 8+ nodos | **MPI** | Escalamiento horizontal que CUDA no puede igualar en una sola GPU |
| Máquina sin GPU | **MPI** | Única opción de paralelismo real más allá de OpenMP |

### Limitaciones

- **Máximo 40 work units**: el primer nivel tiene solo 40 posiciones (10 × 4). Con más de 40 ranks, algunos quedan ociosos.
- **No paraleliza la recursión**: solo distribuye el primer nivel del árbol de búsqueda. Los niveles más profundos se evalúan secuencialmente dentro de cada rank.
- **Sincronización por pieza**: cada decisión requiere un `MPI_Allreduce`, lo que limita la eficiencia en redes de alta latencia.

---

## 10. Para desarrolladores

### Estructura de archivos MPI

```
backend/
├── src/
│   ├── tetris/
│   │   ├── solver.h              # Clase base BruteForceSolver
│   │   ├── solver.cpp            # Implementación secuencial
│   │   ├── solver_omp.cpp        # Paralelización OpenMP
│   │   ├── solver_mpi.h          # Declaración BruteForceSolverMPI
│   │   ├── solver_mpi.cpp        # Implementación MPI (stride + Allreduce)
│   │   └── solver_cuda.cu        # Kernel CUDA
│   ├── mpi_solver_main.cpp       # main() del binario standalone MPI
│   └── main.cpp                  # Servidor HTTP + endpoints MPI
├── mpi-hosts                     # Template de hostfile
├── Makefile                      # Build con auto-detección MPI
└── build/
    ├── paralel-server            # Servidor HTTP
    └── paralel-mpi-solver        # Binario MPI standalone

frontend/
├── src/
│   ├── hooks/
│   │   ├── useMpiSimulation.ts   # Hook para simulación MPI
│   │   └── api-types.ts          # Tipos TypeScript (MpiSimulationResult, etc.)
│   └── components/
│       └── MenuPage.tsx          # Toggle de modo Clásico/MPI

docker/
├── Dockerfile                    # Multi-stage build
├── docker-compose.yml            # Master + workers
└── docker-entrypoint.sh          # sshd + server
```

### Cómo agregar un nuevo solver

1. **Crear el header** en `backend/src/tetris/solver_nuevo.h`:

```cpp
#pragma once
#include "solver.h"

class BruteForceSolverNuevo : public BruteForceSolver {
public:
    SearchResult findBestMove(const Board& board, PieceType current,
                              const std::vector<PieceType>& upcoming,
                              int lookAhead) override;
};
```

2. **Implementar** en `backend/src/tetris/solver_nuevo.cpp`:

```cpp
#include "solver_nuevo.h"

SearchResult BruteForceSolverNuevo::findBestMove(
    const Board& board, PieceType current,
    const std::vector<PieceType>& upcoming, int lookAhead)
{
    // Tu lógica de paralelización aquí
    // Podés usar findDropY() y evaluateRecursive() de la clase base
}
```

3. **Agregar al Makefile** como target o fuente condicional.

4. **Integrar en el servidor** (`main.cpp`) siguiendo el patrón de `runMpiSimulation()`.

### Cómo extender el frontend para más algoritmos

1. **Agregar metadata** en `frontend/src/hooks/api-types.ts`:

```typescript
export const ALGO_META: Record<string, { label: string; color: string }> = {
  seq:  { label: "SECUENCIAL",   color: "#ff3333" },
  omp:  { label: "OpenMP (CPU)", color: "#00ff00" },
  cuda: { label: "CUDA (GPU)",   color: "#00ffff" },
  mpi:  { label: "MPI",          color: "#ffaa00" },
  nuevo: { label: "NUEVO",       color: "#ff00ff" },  // ← nuevo
};

export const ALGO_ORDER = ["seq", "omp", "mpi", "nuevo", "cuda"];
```

2. **Crear un hook** similar a `useMpiSimulation.ts` que haga polling al endpoint correspondiente.

3. **Agregar un modo** al toggle en `MenuPage.tsx` o crear un selector más granular.

### Testing

```bash
# Backend (C++ tests con framework custom)
cd backend && make test

# Frontend (lint + typecheck)
cd frontend && npm run lint
cd frontend && npm run build   # incluye tsc -b
```

> ℹ️ No hay tests de frontend automatizados. El typecheck de TypeScript (`tsc -b`) con `noUnusedLocals` y `noUnusedParameters` actúa como validación estática.

### Convenciones del proyecto

- **JSON hand-rolled**: no se usa ninguna librería JSON (ni en backend ni en el solver MPI). Toda la serialización es concatenación de strings.
- **`verbatimModuleSyntax`**: en el frontend, usar `import type` para imports solo de tipos.
- **Sin comentarios innecesarios**: el código debe ser auto-explicativo.
- **Documentación en español**: toda la documentación y texto de UI está en español.
