"""Layout helpers shared by the text-layer path and the OCR path."""
from __future__ import annotations

from statistics import median
from typing import Callable, List, Optional, Sequence, TypeVar

T = TypeVar("T")


def find_gutter(spans: Sequence[tuple], min_frac: float = 0.025) -> Optional[float]:
    """Is the page set in columns? `spans` is (x0, x1) per text item. Returns the
    x of the widest empty vertical gutter in the middle 40% of the text area, or
    None. A few items may cross it (a full-width title does not make the page
    single-column)."""
    n = len(spans)
    if n < 6:
        return None
    lo = min(s[0] for s in spans)
    hi = max(s[1] for s in spans)
    width = hi - lo
    if width <= 0:
        return None
    bins = 400
    cover = [0] * bins
    for x0, x1 in spans:
        a = max(0, int((x0 - lo) / width * bins))
        b = min(bins - 1, int((x1 - lo) / width * bins))
        for k in range(a, b + 1):
            cover[k] += 1
    tol = max(1, int(n * 0.12))
    best = None
    k = int(bins * 0.30)
    end = int(bins * 0.70)
    while k < end:
        if cover[k] <= tol:
            j = k
            while j < end and cover[j] <= tol:
                j += 1
            if (j - k) / bins >= min_frac and (best is None or j - k > best[1] - best[0]):
                best = (k, j)
            k = j
        else:
            k += 1
    if best is None:
        return None
    return lo + (best[0] + best[1]) / 2 / bins * width


def reading_order(items: List[T], rect: Callable[[T], tuple]) -> List[T]:
    """Top-to-bottom, and left column before right column when there are two.
    Items that straddle the gutter (titles, full-width figures) split the page
    into bands that are read one after the other."""
    if not items:
        return []
    key = lambda i: (round(rect(i)[1], 1), rect(i)[0])
    gx = find_gutter([(rect(i)[0], rect(i)[2]) for i in items])
    if gx is None:
        return sorted(items, key=key)
    cross = sorted((i for i in items if rect(i)[0] < gx < rect(i)[2]), key=key)
    left = [i for i in items if rect(i)[2] <= gx]
    right = [i for i in items if rect(i)[0] >= gx]
    out: List[T] = []
    start = float("-inf")
    for c in cross + [None]:
        end = rect(c)[1] if c is not None else float("inf")
        out += sorted((i for i in left if start <= rect(i)[1] < end), key=key)
        out += sorted((i for i in right if start <= rect(i)[1] < end), key=key)
        if c is not None:
            out.append(c)
            start = rect(c)[1]
    return out


def snap_half(pt: float) -> float:
    return round(pt * 2) / 2.0


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def heading_level(ratio: float) -> int:
    if ratio >= 1.7:
        return 1
    if ratio >= 1.35:
        return 2
    return 3


def pick_margins(x0s, y0s, x1s, y1s, W, H):
    if not x0s:
        return (72.0, 72.0, 72.0, 72.0)
    lo = 28.0
    hi = 150.0
    return (clamp(min(x0s), lo, hi), clamp(min(y0s), lo, hi),
            clamp(W - max(x1s), lo, hi), clamp(H - max(y1s), lo, hi))


TERMINAL = set("。！？!?.:;；：”」』\"')）)")
BULLETS = "•·●○■□▪▫◆◇▶►‣-–—*"
