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

export interface MpiSimulationResult {
  replays: ReplayData[];
}

export interface MpiStatusResponse {
  status: "running" | "completed" | "error";
  progress: number;
  currentAlgorithm: string;
}

export const ALGO_META: Record<string, { label: string; color: string }> = {
  seq:  { label: "SECUENCIAL",   color: "#ff3333" },
  omp:  { label: "OpenMP (CPU)", color: "#00ff00" },
  cuda: { label: "CUDA (GPU)",   color: "#00ffff" },
  mpi:  { label: "MPI",          color: "#ffaa00" },
};

export const ALGO_ORDER = ["seq", "omp", "mpi", "cuda"];
