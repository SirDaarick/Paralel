#include "randomizer.h"

BagRandomizer::BagRandomizer(unsigned int seed) : rng_(seed), bagIndex_(0) {
    if (seed == 0) {
        std::random_device rd;
        rng_.seed(rd());
    }
    refillBag();
}

PieceType BagRandomizer::next() {
    if (bagIndex_ >= bag_.size()) {
        refillBag();
    }
    return bag_[bagIndex_++];
}

std::vector<PieceType> BagRandomizer::preview(int n) {
    std::vector<PieceType> result;
    auto savedBag = bag_;
    auto savedIndex = bagIndex_;
    auto savedRng = rng_;

    for (int i = 0; i < n; ++i) {
        result.push_back(next());
    }

    bag_ = savedBag;
    bagIndex_ = savedIndex;
    rng_ = savedRng;

    return result;
}

void BagRandomizer::reset(unsigned int seed) {
    if (seed == 0) {
        std::random_device rd;
        rng_.seed(rd());
    } else {
        rng_.seed(seed);
    }
    bag_.clear();
    bagIndex_ = 0;
    refillBag();
}

void BagRandomizer::refillBag() {
    bag_ = {PIECE_I, PIECE_O, PIECE_T, PIECE_S, PIECE_Z, PIECE_J, PIECE_L};
    std::shuffle(bag_.begin(), bag_.end(), rng_);
    bagIndex_ = 0;
}
