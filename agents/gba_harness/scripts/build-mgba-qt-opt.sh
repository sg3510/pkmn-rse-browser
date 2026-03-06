#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  build-mgba-qt-opt.sh [options]

Builds an optimized Qt mGBA binary for this harness.
By default it performs a 2-stage PGO build using the local harness workload.

Options:
  --source-dir PATH       mGBA source checkout (default: /tmp/mgba-src)
  --build-dir PATH        CMake build directory (default: /tmp/mgba-build-qt-opt)
  --pgo-dir PATH          Profile data directory (default: /tmp/gba-pgo)
  --qt-prefix PATH        Qt prefix (default: autodetect via brew --prefix qt)
  --jobs N                Parallel build jobs (default: CPU count)
  --generator NAME        CMake generator (default: Ninja if available, else Unix Makefiles)
  --rom PATH              ROM path for PGO workload
  --lua-script PATH       Lua bridge script path
  --workload-script PATH  Harness JSON script used to generate PGO data
  --fetch-source          Clone/update source from GitHub if needed
  --clean                 Remove build and PGO directories before building
  --no-pgo                Build optimized Release+LTO without PGO stages
  --force-pgo             Keep PGO enabled even on AppleClang (may fail)
  --skip-workload         Configure/build stage 1 only (PGO mode)
  --help                  Show help

Examples:
  ./scripts/build-mgba-qt-opt.sh --clean --fetch-source
  ./scripts/build-mgba-qt-opt.sh --no-pgo
EOF
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name" >&2
    exit 1
  fi
}

resolve_jobs() {
  local detected
  detected="$(sysctl -n hw.ncpu 2>/dev/null || true)"
  if [[ -z "$detected" ]]; then
    detected="$(getconf _NPROCESSORS_ONLN 2>/dev/null || true)"
  fi
  if [[ -z "$detected" ]]; then
    detected="8"
  fi
  echo "$detected"
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="/tmp/mgba-src"
BUILD_DIR="/tmp/mgba-build-qt-opt"
PGO_DIR="/tmp/gba-pgo"
QT_PREFIX=""
JOBS="$(resolve_jobs)"
GENERATOR=""
ROM_PATH="$ROOT_DIR/Pokemon - Emerald Version (USA, Europe).gba"
LUA_SCRIPT="$ROOT_DIR/lua/mgba_harness.lua"
WORKLOAD_SCRIPT="$ROOT_DIR/examples/pgo-workload.json"
FETCH_SOURCE=0
CLEAN=0
USE_PGO=1
RUN_WORKLOAD=1
FORCE_PGO=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-dir)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --build-dir)
      BUILD_DIR="$2"
      shift 2
      ;;
    --pgo-dir)
      PGO_DIR="$2"
      shift 2
      ;;
    --qt-prefix)
      QT_PREFIX="$2"
      shift 2
      ;;
    --jobs)
      JOBS="$2"
      shift 2
      ;;
    --generator)
      GENERATOR="$2"
      shift 2
      ;;
    --rom)
      ROM_PATH="$2"
      shift 2
      ;;
    --lua-script)
      LUA_SCRIPT="$2"
      shift 2
      ;;
    --workload-script)
      WORKLOAD_SCRIPT="$2"
      shift 2
      ;;
    --fetch-source)
      FETCH_SOURCE=1
      shift
      ;;
    --clean)
      CLEAN=1
      shift
      ;;
    --no-pgo)
      USE_PGO=0
      RUN_WORKLOAD=0
      shift
      ;;
    --skip-workload)
      RUN_WORKLOAD=0
      shift
      ;;
    --force-pgo)
      FORCE_PGO=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd cmake
require_cmd git
require_cmd node
require_cmd npm

if [[ -z "$GENERATOR" ]]; then
  if command -v ninja >/dev/null 2>&1; then
    GENERATOR="Ninja"
  else
    GENERATOR="Unix Makefiles"
  fi
fi

if [[ -z "$QT_PREFIX" ]]; then
  if command -v brew >/dev/null 2>&1; then
    QT_PREFIX="$(brew --prefix qt 2>/dev/null || true)"
  fi
fi

CC_VERSION="$(cc --version 2>/dev/null | head -n 1 || true)"
if [[ "$USE_PGO" -eq 1 && "$FORCE_PGO" -eq 0 ]]; then
  if [[ "$CC_VERSION" == *"Apple clang"* ]]; then
    echo "AppleClang detected. Disabling PGO automatically (stage 2 flags are GCC-specific)." >&2
    USE_PGO=0
    RUN_WORKLOAD=0
  fi
fi

if [[ -z "$QT_PREFIX" ]]; then
  echo "Could not auto-detect Qt prefix. Provide --qt-prefix PATH." >&2
  exit 1
fi

if [[ "$FETCH_SOURCE" -eq 1 ]]; then
  if [[ -d "$SOURCE_DIR/.git" ]]; then
    echo "Updating source checkout: $SOURCE_DIR"
    git -C "$SOURCE_DIR" fetch --tags --prune
    git -C "$SOURCE_DIR" pull --ff-only
  else
    echo "Cloning source checkout: $SOURCE_DIR"
    git clone https://github.com/mgba-emu/mgba.git "$SOURCE_DIR"
  fi
fi

if [[ ! -f "$SOURCE_DIR/CMakeLists.txt" ]]; then
  echo "mGBA source not found at: $SOURCE_DIR" >&2
  echo "Run with --fetch-source or set --source-dir PATH." >&2
  exit 1
fi

if [[ "$CLEAN" -eq 1 ]]; then
  echo "Cleaning build dir: $BUILD_DIR"
  rm -rf "$BUILD_DIR"
  if [[ "$USE_PGO" -eq 1 ]]; then
    echo "Cleaning PGO dir: $PGO_DIR"
    rm -rf "$PGO_DIR"
  fi
fi

mkdir -p "$BUILD_DIR"
if [[ "$USE_PGO" -eq 1 ]]; then
  mkdir -p "$PGO_DIR"
fi

COMMON_ARGS=(
  -G "$GENERATOR"
  -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_PREFIX_PATH="$QT_PREFIX"
  -DCMAKE_OSX_ARCHITECTURES=arm64
  -DBUILD_QT=ON
  -DBUILD_SDL=OFF
  -DBUILD_HEADLESS=OFF
  -DENABLE_SCRIPTING=ON
  -DUSE_LUA=ON
  -DUSE_EPOXY=ON
  -DUSE_FFMPEG=ON
  -DUSE_LIBZIP=ON
  -DBUILD_LTO=ON
)

if [[ "$USE_PGO" -eq 1 ]]; then
  COMMON_ARGS+=(
    -DBUILD_PGO=ON
    -DPGO_DIR="$PGO_DIR"
  )
else
  COMMON_ARGS+=(
    -DBUILD_PGO=OFF
  )
fi

echo "Configuring stage 1 build"
cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" "${COMMON_ARGS[@]}" -DPGO_STAGE_2=OFF
echo "Building stage 1"
cmake --build "$BUILD_DIR" -j "$JOBS"

MGBABIN="$BUILD_DIR/qt/mGBA.app/Contents/MacOS/mGBA"
if [[ ! -x "$MGBABIN" ]]; then
  echo "Expected binary not found: $MGBABIN" >&2
  exit 1
fi

if [[ "$USE_PGO" -eq 1 && "$RUN_WORKLOAD" -eq 1 ]]; then
  if [[ ! -f "$ROM_PATH" ]]; then
    echo "ROM not found: $ROM_PATH" >&2
    exit 1
  fi
  if [[ ! -f "$LUA_SCRIPT" ]]; then
    echo "Lua script not found: $LUA_SCRIPT" >&2
    exit 1
  fi
  if [[ ! -f "$WORKLOAD_SCRIPT" ]]; then
    echo "Workload script not found: $WORKLOAD_SCRIPT" >&2
    exit 1
  fi

  echo "Building harness TypeScript before workload run"
  npm --prefix "$ROOT_DIR" run build

  echo "Running PGO workload"
  "$MGBABIN" \
    -C hwaccelVideo=1 \
    -C videoSync=0 \
    -C audioSync=0 \
    -C mute=1 \
    --script "$LUA_SCRIPT" \
    "$ROM_PATH" \
    >/tmp/mgba-pgo-workload.log 2>&1 &
  MGBA_PID=$!

  # Give the emulator enough time to bind the scripting socket.
  sleep 3

  set +e
  node "$ROOT_DIR/dist/runHarness.js" --script "$WORKLOAD_SCRIPT"
  HARNESS_STATUS=$?
  set -e

  kill "$MGBA_PID" >/dev/null 2>&1 || true
  wait "$MGBA_PID" >/dev/null 2>&1 || true

  if [[ "$HARNESS_STATUS" -ne 0 ]]; then
    echo "PGO workload run failed (status=$HARNESS_STATUS)." >&2
    echo "See /tmp/mgba-pgo-workload.log for details." >&2
    exit "$HARNESS_STATUS"
  fi

  echo "Configuring stage 2 PGO build"
  cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" "${COMMON_ARGS[@]}" -DPGO_STAGE_2=ON
  echo "Building stage 2"
  cmake --build "$BUILD_DIR" -j "$JOBS"
fi

echo
echo "Build complete: $MGBABIN"
"$MGBABIN" --version || true
