"""Prepare generated Lianqian pattern tiles for the web.

Usage:
  python scripts/prepare-lianqian-textures.py source.png output.webp
"""

from pathlib import Path
import sys

from PIL import Image


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare-lianqian-textures.py source.png output.webp")

    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((768, 768), Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=88, method=6)


if __name__ == "__main__":
    main()
