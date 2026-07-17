#!/usr/bin/env python3
"""Assemble _site/ for GitHub Pages.

The site itself is plain static files — this script only adds the things that
have to exist as real URLs on disk:

  /q/<id>/index.html     the app itself, with that passage's OG tags. A real URL
                         a crawler can fetch AND the working site — so the
                         address bar always holds something shareable.
  /poem/<id>/index.html  the same, per poem.
  /sitemap.xml         so search engines find every quote.
  /404.html, /robots.txt, /CNAME

Run it locally exactly as CI does:  python3 scripts/build.py && open _site/index.html
"""
import html
import json
import os
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"
CNAME_FILE = ROOT / "CNAME"

data = json.loads((ROOT / "data" / "quotes.json").read_text(encoding="utf-8"))
full = json.loads((ROOT / "data" / "poems.json").read_text(encoding="utf-8"))
book = data["book"]
poems = {p["id"]: p for p in data["poems"]}
full_by_id = {p["id"]: p for p in full["poems"]}


def strip_md(s):
    """Drop the *italic* / **bold** markers — meta tags take plain text."""
    return re.sub(r"\*+", "", s)


# --- per-passage OG images -------------------------------------------------
# A shared link should preview AS the card. These are generated here, into
# _site/, so they never bloat the repo — only the 1.9MB of fonts is committed.
sys.path.insert(0, str(ROOT / "scripts"))
import ogcards  # noqa: E402

if not ogcards.fonts_present():
    raise SystemExit(
        "assets/fonts/CormorantGaramond*.ttf missing — OG preview cards can't be\n"
        "  rendered. Fetch them from the google/fonts repo (SIL OFL):\n"
        "  https://github.com/google/fonts/tree/main/ofl/cormorantgaramond"
    )

OG_DIR = OUT / "assets" / "og"


def og_for(qid, lines):
    """Render one card and return its public URL.

    Lines keep their *italic*/**bold** markers — ogcards parses them, exactly as
    card.js does, so the poet's emphasis survives into the preview image."""
    ogcards.render(lines, book["author"], book["title"], domain,
                   OG_DIR / f"{qid}.png")
    return f"{BASE}/assets/og/{qid}.png"


def site_base():
    """Where this build will actually be served from.

    Never guess a domain here — a wrong BASE bakes dead canonical URLs and dead
    redirects into every quote page. Order: an explicit CNAME wins; otherwise
    derive the real Pages URL from the repo; locally, fall back to relative.
    """
    if CNAME_FILE.exists():
        domain = CNAME_FILE.read_text().strip()
        if domain:
            return f"https://{domain}", domain

    repo = os.environ.get("GITHUB_REPOSITORY")  # "owner/name", set by Actions
    if repo:
        owner, name = repo.split("/", 1)
        owner = owner.lower()
        if name.lower() == f"{owner}.github.io":
            return f"https://{owner}.github.io", f"{owner}.github.io"
        return f"https://{owner}.github.io/{name}", f"{owner}.github.io/{name}"

    return "", "(relative — local preview)"


BASE, domain = site_base()

# --- copy the static site -------------------------------------------------
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

for name in ("assets", "data"):
    # fonts/ is build-time only: the browser loads Cormorant from Google Fonts,
    # so shipping 1.9MB of TTFs to every visitor would be pure waste.
    shutil.copytree(ROOT / name, OUT / name,
                    ignore=shutil.ignore_patterns("fonts"))

# Root-level files that must keep their exact path. favicon.ico in particular:
# browsers request /favicon.ico blind, without reading any <link> tag.
for name in ("favicon.ico",):
    src = ROOT / name
    if src.exists():
        shutil.copy2(src, OUT / name)
    else:
        raise SystemExit(f"missing root file: {name}")

# index.html carries __BASE__ placeholders in its canonical/OG tags so the
# deployed copy always points at itself.
index = (ROOT / "index.html").read_text(encoding="utf-8")
if "__BASE__" not in index:
    raise SystemExit("index.html has no __BASE__ placeholder — check its meta tags")
if "WEB3FORMS_ACCESS_KEY" in index:
    raise SystemExit(
        "the reading form still has the placeholder access key.\n"
        "  Get a free key at https://web3forms.com (enter your email, they send it back)\n"
        "  and paste it into index.html. Shipping the placeholder means every reading\n"
        "  request silently vanishes — worse than having no form at all."
    )
(OUT / "index.html").write_text(index.replace("__BASE__", BASE), encoding="utf-8")

# Jekyll would otherwise ignore files/folders it doesn't like.
(OUT / ".nojekyll").write_text("")
if CNAME_FILE.exists():
    shutil.copy2(CNAME_FILE, OUT / "CNAME")

# --- per-quote share pages ------------------------------------------------
qdir = OUT / "q"
qdir.mkdir()
urls = [f"{BASE}/"]


def app_page(canonical, title, desc, og):
    """The real app, with this passage's preview tags.

    Served at /q/<id>/ and /poem/<id>/ as well as /. That's what lets the
    address bar hold a URL people can copy straight into a chat: it's a real
    page a crawler can fetch, AND the working site. A "#q=" fragment never
    reaches the server, so it can only ever preview as the homepage — which is
    exactly what happened when the first link went out on WhatsApp."""
    p = index
    p = p.replace('<link rel="canonical" href="__BASE__/" />',
                  f'<link rel="canonical" href="{canonical}" />')
    p = p.replace('<meta property="og:url" content="__BASE__/" />',
                  f'<meta property="og:url" content="{canonical}" />')
    p = p.replace('<meta property="og:image" content="__BASE__/assets/og-default.png" />',
                  f'<meta property="og:image" content="{og}" />\n'
                  f'    <meta property="og:image:width" content="1200" />\n'
                  f'    <meta property="og:image:height" content="630" />')
    p = re.sub(r'<meta\s+property="og:title"\s+content="[^"]*"\s*/>',
               f'<meta property="og:title" content="{title}" />', p, count=1)
    p = re.sub(r'<meta\s+property="og:description"\s+content="[^"]*"\s*/>',
               f'<meta property="og:description" content="{desc}" />', p, count=1)
    p = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/>',
               f'<meta name="description" content="{desc}" />', p, count=1)
    p = p.replace('<title>I came to be free — Poems by PJ Starling</title>',
                  f'<title>{title}</title>')
    return p.replace("__BASE__", BASE)


def write_quote_page(qid, lines, poem_title):
    og = og_for(qid, lines)            # the card itself, as the preview image
    plain = [strip_md(l) for l in lines]
    canonical = f"{BASE}/q/{qid}/"
    page = app_page(
        canonical,
        html.escape(f"“{plain[0]}…” — {book['author']}"),
        html.escape(" / ".join(plain)),
        og,
    )
    d = qdir / qid
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(page, encoding="utf-8")
    urls.append(canonical)


# the curated passages (their ids are already in the wild — never rename)
for q in data["quotes"]:
    write_quote_page(q["id"], q["lines"], poems[q["poem"]]["title"])

# every stanza in the book, so a reader can share the one that got them
seen = {q["id"] for q in data["quotes"]}
for p in full["poems"]:
    for s in p["stanzas"]:
        if s["id"] in seen:
            raise SystemExit(f"stanza id collides with a curated quote id: {s['id']}")
        write_quote_page(s["id"], s["lines"], p["title"])

# ---- one page per poem: the app, with the poem's preview tags -------------
pdir = OUT / "poem"
pdir.mkdir()
for p in full["poems"]:
    first = [strip_md(l) for l in p["stanzas"][0]["lines"]]
    og = og_for("poem-" + p["id"], p["stanzas"][0]["lines"])
    canonical = f"{BASE}/poem/{p['id']}/"
    page = app_page(
        canonical,
        html.escape(f"{p['title']} — {book['author']}"),
        html.escape(" / ".join(first)),
        og,
    )
    d = pdir / p["id"]
    d.mkdir()
    (d / "index.html").write_text(page, encoding="utf-8")
    urls.append(canonical)

# --- sitemap / robots / 404 ----------------------------------------------
sitemap = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
(OUT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f"{sitemap}\n</urlset>\n",
    encoding="utf-8",
)
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
(OUT / "404.html").write_text(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    '<title>Not found — I came to be free</title>'
    f'<link rel="stylesheet" href="{BASE}/assets/site.css"></head>'
    '<body><main class="about"><h2>This page came to be free</h2>'
    '<p>It wandered off. The poems are still here.</p>'
    f'<p><a class="btn" href="{BASE}/">Back to the quotes</a></p></main></body></html>',
    encoding="utf-8",
)

nstanza = sum(len(p["stanzas"]) for p in full["poems"])
print(f"built _site/ — {len(data['quotes'])} curated + {nstanza} stanza pages, "
      f"{len(full['poems'])} poem pages, domain {domain}")
