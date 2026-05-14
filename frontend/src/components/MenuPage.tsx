import type { SimulationResult } from "../hooks/api-types";
import "./MenuPage.css";

interface HistoryEntry {
  id: string;
  date: string;
  lookAhead: number;
  result: SimulationResult;
}

interface MenuPageProps {
  lookAhead: number;
  onLookAheadChange: (value: number) => void;
  onStart: () => void;
  onTheory?: () => void;
  history?: HistoryEntry[];
  onHistorySelect?: (entry: HistoryEntry) => void;
}

const ASCII_TITLE = [
  "╔════════════════════════════════════════╗",
  "║                                        ║",
  "║  ██████╗  █████╗ ██████╗  █████╗ ██╗     ║",
  "║  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║     ║",
  "║  ██████╔╝███████║██████╔╝███████║██║     ║",
  "║  ██╔═══╝ ██╔══██║██╔══██╗██╔══██║██║     ║",
  "║  ██║     ██║  ██║██║  ██║██║  ██║███████╗║",
  "║  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝║",
  "║                                        ║",
  "║     PARALLEL  COMPUTING  TETRIS        ║",
  "║                                        ║",
  "╚════════════════════════════════════════╝",
];

export function MenuPage({ lookAhead, onLookAheadChange, onStart, onTheory, history = [], onHistorySelect }: MenuPageProps) {
  const blockCount = lookAhead;
  const maxBlocks = 5;

  return (
    <div className="menu-page">
      <pre className="ascii-title">
        {ASCII_TITLE.join("\n")}
      </pre>

      <div className="menu-box">
        <div className="menu-section">
          <div className="menu-label">
            ┌─────────────────────────┐
            <br />
            │  LOOK-AHEAD PIECES     │
            <br />
            └─────────────────────────┘
          </div>

          <div className="slider-container">
            <div className="slider-value">
              [{blockCount}]
            </div>

            <div className="slider-track">
              <div className="slider-blocks">
                {Array.from({ length: maxBlocks }, (_, i) => (
                  <span
                    key={i}
                    className={`slider-block ${i < blockCount ? "filled" : "empty"}`}
                    onClick={() => onLookAheadChange(i + 1)}
                  >
                    {i < blockCount ? "█" : "░"}
                  </span>
                ))}
              </div>

              <input
                type="range"
                min={1}
                max={5}
                value={lookAhead}
                onChange={(e) => onLookAheadChange(Number(e.target.value))}
                className="slider-input"
              />
            </div>

            <div className="slider-labels">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`slider-num ${n === lookAhead ? "active" : ""}`}
                  onClick={() => onLookAheadChange(n)}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="menu-info">
          <p>El algoritmo evaluara las {blockCount} pieza(s)</p>
          <p>siguientes para decidir la mejor posicion.</p>
          <p className="info-hint">Mayor valor = decisiones mas lentas</p>
        </div>

        <button className="menu-start-btn" onClick={onStart}>
          <span className="btn-border">
            ╔═══════════════════╗<br />
            ║                   ║<br />
            ║    COMENZAR       ║<br />
            ║                   ║<br />
            ╚═══════════════════╝
          </span>
        </button>

        {onTheory && (
          <button className="menu-theory-btn" onClick={onTheory}>
            ANALISIS TEORICO
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-section">
          <div className="history-title">
            ┌──────────────────────────────────┐<br />
            │  SIMULACIONES ANTERIORES         │<br />
            └──────────────────────────────────┘
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <button
                key={entry.id}
                className="history-item"
                onClick={() => onHistorySelect?.(entry)}
              >
                <span className="history-date">{entry.date}</span>
                <span className="history-la">[{entry.lookAhead}]</span>
                <span className="history-summary">
                  {entry.result.replays.map((r) => (
                    <span key={r.algorithm} className="history-algo">
                      {r.algorithm.toUpperCase()}:{r.totalPieces}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
