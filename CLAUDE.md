# Coffee Time (playcoffeetime.com rebuild, 2026)

The website for Coffee Time, the board game by Aaron Wedra and Stevie Price (Davis, CA), moving off Wix.
Same pattern as Sara Ruebelt Therapy, the Zombie Bike Parade and the other current Smartz sites: one
Cloudflare Worker, one D1 database, static assets in the same deploy, a team backend ("HQ") at `/hq`,
GitHub as the backup. Built 2026-10-24 for Aaron Wedra (Smartz Graphics, smartzgraphics@gmail.com).

- **Repo:** AaronWedra/coffee-time-website. The 2026 rebuild is on branch `redesign-2026`. `main` still
  holds the August/September 2026 attempt (static pages, Worker `coffee-time-preview`); it is
  superseded by this branch and kept only as history.
- **Cloudflare (Aaron's account `6adef798d5c77ea7d04513eb9886c0ab`, same as Sara and Zombie):** Worker `coffee-time`, D1 `coffee-time` (id `187c7972-2e37-458e-ab8e-4f48d9630477`, created 2026-10-25).
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
src/site/layout.ts     <html> shell, header/nav/footer (the nine Wix nav links), SEO meta, orb() helper
src/site/pages.ts      every public page as a function
src/site/routes.ts     routes, old URL redirects (keep forever), order + newsletter POSTs, sitemap, robots
src/hq/shell.ts        HQ frame: grouped sidebar, badges, Edit website button, ? bubble
src/hq/board.ts        Requests board, Punch list, attachments (R2 MEDIA), /hq/api/*
src/hq/review.ts       Edit website mode: cookie routes, pencil widget script, injection into public pages
src/hq/watchdog.ts     hourly cron: stale requests -> settings
src/hq/routes.ts       HQ: dashboard, orders, newsletter, game details, page copy, list editors, settings
public/                site.css (design), hq.css, img/ (webp), video/ (trailer), files/ (the 3 PDFs),
                       fonts/ (self-hosted, OFL), favicon.png, apple-touch-icon.png, img/og.jpg
db/migrations/         schema
db/make-seed.py        GENERATES db/seed.sql (all starting content). INSERT OR IGNORE: never overwrites HQ edits.
scripts/dev-server.mjs local server without wrangler: node:sqlite stands in for D1
scripts/smoke.mjs      84-check end-to-end test (pages, redirects, order + newsletter forms, spam traps, HQ)
scripts/shots.mjs      full-page screenshots, desktop + phone (OUT=dir node scripts/shots.mjs)
```

Commands: `npm run dev` (http://127.0.0.1:8788, fresh in-memory DB, HQ setup phrase `dev`),
`npm run smoke` (with dev running), `npm run check` (tsc), `npm run build` (bundles SQL), `npm run deploy`.

## The one rule that matters most

**Mirror the real site and use the real art.** The first 2026 attempt invented structure (a Five Worlds page,
a clock logo, fact shields, "From the box") and Aaron rejected it outright: "the current site is way better
than the new site you built". The site is the Wix site's sections in the Wix site's order, with the Wix
site's words, drawn with the game's own files from Google Drive (Website / Logo / Coffee Time Creators) and
the Wix media library. No AI-generated artwork, ever ("we love our art style, it's the brand"). AI tools are
for cropping and isolating pieces of the real files at most. Subtle effects are fine; new sections are not.

## Ground rules

- **Content is data.** Price, email, links, every block of copy, reviews, news, tutorials, FAQ, tracks,
  arcade games and creators live in D1 and are edited in HQ. Do not hard-code words into templates.
  Copy supports **bold**, "- " lists and [text](url) links.
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
- No JavaScript on the public site except Google Analytics, which loads only when HQ > Settings holds a `G-` Measurement ID (`ga4_id`, validated in layout.ts; CSP allows googletagmanager and google-analytics). Mobile nav is `<details>`; every effect is CSS.
- No inline `style=""` attributes (the CSP has no unsafe-inline); the smoke test checks.
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
- The three PDFs (instructions, story, coloring page) and the trailer are in public/files and public/video,
  served from this site. Wix can be cancelled without losing them.
- Music: 12 SoundCloud players. Nine tracks are on the "Cup Joe" account (user-565081345), three on Aaron's
  (user-682869823). The label under each player is the title the Wix site used, which is not always the
  SoundCloud title (Rapid Refill Theme, Crumpet Crusher Theme = Danger Theme, and so on).
- Tutorials: 46 videos, numbered 1, 2-a, 2-b ... 20-b exactly as on the Wix page.
- The HMP Bikes section on Wix had a short video of people riding; the file was not in the media library,
  so the section shows the HMP logo (linked) and Thermos on his bike instead.

## Design

It is the Wix site, tidied. Header: white bar, the purple Coffee Time wordmark, nine uppercase nav links.
Body: the Wix gradient starfield (purple to peach, fixed on desktop), with the item-card orbs floating at
the margins. Yellow #fff245 links on purple, like before. The characters stage on the peach band, Warp World
Music on the grey gradient, Orders and Meet the Creators on the dark board texture, Reviews as the colored
cards with five yellow stars and a faded character behind each quote. Footer purple with the white wordmark.
Fonts: Anton for Impact, Jost for Brandon Grotesque, Bree Serif for the review quotes, all self-hosted.
Effects are subtle and CSS-only: hero rise-in, orbs drifting, cards lifting on hover. public/img is ~6 MB
of WebP from the original files; don-floating.webp is the animated gif converted.

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

## Edit website and requests (added 2026-10-25)

Same workflow as the Zombie HQ. Staff names in OURS (src/hq/board.ts, currently `Claude`) count as the team
answering; everyone else's last message means a request is waiting. The assistant needs an HQ login named
Claude. R2 bucket `coffee-time-media` (binding MEDIA) holds screenshots. Smoke test covers the pencil rules.

## Current state (2026-10-25)

Rebuilt from scratch against the live site after the first attempt was rejected. `npm run smoke`: 84/84.
Screenshots reviewed at desktop and phone width for every page. NOT deployed: this session has no npm
registry access and no push access to the repo (the Claude GitHub app does not cover it), so the branch
exists locally in the session and as a bundle; see docs/HANDOFF.md.
