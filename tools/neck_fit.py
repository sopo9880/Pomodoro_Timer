"""Fit the separate neck piece to the neck stub painted under each head.

The head pictures already include the top of the neck in the chin's shadow.
The neck piece was a rounded capsule, so its lighter rounded top showed as a
second band under the chin. This squares off the capsule top and paints the
chin shadow down into it, so stub and neck read as one neck. Sizes and pivots
are unchanged, so the rig data stays valid.

Sources: tools/rig_src/<view>_neck.webp -> assets/art/avatar/<view>/neck.webp
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# Shadow colour of the stub under each head (sampled from head.webp).
SHADOW = {"front": (190, 122, 111), "side": (214, 146, 136)}


def fit(view: str, fade: float = 0.38, strength: float = 0.8) -> None:
    src = np.array(Image.open(ROOT / f"tools/rig_src/{view}_neck.webp").convert("RGBA")).astype(float)
    h, w = src.shape[:2]
    alpha = src[..., 3] > 128
    widths = alpha.sum(1)
    body = int(np.median(widths[h // 5: h // 2]))
    top = next(y for y in range(h) if widths[y] >= body * 0.92)
    cols = np.where(alpha[top])[0]
    x0, x1 = cols[0], cols[-1]
    out = src.copy()
    for y in range(top):  # square the rounded cap using the first full row
        out[y, x0:x1 + 1] = src[top, x0:x1 + 1]
    shade = np.array(SHADOW[view], float)
    g = int(h * fade)
    for y in range(g):
        k = strength * (1 - y / g) ** 1.4
        row = out[y, :, :3]
        out[y, :, :3] = row * (1 - k) + shade * k
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(
        ROOT / f"assets/art/avatar/{view}/neck.webp", "WEBP", quality=92, method=6)
    print(view, "body width", body, "cap rows", top)


def feather_stub(src: Path, dst: Path, keep: float = 0.25) -> None:
    """Fade the neck stub under the chin to transparent so it melts into the
    neck piece drawn behind it, instead of ending in a hard edge."""
    a = np.array(Image.open(src).convert("RGBA")).astype(float)
    h, w = a.shape[:2]
    cx = w // 2
    lum = a[..., :3].mean(2)
    lo = int(h * 0.85)
    jaw = lo + int(np.argmin(lum[lo:, cx] + (a[lo:, cx, 3] < 128) * 999))
    start = jaw + max(2, int(h * 0.012))
    span = h - start
    for y in range(start, h):
        row = a[y, :, 3] > 20
        if not row[cx]:
            continue
        x0 = x1 = cx
        while x0 > 0 and row[x0 - 1]:
            x0 -= 1
        while x1 < w - 1 and row[x1 + 1]:
            x1 += 1
        t = (y - start) / span
        k = max(0.0, 1 - t / (1 - keep)) if t > 0 else 1.0
        a[y, x0:x1 + 1, 3] *= k
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(dst, "WEBP", quality=92, method=6)
    print(dst.name, "jaw row", jaw, "of", h)


if __name__ == "__main__":
    for v in ("front", "side"):
        fit(v)
    feather_stub(ROOT / "tools/rig_src/front_head.webp", ROOT / "assets/art/avatar/front/head.webp")
    for src in sorted((ROOT / "tools/rig_src").glob("expressions_*.webp")):
        feather_stub(src, ROOT / "assets/art/avatar/expressions" / src.name.replace("expressions_", ""))
