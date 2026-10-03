import type { ISimulationService } from "./simulationService.interface";
import { HttpSimulationService } from "./httpSimulationService";
import { MockSimulationService } from "./mockSimulationService";

export const IS_DEMO_MODE: boolean =
  import.meta.env.DEMO_MODE === "true" ||
  import.meta.env.VITE_DEMO_MODE === "true";

export function createSimulationService(): ISimulationService {
  if (IS_DEMO_MODE) {
    return new MockSimulationService();
  }
  return new HttpSimulationService();
}

export const simulationService: ISimulationService = createSimulationService();

export * from "./simulationService.interface";
