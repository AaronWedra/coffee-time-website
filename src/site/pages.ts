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

export type OrderState = { sent?: boolean; error?: string; values?: Record<string, string> };

export function orderForm(s: Settings, blocks: Blocks, st: OrderState): Safe {
  const v = st.values || {};
  const max = Math.max(1, parseInt(s.max_quantity || '10', 10));
  if (s.orders_open === '0') return html`<div class="order-card" id="order-form"><h3>${line(blocks, 'order_form_title')}</h3><p>Orders are paused right now. Email <a href="mailto:${s.email}">${s.email}</a> and we will let you know as soon as games are back in stock.</p></div>`;
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

export function home(s: Settings, blocks: Blocks, tracks: Track[], creators: Creator[], reviews: Review[], flags: { joined?: string; order: OrderState }): Safe {
  return html`
<section class="hero" id="rules">
  ${orb('fire', 'r', 0, 1)}
  <div class="wrap hero-grid">
    <div class="hero-art"><img src="/img/don-floating.webp" alt="Donette, floating" width="440" height="840" fetchpriority="high"></div>
    <div class="hero-copy">
      <h1>${line(blocks, 'hero_title')}</h1>
      ${text(blocks, 'hero_body')}
      ${learnLinks(s)}
    </div>
    <div class="hero-ship">${img('/img/deep-space-kruiser.webp', 'The Deep Space Kruiser', 'width="900" height="411"')}</div>
  </div>
</section>

<section class="newsletter" id="newsletter">
  ${orb('warp', 'l', 10, 3)}
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
</section>

<section class="videogame" id="video-game">
  <div class="wrap">
    <hr class="rule">
    <h2 class="big">${line(blocks, 'game_title')}</h2>
    <div class="vg-grid">
      ${video(s.trailer_video, s.trailer_poster, 'Coffee Time Adventures trailer')}
      <div class="vg-copy">${text(blocks, 'game_body')}</div>
    </div>
    <hr class="rule">
  </div>
</section>

<section class="sponsor" id="sponsor">
  ${orb('ice', 'r', 20, 2)}
  <div class="wrap">
    <h2 class="sponsor-title">${line(blocks, 'sponsor_title')}</h2>
    <div class="sponsor-grid">
      <div class="sponsor-art">${img('/img/hmp-thermos.webp', 'Thermos riding an HMP electric bike', 'width="900" height="1037"')}</div>
      <a class="sponsor-photo" href="${s.hmp_url}" target="_blank" rel="noopener">${img('/img/hmp-logo.webp', 'HMP Bikes', 'width="1280" height="720"')}</a>
    </div>
    <div class="sponsor-copy">${text(blocks, 'sponsor_body')}</div>
    <h3 class="coloring-title">${line(blocks, 'coloring_title')}</h3>
    <div class="coloring">
      <a href="${s.coloring_pdf}" target="_blank" rel="noopener" aria-label="Download the coloring page (PDF)">${img('/img/coloring-bw.webp', 'Thermos on his HMP bike, black and white coloring page', 'width="900" height="900"')}</a>
      <a href="${s.coloring_pdf}" target="_blank" rel="noopener" aria-label="Download the coloring page (PDF)">${img('/img/coloring-color.webp', 'Thermos on his HMP bike, colored in', 'width="900" height="900"')}</a>
    </div>
    <div class="sponsor-copy small-copy">${text(blocks, 'coloring_body')}</div>
  </div>
</section>

<section class="stage" aria-label="The Coffee Time characters">
  <div class="stage-art">${img('/img/characters-stage.webp', 'The whole cast: Little Miss Hot Shot, Donette, Thermos, Cup Joe, Sir Cubey, King Tea, the crumpets and friends', 'width="2000" height="830"')}</div>
</section>

<section class="music" id="music">
  ${orb('feather', 'r', 10, 3)}
  ${orb('warp', 'l', 40, 4)}
  ${orb('earth', 'r', 80, 3)}
  <div class="wrap">
    <h2 class="huge">${line(blocks, 'music_title')}</h2>
    <p class="music-sub">${line(blocks, 'music_sub')}</p>
    <p class="music-tag">${line(blocks, 'music_tagline')}</p>
    <div class="tracks">${tracks.map(soundcloud)}</div>
  </div>
</section>

<section class="orders" id="order">
  ${orb('sugar', 'l', 0, 2)}
  ${orb('fire', 'r', 20, 3)}
  <div class="wrap">
    <div class="orders-head">
      <h2 class="huge">${line(blocks, 'orders_title')}</h2>
      <p class="badge">${s.players}<br>${s.ages}</p>
    </div>
    <div class="box-cover">${img('/img/box-cover.webp', 'The Coffee Time box, first edition', 'width="1800" height="1101"')}</div>
    <h3 class="orders-intro">${line(blocks, 'orders_intro')}</h3>
    <div class="orders-copy">${text(blocks, 'orders_body')}</div>

    <div class="charity">
      <a class="charity-logo" href="${s.charity_url}" target="_blank" rel="noopener">${img('/img/purple-tree-logo.webp', 'Purple Tree Café, where community means everyone', 'width="600" height="825"')}</a>
      <div class="charity-copy">
        <h3>${line(blocks, 'charity_title')}</h3>
        ${text(blocks, 'charity_body')}
      </div>
      <div class="charity-photo">${img('/img/purple-tree-team.webp', 'Members of the Purple Tree Café team', 'width="900" height="1200"')}</div>
    </div>

    <div class="inbox">
      <div class="inbox-board">${img('/img/board.webp', 'The Coffee Time game board: five World Clocks across the top and the heroes’ paths winding to the Activation Chamber', 'width="1400" height="1400"')}</div>
      <div class="inbox-list">
        <h3>${line(blocks, 'box_title')}</h3>
        ${text(blocks, 'box_list')}
      </div>
    </div>

    ${orderForm(s, blocks, flags.order)}
  </div>
</section>

<section class="team" id="team">
  ${orb('ice', 'r', 0, 4)}
  <div class="wrap">
    <h2 class="huge">${line(blocks, 'team_title')}</h2>
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

<section class="reviews" id="reviews">
  ${orb('earth', 'l', 0, 2)}
  ${orb('sugar', 'r', 50, 3)}
  <div class="wrap">
    <h2 class="huge">${line(blocks, 'reviews_title')}</h2>
    <ul class="review-grid">
      ${reviews.map((r, i) => html`<li class="review c${(i % 6) + 1}">${stars()}<h3>${r.name}<small>${r.role}</small></h3><blockquote>${raw(inline(r.quote))}</blockquote><span class="qm" aria-hidden="true">&rdquo;</span></li>`)}
    </ul>
  </div>
</section>`;
}

export function orderPage(s: Settings, blocks: Blocks, st: OrderState): Safe {
  return html`<section class="orders page-order" id="order">
    <div class="wrap narrow">
      <h1 class="huge">${line(blocks, 'orders_title')}</h1>
      <div class="box-cover">${img('/img/box-cover.webp', 'The Coffee Time box, first edition', 'width="1800" height="1101"')}</div>
      <div class="orders-copy">${text(blocks, 'orders_body')}</div>
      ${orderForm(s, blocks, st)}
      <p class="center"><a href="/#order">Back to the game</a></p>
    </div>
  </section>`;
}

export function story(s: Settings, blocks: Blocks): Safe {
  const pages = [1, 2, 3, 4, 5, 6, 7, 8];
  return html`<section class="page story">
    <div class="wrap narrow">
      <h1 class="huge">${line(blocks, 'story_title')}</h1>
      <div class="intro">${text(blocks, 'story_intro')}</div>
    </div>
    <div class="wrap story-pages">
      ${pages.map((n) => html`<figure>${img(`/img/story-${n}.webp`, `Coffee Time story, page ${n}`, `width="1400" height="1789" ${n === 1 ? 'loading="eager"' : ''}`)}</figure>`)}
    </div>
  </section>`;
}

export function arcade(s: Settings, blocks: Blocks, games: Game[]): Safe {
  return html`<section class="page arcade">
    ${orb('warp', 'r', 10, 3)}
    <div class="wrap narrow">
      <h1 class="huge">${line(blocks, 'arcade_title')}</h1>
      ${video(s.trailer_video, s.trailer_poster, 'Coffee Time Adventures trailer')}
      <div class="intro">${text(blocks, 'arcade_body')}</div>
      <p class="center"><a class="btn" href="${s.demo_url}" target="_blank" rel="noopener">Download the free demo</a></p>
    </div>
    <div class="wrap">
      <ul class="games">
        ${games.map(
          (g) => html`<li>
            <a href="${g.url}" target="_blank" rel="noopener">${img(g.image, `${g.title} screenshot`, 'width="1000" height="600"')}</a>
            <h2>${g.title}</h2>
            ${richText(g.blurb)}
            ${g.note ? html`<p class="small">${g.note}</p>` : ''}
            <a class="btn" href="${g.url}" target="_blank" rel="noopener">${g.button || `Play ${g.title}`}</a>
          </li>`,
        )}
      </ul>
    </div>
  </section>`;
}

export function news(s: Settings, blocks: Blocks, items: News[]): Safe {
  return html`<section class="page news">
    ${orb('earth', 'l', 5, 2)}
    <div class="wrap narrow">
      <h1 class="huge">${line(blocks, 'news_title')}</h1>
      ${items.map((n) => {
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
      })}
    </div>
  </section>`;
}

export function tutorials(s: Settings, blocks: Blocks, items: Tutorial[]): Safe {
  return html`<section class="page tutorials">
    <div class="wrap narrow">
      <h1 class="huge">${line(blocks, 'tutorials_title')}</h1>
      <div class="intro">${text(blocks, 'tutorials_intro')}${learnLinks(s, 'tutorials')}</div>
      <nav class="jump" aria-label="Jump to a tutorial"><ol>${items.map((t) => html`<li><a href="#tutorial-${t.num}">${t.num}</a></li>`)}</ol></nav>
      ${items.map(
        (t) => html`<article class="tutorial" id="tutorial-${t.num}">
          <p class="kicker">Tutorial ${t.num}</p>
          <h2>${t.title}</h2>
          ${richText(t.body)}
          ${t.youtube_id ? youtube(t.youtube_id, `Tutorial ${t.num}: ${t.title}`) : ''}
        </article>`,
      )}
    </div>
  </section>`;
}

export function faq(s: Settings, blocks: Blocks, items: Faq[]): Safe {
  return html`<section class="page faq">
    ${orb('sugar', 'r', 5, 2)}
    <div class="wrap narrow">
      <h1 class="huge">${line(blocks, 'faq_title')}</h1>
      <div class="intro">${text(blocks, 'faq_intro')}${learnLinks(s, 'faq')}</div>
      ${items.map((f) => html`<article class="qa"><h2><span>Q:</span> ${f.question}</h2><div class="answer">${richText(f.answer)}</div></article>`)}
    </div>
  </section>`;
}

export function notFound(): Safe {
  return html`<section class="page"><div class="wrap narrow center"><h1 class="huge">Lost in the Realm of Time</h1><p>That page is not here. <a href="/">Back to Coffee Time</a>.</p></div></section>`;
}
