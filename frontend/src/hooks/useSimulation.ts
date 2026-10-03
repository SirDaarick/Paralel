import { useState, useEffect, useRef, useCallback } from "react";
import type { SimulationResult, SimulationStatusResponse } from "./api-types";
import { simulationService } from "../services";

interface UseSimulationOptions {
  lookAhead: number;
}

interface UseSimulationReturn {
  status: "idle" | "starting" | "running" | "completed" | "error";
  result: SimulationResult | null;
  error: string | null;
  progress: number;
  currentAlgorithm: string;
  start: () => void;
  reset: () => void;
}

export function useSimulation({ lookAhead }: UseSimulationOptions): UseSimulationReturn {
  const [status, setStatus] = useState<UseSimulationReturn["status"]>("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentAlgorithm, setCurrentAlgorithm] = useState("seq");
  const simulationIdRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStatus("idle");
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentAlgorithm("seq");
    simulationIdRef.current = null;
  }, []);

  const start = useCallback(async () => {
    reset();
    setStatus("starting");

    try {
      const data = await simulationService.startSimulation(lookAhead, "classic");
      simulationIdRef.current = data.simulationId;
      setStatus("running");

      pollingRef.current = setInterval(async () => {
        if (!simulationIdRef.current) return;

        try {
          const statusData: SimulationStatusResponse =
            await simulationService.getStatus(simulationIdRef.current, "classic");

          setProgress(statusData.progress);
          setCurrentAlgorithm(statusData.currentAlgorithm);

          if (statusData.status === "completed") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            const resultData: SimulationResult =
              await simulationService.getResults(simulationIdRef.current, "classic");
            setResult(resultData);
            setStatus("completed");
          } else if (statusData.status === "error") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setError("Simulation error on backend");
            setStatus("error");
          }
        } catch (err) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setError(err instanceof Error ? err.message : "Unknown error");
          setStatus("error");
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, [lookAhead, reset]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return { status, result, error, progress, currentAlgorithm, start, reset };
}
