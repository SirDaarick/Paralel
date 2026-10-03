# Container Deployment Specification

## Purpose

Defines how the paralel project ships inside Docker containers for zero-friction MPI deployment. Covers the single-container demo (local ranks), the multi-service compose stack (master + workers on a bridge network), the `mpi-hosts` template, and the entrypoint script that translates configuration into the correct `mpirun` invocation.

## Requirements

### Requirement: Multi-Stage Dockerfile

The project SHALL provide a Dockerfile with a multi-stage build: a build stage that compiles both the `paralel-server` and `paralel-mpi-solver` binaries, and a runtime stage that copies only the compiled artifacts plus required runtime libraries (OpenMPI runtime, CUDA runtime if available).

#### Scenario: Image builds both binaries

- GIVEN the Dockerfile is present at the repository root
- WHEN the user runs `docker build -t paralel .`
- THEN the build SHALL succeed without errors
- AND the image SHALL contain `/app/paralel-server` and `/app/paralel-mpi-solver` executables
- AND the runtime stage SHALL be substantially smaller than the build stage (no compilers, no headers)

#### Scenario: Build without OpenMPI does not fail

- GIVEN OpenMPI is unavailable in the build environment
- WHEN the user runs `docker build -t paralel .`
- THEN the build SHALL still succeed (MPI target skipped, server target still built)
- AND the resulting image SHALL NOT include `paralel-mpi-solver`

### Requirement: Single-Container Demo

The image SHALL support `docker run` as a self-contained demo that spawns multiple local MPI ranks (default 4) inside a single container, then launches the HTTP server bound to port 8080.

#### Scenario: Running the demo container

- GIVEN the image has been built
- WHEN the user runs `docker run --rm -p 8080:8080 paralel`
- THEN the container SHALL start `mpirun` with `--np 4` against the local binary
- AND the HTTP server SHALL listen on port 8080 inside the container
- AND the demo SHALL be reachable at `http://localhost:8080` from the host

#### Scenario: Overriding the process count

- GIVEN the user wants a different number of local ranks
- WHEN the user runs `docker run --rm -p 8080:8080 -e MPI_PROCESSES=8 paralel`
- THEN the entrypoint SHALL spawn exactly 8 MPI ranks
- AND `/api/health` SHALL report `mpiProcesses: 8`

### Requirement: Compose Stack with Master and Workers

The project SHALL provide a `docker-compose.yml` that defines a multi-service stack: a master service running the HTTP server, and N worker services providing additional MPI ranks. All services SHALL share a user-defined bridge network so that `mpirun --hostfile` resolves worker hostnames.

#### Scenario: Stack comes up

- GIVEN `docker-compose.yml` defines a master and 2 workers
- WHEN the user runs `docker compose up`
- THEN all services SHALL reach a healthy state
- AND the master SHALL be reachable on the published port
- AND `mpirun` from inside the master SHALL successfully connect to the workers via hostname

#### Scenario: Scaling workers

- GIVEN the compose stack is running
- WHEN the user runs `docker compose up --scale worker=4`
- THEN the additional worker containers SHALL join the same network
- AND subsequent MPI simulations SHALL distribute across all available workers
- AND `/api/health` SHALL reflect the new process count

### Requirement: Entrypoint Script

The image SHALL include an `entrypoint.sh` script that:
- Reads `MPI_PROCESSES` (default 4) and `MPI_HOSTS` (optional) environment variables
- Constructs the appropriate `mpirun` invocation (local-only for `docker run`, `--hostfile` for compose and external clusters)
- Starts the HTTP server in the foreground after MPI ranks are ready

#### Scenario: Entrypoint without hostfile uses local ranks

- GIVEN `MPI_HOSTS` is unset or empty
- WHEN the container starts
- THEN the entrypoint SHALL invoke `mpirun --np ${MPI_PROCESSES} ./paralel-mpi-solver` for each simulation
- AND the server SHALL start in the foreground

#### Scenario: Entrypoint with hostfile uses distributed ranks

- GIVEN `MPI_HOSTS=/etc/mpi/hosts` is set and the file lists multiple hostnames
- WHEN the container starts
- THEN the entrypoint SHALL invoke `mpirun --hostfile ${MPI_HOSTS} -np <total> ./paralel-mpi-solver`
- AND each host in the file SHALL receive a share of the ranks

### Requirement: Hostfile Template and Cluster Documentation

The project SHALL provide a `backend/mpi-hosts` template (one hostname per line, slots suffix optional) and a `docs/MPI_SETUP.md` document covering the three deployment paths: (1) `docker run` single container, (2) `docker compose` multi-service, and (3) native `mpirun --hostfile` on real multi-machine clusters.

#### Scenario: Hostfile template is valid

- GIVEN `backend/mpi-hosts` is provided
- WHEN the user copies it to a cluster and runs `mpirun --hostfile mpi-hosts -np <total> ./paralel-mpi-solver`
- THEN the command SHALL parse without errors
- AND each line SHALL be interpreted as either `hostname` or `hostname slots=N`

#### Scenario: Documentation covers all three paths

- GIVEN `docs/MPI_SETUP.md` is published
- WHEN a reader consults it for any of the three deployment paths
- THEN the document SHALL include step-by-step instructions for that path
- AND SHALL note passwordless SSH as a prerequisite for the native cluster path only

### Requirement: Environment Configuration

The deployment SHALL expose at least these environment variables: `MPI_PROCESSES` (int, default 4), `MPI_HOSTS` (path, optional), and `HTTP_PORT` (int, default 8080). Changes to these variables SHALL take effect on container restart without image rebuild.

#### Scenario: Default values work out of the box

- GIVEN no environment variables are set
- WHEN the container starts
- THEN the system SHALL use defaults: `MPI_PROCESSES=4`, `HTTP_PORT=8080`
- AND the server SHALL be reachable on port 8080

#### Scenario: Custom port does not require rebuild

- GIVEN the user sets `HTTP_PORT=9090`
- WHEN the container starts
- THEN the server SHALL listen on port 9090
- AND no image rebuild SHALL be necessary
