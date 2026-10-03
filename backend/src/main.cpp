#include "httplib.h"
#include "tetris/simulation.h"
#include "tetris/randomizer.h"
#include <sstream>
#include <algorithm>
#include <cstdlib>
#include <cstdio>
#include <random>
#include <atomic>
#ifdef _OPENMP
#include <omp.h>
#endif
#ifdef USE_CUDA
#include "tetris/solver_cuda.h"
#endif

static SimulationManager simManager;

// --- MPI Simulation State ---
struct MpiSimState {
    std::string status;          // "running", "completed", "failed"
    int progress;                // 0-100
    std::string currentAlgorithm;
    ReplayData mpiReplay;
    ReplayData cudaReplay;
    std::string errorMessage;
    std::thread worker;
};
static std::map<std::string, MpiSimState> mpiSimulations_;
static std::mutex mpiSimMutex_;

static std::string extractIntFromJson(const std::string& body, const std::string& key) {
    auto pos = body.find("\"" + key + "\"");
    if (pos == std::string::npos) return "";
    pos = body.find(":", pos);
    if (pos == std::string::npos) return "";
    pos++;
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) pos++;
    std::string value;
    while (pos < body.size() && (std::isdigit(body[pos]) || body[pos] == '-')) {
        value += body[pos];
        pos++;
    }
    return value;
}

static std::string replayToJson(const ReplayData& replay) {
    std::stringstream ss;
    ss << "{";
    ss << "\"algorithm\":\"" << replay.algorithm << "\",";
    ss << "\"finalScore\":" << replay.finalScore << ",";
    ss << "\"totalPieces\":" << replay.totalPieces << ",";
    ss << "\"totalTimeMs\":" << replay.totalTimeMs << ",";
    ss << "\"moves\":[";
    for (size_t i = 0; i < replay.moves.size(); ++i) {
        if (i > 0) ss << ",";
        const auto& m = replay.moves[i];
        ss << "{";
        ss << "\"pieceType\":" << m.pieceType << ",";
        ss << "\"rotation\":" << m.rotation << ",";
        ss << "\"x\":" << m.x << ",";
        ss << "\"dropY\":" << m.dropY << ",";
        ss << "\"decisionTimeMs\":" << m.decisionTimeMs << ",";
        ss << "\"linesCleared\":" << m.linesCleared;
        ss << "}";
    }
    ss << "]";
    ss << "}";
    return ss.str();
}

// --- MPI Helpers ---

static std::string generateMpiId() {
    static std::atomic<int> counter{0};
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                  now.time_since_epoch()).count();
    std::stringstream ss;
    ss << "mpi-" << std::hex << ms << "-" << counter.fetch_add(1);
    return ss.str();
}

// Parse the single JSON replay emitted by paralel-mpi-solver on stdout.
// The format matches replayToJson(): {algorithm, finalScore, totalPieces, totalTimeMs, moves:[...]}
static ReplayData parseReplayJson(const std::string& jsonStr) {
    ReplayData replay;
    replay.algorithm = "mpi";
    replay.finalScore = 0;
    replay.totalPieces = 0;
    replay.totalTimeMs = 0.0;

    // Helper: extract a numeric or string value for a given JSON key
    auto extract = [&](const std::string& key, bool isString) -> std::string {
        auto pos = jsonStr.find("\"" + key + "\"");
        if (pos == std::string::npos) return "";
        pos = jsonStr.find(":", pos);
        if (pos == std::string::npos) return "";
        pos++;
        while (pos < jsonStr.size() && (jsonStr[pos] == ' ' || jsonStr[pos] == '\t')) pos++;
        std::string value;
        if (pos < jsonStr.size() && jsonStr[pos] == '"') {
            pos++;
            while (pos < jsonStr.size() && jsonStr[pos] != '"') {
                value += jsonStr[pos];
                pos++;
            }
        } else {
            while (pos < jsonStr.size() &&
                   jsonStr[pos] != ',' && jsonStr[pos] != '}' &&
                   jsonStr[pos] != '\n' && jsonStr[pos] != '\r') {
                value += jsonStr[pos];
                pos++;
            }
        }
        return value;
    };

    std::string v = extract("finalScore", false);
    if (!v.empty()) replay.finalScore = std::stoi(v);
    v = extract("totalPieces", false);
    if (!v.empty()) replay.totalPieces = std::stoi(v);
    v = extract("totalTimeMs", false);
    if (!v.empty()) replay.totalTimeMs = std::stod(v);

    // Parse the "moves" array
    auto movesPos = jsonStr.find("\"moves\":[");
    if (movesPos != std::string::npos) {
        size_t p = movesPos + 8; // skip past "moves":[
        while (p < jsonStr.size()) {
            if (jsonStr[p] == ']') break;
            if (jsonStr[p] == '{') {
                ReplayMove move;
                move.pieceType = 0;
                move.rotation = 0;
                move.x = 0;
                move.dropY = 0;
                move.decisionTimeMs = 0.0;
                move.linesCleared = 0;
                // Find the closing brace of this move object
                auto close = jsonStr.find("}", p);
                if (close == std::string::npos) break;
                std::string moveStr = jsonStr.substr(p, close - p + 1);

                auto mv = [&](const std::string& key) -> std::string {
                    auto pos2 = moveStr.find("\"" + key + "\"");
                    if (pos2 == std::string::npos) return "";
                    pos2 = moveStr.find(":", pos2);
                    if (pos2 == std::string::npos) return "";
                    pos2++;
                    while (pos2 < moveStr.size() && (moveStr[pos2] == ' ' || moveStr[pos2] == '\t')) pos2++;
                    std::string val;
                    while (pos2 < moveStr.size() && moveStr[pos2] != ',' && moveStr[pos2] != '}') {
                        val += moveStr[pos2];
                        pos2++;
                    }
                    return val;
                };
                std::string f;
                f = mv("pieceType"); if (!f.empty()) move.pieceType = std::stoi(f);
                f = mv("rotation"); if (!f.empty()) move.rotation = std::stoi(f);
                f = mv("x"); if (!f.empty()) move.x = std::stoi(f);
                f = mv("dropY"); if (!f.empty()) move.dropY = std::stoi(f);
                f = mv("decisionTimeMs"); if (!f.empty()) move.decisionTimeMs = std::stod(f);
                f = mv("linesCleared"); if (!f.empty()) move.linesCleared = std::stoi(f);
                replay.moves.push_back(move);
                p = close;
            }
            p++;
        }
    }

    return replay;
}

static void runMpiSimulation(const std::string& id, int lookAhead) {
    // Generate deterministic seed for both MPI and (optionally) CUDA
    unsigned int seed;
    {
        std::random_device rd;
        seed = rd();
    }

    // Resolve MPI solver path
    const char* solverEnv = std::getenv("MPI_SOLVER_PATH");
    std::string solverPath = solverEnv ? solverEnv : "./paralel-mpi-solver";

    // Resolve MPI process count
    const char* procsEnv = std::getenv("MPI_PROCESSES");
    int mpiProcs = 4;
    if (procsEnv) {
        int parsed = std::atoi(procsEnv);
        if (parsed > 0) mpiProcs = parsed;
    }

    // Resolve optional hostfile
    const char* hostsEnv = std::getenv("MPI_HOSTS");
    bool useHostfile = hostsEnv && hostsEnv[0] != '\0';

    // Build mpirun command
    std::stringstream cmd;
    cmd << "mpirun --allow-run-as-root ";
    if (useHostfile) {
        cmd << "--hostfile " << hostsEnv << " ";
    }
    cmd << "-np " << mpiProcs << " ";
    cmd << solverPath << " ";
    cmd << "--lookahead " << lookAhead << " ";
    cmd << "--seed " << seed << " ";
    cmd << "--pieces-count 200";

    // Phase 1: MPI run
    {
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it != mpiSimulations_.end()) {
            it->second.currentAlgorithm = "mpi";
            it->second.progress = 10;
        }
    }

    std::string mpiOutput;
    {
        FILE* pipe = popen(cmd.str().c_str(), "r");
        if (!pipe) {
            std::lock_guard<std::mutex> lock(mpiSimMutex_);
            auto it = mpiSimulations_.find(id);
            if (it != mpiSimulations_.end()) {
                it->second.status = "failed";
                it->second.errorMessage = "Failed to spawn mpirun subprocess";
            }
            return;
        }
        char buffer[4096];
        while (fgets(buffer, sizeof(buffer), pipe)) {
            mpiOutput += buffer;
        }
        int exitCode = pclose(pipe);
        if (exitCode != 0) {
            std::lock_guard<std::mutex> lock(mpiSimMutex_);
            auto it = mpiSimulations_.find(id);
            if (it != mpiSimulations_.end()) {
                it->second.status = "failed";
                it->second.errorMessage = "mpirun exited with code " + std::to_string(exitCode);
            }
            return;
        }
    }

    // Parse MPI replay from stdout
    ReplayData mpiReplay = parseReplayJson(mpiOutput);
    {
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it != mpiSimulations_.end()) {
            it->second.mpiReplay = mpiReplay;
            it->second.progress = 50;
        }
    }

    // Phase 2: CUDA run (local, same seed)
#ifdef USE_CUDA
    {
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it != mpiSimulations_.end()) {
            it->second.currentAlgorithm = "cuda";
            it->second.progress = 60;
        }
    }

    BagRandomizer bag(seed);
    std::vector<PieceType> pieceSequence;
    pieceSequence.reserve(200);
    for (int i = 0; i < 200; ++i) {
        pieceSequence.push_back(bag.next());
    }

    BruteForceSolverCUDA cudaSolver;
    ReplayData cudaReplay = simManager.runAlgorithm(
        cudaSolver, "cuda", lookAhead, seed, 15000.0, pieceSequence);

    {
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it != mpiSimulations_.end()) {
            it->second.cudaReplay = cudaReplay;
            it->second.progress = 100;
            it->second.status = "completed";
            it->second.currentAlgorithm = "done";
        }
    }
#else
    // No CUDA — complete with MPI result only
    {
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it != mpiSimulations_.end()) {
            it->second.progress = 100;
            it->second.status = "completed";
            it->second.currentAlgorithm = "done";
        }
    }
#endif
}

int main() {
    httplib::Server svr;

    svr.set_mount_point("/", "./static");

    auto corsHeaders = [](httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
    };

    svr.Get("/api/health", [&](const httplib::Request&, httplib::Response& res) {
        corsHeaders(res);
        bool openmp_available = false;
        int omp_threads = 0;
#ifdef _OPENMP
        openmp_available = true;
        omp_threads = omp_get_max_threads();
#endif
        std::stringstream json;
        json << "{";
        json << "\"openmp\": " << (openmp_available ? "true" : "false") << ",";
        json << "\"ompThreads\": " << omp_threads << ",";
        json << "\"cuda\": ";
#ifdef USE_CUDA
        json << "true";
#else
        json << "false";
#endif
        json << ",";
        json << "\"mpi\": ";
#ifdef USE_MPI
        json << "true" << ",";
        json << "\"mpiProcesses\": " << 4;  // default process count; configurable via env in Docker
#else
        json << "false";
#endif
        json << "}";
        res.set_content(json.str(), "application/json");
    });

    svr.Options(R"(/api/.*)", [&](const httplib::Request&, httplib::Response& res) {
        corsHeaders(res);
    });

    svr.Post("/api/simular", [&](const httplib::Request& req, httplib::Response& res) {
        corsHeaders(res);
        auto lookAheadStr = extractIntFromJson(req.body, "lookAhead");
        int lookAhead = 2;
        if (!lookAheadStr.empty()) {
            lookAhead = std::stoi(lookAheadStr);
            if (lookAhead < 1) lookAhead = 1;
            if (lookAhead > 5) lookAhead = 5;
        }
        std::string id = simManager.startSimulation(lookAhead);
        res.set_content("{\"simulationId\":\"" + id + "\"}", "application/json");
    });

    svr.Get("/api/simular/([^/]+)/status", [&](const httplib::Request& req, httplib::Response& res) {
        corsHeaders(res);
        std::string id = req.matches[1];
        if (!simManager.hasSimulation(id)) {
            res.status = 404;
            res.set_content("{\"error\":\"not found\"}", "application/json");
            return;
        }
        auto status = simManager.getStatus(id);
        std::stringstream ss;
        ss << "{";
        ss << "\"status\":\"" << status.status << "\",";
        ss << "\"progress\":" << status.progress << ",";
        ss << "\"currentAlgorithm\":\"" << status.currentAlgorithm << "\"";
        ss << "}";
        res.set_content(ss.str(), "application/json");
    });

    svr.Get("/api/simular/([^/]+)/resultados", [&](const httplib::Request& req, httplib::Response& res) {
        corsHeaders(res);
        std::string id = req.matches[1];
        if (!simManager.hasSimulation(id)) {
            res.status = 404;
            res.set_content("{\"error\":\"not found\"}", "application/json");
            return;
        }
        auto status = simManager.getStatus(id);
        if (status.status != "completed") {
            res.status = 400;
            res.set_content("{\"error\":\"simulation not completed yet\"}",
                            "application/json");
            return;
        }
        std::stringstream ss;
        ss << "{\"replays\":[";
        for (size_t i = 0; i < status.replays.size(); ++i) {
            if (i > 0) ss << ",";
            ss << replayToJson(status.replays[i]);
        }
        ss << "]}";
        res.set_content(ss.str(), "application/json");
    });

    // === MPI Simulation Endpoints (additive — classic flow untouched) ===

    // POST /api/simular-mpi — start MPI-vs-CUDA simulation
    svr.Post("/api/simular-mpi", [&](const httplib::Request& req, httplib::Response& res) {
        corsHeaders(res);
        auto lookAheadStr = extractIntFromJson(req.body, "lookAhead");
        int lookAhead = 2;
        if (!lookAheadStr.empty()) {
            lookAhead = std::stoi(lookAheadStr);
            if (lookAhead < 1) lookAhead = 1;
            if (lookAhead > 5) lookAhead = 5;
        }
        std::string id = generateMpiId();

        MpiSimState state;
        state.status = "running";
        state.progress = 0;
        state.currentAlgorithm = "mpi";

        std::string simId = id;
        int la = lookAhead;
        state.worker = std::thread([simId, la]() {
            runMpiSimulation(simId, la);
        });
        state.worker.detach();

        {
            std::lock_guard<std::mutex> lock(mpiSimMutex_);
            mpiSimulations_[id] = std::move(state);
        }

        res.set_content("{\"simulationId\":\"" + id + "\"}", "application/json");
    });

    // GET /api/simular-mpi/{id}/status
    svr.Get("/api/simular-mpi/([^/]+)/status", [&](const httplib::Request& req, httplib::Response& res) {
        corsHeaders(res);
        std::string id = req.matches[1];
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it == mpiSimulations_.end()) {
            res.status = 404;
            res.set_content("{\"error\":\"not found\"}", "application/json");
            return;
        }
        std::stringstream ss;
        ss << "{";
        ss << "\"status\":\"" << it->second.status << "\",";
        ss << "\"progress\":" << it->second.progress << ",";
        ss << "\"currentAlgorithm\":\"" << it->second.currentAlgorithm << "\"";
        ss << "}";
        res.set_content(ss.str(), "application/json");
    });

    // GET /api/simular-mpi/{id}/resultados
    svr.Get("/api/simular-mpi/([^/]+)/resultados", [&](const httplib::Request& req, httplib::Response& res) {
        corsHeaders(res);
        std::string id = req.matches[1];
        std::lock_guard<std::mutex> lock(mpiSimMutex_);
        auto it = mpiSimulations_.find(id);
        if (it == mpiSimulations_.end()) {
            res.status = 404;
            res.set_content("{\"error\":\"not found\"}", "application/json");
            return;
        }
        if (it->second.status == "failed") {
            res.status = 500;
            res.set_content("{\"error\":\"" + it->second.errorMessage + "\"}", "application/json");
            return;
        }
        if (it->second.status != "completed") {
            res.status = 409;
            res.set_content("{\"error\":\"simulation not completed yet\"}", "application/json");
            return;
        }
        std::stringstream ss;
        ss << "{\"replays\":[";
        ss << replayToJson(it->second.mpiReplay);
#ifdef USE_CUDA
        ss << "," << replayToJson(it->second.cudaReplay);
#endif
        ss << "]}";
        res.set_content(ss.str(), "application/json");
    });

    std::cout << "Backend corriendo en http://localhost:8080" << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}
