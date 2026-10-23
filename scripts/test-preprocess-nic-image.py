#!/usr/bin/env python3
"""Synthetic unit tests for NIC image preprocessing."""

import tempfile
import unittest
from pathlib import Path

from PIL import Image

from importlib.util import module_from_spec, spec_from_file_location

SCRIPT = Path(__file__).with_name("preprocess-nic-image.py")
SPEC = spec_from_file_location("preprocess_nic_image", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class PreprocessNicImageTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.source = self.root / "synthetic.png"
        self.output = self.root / "processed.png"

    def tearDown(self):
        self.temp_dir.cleanup()

    def make_image(self, size=(800, 400), image_format="PNG"):
        Image.new("RGB", size, "white").save(self.source, format=image_format)

    def test_converts_to_grayscale_png_and_upscales_small_image(self):
        self.make_image()
        MODULE.preprocess(self.source, self.output)

        with Image.open(self.output) as result:
            self.assertEqual(result.format, "PNG")
            self.assertEqual(result.mode, "L")
            self.assertEqual(result.size, (1800, 900))

    def test_preserves_dimensions_within_target_range(self):
        self.make_image(size=(2400, 1200))
        MODULE.preprocess(self.source, self.output)

        with Image.open(self.output) as result:
            self.assertEqual(result.size, (2400, 1200))

    def test_downscales_oversized_image(self):
        self.make_image(size=(4000, 2000))
        MODULE.preprocess(self.source, self.output)

        with Image.open(self.output) as result:
            self.assertEqual(result.size, (3000, 1500))

    def test_rejects_unsupported_image_format(self):
        self.make_image(image_format="BMP")

        with self.assertRaises(ValueError):
            MODULE.preprocess(self.source, self.output)

    def test_rejects_invalid_image_bytes(self):
        self.source.write_bytes(b"not an image")

        with self.assertRaises((OSError, ValueError)):
            MODULE.preprocess(self.source, self.output)

    def test_rejects_empty_input(self):
        self.source.write_bytes(b"")

        with self.assertRaises(ValueError):
            MODULE.preprocess(self.source, self.output)

    def test_rejects_input_larger_than_limit(self):
        self.source.write_bytes(b"x" * (MODULE.MAX_INPUT_BYTES + 1))

        with self.assertRaises(ValueError):
            MODULE.preprocess(self.source, self.output)


if __name__ == "__main__":
    unittest.main(verbosity=2)
