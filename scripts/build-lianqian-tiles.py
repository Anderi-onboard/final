"""Build compact, pixel-seamless Lianqian tiles and two transparent accents.

The source plates are archival 768 px pattern studies rather than true CSS
tiles.  This script recovers their measured repeat periods, crops one exact
period, and exports it losslessly so the browser never has to join mismatched
outer plate edges.
"""

from pathlib import Path
from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "textures" / "lianqian"

SPECS = {
    "lianqian-dense-clay": (85, 86),
    "lianqian-diagonal-clay": (99, 99),
    "lianqian-outline-silver": (85, 86),
    "lianqian-spaced-medallion": (192, 208),
}

PALETTE = {
    "ink": (52, 37, 31),
    "coral": (222, 121, 93),
    "bronze": (164, 112, 66),
}


def band_difference(image: Image.Image, offset: int, period: int, axis: str) -> float:
    """Compare a narrow band with the same band exactly one period away."""
    band = 4
    if axis == "x":
        a = image.crop((offset, 0, offset + band, image.height))
        b = image.crop((offset + period, 0, offset + period + band, image.height))
    else:
        a = image.crop((0, offset, image.width, offset + band))
        b = image.crop((0, offset + period, image.width, offset + period + band))
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3


def best_offset(image: Image.Image, period: int, axis: str) -> int:
    extent = image.width if axis == "x" else image.height
    upper = extent - period - 4
    return min(range(upper + 1), key=lambda value: band_difference(image, value, period, axis))


def make_seamless(image: Image.Image, feather: int = 6) -> Image.Image:
    """Feather both edge pairs to the same pixels without blurring the motif."""
    tile = image.convert("RGB")
    pixels = tile.load()
    width, height = tile.size

    for y in range(height):
        left = pixels[0, y]
        right = pixels[width - 1, y]
        join = tuple(round((left[channel] + right[channel]) / 2) for channel in range(3))
        for distance in range(feather):
            strength = 1 - (distance / feather)
            for x in (distance, width - 1 - distance):
                source = pixels[x, y]
                pixels[x, y] = tuple(
                    round(source[channel] * (1 - strength) + join[channel] * strength)
                    for channel in range(3)
                )

    for x in range(width):
        top = pixels[x, 0]
        bottom = pixels[x, height - 1]
        join = tuple(round((top[channel] + bottom[channel]) / 2) for channel in range(3))
        for distance in range(feather):
            strength = 1 - (distance / feather)
            for y in (distance, height - 1 - distance):
                source = pixels[x, y]
                pixels[x, y] = tuple(
                    round(source[channel] * (1 - strength) + join[channel] * strength)
                    for channel in range(3)
                )
    return tile


def transparent_accent(image: Image.Image) -> Image.Image:
    """Remove the warm paper and map the remaining ink to Soft Peach tones."""
    source = image.convert("RGB")
    result = Image.new("RGBA", source.size)
    out = []
    for red, green, blue in source.get_flattened_data():
        # The plates use warm near-white stock. Saturated/dark pixels are art.
        paper_distance = max(abs(red - 246), abs(green - 241), abs(blue - 229))
        alpha = max(0, min(255, (paper_distance - 5) * 9))
        if alpha == 0:
            out.append((0, 0, 0, 0))
        elif red > green + 18:
            out.append((*PALETTE["coral"], alpha))
        elif blue > red + 8 or blue > green + 5:
            out.append((*PALETTE["ink"], alpha))
        else:
            out.append((*PALETTE["bronze"], alpha))
    result.putdata(out)
    return result


def transparent_coin(image: Image.Image) -> Image.Image:
    """Colour a paper-free connected coin with restrained quadrant contrast."""
    source = image.convert("RGB")
    result = Image.new("RGBA", source.size)
    out = []
    center_x = source.width / 2
    center_y = source.height / 2
    for index, (red, green, blue) in enumerate(source.get_flattened_data()):
        x = index % source.width
        y = index // source.width
        paper_distance = max(abs(red - 246), abs(green - 241), abs(blue - 229))
        alpha = max(0, min(255, (paper_distance - 4) * 14))
        if alpha == 0:
            out.append((0, 0, 0, 0))
        elif red + green + blue < 430:
            out.append((*PALETTE["ink"], alpha))
        elif abs(x - center_x) > abs(y - center_y):
            out.append((*PALETTE["coral"], alpha))
        else:
            out.append((*PALETTE["bronze"], alpha))
    result.putdata(out)
    return result


def main() -> None:
    tiles = {}
    for stem, (period_x, period_y) in SPECS.items():
        source = Image.open(SOURCE / f"{stem}.webp").convert("RGB")
        offset_x = best_offset(source, period_x, "x")
        offset_y = best_offset(source, period_y, "y")
        tile = source.crop((offset_x, offset_y, offset_x + period_x, offset_y + period_y))
        tile = make_seamless(tile)
        tile.save(SOURCE / f"{stem}-tile.webp", "WEBP", lossless=True, method=6)
        tiles[stem] = tile

    outline = tiles["lianqian-outline-silver"]
    doubled = Image.new("RGB", (outline.width * 2, outline.height * 2))
    for x in (0, outline.width):
        for y in (0, outline.height):
            doubled.paste(outline, (x, y))
    center_x = doubled.width // 2
    center_y = doubled.height // 2
    coin = doubled.crop((center_x - 56, center_y - 56, center_x + 56, center_y + 56))
    transparent_coin(coin).save(
        SOURCE / "lianqian-accent-coin.webp", "WEBP", lossless=True, method=6
    )

    # One complete coloured medallion from the spaced plate, kept as a real
    # raster ornament rather than redrawn in CSS/SVG.
    spaced_source = Image.open(SOURCE / "lianqian-spaced-medallion.webp").convert("RGB")
    medallion = spaced_source.crop((40, 52, 152, 164))
    transparent_accent(medallion).save(
        SOURCE / "lianqian-accent-medallion.webp", "WEBP", lossless=True, method=6
    )


if __name__ == "__main__":
    main()
