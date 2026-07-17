#!/usr/bin/env python3
"""Pre-render every passage as its OpenGraph preview image.

WHY THIS EXISTS
    A shared link should preview as the card itself, not as a generic cover.
    OG images must be real URLs a crawler can fetch, so they can't be drawn by
    the browser — they have to exist as files at build time.

WHY IT'S A SECOND RENDERER
    assets/card.js draws the live card on a <canvas>; this draws the same card
    with Pillow. They must agree. If you change the card design, change BOTH —
    otherwise a shared link previews a card that no longer matches the site.
    The constants below are deliberately named to mirror card.js.

Format is 1200x630 — the OG standard, and the same proportions as card.js's
"wide" format.
"""
import pathlib
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"
REG = FONTS / "CormorantGaramond[wght].ttf"
ITAL = FONTS / "CormorantGaramond-Italic[wght].ttf"

# --- mirrors THEMES.ink in card.js -----------------------------------------
INK = (11, 11, 13)
CREAM = (239, 233, 221)
DIM = (143, 138, 128)
RULE = (239, 233, 221, 71)
FRAME = (239, 233, 221, 41)

W, H = 1200, 630
CAP = 58          # card.js: cap for the 'wide' format
LINE_RATIO = 1.62  # card.js: lineH = size * 1.62


def _font(style, size):
    """Light 300 / Light Italic 300 / Semibold 600 — the three card.js uses."""
    path = ITAL if style == "i" else REG
    f = ImageFont.truetype(str(path), size)
    try:
        f.set_variation_by_axes([600 if style == "b" else 300])
    except Exception:
        pass  # static fallback: weight is whatever the file defaults to
    return f


def parse_runs(line):
    """Mirror of parseRuns() in card.js — *italic* / **bold** markdown-lite."""
    out, last = [], 0
    for m in re.finditer(r"(\*\*[^*]+\*\*|\*[^*]+\*)", line):
        if m.start() > last:
            out.append((line[last:m.start()], "r"))
        tok = m.group(0)
        out.append((tok[2:-2], "b") if tok.startswith("**") else (tok[1:-1], "i"))
        last = m.end()
    if last < len(line):
        out.append((line[last:], "r"))
    return out or [(line, "r")]


def _run_w(d, runs, size):
    return sum(d.textlength(t, font=_font(s, size)) for t, s in runs)


def _fit(d, lines, max_w, max_h, cap):
    """Shrink until the block fits both axes — card.js fitSize()."""
    size = cap
    while size > 12:
        if (max(_run_w(d, r, size) for r in lines) <= max_w
                and len(lines) * size * LINE_RATIO <= max_h):
            break
        size -= 1
    return size


def _draw_runs(d, runs, cx, y, size, fill):
    """Centred, run by run, so italic and bold sit inline — card.js drawRuns()."""
    x = cx - _run_w(d, runs, size) / 2
    for t, s in runs:
        f = _font(s, size)
        d.text((x, y), t, font=f, fill=fill, anchor="lm")
        x += d.textlength(t, font=f)


def _spaced(d, text, cx, y, size, tracking, fill):
    """Letter-spaced small caps — card.js drawSpacedText()."""
    f = _font("r", size)
    total = sum(d.textlength(c, font=f) + tracking for c in text) - tracking
    x = cx - total / 2
    for c in text:
        d.text((x, y), c, font=f, fill=fill, anchor="lm")
        x += d.textlength(c, font=f) + tracking


def render(lines, author, book, site, out_path):
    im = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(im, "RGBA")

    # soft light from above (card.js radial gradient, approximated)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(28, 0, -1):
        r = int(H * 0.85 * i / 28)
        gd.ellipse([W // 2 - r, int(H * -0.06) - r, W // 2 + r, int(H * -0.06) + r],
                   fill=(200, 204, 210, max(1, int(10 * (1 - i / 28)))))
    im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")

    pad = round(min(W, H) * 0.055)
    d.rounded_rectangle([pad, pad, W - pad, H - pad], radius=4, outline=FRAME, width=2)

    inner = pad * 2
    max_w = W - inner * 2
    footer_h = H * 0.20                      # card.js: 'wide' footer
    max_h = H - inner * 2 - footer_h

    runs = [parse_runs(l) for l in lines]
    size = _fit(d, runs, max_w, max_h, CAP)
    line_h = size * LINE_RATIO
    block_h = len(runs) * line_h
    top = inner + (max_h - block_h) / 2

    for i, r in enumerate(runs):
        _draw_runs(d, r, W / 2, top + i * line_h + line_h / 2, size, CREAM)

    rule_y = top + block_h + min(footer_h * 0.34, 70)
    rule_w = min(120, W * 0.14)
    d.line([W / 2 - rule_w / 2, rule_y, W / 2 + rule_w / 2, rule_y], fill=RULE, width=1)

    a = round(max(20, min(W, H) * 0.026))
    _spaced(d, author.upper(), W / 2, rule_y + a * 2.1, a, a * 0.24, CREAM)
    fi = _font("i", round(a * 0.95))
    d.text((W / 2, rule_y + a * 3.7), book, font=fi, fill=DIM, anchor="mm")
    _spaced(d, site.upper(), W / 2, H - pad - a * 0.9, round(a * 0.7), a * 0.18, DIM)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(out_path, "PNG", optimize=True)
    return out_path


def fonts_present():
    return REG.exists() and ITAL.exists()
