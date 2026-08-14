from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(r"C:\final")
QA = ROOT / "artifacts" / "baoxianghua-qa"
SOURCE = ROOT / "assets" / "editorial" / "baoxianghua" / "generated" / "04-scroll-rosette.png"


def panel(path: Path, label: str, size: tuple[int, int]) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    image = Image.new("RGBA", source.size, "#d8d3c8")
    image.alpha_composite(source)
    image = image.convert("RGB")
    fitted = ImageOps.contain(image, (size[0] - 24, size[1] - 58), Image.Resampling.LANCZOS)
    out = Image.new("RGB", size, "#d8d3c8")
    out.paste(fitted, ((size[0] - fitted.width) // 2, 46 + (size[1] - 58 - fitted.height) // 2))
    ImageDraw.Draw(out).text((14, 15), label, fill="#252521")
    return out


def main() -> None:
    QA.mkdir(parents=True, exist_ok=True)
    board = Image.new("RGB", (1600, 1440), "#b8b2a6")
    slots = [
        (SOURCE, "SOURCE DIRECTION / PURE MEDALLION", (800, 720), (0, 0)),
        (QA / "compositions-desktop-final.png", "COMPOSITION LIBRARY / 8 ARRANGEMENTS", (800, 720), (800, 0)),
        (QA / "about-desktop-final.png", "IMPLEMENTATION / ABOUT DESKTOP", (800, 720), (0, 720)),
        (QA / "mobile-about.png", "IMPLEMENTATION / ABOUT MOBILE", (800, 720), (800, 720)),
    ]
    for path, label, size, xy in slots:
        board.paste(panel(path, label, size), xy)
    board.save(QA / "comparison-board.png", optimize=True)


if __name__ == "__main__":
    main()
