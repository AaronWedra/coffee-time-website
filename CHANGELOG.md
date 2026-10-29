# Changelog

## 2026-10-29: analytics notice and privacy page
- A small bar (inside the GA snippet, so only where Analytics loads) says the site uses Google Analytics, with No thanks and OK. No thanks is remembered in localStorage, sets ga-disable before gtag config and deletes the _ga cookies. Same wording as every Smartz site.
- New /privacy page (copy editable in HQ > Page copy, migration 0005), footer link, sitemap entry. "Change my analytics choice" re-asks.
- GA config now sets Google signals and ad personalisation off (what the privacy page promises); CSP also allows analytics.google.com, the second GA4 transport host. Smoke 125/125.

## 2026-10-25: punch list is AI first
- Aaron's rule: Claude handles the vast majority of the punch list. Decisions with an obvious answer (requests vs card payments, shipping quotes) are now made and closed; the rest are owned by Claude, and only account logins, files only he has and the registrar click stay with Aaron.
- Edit website re-issues the session cookie site-wide, so a login made before the pencil shipped still gets it.

## 2026-10-25: HQ rebuilt on the Zombie Bike Parade pattern
- Edit website: the sidebar button browses the real site with a pencil in the corner. Click it to file a change
  against the page you are on (paste or drag a screenshot, or "Point at it" to name the exact element). Only
  staff with a session and the 8-hour review cookie ever get the script; those pages are never cached.
- Requests board (/hq/requests): threads, replies that ask a question, "X is on it" pickup, statuses, prev/next
  with arrow keys, screenshots and PDFs stored in R2 (bucket coffee-time-media).
- Punch list (/hq/punchlist): what is left, with a recommendation on each question, agree or answer, notes,
  pick up, promote to a request thread, progress bar.
- Grouped sidebar with orange new/total badges, dark mode, a ? bubble on every HQ page, dashboard cards for
  requests and punch list, What's new, Sent email.
- Hourly watchdog flags requests the team has not answered in 3 hours (dashboard banner only, no email).

## 2026-10-25: start over from the real site and the real assets
- Threw out the invented structure (Five Worlds page, clock hero and clock logo, fact shields, "From the box",
  "pick a side", lessons). The site now mirrors playcoffeetime.com section for section: Learn to play like a
  pro, Newsletter, Video game, HMP Bikes + coloring page, the characters' stage, Warp World Music, Orders
  (Purple Tree, What's in the Box), Meet the Creators, Reviews; pages Story, Arcade, News, Video Tutorials, FAQ.
- Real brand assets throughout: the Coffee Time wordmark (purple in the header, white in the footer), the Wix
  gradient starfield, the item-card orbs floating at the margins, Don-Floating, the Deep Space Kruiser, the
  characters stage on the peach band, the box dieline, the board, every story page, the creator headshots.
  No generated artwork anywhere.
- All 46 tutorial videos, 23 reviews, 12 SoundCloud tracks, 8 FAQ answers, 7 news items and 6 creator bios
  copied from the live site (em dashes replaced, house rule).
- The three PDFs and the trailer (re-encoded to 18 MB, 720p) are now served from this site, not Wix.
- Newsletter sign-up form writes to a subscribers table; HQ > Newsletter lists it with a CSV download.
- Order request form kept (at the end of the Orders section and at /order); contact form and HQ messages
  dropped, the site uses the email address like the old one did.
- Fonts: Anton (for Impact), Jost (for Brandon Grotesque), Bree Serif (for the review quotes).
- Subtle effects only: hero rise-in, floating orbs, review-card lift, character watermarks on the review
  cards, coloring-page tilt. CSS only, reduced motion respected.
- Links in HQ copy: [words](url). Smoke test: 84 checks. scripts/shots.mjs for screenshots.


## 2026-10-24: 2026 rebuild (branch redesign-2026)
- Replaced the August/September static preview with the house pattern: Worker + D1 + HQ.
- New design from the game's own material: box purple, board brown, World Clocks hero, box-side fact shields.
- Self-hosted fonts (Anton, Lexend). Images converted to WebP: 34 MB library down to about 4 MB.
- Pages: home, Five Worlds (with the 8-page illustrated story), How to play (20 lessons + rules FAQ),
  video game, music, community and reviews, news, order, contact, 404.
- Order request form with HQ order tracking (New, Emailed, Paid, Shipped, Cancelled) and email alerts.
- Contact form into an HQ inbox. Honeypot, timing check and rate limits on both forms.
- Everything editable in HQ: game details, page copy, worlds, characters, lessons, FAQ, reviews, news, music, games.
- Old Wix and preview URLs redirect permanently (/rules, /faq, /story, /arcade, /reviews, /pre-order and more).
- Hidden from search engines until cutover. 77-check smoke test.
- Hero rebuilt as a layered scene of the original character cutouts around King Tea (CSS bob + pop-in), CSS star/ring backdrop. Scroll-driven section reveals, cross-page view transitions, hover depth on the box and world cards. All CSS, no JavaScript, reduced motion respected.
- 2026-10-25: D1 database coffee-time created; id set in wrangler.jsonc.
- 2026-10-25: Deployed. Worker coffee-time is live at https://coffee-time.smartzgraphics.workers.dev (Workers Builds on push to main). HQ_SETUP_TOKEN secret and /hq/setup still to do.

- 2026-10-25: Cutover. playcoffeetime.com and www now served by the coffee-time Worker (removed from coffee-time-preview). workers_dev pinned true. Wix plan cancelled, auto-renew off.

- 2026-10-29: Google Analytics 4. HQ > Settings > Google Analytics takes a Measurement ID; the tag and CSP entries appear only when it is set.

- 2026-10-29: Migration 0004 sets ga4_id to G-25HJXMDMHZ (GA4 property "Coffee Time (playcoffeetime.com)" in the Smartz Graphics Analytics account) while blank.
