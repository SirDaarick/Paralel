import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { MenuPage } from "./components/MenuPage";
import { SimulationPage } from "./components/SimulationPage";
import { ResultsPage } from "./components/ResultsPage";
import { ProgressBars } from "./components/ProgressBars";
import { TheoryModal } from "./components/TheoryModal";
import { useSimulation } from "./hooks/useSimulation";
import type { SimulationResult } from "./hooks/api-types";
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

export default function App() {
  const navigate = useNavigate();
  const [lookAhead, setLookAhead] = useState(2);
  const { status, result, error, progress, currentAlgorithm, start, reset } =
    useSimulation({ lookAhead });
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [loadFromHistory, setLoadFromHistory] = useState<SimulationResult | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  const handleStart = () => {
    setLoadFromHistory(null);
    navigate("/simulation");
    start();
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setLoadFromHistory(entry.result);
    setLookAhead(entry.lookAhead);
    navigate("/simulation");
  };

  const handleBack = () => {
    reset();
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
