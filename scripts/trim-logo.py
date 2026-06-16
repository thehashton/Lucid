#!/usr/bin/env python3
"""Trim empty padding from logo images using the transparent source bounds."""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Run: python3 -m venv .venv && .venv/bin/pip install pillow", file=sys.stderr)
    sys.exit(1)


def crop_box_from_transparent(path: Path) -> tuple[int, int, int, int] | None:
    with Image.open(path) as img:
        return img.convert("RGBA").getbbox()


def trim_file(path: Path, box: tuple[int, int, int, int]) -> tuple[int, int]:
    with Image.open(path) as img:
        cropped = img.crop(box)
        cropped.save(path, optimize=True)
        return cropped.size


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src = root / "assets" / "lucid-logo.png"
    readme_dir = root / "assets" / "readme"

    if not src.exists():
        print(f"Missing source logo: {src}", file=sys.stderr)
        sys.exit(1)

    box = crop_box_from_transparent(src)
    if not box:
        print("No visible logo content found.", file=sys.stderr)
        sys.exit(1)

    targets = [src, readme_dir / "dark.png", readme_dir / "light.png"]
    for path in targets:
        if not path.exists():
            continue
        size = trim_file(path, box)
        print(f"Trimmed {path.relative_to(root)} -> {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()
