"""Pack 5 result (palm-forward arms): cut the arm pieces out of the generated sheets, turn them to hang
from the shoulder like the rig's own arms, fit them to the rig's arm size, and register them for the
"cheer" pose of the linen outfit in garden/rig-tuning-data.mjs.

Run: python3 tools/pack10.py path/to/unzipped/pack5   (needs the sheets named as in the zip)
"""
import glob, json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import keyer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/art/avatar/palm"
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/p5in")
W, H = 94, 314                         # the rig's whole-arm size (side/arm_near.webp)
SHEETS = {"front": "Anime_girl_arms_grid_drawing_961c2444", "side": "Anime_arms_raised_side_view_0233afbe"}


def pieces(name):
    rgba = keyer.key(str(SRC / (name + ".jpg")))
    return [Image.fromarray(p["img"]) for p in keyer.parts(rgba)]


def hang(img, w=W, h=H):
    """Rotate so the shoulder is at the top, then fit the visible shape into w x h (top aligned, centred)."""
    img = img.rotate(180, expand=True)
    box = img.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
    img = img.crop(box)
    s = min(w / img.width, h / img.height)
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(img, ((w - img.width) // 2, 0), img)
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    front = pieces(SHEETS["front"])
    side = pieces(SHEETS["side"])
    made = {}
    for i, name in enumerate(["front_R", "front_L", "back_R", "back_L"][: len(front)]):
        hang(front[i]).save(OUT / f"{name}.webp", quality=92); made[name] = f"assets/art/avatar/palm/{name}.webp"
    for i, name in enumerate(["side_near", "side_far"][: len(side)]):
        hang(side[i]).save(OUT / f"{name}.webp", quality=92); made[name] = f"assets/art/avatar/palm/{name}.webp"
    layers = {"front": {}, "back": {}, "side": {}}
    for view in ("front", "back"):
        for side_ in ("L", "R"):
            layers[view]["sleeve" + side_] = {"img": made[f"{view}_{side_}"]} if f"{view}_{side_}" in made else {}
            layers[view]["forearm" + side_] = {"hide": True}
    layers["side"]["armNear"] = {"img": made["side_near"]}
    layers["side"]["armFar"] = {"img": made["side_far"]}
    for v in layers:
        layers[v] = {k: x for k, x in layers[v].items() if x}
    data_file = ROOT / "garden/rig-tuning-data.mjs"
    cur = json.loads(re.search(r"=\s*(\{.*\});", data_file.read_text(encoding="utf-8"), re.S).group(1))
    node = cur.setdefault("layers", {}).setdefault("outfit-linen", {}).setdefault("cheer", {})
    for view, parts in layers.items():
        node.setdefault(view, {}).update(parts)
    data_file.write_text(
        "// Tuning committed with the game (what everyone sees). Written by tools/studio-apply.py from a\n"
        "// studio export. A person's own studio edits sit on top of this in their browser.\n"
        "export const RIG_TUNING_DATA = " + json.dumps(cur, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(json.dumps(made, indent=1))


main()
