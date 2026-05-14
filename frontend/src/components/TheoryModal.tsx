import { useState } from "react";
import "./TheoryModal.css";

interface TheoryModalProps {
  onClose: () => void;
}

function amdahl(N: number, P: number): number {
  return 1 / ((1 - P) + P / Math.max(N, 1));
}

function gustafson(N: number, P: number): number {
  const alpha = 1 - P;
  return Math.max(N, 1) - alpha * (Math.max(N, 1) - 1);
}

const PROCESSORS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

export function TheoryModal({ onClose }: TheoryModalProps) {
  const [P, setP] = useState(0.95);
  const processValues = [8, 1024];

  const maxSpeedup = Math.max(
    ...processValues.map((n) => Math.max(amdahl(n, P), gustafson(n, P))),
    1
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">ANALISIS TEORICO</span>
          <button className="modal-close" onClick={onClose}>[X]</button>
        </div>

        <div className="theory-body">
          <div className="theory-section">
            <div className="theory-formula">
              Ley de Amdahl: S(N) = 1 / ((1-P) + P/N)
            </div>
            <div className="theory-formula">
              Ley de Gustafson: S(N) = N - (1-P)(N-1)
            </div>

            <div className="theory-slider-row">
              <span className="theory-slider-label">Fraccion paralelizable (P):</span>
              <span className="theory-slider-val">{P.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.999}
              step={0.001}
              value={P}
              onChange={(e) => setP(Number(e.target.value))}
              className="theory-slider"
            />
          </div>

          <div className="theory-graphs">
            <div className="theory-graph-title">
              Speedup teorico por procesadores (P = {P.toFixed(2)})
            </div>
            <div className="theory-bars">
              {PROCESSORS.map((N) => {
                const aVal = amdahl(N, P);
                const gVal = gustafson(N, P);
                const aPct = (aVal / maxSpeedup) * 100;
                const gPct = (gVal / maxSpeedup) * 100;

                return (
                  <div key={N} className="theory-bar-group">
                    <div className="theory-bar-row">
                      <span className="bar-label-bar">N={N}</span>
                      <div className="bar-track">
                        <div className="bar-fill bar-amdahl" style={{ width: `${aPct}%` }} />
                      </div>
                      <span className="bar-val">{aVal.toFixed(1)}x</span>
                    </div>
                    <div className="theory-bar-row">
                      <span className="bar-label-bar"></span>
                      <div className="bar-track">
                        <div className="bar-fill bar-gustafson" style={{ width: `${gPct}%` }} />
                      </div>
                      <span className="bar-val">{gVal.toFixed(1)}x</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="theory-legend">
              <span className="legend-item"><span className="legend-swatch bar-amdahl" /> Amdahl (carga fija)</span>
              <span className="legend-item"><span className="legend-swatch bar-gustafson" /> Gustafson (carga escalada)</span>
            </div>
          </div>

          <div className="theory-table-section">
            <div className="theory-table-title">Comparacion: P = {P.toFixed(2)}</div>
            <table className="theory-table">
              <thead>
                <tr>
                  <th>Procesadores</th>
                  <th>Amdahl</th>
                  <th>Gustafson</th>
                  <th>Eficiencia (A)</th>
                  <th>Eficiencia (G)</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024].map((N) => {
                  const a = amdahl(N, P);
                  const g = gustafson(N, P);
                  return (
                    <tr key={N}>
                      <td>{N}</td>
                      <td className="val-amdahl">{a.toFixed(2)}x</td>
                      <td className="val-gustafson">{g.toFixed(2)}x</td>
                      <td>{((a / N) * 100).toFixed(0)}%</td>
                      <td>{((g / N) * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="theory-note">
            Amdahl asume carga de trabajo fija (problema de tamano constante).
            <br />
            Gustafson asume que la carga paralela crece con los procesadores.
            <br />
            En nuestro Tetris: P ≈ 0.95 (95% del codigo es paralelizable — busqueda de fuerza bruta).
            <br />
            OpenMP usa 8 nucleos CPU. CUDA usa ~1024+ nucleos GPU.
          </div>
        </div>
      </div>
    </div>
  );
}
