"""Measure every avatar part and emit the cutout-rig layout (garden/avatar-rig-data.mjs).

Each part gets: file, size, pivot (rotation centre inside the image) and, for the parts that
drive other parts, named sockets measured from the alpha mask. The JS rig composes them.
All numbers are in part-image pixels (1K sheet scale).
"""
import json, os
import numpy as np
from PIL import Image

ART = "/home/claude/out/assets/art/avatar"


def mask(path):
    return np.asarray(Image.open(path))[..., 3] > 128


def bbox(a):
    ys, xs = np.where(a)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def row_span(a, frac):
    H = a.shape[0]
    y = min(H - 1, max(0, int(H * frac)))
    xs = np.where(a[y])[0]
    return (int(xs.min()), int(xs.max()) + 1, y) if len(xs) else None


def top_center(a, inset=0.06):
    x0, y0, x1, y1 = bbox(a)
    y = y0 + int((y1 - y0) * inset)
    xs = np.where(a[y])[0]
    return [float((xs.min() + xs.max()) / 2), float(y)]


def bottom_center(a, inset=0.04):
    x0, y0, x1, y1 = bbox(a)
    y = y1 - 1 - int((y1 - y0) * inset)
    xs = np.where(a[y])[0]
    return [float((xs.min() + xs.max()) / 2), float(y)]


def part(view, name, kind="limb", **extra):
    path = f"{ART}/{view}/{name}.webp"
    if not os.path.exists(path):
        path = f"{ART}/{extra.pop('dir')}/{name}.webp" if "dir" in extra else path
    a = mask(path)
    H, W = a.shape
    d = {"src": os.path.relpath(path, "/home/claude/out"), "w": W, "h": H}
    if kind == "limb":
        d["pivot"] = top_center(a)
        d["end"] = bottom_center(a)
    elif kind == "top":
        d["pivot"] = top_center(a, 0.02)
    elif kind == "head":
        d["pivot"] = bottom_center(a, 0.0)
        x0, y0, x1, y1 = bbox(a)
        d["crown"] = [float((x0 + x1) / 2), float(y0)]
    elif kind == "torso":
        x0, y0, x1, y1 = bbox(a)
        sh = row_span(a, (y0 + (y1 - y0) * 0.10) / H)
        hp = row_span(a, (y0 + (y1 - y0) * 0.92) / H)
        d["pivot"] = [float((hp[0] + hp[1]) / 2), float(hp[2])]
        d["neck"] = [float((x0 + x1) / 2), float(y0 + (y1 - y0) * 0.03)]
        d["shoulderL"] = [float(sh[0] + (sh[1] - sh[0]) * 0.08), float(sh[2])]
        d["shoulderR"] = [float(sh[1] - (sh[1] - sh[0]) * 0.08), float(sh[2])]
        d["waist"] = [float((hp[0] + hp[1]) / 2), float(y0 + (y1 - y0) * 0.80)]
        d["hipL"] = [float(hp[0] + (hp[1] - hp[0]) * 0.30), float(hp[2])]
        d["hipR"] = [float(hp[1] - (hp[1] - hp[0]) * 0.30), float(hp[2])]
    d.update(extra)
    return d


def build():
    rig = {}
    # FRONT ------------------------------------------------------------
    f = {
        "cape": part("front", "cape", "top"),
        "hair": part("front", "hair_back", "top"),
        "neck": part("front", "neck", "limb"),
        "torso": part("front", "torso", "torso"),
        "skirt": part("front", "skirt", "top"),
        "capelet": part("front", "capelet", "top"),
        "head": part("front", "head", "head"),
        "bag": part("front", "bag", "top"),
        "sleeveL": part("front", "sleeve_left"), "sleeveR": part("front", "sleeve_right"),
        "forearmL": part("front", "forearm_left"), "forearmR": part("front", "forearm_right"),
        "thighL": part("front", "thigh_left"), "thighR": part("front", "thigh_right"),
        "shinL": part("boots", "front_left", scale=0.77), "shinR": part("boots", "front_right", scale=0.77),
    }
    rig["front"] = f
    # SIDE (faces right) -------------------------------------------------
    s = {
        "cape": part("side", "cape", "top"),
        "hair": part("side", "hair_back", "top"),
        "neck": part("side", "neck", "limb"),
        "torso": part("side", "torso", "torso"),
        "skirt": part("side", "skirt", "top"),
        "capelet": part("side", "capelet", "top"),
        "head": part("side", "head", "head"),
        "headBlink": part("side", "head_blink", "head"),
        "bag": part("side", "bag", "top"),
        "armNear": part("side", "arm_near"), "armFar": part("side", "arm_far"),
        "thighNear": part("side", "thigh_near"), "thighFar": part("side", "thigh_far"),
        "shinNear": part("boots", "side_near", scale=0.79), "shinFar": part("boots", "side_far", scale=0.79),
    }
    rig["side"] = s
    # BACK ---------------------------------------------------------------
    b = {
        "head": part("back", "head", "head"),
        "neck": part("back", "neck", "limb"),
        "torso": part("back", "torso", "torso"),
        "skirt": part("back", "skirt", "top"),
        "cape": part("back", "cape", "top"),
        "capelet": part("back", "capelet", "top"),
        "bag": part("back", "bag", "top"),
        "sleeveL": part("back", "sleeve_left"), "sleeveR": part("back", "sleeve_right"),
        "forearmL": part("back", "forearm_left"), "forearmR": part("back", "forearm_right"),
        "thighL": part("back", "leg_left"), "thighR": part("back", "leg_right"),
        "shinL": part("boots", "back_left", scale=0.77), "shinR": part("boots", "back_right", scale=0.77),
    }
    rig["back"] = b
    # expressions share one canvas; scale them to the front head
    ex = {k: f"assets/art/avatar/expressions/head_{k}.webp"
          for k in ["neutral", "blink", "halfblink", "happy", "surprised", "focused"]}
    fh = mask(f"{ART}/front/head.webp"); en = mask(f"{ART}/expressions/head_neutral.webp")
    fb, eb = bbox(fh), bbox(en)
    sc = (fb[2] - fb[0]) / (eb[2] - eb[0])
    rig["expressions"] = {"files": ex, "scale": round(sc, 4),
                          "pivot": bottom_center(en, 0.0)}
    return rig


if __name__ == "__main__":
    rig = build()
    js = ("// Generated by tools/rig_layout.py from the part images. Pixel units of the part images.\n"
          "export const AVATAR_RIG_PARTS = Object.freeze(" + json.dumps(rig, indent=1) + ");\n")
    open("/home/claude/out/avatar-rig-data.mjs", "w").write(js)
    print(json.dumps({v: {k: [d['w'], d['h']] for k, d in rig[v].items()} for v in ["front", "side", "back"]}))
    print("expr scale", rig["expressions"]["scale"])
