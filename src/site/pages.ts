// Every public page, as functions returning markup. Words come from D1 (settings + blocks); nothing
// here should be a sentence the team might want to change.
import { html, raw, richText, inline, type Safe } from '../lib/html.ts';
import type { Settings, Block, Review, News, Faq, Tutorial, Track, Game, Creator } from '../lib/db.ts';
import { img, orb } from './layout.ts';

type Blocks = Record<string, Block>;
const b = (blocks: Blocks, key: string) => blocks[key]?.value || '';
const line = (blocks: Blocks, key: string) => raw(inline(b(blocks, key)));
const text = (blocks: Blocks, key: string) => richText(b(blocks, key));
const t0 = () => html`<input type="hidden" name="_t" value="${Date.now()}"><div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>`;

// The four "learn to play" links under the headline (and on the tutorials and FAQ pages).
function learnLinks(s: Settings, skip: '' | 'tutorials' | 'faq' = ''): Safe {
  return html`<ul class="learn">
    ${skip === 'tutorials' ? '' : html`<li><a href="/video-tutorials">Watch video tutorials</a></li>`}
    ${skip === 'faq' ? '' : html`<li><a href="/faq">Visit our FAQ page</a></li>`}
    <li><a href="${s.rules_pdf}" target="_blank" rel="noopener">Download full game instructions here</a></li>
    <li><a href="${s.story_pdf}" target="_blank" rel="noopener">Download game story here</a></li>
  </ul>`;
}

function soundcloud(track: Track): Safe {
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%23320158&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;
  return html`<figure class="track">
    <iframe title="${track.title} on SoundCloud" width="100%" height="166" scrolling="no" frameborder="0" loading="lazy" allow="autoplay" src="${src}"></iframe>
    <figcaption><a href="${track.url}" target="_blank" rel="noopener">${track.title}</a></figcaption>
  </figure>`;
}

function video(src: string, poster: string, label: string): Safe {
  return html`<video class="video" controls preload="none" poster="${poster}" playsinline aria-label="${label}"><source src="${src}" type="video/mp4"></video>`;
}

function youtube(id: string, title: string): Safe {
  return html`<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}

const stars = () => raw('<span class="stars" aria-label="Five stars">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z"/></svg>'.repeat(5) + '</span>');


// Hand-built SVG icons for the two doors: a purple D20 and a glossy controller.
const ICON_D20 = raw('<svg class="door-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="d20a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a8ff"/><stop offset=".55" stop-color="#9a45d8"/><stop offset="1" stop-color="#4b1a86"/></linearGradient></defs><polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="url(#d20a)" stroke="#2a0a52" stroke-width="3" stroke-linejoin="round"/><polygon points="50,4 91,27 50,38" fill="#ecd0ff" opacity=".55"/><polygon points="50,4 9,27 50,38" fill="#c488f0" opacity=".5"/><polygon points="9,27 50,38 9,73" fill="#7a2fc0" opacity=".55"/><polygon points="91,27 50,38 91,73" fill="#5a1f9e" opacity=".6"/><polygon points="50,38 91,73 50,96" fill="#6d28b4" opacity=".55"/><polygon points="50,38 9,73 50,96" fill="#8a3ccf" opacity=".5"/><path d="M50 4 50 38 M9 27 50 38 91 27 M9 73 50 38 91 73 M9 73 50 96 91 73" fill="none" stroke="#2a0a52" stroke-width="1.6" opacity=".7"/><text x="50" y="62" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="25" fill="#fff" stroke="#2a0a52" stroke-width="1.2" paint-order="stroke">20</text></svg>');
const ICON_PAD = raw('<svg class="door-svg" viewBox="0 0 120 80" aria-hidden="true"><defs><linearGradient id="pada" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7ff"/><stop offset=".5" stop-color="#2f7de0"/><stop offset="1" stop-color="#1b2f8f"/></linearGradient></defs><path d="M30 10h60c14 0 21 8 26 28l5 24c2 10-4 16-12 16-7 0-11-4-16-11l-5-8H32l-5 8c-5 7-9 11-16 11-8 0-14-6-12-16l5-24C14 18 16 10 30 10z" fill="url(#pada)" stroke="#0b1650" stroke-width="3.5" stroke-linejoin="round"/><path d="M30 14h60c8 0 12 3 15 11-8-3-18-4-45-4S23 22 15 25c3-8 7-11 15-11z" fill="#fff" opacity=".3"/><rect x="27" y="29" width="22" height="7" rx="3" fill="#0b1650"/><rect x="34.5" y="21.5" width="7" height="22" rx="3" fill="#0b1650"/><circle cx="84" cy="25" r="5" fill="#ffd93a" stroke="#0b1650" stroke-width="2"/><circle cx="94" cy="34" r="5" fill="#ff4f7b" stroke="#0b1650" stroke-width="2"/><circle cx="74" cy="34" r="5" fill="#7ee02f" stroke="#0b1650" stroke-width="2"/><circle cx="84" cy="43" r="5" fill="#fff" stroke="#0b1650" stroke-width="2"/><circle cx="47" cy="51" r="8" fill="#0b1650"/><circle cx="73" cy="51" r="8" fill="#0b1650"/><circle cx="47" cy="49.5" r="4.5" fill="#3a5bd0"/><circle cx="73" cy="49.5" r="4.5" fill="#3a5bd0"/></svg>');

const beans = (n = 12): Safe => raw(`<div class="beanfall" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`);
const prose = (blocks: Blocks, key: string, cls = ''): Safe => html`<div class="prose26 ${cls}">${richText(b(blocks, key))}</div>`;

export type OrderState = { sent?: boolean; error?: string; values?: Record<string, string> };


// The box follows the cursor with no JavaScript: nine invisible hover zones, and :has() tilts the box
// toward whichever one the pointer is over.
function boxTilt(): Safe {
  return html`<div class="boxtilt" role="img" aria-label="The Coffee Time board game box, first edition. Move your cursor over it to turn it.">
    <div class="boxtilt-zones" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<i class="bz bz${n}"></i>`)}</div>
    <div class="cube-shadow" aria-hidden="true"></div>
    <div class="cube-sway" aria-hidden="true"><div class="cube">
      <i class="f-bot"></i><i class="f-back"></i><i class="f-left"></i><i class="f-right"></i><i class="f-front"></i><i class="f-top"></i>
    </div></div>
  </div>`;
}

// Purple Tree Cafe, the nonprofit that received 5% of every sale.
function purpleTree(s: Settings, blocks: Blocks): Safe {
  return html`<div class="pt">
    <div class="pt-head">
      <a class="pt-logo" href="${s.charity_url}" target="_blank" rel="noopener">${img('/img/purple-tree-logo.webp', 'Purple Tree Café, where community means everyone', 'width="600" height="825"')}</a>
      <div class="pt-intro">
        <p class="pt-kicker">Our community partner</p>
        <h3>${line(blocks, 'charity_title')}</h3>
        ${text(blocks, 'charity_body')}
        <p><a class="btn" href="${s.charity_url}" target="_blank" rel="noopener">Visit Purple Tree Café</a></p>
      </div>
      <div class="pt-photo">${img('/img/purple-tree-team.webp', 'Members of the Purple Tree Café team', 'width="900" height="1200"')}</div>
    </div>
    <div class="pt-programs">${text(blocks, 'charity_programs')}</div>
  </div>`;
}

export function orderForm(s: Settings, blocks: Blocks, st: OrderState): Safe {
  const v = st.values || {};
  const max = Math.max(1, parseInt(s.max_quantity || '10', 10));
  if (s.orders_open === '0') return html`<div class="delivered" id="order-form">
    <span class="dv-conf" aria-hidden="true">${raw('<i></i>'.repeat(28))}</span>
    <p class="dv-big">1,000</p>
    <p class="dv-of">first edition games, all delivered</p>
    <h3>${line(blocks, 'delivered_title')}</h3>
    <div class="dv-copy">${text(blocks, 'delivered_body')}</div>
    <p class="dv-cta"><a class="btn btn-go" href="mailto:${s.email}">Say hello</a><a class="btn btn-go btn-go2" href="/arcade">Play the video games</a></p>
  </div>`;
  if (st.sent) return html`<div class="order-card" id="order-form"><h3>Order request sent</h3><p>Thank you! We will email you shortly to confirm shipping and payment. It's Coffee Time!</p></div>`;
  return html`<div class="order-card" id="order-form">
    <h3>${line(blocks, 'order_form_title')}</h3>
    ${text(blocks, 'order_form_body')}
    ${st.error ? html`<p class="form-error" role="alert">${st.error}</p>` : ''}
    <form method="post" action="/order" class="form">
      ${t0()}
      <div class="grid2">
        <label>First and last name <input name="name" required autocomplete="name" value="${v.name || ''}"></label>
        <label>Email <input name="email" type="email" required autocomplete="email" value="${v.email || ''}"></label>
        <label>Phone <input name="phone" type="tel" autocomplete="tel" value="${v.phone || ''}"></label>
        <label>Number of copies <input name="quantity" type="number" min="1" max="${max}" value="${v.quantity || '1'}"></label>
      </div>
      <label>Shipping address <textarea name="address" rows="3" required autocomplete="street-address">${v.address || ''}</textarea></label>
      <label>Anything else? <textarea name="notes" rows="2">${v.notes || ''}</textarea></label>
      <label class="check"><input type="checkbox" name="newsletter" value="1" ${v.newsletter ? raw('checked') : ''}> Also sign me up for the newsletter</label>
      <button class="btn">Send order request</button>
      <p class="small">$${s.price} per game plus shipping. We reply by email; nothing is charged here.</p>
    </form>
  </div>`;
}

// ---- Games (2026): online games, the 2D arcade and the AR arcade. All rows come from D1.
const initials = (t: string) => t.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const ext = (u: string) => (u.startsWith('http') ? raw('target="_blank" rel="noopener"') : '');

// One heading style for every section: a small blinking kicker over a shimmering title, like the cover.
function secHead(kicker: Safe | string, title: Safe | string, sub: Safe | string = '', tag: 'h1' | 'h2' | 'h3' = 'h2', tone: '' | 'light' = ''): Safe {
  const t = tag === 'h1' ? html`<h1 class="sec-title">${title}</h1>` : tag === 'h3' ? html`<h3 class="sec-title">${title}</h3>` : html`<h2 class="sec-title">${title}</h2>`;
  return html`<header class="sec-head ${tone === 'light' ? 'on-light' : ''}"><p class="sec-kicker">${kicker}</p>${t}${sub ? html`<p class="sec-sub">${sub}</p>` : ''}</header>`;
}

// Posters sit whole (contain) over a blurred copy of themselves, so no screenshot is ever cropped.
function gameCard(g: Game, i: number): Safe {
  const badge = g.kind === 'ar' ? 'AR' : g.kind === '3d' ? '3D' : '2D';
  return html`<li class="gcard c${i % 5} k-${g.kind}">
    <a class="gposter" href="${g.url}" ${ext(g.url)} tabindex="-1" aria-hidden="true">
      ${g.image ? img(g.image, '', 'class="gfull" width="1000" height="625"') : html`<b>${initials(g.title)}</b>`}
      <span class="gbadge">${badge}</span><span class="gplaybtn" aria-hidden="true"></span>
    </a>
    <div class="gbody">
      ${g.engine ? html`<span class="gtag">${g.engine}</span>` : ''}
      <h3>${g.title}</h3>
      <p>${g.blurb}</p>
      ${g.note ? html`<p class="gnote">${g.note}</p>` : ''}
      <a class="gplay" href="${g.url}" ${ext(g.url)}>${g.button || 'Play now'}<span class="arrow" aria-hidden="true"></span><span class="sr"> ${g.title}</span></a>
    </div>
  </li>`;
}

export function gamesSections(blocks: Blocks, games: Game[]): Safe {
  const of = (k: string) => games.filter((g) => g.kind === k);
  return html`
  <div class="wrap">
    <div class="arc arc-pair" id="arcade">
      <span id="ar"></span>
      ${secHead(line(blocks, 'pair_kicker'), line(blocks, 'pair_title'), raw(inline(b(blocks, 'pair_sub'))), 'h3')}
      <div class="pair-heads" aria-hidden="true"><span class="ph ph2d">${line(blocks, 'pair_2d_label')}</span><span class="ph-mid"></span><span class="ph phar">${line(blocks, 'pair_ar_label')}</span></div>
      <ul class="pairs">${of('2d').map((d, i) => {
        const a = of('ar').find((x) => x.title === d.title);
        return html`<li class="pair"><ul class="gcards pair-cards">${gameCard(d, i)}<li class="pair-link" aria-hidden="true"><b>=</b><i>${d.title}</i></li>${a ? gameCard(a, i) : ''}</ul></li>`;
      })}</ul>
      <p class="arc-foot"><a href="https://www.smartzgraphics.com/news/star-bugs" target="_blank" rel="noopener">More about the AR arcade</a></p>
    </div>
  </div>`;
}

export function home(s: Settings, blocks: Blocks, flags: { joined?: string }): Safe {
  return html`
<section class="cover" aria-label="Coffee Time">
  <div class="cover-sky" aria-hidden="true"></div>
  ${beans(10)}
  <div class="wrap cover-in">
    <div class="cover-copy">
      <p class="cover-kicker"><span class="dot" aria-hidden="true"></span>${line(blocks, 'cover_kicker')}</p>
      <h1 class="cover-title">${line(blocks, 'cover_tagline')}</h1>
      <p class="cover-note">${line(blocks, 'cover_note')}</p>
      <p class="cover-btns"><a class="btn btn-go" href="${s.demo_url}" target="_blank" rel="noopener">Play the free demo</a><a class="btn btn-go btn-go2" href="/arcade">Open the arcade</a></p>
    </div>
    <a class="cover-card" href="/arcade" aria-label="Watch the Coffee Time Adventures trailer">
      <img src="/img/trailer-poster.webp" alt="" width="1280" height="720" fetchpriority="high">
      <span class="cc-play" aria-hidden="true"></span>
      <span class="cc-label">Coffee Time Adventures<small>Watch the trailer</small></span>
    </a>
  </div>
  <ul class="wrap hud" aria-label="Coffee Time by the numbers">
    <li><b>1,000</b><span>board games made, every one delivered</span></li>
    <li><b>5</b><span>worlds to save from King Tea</span></li>
    <li><b>3 ways</b><span>of play: board game, 2D arcade and AR</span></li>
    <li><b>Free</b><span>to play, no sign-up</span></li>
  </ul>
</section>

<nav class="doors" aria-label="Choose: video games or the board game">
  <div class="wrap doors-in">
    <a class="door door-vg" href="/arcade">
      <span class="door-copy"><b>${line(blocks, 'zone_vg_title')}</b><span>${line(blocks, 'zone_vg_sub')}</span><em>Play now</em></span>
      <img class="door-art" src="/img/game-star-bugs.webp" alt="" width="1000" height="625" loading="lazy">
    </a>
    <a class="door door-bg" href="/board-game">
      <span class="door-copy"><b>${line(blocks, 'zone_bg_title')}</b><span>${line(blocks, 'zone_bg_sub')}</span><em>Rules, tutorials, order</em></span>
      <img class="door-art door-box" src="/img/box-3d.webp" alt="" width="1500" height="880" loading="lazy">
    </a>
  </div>
</nav>

<section class="cast" aria-label="The Coffee Time characters">
  <div class="cast-glow" aria-hidden="true"></div>
  <div class="wrap">
    ${secHead('Starring', line(blocks, 'cast_title'), line(blocks, 'cast_sub'), 'h2', 'light')}
  </div>
  <div class="cast-stage">
    <div class="cast-art">
      ${img('/img/characters-cutout.webp', 'The whole cast: Little Miss Hot Shot, Donette, Thermos, Cup Joe, Sir Cubey, King Tea, the crumpets and the Mean Girl Crumpets', 'class="cast-main" width="1374" height="684"')}
      <span class="cast-floor" aria-hidden="true"></span>
    </div>
  </div>
</section>

<section class="newsletter" id="newsletter">
  <canvas class="latte" aria-hidden="true"></canvas>
  ${beans(14)}
  ${orb('warp', 'l', 10, 3, 5)}
  <div class="wrap news-grid">
    <h2>${line(blocks, 'newsletter_title')}</h2>
    <div>
      ${text(blocks, 'newsletter_body')}
      ${flags.joined === '1' ? html`<p class="form-ok" role="status">You're on the list. Welcome to the Coffee Time universe!</p>` : flags.joined === '0' ? html`<p class="form-error" role="alert">That email address does not look right. Please check it and try again.</p>` : ''}
      <form method="post" action="/newsletter" class="join">
        ${t0()}
        <label><span>Email</span> <input name="email" type="email" required autocomplete="email" placeholder="e.g., email@example.com"></label>
        <button class="btn">Join</button>
      </form>
    </div>
  </div>
  <div class="pour" aria-hidden="true"></div><div class="foam" aria-hidden="true"></div>
</section>




`;
}

export function boardGame(s: Settings, blocks: Blocks, reviews: Review[], flags: { order: OrderState }): Safe {
  return html`
<section class="zone zone-bg" id="board-game">
  <div class="wrap">
    <div class="zone-banner">
      <span class="zone-chip">The board game</span>
      ${secHead('Own the board game?', line(blocks, 'zone_bg_title'), line(blocks, 'zone_bg_sub'), 'h1')}
      <ul class="zone-jump" aria-label="In this section">
        <li><a href="#rules">Learn to play</a></li>
        <li><a href="/video-tutorials">Video tutorials</a></li>
        <li><a href="/faq">FAQ</a></li>
        <li><a href="/story">The story</a></li>
        <li><a href="#reviews">Reviews</a></li>
        <li><a href="#order">Order</a></li>
      </ul>
    </div>
  </div>

<div class="hero" id="rules">
  ${orb('fire', 'r', 0, 1, 3)}
  <div class="wrap hero-grid">
    <div class="hero-art"><img src="/img/don-floating.webp" alt="Donette, floating" width="440" height="840" fetchpriority="high"></div>
    <div class="hero-copy">
      <h2 class="hero-title sec-title">${line(blocks, 'hero_title')}</h2>
      <div class="prose26">${text(blocks, 'hero_body')}</div>
      ${learnLinks(s)}
    </div>
    <div class="hero-ship">${img('/img/deep-space-kruiser.webp', 'The Deep Space Kruiser', 'width="900" height="411"')}</div>
  </div>
</div>

<div class="reviews" id="reviews">
  ${orb('earth', 'l', 0, 2, 5)}
  ${orb('sugar', 'r', 50, 3, 1)}
  <div class="wrap">
    ${secHead('What players say', line(blocks, 'reviews_title'))}
    <ul class="review-grid">
      ${reviews.map((r, i) => html`<li class="review c${(i % 6) + 1}">${stars()}<h3>${r.name}<small>${r.role}</small></h3><blockquote>${raw(inline(r.quote))}</blockquote><span class="qm" aria-hidden="true">&rdquo;</span></li>`)}
    </ul>
  </div>
</div>

<div class="orders" id="order">
  ${orb('sugar', 'l', 0, 2, 3)}
  ${orb('fire', 'r', 20, 3, -1)}
  <div class="wrap">
    <div class="orders-split">
      <div class="orders-text">
        <div class="orders-head">
          ${secHead('First edition', line(blocks, 'orders_title'))}
          <p class="badge">${s.players}<br>${s.ages}</p>
        </div>
        <h3 class="orders-intro">${line(blocks, 'orders_intro')}</h3>
        <div class="orders-copy prose26 cols">${text(blocks, 'orders_body')}</div>
      </div>
      <div class="orders-box">${boxTilt()}</div>
    </div>

    ${purpleTree(s, blocks)}

    <p class="box-link"><a href="/in-the-box">What is in the box? See the full contents</a></p>

    ${orderForm(s, blocks, flags.order)}
  </div>
</div>
</section>
`;
}

export function musicPage(blocks: Blocks, tracks: Track[]): Safe {
  return html`
<section class="music" id="music">
  ${orb('feather', 'r', 10, 3, 1)}
  ${orb('warp', 'l', 40, 4, 3)}
  ${orb('earth', 'r', 80, 3, -1)}
  <div class="wrap">
    ${secHead('Press play', line(blocks, 'music_title'))}
    <p class="music-sub">${line(blocks, 'music_sub')}</p>
    <p class="music-tag">${line(blocks, 'music_tagline')}</p>
    <div class="tracks">${tracks.map(soundcloud)}</div>
  </div>
</section>
`;
}

export function teamPage(blocks: Blocks, creators: Creator[]): Safe {
  return html`
<section class="team" id="team">
  ${orb('ice', 'r', 0, 4, 5)}
  <div class="wrap">
    ${secHead('Made in Davis, California', line(blocks, 'team_title'))}
    <ul class="creators">
      ${creators.map(
        (c) => html`<li>
          ${img(c.image, c.name, 'width="520" height="520"')}
          <div>
            <h3>${c.name}<small>${c.role}</small><em>${c.place}</em></h3>
            ${richText(c.bio)}
          </div>
        </li>`,
      )}
    </ul>
  </div>
</section>
`;
}

export function orderPage(s: Settings, blocks: Blocks, st: OrderState): Safe {
  return html`<section class="orders page-order" id="order">
    <div class="wrap narrow">
      ${secHead('First edition', line(blocks, 'orders_title'), '', 'h1')}
      <div class="box-cover">${img('/img/box-3d.webp', 'The Coffee Time board game box, first edition', 'width="1500" height="880"')}</div>
      <div class="orders-copy">${text(blocks, 'orders_body')}</div>
      ${orderForm(s, blocks, st)}
      <p class="center"><a href="/order">Back to the game</a></p>
    </div>
  </section>`;
}

export function inTheBox(s: Settings, blocks: Blocks): Safe {
  return html`<section class="page inbox-page">
    <div class="wrap narrow">
      ${secHead('The board game', line(blocks, 'box_title'), '', 'h1')}
      <div class="inbox">
        <div class="inbox-board">${img('/img/board.webp', 'The Coffee Time game board: five World Clocks across the top and the heroes’ paths winding to the Activation Chamber', 'width="1400" height="1400"')}</div>
        <div class="inbox-list">${text(blocks, 'box_list')}</div>
      </div>
      ${learnLinks(s)}
      <p class="center"><a href="/board-game">Back to the board game</a></p>
    </div>
  </section>`;
}

function coloring(s: Settings, blocks: Blocks): Safe {
  return html`<section class="coloring-band">
    <div class="wrap narrow">
      ${secHead('For the kids', line(blocks, 'coloring_title'), '', 'h2')}
      <div class="coloring">
        <a href="${s.coloring_pdf}" target="_blank" rel="noopener" aria-label="Download the coloring page (PDF)">${img('/img/coloring-bw.webp', 'Thermos on his bike, black and white coloring page', 'width="900" height="900"')}</a>
        <a href="${s.coloring_pdf}" target="_blank" rel="noopener" aria-label="Download the coloring page (PDF)">${img('/img/coloring-color.webp', 'Thermos on his bike, colored in', 'width="900" height="900"')}</a>
      </div>
      <div class="prose26">${text(blocks, 'coloring_body')}</div>
    </div>
  </section>`;
}

export function story(s: Settings, blocks: Blocks): Safe {
  const pages = [1, 2, 3, 4, 5, 6, 7, 8];
  const leaf = (n: number) => html`<div class="leaf lf${n}">
      <label class="pg front" for="fl${n}">${img(`/img/story-${n * 2 - 1}.webp`, `Coffee Time story, page ${n * 2 - 1}`, `width="1400" height="1789" ${n === 1 ? 'loading="eager"' : ''}`)}</label>
      <label class="pg back" for="fl${n}">${img(`/img/story-${n * 2}.webp`, `Coffee Time story, page ${n * 2}`, 'width="1400" height="1789"')}</label>
    </div>`;
  return html`<section class="page story">
    ${orb('fire', 'r', 10, 2, 3)}${orb('ice', 'l', 40, 3, 1)}
    <div class="wrap narrow">
      ${secHead('The board game', line(blocks, 'story_title'), '', 'h1')}
      <div class="intro prose26">${text(blocks, 'story_intro')}</div>
    </div>
    <div class="wrap flipwrap">
      <div class="book">
        <input type="checkbox" id="fl1" class="fl1" aria-label="Turn page 1"><input type="checkbox" id="fl2" class="fl2" aria-label="Turn page 3"><input type="checkbox" id="fl3" class="fl3" aria-label="Turn page 5"><input type="checkbox" id="fl4" class="fl4" aria-label="Turn page 7">
        ${[1, 2, 3, 4].map(leaf)}
      </div>
      <p class="flip-hint">Click a page to turn it</p>
    </div>
    <div class="wrap story-pages mobile-only">
      ${pages.map((n) => html`<figure>${img(`/img/story-${n}.webp`, `Coffee Time story, page ${n}`, `width="1400" height="1789" ${n === 1 ? 'loading="eager"' : ''}`)}</figure>`)}
    </div>
    ${coloring(s, blocks)}
  </section>`;
}

export function arcade(s: Settings, blocks: Blocks, games: Game[]): Safe {
  const solo = games.filter((g) => g.kind === '3d');
  return html`<section class="page arcade">
    ${orb('warp', 'r', 10, 3, 1)}
    <div class="wrap">
      ${secHead('Video games', line(blocks, 'arcade_title'), '', 'h1')}
      <ul class="gcards solo-cards">${solo.map((g, i) => gameCard(g, i))}</ul>
    </div>
    ${gamesSections(blocks, games)}
  </section>`;
}

export function news(s: Settings, blocks: Blocks, items: News[]): Safe {
  return html`<section class="page news">
    ${orb('earth', 'l', 5, 2, 3)}
    <div class="wrap wide">
      ${secHead('Latest', line(blocks, 'news_title'), '', 'h1')}
      <div class="news-list">${items.map((n) => {
        const imgs = n.images.split(',').map((x) => x.trim()).filter(Boolean);
        const yt = /^[\w-]{11}$/.test(n.video) ? n.video : '';
        return html`<article class="news-item">
          <p class="date">${n.date_label}</p>
          <h2>${n.title}</h2>
          ${n.video && !yt ? video(n.video, s.trailer_poster, n.title) : ''}
          ${yt ? youtube(yt, n.title) : ''}
          ${richText(n.body)}
          ${imgs.length ? html`<div class="news-pics n${imgs.length}">${imgs.map((src) => img(src, n.title, 'width="1200" height="1200"'))}</div>` : ''}
          ${n.url ? html`<p><a class="btn" href="${n.url}" target="_blank" rel="noopener">${n.link_label || 'Read more'}</a></p>` : ''}
        </article>`;
      })}</div>
    </div>
  </section>`;
}

export function tutorials(s: Settings, blocks: Blocks, items: Tutorial[]): Safe {
  // Chapters: 2-a and 2-b are two parts of chapter 2.
  const chapters: { n: string; title: string; parts: Tutorial[] }[] = [];
  for (const t of items) {
    const n = String(parseInt(t.num, 10) || t.num);
    const last = chapters[chapters.length - 1];
    if (last && last.n === n) last.parts.push(t);
    else chapters.push({ n, title: t.title, parts: [t] });
  }
  return html`<section class="page tutorials">
    ${orb('ice', 'r', 5, 2, 3)}
    <div class="wrap wide">
      ${secHead('The board game', line(blocks, 'tutorials_title'), '', 'h1')}
      <div class="intro prose26">${text(blocks, 'tutorials_intro')}${learnLinks(s, 'tutorials')}</div>
      <p class="tidx-label">Pick a chapter</p>
      <ul class="tidx" aria-label="Tutorial chapters">${chapters.map(
        (c) => html`<li class="tchap"><a href="#tutorial-${c.parts[0].num}"><b>${c.n}</b><span class="ttl">${c.title}</span></a></li>`,
      )}</ul>
      <div class="tut-list">${items.map(
        (t) => html`<article class="tutorial" id="tutorial-${t.num}">
          <p class="kicker">Tutorial ${t.num}</p>
          <h2>${t.title}</h2>
          ${richText(t.body)}
          ${t.youtube_id ? youtube(t.youtube_id, `Tutorial ${t.num}: ${t.title}`) : ''}
        </article>`,
      )}</div>
    </div>
  </section>`;
}

export function faq(s: Settings, blocks: Blocks, items: Faq[]): Safe {
  return html`<section class="page faq">
    ${orb('sugar', 'r', 5, 2, 1)}
    <div class="wrap wide">
      ${secHead('The board game', line(blocks, 'faq_title'), '', 'h1')}
      <div class="intro prose26">${text(blocks, 'faq_intro')}${learnLinks(s, 'faq')}</div>
      <div class="faq-list">${items.map((f) => html`<article class="qa"><h2><span>Q:</span> ${f.question}</h2><div class="answer">${richText(f.answer)}</div></article>`)}</div>
    </div>
  </section>`;
}

// Privacy: what the site collects (Google Analytics) and how to opt out. Google Analytics Terms section 7.
export function privacy(s: Settings, blocks: Blocks): Safe {
  return html`<section class="page privacy">
    <div class="wrap narrow">
      ${secHead('The fine print', line(blocks, 'privacy_title'), '', 'h1')}
      <div class="intro">${text(blocks, 'privacy_intro')}</div>
      <article class="qa privacy-card">
        <h2>Analytics and cookies</h2>
        <div class="answer">${text(blocks, 'privacy_analytics')}
          <p>${line(blocks, 'privacy_questions')} <a href="mailto:${s.email}">${s.email}</a></p>
        </div>
      </article>
    </div>
  </section>`;
}

export function notFound(): Safe {
  return html`<section class="page"><div class="wrap narrow center">${secHead('404', 'Lost in the Realm of Time', '', 'h1')}<p>That page is not here. <a href="/">Back to Coffee Time</a>.</p></div></section>`;
}
