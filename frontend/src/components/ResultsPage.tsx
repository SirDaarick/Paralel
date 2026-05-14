import type { ReplayData } from "../hooks/api-types";
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

const ALGORITHM_LABELS: Record<string, string> = {
  seq: "SECUENCIAL",
  omp: "OpenMP (CPU)",
  cuda: "CUDA (GPU)",
};

const ALGORITHM_ORDER = ["seq", "omp", "cuda"];

export function ResultsPage({ replays, lookAhead, onBack }: ResultsPageProps) {
  const sorted = [...replays].sort(
    (a, b) => ALGORITHM_ORDER.indexOf(a.algorithm) - ALGORITHM_ORDER.indexOf(b.algorithm)
  );

  return (
    <div className="results-page">
      <pre className="results-ascii">
        {`╔══════════════════════════════════╗
║     RESULTADOS DE SIMULACION    ║
╚══════════════════════════════════╝`}
      </pre>

      <div className="results-meta">
        LOOK-AHEAD: [{lookAhead}] — mismas piezas para los 3 algoritmos
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
            const variant = r.algorithm === "cuda" ? "cuda" :
                            r.algorithm === "omp" ? "omp" : "seq";
            return (
              <tr key={r.algorithm} className={`row-${variant}`}>
                <td className="col-label">
                  {ALGORITHM_LABELS[r.algorithm] ?? r.algorithm.toUpperCase()}
                </td>
                <td className="col-score">{r.finalScore}</td>
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
          return (
            <p>
              MAS RAPIDO: <span className="winner-name">
                {ALGORITHM_LABELS[best.algorithm] ?? best.algorithm}
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
