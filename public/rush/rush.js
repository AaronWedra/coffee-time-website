/* ============================================================
   COFFEE TIME: RUSH HOUR, the app.
   Screens, the lobby, the host loop (the engine runs here),
   the client view (snapshots in, inputs out), and every effect.
   ============================================================ */
(function () {
  'use strict';
  const A = window.Arena, E = window.RushEngine;
  const $ = A.$, h = A.h;
  const SEAT_HERO = { s0: 'joe', s1: 'thermos', s2: 'miss', s3: 'don' };
  const HERO_SEAT = { joe: 's0', thermos: 's1', miss: 's2', don: 's3' };
  const LANE_COL = {}; E.LANES.forEach((l, i) => LANE_COL[l] = i);
  const ROWH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rowh')) || 40;

  /* ---------- app state ---------- */
  const G = {
    mode: null,          // 'solo' | 'host' | 'client'
    myHero: 'joe',       // hero key I control (or null when I am a villain)
    myRole: 'hero',      // 'hero' | 'roamer' | 'duchess' | 'spectator'
    room: null, code: null, name: '',
    sim: null,           // engine state (solo/host)
    inputs: [],          // queued inputs for the next tick (solo/host)
    snap: null, snapAt: 0, lastSnap: null,
    tickTimer: null, raf: null,
    chat: null, lobbyChat: null,
    ents: {},            // id -> {el, sprite, kind}
    clock: null,
    ringMode: null,      // 'hero' | 'enemy' | null
    ringDeadline: 0,     // host-ms when the ring reaches the target
    swung: false,
    stateTimer: 0,
  };

  /* ---------- screens ---------- */
  function go(id) { A.$$('.ct-screen').forEach(s => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0); }
  A.$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

  // home cast
  const cast = $('#homeCast');
  for (const k of ['joe', 'thermos', 'miss', 'don']) cast.append(A.sprite(k, { label: false }).el);
  A.install($('#btnInstall'));

  $('#btnHow').addEventListener('click', () => A.modal(h('div', { class: 'howto' },
    h('h3', null, 'How to play'),
    h('p', null, 'King Tea\'s clock is always running. Reach the Activation Chamber at the top of each world and hold the button before it hits 60 hours.'),
    h('p', null, h('b', null, 'Move: '), 'tap a space ahead on your lane. At a crossroads (the bars at 4 and 8) tap the middle lane to hop onto the Team Path, where the Duchess cannot reach you and Donette makes everyone fast.'),
    h('p', null, h('b', null, 'Fight: '), 'a crumpet winds up for a second. When the yellow ring closes on the target, tap SWING. Dead centre is a full hit; late is half. Then it swings back.'),
    h('p', null, h('b', null, 'Heat: '), 'your brew drains in the cold and with every swing. Stand next to a teammate or on a coffee bean to warm up. At zero you freeze for 8 seconds; a teammate beside you thaws you twice as fast.'),
    h('p', null, h('b', null, 'The Duchess '), 'sweeps a row every 40 seconds (you will hear the chime). The Roamer rises from a grave, swings, then snatches your card, and the ground slides when he sinks.'),
    h('p', null, h('b', null, 'Cards: '), 'clear a nest and pick one of three Journey Cards in two seconds. Tap your card to play it.'),
    h('p', { class: 'ct-muted' }, 'Every world under 10 hours pauses the clock during the break. Overtime starts at 48 hours.'),
  )));

  /* ---------- solo setup ---------- */
  const pick = $('#pickHero'); let soloHero = 'joe';
  for (const k of E.HEROES) {
    const o = h('div', { class: 'opt' + (k === soloHero ? ' sel' : ''), onclick: () => { soloHero = k; A.$$('.opt', pick).forEach(x => x.classList.toggle('sel', x.dataset.k === k)); } , 'data-k': k }, A.sprite(k, { label: false }).el, h('small', null, A.CHARS[k].name));
    pick.append(o);
  }
  $('#btnSolo').addEventListener('click', () => go('s-solo'));
  $('#btnSoloGo').addEventListener('click', () => startSolo(soloHero));

  /* ---------- host / join ---------- */
  let nameMode = 'host';
  $('#btnHost').addEventListener('click', () => { nameMode = 'host'; $('#nameTitle').textContent = 'Host a room'; $('#joinCodeWrap').hidden = true; $('#inName').value = A.playerName(); go('s-name'); });
  $('#btnJoin').addEventListener('click', () => { nameMode = 'join'; $('#nameTitle').textContent = 'Join a room'; $('#joinCodeWrap').hidden = false; $('#inName').value = A.playerName(); go('s-name'); });
  $('#btnNameGo').addEventListener('click', () => {
    const name = $('#inName').value.trim() || 'Player'; A.savePlayerName(name); G.name = name;
    const code = nameMode === 'host' ? A.makeCode() : $('#inCode').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) { A.toast('Enter the 4-letter room code'); return; }
    joinRoom(code, name);
  });
  (function autoJoin() { const u = new URL(location.href); const c = (u.searchParams.get('room') || '').toUpperCase(); if (/^[A-Z0-9]{4}$/.test(c)) { nameMode = 'join'; $('#nameTitle').textContent = 'Join room ' + c; $('#joinCodeWrap').hidden = false; $('#inCode').value = c; $('#inName').value = A.playerName(); go('s-name'); } })();

  function joinRoom(code, name) {
    G.code = code; G.mode = 'client';
    $('#lobbyCode').textContent = code;
    if (G.room) G.room.close();
    G.room = A.room({
      code, name, game: 'rush',
      onJoined(m) { go('s-lobby'); renderLobby(); },
      onMembers() { renderLobby(); },
      onHostChange(isHost) { renderLobby(); if (isHost && G.sim && G.mode === 'client') takeOverHost(); },
      onStart() { if (!G.room.isHost) beginClient(); },
      onRestart() { if (!G.room.isHost) { stopGame(); go('s-lobby'); renderLobby(); } },
      onState(state, initial) { if (!G.room.isHost) { onSnapshot(state, []); if (initial && state && state.ph && state.ph !== 'end') beginClient(); } },
      onEvent(data) { if (!G.room.isHost && data && data.k === 'snap') onSnapshot(data.s, data.ev, data.at); },
      onInput(data, from) { if (G.room.isHost) hostInput(data, from); },
      onChat(msg) { addChat(msg); },
      onError(m) { A.toast(m); },
      onClose() {},
    });
    if (!G.lobbyChat) { G.lobbyChat = A.chat($('#lobbyChat'), { side: 'coffee', onSend: sendChat }); }
  }
  function sendChat(m) { const msg = { id: A.uid(), text: m.text, taunt: m.taunt, side: mySide() }; if (G.room) G.room.chat(msg); addChat(Object.assign({ from: G.name || 'You', mine: true }, msg)); }
  function addChat(msg) { if (G.lobbyChat) G.lobbyChat.add(msg); if (G.chat) G.chat.add(msg); if (msg.taunt && G.mode !== null && $('#s-game').classList.contains('on')) { const heroKey = heroOfMember(msg.from); const ent = heroKey && G.ents['h:' + heroKey]; if (ent) ent.sprite.say(msg.text, 2200); else A.toast(msg.from + ': ' + msg.text); } }
  function heroOfMember(name) { if (!G.room) return null; const m = G.room.members.find(x => x.name === name); return m && SEAT_HERO[m.seat] || null; }
  function mySide() { return G.myRole === 'roamer' || G.myRole === 'duchess' ? 'tea' : 'coffee'; }

  function renderLobby() {
    const R = G.room; if (!R) return;
    const seats = $('#seats'); seats.innerHTML = '';
    const n = R.members.length;
    const list = [['s0', 'joe'], ['s1', 'thermos'], ['s2', 'miss'], ['s3', 'don']];
    if (n >= 5) list.push(['s4', 'roamer']); if (n >= 6) list.push(['s5', 'duchess']);
    const me = R.members.find(m => m.id === R.me);
    for (const [seat, kind] of list) {
      const who = R.members.find(m => m.seat === seat);
      const el = h('div', { class: 'ct-seat' + (who ? ' taken' : '') + (me && me.seat === seat ? ' mine' : ''), onclick: () => { if (!who || who.id === R.me) R.seat(me && me.seat === seat ? null : seat); } },
        A.sprite(kind, { label: false }).el, h('div', null, A.CHARS[kind].name), h('div', { class: 'who' }, who ? who.name + (who.id === R.host ? ' (host)' : '') : (kind === 'roamer' || kind === 'duchess' ? 'tap to play Team Tea' : 'the game plays this seat')));
      seats.append(el);
    }
    const unseated = R.members.filter(m => !m.seat);
    if (unseated.length) seats.append(h('div', { class: 'ct-seat', style: 'opacity:.7' }, h('div', null, 'Watching'), h('div', { class: 'who' }, unseated.map(m => m.name).join(', '))));
    $('#btnStart').hidden = !R.isHost; $('#lobbyWait').hidden = R.isHost;
    if (G.lobbyChat) G.lobbyChat.side('coffee');
  }
  $('#btnShare').addEventListener('click', () => A.share(G.code, 'Coffee Time: Rush Hour'));
  $('#btnCopyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(G.code); A.toast('Code copied: ' + G.code); } catch (e) { A.toast(G.code); } });
  $('#btnLeave').addEventListener('click', () => { if (G.room) G.room.close(); G.room = null; stopGame(); go('s-home'); });
  $('#btnStart').addEventListener('click', () => { if (G.room && G.room.isHost) { G.room.start(); beginHost(); } });

  /* ---------- starting a game ---------- */
  function playersFromRoom() {
    const players = {}; let humanRoamer = false, humanDuchess = false;
    for (const m of G.room.members) {
      if (SEAT_HERO[m.seat]) players[SEAT_HERO[m.seat]] = { name: m.name, ai: false, pid: m.id };
      if (m.seat === 's4') humanRoamer = m.id; if (m.seat === 's5') humanDuchess = m.id;
    }
    return { players, humanRoamer, humanDuchess };
  }
  function myRoleFromRoom() {
    const me = G.room.members.find(m => m.id === G.room.me);
    if (!me || !me.seat) return { role: 'spectator', hero: null };
    if (SEAT_HERO[me.seat]) return { role: 'hero', hero: SEAT_HERO[me.seat] };
    return { role: me.seat === 's4' ? 'roamer' : 'duchess', hero: null };
  }
  function startSolo(hero) {
    G.mode = 'solo'; G.myHero = hero; G.myRole = 'hero';
    const players = {}; players[hero] = { name: A.playerName() || 'You', ai: false, pid: 'me' };
    G.sim = E.newGame({ players });
    setupGameScreen();
    go('s-game');
    startTicking();
  }
  function beginHost() {
    const { players, humanRoamer, humanDuchess } = playersFromRoom();
    const r = myRoleFromRoom(); G.mode = 'host'; G.myHero = r.hero; G.myRole = r.role;
    G.sim = E.newGame({ players, humanRoamer: !!humanRoamer, humanDuchess: !!humanDuchess });
    G.sim.pids = { roamer: humanRoamer, duchess: humanDuchess };
    setupGameScreen(); go('s-game'); startTicking();
  }
  function beginClient() {
    const r = myRoleFromRoom(); G.mode = 'client'; G.myHero = r.hero; G.myRole = r.role;
    setupGameScreen(); go('s-game'); startRender();
  }
  function takeOverHost() {
    // the old host dropped mid-game: rebuild the engine state from the last snapshot and carry on
    if (!G.lastSnap) return;
    G.mode = 'host';
    G.sim = snapshotToSim(G.lastSnap);
    const { players, humanRoamer, humanDuchess } = playersFromRoom();
    for (const k of E.HEROES) { const p = players[k]; G.sim.heroes[k].ai = !p; G.sim.heroes[k].name = p ? p.name : null; G.sim.heroes[k].pid = p ? p.pid : null; }
    G.sim.roamer.human = !!humanRoamer; G.sim.duchess.human = !!humanDuchess; G.sim.pids = { roamer: humanRoamer, duchess: humanDuchess };
    A.toast('You are the host now');
    startTicking();
  }
  function snapshotToSim(sn) {
    const s = E.newGame({});
    s.phase = sn.ph; s.world = sn.w; s.t = sn.t; s.phaseLeft = sn.pl; s.worldT = sn.wt; s.clock = sn.ck; s.overtime = sn.ot; s.clockPaused = sn.cp; s.winner = sn.win;
    // rebuild the world's nests/crumpets/graves from the snapshot
    s.crumpets = []; s.graves = []; s.nests = [];
    for (const n of sn.n) s.nests.push({ id: n.i, lane: n.l, idx: n.x, kind: n.k, spawned: n.s, cleared: !sn.c.some(c => c.l === n.l && Math.round(c.p) === n.x) && n.s });
    for (const c of sn.c) s.crumpets.push({ id: c.i, nest: (s.nests.find(n => n.lane === c.l && n.idx === Math.round(c.p)) || {}).id, kind: c.k, lane: c.l, pos: c.p, hp: c.hp, maxHp: c.mh, spawnLeft: c.sp, dead: false });
    for (const g of sn.g) s.graves.push({ id: g.i, lane: g.l, idx: g.x });
    s.nextId = Math.max(1000, ...sn.n.map(n => n.i), ...sn.c.map(c => c.i), ...sn.g.map(g => g.i)) + 1;
    for (const k of E.HEROES) { const H = s.heroes[k], v = sn.h[k]; H.pos = v.p; H.lane = v.l; H.heat = v.h; H.maxHeat = v.m; H.frozen = v.f; H.card = v.c; H.chamber = v.ch; H.moveTo = v.mt; H.kos = v.k; H.stuns = v.st; H.draft = v.d ? { cards: v.d.c, left: v.d.l } : null; H.fight = v.g ? { enemy: v.g.e, turn: v.g.t, ringLeft: v.g.r, ringDur: 1, swung: v.g.s, acc: 0, swings: 0 } : null; }
    s.duchess = { nextIn: sn.d.n, state: sn.d.s === 'sweep' ? 'wait' : sn.d.s, row: -1, left: 0, human: sn.d.hu };
    s.roamer = { state: 'under', left: 0, cooldown: Math.max(3, sn.r.cd), reach: 0, target: null, lane: null, idx: 0, human: sn.r.hu, full: sn.r.fu };
    s.king = { on: sn.k.on, pos: sn.k.p }; s.button = { hero: null, left: sn.b.l };
    return s;
  }
  function stopGame() { clearInterval(G.tickTimer); G.tickTimer = null; cancelAnimationFrame(G.raf); G.raf = null; G.sim = null; G.snap = null; G.lastSnap = null; A.$$('.overlay').forEach(o => o.remove()); }

  /* ---------- the host loop ---------- */
  function startTicking() {
    clearInterval(G.tickTimer);
    let last = Date.now();
    G.tickTimer = setInterval(() => {
      const now = Date.now(); const dt = Math.min(0.5, (now - last) / 1000); last = now;
      const inputs = G.inputs; G.inputs = [];
      const ev = E.step(G.sim, dt, inputs, now);
      const snap = E.snapshot(G.sim);
      if (G.room && G.room.isHost) {
        G.room.event({ k: 'snap', s: snap, ev, at: now });
        G.stateTimer += dt; if (G.stateTimer >= 2 || snap.win) { G.stateTimer = 0; G.room.setState(snap); }
      }
      onSnapshot(snap, ev, now);
    }, 100);
    startRender();
  }
  function hostInput(data, from) {
    if (!G.sim || !data) return;
    // map the sender to what they control
    if (data.type === 'rise' || data.type === 'sweep') { const want = data.type === 'rise' ? G.sim.pids.roamer : G.sim.pids.duchess; if (from !== want) return; G.inputs.push(data); return; }
    const hero = E.HEROES.find(k => G.sim.heroes[k].pid === from); if (!hero) return;
    G.inputs.push(Object.assign({}, data, { hero }));
  }
  function sendInput(inp) {
    if (G.mode === 'client') { G.room.input(inp); return; }
    if (inp.type === 'move' || inp.type === 'swing' || inp.type === 'card' || inp.type === 'use') inp.hero = G.myHero;
    G.inputs.push(inp);
  }

  /* ---------- the game screen ---------- */
  function setupGameScreen() {
    const board = $('#board');
    A.$$('.lane, .cell, .nest, .grave, .ent, .fx', board).forEach(x => x.remove());
    G.ents = {};
    // lanes and cells
    E.LANES.forEach((l, i) => {
      const lane = h('div', { class: 'lane' + (l === 'team' ? ' team' : ''), style: `left:${i * 20}%` }, h('div', { class: 'lanename' }, l === 'team' ? 'TEAM PATH' : A.CHARS[l].name.split(' ').pop().toUpperCase()));
      board.append(lane);
      for (let r = 0; r <= 12; r++) {
        if (l === 'team' && (r < 4 || r > 8)) continue;
        const cls = ['cell'];
        if (E.CROSS.includes(r)) cls.push('cross'); if (l === 'team') cls.push('teamcell');
        if (E.COFFEE.includes(r) && l !== 'team') cls.push('coffee');
        if (r > 0) cls.push('tap');
        const cell = h('div', { class: cls.join(' '), style: `left:${i * 20}%; top:${(13 - r) * 100 / 15}%`, 'data-lane': l, 'data-row': r, onclick: () => tapCell(l, r) });
        board.append(cell);
      }
    });
    // clock
    $('#clockBox').innerHTML = ''; G.clock = A.clock($('#clockBox'), { size: 64 });
    // my sprite in the strip
    $('#mineSprite').innerHTML = '';
    if (G.myHero) { $('#mineSprite').append(A.sprite(G.myHero, { label: false, size: 46 }).el); $('#strip').hidden = false; } else { $('#strip').hidden = true; }
    // villain controls
    const vc = $('#villainCtrl'); vc.hidden = G.myRole !== 'roamer' && G.myRole !== 'duchess'; vc.innerHTML = '';
    if (G.myRole === 'roamer') vc.append(h('div', null, 'You are the Roamer. When a grave glows green, tap it to rise.'));
    if (G.myRole === 'duchess') vc.append(h('div', null, 'You are the Duchess. When your chime sounds, tap a row to sweep it.'));
    // chat
    $('#gameChat').innerHTML = ''; G.chat = A.chat($('#gameChat'), { side: mySide(), onSend: sendChat });
    $('#drawer').classList.remove('on'); $('#draft').classList.remove('on');
    const wbg = A.WORLDS[0].bg; board.style.setProperty('--wbg', wbg); board.style.background = wbg;
  }
  $('#btnChat').addEventListener('click', () => $('#drawer').classList.toggle('on'));
  $('#btnDrawerClose').addEventListener('click', () => $('#drawer').classList.remove('on'));

  function myHeroSnap() { return G.snap && G.myHero ? G.snap.h[G.myHero] : null; }
  function tapCell(lane, row) {
    if (!G.snap) return;
    if (G.myRole === 'duchess') { if (G.snap.d.s === 'ready') { sendInput({ type: 'sweep', row }); A.sound.tap(); } return; }
    const me = myHeroSnap(); if (!me || me.f > 0 || me.ch) return;
    const at = Math.round(me.p);
    A.sound.tap();
    if (lane === 'team' && me.l !== 'team') { if (E.CROSS.includes(at) && row === at) sendInput({ type: 'move', to: 'team' }); else if (E.CROSS.includes(at)) { sendInput({ type: 'move', to: 'team' }); setTimeout(() => sendInput({ type: 'move', to: row }), 150); } return; }
    if (lane !== 'team' && me.l === 'team') { if (E.CROSS.includes(at) && lane === G.myHero) { sendInput({ type: 'move', to: 'home' }); if (row !== at) setTimeout(() => sendInput({ type: 'move', to: row }), 150); } return; }
    if (lane === me.l || (me.l === 'team' && lane === 'team')) sendInput({ type: 'move', to: row });
  }
  $('#btnSwing').addEventListener('click', swingNow);
  $('#ring').addEventListener('pointerdown', e => { if (e.target.id !== 'btnSwing') swingNow(); });
  function swingNow() {
    if (G.ringMode !== 'hero' || G.swung) return;
    const nowMs = G.room ? G.room.now() : Date.now();
    const err = Math.abs(G.ringDeadline - nowMs) / 1000;        // seconds from the sweet spot
    const half = 0.35 + Math.min(0.15, G.rtt || 0);               // the sweet spot widens with lag
    const acc = Math.max(0, 1 - err / half);
    G.swung = true; A.sound.swing();
    sendInput({ type: 'swing', acc });
    showVerdict(acc >= 0.6 ? (acc > 0.9 ? 'PERFECT' : 'HIT') : acc > 0.15 ? 'half' : 'miss');
    const me = G.ents['h:' + G.myHero]; if (me) me.sprite.swing();
  }
  function showVerdict(t) { const v = $('#verdict'); v.textContent = t; v.classList.remove('show'); void v.offsetWidth; v.classList.add('show'); }
  $('#cardBtn').addEventListener('click', () => { const me = myHeroSnap(); if (me && me.c) { sendInput({ type: 'use' }); A.sound.tap(); } });

  /* ---------- snapshots in ---------- */
  function onSnapshot(sn, ev, at) {
    if (!sn) return;
    G.lastSnap = sn;
    const prev = G.snap; G.snap = sn; G.snapAt = Date.now();
    if (at && G.mode === 'client') { const lag = Math.max(0, (G.room.now() - at)); G.rtt = Math.min(0.15, lag / 1000); }
    for (const e of ev || []) effect(e, sn);
    if (!prev || prev.w !== sn.w || prev.ph !== sn.ph) onPhase(prev, sn);
    renderBoard(sn);
  }
  function onPhase(prev, sn) {
    const w = A.WORLDS[sn.w] || A.WORLDS[0];
    const board = $('#board'); board.style.background = w.bg; board.style.setProperty('--wbg', w.bg);
    $('#worldName').textContent = w.name;
    A.$$('.overlay').forEach(o => o.remove());
    if (sn.ph === 'intro') showIntro(sn);
    else if (sn.ph === 'interlude') showInterlude(sn);
    else if (sn.ph === 'end') showEnd(sn);
    if (prev && prev.w !== sn.w) { for (const id in G.ents) if (!id.startsWith('h:')) { G.ents[id].sprite.remove(); G.ents[id].el.remove(); delete G.ents[id]; } A.$$('.nest, .grave', board).forEach(x => x.remove()); }
  }

  /* ---------- rendering ---------- */
  function xy(lane, pos) { const col = LANE_COL[lane] == null ? 2 : LANE_COL[lane]; return { x: (col + 0.5) * 20, y: (13 - pos) * 100 / 15 + 100 / 30 }; }
  function place(el, lane, pos) { const p = xy(lane, pos); el.style.left = p.x + '%'; el.style.top = p.y + '%'; }
  function ent(id, kind, cls) {
    let e = G.ents[id];
    if (!e) {
      const sprite = A.sprite(kind, { label: kind === 'crumpet' || kind === 'meangirl' ? false : undefined });
      const el = h('div', { class: 'ent ' + (cls || '') }, sprite.el);
      if (E.HEROES.includes(kind) && kind !== 'don') el.append(h('div', { class: 'heat' }, h('i')));
      if (cls === 'enemy') el.append(h('div', { class: 'hp' }, h('i')));
      $('#board').append(el);
      e = G.ents[id] = { el, sprite, kind };
    }
    return e;
  }
  function renderBoard(sn) {
    const board = $('#board');
    // nests and graves
    const seenN = new Set();
    for (const n of sn.n) { const id = 'n' + n.i; seenN.add(id); let el = $('#' + id); if (!el) { el = h('div', { id, class: 'nest' }); board.append(el); place(el, n.l, n.x); } el.classList.toggle('cleared', n.s); }
    const seenG = new Set();
    for (const g of sn.g) { const id = 'g' + g.i; seenG.add(id); let el = $('#' + id); if (!el) { el = h('div', { id, class: 'grave', onclick: () => { if (G.myRole === 'roamer' && sn.r.s === 'under' && sn.r.cd <= 0) sendInput({ type: 'rise', grave: g.i }); } }); board.append(el); place(el, g.l, g.x); } el.classList.toggle('glow', G.myRole === 'roamer' && sn.r.s === 'under' && sn.r.cd <= 0); }
    A.$$('.grave', board).forEach(el => { if (!seenG.has(el.id)) el.remove(); });
    // crumpets
    const alive = new Set();
    for (const c of sn.c) {
      const id = 'c:' + c.i; alive.add(id);
      const kind = c.k === 'meangirls' ? 'meangirl' : 'crumpet';
      const e = ent(id, kind, 'enemy');
      e.el.classList.toggle('spawning', c.sp > 0);
      place(e.el, c.l, c.p);
      const hp = $('.hp i', e.el); if (hp) hp.style.width = (100 * c.hp / c.mh) + '%';
    }
    for (const id in G.ents) if (id.startsWith('c:') && !alive.has(id)) { G.ents[id].sprite.remove(); G.ents[id].el.remove(); delete G.ents[id]; }
    // heroes
    for (const k of E.HEROES) {
      const v = sn.h[k]; const e = ent('h:' + k, k, 'hero' + (k === G.myHero ? ' mine' : ''));
      place(e.el, v.l, v.p);
      e.sprite.freeze(v.f > 0);
      const heat = $('.heat i', e.el); if (heat) heat.style.width = (100 * v.h / v.m) + '%';
      let tag = $('.cardtag', e.el);
      if (v.c) { if (!tag) { tag = h('div', { class: 'cardtag' }); e.el.append(tag); } tag.textContent = E.CARDS[v.c].name; } else if (tag) tag.remove();
      e.sprite.el.classList.toggle('flip', v.l === 'team');
      const lbl = $('.ct-label', e.sprite.el); if (lbl) lbl.textContent = v.n || A.CHARS[k].name.split(' ').pop();
    }
    // the Roamer
    const r = sn.r;
    if (r.s !== 'under') {
      const e = ent('roamer', 'roamer', 'roamer'); place(e.el, r.l, r.x);
      e.el.style.opacity = r.s === 'glow' ? 0.35 : 1;
      let ring = $('.reach', e.el); if (!ring) { ring = h('div', { class: 'reach' }); e.el.append(ring); }
      const px = r.re * ROWH() * 2; ring.style.width = px + 'px'; ring.style.height = px + 'px'; ring.style.display = r.s === 'swing' || r.s === 'rewind' || r.s === 'snatch' ? 'block' : 'none';
    } else if (G.ents.roamer) { G.ents.roamer.sprite.remove(); G.ents.roamer.el.remove(); delete G.ents.roamer; }
    // the Duchess
    const dr = $('#duchessRow'); dr.classList.toggle('on', sn.d.s === 'sweep'); if (sn.d.s === 'sweep') dr.style.top = ((13 - sn.d.r) * 100 / 15) + '%';
    if (sn.d.s === 'sweep') { const e = ent('duchess', 'duchess', 'duchess'); if (!e.started) { e.started = true; e.el.style.transition = 'none'; e.el.style.left = '-12%'; e.el.style.top = ((13 - sn.d.r) * 100 / 15 + 100 / 30) + '%'; requestAnimationFrame(() => { e.el.style.transition = 'left 1.4s linear'; e.el.style.left = '112%'; }); } }
    else if (G.ents.duchess) { G.ents.duchess.sprite.remove(); G.ents.duchess.el.remove(); delete G.ents.duchess; }
    // King Tea in Overtime
    if (sn.k.on) { const e = ent('king', 'king', 'king'); place(e.el, 'team', sn.k.p); } else if (G.ents.king) { G.ents.king.sprite.remove(); G.ents.king.el.remove(); delete G.ents.king; }
    // chamber button
    $('#btnProg').style.width = (100 * Math.min(1, sn.b.l / 3)) + '%';
    // the clock and the sub line
    G.clock.set(sn.ck, sn.ot ? 'OVERTIME' : (sn.cp ? 'paused' : ''));
    $('#worldSub').textContent = sn.ph === 'live' ? (sn.d.s === 'sweep' ? 'The Duchess sweeps!' : sn.d.n <= 3 && sn.d.s === 'wait' ? 'Duchess in ' + Math.ceil(sn.d.n) + '...' : sn.r.s !== 'under' ? 'The Roamer is up' : 'world ' + (sn.w + 1) + ' of 5, par 11h') : sn.ph;
    $('#log').textContent = (sn.log && sn.log[sn.log.length - 1]) || '';
    // my strip
    const me = myHeroSnap();
    if (me) {
      $('#brewBar').style.width = me.m ? (100 * me.h / me.m) + '%' : '100%';
      $('#brewText').textContent = me.f > 0 ? 'FROZEN ' + Math.ceil(me.f) + 's' : me.m ? 'Brew ' + Math.round(me.h) + '/' + me.m : 'Donette feels no cold';
      const cb = $('#cardBtn'); cb.classList.toggle('has', !!me.c); cb.classList.toggle('passive', !!(me.c && ['protector', 'bolt', 'spoon', 'umbrella', 'earth'].includes(me.c)));
      $('#cardName').textContent = me.c ? E.CARDS[me.c].name : 'No card'; $('#cardText').textContent = me.c ? (['protector', 'bolt', 'spoon', 'umbrella', 'earth'].includes(me.c) ? 'held' : 'tap to play') : 'Clear a nest to draft';
      // the ring
      const g = me.g;
      if (g) {
        const nowMs = Date.now();
        const mode = g.t;
        if (G.ringMode !== mode || Math.abs(G.ringStartedSnapRing - g.r) > 0.9) { G.ringMode = mode; G.swung = !!g.s; G.ringStartedSnapRing = g.r; }
        G.ringDeadline = (G.room && G.mode === 'client' ? G.room.now() : nowMs) + g.r * 1000;
        if (g.s) G.swung = true;
      } else { G.ringMode = null; G.swung = false; }
      // taps: highlight reachable cells
      const at = Math.round(me.p);
      A.$$('.cell.tap', board).forEach(c => { const l = c.dataset.lane, row = +c.dataset.row; c.classList.toggle('ok', me.f <= 0 && !me.ch && !me.g && ((l === me.l && row > at && row <= at + 4) || (l === 'team' && me.l !== 'team' && E.CROSS.includes(at) && row >= at && row <= 8) || (l === G.myHero && me.l === 'team' && E.CROSS.includes(at) && row >= at))); });
    }
    // drafts
    const d = me && me.d;
    const draft = $('#draft');
    if (d) {
      if (!draft.classList.contains('on')) { draft.classList.add('on'); const cards = $('#draftCards'); cards.innerHTML = ''; for (const c of d.c) cards.append(h('div', { class: 'card', onclick: () => { sendInput({ type: 'card', pick: c }); draft.classList.remove('on'); A.sound.tap(); } }, h('b', null, E.CARDS[c].name), h('small', null, E.CARDS[c].text))); }
      $('#draftLeft').textContent = d.l.toFixed(1) + 's'; $('#draftBar').style.width = (100 * d.l / 2) + '%';
    } else draft.classList.remove('on');
    // villain control hints
    if (G.myRole === 'duchess') { $('#villainCtrl').innerHTML = ''; $('#villainCtrl').append(h('div', null, sn.d.s === 'ready' ? 'Tap a row to sweep it now!' : sn.d.s === 'sweep' ? 'Sweeping...' : 'Next sweep in ' + Math.ceil(sn.d.n) + 's')); }
    if (G.myRole === 'roamer') { $('#villainCtrl').innerHTML = ''; $('#villainCtrl').append(h('div', null, sn.r.s !== 'under' ? 'You are up: ' + sn.r.s : sn.r.cd <= 0 ? (sn.g.length ? 'Tap a glowing grave to rise' : 'No graves yet. Wait for a crumpet to fall.') : 'Ready in ' + Math.ceil(sn.r.cd) + 's')); }
  }
  // the ring runs between snapshots on its own frame loop
  function startRender() {
    cancelAnimationFrame(G.raf);
    const ring = $('#ring'), closer = $('#closer');
    function frame() {
      G.raf = requestAnimationFrame(frame);
      if (!G.snap) return;
      if (G.ringMode) {
        const nowMs = G.room && G.mode === 'client' ? G.room.now() : Date.now();
        const left = (G.ringDeadline - nowMs) / 1000;
        const t = A.clamp(left / 1.0, -0.2, 1);
        const scale = 0.48 + Math.max(0, t) * 0.55;
        closer.style.transform = `scale(${scale})`;
        ring.classList.add('on'); ring.classList.toggle('enemy', G.ringMode === 'enemy');
        closer.style.opacity = G.swung && G.ringMode === 'hero' ? 0.3 : 1;
        $('#btnSwing').textContent = G.ringMode === 'enemy' ? '' : (G.swung ? '...' : 'SWING');
      } else { ring.classList.remove('on', 'enemy'); }
    }
    frame();
  }

  /* ---------- effects for events ---------- */
  function fx(lane, pos, text, color) { const el = h('div', { class: 'fx', style: color ? 'color:' + color : '' }, text); place(el, lane, pos); $('#board').append(el); setTimeout(() => el.remove(), 900); }
  function effect(e, sn) {
    const H = e.hero && sn.h[e.hero]; const he = e.hero && G.ents['h:' + e.hero];
    switch (e.e) {
      case 'live': A.sound.chime(); break;
      case 'spawn': A.sound.tap(); break;
      case 'fight': if (he) he.sprite.say('!', 600); break;
      case 'swing': { const ce = G.ents['c:' + e.enemy]; if (he && e.hero !== G.myHero) he.sprite.swing(); if (ce) { if (e.miss) fx(H.l, H.p + 0.6, 'miss', '#bbb'); else { ce.sprite.hit(); fx(H.l, H.p + 0.6, e.full ? '-' + e.dmg : '-' + e.dmg + ' (half)', e.full ? '#fff245' : '#ffb98a'); A.flash($('#board')); } } if (e.hero === G.myHero && !G.swung) showVerdict(e.miss ? 'miss' : 'auto'); break; }
      case 'ehit': if (he) { he.sprite.hit(); fx(H.l, H.p, '-' + e.dmg + ' heat', '#5bc0eb'); if (e.hero === G.myHero) A.shake($('#board'), 5, 300); } break;
      case 'ko': { const ce = G.ents['c:' + e.enemy]; if (ce) { ce.sprite.hit(); } fx(H.l, H.p + 0.6, 'KO!', '#7ed957'); A.sound.chime(); break; }
      case 'freeze': if (he) { he.sprite.freeze(true); fx(H.l, H.p, 'FROZEN', '#9ad8ff'); } if (e.hero === G.myHero) { A.shake($('#board'), 6, 400); A.toast('You are frozen. A teammate beside you thaws you faster.'); } break;
      case 'thaw': if (he) { he.sprite.freeze(false); fx(H.l, H.p, 'thawed', '#fff245'); } break;
      case 'card': if (he) { fx(H.l, H.p, E.CARDS[e.card].name, '#fff245'); if (e.hero === G.myHero && e.auto) A.toast('Auto-picked ' + E.CARDS[e.card].name); } break;
      case 'used': if (he) fx(H.l, H.p, E.CARDS[e.card].name + '!', '#ffb98a'); A.sound.chime(); break;
      case 'chime': A.sound.chime(); A.toast('The Duchess is coming'); break;
      case 'sweep': A.sound.rumble(); break;
      case 'evade': if (he) fx(H.l, H.p, 'evaded!', '#f06292'); break;
      case 'roamer': if (e.state === 'glow') { A.sound.rumble(); const g = A.$$('.grave', $('#board')).find(x => { const p = xy(e.lane, e.idx); return x.style.left === p.x + '%' && x.style.top === p.y + '%'; }); if (g) g.classList.add('glow'); } if (e.state === 'swing') { A.sound.rumble(); const re = G.ents.roamer; if (re) re.sprite.say(e.target ? 'Mine.' : 'Hmph.', 1200); } if (e.state === 'snatch') { const re = G.ents.roamer; if (re) re.sprite.swing(); } break;
      case 'rhit': if (he) { he.sprite.hit(); fx(H.l, H.p, '-2 heat', '#ab47bc'); const re = G.ents.roamer; if (re) re.sprite.swing(); } break;
      case 'snatched': if (he) { fx(H.l, H.p, 'SNATCHED ' + E.CARDS[e.card].name, '#ab47bc'); if (e.hero === G.myHero) A.toast('The Roamer snatched your ' + E.CARDS[e.card].name); } break;
      case 'protected': if (he) fx(H.l, H.p, 'protected', '#fff245'); break;
      case 'landslide': A.sound.rumble(); A.shake($('#board'), 4, 400); if (he) fx(H.l, H.p, 'LANDSLIDE', '#8d6e63'); break;
      case 'chamber': if (he) fx(H.l, 12.5, 'at the button', '#fff245'); break;
      case 'overtime': A.sound.lose(); A.toast('OVERTIME. King Tea walks the Team Path.', 3000); break;
      case 'hour': if (sn.ck >= 55) A.sound.tick(); break;
      case 'cleared': A.sound.win(); break;
      case 'end': if (e.winner === 'coffee') A.sound.win(); else A.sound.lose(); break;
      case 'clock': A.toast('Sleepy Time Tea: the clock turns back 4 hours'); break;
    }
  }

  /* ---------- overlays ---------- */
  function showIntro(sn) {
    const w = A.WORLDS[sn.w];
    const ov = h('div', { class: 'overlay' }, h('div', null, h('div', { class: 'ct-muted' }, 'World ' + (sn.w + 1) + ' of 5'), h('h1', null, w.name), h('div', { class: 'ct-row', style: 'justify-content:center' }, ...E.HEROES.map(k => A.sprite(k, { label: false, size: 64 }).el)), h('p', { class: 'ct-muted' }, sn.w === 2 ? 'Full Moon: the Roamer reaches twice as far.' : sn.w === 3 ? 'The cold bites harder here. Stay close.' : sn.w === 4 ? 'Royal Guards hold the chamber door. Ice Storm.' : 'Reach the Activation Chamber and hold the button.'), h('div', { class: 'bigtimer', id: 'introT' }, '5')));
    document.body.append(ov);
    const t = $('#introT', ov); const iv = setInterval(() => { if (!G.snap || G.snap.ph !== 'intro') { clearInterval(iv); ov.remove(); return; } t.textContent = Math.max(1, Math.ceil(G.snap.pl)); }, 150);
  }
  function showInterlude(sn) {
    const w = A.WORLDS[sn.w];
    const rows = E.HEROES.map(k => { const v = sn.h[k]; return h('div', { class: 'row' }, A.sprite(k, { label: false, size: 40 }).el, h('div', { style: 'flex:1' }, h('b', null, v.n || A.CHARS[k].name), h('div', { class: 'ct-muted', style: 'font-size:.8rem' }, `${v.k} KOs, frozen ${v.st}x`)), h('div', null, v.ch ? 'at the button' : '')); });
    const ov = h('div', { class: 'overlay interlude' }, h('div', { style: 'width:100%;max-width:420px' }, h('h2', null, w.name + ' cleared'), h('p', { class: 'ct-muted' }, sn.cp ? 'Under par. King Tea\'s clock is paused for the break.' : 'Over par. The clock keeps running.'), h('div', { class: 'standings' }, ...rows), h('div', { class: 'bigtimer', id: 'interT' }, '10'), h('div', { class: 'ct-taunts', id: 'interTaunts' })));
    document.body.append(ov);
    const tl = $('#interTaunts', ov); for (const t of A.TAUNTS[mySide()].concat(A.TAUNTS.all).slice(0, 8)) tl.append(h('button', { class: 'ct-taunt', onclick: () => sendChat({ text: t, taunt: true }) }, t));
    const t = $('#interT', ov); const iv = setInterval(() => { if (!G.snap || G.snap.ph !== 'interlude') { clearInterval(iv); ov.remove(); return; } t.textContent = Math.max(1, Math.ceil(G.snap.pl)); }, 150);
  }
  function showEnd(sn) {
    const won = sn.win === 'coffee';
    const rows = E.HEROES.map(k => { const v = sn.h[k]; return h('div', { class: 'row', style: 'display:flex;gap:10px;align-items:center;background:var(--panel2);border-radius:10px;padding:6px 10px;margin:4px 0' }, A.sprite(k, { label: false, size: 40 }).el, h('div', { style: 'flex:1;text-align:left' }, h('b', null, v.n || A.CHARS[k].name), h('div', { class: 'ct-muted', style: 'font-size:.8rem' }, `${v.k} KOs, frozen ${v.st}x`)), h('div', null, v.c ? E.CARDS[v.c].name : '')); });
    const ov = h('div', { class: 'overlay end' }, h('div', { style: 'width:100%;max-width:420px' },
      A.sprite(won ? 'joe' : 'king', { label: false, size: 90 }).el,
      h('h1', null, won ? 'Coffee wins!' : 'King Tea wins'),
      h('p', null, won ? `King Tea stopped at ${Math.floor(sn.ck)} hours.` : (sn.ck >= 60 ? 'The clock struck 60 hours.' : 'Every hero froze at once.')),
      h('div', null, ...rows),
      h('div', { class: 'ct-row', style: 'justify-content:center;margin-top:12px' },
        G.mode === 'solo' ? h('button', { class: 'ct-btn peach', onclick: () => { stopGame(); startSolo(G.myHero); } }, 'Play again') : (G.room && G.room.isHost ? h('button', { class: 'ct-btn peach', onclick: () => { G.room.restart(); stopGame(); go('s-lobby'); renderLobby(); } }, 'Back to the lobby') : h('span', { class: 'ct-muted' }, 'Waiting for the host')),
        h('button', { class: 'ct-btn ghost', onclick: () => { if (G.room) { G.room.close(); G.room = null; } stopGame(); go('s-home'); } }, 'Home')),
      h('div', { class: 'ct-taunts', style: 'margin-top:10px', id: 'endTaunts' })));
    document.body.append(ov);
    const tl = $('#endTaunts', ov); for (const t of A.TAUNTS[mySide()].concat(A.TAUNTS.all).slice(0, 8)) tl.append(h('button', { class: 'ct-taunt', onclick: () => sendChat({ text: t, taunt: true }) }, t));
    if (G.mode !== 'client') { clearInterval(G.tickTimer); G.tickTimer = null; }
  }

  window.Rush = G;
})();
