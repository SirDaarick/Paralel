import type { ReplayData } from "../hooks/api-types";
import "./ComparisonChart.css";

interface ComparisonChartProps {
  replays: ReplayData[];
}

const ALGO_COLORS: Record<string, string> = {
  seq: "#ff3333",
  omp: "#00ff00",
  cuda: "#00ffff",
};

const ALGO_LABELS: Record<string, string> = {
  seq: "SEQ",
  omp: "OMP",
  cuda: "CUDA",
};

const ORDER = ["seq", "omp", "cuda"];

export function ComparisonChart({ replays }: ComparisonChartProps) {
  const sorted = [...replays].sort(
    (a, b) => ORDER.indexOf(a.algorithm) - ORDER.indexOf(b.algorithm)
  );

  const maxPieces = Math.max(...sorted.map((r) => r.totalPieces), 1);
  const maxAvg = Math.max(
    ...sorted.map((r) => (r.totalPieces > 0 ? r.totalTimeMs / r.totalPieces : 0)),
    1
  );

  const seqAvg = sorted.find((r) => r.algorithm === "seq");
  const seqAvgMs = seqAvg && seqAvg.totalPieces > 0
    ? seqAvg.totalTimeMs / seqAvg.totalPieces : 1;

  return (
    <div className="charts">
      <div className="chart-section">
        <div className="chart-title">TIEMPO PROMEDIO POR DECISION (ms)</div>
        {sorted.map((r) => {
          const avg = r.totalPieces > 0 ? r.totalTimeMs / r.totalPieces : 0;
          const pct = (avg / maxAvg) * 100;
          return (
            <div key={r.algorithm} className="chart-row">
              <span className="chart-label" style={{ color: ALGO_COLORS[r.algorithm] }}>
                {ALGO_LABELS[r.algorithm]}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ALGO_COLORS[r.algorithm],
                  }}
                />
              </div>
              <span className="chart-value">{avg.toFixed(2)} ms</span>
            </div>
          );
        })}
      </div>

      <div className="chart-section">
        <div className="chart-title">PIEZAS COLOCADAS</div>
        {sorted.map((r) => {
          const pct = (r.totalPieces / maxPieces) * 100;
          return (
            <div key={r.algorithm} className="chart-row">
              <span className="chart-label" style={{ color: ALGO_COLORS[r.algorithm] }}>
                {ALGO_LABELS[r.algorithm]}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ALGO_COLORS[r.algorithm],
                  }}
                />
              </div>
              <span className="chart-value">{r.totalPieces}</span>
            </div>
          );
        })}
      </div>

      <div className="chart-section">
        <div className="chart-title">SPEEDUP vs SECUENCIAL</div>
        {sorted.map((r) => {
          const avg = r.totalPieces > 0 ? r.totalTimeMs / r.totalPieces : 0;
          const speedup = avg > 0 ? seqAvgMs / avg : 1;
          const pct = Math.min((speedup / Math.max(
            ...sorted.map((x) => {
              const a = x.totalPieces > 0 ? x.totalTimeMs / x.totalPieces : 0;
              return a > 0 ? seqAvgMs / a : 1;
            }), 1
          )) * 100, 100);
          return (
            <div key={r.algorithm} className="chart-row">
              <span className="chart-label" style={{ color: ALGO_COLORS[r.algorithm] }}>
                {ALGO_LABELS[r.algorithm]}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ALGO_COLORS[r.algorithm],
                  }}
                />
              </div>
              <span className="chart-value">{speedup.toFixed(1)}x</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
