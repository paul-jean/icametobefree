# I came to be free — site plan

## The one job

A reader finds a line that lands for them, and shares it in under ten seconds
without needing an account, an app, or a thought about how.

Everything else — the buy links, the bio, the cover — is secondary furniture.
If a decision makes sharing slower, it loses.

## Why sharing is the strategy

Poetry doesn't sell through ads; it sells through a friend sending you four
lines at the right moment. Your own words for it:

> "When a poem reaches your heart, it stays there. It changes you. And when you
> share the poem, you share a piece of your heart along with it."

So the site is built as a **quote engine with a bookstore attached**, not a
bookstore with quotes attached. Every shared card carries your name, the book
title, and the domain — the marketing rides along inside the thing people
actually want to send.

## What's on the site

59 curated passages from all 9 poems — roughly 4–10 per poem, chosen as
self-contained stanzas that survive without their context. That's enough to
give the book away as feeling while keeping it intact as an object. A reader
who loves three cards wants the other 35 pages.

**Not included:** full poem texts. You can change this later by adding a
`full_text` field per poem — the data file is built to allow it.

### Structure

Single page, built around one passage at a time:

| Section | Job |
|---|---|
| **The stage** | The site. One randomly drawn passage, rendered as the actual share card. "Another passage" draws the next. Share actions sit right under it. |
| The library | Behind a "See all 59 passages" link. The filterable grid, for people hunting a specific line. Hidden by default. |
| The book | Cover, blurb, buy links. FriesenPress first — it pays you most. |
| About | Your bio, briefly. |

**Why one at a time.** A grid of 59 asks the reader to choose, and choosing is
work — most people skim a wall of stanzas and take none of them. A single
passage asks nothing. You read four lines, and either they land or you tap for
another. It turns browsing into something closer to how poetry actually reaches
people: one thing at a time, unhurried, until one of them stops you.

It also makes the site re-visitable. A grid is exhausted in one sitting; a draw
is different every time you open it.

### The share flow

**What you see is the image you'd send.** The passage on screen isn't styled
HTML that later becomes a card — it *is* the `<canvas>` card, rendered live. No
dialog, no preview step. Share, Download, Copy act on exactly what's in front of
you.

- **Three shapes**, under "Card options" — Square (Instagram feed), Story (9:16, status), Wide (1200×630, link previews).
- **Two colourways** — Ink (the cover's black) and Cream (reads better in a light feed).
- **Four exits** — Download, native Share sheet (mobile, shares the real PNG), Copy text, Copy link.

Rendering happens in the browser. No server, no image API, no cost, and no
upload step between wanting to share and sharing.

**Drawing without repeats.** The refresh deals from a shuffled deck rather than
picking at random, reshuffling only when all 59 are spent. True random repeats
often enough to feel broken — you press "Another" and get the same lines back,
and the site looks lazy. Verified over 400 draws: every passage shown, no
passage ever twice in a row.

Every quote also gets a real URL (`/q/wlng-1/`) generated at build time, with
the words in its OpenGraph tags — so pasting a link into Messages or Slack
shows the poem, not just a title. Those pages bounce to the main site.

## Design direction

Taken from your cover, not invented:

- **Black field, cream type.** The cover is chains on black; the site is the same room.
- **Cormorant Garamond**, wide-tracked caps for the title, exactly as the cover sets it.
- **Restraint.** No stock photos of sunsets, no gradients pretending to be depth. The words carry it. A single faint light from above is the only ornament — it's the spark in the void.
- **Cards look like the book**, so a shared image reads as *an object from somewhere* rather than a text post.

## Deployment

GitHub Pages, deploying on `git push` to `main`. Free, static, nothing to
maintain, no server to be hacked or to expire.

```
push to main → Actions:
    scripts/check.py   validate quotes.json (blocks a bad deploy)
    scripts/build.py   assemble _site/ + per-quote OG pages + sitemap
  → deploy to Pages
```

Adding a quote is a two-line edit to `data/quotes.json` and a push. No build
tooling, no `npm install`, no framework to age out from under you.

### Domain

**icametobefree.xyz** (registered July 2026), set in the `CNAME` file at the repo
root — the single place the domain is configured.

Two domains exist, with one job each:

| Domain | Role |
|---|---|
| `icametobefree.xyz` | This site. Matches the book, so every share card is stamped with the title a reader is holding. |
| `starlingpoetry.xyz` | Reserved for an author site spanning all the books. Not pointed here — a Pages site takes only one custom domain. |

That split is the right way round for this project: the cards carry the book,
and the author domain is free to become a home for the next one without moving
this site or breaking any link already in the wild.

Two things to keep an eye on:

- **`.xyz` is cheap, which is why spammers like it.** A few corporate mail filters and link scanners treat the whole TLD with suspicion. It won't affect Instagram or texting, but if you ever email links to bookstores or reviewers, watch for silence that isn't really silence.
- **Renewals — this one is not hypothetical.** `rule146.com` lapsed, was re-registered by a spam operation, and quietly inherited every visitor to `paul-jean.github.io` for months. Once quote cards are circulating with `icametobefree.xyz` printed on them, they can't be recalled, and a lapse hands that audience to whoever registers next. Auto-renew on, card on file current, on both domains.

## Deliberately not doing

- **Analytics.** Adds a cookie banner and a privacy policy to a poetry site. If you want numbers later, use a cookieless one (Plausible, GoatCounter).
- **A mailing list.** Real value, but it's a second job. Add it when you have a third book to announce.
- **Comments.** Someone has to moderate them.
- **Full-text poems.** See above — reversible whenever you want.

## Later, if you want it

- Reader-submitted photos of the book in the wild
- Audio of you reading each poem (poetry's best format, and it's free to make)
- A "quote of the day" that gives people a reason to come back
