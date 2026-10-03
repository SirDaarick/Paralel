#!/bin/bash
# paralel — Docker entrypoint
# Starts SSH daemon (for MPI interconnect) and the HTTP server.
# Environment variables:
#   MPI_PROCESSES  — mpirun -np count (default: 4)
#   MPI_HOSTS      — optional hostfile path for distributed MPI
#   HTTP_PORT      — server listen port (default: 8080)
#   MPI_SOLVER_PATH — path to paralel-mpi-solver binary (default: ./paralel-mpi-solver)

set -e

# Start SSH daemon for MPI interconnect (needed for compose multi-node)
/usr/sbin/sshd

MPI_PROCESSES=${MPI_PROCESSES:-4}
HTTP_PORT=${HTTP_PORT:-8080}

echo "============================================"
echo "  paralel — MPI Docker Container"
echo "============================================"
echo "  HTTP port:      $HTTP_PORT"
echo "  MPI processes:  $MPI_PROCESSES"
if [ -n "$MPI_HOSTS" ] && [ -f "$MPI_HOSTS" ]; then
    echo "  MPI hostfile:   $MPI_HOSTS"
    echo "  ---"
    sed 's/^/  /' "$MPI_HOSTS"
else
    echo "  MPI mode:       local ranks (single container)"
fi
echo "  Solver path:    ${MPI_SOLVER_PATH:-./paralel-mpi-solver}"
echo "============================================"

exec ./paralel-server
