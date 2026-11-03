import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BADGES = ("projects", "ssh", "launcher", "switch", "commands", "confirm")
ORIGINALS = ("spaces", "spaces-shadow", "agents", "agents-shadow", "selected", "terminal", "terminal-shadow")


def pack(sizes, width=4608, gap=4):
    x = y = row_height = gap
    entries = {}
    for name in sorted(sizes, key=lambda name: (-sizes[name][1], name)):
        w, h = sizes[name]
        if x + w + gap > width:
            x = gap
            y += row_height + gap
            row_height = 0
        entries[name] = {"x": x, "y": y, "width": w, "height": h}
        x += w + gap
        row_height = max(row_height, h)
    return {"width": width, "height": y + row_height + gap, "entries": entries}


def badge_cells(width, height, alpha):
    columns = []
    for col in range(2):
        left, right = col * width // 2, (col + 1) * width // 2
        blank = [y for y in range(height) if not any(alpha[y * width + left:y * width + right])]
        boundaries = [0] + [min(blank, key=lambda y: abs(y - row * height / 3)) for row in (1, 2)] + [height]
        columns.append([(left, boundaries[row], right - left, boundaries[row + 1] - boundaries[row]) for row in range(3)])
    return [columns[col][row] for row in range(3) for col in range(2)]


def size(path):
    return tuple(map(int, subprocess.check_output(
        ["magick", "identify", "-format", "%w %h", str(path)], text=True
    ).split()))


def crop(source, bounds, target):
    x, y, w, h = bounds
    subprocess.run(["magick", str(source), "-crop", f"{w}x{h}+{x}+{y}", "+repage", str(target)], check=True)


def pixels(path):
    return subprocess.check_output(["magick", str(path), "-alpha", "on", "-depth", "8", "RGBA:-"])


def build(modal_atlas, saddle_root=None):
    output = ROOT / "assets/title-sprite.png"
    with tempfile.TemporaryDirectory(prefix="p5-title-sprite-") as temp:
        temp = Path(temp)
        sources = {name: ROOT / f"assets/title-sources/{name}.png" for name in ORIGINALS}
        alpha = subprocess.check_output(["magick", str(modal_atlas), "-alpha", "extract", "-depth", "8", "gray:-"])
        for name, bounds in zip(BADGES, badge_cells(*size(modal_atlas), alpha)):
            sources[name] = temp / f"{name}.png"
            crop(modal_atlas, bounds, sources[name])
            subprocess.run(["magick", str(sources[name]), "-trim", "+repage", str(sources[name])], check=True)
        atlas = pack({name: size(path) for name, path in sources.items()})
        command = ["magick", "-size", f"{atlas['width']}x{atlas['height']}", "xc:none",
                   "-define", "compose:outside-overlay=false"]
        for name, entry in atlas["entries"].items():
            command += [str(sources[name]), "-geometry", f"+{entry['x']}+{entry['y']}", "-compose", "Copy", "-composite"]
        command += ["-depth", "8", f"PNG32:{output}"]
        subprocess.run(command, check=True)
        for name, entry in atlas["entries"].items():
            extracted = temp / f"{name}-extracted.png"
            crop(output, (entry["x"], entry["y"], entry["width"], entry["height"]), extracted)
            if pixels(extracted) != pixels(sources[name]):
                raise RuntimeError(f"Sprite pixels changed: {name}")
    manifest = json.dumps(atlas, indent=2) + "\n"
    (ROOT / "assets/title-sprite.json").write_text(manifest)
    data = "export const SPRITE = " + manifest.rstrip() + ";\n"
    for name in ("p5-spaces", "p5-agents", "p5-picker", "p5-palette", "p5-confirm"):
        (ROOT / "mods" / name / "sprite-data.js").write_text(data)
    if saddle_root:
        assets = saddle_root / "assets"
        assets.mkdir(exist_ok=True)
        shutil.copyfile(output, assets / output.name)
        (assets / "title-sprite.json").write_text(manifest)
        for name in ("q-saddle-project", "q-saddle-ssh", "q-saddle-tab", "q-saddle-quick"):
            (saddle_root / "mods" / name / "sprite-data.js").write_text(data)
    print(f"Built {len(sources)} sprites at {atlas['width']}x{atlas['height']}; RGBA pixel verification passed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--modal-atlas", type=Path, required=True)
    parser.add_argument("--saddle-root", type=Path)
    args = parser.parse_args()
    build(args.modal_atlas, args.saddle_root)
