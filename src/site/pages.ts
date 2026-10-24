// Every public page as a function returning markup. Words come from D1 (settings, blocks, lists),
// so they can be changed in HQ without touching this file.
import { html, raw, paragraphs, richText, inline, type Safe } from '../lib/html.ts';
import type { Settings, Block, World, Character, Review, News, Faq, Lesson, Track, Game } from '../lib/db.ts';
import { clock, img, shields, money } from './layout.ts';

type B = Record<string, Block>;
const t = (b: B, key: string) => b[key]?.value ?? '';
const ext = raw('rel="noopener" target="_blank"');

// World n spans hours (n-1)*12 to n*12 of King Tea's 60. Used for the clock on each world.
const WORLD_HOURS = [12, 12, 12, 9, 0];

function clockBar(worlds: World[]): Safe {
  return html`<div class="clockbar" aria-label="The five World Clocks from the board">
    <ol class="clocks">${worlds.slice(0, 5).map((w, i) => html`<li class="w-${w.slug}"><a href="/worlds#${w.slug}">${clock(w.name, `k${i + 1}`, WORLD_HOURS[i])}<span class="cl" aria-hidden="true">${w.name.split(' ')[0]}</span></a></li>`)}</ol>
    <p class="clock-note">King Tea moves the clocks from Coffee World to Tea World. Twelve in the last one and it is Tea Time forever.</p>
  </div>`;
}

// ------------------------------------------------------------------ home

export function home(s: Settings, b: B, worlds: World[], chars: Character[], reviews: Review[]): Safe {
  const heroes = chars.filter((c) => c.side === 'hero');
  const villains = chars.filter((c) => c.side === 'villain');
  const featured = reviews.filter((r) => r.featured).slice(0, 3);
  return html`
  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <h1 class="wordmark">Coffee Time</h1>
        <p class="hero-tag">${s.tagline}</p>
        <div class="lede">${paragraphs(t(b, 'home_lede'))}</div>
        ${shields(s)}
        <p class="actions">
          <a class="btn btn-crown btn-big" href="/order">Order the board game, ${money(s)}</a>
          <a class="btn btn-ghost" href="${s.demo_url}" ${ext}>Play the free video game demo</a>
        </p>
      </div>
      <div class="hero-art"><img src="/img/characters.webp" alt="The Coffee Time cast: Cup Joe, Thermos, Little Miss Hot Shot, Donette and the sugar cube on one side, King Tea and his crumpet army on the other" width="1800" height="756" fetchpriority="high"></div>
    </div>
    <div class="wrap">${clockBar(worlds)}</div>
  </section>

  <section class="sides" aria-labelledby="sides-title">
    <div class="wrap">
      <h2 id="sides-title" class="display">${t(b, 'home_sides_title')}</h2>
      <div class="sides-grid">
        <div class="side side-heroes">
          <h3>The coffee heroes</h3>
          ${paragraphs(t(b, 'home_heroes'))}
          <ul class="cast">${heroes.map((c) => html`<li>${img(c.image, '')}<b>${c.name}</b><span>${c.power}</span></li>`)}</ul>
        </div>
        <div class="side side-villains">
          <h3>King Tea and company</h3>
          ${paragraphs(t(b, 'home_villains'))}
          <ul class="cast">${villains.map((c) => html`<li>${img(c.image, '')}<b>${c.name}</b><span>${c.power}</span></li>`)}</ul>
        </div>
      </div>
    </div>
  </section>

  <section class="box" aria-labelledby="box-title">
    <div class="wrap box-grid">
      <div class="box-art">
        ${img('/img/board.webp', 'The Coffee Time board: five clocks across the top and colored paths winding through a coffee-brown swirl', 'class="board" width="1400" height="1400"')}
        ${img('/img/box-front.webp', 'The front of the Coffee Time box', 'class="boxfront" width="1400" height="710"')}
      </div>
      <div class="box-copy">
        <h2 id="box-title" class="display">${t(b, 'home_box_title')}</h2>
        ${richText(t(b, 'home_box'))}
        <p class="price"><b>${money(s)}</b> ${s.edition}</p>
        <p class="actions"><a class="btn btn-crown" href="/order">Order a copy</a><a class="btn btn-line" href="/how-to-play">See how it plays</a></p>
      </div>
    </div>
  </section>

  <section class="route" aria-labelledby="route-title">
    <div class="wrap">
      <h2 id="route-title" class="display">Five worlds, one clock</h2>
      <ol class="route-list">${worlds.map(
        (w) => html`<li class="w-${w.slug}"><a href="/worlds#${w.slug}">${img(w.image, '')}<b>${w.name}</b><span>${w.tagline}</span></a></li>`,
      )}</ol>
    </div>
  </section>

  <section class="game-band" aria-labelledby="game-title">
    <div class="wrap game-grid">
      <div>
        <h2 id="game-title" class="display">${t(b, 'home_game_title')}</h2>
        ${paragraphs(t(b, 'home_game'))}
        <p class="actions"><a class="btn btn-crown" href="${s.demo_url}" ${ext}>Get the free demo</a><a class="btn btn-ghost" href="/video-game">More about the video game</a></p>
      </div>
      ${img('/img/game/adventures-4.webp', 'Coffee World in the Coffee Time Adventures video game: a hedge maze lit by lanterns at night', 'width="1400" height="781" class="shot"')}
    </div>
  </section>

  ${featured.length
    ? html`<section class="quotes" aria-label="What players say">
      <div class="wrap">
        <ul class="quote-list">${featured.map((r) => html`<li><blockquote><p>${r.quote}</p></blockquote><p class="who">${r.name}, ${r.role}</p></li>`)}</ul>
        <p><a href="/community#reviews">Read all ${reviews.length} reviews</a></p>
      </div>
    </section>`
    : ''}

  <section class="davis" aria-labelledby="davis-title">
    <div class="wrap davis-grid">
      ${img('/img/purple-tree-team.webp', 'The Purple Tree Café team in Davis', 'width="1000" height="1333"')}
      <div>
        <h2 id="davis-title" class="display">${t(b, 'home_davis_title')}</h2>
        ${paragraphs(t(b, 'home_davis'))}
        <p class="actions"><a class="btn btn-line" href="/community">Meet the people behind it</a></p>
      </div>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ five worlds

export function worldsPage(s: Settings, b: B, worlds: World[]): Safe {
  const pages = Array.from({ length: 8 }, (_, i) => i + 1);
  return html`
  <section class="page-head head-purple">
    <div class="wrap">
      <h1 class="display">The Five Worlds</h1>
      <div class="lede">${paragraphs(t(b, 'worlds_intro'))}</div>
      <nav class="jump" aria-label="Worlds on this page"><ol>${worlds.map((w) => html`<li><a href="#${w.slug}">${w.name}</a></li>`)}<li><a href="#story">The illustrated story</a></li></ol></nav>
    </div>
  </section>
  ${worlds.map(
    (w, i) => html`<section class="world w-${w.slug}" id="${w.slug}">
      <div class="wrap world-grid">
        <div class="world-clock">${clock(w.name, `still s${i + 1}`, WORLD_HOURS[i] ?? 0)}<p>World ${i + 1} of ${worlds.length}</p></div>
        <div class="world-copy">
          <h2 class="display">${w.name}</h2>
          <p class="world-tag">${w.tagline}</p>
          ${paragraphs(w.body)}
          ${w.who ? html`<p class="world-who"><b>Who you meet here:</b> ${w.who}</p>` : ''}
        </div>
        <div class="world-art">${img(w.image, '')}</div>
      </div>
    </section>`,
  )}
  <section class="story" id="story" aria-labelledby="story-title">
    <div class="wrap">
      <h2 id="story-title" class="display">The illustrated story</h2>
      ${paragraphs(t(b, 'worlds_story'))}
      <ol class="story-pages">${pages.map((n) => html`<li><a href="/img/story/page-${String(n)}.webp">${img(`/img/story/page-${n}.webp`, `Coffee Time story, page ${n}`, 'width="1100" height="1405"')}<span>Page ${String(n)}</span></a></li>`)}</ol>
      <p class="actions"><a class="btn btn-line" href="${s.story_pdf}" ${ext}>Download the story (PDF)</a><a class="btn btn-crown" href="/order">Get the game</a></p>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ how to play

export function howToPlay(s: Settings, b: B, lessons: Lesson[], faqs: Faq[]): Safe {
  const chapters = [...new Set(lessons.map((l) => l.chapter))];
  const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return html`
  <section class="page-head head-brown">
    <div class="wrap">
      <h1 class="display">How to play</h1>
      <div class="lede">${paragraphs(t(b, 'play_intro'))}</div>
      <nav class="jump" aria-label="Chapters"><ol>${chapters.map((c) => html`<li><a href="#${slug(c)}">${c}</a></li>`)}<li><a href="#faq">Rules questions</a></li></ol></nav>
      <p class="actions"><a class="btn btn-crown" href="${s.rules_pdf}" ${ext}>Download the rulebook (PDF)</a></p>
    </div>
  </section>
  <div class="wrap rules">
    ${chapters.map(
      (c) => html`<section class="chapter" id="${slug(c)}" aria-labelledby="ch-${slug(c)}">
        <h2 id="ch-${slug(c)}" class="display">${c}</h2>
        <ol class="lessons">${lessons
          .filter((l) => l.chapter === c)
          .map((l) => html`<li id="lesson-${l.num.toLowerCase()}"><span class="num">${l.num}</span><div><h3>${l.title}</h3>${richText(l.body)}</div></li>`)}</ol>
      </section>`,
    )}
    <section class="chapter faq" id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title" class="display">Rules questions</h2>
      <p>Official answers for the first edition (2023).</p>
      ${faqs.map((f) => html`<details><summary>${f.question}</summary><div>${richText(f.answer)}</div></details>`)}
      <p class="ask">Stuck on something else? <a href="/contact?subject=Rules%20question">Ask us</a> and we will add it here.</p>
    </section>
  </div>`;
}

// ------------------------------------------------------------------ video game

export function videoGame(s: Settings, b: B, games: Game[]): Safe {
  const shots = [
    ['/img/game/adventures-2.webp', 'The Coffee Time Adventures title screen'],
    ['/img/game/adventures-5.webp', 'Little Miss Hot Shot jumping across floating platforms in space'],
    ['/img/game/adventures-6.webp', 'Little Miss Hot Shot inside a glowing machine room'],
    ['/img/game/adventures-1.webp', 'Characters gathered in Coffee World'],
    ['/img/game/adventures-3.webp', 'A wide view of a Coffee Time Adventures level'],
  ];
  // The first game is Coffee Time Adventures itself (this page); the rest are the quick arcade games.
  const more = games.slice(1);
  return html`
  <section class="page-head head-night">
    <div class="wrap game-head">
      <div>
        <h1 class="display">Coffee Time Adventures</h1>
        <div class="lede">${paragraphs(t(b, 'game_intro'))}</div>
        <p class="actions"><a class="btn btn-crown btn-big" href="${s.demo_url}" ${ext}>Download the free demo</a></p>
      </div>
      ${img('/img/little-miss-hot-shot.webp', 'Little Miss Hot Shot', 'class="lmhs" width="461" height="478"')}
    </div>
  </section>
  <section class="section">
    <div class="wrap two">
      ${img('/img/game/adventures-4.webp', 'Coffee World: a hedge maze lit by lanterns', 'class="shot" width="1400" height="781"')}
      <div><h2 class="display">In the demo</h2>${richText(t(b, 'game_demo'))}</div>
    </div>
  </section>
  <section class="section shots-band">
    <div class="wrap"><ul class="shots">${shots.map(([src, alt]) => html`<li><a href="${src}">${img(src, alt, 'width="1400" height="788"')}</a></li>`)}</ul></div>
  </section>
  <section class="section">
    <div class="wrap two">
      <div><h2 class="display">Built by a game club</h2>${paragraphs(t(b, 'game_club'))}</div>
      ${img('/img/creator-sheet.webp', 'Coffee Time character design sheet', 'class="shot" width="1600" height="1036"')}
    </div>
  </section>
  ${more.length
    ? html`<section class="section arcade" aria-labelledby="arcade-title">
      <div class="wrap">
        <h2 id="arcade-title" class="display">Quick games you can play right now</h2>
        <ul class="arcade-list">${more.map(
          (g) => html`<li>${img(g.image, `${g.title} screenshot`)}<div><h3>${g.title}</h3><p>${g.blurb}</p><p class="small">${g.platform}</p><a class="btn btn-line" href="${g.url}" ${ext}>Play ${g.title}</a></div></li>`,
        )}</ul>
      </div>
    </section>`
    : ''}`;
}

// ------------------------------------------------------------------ music

export function music(s: Settings, b: B, tracks: Track[]): Safe {
  const main = tracks.filter((x) => !x.archive);
  const archive = tracks.filter((x) => x.archive);
  const player = (id: string) =>
    `https://w.soundcloud.com/player/?url=${encodeURIComponent('https://api.soundcloud.com/tracks/' + id)}&color=%238e3cc0&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;
  return html`
  <section class="page-head head-warp">
    <div class="wrap">
      <h1 class="display">Warp World music</h1>
      <div class="lede">${paragraphs(t(b, 'music_intro'))}</div>
    </div>
  </section>
  <div class="wrap section">
    <ol class="tracks">${main.map(
      (x) => html`<li>
        ${x.image ? img(x.image, '', 'class="art"') : html`<span class="art"></span>`}
        <div class="track-main">
          <h2>${x.title}</h2><p class="small">${x.world}</p>
          ${x.soundcloud_id
            ? html`<details class="listen"><summary>Play here</summary><iframe title="${x.title} on SoundCloud" src="${player(x.soundcloud_id)}" loading="lazy" allow="autoplay"></iframe></details>`
            : ''}
        </div>
        <a class="sc" href="${x.url}" ${ext}>SoundCloud</a>
      </li>`,
    )}</ol>
    ${archive.length
      ? html`<h2 class="display small-display">From the first website</h2>
      <ul class="plain-links">${archive.map((x) => html`<li><a href="${x.url}" ${ext}>${x.title}</a></li>`)}</ul>`
      : ''}
    <p>More from the artists on <a href="${s.soundcloud}" ${ext}>eNuminous's SoundCloud</a>.</p>
  </div>`;
}

// ------------------------------------------------------------------ community

export function community(s: Settings, b: B, reviews: Review[]): Safe {
  const art = [
    ['/img/card-wind-feather.webp', 'Wind Feather card'],
    ['/img/card-team-warp.webp', 'Team Warp card'],
    ['/img/card-sugar-cube.webp', 'Sugar Cube card'],
    ['/img/card-ice.webp', 'Ice card'],
    ['/img/card-earth.webp', 'Earth card'],
    ['/img/dottie.webp', 'Dotty, the Honey Bee Queen'],
    ['/img/pup-pups.webp', 'The pup-pups'],
    ['/img/deep-space-kruiser.webp', 'The Deep Space Kruiser'],
  ];
  return html`
  <section class="page-head head-purple">
    <div class="wrap">
      <h1 class="display">The people behind it</h1>
      <div class="lede">${paragraphs(t(b, 'community_intro'))}</div>
    </div>
  </section>
  <section class="section">
    <div class="wrap two">
      <div><h2 class="display">Who made the game</h2>${paragraphs(t(b, 'community_creators'))}</div>
      ${img('/img/comic-con-collage.webp', 'Players at the Coffee Time table at San Diego Comic-Con', 'class="shot" width="1200" height="1200"')}
    </div>
  </section>
  <section class="section quotes-all" id="reviews" aria-labelledby="reviews-title">
    <div class="wrap">
      <h2 id="reviews-title" class="display">What players say</h2>
      <ul class="review-grid">${reviews.map((r) => html`<li><blockquote><p>${r.quote}</p></blockquote><p class="who">${r.name}<span>${r.role}</span></p></li>`)}</ul>
    </div>
  </section>
  <section class="section">
    <div class="wrap two">
      ${img('/img/purple-tree-team.webp', 'The Purple Tree Café team', 'class="shot" width="1000" height="1333"')}
      <div>
        <h2 class="display">${s.charity_name}</h2>${paragraphs(t(b, 'community_charity'))}
        <p class="actions"><a class="btn btn-line" href="${s.charity_url}" ${ext}>Visit ${s.charity_name}</a><a class="btn btn-line" href="https://www.youtube.com/watch?v=N3I5WNw7kmk" ${ext}>Watch their story</a></p>
        <h2 class="display">HMP Bikes</h2>${paragraphs(t(b, 'community_hmp'))}
        <p class="actions"><a class="btn btn-line" href="https://www.hmpbikes.com/" ${ext}>Visit HMP Bikes</a></p>
      </div>
    </div>
  </section>
  <section class="section art-band" aria-labelledby="art-title">
    <div class="wrap">
      <h2 id="art-title" class="display">From the art box</h2>
      <ul class="art-grid">${art.map(([src, alt]) => html`<li>${img(src, alt)}<span>${alt}</span></li>`)}</ul>
      ${img('/img/hmp-bikes.webp', 'Coffee Time characters riding HMP bikes', 'class="hmp" width="1000" height="1152"')}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ news

export function news(items: News[]): Safe {
  return html`
  <section class="page-head head-brown"><div class="wrap"><h1 class="display">News</h1><div class="lede"><p>Conventions, radio, milestones and the video game, newest first.</p></div></div></section>
  <div class="wrap section">
    <ol class="timeline">${items.map(
      (n) => html`<li>
        <p class="when">${n.date_label}</p>
        <div class="entry ${n.image ? 'has-img' : ''}">
          <div><h2>${n.title}</h2>${paragraphs(n.body)}${n.url ? html`<p><a class="btn btn-line" href="${n.url}" ${/^https?:/.test(n.url) ? ext : ''}>${n.link_label || 'Read more'}</a></p>` : ''}</div>
          ${n.image ? img(n.image, n.image_alt) : ''}
        </div>
      </li>`,
    )}</ol>
  </div>`;
}

// ------------------------------------------------------------------ order

export type FormState = { sent?: boolean; error?: string; values?: Record<string, string> };

export function order(s: Settings, b: B, st: FormState): Safe {
  const v = st.values || {};
  const max = Math.max(1, parseInt(s.max_quantity || '10', 10));
  const qty = Math.min(max, Math.max(1, parseInt(v.quantity || '1', 10) || 1));
  const open = s.orders_open !== '0';
  return html`
  <section class="page-head head-purple order-head">
    <div class="wrap order-top">
      <div>
        <h1 class="display">Order Coffee Time</h1>
        <p class="price price-big"><b>${money(s)}</b> ${s.edition}, plus shipping</p>
        ${shields(s)}
      </div>
      ${img('/img/box-front.webp', 'The Coffee Time box', 'class="boxfront" width="1400" height="710"')}
    </div>
  </section>
  <div class="wrap section order-grid">
    <div class="order-form">
      ${st.sent
        ? html`<div class="notice notice-ok" role="status"><h2>Order request sent</h2>${paragraphs(t(b, 'order_after'))}<p><a href="/">Back to the home page</a></p></div>`
        : !open
          ? html`<div class="notice"><h2>Orders are paused</h2><p>We are restocking. Email <a href="mailto:${s.email}">${s.email}</a> and we will tell you when copies are ready.</p></div>`
          : html`${paragraphs(t(b, 'order_intro'))}
          ${st.error ? html`<p class="notice notice-err" role="alert">${st.error}</p>` : ''}
          <form method="post" action="/order" class="form">
            <input type="hidden" name="_t" value="${String(Date.now())}">
            <p class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></p>
            <div class="row2">
              <label>Your name <input name="name" required autocomplete="name" value="${v.name || ''}" maxlength="120"></label>
              <label>Email <input name="email" type="email" required autocomplete="email" value="${v.email || ''}" maxlength="200"></label>
            </div>
            <div class="row2">
              <label>Phone <small>optional, in case shipping needs a number</small><input name="phone" type="tel" autocomplete="tel" value="${v.phone || ''}" maxlength="40"></label>
              <label>How many games
                <select name="quantity">${Array.from({ length: max }, (_, i) => i + 1).map((n) => html`<option value="${String(n)}" ${n === qty ? raw('selected') : ''}>${String(n)}</option>`)}</select>
              </label>
            </div>
            <label>Shipping address <textarea name="address" rows="4" required autocomplete="street-address" maxlength="600">${v.address || ''}</textarea></label>
            <label>Anything else? <small>gift note, pickup in Davis, a question</small><textarea name="notes" rows="3" maxlength="1500">${v.notes || ''}</textarea></label>
            <label class="check"><input type="checkbox" name="newsletter" value="1" ${v.newsletter ? raw('checked') : ''}> Email me when there is Coffee Time news (a few times a year)</label>
            <p><button class="btn btn-crown btn-big">Send my order request</button></p>
            <div class="small">${paragraphs(t(b, 'order_local'))}</div>
          </form>`}
    </div>
    <aside class="order-side">
      <h2>What you get</h2>
      ${richText(t(b, 'home_box'))}
      <p class="small">${s.charity_percent}% of every game sold supports <a href="${s.charity_url}" ${ext}>${s.charity_name}</a> in Davis.</p>
      <p class="small">Prefer email? Write to <a href="mailto:${s.email}?subject=Coffee%20Time%20order">${s.email}</a> with your name, how many games, your address and a phone number.</p>
    </aside>
  </div>`;
}

// ------------------------------------------------------------------ contact

export const CONTACT_SUBJECTS = ['Rules question', 'Events and schools', 'Press', 'Wholesale or stores', 'Something else'];

export function contact(s: Settings, b: B, st: FormState): Safe {
  const v = st.values || {};
  return html`
  <section class="page-head head-brown"><div class="wrap"><h1 class="display">Contact us</h1><div class="lede">${paragraphs(t(b, 'contact_intro'))}</div></div></section>
  <div class="wrap section narrow">
    ${st.sent
      ? html`<div class="notice notice-ok" role="status"><h2>Message sent</h2><p>Thanks. We read every message and reply by email, usually within a few days.</p></div>`
      : html`${st.error ? html`<p class="notice notice-err" role="alert">${st.error}</p>` : ''}
      <form method="post" action="/contact" class="form">
        <input type="hidden" name="_t" value="${String(Date.now())}">
        <p class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></p>
        <div class="row2">
          <label>Your name <input name="name" required autocomplete="name" value="${v.name || ''}" maxlength="120"></label>
          <label>Email <input name="email" type="email" required autocomplete="email" value="${v.email || ''}" maxlength="200"></label>
        </div>
        <label>What is it about?
          <select name="subject">${CONTACT_SUBJECTS.map((x) => html`<option ${x === v.subject ? raw('selected') : ''}>${x}</option>`)}</select>
        </label>
        <label>Message <textarea name="body" rows="7" required maxlength="4000">${v.body || ''}</textarea></label>
        <p><button class="btn btn-crown">Send message</button></p>
      </form>
      <p class="small">Or email <a href="mailto:${s.email}">${s.email}</a>. Want a game? Use the <a href="/order">order form</a>.</p>`}
  </div>`;
}

// ------------------------------------------------------------------ 404

export function notFound(): Safe {
  return html`<section class="page-head head-warp lost"><div class="wrap">
    <h1 class="display">Lost in Warp World</h1>
    <div class="lede"><p>That page does not exist, or it moved when we left the old website.</p></div>
    <p class="actions"><a class="btn btn-crown" href="/">Go to the home page</a><a class="btn btn-ghost" href="/how-to-play">How to play</a></p>
  </div></section>`;
}

export { inline };
