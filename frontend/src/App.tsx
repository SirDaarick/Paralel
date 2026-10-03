import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { MenuPage } from "./components/MenuPage";
import { SimulationPage } from "./components/SimulationPage";
import { ResultsPage } from "./components/ResultsPage";
import { ProgressBars } from "./components/ProgressBars";
import { TheoryModal } from "./components/TheoryModal";
import { useSimulation } from "./hooks/useSimulation";
import { useMpiSimulation } from "./hooks/useMpiSimulation";
import { ALGO_META } from "./hooks/api-types";
import type { SimulationResult } from "./hooks/api-types";
import { simulationService } from "./services";
import "./App.css";

const HISTORY_KEY = "paralel_history";

interface HistoryEntry {
  id: string;
  date: string;
  lookAhead: number;
  result: SimulationResult;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entry: HistoryEntry) {
  const history = loadHistory();
  const filtered = history.filter((h) => h.id !== entry.id);
  filtered.unshift(entry);
  if (filtered.length > 10) filtered.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
}

const MPI_ALGOS = [
  { key: "mpi", label: ALGO_META.mpi.label, color: ALGO_META.mpi.color },
  { key: "cuda", label: ALGO_META.cuda.label, color: ALGO_META.cuda.color },
];

export default function App() {
  const navigate = useNavigate();
  const [lookAhead, setLookAhead] = useState(2);
  const [simMode, setSimMode] = useState<"classic" | "mpi">("classic");
  const [mpiAvailable, setMpiAvailable] = useState(false);

  // Both hooks are always instantiated (React rules); only the active one is used
  const classicSim = useSimulation({ lookAhead });
  const mpiSim = useMpiSimulation({ lookAhead });

  // Derive effective mode: fall back to classic if MPI unavailable
  const effectiveSimMode: "classic" | "mpi" =
    simMode === "mpi" && !mpiAvailable ? "classic" : simMode;

  // Derive active simulation based on mode
  const activeSim = effectiveSimMode === "classic" ? classicSim : mpiSim;
  const { status, result, error, progress, currentAlgorithm } = activeSim;

  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [loadFromHistory, setLoadFromHistory] = useState<SimulationResult | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  // Check MPI availability on mount
  useEffect(() => {
    simulationService
      .checkHealth()
      .then((health) => setMpiAvailable(health.mpi))
      .catch(() => setMpiAvailable(false));
  }, []);

  const handleStart = () => {
    setLoadFromHistory(null);
    navigate("/simulation");
    if (effectiveSimMode === "classic") {
      classicSim.start();
    } else {
      mpiSim.start();
    }
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setLoadFromHistory(entry.result);
    setLookAhead(entry.lookAhead);
    navigate("/simulation");
  };

  const handleBack = () => {
    classicSim.reset();
    mpiSim.reset();
    setLoadFromHistory(null);
    navigate("/");
    setHistory(loadHistory());
  };

  const handleResults = () => {
    navigate("/results");
  };

  // Save completed simulation to history
  useEffect(() => {
    if (status === "completed" && result && !loadFromHistory) {
      const entry: HistoryEntry = {
        id: Date.now().toString(36),
        date: new Date().toLocaleString(),
        lookAhead,
        result,
      };
      saveHistory(entry);
      setHistory(loadHistory());
    }
  }, [status, result, lookAhead, loadFromHistory]);

  const isSimActive = status !== "idle";

  /* ---------- / (Menu) ---------- */
  const menuElement = (
    <>
      {showTheory && <TheoryModal onClose={() => setShowTheory(false)} />}
      <MenuPage
        lookAhead={lookAhead}
        onLookAheadChange={setLookAhead}
        onStart={handleStart}
        onTheory={() => setShowTheory(true)}
        history={history}
        onHistorySelect={handleHistorySelect}
        isStarting={isSimActive}
        simMode={simMode}
        onSimModeChange={setSimMode}
        mpiAvailable={mpiAvailable}
      />
    </>
  );

  /* ---------- /simulation ---------- */
  let simContent: React.ReactNode;

  if (loadFromHistory) {
    simContent = (
      <SimulationPage
        replays={loadFromHistory.replays}
        onResults={handleResults}
        lookAhead={lookAhead}
      />
    );
  } else if (status === "error") {
    simContent = (
      <div className="app-center">
        <div className="error-box">
          <p className="err-text">ERROR: {error}</p>
          <button className="retro-btn" onClick={handleBack}>VOLVER</button>
        </div>
      </div>
    );
  } else if (status === "running" || status === "starting") {
    simContent = (
      <div className="app-center">
        <ProgressBars
          progress={progress}
          currentAlgorithm={currentAlgorithm}
          lookAhead={lookAhead}
          algorithms={effectiveSimMode === "mpi" ? MPI_ALGOS : undefined}
        />
      </div>
    );
  } else if (status === "completed" && result) {
    simContent = (
      <SimulationPage
        replays={result.replays}
        onResults={handleResults}
        lookAhead={lookAhead}
      />
    );
  } else {
    simContent = (
      <div className="app-center">
        <p className="loading-text">INICIANDO...</p>
      </div>
    );
  }

  const simulationElement = <>{simContent}</>;

  /* ---------- /results ---------- */
  const resultsElement =
    result || loadFromHistory ? (
      <ResultsPage
        replays={(result ?? loadFromHistory)!.replays}
        lookAhead={lookAhead}
        onBack={handleBack}
      />
    ) : (
      <div className="app-center">
        <p className="err-text">No hay resultados disponibles</p>
        <button className="retro-btn" onClick={() => navigate("/")}>VOLVER</button>
      </div>
    );

  return (
    <Routes>
      <Route path="/" element={menuElement} />
      <Route path="/simulation" element={simulationElement} />
      <Route path="/results" element={resultsElement} />
      <Route path="*" element={menuElement} />
    </Routes>
  );
}
