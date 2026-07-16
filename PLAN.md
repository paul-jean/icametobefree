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

Single page, four movements:

| Section | Job |
|---|---|
| Hero | Set the tone in three seconds. Cover typography, the opening stanza, one CTA down to the quotes. |
| **Quotes** | The site. 59 cards, filterable by poem and by theme (grief, love, hope, freedom, forgiveness, renewal), plus search and a "Surprise me" button. |
| The book | Cover, blurb, buy links. FriesenPress first — it pays you most. |
| About | Your bio, briefly. |

One page because 59 quotes don't justify navigation, and every extra click is a
place to lose someone.

### The share flow

Tap a card → a dialog renders a real image on a `<canvas>`:

- **Three shapes** — Square (Instagram feed), Story (9:16, Instagram/WhatsApp status), Wide (1200×630, link previews).
- **Two colourways** — Ink (the cover's black) and Cream (reads better in a light feed).
- **Four exits** — Download image, native Share sheet (mobile, shares the actual PNG), Copy text, Copy link.

Rendering happens in the browser. No server, no image API, no cost, works
offline once loaded, and there's no upload step between wanting to share and
sharing.

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
