# Coffee Time Website

This repository is the permanent source for the rebuilt **Coffee Time Adventures** website.

## Current status

- The existing Wix website remains live and unchanged.
- Cloudflare preview Worker: `coffee-time-preview`
- The first deployable website foundation is stored here.
- Original Wix content and media will be migrated in stages and reviewed on the preview URL before the domain is connected.

## Safe migration rules

1. Never change `playcoffeetime.com` DNS until the replacement site is reviewed.
2. Preserve original artwork, names, product information, game rules and ordering details.
3. Use preview deployments for review.
4. Keep every website change in GitHub so it can be inspected or reversed.
5. Build Aaron HQ separately from the public website, with explicit permissions for publishing and external actions.

## Structure

- `public/` — website pages, styles and media
- `src/` — Cloudflare Worker and future API code
- `wrangler.jsonc` — Cloudflare deployment configuration

## Planned next phases

1. Import original Coffee Time images and content.
2. Recreate the Wix routes: Story, Arcade, News, Video Tutorials and FAQ.
3. Add ordering, newsletter, music and game links.
4. Review the complete replacement on Cloudflare.
5. Connect the custom domain only after approval.
6. Build Aaron HQ Requests and Punch List using Cloudflare D1 and R2.
