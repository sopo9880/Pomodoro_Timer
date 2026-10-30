"""Adaptive magenta-background keyer for AI part sheets.

Background = pixels whose hue is in the magenta band and that connect to the image border
(so pink details inside a part are never removed). Edge colors are un-mixed against the
*local* background color, so sheets with tinted or gradient backgrounds key cleanly.
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd


def hsv(rgb):
    r, g, b = [rgb[..., i] for i in range(3)]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = d / (mx + 1e-6)
    return h, s, mx


def key(path, wm=True):
    C = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    H, W, _ = C.shape
    h, s, v = hsv(C / 255.0)
    # strong magenta: hue 285-335, saturated, and both R and B well above G
    mag = np.minimum(C[..., 0], C[..., 2]) - C[..., 1]
    strong = (h > 280) & (h < 340) & (s > 0.45) & (mag > 90)
    # weak background (tinted / gradient patches): magenta-ish hue, any saturation over 0.18
    weak = (h > 285) & (h < 345) & (s > 0.18) & (mag > 18)
    # background region = weak pixels connected to strong pixels that touch the border
    lab, n = nd.label(strong | weak)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    bg = np.isin(lab, border)
    # also: tiny enclosed holes of strong magenta (between arm and body etc.)
    # enclosed pockets (between hair strands and ribbons, under arms): magenta-hued
    # regions not touching the border, kept only if they are clearly background-colored
    pocket_seed = strong & ~bg
    lab2, n2 = nd.label(pocket_seed)
    if n2:
        ids = np.arange(1, n2 + 1)
        sizes = nd.sum(np.ones_like(lab2), lab2, ids)
        seed = np.isin(lab2, ids[sizes > 12])
        # grow only into clearly magenta neighbours, never into outlines
        grow = weak & (mag > 55)
        pk = seed
        for _ in range(3):
            pk = pk | (nd.binary_dilation(pk) & grow)
        bg |= pk
    # local background color field: nearest background pixel's color, smoothed
    _, (iy, ix) = nd.distance_transform_edt(~bg, return_indices=True)
    B = C[iy, ix]
    B = np.stack([nd.uniform_filter(B[..., i], 9) for i in range(3)], -1)
    # alpha: distance from local bg along the bg->pixel chroma direction
    fg_core = nd.binary_erosion(~bg, iterations=3)
    _, (fy, fx) = nd.distance_transform_edt(~fg_core, return_indices=True)
    F0 = C[fy, fx]  # nearest solid foreground color
    num = ((C - B) * (F0 - B)).sum(-1)
    den = ((F0 - B) ** 2).sum(-1) + 1e-3
    a = np.clip(num / den, 0, 1)
    a = np.where(fg_core, 1.0, a)
    a = np.where(bg & ~nd.binary_dilation(~bg, iterations=2), 0.0, a)
    # un-mix: F = (C - (1-a) B) / a
    F = (C - (1 - a)[..., None] * B) / np.maximum(a, 0.05)[..., None]
    F = np.clip(F, 0, 255)
    F = np.where((a < 0.999)[..., None], 0.6 * F + 0.4 * F0, F)
    out = np.dstack([F, a * 255]).astype(np.uint8)
    if wm:  # Gemini sparkle: any small blob in the bottom-right corner
        A = out[..., 3] > 40
        lab3, n3 = nd.label(A)
        for i, sl in enumerate(nd.find_objects(lab3), 1):
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            if x0 > W * 0.86 and y0 > H * 0.80 and (y1 - y0) < H * 0.12:
                out[..., 3][lab3 == i] = 0
    return out


def parts(rgba, min_area=900, merge=4):
    A = rgba[..., 3] > 110
    A = nd.binary_opening(A, iterations=1)
    lab, n = nd.label(nd.binary_closing(A, iterations=merge))
    res = []
    for i, sl in enumerate(nd.find_objects(lab), 1):
        m = lab[sl] == i
        if m.sum() < min_area:
            continue
        res.append((sl, i))
    # assign soft edges to nearest label
    d, (iy, ix) = nd.distance_transform_edt(lab == 0, return_indices=True)
    full = lab[iy, ix]
    full[(rgba[..., 3] < 8) | (d > 5)] = 0
    out = []
    for sl, i in res:
        m = full == i
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        p = 3
        Y0, X0 = max(0, y0 - p), max(0, x0 - p)
        Y1, X1 = min(rgba.shape[0], y1 + p), min(rgba.shape[1], x1 + p)
        crop = rgba[Y0:Y1, X0:X1].copy()
        crop[..., 3] = np.where(m[Y0:Y1, X0:X1], crop[..., 3], 0)
        out.append(dict(box=[int(X0), int(Y0), int(X1), int(Y1)], img=crop))
    out.sort(key=lambda o: (o["box"][1] // 120, o["box"][0]))
    return out
