#include "board.h"
#include "pieces.h"
#include "scorer.h"

BoardState::BoardState() {
    clear();
}

void BoardState::clear() {
    for (int y = 0; y < BOARD_HEIGHT; ++y) {
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            grid[y][x] = 0;
        }
    }
}

BoardState BoardState::clone() const {
    BoardState copy;
    for (int y = 0; y < BOARD_HEIGHT; ++y) {
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            copy.grid[y][x] = grid[y][x];
        }
    }
    return copy;
}

Board::Board() {
    reset();
}

void Board::reset() {
    state_.clear();
}

int Board::getCell(int x, int y) const {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return -1;
    return state_.grid[y][x];
}

const BoardState& Board::getState() const {
    return state_;
}

bool Board::canPlace(PieceType piece, int rotation, int x, int y) const {
    const auto& blocks = getPieceRotations(piece)[rotation];
    for (const auto& b : blocks) {
        int px = x + b.x;
        int py = y + b.y;
        if (px < 0 || px >= BOARD_WIDTH || py < 0 || py >= BOARD_HEIGHT) {
            return false;
        }
        if (state_.grid[py][px] != 0) {
            return false;
        }
    }
    return true;
}

void Board::place(PieceType piece, int rotation, int x, int y) {
    const auto& blocks = getPieceRotations(piece)[rotation];
    for (const auto& b : blocks) {
        int px = x + b.x;
        int py = y + b.y;
        if (px < 0 || px >= BOARD_WIDTH || py < 0 || py >= BOARD_HEIGHT) continue;
        state_.grid[py][px] = static_cast<int>(piece);
    }
}

MoveResult Board::clearLines() {
    int linesCleared = 0;
    int writeY = BOARD_HEIGHT - 1;

    for (int readY = BOARD_HEIGHT - 1; readY >= 0; --readY) {
        bool full = true;
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            if (state_.grid[readY][x] == 0) {
                full = false;
                break;
            }
        }
        if (!full) {
            if (writeY != readY) {
                for (int x = 0; x < BOARD_WIDTH; ++x) {
                    state_.grid[writeY][x] = state_.grid[readY][x];
                }
            }
            --writeY;
        } else {
            ++linesCleared;
        }
    }

    for (int y = 0; y <= writeY; ++y) {
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            state_.grid[y][x] = 0;
        }
    }

    return {linesCleared, Scorer::scoreForLines(linesCleared)};
}

int Board::getHeight() const {
    for (int y = 0; y < BOARD_HEIGHT; ++y) {
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            if (state_.grid[y][x] != 0) {
                return BOARD_HEIGHT - y;
            }
        }
    }
    return 0;
}

int Board::countHoles() const {
    int holes = 0;
    for (int x = 0; x < BOARD_WIDTH; ++x) {
        bool foundBlock = false;
        for (int y = 0; y < BOARD_HEIGHT; ++y) {
            if (state_.grid[y][x] != 0) {
                foundBlock = true;
            } else if (foundBlock) {
                ++holes;
            }
        }
    }
    return holes;
}

int Board::evaluatePosition(PieceType piece, int rotation, int x, int y) const {
    Board clone = this->clone();
    if (!clone.canPlace(piece, rotation, x, y)) {
        return -1;
    }
    clone.place(piece, rotation, x, y);
    clone.clearLines();
    return clone.getHeight() + clone.countHoles();
}

bool Board::isGameOver() const {
    for (const auto& pieceType : {PIECE_I, PIECE_O, PIECE_T, PIECE_S, PIECE_Z, PIECE_J, PIECE_L}) {
        if (canPlace(pieceType, 0, SPAWN_X, SPAWN_Y)) {
            return false;
        }
    }
    return true;
}

Board Board::clone() const {
    Board copy;
    copy.state_ = state_.clone();
    return copy;
}
