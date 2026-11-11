# Changelog

## 2026-11-11: v6 cast and pairs
- Dripping edges removed; section tops now have a latte-foam rim. Newsletter is a cup of coffee you can draw foam on with the cursor (one small nonce script, migration 0014 for the hint).
- Tutorial chapter index is compact: topics only, no a/b/c dots.
- Orders section is split: title, intro and copy (smaller, one wide column) on the left, the 3D box on the right; stacks on phones.
- The characters stage is now a ChatGPT-made 3D version of the real cast (heroes unchanged, added depth, raised purple stage) under moving spotlights, a shine sweep, lens flares and glitter (CSS only).
- The 2D and AR games are paired side by side, Rapid Refill, Donut Dash and Star Bugs each as 2D beside AR, with the AR cards tilted in 3D with a thick glowing edge. Editable headings (migration 0013).
- Hover outline (yellow ring with orange halo) on cards, doors, news, FAQ, tracks. Stat strip reads "board game, 2D arcade and AR".

## 2026-11-11: v5 effects
- New public/fx.css: coded 2026 space background (nebulae, aurora, three star layers, shooting stars), coffee drips, falling beans, a rising pour in the newsletter, a brand texture library (scripts/make-textures.py), glossy shaded characters, power-orb pickups, nicer typography.
- The box is now a real CSS 3D cuboid built from the printed dieline, tilting with the cursor.
- Story is a CSS flipbook. News, FAQ and videos are two columns on desktop; videos get a chapter index. Nick Domke added to the team (placeholder photo). Real 2D Star Bugs thumbnail.
- Removed the online games entirely (Overtime, Rush Hour, Coffee Time as printed): section, nav link, pages, room relay and Durable Object (wrangler migration v2), game rows (migration 0012). Old /play, /overtime and /rush URLs redirect to the arcade. Fixed the nav dropdown line.

## 2026-11-11: v4 polish
- "Delivered" replaces "sold" everywhere (migration 0011). Game cards are full-bleed real screenshots on a coffee-bean pattern.
- Doors use a purple D20 and a glossy controller (hand-drawn SVG). The 3D box tilts with the cursor (CSS only, :has()).
- New Purple Tree section with their programs, a celebratory "1,000 delivered" card, orbs dodge the cursor and sit asymmetrically.
- What's in the box moved to /in-the-box; HMP removed from home; coloring page moved to /story.

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

## 2026-10-29 (later): no consent bar, by Aaron's decision
- The analytics notice bar and all choice logic are removed; Analytics runs for every visitor. The privacy disclosure stays on /privacy (footer link, sitemap) without the choice button, and its opt-out sentence now points only at Google's browser add-on (migration 0006 updates the live copy unless it was edited in HQ). Signals and ad personalisation stay off; the analytics.google.com CSP fix stays. Smoke 124/124.

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
- 2026-10-25: D1 database coffee-time created; id set in wrangler.jsonc.
- 2026-10-25: Deployed. Worker coffee-time is live at https://coffee-time.smartzgraphics.workers.dev (Workers Builds on push to main). HQ_SETUP_TOKEN secret and /hq/setup still to do.

- 2026-10-25: Cutover. playcoffeetime.com and www now served by the coffee-time Worker (removed from coffee-time-preview). workers_dev pinned true. Wix plan cancelled, auto-renew off.

- 2026-10-29: Google Analytics 4. HQ > Settings > Google Analytics takes a Measurement ID; the tag and CSP entries appear only when it is set.

- 2026-10-29: Migration 0004 sets ga4_id to G-25HJXMDMHZ (GA4 property "Coffee Time (playcoffeetime.com)" in the Smartz Graphics Analytics account) while blank.

- 2026-11-03: Order and newsletter alerts now go through Cloudflare Email Sending (EMAIL binding, orders@playcoffeetime.com) to smartzgraphics@yahoo.com.

- 2026-11-03: Text alerts for new orders via Twilio (src/lib/sms.ts). Off until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM secrets are set; NOTIFY_SMS_TO var holds the phone.

- 2026-11-03: First edition sold out. Migration 0007 closes the order form and rewrites the Orders copy (only where still unedited). The last games were festival raffle prizes.

- 2026-11-03: Characters stage band is white (the pedestal art has white edges that looked random on peach); white-curve.webp, site.css v=5.
- 2026 pass on the home page: new arcade-style cover (starfield, shimmer headline, chunky game buttons), steam and sparkles on the characters, XP scroll bar, tidier mobile top (new blocks cover_kicker and cover_tagline, migration 0008).
- 2026 redesign: new frosted header (Games, Board Game, Story, Music, Team, News, More, Play free), sold-out and video-game cover with trailer card and stat strip, Play our games section (3D games, 2D arcade of 14 games beside Try these games in AR, linking Smartz Graphics), games now have kind and engine in HQ (migration 0009). Donette, orbs, backgrounds and the board game sections kept.
- 2026-11-11 Home redesign v3: two zones (Video Games, Board Game) with two doors, marble 'Meet the stars' cast stage, equal Online / 2D / AR arcades with poster cards, one shimmering heading style site-wide, 3D box render, games limited to Rapid Refill, Donut Dash, Star Bugs, Coffee Time Adventures and the online games (migration 0010).
- Music grid three across on desktop; removed scalloped section-top rims; foam drawing now works on the whole page; body text heavier (500); Purple Tree section shortened into three info cards (migration 0015).
- Site split into pages: home is cover, cast and newsletter; Video Games goes straight to /arcade; /board-game, /music, /team are their own pages. Unboxed sections, flat 2D vs 3D pair cards, spinning clock backgrounds (SVG), foam you can part with the cursor, real 2D Star Bugs screenshot, readable body weight.
- Cast replaced with a faithful transparent 3D render made from the original artwork; frame removed.
- 2026-11-11: Wider desktop text columns; arcade solo card and AR cubes; Star Bugs 2D landscape thumbnail; cyan links now yellow; home cover shortened to 'Play Coffee Time.' with two on-brand buttons (migrations 0017, 0018).
- 2026-11-11: Home doors redone: one calm purple surface, real game and box art, no icons or bean texture.
- 2026-11-11: Cast back to Aaron's original art (ChatGPT render removed): purple stage, one soft overhead light, floor shadow, no pedestal, no spotlight beams, narrower.
- 2026-11-11: Newsletter foam rebuilt (src/site/foam.ts): crema underneath, ivory foam with bubble clusters, cursor parts a soft channel that flows back. Doors: Star Bugs thumbnail, one-line titles, shorter.
- 2026-11-11: One button style site-wide (yellow on purple, no orange or green); cover stacks on phones; doors sit on the sunset with no hard seam; orbs removed from the Orders heading.
- 2026-11-11: Home brought back to about half of everything: cover, a four-game Play strip, the cast, a board game strip (box, three short reviews, Learn to play and Order), three music players, newsletter. Each strip links to its full page. The two door cards are replaced by the strips.
- 2026-11-11: Cast: Aaron's art with computed shading (cast-depth.webp), round stage with no foot, three soft conic spotlights. Deep Space Kruiser flies across the home cover (2s in, then every 15s). Coffee cup beside the box. Board game 'Learn to play' unboxed, no peach marble.
- 2026-11-11: Foam is now a GPU fluid simulation (stirs, swirls, settles). Reviews are one auto-drifting row. Orders copy at body size. Delivered thank-you is a full-width band. Box spins 360 continuously and still tilts to the cursor.
- 2026-11-11: Realm of Time clock background (varied sizes, turning dials, holographic hand tracers). Nick Domke's real photo. Orbs sized to the page margin so they never cover content at rest.
- 2026-11-11: Order page: text beside the spinning 3D box, shorter sold-out copy (0020), full-width confetti, no back link. AR cards are flat-faced lifted blocks.
- 2026-11-11: Arcade top is two small pieces (trailer player, game link). Three Kruisers at different depths on the home cover.
- 2026-11-11: Cast is Aaron's untouched original art again, with the hole in Thermos's lid repaired; coded shading removed. Home games strip features Coffee Time Adventures then the AR games. Newsletter text purple with a serif heading.
- 2026-11-11: Fix: migration 0020 used a LIKE pattern over D1's 50 byte limit, which failed on every request and took the site down. Pattern shortened.
- 2026-11-11: Home: cast section removed; a full-width Facebook video (block home_reel_url, migration 0021) takes its place. CSP frame-src allows www.facebook.com.
- 2026-11-11: Home video is now the original 'Coffee Time Opening Scene' from Drive, self-hosted, muted, autoplaying on a loop (Facebook embed and its CSP entry removed, block dropped in 0022). 'More about the AR arcade' link removed.
- 2026-11-11: Trailer thumbnail is the King Tea frame (0023), square corners, thin outside line, never cropped, play button bottom right. Game pairs are short horizontal cards whose frame is the picture's own edge; column labels and their rules removed.
- 2026-11-11: Nick Domke is Video Game Music, not Video Game Lead (0024).
- 2026-11-11: News: compact cards, three across, pictures whole at their own shape; orbs hidden below 1620px and on the news page.
- 2026-11-11: Arcade games are three cards across, one per game, AR art leading, Play in AR and Play in 2D buttons. Italic sub-lines replaced with the body face. Shorter pair_sub (0029).
- 2026-11-11: Realm of Time v2 background: clocks melt (turbulence warp), breathe bigger and smaller, ripple rings outward, hands fan into rainbow trails, colours cycle.
- 2026-11-11: Orders sections (board game page and /order) use the foam effect as their background, purple type on it; foam script handles several canvases and keeps bubble size constant on tall sections.
- 2026-11-11: Story: white cartoon glove on the Click to turn button; coloring band uses the foam background. Music page has no orbs.
- 2026-11-11: Home: trailer plays in place on the cover; games strip has the header rainbow bar top and bottom and Sir Cubey holding a controller (his own art, key swapped for a drawn controller) in the right margin on wide screens.
- 2026-11-11: Clock sections (home board game strip, Music, Reviews): acid edition, drifting rainbow recolours the clocks over deep purple; soft dark halo behind text instead of a solid half.
- 2026-11-11: Home music strip: rainbow notes float up behind the content.
- 2026-11-11: Home games strip is white with purple type; Sir Cubey's blacks are true black.
- 2026-11-11: Arcade: Coffee Time Adventures first as two thumbnails (trailer, play), rule, then AR games. Orders foam dropped for deep purple. Reviews and Music titles plain white. Sir Cubey holds a ChatGPT-drawn controller, hand on top. Purple Tree Café never splits across lines.
- 2026-11-11: Clocks: purple, black, yellow and white with a spinning sunburst and pulsing rings. ChatGPT-drawn glove on Click to turn. Coloring band is a thin strip. Team: no orbs, lone last card centred.
