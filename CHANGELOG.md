# Changelog

## 2026-11-03: the two 2026 games, Overtime and Rush Hour
- The faithful board-game port at /play/ was correct and not fun (the AI resolves instantly, so you read a
  log instead of watching decisions). Two new games replace it in spirit, both at new paths, /play/ untouched.
- /overtime/: everyone plans Journey Cards under a 30 s clock, the fight plays as one shared replay at human
  pace, a hidden Roamer may be on your team (second-edition rules: he steals cards and triggers Landslides),
  the Duchess runs an accusation vote, the team can call Overtime to double a round. 500 AI games: heroes 57%.
- /rush/: real-time top-down race through the five worlds; brew meter, timing-ring fights, Duchess sweeps,
  the two-beat Roamer with an 8-space reach, King Tea's clock always ticking. 200 AI games: heroes 62%.
- Shared: public/arena/ (sprites with idle, blink, shine, hit and freeze; the clock face; chat and taunts;
  host-authoritative rooms with clock sync; human-paced AI helpers). The room relay gained generic
  input/event/private messages. The home page's Play band links both games.
- Online rooms are wired for both but need the first two-phone test on the deployed Worker.

## 2026-10-25: Play Online, the game app at /play/
- The installable Coffee Time game (rules engine, AI, chat and taunts) is served from `public/play/`.
  Its online rooms run as a SQLite-backed Durable Object (`src/play/room.ts`, binding `ROOMS`,
  migration v1, free plan) reached at `/room/CODE`, so friends join by code or invite link on
  playcoffeetime.com itself and install it from here. Nav gets "Play Online", home gets a Play band.
- `/play/` has its own CSP (inline scripts, Google Fonts) rather than the nonce CSP. The manifest is
  `manifest.json` because the Worker's static-file test only recognises 2 to 5 letter extensions.
- The standalone copy at coffee-time-app.smartzgraphics.workers.dev can be retired once this is live.

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
