# MPI Simulation Mode Specification

## Purpose

Defines the end-to-end MPI-vs-CUDA simulation lifecycle: HTTP endpoints, server-side subprocess orchestration, status reporting, results delivery, and the frontend mode that consumes them. This is a separate flow from the existing 3-phase (seq/OMP/CUDA) simulation; the two flows MUST coexist without interference.

## Requirements

### Requirement: New MPI Simulation Endpoints

The HTTP server SHALL expose three new endpoints under `/api/simular-mpi/`, distinct from the existing `/api/simular/` routes. The existing 3-phase endpoints, request bodies, and response shapes MUST remain byte-identical to the pre-change version.

#### Scenario: Start an MPI simulation

- GIVEN the server is running and MPI is available
- WHEN the client POSTs `{"lookahead": 1-5}` to `/api/simular-mpi`
- THEN the server SHALL return `{"simulationId": "<uuid>"}` with HTTP 200
- AND the server SHALL spawn `mpirun` as a subprocess without calling `MPI_Init` in the server process

#### Scenario: Existing 3-phase endpoint untouched

- GIVEN the change is deployed
- WHEN the client POSTs to the original `/api/simular` endpoint
- THEN the response shape and behavior SHALL be identical to the pre-change implementation
- AND the response SHALL NOT include an `mpi` key (it belongs only to the new flow)

### Requirement: Status Reporting with Dual Progress

The status endpoint SHALL report progress for both the MPI run and the CUDA run, plus the combined simulation status.

#### Scenario: Status during execution

- GIVEN a running MPI-vs-CUDA simulation with id `X`
- WHEN the client GETs `/api/simular-mpi/X/status`
- THEN the response SHALL include `status`, `progress` (0-100), and `currentAlgorithm`
- AND progress SHALL reflect the slower of the two underlying runs

#### Scenario: Terminal status

- GIVEN both the MPI and CUDA runs have completed for simulation `X`
- WHEN the client GETs the status endpoint
- THEN `status` SHALL be `"completed"` and `progress` SHALL be `100`
- AND any failure in either run SHALL surface `status: "failed"` with an error message

### Requirement: Results Endpoint with Two Replays

The results endpoint SHALL return exactly two replays: one for the MPI solver and one for the CUDA solver. The two replays SHALL produce the same `moves[]` sequence (same piece placements on the same RNG seed).

#### Scenario: Completed results

- GIVEN simulation `X` has completed
- WHEN the client GETs `/api/simular-mpi/X/resultados`
- THEN the response SHALL include `replays: [{algorithm: "mpi", ...}, {algorithm: "cuda", ...}]`
- AND the `moves` arrays SHALL be identical between the two replays (same board evolution)
- AND each replay SHALL include `finalScore`, `totalPieces`, and `totalTimeMs`

#### Scenario: Results before completion

- GIVEN simulation `X` is still running
- WHEN the client GETs the results endpoint
- THEN the server SHALL return HTTP 409 (or equivalent not-ready status) with a clear error message

### Requirement: Health Endpoint Extension

The `/api/health` endpoint SHALL gain an `mpi` boolean and, when available, an `mpiProcesses` integer indicating the world size the server will use when spawning `mpirun`.

#### Scenario: Health with MPI available

- GIVEN OpenMPI is installed and a hostfile is configured
- WHEN the client calls `GET /api/health`
- THEN the response SHALL include `"mpi": true` and `"mpiProcesses": <positive int>`
- AND the existing `openmp`, `ompThreads`, `cuda` fields SHALL be unchanged

#### Scenario: Health with MPI unavailable

- GIVEN OpenMPI is not installed
- WHEN the client calls `GET /api/health`
- THEN the response SHALL include `"mpi": false`
- AND `mpiProcesses` SHALL be omitted (or null)

### Requirement: Frontend Mode Toggle

The frontend SHALL provide a user-facing mode selector (Clásico vs MPI vs CUDA). The MPI option SHALL be disabled (greyed out, non-clickable) when `/api/health` reports `mpi: false`. The Clásico mode SHALL remain byte-identical to the pre-change behavior.

#### Scenario: MPI option disabled when unavailable

- GIVEN `/api/health` reports `mpi: false`
- WHEN the user opens the mode selector
- THEN the MPI option SHALL be visually disabled
- AND clicking it SHALL NOT trigger a simulation start

#### Scenario: Selecting MPI mode starts the new flow

- GIVEN `/api/health` reports `mpi: true`
- WHEN the user selects MPI mode and submits a look-ahead value
- THEN the frontend SHALL call `/api/simular-mpi` (not `/api/simular`)
- AND the progress UI SHALL poll `/api/simular-mpi/{id}/status` until completion
- AND the results page SHALL render two panels (MPI + CUDA) using color `#ffaa00` for MPI

### Requirement: Three-Phase Flow Untouched

The existing 3-phase flow (seq/OMP/CUDA in one simulation) MUST NOT be modified by this change. All routes, payloads, types, and UI components used by the 3-phase flow SHALL remain functionally and visually identical to the pre-change version.

#### Scenario: Classic mode regression

- GIVEN the change is deployed
- WHEN the user runs the Clásico mode with any look-ahead value
- THEN the resulting replay, progress reporting, and final comparison SHALL match the pre-change behavior
- AND the regression SHALL be verifiable by replaying a saved simulation and comparing outputs
