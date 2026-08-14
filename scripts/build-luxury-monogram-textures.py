from pathlib import Path

from PIL import Image


ROOT = Path(r"C:\final")
SOURCE_DIR = ROOT / "assets" / "editorial" / "baoxianghua" / "generated"
OUTPUT_DIR = ROOT / "assets" / "textures"

SOURCES = [
    SOURCE_DIR / "04-scroll-rosette.png",
    SOURCE_DIR / "05-layered-rosette.png",
    SOURCE_DIR / "06-simple-rosette.png",
    SOURCE_DIR / "07-petal-wheel.png",
    SOURCE_DIR / "08-cloud-medallion.png",
    SOURCE_DIR / "09-beaded-medallion.png",
]


def normalized_mark(path: Path, size: int, opacity: int = 255) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        alpha = alpha.crop(bbox)
    alpha.thumbnail((size, size), Image.Resampling.LANCZOS)
    if opacity != 255:
        alpha = alpha.point(lambda value: value * opacity // 255)
    mark = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    mark.putalpha(alpha)
    return mark


def place(canvas: Image.Image, path: Path, center: tuple[int, int], size: int, opacity: int = 255) -> None:
    mark = normalized_mark(path, size, opacity)
    canvas.alpha_composite(mark, (center[0] - mark.width // 2, center[1] - mark.height // 2))


def build_micro_tile() -> Image.Image:
    canvas = Image.new("RGBA", (360, 360), (0, 0, 0, 0))
    index = 0
    # A close, interlocking repeat: each rosette overlaps its neighbours just
    # enough that the field reads as one grown textile instead of scattered
    # stamps. 60 divides the tile exactly, so every clipped edge continues on
    # the opposite side without a seam.
    row_gap = 60
    column_gap = 60
    for row, y in enumerate(range(0, 361, row_gap)):
        offset = 30 if row % 2 else 0
        for x in range(-60 - offset, 421, column_gap):
            if -70 < x < 430:
                size = (82, 92, 76, 88)[(row + index) % 4]
                place(canvas, SOURCES[index % len(SOURCES)], (x, y), size, 186)
                index += 1
    return canvas


def build_editorial_field() -> Image.Image:
    canvas = Image.new("RGBA", (1440, 1080), (0, 0, 0, 0))
    large_zones = [
        (1080, 330, 238, SOURCES[1]),
        (260, 850, 172, SOURCES[4]),
    ]
    index = 0
    # The editorial field uses the same seamless 60px lattice. The clearings
    # are intentionally tight so the micro pattern appears to grow around the
    # two complete emblems rather than stopping in a mechanical circle.
    for row, y in enumerate(range(0, 1081, 60)):
        offset = 30 if row % 2 else 0
        for x in range(-60 - offset, 1501, 60):
            clear = False
            for cx, cy, radius, _ in large_zones:
                if (x - cx) ** 2 + (y - cy) ** 2 < radius ** 2:
                    clear = True
                    break
            if clear:
                continue
            size = (80, 90, 74, 86)[(row + index) % 4]
            place(canvas, SOURCES[index % len(SOURCES)], (x, y), size, 178)
            index += 1
    place(canvas, large_zones[0][3], large_zones[0][:2], 390, 245)
    place(canvas, large_zones[1][3], large_zones[1][:2], 285, 232)
    return canvas


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_micro_tile().save(OUTPUT_DIR / "baoxianghua-micro-monogram.png", optimize=True)
    build_editorial_field().save(OUTPUT_DIR / "baoxianghua-editorial-field.png", optimize=True)


if __name__ == "__main__":
    main()
