import type { ReplayData } from "../hooks/api-types";
import { ALGO_META, ALGO_ORDER } from "../hooks/api-types";
import "./ComparisonChart.css";

interface ComparisonChartProps {
  replays: ReplayData[];
}

export function ComparisonChart({ replays }: ComparisonChartProps) {
  const sorted = [...replays].sort(
    (a, b) => ALGO_ORDER.indexOf(a.algorithm) - ALGO_ORDER.indexOf(b.algorithm)
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
          const meta = ALGO_META[r.algorithm];
          const color = meta?.color ?? "#a0a0a0";
          const label = meta?.label ?? r.algorithm.toUpperCase();
          return (
            <div key={r.algorithm} className="chart-row">
              <span className="chart-label" style={{ color }}>
                {label}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
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
          const meta = ALGO_META[r.algorithm];
          const color = meta?.color ?? "#a0a0a0";
          const label = meta?.label ?? r.algorithm.toUpperCase();
          return (
            <div key={r.algorithm} className="chart-row">
              <span className="chart-label" style={{ color }}>
                {label}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
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
          const meta = ALGO_META[r.algorithm];
          const color = meta?.color ?? "#a0a0a0";
          const label = meta?.label ?? r.algorithm.toUpperCase();
          return (
            <div key={r.algorithm} className="chart-row">
              <span className="chart-label" style={{ color }}>
                {label}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
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
