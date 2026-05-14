#pragma once

#include "types.h"

constexpr int SPAWN_X = 3;
constexpr int SPAWN_Y = 0;

class Board {
public:
    Board();
    void reset();

    int getCell(int x, int y) const;
    const BoardState& getState() const;

    bool canPlace(PieceType piece, int rotation, int x, int y) const;
    void place(PieceType piece, int rotation, int x, int y);
    MoveResult clearLines();

    int getHeight() const;
    int countHoles() const;
    int evaluatePosition(PieceType piece, int rotation, int x, int y) const;

    bool isGameOver() const;

    Board clone() const;

private:
    BoardState state_;
};
