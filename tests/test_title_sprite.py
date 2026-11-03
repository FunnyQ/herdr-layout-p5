import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "build_title_sprite", Path(__file__).parents[1] / "scripts/build_title_sprite.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PackingTest(unittest.TestCase):
    def test_preserves_dimensions_and_keeps_entries_disjoint_inside_atlas(self):
        sizes = {"a": (2172, 724), "b": (2135, 736), "c": (768, 342), "d": (1983, 793)}
        atlas = builder.pack(sizes)
        entries = atlas["entries"]
        self.assertEqual(set(entries), set(sizes))
        for name, entry in entries.items():
            self.assertEqual((entry["width"], entry["height"]), sizes[name])
            self.assertGreaterEqual(entry["x"], 0)
            self.assertGreaterEqual(entry["y"], 0)
            self.assertLessEqual(entry["x"] + entry["width"], atlas["width"])
            self.assertLessEqual(entry["y"] + entry["height"], atlas["height"])
        for name, a in entries.items():
            for other, b in entries.items():
                if name != other:
                    self.assertTrue(
                        a["x"] + a["width"] <= b["x"]
                        or b["x"] + b["width"] <= a["x"]
                        or a["y"] + a["height"] <= b["y"]
                        or b["y"] + b["height"] <= a["y"]
                    )

    def test_badges_split_at_transparency_when_glyphs_cross_nominal_grid(self):
        alpha = bytes(0 if y in (5, 9) else 255 for y in range(12) for x in range(8))
        cells = builder.badge_cells(8, 12, alpha)
        self.assertEqual(cells[0], (0, 0, 4, 5))
        self.assertEqual(cells[2], (0, 5, 4, 4))
        self.assertEqual(cells[4], (0, 9, 4, 3))


if __name__ == "__main__":
    unittest.main()
