# icametobefree.com

Promo site for **I came to be free** — poems by PJ Starling (FriesenPress, 2026).

The site shows **one passage at a time**, rendered as the actual share card you'd
send. "Another passage" draws the next. The full library of 59 sits behind a
link. See [PLAN.md](PLAN.md) for the reasoning behind every choice here.

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
assets/site.js        the draw deck, the stage, the library, share actions
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

The domain is **icametobefree.xyz**, set in the `CNAME` file at the repo root.
That file is the single source of truth: `build.py` reads it and rewrites every
canonical and OG URL, and GitHub reads it to route the domain. To move the site
to a different domain, change that one file — don't hunt for hardcoded URLs,
there aren't any.

(`starlingpoetry.xyz` is also registered, for an author site later. A Pages site
takes only one custom domain, so it isn't pointed here.)

At the registrar, point DNS at GitHub:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |
| CNAME | www | `paul-jean.github.io.` | 3600 |

All four A records — they're GitHub's load balancers, not alternatives. The
`www` CNAME value is the *user* domain (`paul-jean.github.io`), not the project
path; GitHub works out the repo from the CNAME file.

Then point GitHub at it. The order matters, and there's one trap:

```bash
gh api -X PUT repos/paul-jean/icametobefree/pages -f cname=icametobefree.xyz
gh workflow run deploy.yml && gh run watch     # ← don't skip this
gh api -X PUT repos/paul-jean/icametobefree/pages -F https_enforced=true
```

**The trap:** setting `cname` resets the Pages deployment state to
`"status": null`. With `build_type: workflow`, GitHub does *not* republish on its
own — so the domain resolves, hits GitHub, and gets GitHub's own 404 ("There
isn't a GitHub Pages site here") because no build is attached to it. It looks
exactly like a DNS or domain failure and is neither. Re-running the workflow
attaches the build and fixes it. Check the state any time with:

```bash
gh api repos/paul-jean/icametobefree/pages
```

`status: null` means "needs a deploy". `cname` shows the domain GitHub thinks it
owns, and `https_certificate.state` tells you whether HTTPS can be enforced yet.

**Note the flags:** `-f` sends strings, `-F` converts types. `cname` is a string
so `-f` is right; `https_enforced` is a boolean and needs `-F`, or you get a 422.

Without a `CNAME` file the site falls back to `paul-jean.github.io/icametobefree/`
automatically — nothing breaks, the URLs just change.

## Notes for future-you

- **The site's own URL is never hardcoded.** `build.py` works it out: a `CNAME`
  file wins, else it derives the real Pages URL from `$GITHUB_REPOSITORY`, else
  (local preview) it falls back to relative. `index.html` uses a `__BASE__`
  placeholder that gets substituted at build time — that's why you should
  preview via `_site/`, not by opening `index.html` directly. Don't put a guessed
  domain in that fallback: a wrong base bakes dead canonical URLs and dead
  redirects into all 59 quote pages.

- **The canvas needs the webfont loaded** before it draws, or cards silently
  render in Times. `site.js` waits on `document.fonts.ready` — don't remove that.

- **"Another passage" deals from a shuffled deck**, it doesn't pick at random.
  Random repeats often enough to look broken. The deck reshuffles only when all
  59 are spent, and guards against the reshuffle repeating the passage still on
  screen. If you change this, keep both properties.
- **Card layout auto-fits**: `card.js` shrinks the type until the block fits both
  axes. Long lines therefore make *everything* smaller, not just that line.
- **OG images are one shared image**, not per-quote — the quote text itself is in
  the OG description. Per-quote preview images would need image generation in CI;
  worth it only if link previews become a main channel.
