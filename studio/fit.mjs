// Turns a picture the person picked into a drop-in replacement for an existing game picture.
import { fitModeFor } from "../garden/asset-catalog.mjs";

export const loadImageFile = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
  im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("그림을 읽지 못했어요")); };
  im.src = url;
});
/** The original picture, straight from the game files (never a swapped one). */
export const loadOriginal = (path) => new Promise((resolve) => {
  const im = new Image();
  im.onload = () => resolve(im);
  im.onerror = () => resolve(null);
  im.src = "./" + path + "?original=1";
});

function visibleBox(im, threshold = 20) {
  const c = document.createElement("canvas");
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > threshold) {
    if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const toBlob = (canvas, path) => new Promise((resolve) => {
  const type = /\.png$/i.test(path) ? "image/png" : /\.jpe?g$/i.test(path) ? "image/jpeg" : "image/webp";
  canvas.toBlob((b) => resolve(b), type, 0.93);
});

/**
 * Fit `picture` onto the canvas of the game picture at `path`:
 *  bbox    - rig parts: match the visible shape of the original, so joints still line up
 *  stretch - textures: the same size exactly
 *  contain - everything else: as large as fits, standing on the bottom edge
 */
export async function fitReplacement(picture, path, { auto = true, like = path } = {}) {
  const original = await loadOriginal(like);
  const w = original?.naturalWidth || picture.naturalWidth, h = original?.naturalHeight || picture.naturalHeight;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const mode = auto ? fitModeFor(like) : "stretch";
  const sameShape = Math.abs(picture.naturalWidth / picture.naturalHeight - w / h) < 0.02;
  if (!auto || mode === "stretch" || sameShape) {
    ctx.drawImage(picture, 0, 0, w, h);
  } else if (mode === "bbox" && original) {
    const o = visibleBox(original), v = visibleBox(picture);
    const s = (o.w / v.w + o.h / v.h) / 2;
    const dw = v.w * s, dh = v.h * s;
    const bottom = /\/boots\/|_shin|\/shin/i.test(like);
    ctx.drawImage(picture, v.x, v.y, v.w, v.h, o.x + o.w / 2 - dw / 2, bottom ? o.y + o.h - dh : o.y, dw, dh);
  } else {
    const s = Math.min(w / picture.naturalWidth, h / picture.naturalHeight);
    const dw = picture.naturalWidth * s, dh = picture.naturalHeight * s;
    ctx.drawImage(picture, (w - dw) / 2, h - dh, dw, dh);
  }
  return toBlob(out, path);
}
