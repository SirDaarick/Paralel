#include "simulation.h"
#include "solver_omp.h"
#ifdef USE_CUDA
#include "solver_cuda.h"
#endif
#include <random>
#include <sstream>
#include <iomanip>
#include <iostream>

std::string SimulationManager::generateId() {
    static std::atomic<int> counter{0};
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                  now.time_since_epoch()).count();
    std::stringstream ss;
    ss << std::hex << ms << "-" << counter.fetch_add(1);
    return ss.str();
}

std::string SimulationManager::startSimulation(int lookAhead, unsigned int seed) {
    std::string id = generateId();

    std::lock_guard<std::mutex> lock(mutex_);

    SimulationState state;
    state.status.status = "running";
    state.status.progress = 0;
    state.status.currentAlgorithm = "seq";

    // Capture variables for the thread
    int la = lookAhead;
    unsigned int s = seed;
    std::string simId = id;

    state.worker = std::thread([this, simId, la, s]() {
        runSimulation(simId, la, s);
    });
    state.worker.detach();

    simulations_[id] = std::move(state);
    return id;
}

SimulationStatus SimulationManager::getStatus(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = simulations_.find(id);
    if (it == simulations_.end()) {
        return {"error", 0, "", {}, "Simulation not found"};
    }
    return it->second.status;
}

bool SimulationManager::hasSimulation(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    return simulations_.find(id) != simulations_.end();
}

ReplayData SimulationManager::runAlgorithm(BruteForceSolver& solver,
                                            const std::string& algo,
                                            int lookAhead, unsigned int,
                                            double timeLimitMs,
                                            const std::vector<PieceType>& pieceSequence) {
    ReplayData replay;
    replay.algorithm = algo;

    auto startTime = std::chrono::high_resolution_clock::now();

    Board board;
    int score = 0;
    int pieceIndex = 0;

    while (pieceIndex < static_cast<int>(pieceSequence.size())) {
        auto now = std::chrono::high_resolution_clock::now();
        double elapsed = std::chrono::duration<double, std::milli>(
                             now - startTime).count();
        if (elapsed >= timeLimitMs) break;

        if (board.isGameOver()) break;

        PieceType current = pieceSequence[pieceIndex];

        // Build upcoming pieces list from sequence
        std::vector<PieceType> upcoming;
        for (int i = pieceIndex + 1;
             i < std::min(pieceIndex + 1 + lookAhead,
                          static_cast<int>(pieceSequence.size()));
             ++i) {
            upcoming.push_back(pieceSequence[i]);
        }

        // Measure decision time
        auto decisionStart = std::chrono::high_resolution_clock::now();
        SearchResult result = solver.findBestMove(board, current, upcoming, lookAhead);
        auto decisionEnd = std::chrono::high_resolution_clock::now();
        double decisionTimeMs = std::chrono::duration<double, std::milli>(
                                    decisionEnd - decisionStart).count();

        // Apply the move
        int dropY = solver.findDropY(board, current, result.bestRotation,
                                     result.bestX);
        if (dropY < 0) break; // can't place, game over

        board.place(current, result.bestRotation, result.bestX, dropY);
        MoveResult clearResult = board.clearLines();
        score += clearResult.score;

        ReplayMove move;
        move.pieceType = static_cast<int>(current);
        move.rotation = result.bestRotation;
        move.x = result.bestX;
        move.dropY = dropY;
        move.decisionTimeMs = decisionTimeMs;
        move.linesCleared = clearResult.linesCleared;
        replay.moves.push_back(move);

        ++pieceIndex;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    replay.totalTimeMs = std::chrono::duration<double, std::milli>(
                             endTime - startTime).count();
    replay.finalScore = score;
    replay.totalPieces = static_cast<int>(replay.moves.size());

    return replay;
}

void SimulationManager::runSimulation(const std::string& id, int lookAhead,
                                       unsigned int seed) {
    const double TIME_LIMIT_MS = 15000.0;

    // Generate piece sequence
    if (seed == 0) {
        std::random_device rd;
        seed = rd();
    }
    BagRandomizer bag(seed);

    std::vector<PieceType> pieceSequence;
    for (int i = 0; i < 200; ++i) {
        pieceSequence.push_back(bag.next());
    }

    // Run sequential algorithm
    {
        BruteForceSolver solver;
        auto replay = runAlgorithm(solver, "seq", lookAhead, seed,
                                   TIME_LIMIT_MS, pieceSequence);
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = simulations_.find(id);
            if (it != simulations_.end()) {
                it->second.status.currentAlgorithm = "seq";
                it->second.status.progress = 33;
                it->second.status.replays.push_back(replay);
            }
        }
        std::cout << "[simulation " << id << "] seq done: "
                  << replay.totalPieces << " pieces, "
                  << replay.totalTimeMs << " ms" << std::endl;
    }

    // Run OpenMP algorithm
    {
        BruteForceSolverOMP solver;
        auto replay = runAlgorithm(solver, "omp", lookAhead, seed,
                                   TIME_LIMIT_MS, pieceSequence);
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = simulations_.find(id);
            if (it != simulations_.end()) {
                it->second.status.currentAlgorithm = "omp";
                it->second.status.progress = 66;
                it->second.status.replays.push_back(replay);
            }
        }
        std::cout << "[simulation " << id << "] omp done: "
                  << replay.totalPieces << " pieces, "
                  << replay.totalTimeMs << " ms" << std::endl;
    }

#ifdef USE_CUDA
    // Run CUDA algorithm
    {
        BruteForceSolverCUDA solver;
        auto replay = runAlgorithm(solver, "cuda", lookAhead, seed,
                                   TIME_LIMIT_MS, pieceSequence);
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = simulations_.find(id);
            if (it != simulations_.end()) {
                it->second.status.currentAlgorithm = "cuda";
                it->second.status.progress = 90;
                it->second.status.replays.push_back(replay);
            }
        }
        std::cout << "[simulation " << id << "] cuda done: "
                  << replay.totalPieces << " pieces, "
                  << replay.totalTimeMs << " ms" << std::endl;
    }
#endif

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = simulations_.find(id);
    if (it != simulations_.end()) {
        it->second.status.status = "completed";
        it->second.status.progress = 100;
        it->second.status.currentAlgorithm = "done";
    }

    std::cout << "[simulation " << id << "] completed" << std::endl;
}
