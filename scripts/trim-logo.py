#!/usr/bin/env python3
"""Trim empty padding from the transparent source logo using alpha-channel bounds."""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Run: python3 -m venv .venv && .venv/bin/pip install pillow", file=sys.stderr)
    sys.exit(1)

# Ignore faint outer glow; lower = tighter crop.
ALPHA_THRESHOLD = 25


def alpha_bbox(img: Image.Image, threshold: int = ALPHA_THRESHOLD) -> tuple[int, int, int, int] | None:
    rgba = img.convert("RGBA")
    alpha = rgba.split()[3]
    # getbbox() on RGBA includes transparent pixels with non-zero RGB (palette bleed).
    mask = alpha.point(lambda a: 255 if a > threshold else 0)
    return mask.getbbox()


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src = root / "assets" / "lucid-logo.png"

    if not src.exists():
        print(f"Missing source logo: {src}", file=sys.stderr)
        sys.exit(1)

    with Image.open(src) as img:
        box = alpha_bbox(img)
        if not box:
            print("No visible logo content found.", file=sys.stderr)
            sys.exit(1)
        cropped = img.convert("RGBA").crop(box)
        cropped.save(src, optimize=True)
        print(f"Trimmed {src.relative_to(root)} -> {cropped.size[0]}x{cropped.size[1]}")


if __name__ == "__main__":
    main()
