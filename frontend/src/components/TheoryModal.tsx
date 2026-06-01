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

function formatNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function formatTime(ms: number): string {
  if (ms >= 1000) return ms >= 60000 ? (ms / 60000).toFixed(0) + " min" : (ms / 1000).toFixed(0) + " s";
  return ms.toFixed(ms < 1 ? 2 : 0) + " ms";
}

type TabId = "como-funciona" | "secuencial" | "openmp" | "cuda";

interface TabProps {
  id: TabId;
  label: string;
  active: boolean;
  onClick: (id: TabId) => void;
}

function TabBtn({ id, label, active, onClick }: TabProps) {
  return (
    <button
      className={`tab-btn ${active ? "tab-btn--active" : ""}`}
      onClick={() => onClick(id)}
    >
      {label}
    </button>
  );
}

const LOOKAHEAD_DATA = [
  { n: 0, combos: 40, ops: 36000 },
  { n: 1, combos: 1600, ops: 1500000 },
  { n: 2, combos: 64000, ops: 58000000 },
  { n: 3, combos: 2560000, ops: 2300000000 },
  { n: 4, combos: 102400000, ops: 93000000000 },
  { n: 5, combos: 4096000000, ops: 3700000000000 },
];

function CombosChart() {
  const [tooltip, setTooltip] = useState<{ n: number; combos: number; x: number; y: number } | null>(null);

  const W = 520;
  const H = 220;
  const PAD_LEFT = 60;
  const PAD_BOT = 40;
  const PAD_TOP = 20;
  const PAD_RIGHT = 20;
  const barW = 52;
  const gap = 16;

  const maxCombos = LOOKAHEAD_DATA[5].combos;
  const barAreaH = H - PAD_TOP - PAD_BOT;

  return (
    <div className="svg-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
        {/* Y axis grid lines + labels */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = PAD_TOP + barAreaH - (i / 5) * barAreaH;
          const val = (i / 5) * maxCombos;
          return (
            <g key={i}>
              <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" className="svg-label">
                {formatNum(val)}
              </text>
            </g>
          );
        })}
        {/* X axis labels */}
        {LOOKAHEAD_DATA.map((d) => {
          const x = PAD_LEFT + d.n * (barW + gap) + barW / 2;
          return (
            <text key={d.n} x={x} y={H - 8} textAnchor="middle" className="svg-label">
              N={d.n}
            </text>
          );
        })}
        {/* Bars */}
        {LOOKAHEAD_DATA.map((d) => {
          const barH = (d.combos / maxCombos) * barAreaH;
          const x = PAD_LEFT + d.n * (barW + gap);
          const y = PAD_TOP + barAreaH - barH;
          const isHovered = tooltip?.n === d.n;
          return (
            <g key={d.n}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                className={`svg-bar ${d.n <= 3 ? "svg-bar--cyan" : "svg-bar--magenta"}`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parent = (e.currentTarget.closest(".svg-chart-wrap") as HTMLElement).getBoundingClientRect();
                  setTooltip({ n: d.n, combos: d.combos, x: rect.left - parent.left + barW / 2, y: rect.top - parent.top - 8 });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className={`svg-bar-label ${isHovered ? "svg-bar-label--visible" : ""}`}
              >
                {formatNum(d.combos)}
              </text>
            </g>
          );
        })}
        {/* Axis */}
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={H - PAD_BOT} stroke="var(--color-dim)" strokeWidth="1" />
        <line x1={PAD_LEFT} y1={H - PAD_BOT} x2={W - PAD_RIGHT} y2={H - PAD_BOT} stroke="var(--color-dim)" strokeWidth="1" />
      </svg>
      {tooltip && (
        <div className="svg-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          N={tooltip.n}: {tooltip.combos.toLocaleString()}
        </div>
      )}
    </div>
  );
}

const SECUENTIAL_DATA = [
  { n: 0, ms: 0.01 },
  { n: 1, ms: 0.5 },
  { n: 2, ms: 15 },
  { n: 3, ms: 500 },
  { n: 4, ms: 15000 },
  { n: 5, ms: 600000 },
];

function SequentialChart() {
  const [tooltip, setTooltip] = useState<{ n: number; ms: number; x: number; y: number } | null>(null);

  const W = 520;
  const H = 220;
  const PAD_LEFT = 70;
  const PAD_BOT = 40;
  const PAD_TOP = 20;
  const PAD_RIGHT = 20;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const barAreaH = H - PAD_TOP - PAD_BOT;
  const stepX = chartW / 5;

  const points = SECUENTIAL_DATA.map((d, i) => {
    const x = PAD_LEFT + i * stepX;
    const maxMs = SECUENTIAL_DATA[5].ms;
    const logVal = Math.log10(d.ms + 0.01) - Math.log10(0.01);
    const logMax = Math.log10(maxMs + 0.01) - Math.log10(0.01);
    const barH = (logVal / logMax) * barAreaH;
    return { x, barH, ...d };
  });

  return (
    <div className="svg-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
        {/* Y axis labels */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((frac) => {
          const y = PAD_TOP + barAreaH - frac * barAreaH;
          const logVal = Math.log10(0.01) + frac * (Math.log10(600000.01) - Math.log10(0.01));
          const val = Math.pow(10, logVal);
          return (
            <g key={frac}>
              <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" className="svg-label">
                {formatTime(val)}
              </text>
            </g>
          );
        })}
        {/* X axis labels */}
        {SECUENTIAL_DATA.map((d, i) => {
          const x = PAD_LEFT + i * stepX;
          return (
            <text key={d.n} x={x} y={H - 8} textAnchor="middle" className="svg-label">
              N={d.n}
            </text>
          );
        })}
        {/* Connecting line */}
        <polyline
          fill="none"
          stroke="var(--color-yellow)"
          strokeWidth="1.5"
          strokeOpacity="0.6"
          points={points.map((p) => `${p.x},${PAD_TOP + barAreaH - p.barH}`).join(" ")}
        />
        {/* Points + bars */}
        {points.map((p) => {
          const barW = 40;
          const x = p.x - barW / 2;
          const y = PAD_TOP + barAreaH - p.barH;
          const isHovered = tooltip?.n === p.n;
          return (
            <g key={p.n}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={p.barH}
                className={`svg-bar svg-bar--yellow ${isHovered ? "svg-bar--hover" : ""}`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parent = (e.currentTarget.closest(".svg-chart-wrap") as HTMLElement).getBoundingClientRect();
                  setTooltip({ n: p.n, ms: p.ms, x: rect.left - parent.left + barW / 2, y: rect.top - parent.top - 8 });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={p.x}
                y={y - 6}
                textAnchor="middle"
                className={`svg-bar-label ${isHovered ? "svg-bar-label--visible" : ""}`}
              >
                {formatTime(p.ms)}
              </text>
            </g>
          );
        })}
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={H - PAD_BOT} stroke="var(--color-dim)" strokeWidth="1" />
        <line x1={PAD_LEFT} y1={H - PAD_BOT} x2={W - PAD_RIGHT} y2={H - PAD_BOT} stroke="var(--color-dim)" strokeWidth="1" />
      </svg>
      {tooltip && (
        <div className="svg-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          N={tooltip.n}: {formatTime(tooltip.ms)}
        </div>
      )}
    </div>
  );
}

function AmdahlGustafsonChart({ defaultP, note, defaultProcessors }: { defaultP: number; note: string; defaultProcessors: number[] }) {
  const [P, setP] = useState(defaultP);
  const processValues = defaultProcessors;

  const maxSpeedup = Math.max(
    ...processValues.map((n) => Math.max(amdahl(n, P), gustafson(n, P))),
    1
  );

  return (
    <div className="ag-chart-section">
      <div className="ag-slider-row">
        <span className="ag-label">Fracción paralelizable (f):</span>
        <span className="ag-val">{P.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={0.999}
        step={0.001}
        value={P}
        onChange={(e) => setP(Number(e.target.value))}
        className="ag-slider"
      />

      <div className="ag-bars">
        {processValues.map((N) => {
          const aVal = amdahl(N, P);
          const gVal = gustafson(N, P);
          const aPct = (aVal / maxSpeedup) * 100;
          const gPct = (gVal / maxSpeedup) * 100;
          return (
            <div key={N} className="ag-bar-group">
              <div className="ag-bar-row">
                <span className="ag-bar-label">N={N}</span>
                <div className="ag-bar-track">
                  <div className="ag-bar-fill ag-bar-amdahl" style={{ width: `${aPct}%` }} />
                </div>
                <span className="ag-bar-val">{aVal.toFixed(1)}×</span>
              </div>
              <div className="ag-bar-row">
                <span className="ag-bar-label" />
                <div className="ag-bar-track">
                  <div className="ag-bar-fill ag-bar-gustafson" style={{ width: `${gPct}%` }} />
                </div>
                <span className="ag-bar-val">{gVal.toFixed(1)}×</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ag-legend">
        <span className="ag-legend-item"><span className="ag-swatch ag-bar-amdahl" /> Amdahl (carga fija)</span>
        <span className="ag-legend-item"><span className="ag-swatch ag-bar-gustafson" /> Gustafson (carga escalada)</span>
      </div>

      <table className="ag-table">
        <thead>
          <tr>
            <th>Procesadores</th>
            <th>Amdahl</th>
            <th>Gustafson</th>
          </tr>
        </thead>
        <tbody>
          {processValues.map((N) => (
            <tr key={N}>
              <td>{N}</td>
              <td className="ag-val--magenta">{amdahl(N, P).toFixed(2)}×</td>
              <td className="ag-val--cyan">{gustafson(N, P).toFixed(2)}×</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ag-note">{note}</div>
    </div>
  );
}

export function TheoryModal({ onClose }: TheoryModalProps) {
  const [tab, setTab] = useState<TabId>("como-funciona");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">ANALISIS TEORICO</span>
          <button className="modal-close" onClick={onClose}>[X]</button>
        </div>

        <div className="tab-bar">
          <TabBtn id="como-funciona" label="COMO FUNCIONA" active={tab === "como-funciona"} onClick={setTab} />
          <TabBtn id="secuencial" label="SECUENCIAL" active={tab === "secuencial"} onClick={setTab} />
          <TabBtn id="openmp" label="OPENMP" active={tab === "openmp"} onClick={setTab} />
          <TabBtn id="cuda" label="CUDA" active={tab === "cuda"} onClick={setTab} />
        </div>

        <div className="modal-body">
          {tab === "como-funciona" && <ComoFunciona />}
          {tab === "secuencial" && <Secuencial />}
          {tab === "openmp" && <OpenMP />}
          {tab === "cuda" && <Cuda />}
        </div>
      </div>
    </div>
  );
}

function ComoFunciona() {
  return (
    <div className="tab-content">
      <p className="tb-p">
        El algoritmo de Tetris AI usa <span className="tb-hl">b&uacute;squeda por fuerza bruta con look-ahead</span>.
        Para cada pieza, eval&uacute;a todas las posiciones posibles y elige la que minimiza una <span className="tb-hl">funci&oacute;n heur&iacute;stica</span>.
      </p>

      <ul className="tb-ul">
        <li>Cada pieza puede colocarse en <span className="tb-hl">10 columnas × 4 rotaciones = 40 posiciones</span>.</li>
        <li>Para cada posici&oacute;n, el algoritmo <span className="tb-hl">simula</span> la ca&iacute;da de la pieza, limpia l&iacute;neas completas y eval&uacute;a el tablero resultante.</li>
        <li>La heur&iacute;stica es: <span className="tb-code">altura + huecos</span> — cuanto m&aacute;s bajo y sin huecos, mejor.</li>
        <li>Con <span className="tb-hl">look-ahead N</span>, el algoritmo eval&uacute;a todas las combinaciones de N+1 piezas: <span className="tb-code">40^(N+1)</span> posiciones.</li>
        <li>Esto implica un <span className="tb-hl">crecimiento exponencial</span> del espacio de b&uacute;squeda.</li>
      </ul>

      <div className="tb-subtitle">Explosión combinatoria</div>
      <table className="tb-table">
        <thead>
          <tr>
            <th>Look-ahead (N)</th>
            <th>Combinaciones</th>
            <th>Ops por decisi&oacute;n</th>
          </tr>
        </thead>
        <tbody>
          {LOOKAHEAD_DATA.map((d) => (
            <tr key={d.n}>
              <td className="tb-td--cyan">{d.n}</td>
              <td>{d.combos.toLocaleString()}</td>
              <td>{d.ops >= 1e9 ? (d.ops / 1e9).toFixed(1) + " B" : d.ops >= 1e6 ? (d.ops / 1e6).toFixed(1) + " M" : d.ops.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tb-subtitle">Crecimiento exponencial de combinaciones</div>
      <CombosChart />

      <div className="tb-subtitle">Árbol de búsqueda</div>
      <pre className="tb-ascii">
{`Pieza actual (T)           \u2190 Nivel 0: 40 posiciones
  \u251c\u2500\u2500 x=0, rot=0 \u2192 Pieza S:
  \u2502     \u251c\u2500\u2500 x=0, rot=0 \u2192 eval\u00faa tablero  \u2190 HOJA
  \u2502     \u2502   ... (40 posiciones)
  \u2502     \u2502   ... (40 posiciones)
  \u2502     \u2514\u2500\u2500 x=9, rot=3 \u2192 eval\u00faa tablero
  \u2514\u2500\u2500 ... (40 posiciones)`}
      </pre>
    </div>
  );
}

function Secuencial() {
  return (
    <div className="tab-content">
      <p className="tb-p">
        El solver secuencial explora el &aacute;rbol de b&uacute;squeda en <span className="tb-hl">profundidad primero (DFS)</span>,
        evaluando una rama completa antes de pasar a la siguiente.
      </p>

      <div className="tb-subtitle">Pseudocódigo</div>
      <pre className="tb-code-block">
{`function evaluar(pieza, tablero, profundidad):
    si profundidad == 0:
        retornar altura(tablero) + huecos(tablero)

    mejor = INFINITO
    para cada columna x de 0..9:
        para cada rotacion r de 0..3:
            copia = simular_caida(pieza, x, r, tablero)
            copia = limpiar_lineas(copia)
            siguientes = piezas_siguientes[0]
            score = evaluar(siguientes, copia, profundidad - 1)
            mejor = min(mejor, score)

    retornar mejor`}
      </pre>

      <p className="tb-p">
        Cada decisi&oacute;n recorre <span className="tb-code">40^(N+1)</span> nodos hoja.
        El tiempo crece exponencialmente con N:
      </p>

      <div className="tb-subtitle">Tiempo por decisión vs Look-ahead</div>
      <SequentialChart />

      <table className="tb-table">
        <thead>
          <tr>
            <th>Look-ahead (N)</th>
            <th>Tiempo por decisi&oacute;n</th>
            <th>Escala</th>
          </tr>
        </thead>
        <tbody>
          {SECUENTIAL_DATA.map((d) => (
            <tr key={d.n}>
              <td className="tb-td--cyan">{d.n}</td>
              <td>{formatTime(d.ms)}</td>
              <td>{d.n === 0 ? "Base" : `~${(d.ms / SECUENTIAL_DATA[d.n - 1].ms).toFixed(0)}×`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="tb-p">
        A N=5, cada decisi&oacute;n tarda ~10 minutos. El juego a 1 decisi&oacute;n/segundo con N=5
        tomar&iacute;a <span className="tb-hl">~3.7 billones de operaciones por decisi&oacute;n</span>, totalmente inviable en secuencial para uso en tiempo real.
        <br /><br />
        <span className="tb-hl">La paralelizaci&oacute;n es esencial</span> para reducir este tiempo a niveles pr&aacute;cticos.
      </p>
    </div>
  );
}

function OpenMP() {
  return (
    <div className="tab-content">
      <p className="tb-p">
        OpenMP distribuye la b&uacute;squeda entre los <span className="tb-hl">n&uacute;cleos del CPU</span>.
        Las <span className="tb-hl">40 posiciones del nivel ra&iacute;z son independientes</span>, lo que permite
        paralelizarlas f&aacute;cilmente con <span className="tb-code">#pragma omp parallel for</span>.
      </p>

      <div className="tb-subtitle">Código paralelo</div>
      <pre className="tb-code-block">
{`#pragma omp parallel for schedule(dynamic)
for (int r = 0; r < 4; r++) {
    for (int c = 0; c < 10; c++) {
        Board copy = board;
        simulate_drop(&copy, piece, c, r);
        clear_lines(&copy);

        #pragma omp critical
        {
            if (score < best_score) {
                best_score = score;
                best_col = c;
                best_rot = r;
            }
        }
    }
}`}
      </pre>

      <ul className="tb-ul">
        <li><span className="tb-code">schedule(dynamic)</span> distribuye trabajo din&aacute;micamente entre hilos.</li>
        <li><span className="tb-code">#pragma omp critical</span> protege la actualizaci&oacute;n del mejor score (condici&oacute;n de carrera benigna).</li>
        <li>Los 40 sub&aacute;rboles se reparten entre los <span className="tb-hl">8 hilos</span> del CPU.</li>
        <li>Entre m&aacute;s profundidad (N), m&aacute;s trabajo paralelo hay disponible.</li>
      </ul>

      <div className="tb-subtitle">Valores del proyecto</div>
      <ul className="tb-ul">
        <li>Fracci&oacute;n paralelizable: <span className="tb-code">f &asymp; 0.80</span> (80% del c&oacute;digo es paralelo)</li>
        <li>Probado en: <span className="tb-hl">8 hilos</span> (CPU f&iacute;sico)</li>
      </ul>

      <div className="tb-subtitle">Leyes de Amdahl y Gustafson</div>
      <AmdahlGustafsonChart
        defaultP={0.80}
        defaultProcessors={[1, 2, 4, 8, 16, 32, 64]}
        note="OpenMP satura los 8 hilos del CPU. La parte secuencial (fricción de sincronización + I/O) limita el speedup máximo teórico a ~5.0× según Amdahl."
      />
    </div>
  );
}

function Cuda() {
  return (
    <div className="tab-content">
      <p className="tb-p">
        CUDA usa un enfoque radicalmente diferente: <span className="tb-hl">aplanar todo el &aacute;rbol de b&uacute;squeda</span> en
        un espacio lineal y asignar cada camino a un <span className="tb-hl">hilo de la GPU</span>.
      </p>

      <div className="tb-subtitle">Estrategia CUDA</div>
      <ul className="tb-ul">
        <li>Codifica cada camino del &aacute;rbol como un n&uacute;mero en <span className="tb-hl">base 40</span>: cada d&iacute;gito representa una de las 40 posiciones de una pieza.</li>
        <li>Usa un <span className="tb-hl">grid-strided loop</span>: no un hilo por camino, sino hilos fijos que procesan m&uacute;ltiples caminos.</li>
        <li><span className="tb-code">blockIdx.x * blockDim.x + threadIdx.x</span> determina el &iacute;ndice base, y `gridDim.x * blockDim.x` es el stride.</li>
        <li>Memoria <span className="tb-hl">constante</span> para las piezas (cache de solo lectura).</li>
        <li><span className="tb-hl">Registros por hilo</span> para el estado del tablero — sin heap en GPU.</li>
        <li><span className="tb-hl">Condici&oacute;n de carrera benigna</span>: m&uacute;ltiples hilos escriben al mismo `best_score` sin locks, y al final convergen al m&iacute;nimo.</li>
      </ul>

      <div className="tb-subtitle">Valores del proyecto</div>
      <ul className="tb-ul">
        <li>Fracci&oacute;n paralelizable: <span className="tb-code">f &asymp; 0.86</span> (86% del c&oacute;digo es paralelo)</li>
        <li>Hardware: <span className="tb-hl">896 CUDA cores</span></li>
        <li>Con 896 cores, Amdahl predice <span className="tb-hl">~7.1×</span> de speedup.</li>
        <li>Gustafson (carga escalada) predice <span className="tb-hl">~770×</span> con 896 cores.</li>
      </ul>

      <div className="tb-subtitle">Leyes de Amdahl y Gustafson</div>
      <AmdahlGustafsonChart
        defaultP={0.86}
        defaultProcessors={[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]}
        note="CUDA aplana todo el árbol. Con 896 cores, el speedup medido es ~7.2×, validando la predicción de Amdahl. Gustafson muestra que el modelo escala bien si la carga de trabajo crece con los procesadores."
      />
    </div>
  );
}
