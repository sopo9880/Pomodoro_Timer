"""Wardrobe variants (hair, outfit, shoes) from the prompt-pack-3 sheets.

Run: python3 tools/pack5.py <folder with the chosen pack-3 sheets>

Each sheet is keyed, split into parts, ordered (rows top to bottom, left to right)
and fitted onto the canvas of the default rig part it replaces (same size, same
pivot), so the rig needs no new joint data. Writes the images under
assets/art/avatar/variants/ and garden/avatar-variants-data.mjs.
"""
import glob, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from keyer import key, parts

ROOT = Path(__file__).resolve().parent.parent
AV = ROOT / "assets/art/avatar"
OUT = AV / "variants"
SRC = Path(sys.argv[1])
VER = "1"

# sku -> sheet hash; each sheet's parts, in reading order, map onto these (view, part, default file).
HAIR = [("front", "head", "front/head.webp"), ("front", "hair", "front/hair_back.webp"),
        ("side", "head", "side/head.webp"), ("side", "headBlink", "side/head_blink.webp"),
        ("side", "hair", "side/hair_back.webp"), ("back", "head", "back/head.webp")]
OUTFIT = [("front", "torso", "front/torso.webp"), ("front", "skirt", "front/skirt.webp"),
          ("front", "sleeveL", "front/sleeve_left.webp"), ("front", "sleeveR", "front/sleeve_right.webp"),
          ("side", "torso", "side/torso.webp"), ("side", "skirt", "side/skirt.webp"),
          ("side", "armNear", "side/arm_near.webp"), ("side", "armFar", "side/arm_far.webp"), ("side", "armFarL", "side/arm_far_left.webp"),
          ("back", "torso", "back/torso.webp"), ("back", "skirt", "back/skirt.webp"),
          ("back", "sleeveL", "back/sleeve_left.webp"), ("back", "sleeveR", "back/sleeve_right.webp")]
SHOES6 = [("front", "shinL", "boots/front_left.webp"), ("front", "shinR", "boots/front_right.webp"),
          ("back", "shinL", "boots/back_left.webp"), ("back", "shinR", "boots/back_right.webp"),
          ("side", "shinNear", "boots/side_near.webp"), ("side", "shinFar", "boots/side_far.webp")]
EXPR = ["neutral", "blink", "halfblink", "happy", "surprised", "focused"]

SHEETS = {
    "hair-chestnut": ("e0ed807a", "hair", 2500), "hair-silver": ("15443005", "hair", 2500), "hair-bloom": ("3991798e", "hair", 2500),
    "outfit-forest": ("b986d45a", "outfit", 3000), "outfit-garden": ("1fa6c5fd", "outfit", 3000), "outfit-starlight": ("ba10f692", "outfit", 3000),
    "shoes-boots": ("4dc49093", "shoes6", 3000), "shoes-sky": ("db027b94", "shoes5", 3000),
}
EXPRESSIONS = {"hair-chestnut": "d1b16ea2", "hair-silver": "e6f51f0e", "hair-bloom": "4a50684f"}


def sheet_path(h):
    return next(iter(glob.glob(str(SRC / f"*{h}*.jpg"))))


def order(ps, gap=.45):
    """Rows by vertical centre, then left to right."""
    ps = sorted(ps, key=lambda p: (p["box"][1] + p["box"][3]) / 2)
    rows = []
    for p in ps:
        cy = (p["box"][1] + p["box"][3]) / 2; h = p["box"][3] - p["box"][1]
        if rows and abs(cy - rows[-1]["cy"]) < gap * max(h, rows[-1]["h"]):
            rows[-1]["items"].append(p)
            rows[-1]["cy"] = np.mean([(q["box"][1] + q["box"][3]) / 2 for q in rows[-1]["items"]])
        else:
            rows.append({"cy": cy, "h": h, "items": [p]})
    return [q for r in rows for q in sorted(r["items"], key=lambda p: p["box"][0])]


def bbox(a, thr=20):
    ys, xs = np.where(a[..., 3] > thr)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def unsparkle(rgba, box, sheet_w, sheet_h):
    """The generator's corner sparkle (a pale 4-point star at a fixed spot) can sit on a part;
    repaint those pixels from the nearest pixels outside the star."""
    from scipy import ndimage as nd
    cx, cy = sheet_w * .930, sheet_h * .879          # about (1280, 675) on a 1376x768 sheet
    rx, ry = sheet_w * .021, sheet_h * .033
    h, w = rgba.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    dx, dy = np.abs((xs + box[0] - cx) / rx), np.abs((ys + box[1] - cy) / ry)
    star = (dx ** (2 / 3) + dy ** (2 / 3) <= 1.15) & (rgba[..., 3] > 40)
    if star.sum() < 20:
        return rgba
    star = nd.binary_dilation(star, iterations=2) & (rgba[..., 3] > 40)
    valid = (rgba[..., 3] > 40) & ~star
    _, (iy, ix) = nd.distance_transform_edt(~valid, return_indices=True)
    out = rgba.copy()
    out[star] = out[iy[star], ix[star]]
    return out


def fit(img, default_file, anchor="top", scale=None):
    """Scale the part to the default part's visible size and place it on the default canvas."""
    d = np.asarray(Image.open(AV / default_file).convert("RGBA"))
    dx0, dy0, dx1, dy1 = bbox(d)
    x0, y0, x1, y1 = bbox(img)
    crop = img[y0:y1, x0:x1]
    s = scale or ((dx1 - dx0) / crop.shape[1] + (dy1 - dy0) / crop.shape[0]) / 2
    w, h = max(1, round(crop.shape[1] * s)), max(1, round(crop.shape[0] * s))
    im = Image.fromarray(crop).resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (d.shape[1], d.shape[0]), (0, 0, 0, 0))
    px = round((dx0 + dx1) / 2 - w / 2)
    py = dy0 if anchor == "top" else dy1 - h
    canvas.alpha_composite(im, (max(0, px), max(0, py))) if px >= 0 and py >= 0 else canvas.paste(im, (px, py), im)
    return canvas, s


def save(canvas, rel):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(p, "WEBP", quality=92, method=6)
    return f"assets/art/avatar/variants/{rel}?v={VER}"


def cut(sku, h, kind, min_area):
    sheet = key(sheet_path(h))
    ps = order(parts(sheet, min_area=min_area))
    for p in ps:
        p["img"] = unsparkle(p["img"], p["box"], sheet.shape[1], sheet.shape[0])
    if kind == "hair":
        spec = HAIR; want = 6
    elif kind == "outfit":
        # 3 rows: front 4 (+extra puffs ignored), side 5 (torso, skirt, 3 arms), back 4
        want = None
        front, side, back = ps[0:4], ps[4:9], ps[9:13]
        ps = front + side + back; spec = OUTFIT; want = 13
        assert len(order_all := ps) >= 13
    elif kind == "shoes6":
        spec = SHOES6; want = 6
    else:  # shoes5: front L, front R, back (single, mirrored for the other), side near, side far
        spec = SHOES6; want = 5
        mirrored = Image.fromarray(ps[2]["img"]).transpose(Image.FLIP_LEFT_RIGHT)
        ps = [ps[0], ps[1], ps[2], dict(img=np.asarray(mirrored)), ps[3], ps[4]]
    if kind != "outfit":
        assert len(ps) == len(spec), f"{sku}: expected {len(spec)} parts, got {len(ps)}"
    out = {"front": {}, "side": {}, "back": {}}
    common = None
    if kind == "hair":
        # one scale for the whole set (taken from the front head) keeps short hair short
        _, common = fit(ps[0]["img"], spec[0][2])
    for p, (view, part, default) in zip(ps, spec):
        canvas, s = fit(p["img"], default, "bottom" if default.startswith("boots/") else "top", common)
        out[view][part] = save(canvas, f"{sku}/{view}_{part}.webp")
    return out


def cut_expressions(sku, h):
    ps = order(parts(key(sheet_path(h)), min_area=20000))
    assert len(ps) == 6, f"{sku}: expected 6 faces, got {len(ps)}"
    # one transform for the whole set (taken from neutral) so faces never jump between frames
    d = np.asarray(Image.open(AV / "expressions/head_neutral.webp").convert("RGBA"))
    dx0, dy0, dx1, dy1 = bbox(d)
    x0, y0, x1, y1 = bbox(ps[0]["img"])
    s = ((dx1 - dx0) / (x1 - x0) + (dy1 - dy0) / (y1 - y0)) / 2
    px, py = round((dx0 + dx1) / 2 - (x1 - x0) * s / 2), dy0
    files = {}
    for name, p in zip(EXPR, ps):
        a = p["img"]
        im = Image.fromarray(a[y0:y1, x0:x1] if a.shape[1] >= x1 and a.shape[0] >= y1 else a)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        canvas = Image.new("RGBA", (d.shape[1], d.shape[0]), (0, 0, 0, 0))
        canvas.alpha_composite(im, (max(0, px), max(0, py)))
        files[name] = save(canvas, f"{sku}/face_{name}.webp")
    return files


HATS = {"hat-straw": "793ff531", "hat-flower": "41c5018c", "hat-star": "5575119d"}


def cut_hat(sku, h):
    """front, side, back (worn) and, when the hat has one, the rear half of the brim."""
    ps = parts(key(sheet_path(h)), min_area=8000)
    assert len(ps) in (3, 4), f"{sku}: expected 3-4 hat pieces, got {len(ps)}"
    out = {}
    for name, p in zip(("front", "side", "back", "rear"), ps):
        a = np.asarray(p["img"])[...]
        x0, y0, x1, y1 = bbox(a)
        im = Image.fromarray(a[y0:y1, x0:x1])
        if im.width > 480:
            im = im.resize((480, max(1, round(im.height * 480 / im.width))), Image.LANCZOS)
        out[name] = {"src": save(im, f"hats/{sku}/{name}.webp"), "w": im.width, "h": im.height}
    return out


data = {}
hats = {sku: cut_hat(sku, h) for sku, h in HATS.items()}
for sku, (h, kind, min_area) in SHEETS.items():
    data[sku] = cut(sku, h, kind, min_area)
for sku, h in EXPRESSIONS.items():
    data[sku]["expressions"] = cut_expressions(sku, h)
(ROOT / "garden/avatar-variants-data.mjs").write_text(
    "// Generated by tools/pack5.py from the prompt-pack-3 sheets. Do not edit by hand.\n"
    "export const VARIANT_DATA = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n"
    "export const HAT_DATA = " + json.dumps(hats, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
print({k: sum(len(v) for v in d.values() if isinstance(v, dict)) for k, d in data.items()})
