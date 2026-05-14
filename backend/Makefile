CXX := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -O2 -fopenmp
LDFLAGS := -lpthread

NVCC := $(shell which nvcc 2>/dev/null)
USE_CUDA := $(if $(NVCC),1,0)

SRC_DIR := src
BUILD_DIR := build
TARGET := $(BUILD_DIR)/paralel-server
TEST_TARGET := $(BUILD_DIR)/test_tetris

SERVER_SRCS := $(SRC_DIR)/main.cpp
TETRIS_SRCS := $(SRC_DIR)/tetris/pieces.cpp \
               $(SRC_DIR)/tetris/board.cpp \
               $(SRC_DIR)/tetris/randomizer.cpp \
               $(SRC_DIR)/tetris/scorer.cpp \
               $(SRC_DIR)/tetris/solver.cpp \
               $(SRC_DIR)/tetris/solver_omp.cpp \
               $(SRC_DIR)/tetris/simulation.cpp

ifeq ($(USE_CUDA),1)
    TETRIS_SRCS += $(SRC_DIR)/tetris/solver_cuda.cu
    CXXFLAGS += -DUSE_CUDA
    NVCCFLAGS := -std=c++14 -O2 -DUSE_CUDA -arch=sm_75
    LDFLAGS += -L/usr/local/cuda/lib64 -lcudart
else
    TETRIS_SRCS += $(SRC_DIR)/tetris/solver_cuda_stub.cpp
endif

TEST_SRCS := $(SRC_DIR)/tests/test_tetris.cpp

TETRIS_OBJS := $(TETRIS_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)
TETRIS_OBJS := $(TETRIS_OBJS:$(SRC_DIR)/%.cu=$(BUILD_DIR)/%.o)
SERVER_OBJS := $(SERVER_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)
TEST_OBJS := $(TEST_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)

.PHONY: all clean run test info

all: $(TARGET) $(TEST_TARGET)

info:
	@echo "CUDA available: $(USE_CUDA)"
	@echo "NVCC: $(NVCC)"

define COMPILE_CPP
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) -c $< -o $@
endef

$(BUILD_DIR)/main.o: $(SRC_DIR)/main.cpp
	$(COMPILE_CPP)

$(BUILD_DIR)/tetris/%.o: $(SRC_DIR)/tetris/%.cpp
	$(COMPILE_CPP)

$(BUILD_DIR)/tetris/solver_cuda.o: $(SRC_DIR)/tetris/solver_cuda.cu
	@mkdir -p $(@D)
	$(NVCC) $(NVCCFLAGS) -c $< -o $@

$(BUILD_DIR)/tests/%.o: $(SRC_DIR)/tests/%.cpp
	$(COMPILE_CPP)

$(TARGET): $(SERVER_OBJS) $(TETRIS_OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

$(TEST_TARGET): $(TEST_OBJS) $(TETRIS_OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

test: $(TEST_TARGET)
	./$(TEST_TARGET)

clean:
	rm -rf $(BUILD_DIR)

run: all
	./$(TARGET)
