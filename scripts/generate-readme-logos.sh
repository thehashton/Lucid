#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/lucid-logo.png"
OUT_DIR="$ROOT/assets/readme"

if [[ ! -f "$SRC" ]]; then
  echo "Missing transparent source logo: $SRC" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate README logo variants." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Match GitHub README canvas colors so the logo blends without a visible box.
WIDTH=$(sips -g pixelWidth "$SRC" 2>/dev/null | awk '/pixelWidth/ { print $2 }')
HEIGHT=$(sips -g pixelHeight "$SRC" 2>/dev/null | awk '/pixelHeight/ { print $2 }')

ffmpeg -y -f lavfi -i "color=c=0d1117:s=${WIDTH}x${HEIGHT}:d=1" -i "$SRC" \
  -filter_complex "[0][1]overlay=format=auto" -frames:v 1 "$OUT_DIR/dark.png" >/dev/null 2>&1

ffmpeg -y -f lavfi -i "color=c=ffffff:s=${WIDTH}x${HEIGHT}:d=1" -i "$SRC" \
  -filter_complex "[0][1]overlay=format=auto" -frames:v 1 "$OUT_DIR/light.png" >/dev/null 2>&1

echo "Generated:"
echo "  $OUT_DIR/dark.png"
echo "  $OUT_DIR/light.png"
