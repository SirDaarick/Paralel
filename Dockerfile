# paralel — MPI + CUDA Tetris comparison
# Multi-stage Docker build: builder compiles, runtime ships only binaries + OpenMPI
#
# Stage 1: Build
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y \
    g++ \
    make \
    libopenmpi-dev \
    openmpi-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/ ./backend/

# Build both paralel-server and paralel-mpi-solver (auto-detected via mpicxx)
RUN cd backend && make

# Stage 2: Runtime (no compilers, no headers — minimal image)
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libopenmpi-dev \
    openmpi-bin \
    openssh-server \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH for passwordless MPI interconnect
RUN mkdir -p /var/run/sshd && \
    ssh-keygen -A && \
    mkdir -p /root/.ssh && \
    ssh-keygen -t rsa -N "" -f /root/.ssh/id_rsa && \
    cp /root/.ssh/id_rsa.pub /root/.ssh/authorized_keys && \
    echo "StrictHostKeyChecking no" >> /etc/ssh/ssh_config && \
    echo "UserKnownHostsFile /dev/null" >> /etc/ssh/ssh_config

WORKDIR /app

# Copy compiled binaries from builder
COPY --from=builder /app/backend/build/paralel-server ./
COPY --from=builder /app/backend/build/paralel-mpi-solver ./

# Copy entrypoint and hostfile template
COPY docker-entrypoint.sh ./
COPY backend/mpi-hosts /etc/mpi/hosts

RUN chmod +x docker-entrypoint.sh paralel-server paralel-mpi-solver

# Default configuration
ENV MPI_PROCESSES=4
ENV MPI_HOSTS=
ENV HTTP_PORT=8080
ENV MPI_SOLVER_PATH=./paralel-mpi-solver

EXPOSE 8080

# Default: single-container demo (sshd + server in foreground)
CMD ["./docker-entrypoint.sh"]
