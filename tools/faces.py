"""Align expression heads to one base head and keep the base hair on every expression.

Each expression is registered to the base (scale from the face-width, then a translation
search on edge maps), and only a feathered eye-and-mouth window is taken from it. The
result: identical hair and ornaments across all expressions, so blinking never jitters.
"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd


def edges(rgba):
    g = rgba[..., :3].astype(np.float32).mean(-1) * (rgba[..., 3] / 255.0)
    return np.hypot(nd.sobel(g, 0), nd.sobel(g, 1))


def fit_to(base, img):
    """Resize img to base's alpha-bbox width, then find the best (dx, dy)."""
    def bbox(a):
        ys, xs = np.where(a[..., 3] > 128)
        return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    bx0, by0, bx1, by1 = bbox(base)
    ix0, iy0, ix1, iy1 = bbox(img)
    s = (bx1 - bx0) / (ix1 - ix0)
    im = Image.fromarray(img).resize((round(img.shape[1] * s), round(img.shape[0] * s)), Image.LANCZOS)
    im = np.asarray(im)
    H, W = base.shape[:2]
    canvas = np.zeros_like(base)
    eb = edges(base)
    best = None
    # initial placement: align bbox tops/lefts, then search +-12 px
    ix0, iy0, _, _ = bbox(im)
    ox, oy = bx0 - ix0, by0 - iy0
    ei_full = edges(im)
    for dy in range(-12, 13, 2):
        for dx in range(-12, 13, 2):
            c = place(np.zeros((H, W), np.float32), ei_full, ox + dx, oy + dy)
            score = (c * eb).sum()
            if best is None or score > best[0]:
                best = (score, dx, dy)
    _, dx, dy = best
    for ddy in (-1, 0, 1):
        for ddx in (-1, 0, 1):
            c = place(np.zeros((H, W), np.float32), ei_full, ox + dx + ddx, oy + dy + ddy)
            score = (c * eb).sum()
            if score > best[0]:
                best = (score, dx + ddx, dy + ddy)
    _, dx, dy = best
    return place(canvas, im, ox + dx, oy + dy), s, (ox + dx, oy + dy)


def place(canvas, img, x, y):
    H, W = canvas.shape[:2]
    h, w = img.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return canvas
    canvas[y0:y1, x0:x1] = img[y0 - y:y1 - y, x0 - x:x1 - x]
    return canvas


def face_window(base):
    ys, xs = np.where(base[..., 3] > 128)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    H, W = base.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx = (x0 + x1) / 2
    w = x1 - x0; h = y1 - y0
    # eyes ~52-68% height, mouth ~80-88%; window spans the face between the side hair
    cy = y0 + h * 0.70
    rx, ry = w * 0.27, h * 0.25
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    m = np.clip((1.25 - d) / 0.5, 0, 1)
    return m


def composite(base, expr, mask):
    a = mask[..., None]
    out = base.astype(np.float32).copy()
    e = expr.astype(np.float32)
    # only blend where both have opaque pixels (never extend the silhouette)
    both = (base[..., 3:4] > 200) & (expr[..., 3:4] > 200)
    out[..., :3] = np.where(both, e[..., :3] * a + out[..., :3] * (1 - a), out[..., :3])
    return out.astype(np.uint8)


def diff_mask(base, expr, window, thr=26):
    """Take the expression only where it really differs from the base (eyes, mouth, blush)."""
    b = base[..., :3].astype(np.float32); e = expr[..., :3].astype(np.float32)
    d = np.abs(b - e).mean(-1)
    d = nd.gaussian_filter(d, 1.2)
    m = (d > thr) & (window > 0.05)
    m = nd.binary_opening(m, iterations=1)
    lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, np.where(sizes > 60)[0] + 1)
    m = nd.binary_closing(m, iterations=4)
    m = nd.binary_dilation(m, iterations=5)
    m = nd.gaussian_filter(m.astype(np.float32), 3.0)
    return np.clip(m * 1.4, 0, 1) * np.clip(window * 1.5, 0, 1)
