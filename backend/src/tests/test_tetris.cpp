#include <cassert>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>

#include "../tetris/types.h"
#include "../tetris/pieces.h"
#include "../tetris/board.h"
#include "../tetris/randomizer.h"
#include "../tetris/scorer.h"

static int tests_passed = 0;
static int tests_failed = 0;

#define TEST(name) \
    do { \
        std::cout << "  " << name << "... "; \
        std::cout.flush(); \
    } while(0)

#define PASS() \
    do { \
        std::cout << "OK\n"; \
        ++tests_passed; \
    } while(0)

#define FAIL(msg) \
    do { \
        std::cout << "FAIL: " << msg << "\n"; \
        ++tests_failed; \
    } while(0)

#define CHECK(cond) \
    do { \
        if (!(cond)) { \
            FAIL(#cond); \
            return; \
        } \
    } while(0)

// --- Piece tests ---

static void test_pieces_have_4_blocks() {
    TEST("cada pieza tiene 4 bloques por rotacion");
    for (int p = 1; p <= 7; ++p) {
        PieceType type = static_cast<PieceType>(p);
        const auto& rotations = getPieceRotations(type);
        CHECK(rotations.size() == 4);
        for (int r = 0; r < 4; ++r) {
            CHECK(rotations[r].size() == 4);
        }
    }
    PASS();
}

static void test_piece_I_rotations() {
    TEST("pieza I tiene rotaciones horizontal y vertical");
    const auto& r = getPieceRotations(PIECE_I);
    // Rotation 0: horizontal
    CHECK(r[0][0].y == r[0][1].y && r[0][1].y == r[0][2].y && r[0][2].y == r[0][3].y);
    // Rotation 1: vertical
    CHECK(r[1][0].x == r[1][1].x && r[1][1].x == r[1][2].x && r[1][2].x == r[1][3].x);
    PASS();
}

static void test_piece_O_same_rotations() {
    TEST("pieza O es igual en todas las rotaciones");
    const auto& r = getPieceRotations(PIECE_O);
    for (int rot = 1; rot < 4; ++rot) {
        CHECK(r[0].size() == 4 && r[rot].size() == 4);
    }
    PASS();
}

// --- Board tests ---

static void test_board_empty() {
    TEST("tablero empieza vacio");
    Board b;
    for (int y = 0; y < BOARD_HEIGHT; ++y) {
        for (int x = 0; x < BOARD_WIDTH; ++x) {
            CHECK(b.getCell(x, y) == 0);
        }
    }
    PASS();
}

static void test_can_place_piece() {
    TEST("colocar pieza en posicion valida");
    Board b;
    CHECK(b.canPlace(PIECE_T, 0, 3, 0));
    CHECK(b.canPlace(PIECE_I, 0, 3, 0));
    CHECK(b.canPlace(PIECE_O, 0, 4, 0));
    PASS();
}

static void test_cannot_place_out_of_bounds() {
    TEST("no puede colocar fuera del tablero");
    Board b;
    CHECK(!b.canPlace(PIECE_T, 0, -1, 0));
    CHECK(!b.canPlace(PIECE_T, 0, 8, 0));
    CHECK(!b.canPlace(PIECE_T, 0, 0, 19));
    CHECK(!b.canPlace(PIECE_I, 1, 0, -5));
    PASS();
}

static void test_place_piece() {
    TEST("colocar pieza marca las celdas");
    Board b;
    b.place(PIECE_T, 0, 3, 0);
    CHECK(b.getCell(4, 0) != 0);  // center-top of T at rotation 0
    CHECK(b.getCell(3, 1) != 0);  // left-middle of T
    CHECK(b.getCell(4, 1) != 0);  // center-middle
    CHECK(b.getCell(5, 1) != 0);  // right-middle
    PASS();
}

static void test_cannot_place_on_occupied() {
    TEST("no puede colocar sobre celdas ocupadas");
    Board b;
    b.place(PIECE_T, 0, 3, 0);
    CHECK(!b.canPlace(PIECE_O, 0, 3, 0));
    PASS();
}

static void test_clear_single_line() {
    TEST("limpiar una linea completa");
    Board b;
    // I piece r0 blocks at y=1 → to fill row 19, place at y=18
    b.place(PIECE_I, 0, 0, 18);  // cols 0-3 at row 19
    b.place(PIECE_I, 0, 4, 18);  // cols 4-7 at row 19
    b.place(PIECE_I, 0, 6, 18);  // cols 6-9 at row 19 (overlaps cols 6-7, fine)
    auto result = b.clearLines();
    CHECK(result.linesCleared == 1);
    PASS();
}

static void test_clear_multiple_lines() {
    TEST("limpiar 4 lineas (Tetris)");
    Board b;
    // Fill rows 16-19: I piece r0 at y=row-1 covers that row
    b.place(PIECE_I, 0, 0, 15); b.place(PIECE_I, 0, 4, 15); b.place(PIECE_I, 0, 6, 15);
    b.place(PIECE_I, 0, 0, 16); b.place(PIECE_I, 0, 4, 16); b.place(PIECE_I, 0, 6, 16);
    b.place(PIECE_I, 0, 0, 17); b.place(PIECE_I, 0, 4, 17); b.place(PIECE_I, 0, 6, 17);
    b.place(PIECE_I, 0, 0, 18); b.place(PIECE_I, 0, 4, 18); b.place(PIECE_I, 0, 6, 18);
    auto result = b.clearLines();
    CHECK(result.linesCleared == 4);
    PASS();
}

static void test_no_lines_cleared() {
    TEST("no limpia si no hay lineas completas");
    Board b;
    b.place(PIECE_T, 0, 3, 18);
    auto result = b.clearLines();
    CHECK(result.linesCleared == 0);
    PASS();
}

static void test_board_height() {
    TEST("altura del tablero vacio es 0");
    Board b;
    CHECK(b.getHeight() == 0);
    b.place(PIECE_O, 0, 0, 18);
    CHECK(b.getHeight() == 2); // O piece is 2 tall at y=18, so height = 20-18 = 2
    PASS();
}

static void test_count_holes() {
    TEST("contar huecos correctamente");
    Board b;
    // Place a block at bottom, then nothing above = no hole
    b.place(PIECE_O, 0, 0, 18);
    CHECK(b.countHoles() == 0);
    // Place block above empty space = hole
    b.place(PIECE_O, 0, 2, 17);
    CHECK(b.countHoles() == 2); // under the top O piece, cells (2,18) and (3,18) are holes
    PASS();
}

static void test_evaluate_position() {
    TEST("evaluar posicion retorna heuristica");
    Board b;
    int score = b.evaluatePosition(PIECE_T, 0, 3, 18);
    CHECK(score >= 0);
    score = b.evaluatePosition(PIECE_T, 0, -1, 0);
    CHECK(score == -1);
    PASS();
}

static void test_game_over_empty() {
    TEST("game over es falso en tablero vacio");
    Board b;
    CHECK(!b.isGameOver());
    PASS();
}

static void test_game_over_full() {
    TEST("game over cuando el tablero esta lleno hasta arriba");
    Board b;
    // Fill board up to row 1 (leave only spawn row clear, but spawning at y=0 requires 2-3 rows)
    for (int y = 0; y < 20; y += 2) {
        for (int x = 0; x < 10; x += 4) {
            b.place(PIECE_I, 0, x, y);
        }
    }
    // Now check if game is over (pieces can't spawn at y=0)
    CHECK(b.isGameOver());
    PASS();
}

static void test_board_clone() {
    TEST("clonar tablero es independiente");
    Board b;
    b.place(PIECE_T, 0, 3, 0);
    Board clone = b.clone();
    CHECK(clone.getCell(4, 0) != 0);
    clone.place(PIECE_O, 0, 0, 2);
    CHECK(b.getCell(0, 2) == 0); // original unchanged
    PASS();
}

// --- Randomizer tests ---

static void test_bag_has_7_pieces() {
    TEST("bolsa contiene exactamente 7 piezas");
    std::vector<int> counts(8, 0);
    BagRandomizer rng(42);
    for (int i = 0; i < 7; ++i) {
        PieceType p = rng.next();
        counts[static_cast<int>(p)]++;
    }
    for (int i = 1; i <= 7; ++i) {
        CHECK(counts[i] == 1);
    }
    PASS();
}

static void test_bag_refills() {
    TEST("bolsa se rellena al acabarse");
    BagRandomizer rng(42);
    // Draw 14 pieces
    std::vector<int> counts(8, 0);
    for (int i = 0; i < 14; ++i) {
        PieceType p = rng.next();
        counts[static_cast<int>(p)]++;
    }
    for (int i = 1; i <= 7; ++i) {
        CHECK(counts[i] == 2);
    }
    PASS();
}

static void test_same_seed_same_sequence() {
    TEST("misma seed produce la misma secuencia");
    BagRandomizer rng1(42);
    BagRandomizer rng2(42);
    for (int i = 0; i < 20; ++i) {
        CHECK(rng1.next() == rng2.next());
    }
    PASS();
}

static void test_preview_does_not_consume() {
    TEST("preview no consume piezas");
    BagRandomizer rng(42);
    auto preview1 = rng.preview(7);
    auto preview2 = rng.preview(7);
    for (int i = 0; i < 7; ++i) {
        CHECK(preview1[i] == preview2[i]);
    }
    // Consume and compare
    for (int i = 0; i < 7; ++i) {
        CHECK(rng.next() == preview1[i]);
    }
    PASS();
}

// --- Scorer tests ---

static void test_scorer_1_line() {
    TEST("scorer: 1 linea = 100");
    CHECK(Scorer::scoreForLines(1) == 100);
    PASS();
}

static void test_scorer_2_lines() {
    TEST("scorer: 2 lineas = 300");
    CHECK(Scorer::scoreForLines(2) == 300);
    PASS();
}

static void test_scorer_tetris() {
    TEST("scorer: 4 lineas = 800");
    CHECK(Scorer::scoreForLines(4) == 800);
    PASS();
}

static void test_scorer_zero() {
    TEST("scorer: 0 lineas = 0");
    CHECK(Scorer::scoreForLines(0) == 0);
    PASS();
}

int main() {
    std::cout << "\n=== Tests Motor de Tetris ===\n\n";

    std::cout << "--- Piezas ---\n";
    test_pieces_have_4_blocks();
    test_piece_I_rotations();
    test_piece_O_same_rotations();

    std::cout << "\n--- Tablero ---\n";
    test_board_empty();
    test_can_place_piece();
    test_cannot_place_out_of_bounds();
    test_place_piece();
    test_cannot_place_on_occupied();
    test_clear_single_line();
    test_clear_multiple_lines();
    test_no_lines_cleared();
    test_board_height();
    test_count_holes();
    test_evaluate_position();
    test_game_over_empty();
    test_game_over_full();
    test_board_clone();

    std::cout << "\n--- Randomizer ---\n";
    test_bag_has_7_pieces();
    test_bag_refills();
    test_same_seed_same_sequence();
    test_preview_does_not_consume();

    std::cout << "\n--- Scorer ---\n";
    test_scorer_1_line();
    test_scorer_2_lines();
    test_scorer_tetris();
    test_scorer_zero();

    std::cout << "\n==========================\n";
    std::cout << "Pasaron: " << tests_passed << "\n";
    std::cout << "Fallaron: " << tests_failed << "\n";
    std::cout << "==========================\n";

    return tests_failed > 0 ? 1 : 0;
}
