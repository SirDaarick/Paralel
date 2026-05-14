export interface ReplayMove {
  pieceType: number;
  rotation: number;
  x: number;
  dropY: number;
  decisionTimeMs: number;
  linesCleared: number;
}

export interface ReplayData {
  algorithm: string;
  moves: ReplayMove[];
  finalScore: number;
  totalPieces: number;
  totalTimeMs: number;
}

export interface SimulationResult {
  replays: ReplayData[];
}

export interface SimulationStatusResponse {
  status: "running" | "completed" | "error";
  progress: number;
  currentAlgorithm: string;
}
