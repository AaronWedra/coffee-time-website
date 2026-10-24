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
