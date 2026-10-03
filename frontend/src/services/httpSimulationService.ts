import type {
  SimulationResult,
  SimulationStatusResponse,
} from "../hooks/api-types";
import type {
  ISimulationService,
  HealthResponse,
} from "./simulationService.interface";

export class HttpSimulationService implements ISimulationService {
  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("Error comprobando estado del servidor");
    const data = await res.json();
    return {
      openmp: data.openmp === true,
      cuda: data.cuda === true,
      mpi: data.mpi === true,
      ompThreads: typeof data.ompThreads === "number" ? data.ompThreads : 0,
    };
  }

  async startSimulation(
    lookAhead: number,
    mode: "classic" | "mpi" = "classic"
  ): Promise<{ simulationId: string }> {
    const endpoint = mode === "mpi" ? "/api/simular-mpi" : "/api/simular";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lookAhead }),
    });

    if (!res.ok) {
      throw new Error(
        `Error al iniciar la simulación (${mode === "mpi" ? "MPI" : "Clásica"})`
      );
    }

    return res.json();
  }

  async getStatus(
    simulationId: string,
    mode: "classic" | "mpi" = "classic"
  ): Promise<SimulationStatusResponse> {
    const endpoint =
      mode === "mpi"
        ? `/api/simular-mpi/${simulationId}/status`
        : `/api/simular/${simulationId}/status`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error("Error consultando el estado de la simulación");
    }

    return res.json();
  }

  async getResults(
    simulationId: string,
    mode: "classic" | "mpi" = "classic"
  ): Promise<SimulationResult> {
    const endpoint =
      mode === "mpi"
        ? `/api/simular-mpi/${simulationId}/resultados`
        : `/api/simular/${simulationId}/resultados`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error("Error obteniendo resultados de la simulación");
    }

    return res.json();
  }
}
