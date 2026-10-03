# MPI Distributed Solver Specification

## Purpose

Defines the contract for the standalone `paralel-mpi-solver` binary: how it distributes brute-force Tetris search across MPI ranks, synchronizes per-piece decisions, and emits results. The HTTP server depends on this contract via subprocess + stdout JSON; the binary itself owns all MPI calls.

## Requirements

### Requirement: Standalone Binary Contract

The system SHALL provide a `paralel-mpi-solver` binary that accepts `--lookahead` (1-5), `--seed` (integer), and `--pieces-count` (positive integer) CLI arguments and prints a single JSON replay object to stdout on success.

#### Scenario: Successful run with JSON output

- GIVEN OpenMPI ≥ 4.0 is installed
- WHEN the user runs `mpirun -np 4 ./paralel-mpi-solver --lookahead 2 --seed 42 --pieces-count 100`
- THEN rank 0 SHALL print exactly one JSON object to stdout
- AND the JSON SHALL match the existing `replay` schema (algorithm, moves[], finalScore, totalPieces, totalTimeMs)

#### Scenario: Invalid arguments exit non-zero

- GIVEN the binary is invoked
- WHEN `--lookahead` is outside 1-5 or `--pieces-count` is non-positive
- THEN the process SHALL exit with a non-zero status
- AND a human-readable error SHALL be printed to stderr

### Requirement: Deterministic Randomization Across Ranks

The system SHALL ensure every rank generates the identical piece sequence from the same seed, so that the distributed search evaluates the same game state at each decision point.

#### Scenario: Identical bag sequences from same seed

- GIVEN all ranks receive the same `--seed` value
- WHEN each rank calls the piece randomizer N times
- THEN the produced piece sequences SHALL be byte-identical across all ranks
- AND a unit test SHALL verify this property (no rank drift)

### Requirement: Distributed Brute-Force with Global Best-Move

The system SHALL distribute the first-level (position, rotation) search space across ranks using a stride pattern over 40 top-level positions (10 columns × 4 rotations), and SHALL use a single MPI collective reduction per piece to select the global best move.

#### Scenario: Stride covers full search space

- GIVEN a simulation with N pieces and lookahead L
- WHEN a rank with index `r` in a world of size `P` evaluates positions
- THEN the rank SHALL evaluate exactly the positions where `(positionIndex mod P) == r`
- AND every position in [0, 40) SHALL be evaluated by exactly one rank

#### Scenario: Per-piece reduction yields single best move

- GIVEN each rank has evaluated its stride of first-level positions and computed a local best score
- WHEN the rank participates in the per-piece collective reduction
- THEN all ranks SHALL converge on the same chosen move before advancing to the next piece
- AND no rank SHALL proceed to piece `i+1` until piece `i` is committed

### Requirement: Graceful Fallback When MPI Unavailable

The build system SHALL detect OpenMPI at configure time; when absent, the `paralel-mpi-solver` target SHALL be skipped (not failed) and the rest of the project SHALL build unchanged.

#### Scenario: Build succeeds without OpenMPI

- GIVEN OpenMPI is NOT installed and `mpicxx` is not on `$PATH`
- WHEN the user runs `make`
- THEN the build SHALL succeed and produce the existing `paralel-server` binary
- AND the `paralel-mpi-solver` target SHALL be reported as skipped
- AND the 3-phase solver flow SHALL remain fully functional

#### Scenario: Health endpoint reflects MPI absence

- GIVEN OpenMPI is not installed
- WHEN the server starts and the client calls `GET /api/health`
- THEN the response SHALL include `"mpi": false`
- AND the existing `openmp`, `ompThreads`, `cuda` fields SHALL be unchanged
