#!/usr/bin/env python3
"""Safely normalize JPEG/PNG images before NIC OCR."""

import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError

MAX_INPUT_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
MIN_LONG_EDGE = 1800
MAX_LONG_EDGE = 3000


def preprocess(source: Path, destination: Path) -> None:
    if not source.is_file() or source.stat().st_size == 0:
        raise ValueError("Invalid input")

    if source.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("Input too large")

    # Limit decompression-bomb exposure before loading pixel data.
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS

    with Image.open(source) as original:
        if original.format not in ("JPEG", "PNG"):
            raise ValueError("Unsupported image format")

        width, height = original.size
        if width < 1 or height < 1 or width * height > MAX_PIXELS:
            raise ValueError("Image dimensions exceed limits")

        original.load()
        image = ImageOps.exif_transpose(original)
        image = image.convert("L")
        image = ImageOps.autocontrast(image, cutoff=1)
        image = ImageEnhance.Contrast(image).enhance(1.15)

        width, height = image.size
        longest_edge = max(width, height)

        if longest_edge < MIN_LONG_EDGE:
            scale = MIN_LONG_EDGE / longest_edge
        elif longest_edge > MAX_LONG_EDGE:
            scale = MAX_LONG_EDGE / longest_edge
        else:
            scale = 1.0

        if scale != 1.0:
            new_size = (
                max(1, round(width * scale)),
                max(1, round(height * scale)),
            )
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="PNG", optimize=True)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: preprocess-nic-image.py INPUT OUTPUT", file=sys.stderr)
        return 2

    try:
        preprocess(Path(sys.argv[1]), Path(sys.argv[2]))
        return 0
    except (
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
    ):
        # Do not print document content, paths, or internal image errors.
        print("Image preprocessing failed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
