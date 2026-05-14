#pragma once

#include "types.h"

class Scorer {
public:
    static int scoreForLines(int linesCleared);
    static int totalScore(int baseScore, int level);
};
