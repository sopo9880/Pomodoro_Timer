"""Bundle the rig editor into one self-contained page (parts embedded as data URIs).

Run: python3 tools/rig-editor/build.py <out.html>
Uses the live rig code (garden/avatar-rig.mjs) so what you see is what the game draws.
"""
import base64, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def uri(rel):
    p = ROOT / rel.split("?")[0]
    return "data:image/webp;base64," + base64.b64encode(p.read_bytes()).decode()

data = (ROOT / "garden/avatar-rig-data.mjs").read_text()
# each part keeps its file name ("name") so edits can be mapped back to the asset
data = re.sub(r'"src": "(assets/art/[^"]+\.webp(?:\?v=\d+)?)"',
              lambda m: '"src": "' + uri(m.group(1)) + '", "name": "' + m.group(1).split("?")[0] + '"', data)
data = re.sub(r'(?<!"name": )"(assets/art/[^"]+\.webp(?:\?v=\d+)?)"', lambda m: '"' + uri(m.group(1)) + '"', data)
rig = (ROOT / "garden/avatar-rig.mjs").read_text()
adjust = re.sub(r"^export ", "", (ROOT / "garden/avatar-rig-adjust.mjs").read_text(), flags=re.M)
code = "\n".join(l for l in (data + "\n" + adjust + "\n" + rig).splitlines()
                 if not l.startswith("import "))
code = re.sub(r"^export ", "", code, flags=re.M)
page = (ROOT / "tools/rig-editor/template.html").read_text().replace("/*__RIG__*/", code)
out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "tools/rig-editor/rig-editor.html")
out.write_text(page)
print(out, len(page) // 1024, "KB")
