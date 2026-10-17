"""Intermediate representation. Loaders/layout produce it, writers consume it.

Everything is plain data in points (1/72 in) so the writers (docx / txt / md /
html) never need to know whether a page came from a text layer or from OCR.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Union


@dataclass
class Run:
    text: str
    size: Optional[float] = None      # pt
    bold: bool = False
    italic: bool = False
    color: Optional[str] = None       # "RRGGBB"; None = automatic
    font: Optional[str] = None


@dataclass
class Para:
    runs: List[Run]
    align: str = "left"               # left | center | right
    left_indent: float = 0.0          # pt, relative to the page's left margin
    first_indent: float = 0.0         # pt
    right_indent: float = 0.0         # pt, keeps a column narrow
    space_before: float = 0.0
    space_after: float = 0.0
    line_pitch: Optional[float] = None  # pt, "at least" line spacing
    heading: int = 0                  # 0 = body, 1..3

    @property
    def text(self) -> str:
        return "".join(r.text for r in self.runs)


@dataclass
class Image:
    data: bytes
    width: float                      # pt
    height: float                     # pt
    align: str = "left"
    space_before: float = 0.0
    indent: float = 0.0


@dataclass
class Table:
    rows: List[List[str]]
    col_widths: Optional[List[float]] = None   # pt
    space_before: float = 0.0


Block = Union[Para, Image, Table]


@dataclass
class Page:
    width: float
    height: float
    blocks: List[Block] = field(default_factory=list)
    source: str = "native"            # native | ocr
    margins: tuple = (72.0, 72.0, 72.0, 72.0)   # left, top, right, bottom
    note: str = ""


@dataclass
class Doc:
    title: str
    pages: List[Page] = field(default_factory=list)


# ---------------------------------------------------------------- text helpers

def is_cjk(ch: str) -> bool:
    o = ord(ch)
    return (0x2E80 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0xFE30 <= o <= 0xFE4F
            or 0xFF00 <= o <= 0xFFEF or 0x3000 <= o <= 0x303F or 0x20000 <= o <= 0x2FA1F
            or 0xAC00 <= o <= 0xD7AF or 0x3040 <= o <= 0x30FF)


def join_lines(a: str, b: str) -> str:
    """Join two visual lines of one paragraph the way a reader would: no space
    between CJK characters, one space between Latin words, and a soft hyphen at
    the end of a line is dropped when the next line continues the word."""
    if not a:
        return b
    if not b:
        return a
    last, first = a[-1], b[0]
    if last == "-" and len(a) > 1 and a[-2].isalpha() and first.islower() and first.isascii():
        return a[:-1] + b
    if is_cjk(last) or is_cjk(first):
        return a + b
    return a + " " + b
