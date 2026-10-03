import { useState, useEffect, useRef, useCallback } from "react";
import type { MpiSimulationResult, MpiStatusResponse } from "./api-types";
import { simulationService } from "../services";

interface UseMpiSimulationOptions {
  lookAhead: number;
}

interface UseMpiSimulationReturn {
  status: "idle" | "starting" | "running" | "completed" | "error";
  result: MpiSimulationResult | null;
  error: string | null;
  progress: number;
  currentAlgorithm: string;
  start: () => void;
  reset: () => void;
}

export function useMpiSimulation({ lookAhead }: UseMpiSimulationOptions): UseMpiSimulationReturn {
  const [status, setStatus] = useState<UseMpiSimulationReturn["status"]>("idle");
  const [result, setResult] = useState<MpiSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentAlgorithm, setCurrentAlgorithm] = useState("mpi");
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
    setCurrentAlgorithm("mpi");
    simulationIdRef.current = null;
  }, []);

  const start = useCallback(async () => {
    reset();
    setStatus("starting");

    try {
      const data = await simulationService.startSimulation(lookAhead, "mpi");
      simulationIdRef.current = data.simulationId;
      setStatus("running");

      pollingRef.current = setInterval(async () => {
        if (!simulationIdRef.current) return;

        try {
          const statusData: MpiStatusResponse =
            await simulationService.getStatus(simulationIdRef.current, "mpi");

          setProgress(statusData.progress);
          setCurrentAlgorithm(statusData.currentAlgorithm);

          if (statusData.status === "completed") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            const resultData: MpiSimulationResult =
              await simulationService.getResults(simulationIdRef.current, "mpi");
            setResult(resultData);
            setStatus("completed");
          } else if (statusData.status === "error") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setError("MPI simulation error on backend");
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
