"""Far-arm (side view) and back-view forearm replacements.

Run: python3 tools/pack4.py <side arms sheet: arm 1, arm 2> <back forearms sheet>
- side view facing right: far arm = arm 2
- side view facing left:  far arm = arm 1 (stored mirrored; the rig mirrors the side view)
- back view: forearms = the two bare arms (screen-left -> forearmL)
Prints rig data for avatar-rig-data.mjs.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from keyer import key, parts

AV = Path(__file__).resolve().parent.parent / "assets/art/avatar"


def tight(a, pad=2):
    ys, xs = np.where(a[..., 3] > 12)
    return a[max(0, ys.min() - pad):ys.max() + 1 + pad, max(0, xs.min() - pad):xs.max() + 1 + pad]


def to_height(a, h):
    im = Image.fromarray(a)
    return np.array(im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS))


def cx(a, y):
    xs = np.where(a[min(y, a.shape[0] - 1), :, 3] > 128)[0]
    return round(float((xs[0] + xs[-1]) / 2), 1) if len(xs) else a.shape[1] / 2


def two_arms(path, min_area):
    ps = sorted(parts(key(path), min_area=min_area), key=lambda p: -p["img"][..., 3].astype(bool).sum())[:2]
    return [tight(p["img"]) for p in sorted(ps, key=lambda p: p["box"][0])]


out = {}
arm1, arm2 = two_arms(sys.argv[1], 8000)
for name, a, mirror in (("armFar", arm2, False), ("armFarL", arm1, True)):
    a = to_height(a, 314)
    if mirror:
        a = a[:, ::-1].copy()
    fn = "arm_far.webp" if name == "armFar" else "arm_far_left.webp"
    Image.fromarray(a).save(AV / "side" / fn, "WEBP", quality=92, method=6)
    h = a.shape[0]
    out[name] = {"file": fn, "w": a.shape[1], "h": h, "pivot": [cx(a, 19), 19.0], "end": [cx(a, h - 14), float(h - 14)]}

def upright(a):
    """Rotate a slanted arm so it hangs straight down from its top."""
    h = a.shape[0]
    top, bot = cx(a, int(h * 0.04)), cx(a, int(h * 0.96))
    ang = np.degrees(np.arctan2(bot - top, h * 0.92))
    im = Image.fromarray(a).rotate(-ang, resample=Image.BICUBIC, expand=True)
    return tight(np.array(im))


for side, a in zip(("L", "R"), two_arms(sys.argv[2], 600)):
    a = to_height(upright(a), 233)
    fn = f"forearm_{'left' if side == 'L' else 'right'}.webp"
    Image.fromarray(a).save(AV / "back" / fn, "WEBP", quality=92, method=6)
    h = a.shape[0]
    out["forearm" + side] = {"file": fn, "w": a.shape[1], "h": h, "pivot": [cx(a, 8), 8.0], "end": [cx(a, h - 6), float(h - 6)]}
print(json.dumps(out))
