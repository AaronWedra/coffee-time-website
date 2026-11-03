/* ============================================================
   COFFEE TIME ARENA: the pieces both 2026 games share.
   Sprites with small life, King Tea's clock, chat and taunts,
   the room glue (host-authoritative, clock-synced), human-paced AI
   helpers, sound, install prompt. No libraries.
   ============================================================ */
(function () {
  'use strict';
  const A = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  A.$ = $; A.$$ = $$;
  A.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'style') el.style.cssText = attrs[k];
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  A.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  A.rand = (a, b) => a + Math.random() * (b - a);
  A.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  A.sleep = ms => new Promise(r => setTimeout(r, ms));
  A.uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------- the cast ---------- */
  A.CHARS = {
    joe:     { name: 'Cup Joe',               img: '/img/cup-joe.webp',              side: 'coffee', color: '#f2a93b' },
    thermos: { name: 'Thermos',               img: '/img/thermos.webp',              side: 'coffee', color: '#5bc0eb' },
    miss:    { name: 'Little Miss Hot Shot',  img: '/img/little-miss-hot-shot.webp', side: 'coffee', color: '#f06292' },
    don:     { name: 'Donette',               img: '/img/donette.webp',              side: 'coffee', color: '#b388ff' },
    king:    { name: 'King Tea',              img: '/img/king-tea.webp',             side: 'tea',    color: '#8d6e63' },
    roamer:  { name: 'The Roamer',            img: '/img/roamer.webp',               side: 'tea',    color: '#78909c' },
    duchess: { name: 'The Duchess',           img: '/img/duchess.webp',              side: 'tea',    color: '#ab47bc' },
    crumpet: { name: 'Crumpet',               img: '/img/crumpet.webp',              side: 'tea',    color: '#c8a165' },
    meangirl:{ name: 'Mean Girl Crumpets',    img: '/img/mean-girl-crumpets.webp',   side: 'tea',    color: '#e57373' },
  };
  A.HEROES = ['joe', 'thermos', 'miss', 'don'];
  A.WORLDS = [
    { id: 'coffee',  name: 'Coffee World',  bg: 'linear-gradient(160deg,#4a2c1a,#8b5a2b)', accent: '#f2a93b' },
    { id: 'donut',   name: 'Donut World',   bg: 'linear-gradient(160deg,#7a2f5a,#e86aa6)', accent: '#ffb3d9' },
    { id: 'warp',    name: 'Warp World',    bg: 'linear-gradient(160deg,#1b1646,#5a3fb8)', accent: '#b388ff' },
    { id: 'crumpet', name: 'Crumpet World', bg: 'linear-gradient(160deg,#3b3a1e,#9a8a3a)', accent: '#e6d36b' },
    { id: 'tea',     name: 'Tea World',     bg: 'linear-gradient(160deg,#0f2a2e,#2f6b73)', accent: '#7fd1c8' },
  ];
  A.TAUNTS = {
    coffee: ['Smell that? Fresh roast coming for you.', 'Your clock is slow, King Tea.', 'Brew-tiful move, team!', 'Stay warm out there!', 'That crumpet never saw it coming.', 'Pour it on!'],
    tea:    ['Tick tock, heroes.', 'The Roamer sends his regards.', 'Your coffee is getting cold.', 'Crumpets, assemble!', 'Overtime is my favourite time.', 'Freeze!'],
    all:    ['GG!', 'Nice one!', 'Oops.', 'Hurry!', 'BEHIND YOU', 'lol'],
  };

  /* ---------- sprites with small life ---------- */
  // A sprite is a box with the sticker, a shine band and a frost overlay. Classes drive the animation.
  A.sprite = function (kind, opts) {
    opts = opts || {};
    const c = A.CHARS[kind] || { name: kind, img: '' };
    const el = A.h('div', { class: 'ct-sprite ct-' + kind, style: 'animation-delay:' + (-Math.random() * 2).toFixed(2) + 's' },
      A.h('img', { src: c.img, alt: c.name, draggable: 'false' }),
      A.h('div', { class: 'ct-shine' }),
      A.h('div', { class: 'ct-frost' }),
      opts.label === false ? null : A.h('div', { class: 'ct-label' }, opts.label || c.name));
    if (opts.size) el.style.setProperty('--size', opts.size + 'px');
    el.style.setProperty('--mask', `url("${c.img}") center / contain no-repeat`);
    const api = {
      el, kind,
      hit() { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); A.sound.hit(); setTimeout(() => el.classList.remove('hit'), 300); },
      swing() { el.classList.remove('swing'); void el.offsetWidth; el.classList.add('swing'); setTimeout(() => el.classList.remove('swing'), 420); },
      freeze(on) { el.classList.toggle('frozen', !!on); if (on) A.sound.freeze(); },
      flip(on) { el.classList.toggle('flip', !!on); },
      blink() { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 120); },
      say(text, ms) {
        let b = $('.ct-bubble', el);
        if (!b) { b = A.h('div', { class: 'ct-bubble' }); el.append(b); }
        b.textContent = text; b.classList.add('show');
        clearTimeout(api._bt); api._bt = setTimeout(() => b.classList.remove('show'), ms || 1800);
      },
      remove() { clearInterval(api._bi); el.remove(); },
    };
    // random blink: the stand-in until layered eye art exists (a quick 8% vertical squash)
    api._bi = setInterval(() => { if (Math.random() < 0.5) api.blink(); }, 3000 + Math.random() * 3000);
    return api;
  };

  /* ---------- King Tea's clock ---------- */
  // 60 hours = five laps of a 12-hour dial. Shows the hour hand, the hours number and the world.
  A.clock = function (container, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const svgNS = 'http://www.w3.org/2000/svg';
    const el = A.h('div', { class: 'ct-clock' });
    el.innerHTML = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="King Tea's clock">
      <circle cx="50" cy="50" r="47" class="ct-clock-face"/>
      <circle cx="50" cy="50" r="47" class="ct-clock-ring"/>
      ${[...Array(12)].map((_, i) => { const a = i * 30 * Math.PI / 180; const r1 = i % 3 === 0 ? 38 : 41; return `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}" class="ct-clock-tick"/>`; }).join('')}
      <path class="ct-clock-arc" d="" />
      <g class="ct-clock-hand"><line x1="50" y1="54" x2="50" y2="18" /><circle cx="50" cy="50" r="3.5"/></g>
      <text x="50" y="68" text-anchor="middle" class="ct-clock-num">0h</text>
    </svg><div class="ct-clock-world"></div>`;
    container.append(el);
    const hand = $('.ct-clock-hand', el), num = $('.ct-clock-num', el), arc = $('.ct-clock-arc', el), world = $('.ct-clock-world', el);
    let shown = 0;
    const api = {
      el,
      set(hours, worldName) {
        hours = A.clamp(hours, 0, 60);
        const deg = (hours % 12) * 30;
        hand.style.transform = `rotate(${deg}deg)`;
        num.textContent = (Math.round(hours * 10) / 10) + 'h';
        // the arc shows total progress to 60
        const t = hours / 60, a = t * Math.PI * 2, R = 47;
        const x = 50 + Math.sin(a) * R, y = 50 - Math.cos(a) * R;
        arc.setAttribute('d', t <= 0 ? '' : `M50,3 A${R},${R} 0 ${t > 0.5 ? 1 : 0},1 ${x},${y}`);
        el.classList.toggle('overtime', hours >= 48);
        if (worldName) world.textContent = worldName;
        if (Math.floor(hours) > Math.floor(shown)) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
        shown = hours;
      },
    };
    api.set(opts.hours || 0, opts.world || '');
    return api;
  };

  /* ---------- sound (tiny, WebAudio, no files) ---------- */
  A.sound = (function () {
    let ctx, muted = false;
    try { muted = localStorage.getItem('ct_mute') === '1'; } catch (e) {}
    function beep(f, d, type, g) {
      if (muted) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(), v = ctx.createGain();
        o.type = type || 'sine'; o.frequency.value = f; v.gain.value = g || 0.06;
        o.connect(v); v.connect(ctx.destination); o.start();
        v.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d); o.stop(ctx.currentTime + d);
      } catch (e) {}
    }
    return {
      hit() { beep(180, 0.12, 'square', 0.05); },
      swing() { beep(520, 0.06, 'triangle'); },
      tap() { beep(880, 0.04, 'sine', 0.04); },
      freeze() { beep(240, 0.5, 'sine'); setTimeout(() => beep(160, 0.5, 'sine'), 120); },
      tick() { beep(1200, 0.03, 'sine', 0.03); },
      chime() { beep(660, 0.2, 'triangle'); setTimeout(() => beep(990, 0.3, 'triangle'), 150); },
      win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.07), i * 120)); },
      lose() { [400, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.35, 'sawtooth', 0.05), i * 180)); },
      rumble() { beep(60, 0.5, 'sawtooth', 0.08); },
      mute(m) { muted = m; try { localStorage.setItem('ct_mute', m ? '1' : '0'); } catch (e) {} },
      get muted() { return muted; },
    };
  })();

  /* ---------- human-paced AI helpers ---------- */
  A.ai = {
    // a visible pause before an AI acts: reads as a decision
    think: (min, max) => A.sleep(A.rand(min || 300, max || 800)),
    // accuracy roll for a timing ring, 0..1 where 1 is the sweet spot
    aim: (skill) => A.clamp(1 - Math.abs((Math.random() + Math.random()) / 2 - 0.5) * (2 - (skill || 0.75) * 1.6), 0, 1),
  };

  /* ---------- chat and taunts ---------- */
  A.chat = function (container, opts) {
    const log = A.h('div', { class: 'ct-chatlog' });
    const taunts = A.h('div', { class: 'ct-taunts' });
    const input = A.h('input', { class: 'ct-chatin', placeholder: 'Say something', maxlength: '120' });
    const send = A.h('button', { class: 'ct-btn sm' }, 'Send');
    const form = A.h('form', { class: 'ct-chatform' }, input, send);
    const el = A.h('div', { class: 'ct-chat' }, log, taunts, form);
    container.append(el);
    function render(side) {
      taunts.innerHTML = '';
      const list = (A.TAUNTS[side] || []).concat(A.TAUNTS.all);
      for (const t of list) taunts.append(A.h('button', { class: 'ct-taunt', type: 'button', onclick: () => opts.onSend({ text: t, taunt: true }) }, t));
    }
    render(opts.side || 'coffee');
    form.addEventListener('submit', e => { e.preventDefault(); const text = input.value.trim(); if (!text) return; opts.onSend({ text, taunt: false }); input.value = ''; });
    return {
      el,
      side(s) { render(s); },
      add(msg) {
        const line = A.h('div', { class: 'ct-chatline' + (msg.taunt ? ' taunt' : '') + (msg.mine ? ' mine' : '') }, A.h('b', null, msg.from + ': '), msg.text);
        log.append(line); log.scrollTop = log.scrollHeight;
        while (log.children.length > 80) log.firstChild.remove();
      },
    };
  };

  /* ---------- transport ---------- */
  let clientId;
  try { clientId = sessionStorage.getItem('ct_client') || (Math.random().toString(36).slice(2) + Date.now().toString(36)); sessionStorage.setItem('ct_client', clientId); } catch (e) { clientId = Math.random().toString(36).slice(2); }
  A.clientId = clientId;
  function wsUrl(code) { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/room/' + encodeURIComponent(code); }

  /* ---------- the room: host-authoritative, clock-synced ----------
     room = A.room({ game:'overtime', name, code, onMembers, onState, onEvent, onInput(host only), onPrivate, onChat, onError, onHostChange })
     room.isHost, room.me, room.host, room.members, room.settings
     room.setState(state)        host broadcasts full state (persisted for reconnect)
     room.event(data)            host broadcasts a transient event (a fight replay, a chat-like notice)
     room.input(data)            anyone sends to the host (host handles its own locally, same path)
     room.toClient(id, data)     host sends a private message (a role card)
     room.now()                  host-clock estimate on every phone
  */
  A.room = function (opts) {
    const R = { me: clientId, host: null, members: [], settings: {}, isHost: false, offset: 0, closed: false };
    const samples = [];
    let ws, retry = 0, timer;
    function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
    function noteOffset(at) { if (!at) return; samples.push(at - Date.now()); if (samples.length > 10) samples.shift(); const s = [...samples].sort((a, b) => a - b); R.offset = s[Math.floor(s.length / 2)]; }
    function setHost(id) { const was = R.isHost; R.host = id; R.isHost = id === R.me; if (was !== R.isHost && opts.onHostChange) opts.onHostChange(R.isHost); }
    function open() {
      try { ws = new WebSocket(wsUrl(opts.code)); } catch (e) { opts.onError && opts.onError('Could not reach the room server.'); return; }
      ws.addEventListener('open', () => { retry = 0; send({ t: 'join', name: opts.name, clientId }); });
      ws.addEventListener('message', ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        switch (m.t) {
          case 'joined': R.members = m.members; R.settings = m.settings || {}; setHost(m.host); opts.onJoined && opts.onJoined(m); opts.onMembers && opts.onMembers(R.members); if (m.state && opts.onState) opts.onState(m.state, true); break;
          case 'members': R.members = m.members; R.settings = m.settings || {}; setHost(m.host); opts.onMembers && opts.onMembers(R.members); break;
          case 'state': opts.onState && opts.onState(m.state, false); break;
          case 'event': noteOffset(m.at); opts.onEvent && opts.onEvent(m.data); break;
          case 'input': if (R.isHost) { noteOffset(m.at); opts.onInput && opts.onInput(m.data, m.from); } break;
          case 'private': opts.onPrivate && opts.onPrivate(m.data); break;
          case 'chat': if (m.from !== clientId) opts.onChat && opts.onChat(m.msg); break;
          case 'start': opts.onStart && opts.onStart(); break;
          case 'restart': opts.onRestart && opts.onRestart(); break;
          case 'error': opts.onError && opts.onError(m.message); break;
        }
      });
      ws.addEventListener('close', () => { if (R.closed) return; opts.onClose && opts.onClose(); retry++; if (retry > 8) { opts.onError && opts.onError('Lost the room server.'); return; } timer = setTimeout(open, Math.min(8000, 500 * Math.pow(2, retry))); });
    }
    open();
    R.setState = s => { if (R.isHost) send({ t: 'state', state: s }); };
    R.event = d => { if (R.isHost) { send({ t: 'event', data: d }); } };
    R.input = d => { if (R.isHost) { opts.onInput && opts.onInput(d, R.me); } else send({ t: 'input', data: d }); };
    R.toClient = (id, d) => { if (!R.isHost) return; if (id === R.me) { opts.onPrivate && opts.onPrivate(d); } else send({ t: 'to', to: id, data: d }); };
    R.chat = msg => send({ t: 'chat', msg });
    R.seat = s => send({ t: 'seat', seat: s });
    R.settingsSet = s => { if (R.isHost) send({ t: 'settings', settings: s }); };
    R.start = () => { if (R.isHost) send({ t: 'start' }); };
    R.restart = () => { if (R.isHost) send({ t: 'restart' }); };
    R.now = () => Date.now() + (R.isHost ? 0 : R.offset);
    R.close = () => { R.closed = true; clearTimeout(timer); if (ws) ws.close(); };
    return R;
  };

  /* ---------- invite links and codes ---------- */
  A.makeCode = () => { const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += L[Math.floor(Math.random() * L.length)]; return s; };
  A.inviteUrl = code => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', code); return u.toString(); };
  A.share = async (code, title) => {
    const url = A.inviteUrl(code);
    if (navigator.share) { try { await navigator.share({ title, text: 'Join my Coffee Time room: ' + code, url }); return true; } catch (e) {} }
    try { await navigator.clipboard.writeText(url); A.toast('Invite link copied'); return true; } catch (e) { A.toast(url); return false; }
  };

  /* ---------- small UI ---------- */
  A.toast = (text, ms) => {
    let t = $('.ct-toast'); if (!t) { t = A.h('div', { class: 'ct-toast' }); document.body.append(t); }
    t.textContent = text; t.classList.add('show'); clearTimeout(A._tt); A._tt = setTimeout(() => t.classList.remove('show'), ms || 2200);
  };
  A.modal = (content, opts) => {
    opts = opts || {};
    const box = A.h('div', { class: 'ct-modal' }, content);
    const wrap = A.h('div', { class: 'ct-modal-wrap' }, box);
    if (opts.dismiss !== false) wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    document.body.append(wrap);
    return { el: wrap, close() { wrap.remove(); } };
  };
  A.shake = (el, px, ms) => { el.style.setProperty('--shake', (px || 4) + 'px'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), ms || 300); };
  A.flash = el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 120); };

  // a countdown driven by a host-clock deadline
  A.countdown = (el, endsAt, nowFn, onEnd) => {
    let done = false;
    function tick() {
      if (done) return;
      const left = Math.max(0, endsAt - nowFn());
      el.textContent = Math.ceil(left / 1000);
      el.classList.toggle('urgent', left < 5000);
      if (left <= 0) { done = true; onEnd && onEnd(); return; }
      requestAnimationFrame(tick);
    }
    tick();
    return { stop() { done = true; } };
  };

  /* ---------- install prompt ---------- */
  A.install = function (button) {
    let deferred = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; button.hidden = false; });
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (ios && !standalone) button.hidden = false;
    button.addEventListener('click', async () => {
      if (deferred) { deferred.prompt(); deferred = null; button.hidden = true; return; }
      A.modal(A.h('div', null, A.h('h3', null, 'Add to your home screen'), A.h('p', null, 'In Safari, tap the Share button, then "Add to Home Screen". Cup Joe appears as the icon.'), A.h('p', null, 'On Android Chrome: menu, then "Add to Home screen".')));
    });
  };

  A.playerName = () => { let n = ''; try { n = localStorage.getItem('ct_name') || ''; } catch (e) {} return n; };
  A.savePlayerName = n => { try { localStorage.setItem('ct_name', n); } catch (e) {} };

  window.Arena = A;
})();
