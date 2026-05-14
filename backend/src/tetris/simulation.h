#pragma once

#include "types.h"
#include "board.h"
#include "randomizer.h"
#include "scorer.h"
#include "solver.h"
#include <vector>
#include <string>
#include <chrono>
#include <mutex>
#include <map>
#include <thread>
#include <atomic>

struct ReplayMove {
    int pieceType;
    int rotation;
    int x;
    int dropY;
    double decisionTimeMs;
    int linesCleared;
};

struct ReplayData {
    std::string algorithm;
    std::vector<ReplayMove> moves;
    int finalScore;
    int totalPieces;
    double totalTimeMs;
};

struct SimulationStatus {
    std::string status; // "running", "completed", "error"
    int progress;
    std::string currentAlgorithm;
    std::vector<ReplayData> replays;
    std::string errorMessage;
};

class SimulationManager {
public:
    std::string startSimulation(int lookAhead, unsigned int seed = 0);
    SimulationStatus getStatus(const std::string& id);
    bool hasSimulation(const std::string& id);

private:
    struct SimulationState {
        SimulationStatus status;
        std::thread worker;
    };

    std::map<std::string, SimulationState> simulations_;
    std::mutex mutex_;

    void runSimulation(const std::string& id, int lookAhead, unsigned int seed);
    ReplayData runAlgorithm(BruteForceSolver& solver, const std::string& algo,
                            int lookAhead, unsigned int seed, double timeLimitMs,
                            const std::vector<PieceType>& pieceSequence);
    std::string generateId();
};
