#!/usr/bin/env python3
"""Assemble _site/ for GitHub Pages.

The site itself is plain static files — this script only adds the things that
have to exist as real URLs on disk:

  /q/<id>/index.html   one page per quote, carrying the quote in its OG tags so
                       that pasting the link into a chat or social app shows the
                       words. It then bounces the reader to /#q=<id>.
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
    shutil.copytree(ROOT / name, OUT / name)

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
(OUT / "index.html").write_text(index.replace("__BASE__", BASE), encoding="utf-8")

# Jekyll would otherwise ignore files/folders it doesn't like.
(OUT / ".nojekyll").write_text("")
if CNAME_FILE.exists():
    shutil.copy2(CNAME_FILE, OUT / "CNAME")

# --- per-quote share pages ------------------------------------------------
PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{base}/q/{qid}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{book}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}/assets/og-default.png">
<meta property="og:url" content="{base}/q/{qid}/">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{base}/favicon.ico" sizes="any">
<link rel="icon" href="{base}/assets/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0b0b0d">
<meta http-equiv="refresh" content="0; url={base}/#q={qid}">
<link rel="stylesheet" href="{base}/assets/site.css">
</head>
<body>
<main class="about">
  <blockquote><p style="font-family:var(--display);font-size:1.4rem;line-height:1.8">{lines_html}</p></blockquote>
  <p>— {author}, <em>{book}</em>, from “{poem}”</p>
  <p><a class="btn" href="{base}/#q={qid}">Open on the site</a></p>
</main>
<script>location.replace({redirect});</script>
</body>
</html>
"""

qdir = OUT / "q"
qdir.mkdir()
urls = [f"{BASE}/"]


def write_quote_page(qid, lines, poem_title):
    lines = [strip_md(l) for l in lines]
    page = PAGE.format(
        base=BASE,
        qid=qid,
        book=html.escape(book["title"]),
        author=html.escape(book["author"]),
        poem=html.escape(poem_title),
        title=html.escape(f"“{lines[0]}…” — {book['author']}"),
        desc=html.escape(" / ".join(lines)),
        lines_html="<br>".join(html.escape(l) for l in lines),
        redirect=json.dumps(f"{BASE}/#q={qid}"),
    )
    d = qdir / qid
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(page, encoding="utf-8")
    urls.append(f"{BASE}/q/{qid}/")


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

# ---- one page per poem, for sharing a whole poem as a link ----------------
POEM_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — {author}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{base}/poem/{pid}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{book}">
<meta property="og:title" content="{title} — {author}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}/assets/og-default.png">
<meta property="og:url" content="{base}/poem/{pid}/">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{base}/favicon.ico" sizes="any">
<link rel="icon" href="{base}/assets/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0b0b0d">
<meta http-equiv="refresh" content="0; url={base}/#poem={pid}">
<link rel="stylesheet" href="{base}/assets/site.css">
</head>
<body>
<main class="about">
  <h2>{title}</h2>
  <blockquote><p style="font-family:var(--display);font-size:1.25rem;line-height:1.85">{first}</p></blockquote>
  <p>— {author}, <em>{book}</em></p>
  <p><a class="btn" href="{base}/#poem={pid}">Read the poem</a></p>
</main>
<script>location.replace({redirect});</script>
</body>
</html>
"""

pdir = OUT / "poem"
pdir.mkdir()
for p in full["poems"]:
    flat = [strip_md(l) for s in p["stanzas"] for l in s["lines"]]
    first = [strip_md(l) for l in p["stanzas"][0]["lines"]]
    page = POEM_PAGE.format(
        base=BASE,
        pid=p["id"],
        book=html.escape(book["title"]),
        author=html.escape(book["author"]),
        title=html.escape(p["title"]),
        desc=html.escape(" / ".join(flat[:4])),
        first="<br>".join(html.escape(l) for l in first),
        redirect=json.dumps(f"{BASE}/#poem={p['id']}"),
    )
    d = pdir / p["id"]
    d.mkdir()
    (d / "index.html").write_text(page, encoding="utf-8")
    urls.append(f"{BASE}/poem/{p['id']}/")

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
