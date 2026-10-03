import type { SimulationResult, ReplayMove, ReplayData } from "../hooks/api-types";

// ============================================================================
// Core: Generador de secuencias de jugadas coherentes y partidas completas
// ============================================================================

/**
 * Movimientos base de Tetris garantizados de ser válidos en 10x20:
 * Incluyen drops a piso (dropY=18, 19), apilamientos lógicos y limpiezas de líneas
 */
const EXPANDED_TETRIS_MOVES: Omit<ReplayMove, "decisionTimeMs">[] = [
  // --- FASE 1: Limpieza doble con 5 piezas 'O' (2x2) ---
  { pieceType: 2, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 2, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 4, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 6, dropY: 18, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 8, dropY: 18, linesCleared: 2 }, // Limpia filas 18 y 19

  // --- FASE 2: Construcción horizontal y limpieza simple ---
  { pieceType: 1, rotation: 0, x: 0, dropY: 18, linesCleared: 0 }, // Barra 'I' (x:0..3, y:19)
  { pieceType: 1, rotation: 0, x: 4, dropY: 18, linesCleared: 0 }, // Barra 'I' (x:4..7, y:19)
  { pieceType: 2, rotation: 0, x: 8, dropY: 18, linesCleared: 1 }, // Pieza 'O' (x:8..9), completa fila 19

  // --- FASE 3: Segunda limpieza con la 'O' remanente que bajó a fila 19 ---
  { pieceType: 1, rotation: 0, x: 0, dropY: 18, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 4, dropY: 18, linesCleared: 1 }, // Completa fila 19

  // --- FASE 4: Apilamiento variado de piezas ---
  { pieceType: 3, rotation: 0, x: 0, dropY: 18, linesCleared: 0 }, // T
  { pieceType: 7, rotation: 0, x: 3, dropY: 18, linesCleared: 0 }, // L
  { pieceType: 6, rotation: 0, x: 6, dropY: 18, linesCleared: 0 }, // J
  { pieceType: 2, rotation: 0, x: 8, dropY: 18, linesCleared: 0 }, // O
  { pieceType: 4, rotation: 0, x: 1, dropY: 17, linesCleared: 0 }, // S
  { pieceType: 5, rotation: 0, x: 4, dropY: 17, linesCleared: 0 }, // Z
  { pieceType: 1, rotation: 1, x: 8, dropY: 15, linesCleared: 0 }, // I vertical (x=9)

  // --- FASE 5: Segundo ciclo de juego fluido ---
  { pieceType: 2, rotation: 0, x: 0, dropY: 16, linesCleared: 0 },
  { pieceType: 3, rotation: 2, x: 2, dropY: 16, linesCleared: 0 },
  { pieceType: 7, rotation: 2, x: 5, dropY: 16, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 0, dropY: 15, linesCleared: 1 }, // Limpia fila 17
  { pieceType: 2, rotation: 0, x: 4, dropY: 15, linesCleared: 0 },
  { pieceType: 6, rotation: 1, x: 7, dropY: 14, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 0, dropY: 14, linesCleared: 0 },
  { pieceType: 5, rotation: 1, x: 2, dropY: 14, linesCleared: 0 },

  // --- FASE 6: Apilamiento extendido para lookAheads altos ---
  { pieceType: 3, rotation: 0, x: 4, dropY: 14, linesCleared: 1 },
  { pieceType: 1, rotation: 0, x: 0, dropY: 13, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 6, dropY: 13, linesCleared: 0 },
  { pieceType: 7, rotation: 1, x: 8, dropY: 11, linesCleared: 0 },
  { pieceType: 6, rotation: 3, x: 1, dropY: 11, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 3, dropY: 11, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 4, dropY: 10, linesCleared: 1 },
  { pieceType: 4, rotation: 0, x: 0, dropY: 10, linesCleared: 0 },
  { pieceType: 5, rotation: 0, x: 6, dropY: 10, linesCleared: 0 },
  { pieceType: 3, rotation: 1, x: 8, dropY: 8, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 0, dropY: 8, linesCleared: 0 },
  { pieceType: 7, rotation: 0, x: 2, dropY: 8, linesCleared: 0 },
  { pieceType: 6, rotation: 0, x: 5, dropY: 8, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 0, dropY: 7, linesCleared: 2 }, // Limpieza doble
  { pieceType: 2, rotation: 0, x: 4, dropY: 7, linesCleared: 0 },
  { pieceType: 3, rotation: 0, x: 6, dropY: 7, linesCleared: 0 },
  { pieceType: 4, rotation: 1, x: 0, dropY: 6, linesCleared: 0 },
  { pieceType: 5, rotation: 1, x: 2, dropY: 6, linesCleared: 0 },
  { pieceType: 1, rotation: 1, x: 8, dropY: 4, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 4, dropY: 5, linesCleared: 1 },
  { pieceType: 7, rotation: 2, x: 0, dropY: 4, linesCleared: 0 },
  { pieceType: 6, rotation: 2, x: 3, dropY: 4, linesCleared: 0 },
  { pieceType: 2, rotation: 0, x: 6, dropY: 4, linesCleared: 0 },
  { pieceType: 1, rotation: 0, x: 0, dropY: 3, linesCleared: 2 }, // Limpieza doble
  { pieceType: 3, rotation: 0, x: 4, dropY: 3, linesCleared: 0 },
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

  const selectedMoves = EXPANDED_TETRIS_MOVES.slice(0, count);
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

// ============================================================================
// Perfiles según profundidad (Look-Ahead: 1 a 5)
// ============================================================================
// Basados en las mediciones empíricas de HPC y en la complejidad O(34^N):
// Con lookAhead=1: overhead de paralelismo es notable (~0.3ms vs ~0.2ms)
// Con lookAhead=3: OpenMP y CUDA exhiben aceleración clara (500ms vs 150ms vs 5ms)
// Con lookAhead=5: Cómputo masivo exponencial

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
    pieceCount: 30, // Partida ágil de 30 piezas
    score: 1200,
    timings: {
      seq:  { min: 0.35, max: 0.55 },
      omp:  { min: 0.22, max: 0.35 },
      cuda: { min: 0.38, max: 0.60 }, // Overhead de transferencia PCIe
      mpi:  { min: 0.40, max: 0.65 },
    },
  },
  2: {
    pieceCount: 38, // 38 piezas con múltiples limpiezas
    score: 1900,
    timings: {
      seq:  { min: 11.5, max: 15.2 },
      omp:  { min: 2.4,  max: 3.6 },   // ~4.5x speedup
      cuda: { min: 0.65, max: 0.95 },  // ~15x speedup
      mpi:  { min: 4.8,  max: 6.5 },   // ~2.5x speedup
    },
  },
  3: {
    pieceCount: 46, // 46 piezas, juego de alto nivel
    score: 3400,
    timings: {
      seq:  { min: 450, max: 550 },   // ~500ms por decisión
      omp:  { min: 135, max: 165 },   // ~150ms (3.3x speedup OpenMP 8T)
      cuda: { min: 4.5, max: 6.5 },   // ~5.2ms (95x speedup GPU)
      mpi:  { min: 230, max: 280 },   // ~255ms (1.95x speedup MPI 4P)
    },
  },
  4: {
    pieceCount: 48,
    score: 4800,
    timings: {
      seq:  { min: 4800, max: 6200 }, // ~5.5s por decisión
      omp:  { min: 1100, max: 1450 }, // ~1.2s
      cuda: { min: 65,   max: 95 },   // ~80ms (~68x speedup)
      mpi:  { min: 1800, max: 2300 },
    },
  },
  5: {
    pieceCount: 50, // Partida completa de 50 piezas con 7 limpiezas
    score: 6600,
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
