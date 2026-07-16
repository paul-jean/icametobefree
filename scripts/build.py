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
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"

data = json.loads((ROOT / "data" / "quotes.json").read_text(encoding="utf-8"))
book = data["book"]
poems = {p["id"]: p for p in data["poems"]}

cname = ROOT / "CNAME"
domain = cname.read_text().strip() if cname.exists() else "icametobefree.com"
BASE = f"https://{domain}"

# --- copy the static site -------------------------------------------------
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

for name in ("index.html", "assets", "data"):
    src = ROOT / name
    if src.is_dir():
        shutil.copytree(src, OUT / name)
    else:
        shutil.copy2(src, OUT / name)

# Jekyll would otherwise ignore files/folders it doesn't like.
(OUT / ".nojekyll").write_text("")
if cname.exists():
    shutil.copy2(cname, OUT / "CNAME")

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

for q in data["quotes"]:
    text = "\n".join(q["lines"])
    desc = " / ".join(q["lines"])
    poem = poems[q["poem"]]["title"]
    page = PAGE.format(
        base=BASE,
        qid=q["id"],
        book=html.escape(book["title"]),
        author=html.escape(book["author"]),
        poem=html.escape(poem),
        title=html.escape(f"“{q['lines'][0]}…” — {book['author']}"),
        desc=html.escape(desc),
        lines_html="<br>".join(html.escape(l) for l in q["lines"]),
        redirect=json.dumps(f"{BASE}/#q={q['id']}"),
    )
    d = qdir / q["id"]
    d.mkdir()
    (d / "index.html").write_text(page, encoding="utf-8")
    urls.append(f"{BASE}/q/{q['id']}/")

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

print(f"built _site/ — {len(data['quotes'])} quote pages, domain {domain}")
