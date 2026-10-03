import "./ProgressBars.css";

interface AlgoDef {
  key: string;
  label: string;
  color: string;
}

interface ProgressBarsProps {
  progress: number;
  currentAlgorithm: string;
  lookAhead: number;
  algorithms?: AlgoDef[];
}

const CLASSIC_ALGOS: AlgoDef[] = [
  { key: "seq", label: "SECUENCIAL", color: "#ff3333" },
  { key: "omp", label: "OpenMP", color: "#00ff00" },
  { key: "cuda", label: "CUDA", color: "#00ffff" },
];

const CLASSIC_PHASE_START = [0, 33, 66];
const CLASSIC_PHASE_END = [33, 66, 100];

export function ProgressBars({ progress, currentAlgorithm, lookAhead, algorithms }: ProgressBarsProps) {
  const algos = algorithms ?? CLASSIC_ALGOS;

  // Compute phase boundaries: evenly distributed across 0-100
  const n = algos.length;
  const phaseWidth = 100 / n;
  const phaseStart = (i: number) => i * phaseWidth;
  const phaseEnd = (i: number) => (i + 1) * phaseWidth;

  // Use classic fixed phases for backward-compatible 3-algorithm behavior
  const getPhaseStart = (i: number) =>
    !algorithms && n === 3 ? CLASSIC_PHASE_START[i] : phaseStart(i);
  const getPhaseEnd = (i: number) =>
    !algorithms && n === 3 ? CLASSIC_PHASE_END[i] : phaseEnd(i);

  return (
    <div className="progress-container">
      <div className="progress-title">SIMULANDO [look-ahead: {lookAhead}]</div>
      <div className="progress-bars">
        {algos.map((algo, i) => {
          const start = getPhaseStart(i);
          const end = getPhaseEnd(i);
          const isStarted = progress >= start;
          const isCurrent = isStarted && algo.key === currentAlgorithm;

          const pct = !isStarted ? 0 :
            progress >= end ? 100 :
            ((progress - start) / (end - start)) * 100;

          let statusText = "ESPERANDO";
          let statusClass = "status-waiting";
          if (isCurrent) {
            statusText = "EJECUTANDO...";
            statusClass = "status-running";
          } else if (progress >= end) {
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
