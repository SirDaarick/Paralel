import type { SimulationResult, SimulationStatusResponse } from "../hooks/api-types";

export interface HealthResponse {
  openmp: boolean;
  cuda: boolean;
  mpi: boolean;
  ompThreads: number;
}

export interface ISimulationService {
  checkHealth(): Promise<HealthResponse>;
  startSimulation(lookAhead: number, mode?: "classic" | "mpi"): Promise<{ simulationId: string }>;
  getStatus(simulationId: string, mode?: "classic" | "mpi"): Promise<SimulationStatusResponse>;
  getResults(simulationId: string, mode?: "classic" | "mpi"): Promise<SimulationResult>;
}
