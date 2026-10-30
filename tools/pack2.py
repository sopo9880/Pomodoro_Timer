"""Prompt pack 2 -> game assets (landmarks, animated decor, emotes, signs, sit, cheer arms).

Run: python3 tools/pack2.py <folder with the chosen pack-2 sheets>
Sheets are matched by the hash in their file name. Outputs go to assets/art and a
preview to tools/pack2_preview.png (not shipped).
"""
import sys, glob, os
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from keyer import key, parts

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets/art"
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/pack2")


def sheet(h):
    f = next(iter(glob.glob(str(SRC / f"*{h}*.jpg"))))
    cache = SRC / f"{h}.npy"
    return np.load(cache) if cache.exists() else key(f)


def tight(a, pad=2):
    ys, xs = np.where(a[..., 3] > 12)
    y0, y1, x0, x1 = max(0, ys.min() - pad), ys.max() + 1 + pad, max(0, xs.min() - pad), xs.max() + 1 + pad
    return a[y0:y1, x0:x1]


def window(a, x0, y0, x1, y1):
    return tight(a[y0:y1, x0:x1].copy())


def save(a, rel, max_w=None, max_h=None, q=90):
    im = Image.fromarray(a) if isinstance(a, np.ndarray) else a
    s = 1.0
    if max_w: s = min(s, max_w / im.width)
    if max_h: s = min(s, max_h / im.height)
    if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = ART / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p, "WEBP", quality=q, method=6)
    return im


def frames(imgs, rel_fmt, max_h, anchor="bottom"):
    """Frames on one shared canvas, bottom-centre aligned, so they never jump."""
    W = max(i.shape[1] for i in imgs); H = max(i.shape[0] for i in imgs)
    out = []
    for k, a in enumerate(imgs):
        c = np.zeros((H, W, 4), np.uint8)
        x = (W - a.shape[1]) // 2
        y = H - a.shape[0] if anchor == "bottom" else 0
        c[y:y + a.shape[0], x:x + a.shape[1]] = a
        out.append(save(c, rel_fmt.format(k), max_h=max_h))
    return out


made = []
# --- landmarks (whole picture; small detached bits such as chimney smoke stay)
for h, name in [("1e82db65", "cottage"), ("9254790", "mushroom_house")]:
    made.append(save(tight(sheet(h)), f"world/landmarks/pack2/{name}.webp", max_w=640))
wm = sheet("fff7ade2")
ps = parts(wm, min_area=400)
house = max(ps, key=lambda p: p["img"].shape[0] * p["img"].shape[1] if p["box"][0] < 800 else 0)
wheel = [p for p in ps if p["box"][0] > 800][0]
made.append(save(tight(house["img"]), "world/landmarks/pack2/watermill.webp", max_w=640))
made.append(save(tight(wheel["img"]), "world/landmarks/pack2/waterwheel.webp", max_w=320))

# --- single decor
for h, name in [("7bf1217a", "apple_tree"), ("42b24c10", "star_crystal"), ("e5b5d1cf", "mailbox"),
                ("cfbf7600", "garden_swing")]:
    made.append(save(tight(sheet(h)), f"world/decor/{name}.webp", max_w=420))
extra = parts(sheet("b1a2ce19"), min_area=400)
bath = [p for p in extra if p["box"][0] > 1000 and p["box"][1] > 400]
bath = max(bath, key=lambda p: p["box"][3] - p["box"][1])
made.append(save(tight(bath["img"]), "world/decor/birdbath.webp", max_w=300))

# --- campfire: stone ring + 4 flame frames (+ unlit ring)
cf = parts(sheet("490bd2c2"), min_area=400)
cf.sort(key=lambda p: (p["box"][1] > 420, p["box"][0]))
made.append(save(tight(cf[0]["img"]), "world/decor/campfire_ring.webp", max_w=360))
made += frames([tight(p["img"]) for p in cf[1:5]], "world/decor/campfire_flame_{}.webp", max_h=200)
made.append(save(tight(cf[5]["img"]), "world/decor/campfire_ring_unlit.webp", max_w=360))

# --- wind chime: pole + three swing frames composed onto the hook
ch = sheet("40fedaec")
pole = window(ch, 140, 10, 420, 740)
H0 = ch[10:740, 140:420]
ys, xs = np.where(H0[..., 3] > 100)
top = ys.min()
hook_x = xs[ys < top + 0.14 * H0.shape[0]].max() - 14 + 140  # tip of the bracket
hook_y = top + 10 + 40
chimes = [window(ch, x0, 60, x1, 700) for x0, x1 in [(440, 690), (760, 950), (1030, 1290)]]
pole_full = ch[0:740, 140:420]
frames_out = []
for c in chimes:
    W = 420; Hh = 760
    canvas = np.zeros((Hh, W, 4), np.uint8)
    canvas[0:740, 0:280] = pole_full
    cx = hook_x - 140 + 4
    x = int(cx - c.shape[1] / 2); y = hook_y + 6
    x = max(0, min(W - c.shape[1], x))
    region = canvas[y:y + c.shape[0], x:x + c.shape[1]]
    a = c[..., 3:4] / 255.0
    region[..., :3] = (c[..., :3] * a + region[..., :3] * (1 - a)).astype(np.uint8)
    region[..., 3] = np.maximum(region[..., 3], c[..., 3])
    frames_out.append(canvas)
made += frames([tight(f, pad=0) if False else f for f in frames_out], "world/decor/wind_chime_{}.webp", max_h=420)

# --- emotes (3x3 grid, reading order)
em = sorted(parts(sheet("5ec6f959"), min_area=4000), key=lambda p: (p["box"][1] // 200, p["box"][0]))
for p, n in zip(em, ["heart", "exclaim", "question", "sleep", "music", "sparkle", "drop", "flower", "dots"]):
    made.append(save(tight(p["img"]), f"ui/emotes/{n}.webp", max_w=128))

# --- signboards: split rows by empty alpha rows
sg = sheet("3f98f45a")
rows = (sg[..., 3] > 60).sum(1)
bands, inside, start = [], False, 0
for y, v in enumerate(rows):
    if v > 40 and not inside: inside, start = True, y
    if v <= 40 and inside:
        inside = False
        if y - start > 60: bands.append((start, y))
if inside: bands.append((start, len(rows)))
for (y0, y1), n in zip(bands, ["plain", "flower", "locked"]):
    made.append(save(tight(sg[max(0, y0 - 30):min(len(rows), y1 + 30)]), f"ui/signs/{n}.webp", max_w=520))

# --- sitting rest pose: 4 frames, evenly spaced
st = sheet("556bd3db")
W4 = st.shape[1] / 4
made += frames([tight(st[:, round(i * W4):round((i + 1) * W4)].copy()) for i in range(4)],
               "avatar/sit/sit_{}.webp", max_h=420)

# --- cheer arms (for the focus-complete moment)
ar = sorted(parts(sheet("4fc2d6d9"), min_area=400), key=lambda p: p["box"][0])
names = ["up_left", "up_right", "spread_left", "spread_right"]
for p, n in zip(ar, names):
    made.append(save(tight(p["img"]), f"avatar/cheer/{n}.webp", max_h=360))

# preview
cell = 200
prev = Image.new("RGBA", (cell * 8, cell * ((len(made) + 7) // 8)), (70, 82, 64, 255))
for i, im in enumerate(made):
    t = im.copy(); t.thumbnail((cell - 10, cell - 10))
    prev.alpha_composite(t.convert("RGBA"), ((i % 8) * cell + 5, (i // 8) * cell + 5))
prev.save(ROOT / "tools/pack2_preview.png")
print(len(made), "files")
