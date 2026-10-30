"""Apply a rig-editor export (the text that starts with RIG_EDIT or RIG_ADJUST).

Run: python3 tools/rig-editor/apply.py <file with the pasted text>
- adjust -> garden/avatar-rig-adjust.mjs
- masks  -> painted "erase" pixels are removed from the asset; painted "back"
            pixels move to <asset>_back.webp, which the rig draws behind the body
            (the part's "back" entry in avatar-rig-data.mjs). The untouched asset
            is kept in tools/rig_src/edited/ so edits can be redone.
"""
import base64, io, json, re, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
text = Path(sys.argv[1]).read_text().strip()
tag, _, body = text.partition(" ")
data = json.loads(body)
adjust, masks = (data["adjust"], data.get("masks", {})) if tag == "RIG_EDIT" else (data, {})

js = ("/**\n * Hand-tuned rig fit, exported from the rig editor (tools/rig-editor).\n"
      " * view -> part -> { dx, dy (part pixels), rot (degrees), s (scale), z (draw order shift), hide }\n */\n"
      "export const RIG_ADJUST = Object.freeze(" + json.dumps(adjust, ensure_ascii=False, indent=1) + ");\n")
(ROOT / "garden/avatar-rig-adjust.mjs").write_text(js)
print("adjust:", {v: list(p) for v, p in adjust.items()})

def mask(url, size):
    if not url:
        return np.zeros(size[::-1], bool)
    im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA").resize(size)
    return np.array(im)[..., 3] > 100

data_path = ROOT / "garden/avatar-rig-data.mjs"
rig_data = data_path.read_text()
keep = ROOT / "tools/rig_src/edited"
keep.mkdir(parents=True, exist_ok=True)
for name, m in masks.items():
    path = ROOT / name
    orig = keep / name.replace("/", "__")
    if not orig.exists():
        shutil.copy(path, orig)
    a = np.array(Image.open(orig).convert("RGBA"))
    size = (a.shape[1], a.shape[0])
    erase, back = mask(m.get("erase"), size), mask(m.get("back"), size)
    main = a.copy()
    main[erase | back, 3] = 0
    Image.fromarray(main).save(path, "WEBP", quality=92, method=6)
    ver = lambda s: re.sub(r'(%s)(\?v=(\d+))?"' % re.escape(s),
                           lambda q: q.group(1) + "?v=" + str(int(q.group(3) or 1) + 1) + '"', rig_data)
    rig_data = ver(name)
    back_name = name.replace(".webp", "_back.webp")
    if back.any():
        bk = a.copy()
        bk[~back, 3] = 0
        Image.fromarray(bk).save(ROOT / back_name, "WEBP", quality=92, method=6)
        # add or bump "back" on every part that uses this asset
        rig_data = re.sub(r'("src": "%s(?:\?v=\d+)?")(,\n\s*"back": "[^"]*")?' % re.escape(name),
                          lambda q: q.group(1) + ',\n   "back": "%s?v=%d"' % (back_name, np.random.randint(2, 99999)), rig_data)
    else:
        rig_data = re.sub(r',\n\s*"back": "%s[^"]*"' % re.escape(back_name), "", rig_data)
        (ROOT / back_name).unlink(missing_ok=True)
    print(name, "erased", int(erase.sum()), "behind", int(back.sum()))
data_path.write_text(rig_data)
