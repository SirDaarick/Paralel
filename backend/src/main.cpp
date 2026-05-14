#include "httplib.h"
#include "tetris/simulation.h"
#include <sstream>
#include <algorithm>
#ifdef _OPENMP
#include <omp.h>
#endif

static SimulationManager simManager;

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

    std::cout << "Backend corriendo en http://localhost:8080" << std::endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}
