"""Prepare the browser-only website for static hosting."""
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
source = root / "atlas"
output = root / "dist"

# Only replace this project's generated deployment directory.
if output.is_symlink() or output.resolve().parent != root:
    raise RuntimeError("The deployment directory must be inside the Arcadia project")
if output.exists():
    shutil.rmtree(output)
output.mkdir()

for name in (
    "index.html", "style.css", "app.js", "world.js",
    "world3d.js", "world3d.css", "world3d-model.js",
):
    shutil.copy2(source / name, output / name)

for name in ("assets", "vendor", "art-direction"):
    shutil.copytree(source / name, output / name, ignore=shutil.ignore_patterns(".DS_Store"))

index = output / "index.html"
html = index.read_text(encoding="utf-8")
html = html.replace("</head>", '  <meta name="arcadia-storage" content="browser">\n</head>')
index.write_text(html, encoding="utf-8")

files = [path for path in output.rglob("*") if path.is_file()]
assert (output / "vendor" / "three.min.js").is_file()
assert 'content="browser"' in html
assert not (output / "feedback").exists()
print(f"Prepared static website: {len(files)} files, {sum(p.stat().st_size for p in files):,} bytes")
