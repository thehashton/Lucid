#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/lucid-logo.png"
OUT_DIR="$ROOT/assets/readme"
PYTHON="$ROOT/.venv/bin/python3"

if [[ ! -f "$SRC" ]]; then
  echo "Missing transparent source logo: $SRC" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate README logo variants." >&2
  exit 1
fi

if [[ ! -x "$PYTHON" ]]; then
  echo "Setting up Python venv for logo scripts..."
  python3 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install pillow -q
fi

mkdir -p "$OUT_DIR"

# Trim padding from the transparent source before generating variants.
"$PYTHON" "$ROOT/scripts/trim-logo.py"

WIDTH=$(sips -g pixelWidth "$SRC" 2>/dev/null | awk '/pixelWidth/ { print $2 }')
HEIGHT=$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight/ { print $2 }')

# Match GitHub README canvas colors so the logo blends without a visible box.
ffmpeg -y -f lavfi -i "color=c=0d1117:s=${WIDTH}x${HEIGHT}:d=1" -i "$SRC" \
  -filter_complex "[0][1]overlay=format=auto" -frames:v 1 "$OUT_DIR/dark.png" >/dev/null 2>&1

ffmpeg -y -f lavfi -i "color=c=ffffff:s=${WIDTH}x${HEIGHT}:d=1" -i "$SRC" \
  -filter_complex "[0][1]overlay=format=auto" -frames:v 1 "$OUT_DIR/light.png" >/dev/null 2>&1

echo "Generated:"
echo "  $OUT_DIR/dark.png"
echo "  $OUT_DIR/light.png"
