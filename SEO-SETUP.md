# Getting *I came to be free* into Google

The site's whole SEO problem right now is simple: **Google hasn't indexed it.** A `site:icametobefree.xyz` search returns nothing. It's a two-month-old domain that Google hasn't discovered or trusted yet. Nothing below matters as much as Part 1 — everything else is amplification.

I've already done the on-page technical work (see the last section). The steps here are the parts that need *your* Google/Bing accounts — I can't log in as you, but each step is spelled out.

---

## Part 1 — Google Search Console (do this first; ~15 min)

This is the single highest-impact action. It tells Google the site exists, hands it your sitemap of 211 pages, and lets you *request indexing* directly instead of waiting weeks to be found.

### 1a. Create the property

1. Go to **search.google.com/search-console** and sign in with your Google account.
2. Click **Add property** (top-left dropdown).
3. Choose the **Domain** option (the left box, not "URL prefix"). Enter `icametobefree.xyz` and click **Continue**.
4. Google shows you a **TXT record** to add to your DNS — a string like `google-site-verification=AbC123…`. Copy it. Leave this tab open.

*Why Domain and not URL-prefix: a Domain property covers every version of the site at once — www and non-www, http and https, and all 211 sub-pages — so nothing falls through a crack.*

### 1b. Add the TXT record at Namecheap

You've done this dance before with the A records. Same place:

1. Namecheap → **Domain List** → **Manage** next to `icametobefree.xyz` → **Advanced DNS**.
2. **Add New Record** → type **TXT Record**.
3. **Host:** `@`
4. **Value:** paste the whole `google-site-verification=…` string.
5. **TTL:** Automatic. Save (the green check).

Leave your existing A records and the `www` CNAME exactly as they are — this is an *additional* record, not a replacement.

### 1c. Verify

Back in the Search Console tab, click **Verify**. If it fails, it's almost always just DNS propagation — wait 10–30 minutes and click Verify again. (Recall the earlier lesson: one resolver lagging isn't failure. Give it time before assuming something's wrong.)

### 1d. Submit the sitemap

Once verified: left sidebar → **Sitemaps** → under "Add a new sitemap" enter `sitemap.xml` → **Submit**. That single file lists all 211 URLs. Status should move to "Success" within a day.

### 1e. Request indexing for the homepage

Top search bar in Search Console → paste `https://icametobefree.xyz/` → Enter → **Request indexing**. This pushes the homepage to the front of Google's crawl queue, often indexed within a few days. You can do this for a handful of key pages (the homepage, and maybe two or three favourite `/poem/` pages) — there's a daily quota, so don't try to do all 211; the sitemap handles the rest.

---

## Part 2 — Bing Webmaster Tools (~5 min, worth it)

Bing powers Bing *and* a lot of AI search (Copilot, and some of what ChatGPT surfaces). It has a shortcut:

1. Go to **bing.com/webmasters** and sign in.
2. Choose **Import from Google Search Console** — it pulls the property and verification across in one click, no second DNS record needed.
3. Confirm the sitemap is listed; if not, add `https://icametobefree.xyz/sitemap.xml`.

---

## Part 3 — Backlinks (the ongoing lever)

New domains rank on *trust*, and trust comes from other reputable sites linking to yours. You already have the accounts — you just need each to point at `icametobefree.xyz`. In rough order of value:

- **FriesenPress author page** — add the site as your author website. Their domain has real authority; a link from it matters most.
- **Goodreads author profile** (the one you're claiming, id 70935940) — there's a website field.
- **Amazon Author Central** — set up an author page for PJ Starling; it has a website link and feeds your book listings.
- **poets.ca profile** — once your membership is active, add the site.
- **Your social profiles** — Instagram/X/LinkedIn bio links, wherever you post as PJ Starling.
- **Art of Autism** — if they feature you, ask them to link the site (not just name it).

Five or six links from those would do more than any further on-page tweak. They don't have to happen at once — add them as you go.

---

## What to expect

This is a slow cooker, not a switch. Realistic timeline after you finish Part 1:

- **Days:** homepage indexed (you can watch it in Search Console → Pages).
- **1–3 weeks:** the poem and passage pages get crawled and indexed; you start appearing for branded searches like *"i came to be free pj starling"* and *"pj starling poems."*
- **Weeks–months:** ranking climbs as backlinks accrue and Google sees real traffic.

One honest expectation to set: the bare phrase *"i came to be free"* competes with a Sam Smith song and generic usage — you may never top *that* exact query, and it's the wrong thing to chase. The winnable, valuable goal is owning every **branded** search for your book and being the official result above the FriesenPress store page. Watch Search Console's **Performance** tab to see which queries actually bring people in — that's real data instead of guessing.

---

## What I already changed on the site (technical SEO)

So you know what's deployed and why:

1. **Crawlable poem text.** Every page's poems were previously drawn on a canvas and injected by JavaScript — invisible to crawlers, so your 211 pages looked like identical empty shells (likely *why* Google was reluctant to index them). Each `/q/` and `/poem/` page now carries the actual passage or poem as real, unique HTML text. The homepage now carries the complete text of all nine poems.
2. **Structured data (JSON-LD).** Every page now includes schema.org markup identifying the site as the official page for the *Book* "I came to be free" by the *Person* PJ Starling, with ISBNs, publisher, and buy link. This helps Google understand the site is authoritative for your book — and outrank the store page for it.
3. Titles, meta descriptions, canonical tags, `robots.txt`, and the 211-URL `sitemap.xml` were already correct and are unchanged.

These shipped in the same push as this guide. The build refuses to deploy if any page is missing its structured data or poem text, so the "empty shell" problem can't silently return.
