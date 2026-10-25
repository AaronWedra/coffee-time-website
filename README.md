# Coffee Time

The website for Coffee Time, the board game (playcoffeetime.com), plus HQ, the team backend at `/hq`.
One Cloudflare Worker + D1 + static assets. No framework, no runtime dependencies.

- `npm run dev` then open http://127.0.0.1:8788 (no wrangler needed; node:sqlite stands in for D1)
- `npm run smoke` runs the end-to-end checks against the dev server
- `npm run deploy` ships to Cloudflare (see CLAUDE.md "Deploying")

Words, prices, links, orders and messages live in the database and are edited in HQ, not in this repo.
Read CLAUDE.md before changing anything.
