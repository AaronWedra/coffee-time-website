"""Optimize large project media once, preserving transparency and filenames."""
from pathlib import Path
from PIL import Image, ImageOps

MEDIA = Path("public/media")
MARKER = MEDIA / ".optimized-v1"
if MARKER.exists():
    print("Media optimization already completed.")
    raise SystemExit(0)

before = after = changed = 0
for path in sorted(MEDIA.iterdir()):
    if path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
        continue
    before += path.stat().st_size
    try:
        with Image.open(path) as original:
            image = ImageOps.exif_transpose(original)
            image.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
            if path.suffix.lower() in {".jpg", ".jpeg"}:
                if image.mode not in ("RGB", "L"):
                    image = image.convert("RGB")
                image.save(path, "JPEG", quality=84, optimize=True, progressive=True)
            else:
                image.save(path, "PNG", optimize=True, compress_level=9)
        after += path.stat().st_size
        changed += 1
        print(f"optimized {path.name}: {path.stat().st_size:,} bytes")
    except Exception as exc:
        print(f"kept {path.name}: {exc}")
        after += path.stat().st_size

MARKER.write_text(
    f"Optimized {changed} assets. Before: {before} bytes. After: {after} bytes.\n",
    encoding="utf-8",
)
print(f"Optimized {changed} images: {before:,} -> {after:,} bytes")
