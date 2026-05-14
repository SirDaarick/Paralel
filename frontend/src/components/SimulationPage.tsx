import { useState, useCallback, useMemo } from "react";
import type { ReplayData } from "../hooks/api-types";
import { SimulationPanel } from "./SimulationPanel";
import "./SimulationPage.css";

interface SimulationPageProps {
  replays: ReplayData[];
  onResults: () => void;
  lookAhead: number;
}

const SPEEDS = [0.25, 0.5, 1, 2, 5, Infinity];

function totalAnimMs(replay: ReplayData): number {
  let sum = 0;
  for (const m of replay.moves) {
    sum += m.decisionTimeMs;
    if (m.linesCleared > 0) {
      sum += 100 + 150 + 120;
    } else {
      sum += 100 + 30;
    }
  }
  return sum;
}

export function SimulationPage({ replays, onResults, lookAhead }: SimulationPageProps) {
  const [speedIdx, setSpeedIdx] = useState(2);
  const baseSpeed = SPEEDS[speedIdx];

  const panelSpeeds = useMemo(() => {
    if (replays.length <= 1) return replays.map(() => baseSpeed);
    const totals = replays.map(totalAnimMs);
    const maxTotal = Math.max(...totals, 1);
    return replays.map((_, i) => {
      const ratio = maxTotal / Math.max(totals[i], 1);
      return baseSpeed * Math.min(ratio, 3);
    });
  }, [replays, baseSpeed]);

  const decSpeed = useCallback(() => setSpeedIdx((i) => Math.max(0, i - 1)), []);
  const incSpeed = useCallback(() => setSpeedIdx((i) => Math.min(SPEEDS.length - 1, i + 1)), []);

  const speedLabel = baseSpeed === Infinity ? "MAX" : `${baseSpeed}x`;

  return (
    <div className="simulation-page">
      <div className="sim-header">
        <h1 className="sim-title">paralel</h1>
        <div className="speed-controls">
          <button className="speed-btn" onClick={decSpeed} disabled={speedIdx === 0}>−</button>
          <span className="speed-label">VEL: [{speedLabel}]</span>
          <button className="speed-btn" onClick={incSpeed} disabled={speedIdx === SPEEDS.length - 1}>+</button>
        </div>
      </div>

      <div className="sim-panels">
        {replays.map((replay, i) => (
          <SimulationPanel
            key={replay.algorithm}
            replay={replay}
            lookAhead={lookAhead}
            speedMultiplier={panelSpeeds[i]}
          />
        ))}
      </div>

      <button className="sim-results-btn" onClick={onResults}>
        ╔══════════════════════╗<br />
        ║  VER RESULTADOS     ║<br />
        ╚══════════════════════╝
      </button>
    </div>
  );
}
