"""Move static Wix images referenced by the site into public/media.

The script downloads the original source asset (not Wix's cropped derivative),
uses stable descriptive filenames when known, and replaces every full Wix URL
with the local project-owned path.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
import re

PUBLIC = Path("public")
MEDIA = PUBLIC / "media"
MEDIA.mkdir(parents=True, exist_ok=True)

KNOWN = {
    "95ec914a567745dd988ef89ea82fbc19": "coffee-time-characters.png",
    "a0d493dc5b09418ba3664ab300922eac": "realm-of-time-board.jpg",
    "832be09c292a40809a737a449a85f333": "creator-character-sheet.jpg",
    "9e02247905e943658102eb69bdfac901": "coffee-time-box-cover.png",
    "25aaac86eb9a4e49b652db75d42bd057": "hmp-bikes-cartoon.png",
    "93caa058972d47b9bed19f8ace97563b": "rapid-refill-game.png",
    "4be294351de84c2a8c1d3268284b7265": "donut-dash-game.png",
    "8f23f547a35c4ee194d73d79d2811a1f": "comic-con-collage-2.jpg",
    "4cd464148b8e4e0f82762eecb63b110a": "comic-con-collage.jpg",
    "eff8eca74bbe4599b22968f5e012bbc0": "comic-con-table.jpg",
    "592d7f98e441488fbb43a0ff72009d5f": "comic-con-players.jpg",
    "b806667784f940ea99c3c48e21a2b580": "comic-con-fans.jpg",
    "4d81897d9c324c3b952391dc8daa35d4": "radio-feature-artwork.jpg",
    "37e26abdac5348aebd30f2f25568e2a0": "first-100-games.jpg",
    "c12248b7": "thermos.png",
    "5532ee75": "dottie.png",
    "8f11f476": "king-tea.png",
    "80262c5c": "deep-space-kruiser.png",
    "257bc871": "wind-feather.png",
    "ae67c495": "team-warp-orb.png",
    "6f5a2995": "ice-card.png",
    "29ecc427": "sugar-orb.png",
    "8ac9d74d": "earth-card.png",
    "d7780746": "purple-tree-team.jpg",
}

pattern = re.compile(r'https://static\.wixstatic\.com/media/[^"\'\s)>]+')
files = list(PUBLIC.rglob("*.html")) + list(PUBLIC.rglob("*.css"))
references = {}
for page in files:
    text = page.read_text(encoding="utf-8")
    for url in pattern.findall(text):
        references.setdefault(url, []).append(page)

failures = []
replacements = {}
for full_url in sorted(references):
    source = full_url.split("/v1/", 1)[0]
    stem_match = re.search(r'fb9d2f_([0-9a-f]+)~mv2', source)
    suffix = Path(urlsplit(source).path).suffix.lower() or ".bin"
    ident = stem_match.group(1) if stem_match else re.sub(r"\W+", "-", source)[-32:]
    name = next((v for k, v in KNOWN.items() if ident.startswith(k)), f"legacy-{ident}{suffix}")
    target = MEDIA / name
    if not target.exists():
        try:
            req = Request(source, headers={"User-Agent": "Coffee-Time-site-migration/1.0"})
            with urlopen(req, timeout=45) as response:
                data = response.read()
                if len(data) < 100:
                    raise RuntimeError(f"unexpectedly small response ({len(data)} bytes)")
                target.write_bytes(data)
                print(f"downloaded {name}: {len(data):,} bytes")
        except Exception as exc:
            failures.append(f"{source}: {exc}")
            continue
    replacements[full_url] = f"/media/{name}"

for page in files:
    text = page.read_text(encoding="utf-8")
    updated = text
    for old, new in replacements.items():
        updated = updated.replace(old, new)
    if updated != text:
        page.write_text(updated, encoding="utf-8")
        print(f"updated {page}")

manifest = MEDIA / "README.md"
manifest.write_text(
    "# Coffee Time media\n\n"
    "These assets were migrated from the legacy Coffee Time Wix site so the new "
    "site owns and serves its visual library directly.\n\n"
    f"Migrated references: {len(replacements)}\n",
    encoding="utf-8",
)
if failures:
    raise SystemExit("Some assets failed to migrate:\n" + "\n".join(failures))
print(f"Migrated {len(replacements)} distinct image references.")
