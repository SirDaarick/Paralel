#pragma once

#include "types.h"
#include <vector>
#include <random>
#include <algorithm>

class BagRandomizer {
public:
    explicit BagRandomizer(unsigned int seed = 0);

    PieceType next();

    std::vector<PieceType> preview(int n);

    void reset(unsigned int seed = 0);

private:
    std::mt19937 rng_;
    std::vector<PieceType> bag_;
    size_t bagIndex_;

    void refillBag();
};
