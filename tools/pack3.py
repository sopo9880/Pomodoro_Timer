"""Back-view arms and the two-sided long cape -> rig parts.

Run: python3 tools/pack3.py <arms sheet> <cape sheet>
     python3 tools/pack3.py --side <side cape sheet>
Writes the part images and prints the rig data (w, h, pivot, end) to paste
into garden/avatar-rig-data.mjs.
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, str(Path(__file__).parent))
from keyer import key, parts

ROOT = Path(__file__).resolve().parent.parent
AV = ROOT / "assets/art/avatar"


def tight(a, pad=2):
    ys, xs = np.where(a[..., 3] > 12)
    return a[max(0, ys.min() - pad):ys.max() + 1 + pad, max(0, xs.min() - pad):xs.max() + 1 + pad]


def resize(a, s):
    im = Image.fromarray(a)
    return np.array(im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS))


def save(a, rel):
    Image.fromarray(a).save(AV / rel, "WEBP", quality=92, method=6)


def gold_mask(a):
    r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
    return (a[..., 3] > 150) & (b < r * 0.62) & (g > r * 0.55) & (r > 110)


def centre_x(a, y):
    xs = np.where(a[y, :, 3] > 128)[0]
    return float((xs[0] + xs[-1]) / 2) if len(xs) else a.shape[1] / 2


def arms_and_capes(arms_path, cape_path):
    out = {}
    # ---------------------------------------------------------------- back arms
    arms = sorted(parts(key(arms_path), min_area=4000), key=lambda p: p["box"][0])[:2]
    TARGET_SLEEVE_W = 98
    for p, side in zip(arms, ("left", "right")):
        a = tight(p["img"])
        h = a.shape[0]
        rows = np.where(gold_mask(a).sum(1) > a.shape[1] * 0.2)[0]
        rows = rows[rows < h * 0.6]
        cuff = rows.max() + 1  # bottom of the gold cuff
        sl = tight(a[:cuff + 2].copy())
        s = TARGET_SLEEVE_W / sl.shape[1]
        tuck = max(6, int(h * 0.02))
        fa = a[cuff - tuck:].copy()
        fa = tight(fa)
        sl, fa = resize(sl, s), resize(fa, s)
        save(sl, f"back/sleeve_{side}.webp")
        save(fa, f"back/forearm_{side}.webp")
        sh, sw = sl.shape[:2]
        fh, fw = fa.shape[:2]
        key_ = "L" if side == "left" else "R"
        out["sleeve" + key_] = {"w": sw, "h": sh, "pivot": [round(centre_x(sl, 6), 1), 7.0],
                                "end": [round(centre_x(sl, sh - 3), 1), float(sh - 6)]}
        out["forearm" + key_] = {"w": fw, "h": fh, "pivot": [round(centre_x(fa, 8), 1), float(round(tuck * s) + 2)],
                                 "end": [round(centre_x(fa, fh - 3), 1), float(fh - 6)]}

    # ---------------------------------------------------------------- long cape
    cape_sheet = key(cape_path)
    capes = sorted(parts(cape_sheet, min_area=60000), key=lambda p: p["box"][0])
    back_c, front_c = (tight(c["img"]) for c in capes[:2])
    W = 366
    for name, a in (("back", back_c), ("front", front_c)):
        a = resize(a, W / a.shape[1])
        if name == "back":
            save(a, "back/cape.webp")
            out["back.cape"] = {"w": a.shape[1], "h": a.shape[0], "pivot": [round(centre_x(a, 4), 1), 8.0]}
            continue
        # front: split the lining seen through the opening (behind the body) from the outer drape
        r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
        mx = np.maximum(np.maximum(r, g), b) / 255
        sat = (mx - np.minimum(np.minimum(r, g), b) / 255) / (mx + 1e-6)
        gold = nd.binary_dilation((r > g * 0.95) & (r > b * 1.25) & (mx > 0.38) & (sat > 0.25), iterations=1)
        lab, _ = nd.label((a[..., 3] > 120) & ~gold)
        h, w = a.shape[:2]
        ids = {lab[int(h * fy), int(w * 0.5)] for fy in (0.45, 0.65, 0.85)} - {0}
        lining = np.isin(lab, list(ids))
        outer_cloth = (lab > 0) & ~lining
        # gold trim belongs to the drape only where it runs along the outer cloth
        # (the drape's front edges); the hem seen inside the opening is lining
        near_outer = nd.distance_transform_edt(~outer_cloth) <= 7
        lining |= gold & (a[..., 3] > 0) & ~near_outer
        lining = nd.binary_fill_holes(nd.binary_dilation(lining, iterations=1)) & ~(outer_cloth & ~nd.binary_dilation(lining, iterations=1))
        soft = nd.gaussian_filter(lining.astype(float), 0.7)
        inner, outer = a.copy().astype(float), a.copy().astype(float)
        inner[..., 3] *= soft
        outer[..., 3] *= 1 - soft
        save(inner.clip(0, 255).astype(np.uint8), "front/cape_inner.webp")
        save(outer.clip(0, 255).astype(np.uint8), "front/cape.webp")
        out["front.cape"] = {"w": w, "h": h, "pivot": [round(centre_x(a, 4), 1), 8.0], "lining_px": int(lining.sum())}
    print(json.dumps(out, indent=1))
    return out



def side_capes(sheet_path):
    """Side-view long capes (LEFT / RIGHT sheets). Each is split into the lining
    seen at the front opening (behind the body) and the outer drape. The LEFT
    painting is mirrored, because the rig mirrors the whole side view."""
    sheet = key(sheet_path)
    capes = sorted(parts(sheet, min_area=60000), key=lambda p: p["box"][0])[:2]
    res = {}
    for p, name, seeds in zip(capes, ("capeL", "cape"),
                              ([(0.1, 0.6), (0.07, 0.75), (0.12, 0.45)], [(0.9, 0.6), (0.93, 0.75), (0.88, 0.45)])):
        a = tight(p["img"])
        a = resize(a, 391 / a.shape[0])
        if name == "capeL":
            a = a[:, ::-1].copy()
            seeds = [(1 - x, y) for x, y in seeds]
        r, g, b = (a[..., i].astype(float) for i in range(3))
        mx = np.maximum(np.maximum(r, g), b) / 255
        sat = (mx - np.minimum(np.minimum(r, g), b) / 255) / (mx + 1e-6)
        gold = nd.binary_dilation((r > g * 0.95) & (r > b * 1.25) & (mx > 0.38) & (sat > 0.25), iterations=1)
        lab, _ = nd.label((a[..., 3] > 120) & ~gold)
        h, w = a.shape[:2]
        ids = {lab[int(fy * h), int(fx * w)] for fx, fy in seeds} - {0}
        lining = np.isin(lab, list(ids))
        outer_cloth = (lab > 0) & ~lining
        near_outer = nd.distance_transform_edt(~outer_cloth) <= 7
        lining |= gold & (a[..., 3] > 0) & ~near_outer
        lining = nd.binary_fill_holes(nd.binary_dilation(lining, iterations=1)) & ~(outer_cloth & ~nd.binary_dilation(lining, iterations=1))
        soft = nd.gaussian_filter(lining.astype(float), 0.7)
        inner, outer = a.astype(float), a.astype(float)
        inner[..., 3] *= soft
        outer[..., 3] *= 1 - soft
        fn = "cape_left" if name == "capeL" else "cape"
        save(inner.clip(0, 255).astype(np.uint8), f"side/{fn}_inner.webp")
        save(outer.clip(0, 255).astype(np.uint8), f"side/{fn}.webp")
        top = np.where(a[:6, :, 3].max(0) > 128)[0]
        res[name] = {"w": w, "h": h, "pivot": [round(float(top.mean()), 1), 6.0]}
    return res


if __name__ == "__main__":
    # pack3.py <arms sheet> <front/back cape sheet>   |   pack3.py --side <side cape sheet>
    if sys.argv[1] == "--side":
        print(json.dumps(side_capes(sys.argv[2]), indent=1))
    else:
        arms_and_capes(sys.argv[1], sys.argv[2])
