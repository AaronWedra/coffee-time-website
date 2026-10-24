# Coffee Time (playcoffeetime.com rebuild, 2026)

The website for Coffee Time, the board game by Aaron Wedra and Stevie Price (Davis, CA), moving off Wix.
Same pattern as Sara Ruebelt Therapy, the Zombie Bike Parade and the other current Smartz sites: one
Cloudflare Worker, one D1 database, static assets in the same deploy, a team backend ("HQ") at `/hq`,
GitHub as the backup. Built 2026-10-24 for Aaron Wedra (Smartz Graphics, smartzgraphics@gmail.com).

- **Repo:** AaronWedra/coffee-time-website. The 2026 rebuild is on branch `redesign-2026`. `main` still
  holds the August/September 2026 attempt (static pages, Worker `coffee-time-preview`); it is
  superseded by this branch and kept only as history.
- **Cloudflare:** Worker `coffee-time`, D1 `coffee-time` (not created yet; see Deploying).
- **Live site (target):** https://www.playcoffeetime.com. Wix is still serving it until DNS moves.
- **HQ:** /hq (log in by first name; the first admin is created once at /hq/setup with HQ_SETUP_TOKEN).

## Stack

No framework, zero runtime dependencies, about 1,600 lines of TypeScript. Imports use explicit `.ts`
extensions so Node 22.18+ can run the source directly for local work (no bundler); Cloudflare bundles
it on deploy.

```
src/worker.ts          entry: static assets first, then /hq, then the site. Security headers + nonce CSP.
src/lib/html.ts        html`` tagged template (escapes by default), raw(), paragraphs(), richText()
src/lib/router.ts      Router with :params, redirect/page/text/json helpers, formData(), cookies, Env
src/lib/db.ts          every D1 query
src/lib/auth.ts        PBKDF2 (100k, the Workers maximum) passwords, D1 sessions, CSRF per session
src/lib/email.ts       THE ONE email seam. Writes an outbox row, sends via Resend only if configured.
src/site/layout.ts     <html> shell, header/nav/footer, SEO meta, the clock SVG, fact shields
src/site/pages.ts      every public page as a function
src/site/routes.ts     routes, old URL redirects (keep forever), order + contact POSTs, sitemap, robots
src/hq/routes.ts       HQ: dashboard, orders, messages, game details, page copy, list editors, settings
public/                site.css (design), hq.css, img/ (webp), fonts/ (self-hosted, OFL), favicon, og.jpg
db/migrations/         schema
db/make-seed.py        GENERATES db/seed.sql (all starting content). INSERT OR IGNORE: never overwrites HQ edits.
scripts/dev-server.mjs local server without wrangler: node:sqlite stands in for D1
scripts/smoke.mjs      77-check end-to-end test (pages, redirects, order + contact forms, spam traps, HQ)
```

Commands: `npm run dev` (http://127.0.0.1:8788, fresh in-memory DB, HQ setup phrase `dev`),
`npm run smoke` (with dev running), `npm run check` (tsc), `npm run build` (bundles SQL), `npm run deploy`.

## Ground rules

- **Content is data.** Price, email, links, every block of copy, worlds, characters, lessons, FAQ,
  reviews, news, tracks and games live in D1 and are edited in HQ. Do not hard-code words into templates.
- **Orders are requests, not payments.** The order form stores a row in `orders` and emails the team.
  Nothing is charged online; the team emails the buyer to settle shipping and payment, then moves the
  order through New, Emailed, Paid, Shipped in HQ. If online payment is ever wanted, add it as a new
  step; do not remove the request flow.
- **Email is one seam** (`src/lib/email.ts`). Without RESEND_API_KEY + MAIL_FROM every email is marked
  `simulated` and the order or message still lands in HQ.
- **Hidden from search engines** (`settings.site_indexable = '0'`) until DNS points here. Flip it once
  in HQ > Settings after cutover.
- **Never run smoke.mjs against a deployed site.** It refuses workers.dev and playcoffeetime.com on purpose.
- **Public forms:** honeypot `website`, timing field `_t`, per-IP rate limit. They work without JavaScript.
- No JavaScript on the public site at all. Mobile nav is `<details>`; the clock animation is CSS.
- No em dashes anywhere in copy, code comments or UI (Smartz house convention). The seed script asserts it.
- Commit after every meaningful change. CHANGELOG.md gets a line per functional change.

## Facts that are easy to get wrong

- Price $39.99, first edition. 2 to 6 players, ages 8+, about 60 minutes (from the box's side badges).
- Contents (from the Wix order page): 20x20 board with moveable clock hands; 59 Journey Cards (18 unique
  Journey types x3 = 54, 2 King's Cards x2 = 4, 1 Card Protector); 19 Roamer Cards; 6 Player Cards; 6
  pieces; d4, d8, d10, d12; instructions + story; first-edition patch with 4 extra cards.
- Six Player Cards = four heroes (Cup Joe, Thermos, Little Miss Hot Shot, Donette) + King Tea + Roamer.
- King Tea needs 60 hours: 12 per world, Coffee > Donut > Warp > Crumpet > Tea.
- Credits (box): designed by Aaron Wedra and Stevie Price; art contributions Landon Christensen and Sam
  Lundholm; edited by Milly Judd; music by Matthew Wright (custom music with eNuminous and Archimedes).
- Video game: Nick Domke leads the game club; Milly Wedra voices Little Miss Hot Shot. Demo on itch.io.
- 5% of every sale goes to Purple Tree Café (Davis nonprofit). HMP Bikes (440 F St, Davis) sponsors.
- Email: playcoffeetime@yahoo.com. Facebook profile id 100083230971672.
- **The three PDFs (rulebook, story, coloring page) are still hosted on Wix** (settings rules_pdf,
  story_pdf, coloring_pdf). Before Wix is cancelled: download them, put them in public/files/, and change
  the three links in HQ > Game details to /files/<name>.pdf.

## Design

Palette from the game itself: box purple, the board's coffee-brown swirl, white clock faces, King
Tea's crown yellow for every primary action, the board's path colors (pink, red, blue) for the heroes.
Anton for display (it matches the box wordmark), Lexend for reading. Both self-hosted as woff in
public/fonts (the August attempt referenced fonts it never loaded). The memorable element is the board's
five World Clocks: on the home page their hands sweep once, world by world, the way King Tea advances
them, stopping with Crumpet World at nine and Tea World untouched. Reduced motion shows the end state.
Fact badges are the brown shields from the side of the box. Character art in public/img are cutouts
(the video-game renders had flat grey backgrounds, removed). The whole image library is ~4 MB (was 34 MB).

## Deploying (first time), same as Sara's site

1. Cloudflare dashboard > D1 > create database `coffee-time`; paste its id into wrangler.jsonc.
2. Workers & Pages > create > import the GitHub repo (branch: whichever is the production branch once
   `redesign-2026` is merged), build command `npm run build`, deploy command `npx wrangler deploy`.
3. Worker > Settings > Variables: add secret HQ_SETUP_TOKEN (any phrase). Optional: RESEND_API_KEY, MAIL_FROM.
4. Open https://coffee-time.<account>.workers.dev; the Worker creates and seeds its own database on the
   first request. Then /hq/setup, type the phrase, create the first admin.
5. Check every page. Then retire the old `coffee-time-preview` Worker.
6. Cutover: add playcoffeetime.com to Cloudflare, point nameservers there, uncomment `routes`, set
   SITE_URL, push; HQ > Settings > let search engines index the site. Then cancel Wix (PDFs first!).

## Current state (2026-10-24)

Built end to end in one session. `npm run smoke`: 77/77. Screenshots reviewed at desktop and phone width
for every page and HQ. NOT deployed: this session had no npm registry access and no push access to the
repo (the Claude GitHub app does not cover it), so the branch exists locally in the session and as a
bundle; see docs/HANDOFF.md.
