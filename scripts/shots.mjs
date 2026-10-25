// Full-page screenshots of every public page at desktop and phone width, for eyeballing a change.
//   npm run dev   (in one terminal)
//   OUT=shots node scripts/shots.mjs [paths...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2);
const out = (process.env.OUT || 'shots') + '/';
mkdirSync(out, { recursive: true });
const base = process.env.BASE || 'http://127.0.0.1:8788';
const pages = args.length ? args : ['/', '/story', '/arcade', '/news', '/video-tutorials', '/faq', '/order'];
const b = await chromium.launch();
for (const [name, w, h] of [['desk', 1366, 900], ['phone', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  for (const path of pages) {
    await p.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    // Scroll through so lazy images load before the full-page capture.
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(1200);
    const file = out + name + (path === '/' ? '-home' : path.replace(/[/?#=]+/g, '-')) + '.png';
    await p.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await ctx.close();
}
await b.close();
