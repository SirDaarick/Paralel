import { PIECE_COLORS } from "../tetris/colors";
import "./BoardRenderer.css";

interface BoardRendererProps {
  grid: number[][];
  highlightCells?: { x: number; y: number }[];
  flashingRows?: number[];
  collapsingRows?: number[];
  label?: string;
  score?: number;
}

export function BoardRenderer({
  grid,
  highlightCells = [],
  flashingRows = [],
  collapsingRows = [],
  label,
  score,
}: BoardRendererProps) {
  const isFlashing = (row: number) => flashingRows.includes(row);
  const isCollapsing = (row: number) => collapsingRows.includes(row);
  const isHighlighted = (x: number, y: number) =>
    highlightCells.some((c) => c.x === x && c.y === y);

  return (
    <div className="board-wrapper">
      {label && <div className="board-label">{label}</div>}
      <div className="board-grid">
        {grid.map((row, y) => (
          <div
            key={y}
            className={`board-row${isFlashing(y) ? " flashing" : ""}${isCollapsing(y) ? " collapsing" : ""}`}
          >
            {row.map((cell, x) => (
              <div
                key={x}
                className={`board-cell${isHighlighted(x, y) ? " highlighted" : ""}`}
                style={{
                  backgroundColor: PIECE_COLORS[cell] ?? "#0c0c0c",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {score !== undefined && (
        <div className="board-score">SCORE: {score}</div>
      )}
    </div>
  );
}
