import { useEffect, useRef, useState, useCallback } from "react";
import type { ReplayData, ReplayMove } from "../hooks/api-types";
import { PIECES } from "../tetris/pieces";
import { BoardRenderer } from "./BoardRenderer";
import { PieceRenderer } from "./PieceRenderer";
import "./SimulationPanel.css";

interface SimulationPanelProps {
  replay: ReplayData;
  lookAhead: number;
  speedMultiplier?: number;
  onFinished?: () => void;
}

function createEmptyGrid(): number[][] {
  return Array.from({ length: 20 }, () => Array(10).fill(0));
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

function getPieceBlocks(pieceType: number, rotation: number): { x: number; y: number }[] {
  return PIECES[pieceType]?.[rotation] ?? [];
}

function applyMoveToGrid(
  grid: number[][],
  move: ReplayMove
): {
  preClearGrid: number[][];
  newGrid: number[][];
  clearedRows: number[];
  placedCells: { x: number; y: number }[];
} {
  const preClearGrid = cloneGrid(grid);
  const pieceBlocks = getPieceBlocks(move.pieceType, move.rotation);
  const placedCells: { x: number; y: number }[] = [];

  for (const block of pieceBlocks) {
    const px = move.x + block.x;
    const py = move.dropY + block.y;
    if (px >= 0 && px < 10 && py >= 0 && py < 20) {
      if (preClearGrid[py][px] !== 0) {
        console.warn(`[overlap] piece=${move.pieceType} rot=${move.rotation} x=${move.x} dropY=${move.dropY} cell (${px},${py}) already occupied`);
      }
      preClearGrid[py][px] = move.pieceType;
      placedCells.push({ x: px, y: py });
    }
  }

  // Line clearing: use same compaction algorithm as backend (board.cpp clearLines)
  const newGrid = createEmptyGrid();
  let writeY = 19;
  let linesCleared = 0;
  const clearedRowIndices: number[] = [];

  for (let readY = 19; readY >= 0; readY--) {
    const isFull = preClearGrid[readY].every((cell) => cell !== 0);
    if (!isFull) {
      if (writeY !== readY) {
        for (let x = 0; x < 10; x++) {
          newGrid[writeY][x] = preClearGrid[readY][x];
        }
      } else {
        for (let x = 0; x < 10; x++) {
          newGrid[writeY][x] = preClearGrid[readY][x];
        }
      }
      writeY--;
    } else {
      linesCleared++;
      clearedRowIndices.push(readY);
    }
  }

  return {
    preClearGrid,
    newGrid,
    clearedRows: clearedRowIndices,
    placedCells,
  };
}

export function SimulationPanel({
  replay,
  lookAhead,
  speedMultiplier = 1,
  onFinished,
}: SimulationPanelProps) {
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const [displayGrid, setDisplayGrid] = useState<number[][]>(createEmptyGrid());
  const [currentPiece, setCurrentPiece] = useState<number>(0);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [nextPieces, setNextPieces] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [boardLabel] = useState(replay.algorithm.toUpperCase());
  const [flashingRows, setFlashingRows] = useState<number[]>([]);
  const [collapsingRows, setCollapsingRows] = useState<number[]>([]);
  const [highlightCells, setHighlightCells] = useState<{x:number;y:number}[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [piecesPlaced, setPiecesPlaced] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({
    board: createEmptyGrid(),
    score: 0,
    pieceCount: 0,
  });
  const finishedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playMoveRef = useRef<((move: ReplayMove, moves: ReplayMove[], index: number) => void) | null>(null);

  const playMove = useCallback(
    (move: ReplayMove, moves: ReplayMove[], index: number) => {
      const state = stateRef.current;
      if (finishedRef.current) return;

      const remaining = moves.slice(index + 1).map((m) => m.pieceType);
      const preview = remaining.slice(0, lookAhead);

      setCurrentPiece(move.pieceType);
      setCurrentRotation(move.rotation);
      setNextPieces(preview);
      setDisplayGrid(cloneGrid(state.board));
      setIsThinking(true);

      const spd = speedRef.current;

      timerRef.current = setTimeout(() => {
        if (finishedRef.current) return;
        setIsThinking(false);

        const { preClearGrid, newGrid, clearedRows, placedCells } =
          applyMoveToGrid(state.board, move);

        state.board = newGrid;
        state.score +=
          clearedRows.length === 1 ? 100 :
          clearedRows.length === 2 ? 300 :
          clearedRows.length === 3 ? 500 :
          clearedRows.length === 4 ? 800 : 0;
        state.pieceCount++;

        setScore(state.score);
        setPiecesPlaced(state.pieceCount);
        setDisplayGrid(cloneGrid(preClearGrid));
        setHighlightCells(placedCells);

        const next = () => {
          if (index + 1 < moves.length) {
            playMoveRef.current?.(moves[index + 1], moves, index + 1);
          } else {
            setIsFinished(true);
            finishedRef.current = true;
            onFinishedRef.current?.();
          }
        };

        if (clearedRows.length > 0) {
          timerRef.current = setTimeout(() => {
            setHighlightCells([]);
            setFlashingRows(clearedRows);
            timerRef.current = setTimeout(() => {
              setFlashingRows([]);
              setCollapsingRows(clearedRows);
              setDisplayGrid(cloneGrid(newGrid));
              timerRef.current = setTimeout(() => {
                setCollapsingRows([]);
                next();
              }, Math.max(120 / spd, 1));
            }, Math.max(150 / spd, 1));
          }, Math.max(100 / spd, 1));
        } else {
          setDisplayGrid(cloneGrid(newGrid));
          timerRef.current = setTimeout(() => {
            setHighlightCells([]);
            timerRef.current = setTimeout(next, Math.max(30 / spd, 1));
          }, Math.max(100 / spd, 1));
        }
      }, Math.max(move.decisionTimeMs / spd, 1));
    },
    [lookAhead]
  );

  playMoveRef.current = playMove;

  useEffect(() => {
    if (!replay || replay.moves.length === 0) return;

    cleanup();
    finishedRef.current = false;
    stateRef.current = {
      board: createEmptyGrid(),
      score: 0,
      pieceCount: 0,
    };
    setDisplayGrid(createEmptyGrid());
    setScore(0);
    setPiecesPlaced(0);
    setIsFinished(false);
    setIsThinking(false);
    setFlashingRows([]);
    setCollapsingRows([]);
    setHighlightCells([]);

    playMove(replay.moves[0], replay.moves, 0);

    return cleanup;
  }, [replay]); // Only restart when replay changes

  return (
    <div className="sim-panel-col">
      <div className="sim-panel-inner">
        <BoardRenderer
          grid={displayGrid}
          label={boardLabel}
          score={score}
          flashingRows={flashingRows}
          highlightCells={highlightCells}
          collapsingRows={collapsingRows}
        />
        <div className="sim-sidebar">
          {!isFinished && currentPiece > 0 && (
            <PieceRenderer
              pieceType={currentPiece}
              rotation={currentRotation}
              piecesPreview={nextPieces}
              thinking={isThinking}
            />
          )}
          <div className={`thinking-indicator${isThinking ? " visible" : ""}`}>
            CALCULANDO...
          </div>
          <div className="sim-stats">
            <span>PIEZAS: {piecesPlaced}</span>
          </div>
        </div>
      </div>
      {isFinished && (
        <div className="sim-final-stats">
          <div className="stat-line">SCORE: <span className="stat-val">{replay.finalScore}</span></div>
          <div className="stat-line">PIEZAS: <span className="stat-val">{replay.totalPieces}</span></div>
          <div className="stat-line">TIEMPO: <span className="stat-val">{(replay.totalTimeMs / 1000).toFixed(3)}s</span></div>
          <div className="stat-line">PROM: <span className="stat-val">
            {replay.totalPieces > 0
              ? (replay.totalTimeMs / replay.totalPieces).toFixed(2)
              : "0.00"}ms
          </span></div>
        </div>
      )}
    </div>
  );
}
