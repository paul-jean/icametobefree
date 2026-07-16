# icametobefree.com

Promo site for **I came to be free** — poems by PJ Starling (FriesenPress, 2026).

The site's one job: let a reader turn any passage into a shareable image card in
a few taps. See [PLAN.md](PLAN.md) for the reasoning behind every choice here.

## Run it locally

The page fetches `data/quotes.json`, so opening `index.html` straight off the
disk won't work — it needs a server. Any of these:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

To preview exactly what gets deployed, including the per-quote share pages:

```bash
python3 scripts/build.py
cd _site && python3 -m http.server 8000
```

No npm, no build step, no dependencies. It's HTML, CSS, and one JS file.

## Add or change a quote

1. Open `data/quotes.json`, add an entry to `quotes`:

   ```json
   {
     "id": "nut-6",
     "poem": "the-nutshell",
     "themes": ["freedom"],
     "lines": ["You bounced off the walls", "In your room full of doors"]
   }
   ```

   - `id` — lowercase, hyphens only. **It becomes the URL** (`/q/nut-6/`), so once
     a quote has been shared, don't rename it or you'll break every link out there.
   - `poem` — must match an `id` in the `poems` array.
   - `themes` — drives the filter chips. Reuse existing ones where they fit.
   - `lines` — one array entry per line, exactly as broken in the book. Use
     curly apostrophes (`’`), like the book does.

2. Check it: `python3 scripts/check.py`
3. Push. It's live in about a minute.

Keep passages to 8 lines or fewer — longer ones shrink the type on a card until
it's unreadable on a phone. `check.py` warns you.

## Layout

```
index.html            the whole site
assets/site.css       styles
assets/site.js        filtering, dialog, share actions
assets/card.js        canvas card renderer (no DOM deps — testable on its own)
assets/cover.jpg      front cover, cropped from the FriesenPress print PDF
assets/og-default.png 1200×630 link preview image
data/quotes.json      all content lives here
scripts/check.py      validates quotes.json — CI fails on error
scripts/build.py      assembles _site/: quote pages, sitemap, robots, 404
.github/workflows/    deploy on push to main
```

## Deploying

Pushing to `main` deploys. For the very first deploy, run:

```bash
bash scripts/deploy.sh
```

It validates the quotes, creates the repo, pushes, and switches Pages to the
Actions source. It's safe to re-run — it skips whatever's already done. Needs
the GitHub CLI (`brew install gh` && `gh auth login`).

If the push is rejected with `refusing to allow an OAuth App to create or
update workflow`, your token is missing the `workflow` scope:

```bash
gh auth refresh -h github.com -s workflow
```

<details>
<summary>Doing it by hand instead</summary>

1. Create the repo on GitHub and push this folder to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Wait for the green check in the Actions tab.

</details>

### Custom domain

1. Register the domain.
2. Create a `CNAME` file in the repo root containing just the domain:
   ```
   icametobefree.com
   ```
   `build.py` reads it and rewrites every canonical/OG URL to match — that's the
   only place the domain is configured.
3. At your registrar, point DNS at GitHub:

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | `<your-username>.github.io` |

4. **Settings → Pages → Custom domain**, enter it, and tick **Enforce HTTPS**
   once the certificate is issued (can take up to an hour).

Until you have a domain, the site works as-is at `<username>.github.io/<repo>/`.

## Notes for future-you

- **The canvas needs the webfont loaded** before it draws, or cards silently
  render in Times. `site.js` waits on `document.fonts.ready` — don't remove that.
- **Card layout auto-fits**: `card.js` shrinks the type until the block fits both
  axes. Long lines therefore make *everything* smaller, not just that line.
- **OG images are one shared image**, not per-quote — the quote text itself is in
  the OG description. Per-quote preview images would need image generation in CI;
  worth it only if link previews become a main channel.
