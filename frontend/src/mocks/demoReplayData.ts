import type { SimulationResult, ReplayMove, ReplayData } from "../hooks/api-types";

// ============================================================================
// Partida Maestra 100% real generada por el motor C++ (BruteForceSolver)
// Las 100 jugadas siguen las heuristicas optimas de Tetris (limpiezas y apilamiento)
// ============================================================================
const REAL_SOLVER_MOVES: Omit<ReplayMove, "decisionTimeMs">[] = [
  { pieceType: 5, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 4, dropY: 18, linesCleared: 0 },
  { pieceType: 3, rotation: 2, x: 7, dropY: 17, linesCleared: 0 },
  { pieceType: 4, rotation: 2, x: 5, dropY: 16, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 2, dropY: 17, linesCleared: 1 },
  { pieceType: 6, rotation: 1, x: 3, dropY: 17, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 1, dropY: 17, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 3, dropY: 15, linesCleared: 0 },
  { pieceType: 3, rotation: 3, x: 8, dropY: 17, linesCleared: 0 },
  { pieceType: 4, rotation: 0, x: 7, dropY: 16, linesCleared: 0 },
  { pieceType: 1, rotation: 3, x: 4, dropY: 15, linesCleared: 0 },
  { pieceType: 7, rotation: 2, x: 0, dropY: 15, linesCleared: 0 },
  { pieceType: 5, rotation: 3, x: 7, dropY: 14, linesCleared: 0 },
  { pieceType: 6, rotation: 1, x: 6, dropY: 15, linesCleared: 2 },
  { pieceType: 6, rotation: 1, x: 0, dropY: 17, linesCleared: 2 },
  { pieceType: 5, rotation: 1, x: 2, dropY: 17, linesCleared: 1 },
  { pieceType: 4, rotation: 1, x: 8, dropY: 17, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 4, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 0, dropY: 18, linesCleared: 1 },
  { pieceType: 3, rotation: 0, x: 4, dropY: 18, linesCleared: 0 },
  { pieceType: 7, rotation: 2, x: 2, dropY: 17, linesCleared: 0 },
  { pieceType: 6, rotation: 2, x: 7, dropY: 16, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 3, dropY: 16, linesCleared: 0 },
  { pieceType: 3, rotation: 2, x: 0, dropY: 16, linesCleared: 1 },
  { pieceType: 5, rotation: 1, x: 0, dropY: 16, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 3, dropY: 16, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 6, dropY: 17, linesCleared: 2 },
  { pieceType: 2, rotation: 2, x: 8, dropY: 18, linesCleared: 0 },
  { pieceType: 3, rotation: 3, x: 6, dropY: 17, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 4, dropY: 16, linesCleared: 0 },
  { pieceType: 2, rotation: 2, x: 8, dropY: 16, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 0, dropY: 16, linesCleared: 1 },
  { pieceType: 5, rotation: 3, x: 2, dropY: 17, linesCleared: 1 },
  { pieceType: 6, rotation: 2, x: 0, dropY: 17, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 6, dropY: 16, linesCleared: 0 },
  { pieceType: 6, rotation: 3, x: 4, dropY: 16, linesCleared: 1 },
  { pieceType: 1, rotation: 0, x: 0, dropY: 17, linesCleared: 0 },
  { pieceType: 5, rotation: 0, x: 7, dropY: 17, linesCleared: 0 },
  { pieceType: 3, rotation: 3, x: 8, dropY: 15, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 3, dropY: 16, linesCleared: 1 },
  { pieceType: 2, rotation: 2, x: 5, dropY: 16, linesCleared: 0 },
  { pieceType: 7, rotation: 3, x: 6, dropY: 15, linesCleared: 0 },
  { pieceType: 7, rotation: 2, x: 0, dropY: 17, linesCleared: 2 },
  { pieceType: 3, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 3, dropY: 17, linesCleared: 1 },
  { pieceType: 5, rotation: 0, x: 3, dropY: 17, linesCleared: 0 },
  { pieceType: 2, rotation: 2, x: 8, dropY: 17, linesCleared: 0 },
  { pieceType: 1, rotation: 1, x: 0, dropY: 16, linesCleared: 0 },
  { pieceType: 6, rotation: 0, x: 5, dropY: 16, linesCleared: 0 },
  { pieceType: 3, rotation: 2, x: 7, dropY: 14, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 3, dropY: 14, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 0, dropY: 14, linesCleared: 1 },
  { pieceType: 4, rotation: 3, x: 5, dropY: 14, linesCleared: 0 },
  { pieceType: 6, rotation: 1, x: 4, dropY: 14, linesCleared: 0 },
  { pieceType: 5, rotation: 2, x: 6, dropY: 13, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 0, dropY: 17, linesCleared: 2 },
  { pieceType: 1, rotation: 1, x: 7, dropY: 15, linesCleared: 0 },
  { pieceType: 7, rotation: 3, x: 2, dropY: 16, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 0, dropY: 17, linesCleared: 2 },
  { pieceType: 5, rotation: 1, x: 0, dropY: 17, linesCleared: 0 },
  { pieceType: 4, rotation: 3, x: 1, dropY: 15, linesCleared: 0 },
  { pieceType: 3, rotation: 0, x: 4, dropY: 16, linesCleared: 0 },
  { pieceType: 6, rotation: 1, x: 0, dropY: 15, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 6, dropY: 15, linesCleared: 0 },
  { pieceType: 1, rotation: 3, x: 7, dropY: 16, linesCleared: 3 },
  { pieceType: 2, rotation: 0, x: 7, dropY: 17, linesCleared: 0 },
  { pieceType: 5, rotation: 0, x: 2, dropY: 18, linesCleared: 0 },
  { pieceType: 3, rotation: 0, x: 1, dropY: 16, linesCleared: 0 },
  { pieceType: 6, rotation: 3, x: 4, dropY: 16, linesCleared: 0 },
  { pieceType: 7, rotation: 3, x: 8, dropY: 16, linesCleared: 1 },
  { pieceType: 2, rotation: 2, x: 8, dropY: 15, linesCleared: 0 },
  { pieceType: 6, rotation: 1, x: 4, dropY: 16, linesCleared: 0 },
  { pieceType: 5, rotation: 1, x: 0, dropY: 16, linesCleared: 0 },
  { pieceType: 1, rotation: 3, x: 5, dropY: 15, linesCleared: 1 },
  { pieceType: 4, rotation: 0, x: 4, dropY: 15, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 7, dropY: 14, linesCleared: 0 },
  { pieceType: 3, rotation: 3, x: 2, dropY: 16, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 0, dropY: 15, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 3, dropY: 14, linesCleared: 0 },
  { pieceType: 4, rotation: 0, x: 0, dropY: 14, linesCleared: 1 },
  { pieceType: 1, rotation: 3, x: 6, dropY: 15, linesCleared: 2 },
  { pieceType: 3, rotation: 3, x: 7, dropY: 15, linesCleared: 0 },
  { pieceType: 5, rotation: 0, x: 4, dropY: 16, linesCleared: 0 },
  { pieceType: 6, rotation: 1, x: 0, dropY: 16, linesCleared: 2 },
  { pieceType: 5, rotation: 1, x: 6, dropY: 16, linesCleared: 0 },
  { pieceType: 6, rotation: 3, x: 2, dropY: 16, linesCleared: 0 },
  { pieceType: 3, rotation: 3, x: 7, dropY: 14, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 4, dropY: 16, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 5, dropY: 14, linesCleared: 0 },
  { pieceType: 7, rotation: 1, x: 0, dropY: 15, linesCleared: 0 },
  { pieceType: 1, rotation: 3, x: 8, dropY: 16, linesCleared: 2 },
  { pieceType: 3, rotation: 3, x: 1, dropY: 17, linesCleared: 2 },
  { pieceType: 2, rotation: 0, x: 3, dropY: 18, linesCleared: 0 },
  { pieceType: 7, rotation: 3, x: 8, dropY: 17, linesCleared: 0 },
  { pieceType: 1, rotation: 1, x: 0, dropY: 15, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 0, dropY: 17, linesCleared: 1 },
  { pieceType: 5, rotation: 2, x: 5, dropY: 17, linesCleared: 1 },
  { pieceType: 6, rotation: 2, x: 5, dropY: 17, linesCleared: 0 },
  { pieceType: 5, rotation: 0, x: 7, dropY: 17, linesCleared: 0 },
  { pieceType: 6, rotation: 2, x: 7, dropY: 15, linesCleared: 0 },
];

function buildMovesForProfile(
  count: number,
  timing: { minMs: number; maxMs: number; seedOffset: number }
): ReplayMove[] {
  let seed = 42 + timing.seedOffset;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const selectedMoves = REAL_SOLVER_MOVES.slice(0, count);
  return selectedMoves.map((m) => {
    const delta = timing.maxMs - timing.minMs;
    const time = timing.minMs + pseudoRandom() * delta;
    return {
      ...m,
      decisionTimeMs: Math.max(0.01, Math.round(time * 100) / 100),
    };
  });
}

function sumTime(moves: ReplayMove[]): number {
  return Math.round(moves.reduce((acc, m) => acc + m.decisionTimeMs, 0) * 10) / 10;
}

export interface DemoReplaySet {
  classic: ReplayData[];
  mpi: ReplayData[];
}

const LOOKAHEAD_PROFILES: Record<
  number,
  {
    pieceCount: number;
    score: number;
    timings: {
      seq: { min: number; max: number };
      omp: { min: number; max: number };
      cuda: { min: number; max: number };
      mpi: { min: number; max: number };
    };
  }
> = {
  1: {
    pieceCount: 35,
    score: 1400,
    timings: {
      seq:  { min: 0.35, max: 0.55 },
      omp:  { min: 0.22, max: 0.35 },
      cuda: { min: 0.38, max: 0.60 },
      mpi:  { min: 0.40, max: 0.65 },
    },
  },
  2: {
    pieceCount: 50,
    score: 2200,
    timings: {
      seq:  { min: 11.5, max: 15.2 },
      omp:  { min: 2.4,  max: 3.6 },
      cuda: { min: 0.65, max: 0.95 },
      mpi:  { min: 4.8,  max: 6.5 },
    },
  },
  3: {
    pieceCount: 65,
    score: 3600,
    timings: {
      seq:  { min: 450, max: 550 },
      omp:  { min: 135, max: 165 },
      cuda: { min: 4.5, max: 6.5 },
      mpi:  { min: 230, max: 280 },
    },
  },
  4: {
    pieceCount: 80,
    score: 4800,
    timings: {
      seq:  { min: 4800, max: 6200 },
      omp:  { min: 1100, max: 1450 },
      cuda: { min: 65,   max: 95 },
      mpi:  { min: 1800, max: 2300 },
    },
  },
  5: {
    pieceCount: 100,
    score: 5600,
    timings: {
      seq:  { min: 18000, max: 24000 },
      omp:  { min: 3800,  max: 5200 },
      cuda: { min: 280,   max: 390 },
      mpi:  { min: 5900,  max: 7600 },
    },
  },
};

function generateReplaySet(lookAhead: number): DemoReplaySet {
  const profile = LOOKAHEAD_PROFILES[lookAhead] ?? LOOKAHEAD_PROFILES[2];
  const count = profile.pieceCount;

  const seqMoves = buildMovesForProfile(count, {
    minMs: profile.timings.seq.min,
    maxMs: profile.timings.seq.max,
    seedOffset: 1,
  });
  const ompMoves = buildMovesForProfile(count, {
    minMs: profile.timings.omp.min,
    maxMs: profile.timings.omp.max,
    seedOffset: 2,
  });
  const cudaMoves = buildMovesForProfile(count, {
    minMs: profile.timings.cuda.min,
    maxMs: profile.timings.cuda.max,
    seedOffset: 3,
  });
  const mpiMoves = buildMovesForProfile(count, {
    minMs: profile.timings.mpi.min,
    maxMs: profile.timings.mpi.max,
    seedOffset: 4,
  });

  const seqReplay: ReplayData = {
    algorithm: "seq",
    moves: seqMoves,
    finalScore: profile.score,
    totalPieces: count,
    totalTimeMs: sumTime(seqMoves),
  };

  const ompReplay: ReplayData = {
    algorithm: "omp",
    moves: ompMoves,
    finalScore: profile.score,
    totalPieces: count,
    totalTimeMs: sumTime(ompMoves),
  };

  const cudaReplay: ReplayData = {
    algorithm: "cuda",
    moves: cudaMoves,
    finalScore: profile.score,
    totalPieces: count,
    totalTimeMs: sumTime(cudaMoves),
  };

  const mpiReplay: ReplayData = {
    algorithm: "mpi",
    moves: mpiMoves,
    finalScore: profile.score,
    totalPieces: count,
    totalTimeMs: sumTime(mpiMoves),
  };

  return {
    classic: [seqReplay, ompReplay, cudaReplay],
    mpi: [mpiReplay, cudaReplay],
  };
}

export const DEMO_REPLAYS_BY_LOOKAHEAD: Record<number, DemoReplaySet> = {
  1: generateReplaySet(1),
  2: generateReplaySet(2),
  3: generateReplaySet(3),
  4: generateReplaySet(4),
  5: generateReplaySet(5),
};

export function getDemoSimulationResult(
  lookAhead: number,
  mode: "classic" | "mpi" = "classic"
): SimulationResult {
  const safeLA = Math.max(1, Math.min(5, lookAhead));
  const set = DEMO_REPLAYS_BY_LOOKAHEAD[safeLA] ?? DEMO_REPLAYS_BY_LOOKAHEAD[2];
  return {
    replays: mode === "mpi" ? set.mpi : set.classic,
  };
}
