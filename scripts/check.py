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

for w in warnings:
    print(f"warning: {w}")
for e in errors:
    print(f"ERROR: {e}", file=sys.stderr)

print(f"\n{len(data['quotes'])} quotes across {len(data['poems'])} poems, "
      f"{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
