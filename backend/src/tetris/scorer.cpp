#include "scorer.h"

int Scorer::scoreForLines(int linesCleared) {
    switch (linesCleared) {
        case 1: return 100;
        case 2: return 300;
        case 3: return 500;
        case 4: return 800;
        default: return 0;
    }
}

int Scorer::totalScore(int baseScore, int) {
    return baseScore;
}
