import type { ReplayData } from "../hooks/api-types";
import { ALGO_META, ALGO_ORDER } from "../hooks/api-types";
import { ComparisonChart } from "./ComparisonChart";
import "./ResultsPage.css";

interface ResultsPageProps {
  replays: ReplayData[];
  lookAhead: number;
  onBack: () => void;
}

function formatMs(ms: number): string {
  if (ms < 1000) return ms.toFixed(1) + " ms";
  return (ms / 1000).toFixed(3) + " s";
}

export function ResultsPage({ replays, lookAhead, onBack }: ResultsPageProps) {
  const sorted = [...replays].sort(
    (a, b) => ALGO_ORDER.indexOf(a.algorithm) - ALGO_ORDER.indexOf(b.algorithm)
  );

  const algoCount = replays.length;

  return (
    <div className="results-page">
      <pre className="results-ascii">
        {`╔══════════════════════════════════╗
 ║     RESULTADOS DE SIMULACION    ║
 ╚══════════════════════════════════╝`}
      </pre>

      <div className="results-meta">
        LOOK-AHEAD: [{lookAhead}] — mismas piezas para los {algoCount} algoritmos
      </div>

      <table className="results-table">
        <thead>
          <tr>
            <th>ALGORITMO</th>
            <th>PUNTAJE</th>
            <th>PIEZAS</th>
            <th>TIEMPO TOTAL</th>
            <th>PROMEDIO / DECISION</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const avgMs = r.totalPieces > 0 ? r.totalTimeMs / r.totalPieces : 0;
            const meta = ALGO_META[r.algorithm];
            const algoColor = meta?.color ?? "#a0a0a0";
            return (
              <tr key={r.algorithm}>
                <td className="col-label" style={{ color: algoColor }}>
                  {meta?.label ?? r.algorithm.toUpperCase()}
                </td>
                <td className="col-score" style={{ color: algoColor }}>
                  {r.finalScore}
                </td>
                <td>{r.totalPieces}</td>
                <td>{formatMs(r.totalTimeMs)}</td>
                <td>{formatMs(avgMs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="results-winner">
        {sorted.length >= 2 && (() => {
          const best = sorted.reduce((a, b) =>
            (a.totalTimeMs / Math.max(a.totalPieces, 1)) <
            (b.totalTimeMs / Math.max(b.totalPieces, 1)) ? a : b
          );
          const bestMeta = ALGO_META[best.algorithm];
          const bestColor = bestMeta?.color ?? "var(--color-green)";
          return (
            <p>
              MAS RAPIDO:{" "}
              <span className="winner-name" style={{ color: bestColor }}>
                {bestMeta?.label ?? best.algorithm}
              </span>
              {" — "}
              {best.totalPieces > 0
                ? (best.totalTimeMs / best.totalPieces).toFixed(2)
                : "?"} ms/decision
            </p>
          );
        })()}
      </div>

      <ComparisonChart replays={sorted} />

      <button className="results-back-btn" onClick={onBack}>
        ╔══════════════════╗<br />
        ║  VOLVER AL MENU ║<br />
        ╚══════════════════╝
      </button>
    </div>
  );
}
