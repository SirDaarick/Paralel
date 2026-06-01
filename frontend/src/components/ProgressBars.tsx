import "./ProgressBars.css";

interface ProgressBarsProps {
  progress: number;
  currentAlgorithm: string;
  lookAhead: number;
}

const ALGOS = [
  { key: "seq", label: "SECUENCIAL", color: "#ff3333" },
  { key: "omp", label: "OpenMP", color: "#00ff00" },
  { key: "cuda", label: "CUDA", color: "#00ffff" },
];

const PHASE_START = [0, 33, 66];
const PHASE_END = [33, 66, 100];

export function ProgressBars({ progress, currentAlgorithm, lookAhead }: ProgressBarsProps) {
  return (
    <div className="progress-container">
      <div className="progress-title">SIMULANDO [look-ahead: {lookAhead}]</div>
      <div className="progress-bars">
        {ALGOS.map((algo, i) => {
          const phaseStart = PHASE_START[i];
          const phaseEnd = PHASE_END[i];
          const isStarted = progress >= phaseStart;
          const isCurrent = isStarted && algo.key === currentAlgorithm;

          const pct = !isStarted ? 0 :
            progress >= phaseEnd ? 100 :
            ((progress - phaseStart) / (phaseEnd - phaseStart)) * 100;

          let statusText = "ESPERANDO";
          let statusClass = "status-waiting";
          if (isCurrent) {
            statusText = "EJECUTANDO...";
            statusClass = "status-running";
          } else if (progress >= phaseEnd) {
            statusText = "COMPLETADO";
            statusClass = "status-done";
          }

          return (
            <div key={algo.key} className={`progress-row${isCurrent ? " running" : ""}`}>
              <span className="progress-label" style={{ color: algo.color }}>
                {algo.label}
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: algo.color,
                  }}
                />
              </div>
              <span className={`progress-status ${statusClass}`}>
                {statusText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
