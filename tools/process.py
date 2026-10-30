"""Bloomodoro asset pipeline: picked AI sheets -> game-ready transparent WebP assets.

Run: python3 -I process.py   (from /home/claude/incoming)
Outputs to /home/claude/out/assets/art and previews to /home/claude/out/preview.
"""
import os, sys, json, shutil, re
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
from scipy import ndimage as nd

sys.path.insert(0, "/home/claude/incoming")
from keyer import key
from faces import fit_to, face_window, composite, diff_mask

OUT = "/home/claude/out/assets/art"
PREV = "/home/claude/out/preview"
REF_W = 1376  # all outputs normalised to the 1K sheet scale

# ---------------------------------------------------------------- source lookup
SRC = {}
for l in open("/home/claude/batch3/all.tsv"):
    h, p, n = l.rstrip("\n").split("\t")
    SRC[h] = "/home/claude/batch3/" + p
for l in open("/home/claude/batch2/k_index.txt"):
    k, n = l.split(" ", 1)
    m = re.search(r"_([0-9a-f]{8})_2K", n)
    if m:
        SRC[m.group(1)] = f"/home/claude/batch2/k/{k}.jpg"
SRC["sneaker_fix"] = "/mnt/user-data/attachments/c5650b89-21f0-5501-ad1b-31f1a43e429b/074c2d7f-image.png"

manifest = {"version": 2, "scale": "1K sheet scale (source sheets normalised to 1376 px wide)",
            "anchor": "frames share one canvas per animation; anchor = bottom-centre (feet)",
            "items": {}}


def save(img, rel, q=90):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if isinstance(img, np.ndarray):
        img = Image.fromarray(img)
    img.save(path, "WEBP", quality=q, method=6)
    return rel


# ---------------------------------------------------------------- segmentation
def components(rgba, merge=3, min_frac=0.0006):
    H, W = rgba.shape[:2]
    s = W / REF_W
    A = rgba[..., 3] > 110
    A = nd.binary_opening(A, iterations=max(1, round(s)))
    lab, n = nd.label(nd.binary_closing(A, iterations=max(1, round(merge * s))))
    d, (iy, ix) = nd.distance_transform_edt(lab == 0, return_indices=True)
    full = lab[iy, ix]
    full[(rgba[..., 3] < 8) | (d > 5 * s)] = 0
    comps = []
    for i, sl in enumerate(nd.find_objects(full), 1):
        if sl is None:
            continue
        m = full[sl] == i
        area = int(m.sum())
        if area < min_frac * H * W:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        crop = rgba[sl].copy()
        crop[..., 3] = np.where(m, crop[..., 3], 0)
        # drop translucent ghosts (contamination copied faintly from the reference)
        a = crop[..., 3][m]
        if (a > 200).mean() < 0.45:
            continue
        comps.append(dict(box=(x0, y0, x1, y1), area=area, img=crop,
                          cx=(x0 + x1) / 2, cy=(y0 + y1) / 2))
    if FILTER_CONTAM:
        comps = [c for c in comps if not is_contam(c["img"])]
    return comps


FILTER_CONTAM = False


# ---------------------------------------------------------------- contamination filter
# AI sheets sometimes paste avatar parts from the attached reference (skirt, capelet, bag,
# arms, boots). Recognise them by template similarity against the avatar's own parts.
_REFS = None


def _sig(img):
    im = Image.fromarray(img) if isinstance(img, np.ndarray) else img
    w, h = im.size
    s = max(w, h)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0)); sq.alpha_composite(im.convert("RGBA"), ((s - w) // 2, (s - h) // 2))
    a = np.asarray(sq.resize((24, 24), Image.BILINEAR)).astype(np.float32) / 255
    v = np.concatenate([(a[..., :3] * a[..., 3:4]).ravel(), a[..., 3].ravel() * 0.6])
    v -= v.mean()
    return v / (np.linalg.norm(v) + 1e-6), h / max(1, w)


def _refs():
    global _REFS
    if _REFS is None:
        import glob
        files = glob.glob("/home/claude/rig/part_*.png") + glob.glob("/home/claude/incoming/Bloomodoro_avatar_assets/*/*.png")
        _REFS = []
        for f in files:
            im = Image.open(f).convert("RGBA")
            _REFS.append(_sig(im))
            _REFS.append(_sig(im.transpose(Image.FLIP_LEFT_RIGHT)))
    return _REFS


_SIFT = None


def _ref_feats():
    """SIFT features of the reference sheets the AI copies from (avatar REF sheets)."""
    global _SIFT
    if _SIFT is None:
        import cv2
        sift = cv2.SIFT_create(nfeatures=6000)
        feats = []
        for h in ["36c5a32d", "1569ca5d"]:
            path = SRC.get(h) or "/mnt/user-data/uploads/Create_character_animation_parts__36c5a32d_2K.jpg"
            g = cv2.cvtColor(np.asarray(Image.open(path).convert("RGB")), cv2.COLOR_RGB2GRAY)
            g = cv2.resize(g, (1376, int(g.shape[0] * 1376 / g.shape[1])))
            kp, des = sift.detectAndCompute(g, None)
            feats.append((kp, des))
        _SIFT = (sift, feats, cv2)
    return _SIFT


def contam_score(img):
    sift, feats, cv2 = _ref_feats()
    rgb = img[..., :3].copy(); rgb[img[..., 3] < 128] = 255
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    s = 300 / max(g.shape)
    if s < 1: g = cv2.resize(g, (max(8, int(g.shape[1] * s)), max(8, int(g.shape[0] * s))))
    kp, des = sift.detectAndCompute(g, (img[..., 3] >= 128).astype(np.uint8) * 255 if s >= 1 else None)
    if des is None or len(kp) < 6:
        return 0
    best = 0
    bf = cv2.BFMatcher()
    for rkp, rdes in feats:
        m = bf.knnMatch(des, rdes, k=2)
        good = [a for a, b2 in (x for x in m if len(x) == 2) if a.distance < 0.72 * b2.distance]
        if len(good) >= 6:
            src = np.float32([kp[a.queryIdx].pt for a in good]); dst = np.float32([rkp[a.trainIdx].pt for a in good])
            H, inl = cv2.estimateAffinePartial2D(src, dst, ransacReprojThreshold=4)
            n = int(inl.sum()) if inl is not None else 0
            best = max(best, n / max(len(kp), 1))
    return best


def is_contam(img, thr=0.12):
    return contam_score(img) > thr


def rows_of(comps, tol=0.35):
    """Cluster components into rows by vertical overlap, each row sorted left->right."""
    comps = sorted(comps, key=lambda c: c["cy"])
    rows = []
    for c in comps:
        h = c["box"][3] - c["box"][1]
        for r in rows:
            ry0 = min(x["box"][1] for x in r); ry1 = max(x["box"][3] for x in r)
            ov = min(ry1, c["box"][3]) - max(ry0, c["box"][1])
            if ov > tol * min(h, ry1 - ry0):
                r.append(c); break
        else:
            rows.append([c])
    for r in rows:
        r.sort(key=lambda c: c["cx"])
    rows.sort(key=lambda r: np.mean([c["cy"] for c in r]))
    return rows


def norm(img, W):
    """Rescale a crop from a sheet of width W to the 1K sheet scale."""
    s = REF_W / W
    if abs(s - 1) < 1e-3:
        return Image.fromarray(img) if isinstance(img, np.ndarray) else img
    im = Image.fromarray(img) if isinstance(img, np.ndarray) else img
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def frames_canvas(imgs, pad=4):
    """Put frames on one shared canvas, bottom-centre aligned on their alpha bbox."""
    boxes = [np.asarray(i)[..., 3] > 20 for i in imgs]
    bb = []
    for b in boxes:
        ys, xs = np.where(b)
        bb.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    Wc = max(b[2] - b[0] for b in bb) + 2 * pad
    Hc = max(b[3] - b[1] for b in bb) + 2 * pad
    out = []
    for im, b in zip(imgs, bb):
        c = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0))
        w = b[2] - b[0]
        c.alpha_composite(im.crop(b), ((Wc - w) // 2, Hc - pad - (b[3] - b[1])))
        out.append(c)
    return out


def strip(frames):
    W, H = frames[0].size
    s = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.alpha_composite(f, (i * W, 0))
    return s


def cap(im, max_h=None, max_w=None):
    s = 1.0
    if max_h and im.height > max_h: s = min(s, max_h / im.height)
    if max_w and im.width > max_w: s = min(s, max_w / im.width)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im


def keyed(h):
    path = SRC[h]
    rgba = key(path)
    return rgba, rgba.shape[1]


def preview_parts(title, items, out, cell=170, cols=8):
    rows = (len(items) + cols - 1) // cols
    c = Image.new("RGB", (cols * cell, rows * (cell + 18) + 26), (30, 42, 33))
    d = ImageDraw.Draw(c); d.text((8, 6), title, fill=(240, 236, 210))
    for i, (name, im) in enumerate(items):
        im = im.copy(); im.thumbnail((cell - 12, cell - 12))
        x, y = (i % cols) * cell, 26 + (i // cols) * (cell + 18)
        bg = Image.new("RGBA", im.size, (30, 42, 33, 255)); bg.alpha_composite(im)
        c.paste(bg.convert("RGB"), (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        d.text((x + 4, y + cell + 2), name[:24], fill=(200, 210, 180))
    os.makedirs(PREV, exist_ok=True)
    c.save(os.path.join(PREV, out))


# ================================================================= AVATAR
def avatar():
    item = {}
    specs = {
        "front": ("1569ca5d", {0: "head", 1: "hair_back", 2: "neck", 3: "bag", 4: "cape", 5: "torso", 6: "skirt",
                               7: "capelet", 8: "sleeve_left", 9: "upperarm_left", 10: "upperarm_right",
                               11: "sleeve_right", 12: "thigh_left", 13: "shin_left", 14: "thigh_right",
                               15: "shin_right", 16: "hand_open_left", 17: "hand_open_right",
                               18: "forearm_left", 19: "forearm_right"}),
        "side": ("2c038de8", {0: "head", 1: "head_blink", 2: "hair_back", 3: "neck", 4: "capelet", 5: "cape",
                              6: "torso", 7: "torso_alt", 8: "skirt", 9: "arm_near", 10: "arm_near_bare",
                              11: "arm_far_bare", 12: "arm_far", 13: "thigh_near", 14: "shin_near",
                              15: "thigh_far", 16: "shin_far", 17: "bag"}),
        "back": ("6d927e5f", {0: "head", 1: "neck", 2: "torso", 3: "skirt", 4: "cape", 5: "capelet", 6: "bag",
                              7: "sleeve_left", 8: "sleeve_right", 9: "forearm_left", 10: "forearm_right",
                              11: "leg_left", 12: "leg_right", 13: "boot_left", 14: "boot_right"}),
    }
    for view, (h, names) in specs.items():
        rgba, W = keyed(h)
        comps = components(rgba, merge=1 if view != "side" else 3)
        # order exactly like the earlier 1K pass: row bands of 120px (1K scale), then x
        s = W / REF_W
        comps.sort(key=lambda c: (int(c["box"][1] / s) // 120, c["box"][0]))
        prev = []
        if len(comps) != len(names):
            print(f"  ! avatar {view}: {len(comps)} comps vs {len(names)} names")
        files = {}
        for i, c in enumerate(comps):
            nm = names.get(i, f"part_{i:02d}")
            im = norm(c["img"], W)
            if view == "side" and nm == "shin_far":
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            files[nm] = {"file": save(im, f"avatar/{view}/{nm}.webp"), "size": list(im.size),
                         "sheet_box_1k": [round(v / s) for v in c["box"]]}
            prev.append((nm, im))
        item[view] = files
        preview_parts(f"avatar {view}", prev, f"avatar_{view}.png")

    # expressions: base neutral head with face windows from each expression
    def heads(h):
        rgba, W = keyed(h)
        c = rgba[..., :3].astype(int)
        green = (c[..., 1] > c[..., 0] + 12) & (c[..., 1] > c[..., 2] - 5)  # stray capelet pieces
        rgba = rgba.copy(); rgba[..., 3][green] = 0
        comps = sorted(components(rgba, merge=1), key=lambda c: -c["area"])[:6]
        H = rgba.shape[0]
        comps.sort(key=lambda c: (c["cy"] > H / 2, c["cx"]))
        return comps, W
    ex, W = heads("9877a556")
    ex2, W2 = heads("8fc1a3ca")
    def padn(img, W, p=40):
        im = np.asarray(norm(img, W)); h, w = im.shape[:2]
        c = np.zeros((h + 2 * p, w + 2 * p, 4), np.uint8); c[p:p + h, p:p + w] = im; return c
    base = padn(ex[0]["img"], W)
    srcs = {"neutral": None, "blink": ex[1]["img"], "halfblink": ex[2]["img"], "happy": ex[3]["img"],
            "surprised": ex[4]["img"], "focused": ex2[5]["img"]}
    win = face_window(base)
    faces = {}
    for k, img in srcs.items():
        if img is None:
            faces[k] = base; continue
        al, _, _ = fit_to(base, padn(img, W2 if k == "focused" else W))
        faces[k] = composite(base, al, diff_mask(base, al, win))
    ys, xs = np.where(base[..., 3] > 0)
    bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    item["expressions"] = {}
    prev = []
    for k, arr in faces.items():
        im = Image.fromarray(arr).crop(bb)
        item["expressions"][k] = save(im, f"avatar/expressions/head_{k}.webp")
        prev.append((k, im))
    preview_parts("expressions", prev, "avatar_expressions.png", cell=220, cols=6)

    # illustrations
    item["illustrations"] = {}
    for nm, h in [("portrait", "1a35b228"), ("focus_reading", "c30e2f91"), ("rest_stretch", "26553161")]:
        rgba, W = keyed(h)
        im = Image.fromarray(rgba)
        im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
        im = cap(im, max_h=1200)
        item["illustrations"][nm] = save(im, f"avatar/portraits/{nm}.webp", q=92)

    # base boots (front 2 + side 2 in row 1, back 4 in row 2; we use 2 of the back ones)
    rgba, W = keyed("40fb44a7")
    rws = rows_of(components(rgba))
    boots = {}
    r1, r2 = rws[0], rws[1]
    order = [("front_left", r1[0]), ("front_right", r1[1]), ("side_near", r1[2]), ("side_far", r1[3]),
             ("back_left", r2[0]), ("back_right", r2[1])]
    prev = []
    for nm, c in order:
        im = norm(c["img"], W)
        if nm.startswith("side") and toe_left(im):
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if nm == "side_far":
            im = ImageEnhance.Brightness(im).enhance(0.85)
        boots[nm] = save(im, f"avatar/boots/{nm}.webp"); prev.append((nm, im))
    item["boots"] = boots
    preview_parts("base boots", prev, "avatar_boots.png")
    manifest["items"]["avatar"] = item


def toe_left(im):
    """True if the foot (lowest 18% of the piece) sticks out further to the left than right."""
    a = np.asarray(im)[..., 3] > 60
    H = a.shape[0]
    top = a[: int(H * 0.5)]; low = a[int(H * 0.82):]
    xs_t = np.where(top.any(0))[0]; xs_l = np.where(low.any(0))[0]
    if len(xs_t) == 0 or len(xs_l) == 0:
        return False
    ct = (xs_t.min() + xs_t.max()) / 2
    return (ct - xs_l.min()) > (xs_l.max() - ct)


# ================================================================= WARDROBE
WARD = {"outfit-forest-coat": "bc523111", "outfit-flower-overalls": "7a0b9891",
        "outfit-starlight-cape": "57fb0a1f", "hair-chestnut-bob": "d0d9a847",
        "hat-flower-crown": "05ff8e73", "hat-straw": "6ae0b16a", "hat-star": "29d1c0d3",
        "shoes-forest-boots": "b92f5070", "shoes-sky-sneakers": "f3d32675"}


def wardrobe():
    item = {}
    for wid, h in WARD.items():
        rgba, W = keyed(h)
        rws = rows_of(components(rgba))
        files = []
        prev = []
        view_names = ["front", "side", "back"] if len(rws) == 3 else [f"row{i}" for i in range(len(rws))]
        for ri, r in enumerate(rws):
            vn = view_names[ri] if ri < len(view_names) else f"row{ri}"
            for ci, c in enumerate(r):
                im = norm(c["img"], W)
                nm = f"{vn}_{ci:02d}"
                if wid.startswith("shoes") and vn == "side" and toe_left(im):
                    im = im.transpose(Image.FLIP_LEFT_RIGHT)
                files.append({"name": nm, "file": save(im, f"avatar/equipment/{wid}/{nm}.webp"),
                              "size": list(im.size)})
                prev.append((nm, im))
        item[wid] = {"rows": len(rws), "parts": files}
        preview_parts(f"wardrobe {wid}", prev, f"wardrobe_{wid}.png")
    manifest["items"]["wardrobe"] = item


# ================================================================= COMPANIONS
COMP = {"sprout": ("e2c40511", "ef97a60d", "80cf1f6a"), "mushroom": ("c7f91042", "b71dda30", "6d536cb7"),
        "cat": ("c5e58a67", "49707a1d", "d37a9665"), "sparrow": ("f6453ffe", "f01b19f7", "7345904f"),
        "turtle": ("dc4d2418", "9e1159b5", "5a469fbd"), "fox": ("3f7ca665", "6ee1253f", "f253d79a")}
ACTION_NAMES = [["idle_0", "idle_1", "surprised"], ["picked_0", "picked_1", "happy_0", "happy_1"],
                ["signature_0", "signature_1", "signature_2"]]


# reference parts the AI pasted into a sheet: (sheet id, centre x, centre y) in 1K px
MANUAL_DROP = [("6d536cb7", 896, 96), ("9e1159b5", 348, 346), ("4144d5a8", 350, 305)]


def clean(h, comps, W):
    s = W / REF_W
    med = float(np.median([c["area"] for c in comps])) if comps else 0
    out = []
    for c in comps:
        if c["area"] < 0.25 * med:
            continue
        if any(hh == h and abs(c["cx"] / s - x) < 45 and abs(c["cy"] / s - y) < 45 for hh, x, y in MANUAL_DROP):
            continue
        out.append(c)
    return out


def companions():
    item = {}
    for cid, (ha, hb, hc) in COMP.items():
        rec = {}
        # A: turnaround -> front/back/side/three_quarter + portrait (largest)
        rgba, W = keyed(ha)
        flat = [c for r in rows_of(clean(ha, components(rgba), W)) for c in r]
        views = {}
        names = ["front", "back", "side", "three_quarter", "portrait"]
        prev = []
        for nm, c in zip(names, flat):
            im = norm(c["img"], W)
            if nm == "portrait": im = cap(im, max_h=512)
            views[nm] = save(im, f"companions/{cid}/{'portrait' if nm == 'portrait' else 'view_' + nm}.webp")
            prev.append((nm, im))
        rec["views"] = views
        # B: movement rows
        rgba, W = keyed(hb)
        rws = [r for r in rows_of(clean(hb, components(rgba), W)) if len(r) >= 3][:3]
        moves = {}
        for vn, r in zip(["front", "back", "side"], rws):
            fr = frames_canvas([norm(c["img"], W) for c in r[:4]])
            fr = [cap(f, max_h=260) for f in fr]
            moves[vn] = {"file": save(strip(fr), f"companions/{cid}/move_{vn}.webp"),
                         "frames": len(fr), "frameWidth": fr[0].width, "frameHeight": fr[0].height, "fps": 8}
            prev += [(f"move_{vn}_{i}", f) for i, f in enumerate(fr)]
        rec["move"] = moves
        # C: action rows
        rgba, W = keyed(hc)
        rws = rows_of(clean(hc, components(rgba), W))
        allc = [c for r in rws for c in r]
        imgs = frames_canvas([norm(c["img"], W) for c in allc])
        imgs = [cap(f, max_h=260) for f in imgs]
        acts = {}
        k = 0
        for ri, r in enumerate(rws):
            for ci, _ in enumerate(r):
                nm = ACTION_NAMES[ri][ci] if ri < 3 and ci < len(ACTION_NAMES[ri]) else f"extra_{ri}_{ci}"
                acts[nm] = save(imgs[k], f"companions/{cid}/act_{nm}.webp"); prev.append((nm, imgs[k])); k += 1
        rec["actions"] = acts
        rec["actionLayout"] = [len(r) for r in rws]
        item[cid] = rec
        preview_parts(f"companion {cid}", prev, f"companion_{cid}.png", cell=150, cols=10)
    manifest["items"]["companions"] = item


# ================================================================= WILDLIFE
# keys are the game's ecology species ids
WILD = {"butterfly": "4813cd73", "robin": "bed8c3d4", "honeybee": "446ccb81", "ladybug": "26b9d3cd",
        "dragonfly": "b219ce32", "frog": "1532d86b", "carp": "fc4fa088", "firefly": "d037b3c8",
        "owl": "0d1263b9", "squirrel": "2d82ee60", "fieldmouse": "7e55d1bd", "wren": "aeb15a78",
        "lunamoth": "e9ec53db", "glowbug": "b0de1456"}


def wildlife():
    item = {}
    prev = []
    for wid, h in WILD.items():
        rgba, W = keyed(h)
        comps = components(rgba)
        H = rgba.shape[0]
        codex = max(comps, key=lambda c: c["area"])
        top = [c for c in comps if c is not codex and c["cy"] < H * 0.42]
        top.sort(key=lambda c: -c["area"]); top = sorted(top[:4], key=lambda c: c["cx"])
        if len(top) < 4:
            print(f"  ! wildlife {wid}: {len(top)} frames")
        fr = frames_canvas([norm(c["img"], W) for c in top])
        fr = [cap(f, max_h=200) for f in fr]
        cd = cap(norm(codex["img"], W), max_h=420)
        item[wid] = {"frames": save(strip(fr), f"wildlife/{wid}/frames.webp"), "count": len(fr),
                     "frameWidth": fr[0].width, "frameHeight": fr[0].height, "fps": 6,
                     "codex": save(cd, f"wildlife/{wid}/codex.webp")}
        prev += [(f"{wid}_{i}", f) for i, f in enumerate(fr)] + [(f"{wid}_codex", cd)]
    preview_parts("wildlife", prev, "wildlife.png", cell=130, cols=10)
    manifest["items"]["wildlife"] = item


# ================================================================= PLANTS
PLANTS = {"daisy": "e38e805b", "rose": "417274b4", "tulip": "db7640da", "clover": "54527057",
          "lavender": "777cc175", "hydrangea": "b40735a8", "sunflower": "4144d5a8", "lotus": "7f361665",
          "starflower": "33166a8a"}
STAGE = ["seed", "sprout", "growing", "bloom", "bloom_sway"]


def is_plant(c):
    """Every stage sits on a soil mound or water basin: the bottom band must be earthy/stone."""
    im = c["img"].astype(np.float32); a = im[..., 3] > 128
    H = a.shape[0]
    band = im[int(H * 0.8):][a[int(H * 0.8):]]
    if len(band) < 50:
        return False
    r, g, b = band[:, 0], band[:, 1], band[:, 2]
    earthy = ((r > g) & (g >= b * 0.8) & (r < 170)) | ((abs(r - g) < 30) & (g > b) & (r < 200))
    return earthy.mean() > 0.35


def plants():
    item = {}
    prev = []
    for pid, h in PLANTS.items():
        rgba, W = keyed(h)
        comps = [c for c in components(rgba)
                 if not any(hh == h and abs(c["cx"] * REF_W / W - x) < 45 and abs(c["cy"] * REF_W / W - y) < 45
                            for hh, x, y in MANUAL_DROP)]
        H = rgba.shape[0]
        cand = [c for c in comps if is_plant(c)]
        # all growth stages stand on one baseline: take the baseline group with the most area
        best = []
        for c in cand:
            grp = [d for d in cand if abs(d["box"][3] - c["box"][3]) < H * 0.12]
            if len(grp) >= 4 and sum(d["area"] for d in grp) > sum(d["area"] for d in best):
                best = grp
        top = sorted(sorted(best, key=lambda c: -c["area"])[:5], key=lambda c: c["cx"])
        if len(top) != 5:
            print(f"  ! plant {pid}: {len(top)} stages")
        fr = frames_canvas([norm(c["img"], W) for c in top])
        fr = [cap(f, max_h=240) for f in fr]
        st = {}
        for nm, f in zip(STAGE, fr):
            st[nm] = save(f, f"plants/{pid}/{nm}.webp"); prev.append((f"{pid}_{nm}", f))
        item[pid] = st
    preview_parts("plants", prev, "plants.png", cell=130, cols=10)
    manifest["items"]["plants"] = item


# ================================================================= WORLD
TEX = {"grass": "8824cdda", "dirt_path": "2544f87d", "stone_path": "53603ae6", "wood_deck": "3c45b914",
       "pond_water": "f684f893", "flowerbed_soil": "da632868", "forest_floor": "435d1a32",
       "greenhouse_tile": "fbadc18a", "starhill_grass": "6d3a0dc7", "snow_cover": "27cbd9fd",
       "autumn_leaves": "0cb7caed"}
ZONES = {"central_garden": "0f5b5c71", "greenhouse": "09489227", "pond": "0bd5e55f",
         "forest_library": "5fdec9b3", "workshop": "86cd803c", "starry_hill": "29502d99",
         "decor_01": "00e1af4f"}


def tileable(img, size=1024):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    H, W = a.shape[:2]
    a = a[:, :H]  # left square: avoids the watermark in the bottom-right corner
    n = a.shape[0]
    b = np.roll(np.roll(a, n // 2, 0), n // 2, 1)
    y = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n / 2)
    w1 = np.clip(y / 0.35, 0, 1)
    w = np.minimum(w1[:, None], w1[None, :])[..., None]
    out = a * w + b * (1 - w)
    return Image.fromarray(out.astype(np.uint8)).resize((size, size), Image.LANCZOS)


def world():
    item = {"terrain": {}, "props": {}}
    prev = []
    for tid, h in TEX.items():
        t = tileable(Image.open(SRC[h]))
        item["terrain"][tid] = save(t, f"world/terrain/{tid}.webp", q=86)
        tiled = Image.new("RGB", (512, 512))
        sm = t.resize((256, 256))
        for i in range(2):
            for j in range(2):
                tiled.paste(sm, (i * 256, j * 256))
        prev.append((tid, tiled.convert("RGBA")))
    preview_parts("terrain (2x2 tiled to check seams)", prev, "terrain.png", cell=260, cols=6)
    for zid, h in ZONES.items():
        rgba, W = keyed(h)
        comps = components(rgba)
        comps.sort(key=lambda c: (round(c["cy"] / (rgba.shape[0] / 2.2)), c["cx"]))
        files = []
        pv = []
        for i, c in enumerate(comps):
            im = cap(norm(c["img"], W), max_h=420)
            files.append(save(im, f"world/landmarks/{zid}/prop_{i:02d}.webp")); pv.append((f"prop_{i:02d}", im))
        item["props"][zid] = files
        preview_parts(f"props {zid}", pv, f"props_{zid}.png", cell=170, cols=6)
    manifest["items"]["world"] = item


# ================================================================= UI / FX
def ui():
    item = {}
    # icons in 3 rows (4,4,5 or similar)
    rgba, W = keyed("96d15ee0")
    names = ["focus", "garden", "records", "settings", "settings_alt", "wardrobe", "codex", "companions",
             "companions_alt", "seeds", "time_points", "play", "skip"]
    rws = rows_of(components(rgba))
    icons = [c for r in rws for c in r]
    item["icons"] = {}
    pv = []
    for i, c in enumerate(icons):
        nm = names[i] if i < len(names) else f"icon_{i:02d}"
        im = cap(norm(c["img"], W), max_h=160)
        item["icons"][nm] = save(im, f"ui/icons/{nm}.webp"); pv.append((nm, im))
    preview_parts("icons", pv, "ui_icons.png", cell=140, cols=8)

    for group, h, sub in [("ornaments", "eadb1327", "ui/ornaments"), ("particles", "68d26e23", "ui/fx/particles"),
                          ("celebration", "7a0f0db5", "ui/fx/celebration")]:
        rgba, W = keyed(h)
        rws = rows_of(components(rgba))
        files = []; pv = []
        for ri, r in enumerate(rws):
            for ci, c in enumerate(r):
                im = norm(c["img"], W)
                nm = f"r{ri}_{ci:02d}"
                files.append(save(im, f"{sub}/{nm}.webp")); pv.append((nm, im))
        item[group] = files
        preview_parts(group, pv, f"ui_{group}.png", cell=140, cols=8)

    rgba, W = keyed("e5c0b96e")
    comps = components(rgba, merge=8)
    bb = np.array([c["box"] for c in comps])
    big = [c for c in comps if c["area"] > 0.02 * sum(x["area"] for x in comps)]
    x0 = min(c["box"][0] for c in big); y0 = min(c["box"][1] for c in big)
    x1 = max(c["box"][2] for c in big); y1 = max(c["box"][3] for c in big)
    logo = Image.fromarray(rgba).crop((x0, y0, x1, y1))
    item["logo"] = save(cap(norm(logo, W), max_w=1200), "ui/logo.webp", q=92)

    ic = Image.open(SRC["183b1445"]).convert("RGB")
    W, H = ic.size
    sq = ic.crop(((W - H) // 2, 0, (W - H) // 2 + H, H))
    os.makedirs("/home/claude/out/icons", exist_ok=True)
    for s in (192, 512):
        sq.resize((s, s), Image.LANCZOS).save(f"/home/claude/out/icons/icon-{s}.png", optimize=True)
    item["appIcon"] = ["icons/icon-192.png", "icons/icon-512.png"]
    manifest["items"]["ui"] = item


if __name__ == "__main__":
    which = sys.argv[1:] or ["avatar", "wardrobe", "companions", "wildlife", "plants", "world", "ui"]
    if set(which) == {"avatar", "wardrobe", "companions", "wildlife", "plants", "world", "ui"}:
        shutil.rmtree("/home/claude/out", ignore_errors=True)
    mp = "/home/claude/out/manifest_partial.json"
    if os.path.exists(mp):
        manifest["items"].update(json.load(open(mp))["items"])
    for w in which:
        print("==", w); globals()[w]()
        os.makedirs("/home/claude/out", exist_ok=True)
        json.dump(manifest, open(mp, "w"), ensure_ascii=False, indent=1)
    print("done")
