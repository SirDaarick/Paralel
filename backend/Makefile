CXX := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -O2 -fopenmp
LDFLAGS := -lpthread -lws2_32

NVCC := $(shell which nvcc 2>/dev/null)
USE_CUDA := $(if $(NVCC),1,0)
CUDA_BASE := $(if $(NVCC),$(dir $(NVCC))..,)
CUDA_LIB := $(if $(CUDA_BASE),$(wildcard $(CUDA_BASE)/lib64),$(wildcard /usr/local/cuda/lib64 /opt/cuda/lib64 /opt/cuda/targets/x86_64-linux/lib))

MPICXX := $(shell which mpicxx 2>/dev/null)
USE_MPI := $(if $(MPICXX),1,0)

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
    LDFLAGS += -L$(CUDA_LIB) -lcudart
else
    TETRIS_SRCS += $(SRC_DIR)/tetris/solver_cuda_stub.cpp
endif

# MPI: always include stub for test binary; real solver compiled only when MPI available
TETRIS_SRCS += $(SRC_DIR)/tetris/solver_mpi_stub.cpp

ifeq ($(USE_MPI),1)
    MPI_SRCS := $(SRC_DIR)/tetris/solver_mpi.cpp $(SRC_DIR)/mpi_solver_main.cpp
    MPI_CXXFLAGS := $(CXXFLAGS) -DUSE_MPI $(shell mpicxx --showme:compile 2>/dev/null)
    MPI_LDFLAGS := $(LDFLAGS) $(shell mpicxx --showme:link 2>/dev/null)
    MPI_TARGET := $(BUILD_DIR)/paralel-mpi-solver
    MPI_OBJS := $(MPI_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)
endif

TEST_SRCS := $(SRC_DIR)/tests/test_tetris.cpp

TETRIS_OBJS := $(TETRIS_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)
TETRIS_OBJS := $(TETRIS_OBJS:$(SRC_DIR)/%.cu=$(BUILD_DIR)/%.o)
SERVER_OBJS := $(SERVER_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)
TEST_OBJS := $(TEST_SRCS:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)

.PHONY: all clean run test info mpi

all: $(TARGET) $(TEST_TARGET)
ifeq ($(USE_MPI),1)
	@$(MAKE) mpi
endif

info:
	@echo "CUDA available: $(USE_CUDA)"
	@echo "NVCC: $(NVCC)"
	@echo "MPI available: $(USE_MPI)"
	@echo "MPICXX: $(MPICXX)"

define COMPILE_CPP
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) -c $< -o $@
endef

$(BUILD_DIR)/main.o: $(SRC_DIR)/main.cpp
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) $(if $(USE_MPI),-DUSE_MPI,) -c $< -o $@

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

# MPI target: built with mpicxx for proper MPI linking
ifeq ($(USE_MPI),1)
mpi: $(MPI_TARGET)

$(BUILD_DIR)/tetris/solver_mpi.o: $(SRC_DIR)/tetris/solver_mpi.cpp
	@mkdir -p $(@D)
	$(MPICXX) $(MPI_CXXFLAGS) -c $< -o $@

$(BUILD_DIR)/mpi_solver_main.o: $(SRC_DIR)/mpi_solver_main.cpp
	@mkdir -p $(@D)
	$(MPICXX) $(MPI_CXXFLAGS) -c $< -o $@

$(MPI_TARGET): $(MPI_OBJS) $(TETRIS_OBJS)
	$(MPICXX) $(MPI_CXXFLAGS) $^ -o $@ $(MPI_LDFLAGS)
endif

clean:
	rm -rf $(BUILD_DIR)

run: all
	./$(TARGET)
