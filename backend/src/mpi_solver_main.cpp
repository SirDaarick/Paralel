#include "tetris/simulation.h"
#include "tetris/solver_mpi.h"
#include "tetris/randomizer.h"
#include <mpi.h>
#include <iostream>
#include <sstream>
#include <string>
#include <cstring>
#include <cstdlib>

// Minimal JSON serialization — mirrors replayToJson in main.cpp
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

static void printUsage(const char* prog) {
    std::cerr << "Usage: " << prog << " --lookahead <1-5> "
              << "[--seed <uint>] [--pieces-count <int>]" << std::endl;
    std::cerr << "  --lookahead    Look-ahead depth (1-5, required)" << std::endl;
    std::cerr << "  --seed         RNG seed (optional; 0 = random)" << std::endl;
    std::cerr << "  --pieces-count Number of pieces to simulate (default 200)" << std::endl;
}

int main(int argc, char** argv) {
    MPI_Init(&argc, &argv);

    int rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);

    // Parse CLI arguments
    int lookAhead = -1;
    unsigned int seed = 0;
    int piecesCount = 200;
    bool seedSet = false;

    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--lookahead") == 0 && i + 1 < argc) {
            lookAhead = std::atoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
            seed = static_cast<unsigned int>(std::atoi(argv[++i]));
            seedSet = true;
        } else if (std::strcmp(argv[i], "--pieces-count") == 0 && i + 1 < argc) {
            piecesCount = std::atoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--help") == 0 || std::strcmp(argv[i], "-h") == 0) {
            if (rank == 0) printUsage(argv[0]);
            MPI_Finalize();
            return 0;
        }
    }

    // Validate arguments
    if (lookAhead < 1 || lookAhead > 5) {
        if (rank == 0) {
            std::cerr << "Error: --lookahead must be 1-5" << std::endl;
            printUsage(argv[0]);
        }
        MPI_Finalize();
        return 1;
    }
    if (piecesCount <= 0) {
        if (rank == 0) {
            std::cerr << "Error: --pieces-count must be positive" << std::endl;
            printUsage(argv[0]);
        }
        MPI_Finalize();
        return 1;
    }

    // Deterministic seed: if not provided, rank 0 generates random and broadcasts
    if (!seedSet) {
        if (rank == 0) {
            std::random_device rd;
            seed = rd();
        }
        MPI_Bcast(&seed, 1, MPI_UNSIGNED, 0, MPI_COMM_WORLD);
    }

    // Generate piece sequence (same seed → all ranks produce identical sequence)
    BagRandomizer bag(seed);
    std::vector<PieceType> pieceSequence;
    pieceSequence.reserve(piecesCount);
    for (int i = 0; i < piecesCount; ++i) {
        pieceSequence.push_back(bag.next());
    }

    // Run the MPI solver
    const double TIME_LIMIT_MS = 30000.0; // generous limit for MPI mode
    BruteForceSolverMPI solver;
    SimulationManager mgr;
    ReplayData replay = mgr.runAlgorithm(solver, "mpi", lookAhead, seed,
                                         TIME_LIMIT_MS, pieceSequence);

    // Rank 0 outputs JSON replay to stdout
    if (rank == 0) {
        std::cout << replayToJson(replay) << std::endl;
    }

    MPI_Finalize();
    return 0;
}
