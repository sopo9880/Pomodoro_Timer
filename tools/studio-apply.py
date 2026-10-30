"""Put a studio export into the repository.

Run: python3 tools/studio-apply.py path/to/bloomodoro-studio-YYYY-MM-DD.zip [--dry-run]

What it does, in order:
  1. every picture under files/assets/... is copied to the same path in the repo (formats are
     already converted by the studio, so a .webp stays a .webp);
  2. the numbers from the "캐릭터 맞추기" tab are merged into garden/rig-tuning-data.mjs, which the
     game ships to everyone (the person's own browser keeps working the same);
  3. the to-make list becomes docs/studio-todo.md;
  4. the picture list (garden/asset-manifest-data.mjs) is rebuilt.
Nothing outside assets/art, garden/rig-tuning-data.mjs, docs/studio-todo.md and the manifest is touched.
"""
import json, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH_OK = re.compile(r"^assets/art/[\w./-]+\.(webp|png|jpe?g|svg)$", re.I)


def merge(a, b):
    """b wins over a, one part at a time (same rules as the game's mergeTunings)."""
    out = json.loads(json.dumps(a))
    for key in ("layers", "params"):
        for owner, poses in (b.get(key) or {}).items():
            for pose, rest in poses.items():
                node = out.setdefault(key, {}).setdefault(owner, {}).setdefault(pose, {})
                if key == "layers":
                    for view, parts in rest.items():
                        node.setdefault(view, {}).update(parts)
                else:
                    node.update(rest)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        sys.exit(__doc__)
    z = zipfile.ZipFile(args[0])
    manifest = json.loads(z.read("manifest.json"))
    if manifest.get("format") != "bloomodoro-studio":
        sys.exit("not a studio export")
    copied = []
    for info in z.infolist():
        name = info.filename
        if not name.startswith("files/"):
            continue
        rel = name[len("files/"):]
        if not PATH_OK.match(rel) or ".." in rel:
            print("skipped (not a game picture path):", rel)
            continue
        if not dry:
            dest = ROOT / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(z.read(name))
        copied.append(rel)
    data_file = ROOT / "garden/rig-tuning-data.mjs"
    current = json.loads(re.search(r"=\s*(\{.*\});", data_file.read_text(encoding="utf-8"), re.S).group(1))
    tuning = merge(current, manifest.get("tuning") or {})
    tuning.pop("images", None)
    if not dry:
        data_file.write_text(
            "// Tuning committed with the game (what everyone sees). Written by tools/studio-apply.py from a\n"
            "// studio export. A person's own studio edits sit on top of this in their browser.\n"
            "export const RIG_TUNING_DATA = " + json.dumps(tuning, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")
        (ROOT / "docs").mkdir(exist_ok=True)
        (ROOT / "docs/studio-todo.md").write_text(z.read("TODO.md").decode("utf-8"), encoding="utf-8")
        subprocess.run([sys.executable, str(ROOT / "tools/build-asset-manifest.py")], check=True)
    print(f"{'would copy' if dry else 'copied'} {len(copied)} pictures; tuning has "
          f"{sum(len(p) for o in tuning.get('layers', {}).values() for ps in o.values() for p in ps.values())} adjusted parts")
    for rel in copied:
        print("  ", rel)


main()
