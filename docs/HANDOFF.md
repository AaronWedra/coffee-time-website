# Handoff: Coffee Time 2026 rebuild

Status on 2026-10-24: built and tested, not deployed.

## What is left, in order
1. Get this branch onto GitHub (`redesign-2026` on AaronWedra/coffee-time-website). The Claude GitHub
   app did not have push access to this repo; reconnect GitHub in claude.ai settings or install the app on
   the repo, then a session can push. Alternatively, apply the bundle from the session on vengeance:
   `git fetch coffee-time-2026.bundle redesign-2026:redesign-2026 && git push origin redesign-2026`.
2. Merge `redesign-2026` into `main` (the old preview files are replaced, not mixed).
3. Deploy (CLAUDE.md "Deploying"): create D1 `coffee-time`, paste the id, connect Workers Builds,
   add HQ_SETUP_TOKEN, create the first admin at /hq/setup.
4. Save the three Wix PDFs (rulebook, story, coloring page) into public/files/ and update the links in
   HQ > Game details. They disappear when Wix is cancelled.
5. Optional: Resend for email alerts on new orders (otherwise check HQ).
6. DNS cutover for playcoffeetime.com, set SITE_URL, uncomment routes, turn on indexing in HQ.
7. Delete the old `coffee-time-preview` Worker.

## Things to double-check with Aaron
- Whether orders should stay "request then email" or get online payment later.
- Where playcoffeetime.com is registered (probably Wix, like Sara's was).

## Integrations worth adding later (not built, by design)
- Online payment: a Stripe Payment Link or Checkout on the order page, keeping the request flow as the fallback.
- Newsletter: the order form already records "email me news" (orders.newsletter); export those addresses from HQ
  into whatever list tool is chosen (Buttondown, Mailchimp).
- Analytics: Cloudflare Web Analytics is one line in src/site/layout.ts if wanted; nothing is tracked today.
- Instagram or TikTok: there are no brand accounts yet; add links in HQ > Game details when they exist.
