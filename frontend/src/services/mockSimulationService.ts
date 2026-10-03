import type {
  SimulationResult,
  SimulationStatusResponse,
} from "../hooks/api-types";
import type {
  ISimulationService,
  HealthResponse,
} from "./simulationService.interface";
import {
  DEMO_SIMULATION_RESULT_CLASSIC,
  DEMO_SIMULATION_RESULT_MPI,
} from "../mocks/demoReplayData";

interface ActiveDemoSim {
  startTime: number;
  durationMs: number;
  mode: "classic" | "mpi";
}

export class MockSimulationService implements ISimulationService {
  private activeSimulations = new Map<string, ActiveDemoSim>();
  private readonly defaultDurationMs = 2400; // 2.4 segundos para apreciar la barra de carga

  async checkHealth(): Promise<HealthResponse> {
    // En modo demo, simulamos que todas las capacidades de cómputo están disponibles
    return {
      openmp: true,
      cuda: true,
      mpi: true,
      ompThreads: 8,
    };
  }

  async startSimulation(
    _lookAhead: number,
    mode: "classic" | "mpi" = "classic"
  ): Promise<{ simulationId: string }> {
    const simulationId = `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.activeSimulations.set(simulationId, {
      startTime: Date.now(),
      durationMs: this.defaultDurationMs,
      mode,
    });
    return { simulationId };
  }

  async getStatus(
    simulationId: string,
    mode: "classic" | "mpi" = "classic"
  ): Promise<SimulationStatusResponse> {
    const sim = this.activeSimulations.get(simulationId);
    if (!sim) {
      // Si por alguna razón no existe, completamos de inmediato
      return {
        status: "completed",
        progress: 100,
        currentAlgorithm: mode === "mpi" ? "cuda" : "cuda",
      };
    }

    const elapsed = Date.now() - sim.startTime;
    const rawProgress = Math.min(100, Math.floor((elapsed / sim.durationMs) * 100));

    if (rawProgress >= 100) {
      return {
        status: "completed",
        progress: 100,
        currentAlgorithm: "cuda",
      };
    }

    let currentAlgorithm: string;
    if (sim.mode === "classic") {
      if (rawProgress < 33) {
        currentAlgorithm = "seq";
      } else if (rawProgress < 66) {
        currentAlgorithm = "omp";
      } else {
        currentAlgorithm = "cuda";
      }
    } else {
      if (rawProgress < 50) {
        currentAlgorithm = "mpi";
      } else {
        currentAlgorithm = "cuda";
      }
    }

    return {
      status: "running",
      progress: rawProgress,
      currentAlgorithm,
    };
  }

  async getResults(
    simulationId: string,
    mode: "classic" | "mpi" = "classic"
  ): Promise<SimulationResult> {
    const sim = this.activeSimulations.get(simulationId);
    const effectiveMode = sim ? sim.mode : mode;

    // Limpiamos la simulación activa
    this.activeSimulations.delete(simulationId);

    if (effectiveMode === "mpi") {
      return DEMO_SIMULATION_RESULT_MPI;
    }
    return DEMO_SIMULATION_RESULT_CLASSIC;
  }
}
