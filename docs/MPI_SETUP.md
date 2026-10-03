# MPI Setup Guide — paralel

Este documento cubre tres formas de ejecutar el solucionador MPI de paralel:
1. **Docker single-container** (demo local, la más rápida)
2. **Docker Compose** (multi-servicio en una máquina)
3. **Cluster nativo** (múltiples máquinas reales con `mpirun --hostfile`)

---

## 1. Demo Single-Container (Docker)

La forma más simple. Todo corre en un solo contenedor con 4 ranks MPI locales.

### Requisitos
- Docker ≥ 24
- Sin dependencia de CUDA en el host

### Pasos

```bash
# Construir la imagen
docker build -t paralel .

# Ejecutar con 4 ranks MPI (default)
docker run --rm -p 8080:8080 paralel

# O con más ranks (ej. 8)
docker run --rm -p 8080:8080 -e MPI_PROCESSES=8 paralel
```

Abrí `http://localhost:8080` en el navegador. El endpoint `/api/health` mostrará `"mpi": true`.

### Verificar manualmente

```bash
# Dentro del contenedor
docker exec -it paralel-master mpirun --allow-run-as-root -np 4 ./paralel-mpi-solver --lookahead 2 --seed 42
```

---

## 2. Docker Compose (Multi-Servicio)

Ejecuta un master + N workers en contenedores separados comunicados por SSH.

### Requisitos
- Docker ≥ 24 + Compose v2

### Pasos

```bash
# Iniciar con 2 workers (default)
docker compose up

# Escalar a 4 workers
docker compose up --scale worker=4
```

### Configuración del hostfile

El archivo `backend/mpi-hosts` dentro del contenedor debe reflejar los nombres de los servicios:

```
master slots=2
worker1 slots=2
worker2 slots=2
```

> **Nota**: Para entornos compose multi-servicio, asegurate de que el `mpi-hosts` liste los hostnames correctos (nombres de servicio en compose). Si escalás los workers, ajustá el hostfile.

### Variables de entorno en Compose

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MPI_PROCESSES` | 6 | Total de ranks MPI a usar con `-np` |
| `MPI_HOSTS` | `/etc/mpi/hosts` | Ruta al archivo de hosts |
| `HTTP_PORT` | 8080 | Puerto del servidor web |
| `MPI_SOLVER_PATH` | `./paralel-mpi-solver` | Ruta al binario MPI |

---

## 3. Cluster Nativo (Multi-Máquina)

Para aulas con Raspberry Pi, laboratorios con VMs, o clusters reales. Esta opción **no usa Docker** — compilás los binarios en cada nodo y usás `mpirun --hostfile`.

### Requisitos
- OpenMPI ≥ 4.0 instalado en **todos** los nodos
- **SSH sin contraseña** del nodo master a todos los workers
- Los binarios `paralel-server` y `paralel-mpi-solver` deben existir en el **mismo path** en todos los nodos (ej. `/home/pi/paralel/build/`)

### Paso 1: Compilar en el master

```bash
cd backend
make          # Construye paralel-server + paralel-mpi-solver
make info     # Verifica que MPI esté detectado: "MPI available: 1"
```

### Paso 2: Sincronizar binarios a los workers

```bash
# Copiar el directorio build/ a cada worker
for node in node01 node02 node03; do
    scp -r build/ pi@$node:~/paralel/build/
done
```

### Paso 3: Configurar hostfile

Copiá `backend/mpi-hosts` y editalo con los hostnames de tu cluster:

```
node01 slots=4
node02 slots=4
node03 slots=4
```

### Paso 4: Probar MPI

```bash
mpirun --hostfile mpi-hosts -np 12 ./build/paralel-mpi-solver --lookahead 2 --seed 42
```

Deberías ver un JSON replay en stdout.

### Paso 5: Iniciar el servidor

```bash
# Configurar variables de entorno
export MPI_SOLVER_PATH=./build/paralel-mpi-solver
export MPI_HOSTS=./mpi-hosts
export MPI_PROCESSES=12

./build/paralel-server
```

El servidor usará automáticamente `mpirun --hostfile` con la configuración que estableciste.

### Paso 6: Verificar

```bash
curl http://localhost:8080/api/health
# → {"openmp": true, "ompThreads": 8, "cuda": false, "mpi": true, "mpiProcesses": 12}
```

---

## Solución de problemas

### "mpirun was unable to find the specified executable"

El binario `paralel-mpi-solver` no existe en el path esperado en los workers. Verificá que:
- El binario esté compilado (`make info` debe mostrar `MPI available: 1`)
- El path sea el mismo en todos los nodos
- La variable `MPI_SOLVER_PATH` apunte al binario correcto

### "Permission denied (publickey)"

SSH sin contraseña no está configurado. En el master:

```bash
ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
ssh-copy-id pi@node01   # Repetir para cada worker
```

### "mpi: false" en /api/health

OpenMPI no está instalado o `mpicxx` no está en el PATH. Verificá:

```bash
which mpicxx
which mpirun
```

En Ubuntu/Debian: `sudo apt install libopenmpi-dev openmpi-bin`

### Docker: los workers no se conectan

Asegurate de que:
- El hostfile en el contenedor use los nombres de servicio de compose (`master`, `worker1`, `worker2`)
- Todos los servicios estén en la misma red bridge (`mpi-net`)
- Los workers tengan `sshd` corriendo (comando `["/usr/sbin/sshd", "-D"]`)

---

## Referencia rápida de endpoints MPI

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/simular-mpi` | Inicia simulación MPI-vs-CUDA. Body: `{"lookAhead": 1-5}` |
| `GET` | `/api/simular-mpi/{id}/status` | Estado y progreso de la simulación |
| `GET` | `/api/simular-mpi/{id}/resultados` | Resultados: replays MPI + CUDA |

La simulación clásica (seq/OMP/CUDA) sigue funcionando sin cambios en `POST /api/simular`.
