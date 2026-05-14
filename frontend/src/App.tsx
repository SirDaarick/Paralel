import { useState, useEffect } from "react";
import { MenuPage } from "./components/MenuPage";
import { SimulationPage } from "./components/SimulationPage";
import { ResultsPage } from "./components/ResultsPage";
import { ProgressBars } from "./components/ProgressBars";
import { TheoryModal } from "./components/TheoryModal";
import { useSimulation } from "./hooks/useSimulation";
import type { SimulationResult } from "./hooks/api-types";
import "./App.css";

type Page = "menu" | "simulation" | "results";

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
  const [page, setPage] = useState<Page>("menu");
  const [lookAhead, setLookAhead] = useState(2);
  const { status, result, error, progress, currentAlgorithm, start, reset } =
    useSimulation({ lookAhead });
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [loadFromHistory, setLoadFromHistory] = useState<SimulationResult | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  const handleStart = () => {
    setLoadFromHistory(null);
    setPage("simulation");
    start();
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setLoadFromHistory(entry.result);
    setLookAhead(entry.lookAhead);
    setPage("simulation");
  };

  const handleBack = () => {
    reset();
    setLoadFromHistory(null);
    setPage("menu");
    setHistory(loadHistory());
  };

  const handleResults = () => {
    setPage("results");
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

  if (page === "simulation") {
    if (loadFromHistory) {
      return (
        <SimulationPage
          replays={loadFromHistory.replays}
          onResults={handleResults}
          lookAhead={lookAhead}
        />
      );
    }

    if (status === "error") {
      return (
        <div className="app-center">
          <div className="error-box">
            <p className="err-text">ERROR: {error}</p>
            <button className="retro-btn" onClick={handleBack}>VOLVER</button>
          </div>
        </div>
      );
    }

    if (status === "running" || status === "starting") {
      return (
        <div className="app-center">
          <ProgressBars
            progress={progress}
            currentAlgorithm={currentAlgorithm}
            lookAhead={lookAhead}
          />
        </div>
      );
    }

    if (status === "completed" && result) {
      return (
        <SimulationPage
          replays={result.replays}
          onResults={handleResults}
          lookAhead={lookAhead}
        />
      );
    }

    return (
      <div className="app-center">
        <p className="loading-text">INICIANDO...</p>
      </div>
    );
  }

  if (page === "results" && (result || loadFromHistory)) {
    return (
      <ResultsPage
        replays={(result ?? loadFromHistory)!.replays}
        lookAhead={lookAhead}
        onBack={handleBack}
      />
    );
  }

  return (
    <>
      {showTheory && <TheoryModal onClose={() => setShowTheory(false)} />}
      <MenuPage
        lookAhead={lookAhead}
        onLookAheadChange={setLookAhead}
        onStart={handleStart}
        onTheory={() => setShowTheory(true)}
        history={history}
        onHistorySelect={handleHistorySelect}
      />
    </>
  );
}
