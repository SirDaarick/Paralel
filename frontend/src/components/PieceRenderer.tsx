import { PIECES, type Block } from "../tetris/pieces";
import { PIECE_COLORS, PIECE_NAMES } from "../tetris/colors";
import "./PieceRenderer.css";

interface PieceRendererProps {
  pieceType: number;
  rotation?: number;
  piecesPreview?: number[];
  thinking?: boolean;
}

export function PieceRenderer({
  pieceType,
  rotation = 0,
  piecesPreview = [],
  thinking = false,
}: PieceRendererProps) {
  const blocks = PIECES[pieceType]?.[rotation] ?? [];

  return (
    <div className={`piece-display${thinking ? " thinking" : ""}`}>
      <div className="piece-current">
        <div className="piece-label">{thinking ? "ESPERANDO" : "NEXT"}</div>
        <MiniGrid blocks={blocks} color={PIECE_COLORS[pieceType] ?? "#fff"} />
      </div>
      {piecesPreview.length > 0 && (
        <div className="piece-queue">
          {piecesPreview.map((pt, i) => {
            const previewBlocks = PIECES[pt]?.[0] ?? [];
            return (
              <div key={i} className="piece-preview-item">
                <MiniGrid
                  blocks={previewBlocks}
                  color={PIECE_COLORS[pt] ?? "#fff"}
                  small
                />
                <span className="piece-name">{PIECE_NAMES[pt] ?? "?"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniGrid({
  blocks,
  color,
  small = false,
}: {
  blocks: Block[];
  color: string;
  small?: boolean;
}) {
  if (blocks.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of blocks) {
    if (b.x < minX) minX = b.x;
    if (b.x > maxX) maxX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.y > maxY) maxY = b.y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cellSize = small ? 12 : 16;

  const blockSet = new Set(blocks.map((b) => `${b.x - minX},${b.y - minY}`));

  return (
    <div
      className="mini-grid"
      style={{
        gridTemplateColumns: `repeat(${w}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${h}, ${cellSize}px)`,
      }}
    >
      {Array.from({ length: h }, (_, y) =>
        Array.from({ length: w }, (_, x) => (
          <div
            key={`${x}-${y}`}
            className="mini-cell"
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: blockSet.has(`${x},${y}`) ? color : "transparent",
            }}
          />
        ))
      )}
    </div>
  );
}
