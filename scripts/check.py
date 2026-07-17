#!/usr/bin/env python3
"""Validate data/quotes.json before anything gets deployed.

Catches the failure modes that actually bite: a quote pointing at a poem that
doesn't exist, duplicate ids (which would collide as URLs), empty lines, and
straight quotes that would look wrong next to the book's typography.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors = []
warnings = []

data = json.loads((ROOT / "data" / "quotes.json").read_text(encoding="utf-8"))

poem_ids = {p["id"] for p in data["poems"]}
seen = set()

for p in data["poems"]:
    if not re.fullmatch(r"[a-z0-9-]+", p["id"]):
        errors.append(f"poem id not URL-safe: {p['id']!r}")

for q in data["quotes"]:
    qid = q.get("id", "")
    if not re.fullmatch(r"[a-z0-9-]+", qid):
        errors.append(f"quote id not URL-safe: {qid!r}")
    if qid in seen:
        errors.append(f"duplicate quote id: {qid!r}")
    seen.add(qid)

    if q.get("poem") not in poem_ids:
        errors.append(f"{qid}: unknown poem {q.get('poem')!r}")

    lines = q.get("lines") or []
    if not lines:
        errors.append(f"{qid}: no lines")
    if len(lines) > 8:
        warnings.append(f"{qid}: {len(lines)} lines — may render small on a card")
    for line in lines:
        if not line.strip():
            errors.append(f"{qid}: blank line")
        if len(line) > 52:
            warnings.append(f"{qid}: long line ({len(line)} chars) — check the card")
        if "'" in line:
            warnings.append(f"{qid}: straight apostrophe in {line!r} — use ’")

    if not q.get("themes"):
        warnings.append(f"{qid}: no themes — it won't appear under any filter chip")

# ---- poems.json: the full text, and now the canonical copy of the book ----
full = json.loads((ROOT / "data" / "poems.json").read_text(encoding="utf-8"))
poem_ids_full = set()
stanza_ids = set()
for p in full["poems"]:
    if not re.fullmatch(r"[a-z0-9-]+", p["id"]):
        errors.append(f"poem id not URL-safe: {p['id']!r}")
    poem_ids_full.add(p["id"])
    if not p["stanzas"]:
        errors.append(f"{p['id']}: no stanzas")
    for s in p["stanzas"]:
        if s["id"] in stanza_ids:
            errors.append(f"duplicate stanza id: {s['id']}")
        stanza_ids.add(s["id"])
        if s["id"] in seen:
            errors.append(f"stanza id collides with a curated quote id: {s['id']}")
        if not s.get("lines"):
            errors.append(f"{s['id']}: no lines")
        for line in s["lines"]:
            # markdown-lite emphasis must be balanced or the card renders literal asterisks
            if line.count("**") % 2:
                errors.append(f"{s['id']}: unbalanced ** in {line!r}")
            if (line.replace("**", "").count("*")) % 2:
                errors.append(f"{s['id']}: unbalanced * in {line!r}")
            if "'" in line:
                warnings.append(f"{s['id']}: straight apostrophe in {line!r} — use ’")

if poem_ids_full != poem_ids:
    errors.append(f"poems.json and quotes.json disagree on poems: "
                  f"{poem_ids_full ^ poem_ids}")

for q in data["quotes"]:
    if q["poem"] not in poem_ids_full:
        errors.append(f"{q['id']}: poem {q['poem']!r} has no full text in poems.json")

for w in warnings:
    print(f"warning: {w}")
for e in errors:
    print(f"ERROR: {e}", file=sys.stderr)

# ---- the two card renderers must agree ----
# assets/card.js draws the live card; scripts/ogcards.py draws the preview image
# a shared link shows. If one changes and the other doesn't, links start
# previewing a card that doesn't match the site. These are the numbers that
# would visibly diverge — cheap to check, expensive to miss.
card_js = (ROOT / "assets" / "card.js").read_text(encoding="utf-8")
og_py = (ROOT / "scripts" / "ogcards.py").read_text(encoding="utf-8")
for label, pattern_js, pattern_py in [
    ("wide format size", r"wide:\s*\{\s*w:\s*1200,\s*h:\s*630", r"^W, H = 1200, 630"),
    ("line spacing 1.62", r"size \* 1\.62", r"LINE_RATIO = 1\.62"),
    ("wide type cap 58", r"format === 'wide' \? 58", r"^CAP = 58"),
    ("ink #0b0b0d", r"bg: '#0b0b0d'", r"^INK = \(11, 11, 13\)"),
    ("cream #efe9dd", r"text: '#efe9dd'", r"^CREAM = \(239, 233, 221\)"),
]:
    in_js = re.search(pattern_js, card_js) is not None
    in_py = re.search(pattern_py, og_py, re.M) is not None
    if in_js != in_py:
        errors.append(
            f"card.js and ogcards.py disagree on {label!r} "
            f"(card.js: {in_js}, ogcards.py: {in_py}) — the live card and the "
            f"link-preview image would render differently"
        )

nlines = sum(len(s["lines"]) for p in full["poems"] for s in p["stanzas"])
print(f"\n{len(data['quotes'])} curated quotes · {len(stanza_ids)} stanzas · "
      f"{nlines} lines across {len(full['poems'])} poems — "
      f"{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
