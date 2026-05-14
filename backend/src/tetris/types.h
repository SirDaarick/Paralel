#pragma once

#include <vector>
#include <cstdint>

constexpr int BOARD_WIDTH = 10;
constexpr int BOARD_HEIGHT = 20;

enum PieceType : int {
    PIECE_I = 1,
    PIECE_O = 2,
    PIECE_T = 3,
    PIECE_S = 4,
    PIECE_Z = 5,
    PIECE_J = 6,
    PIECE_L = 7,
};

constexpr int NUM_PIECE_TYPES = 7;
constexpr int NUM_ROTATIONS = 4;

struct Block {
    int x, y;
};

using RotationState = std::vector<Block>;
using PieceRotations = std::vector<RotationState>;

const PieceRotations& getPieceRotations(PieceType type);

struct BoardState {
    int grid[BOARD_HEIGHT][BOARD_WIDTH];
    BoardState();
    void clear();
    BoardState clone() const;
};

struct MoveResult {
    int linesCleared;
    int score;
};
