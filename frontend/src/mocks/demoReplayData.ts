import type { SimulationResult, ReplayMove, ReplayData } from "../hooks/api-types";

// Secuencia idéntica de 16 jugadas válidas de Tetris para la demostración
const BASE_MOVES: Omit<ReplayMove, "decisionTimeMs">[] = [
  // Fila 18-19: 5 piezas 'O' (2x2) llenando dos líneas completas (doble limpieza)
  { pieceType: 2, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 2, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 4, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 6, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 8, dropY: 18, linesCleared: 2 }, // Limpieza doble (filas 18 y 19)

  // Fila 19: Dos 'I' horizontales (4x1) y una 'O' (2x2) llenando la fila 19
  { pieceType: 1, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 4, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 8, dropY: 18, linesCleared: 1 }, // Limpieza simple (fila 19)

  // Fila 19 (remanente de la 'O' que cayó a fila 19 en x=8,9) + dos 'I' horizontales
  { pieceType: 1, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 4, dropY: 18, linesCleared: 1 }, // Limpieza simple (fila 19)

  // Construcción de base variada (T, J, L, S, Z)
  { pieceType: 3, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 3, dropY: 18, linesCleared: 0 },
  { pieceType: 6, rotation: 0, x: 6, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 8, dropY: 18, linesCleared: 0 },
  { pieceType: 4, rotation: 0, x: 1, dropY: 17, linesCleared: 0 },
  { pieceType: 5, rotation: 0, x: 4, dropY: 17, linesCleared: 0 },
];

function buildMoves(timingScale: { min: number; max: number }): ReplayMove[] {
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return BASE_MOVES.map((m) => {
    const delta = timingScale.max - timingScale.min;
    const time = timingScale.min + pseudoRandom() * delta;
    return {
      ...m,
      decisionTimeMs: Math.round(time * 10) / 10,
    };
  });
}

const seqMoves = buildMoves({ min: 280, max: 450 });
const ompMoves = buildMoves({ min: 45, max: 75 });
const cudaMoves = buildMoves({ min: 8, max: 18 });
const mpiMoves = buildMoves({ min: 25, max: 42 });

const sumTime = (moves: ReplayMove[]) =>
  Math.round(moves.reduce((acc, m) => acc + m.decisionTimeMs, 0) * 10) / 10;

export const DEMO_CLASSIC_REPLAYS: ReplayData[] = [
  {
    algorithm: "seq",
    moves: seqMoves,
    finalScore: 1800,
    totalPieces: seqMoves.length,
    totalTimeMs: sumTime(seqMoves), // ~5700 ms
  },
  {
    algorithm: "omp",
    moves: ompMoves,
    finalScore: 1800,
    totalPieces: ompMoves.length,
    totalTimeMs: sumTime(ompMoves), // ~960 ms (~6x speedup)
  },
  {
    algorithm: "cuda",
    moves: cudaMoves,
    finalScore: 1800,
    totalPieces: cudaMoves.length,
    totalTimeMs: sumTime(cudaMoves), // ~200 ms (~28x speedup)
  },
];

export const DEMO_MPI_REPLAYS: ReplayData[] = [
  {
    algorithm: "mpi",
    moves: mpiMoves,
    finalScore: 1800,
    totalPieces: mpiMoves.length,
    totalTimeMs: sumTime(mpiMoves), // ~530 ms (~11x speedup)
  },
  {
    algorithm: "cuda",
    moves: cudaMoves,
    finalScore: 1800,
    totalPieces: cudaMoves.length,
    totalTimeMs: sumTime(cudaMoves), // ~200 ms (~28x speedup)
  },
];

export const DEMO_SIMULATION_RESULT_CLASSIC: SimulationResult = {
  replays: DEMO_CLASSIC_REPLAYS,
};

export const DEMO_SIMULATION_RESULT_MPI: SimulationResult = {
  replays: DEMO_MPI_REPLAYS,
};
