/* ============================================================
   COFFEE TIME: OVERTIME. Screens, the host loop, the fight player,
   and the room glue. Rules live in ot-rules.js (window.OT).
   ============================================================ */
(function () {
  'use strict';
  const A = window.Arena, OT = window.OT;
  const app = A.$('#app');
  const SEATS = ['joe', 'thermos', 'miss', 'don'];

  let S = null;            // the state (host: authoritative; client: last broadcast)
  let room = null;         // Arena.room, or null for solo
  let myHero = null;       // the hero this phone controls
  let myName = A.playerName() || '';
  let hostTimers = [];     // host-side timeouts
  let playing = null;      // a fight replay in progress
  let pendingState = null; // state received during a replay
  let chat = null;
  let clockUI = null;
  let role = null;         // 'roamer' | 'hero' (private)
  let lastRound = 0;

  const now = () => room ? room.now() : Date.now();
  const isHost = () => !room || room.isHost;
  const myId = () => room ? room.me : 'me';
  const heroName = h => OT.HERO[h].name;

  /* ================= screens ================= */
  function screen(cls, ...kids) { app.innerHTML = ''; const el = A.h('div', { class: 'ct-screen on ' + cls }, ...kids); app.append(el); window.scrollTo(0, 0); return el; }

  function showHome(msg) {
    const name = A.h('input', { class: 'ct-input', placeholder: 'Your name', maxlength: '20', value: myName });
    const code = A.h('input', { class: 'ct-input', placeholder: 'Room code', maxlength: '4', style: 'text-transform:uppercase;letter-spacing:.3em;text-align:center' });
    const install = A.h('button', { class: 'ct-btn ghost', hidden: '' }, 'Add to home screen');
    const el = screen('home', A.h('div', { class: 'ct-wrap' },
      A.h('img', { class: 'ct-logo', src: '/img/logo-white.webp', alt: 'Coffee Time' }),
      A.h('p', { class: 'tag' }, 'OVERTIME'),
      A.h('div', { class: 'cast' }, ...SEATS.map(h => A.sprite(h, { label: false }).el)),
      A.h('p', { class: 'ct-muted' }, 'Thirty seconds to play your cards. Then watch the fight. Then argue about who is working for the Roamer. Beat the clock before it strikes 60.'),
      msg ? A.h('p', { style: 'color:var(--peach)' }, msg) : null,
      name,
      A.h('button', { class: 'ct-btn peach', onclick: () => { saveName(name); startSolo(); } }, 'Play solo'),
      A.h('button', { class: 'ct-btn', onclick: () => { saveName(name); hostRoom(); } }, 'Host a room'),
      A.h('div', { class: 'ct-row', style: 'max-width:320px;margin:6px auto' }, code, A.h('button', { class: 'ct-btn sm', onclick: () => { saveName(name); joinRoom(code.value.trim().toUpperCase()); } }, 'Join')),
      A.h('button', { class: 'ct-btn ghost', onclick: showHowTo }, 'How to play'),
      install,
      A.h('p', { class: 'fine' }, 'Free. No sign-up. Friends join by code or link. ', A.h('a', { href: '/', style: 'color:var(--peach)' }, 'playcoffeetime.com'))));
    A.install(install);
    const u = new URL(location.href), rc = (u.searchParams.get('room') || '').toUpperCase();
    if (rc) code.value = rc;
    function saveName(i) { myName = i.value.trim() || 'Player'; A.savePlayerName(myName); }
    return el;
  }

  function showHowTo() {
    A.modal(A.h('div', { class: 'howto' },
      A.h('h2', null, 'How to play'),
      A.h('p', null, A.h('b', null, 'Plan (30 s).'), ' Everyone places up to 3 Journey Cards on their hero at the same time, face-down. Cards cost heat. Donette pays nothing.'),
      A.h('p', null, A.h('b', null, 'Fight.'), ' Cards flip and the battle plays out on every phone. Beat your crumpet to advance. Nobody reads a log.'),
      A.h('p', null, A.h('b', null, 'The clock.'), ' King Tea gains hours for every hero who did not advance. At 60 hours it is Tea Time and you lose.'),
      A.h('p', null, A.h('b', null, 'Talk (20 s).'), ' Chat, taunt, and call Overtime: if a majority taps yes, the next round counts double.'),
      A.h('p', null, A.h('b', null, 'The Roamer.'), ' With 4 or more players, one hero secretly rides with the Roamer: once a round a card vanishes from a teammate\'s hand. The Duchess holds a vote after rounds 3 and 6. Freeze the right hero and the clock gives back 6 hours. Freeze the wrong one twice and the Roamer wins.'),
      A.h('p', null, A.h('b', null, 'Heat.'), ' Refills 3 a round, plus 1 for each teammate on your segment. Run out and you are frozen for a round. Fire is the only card a frozen hero can play.'),
      A.h('button', { class: 'ct-btn', onclick: e => e.target.closest('.ct-modal-wrap').remove() }, 'Got it')));
  }

  /* ================= lobby ================= */
  let lobby = { code: '', members: [], traitor: true };
  function hostRoom() { connect(A.makeCode()); }
  function joinRoom(code) { if (!/^[A-Z]{4}$/.test(code)) { A.toast('Enter the 4-letter code'); return; } connect(code); }
  function connect(code) {
    lobby.code = code;
    room = A.room({
      code, name: myName || 'Player',
      onJoined(m) { renderLobby(); if (!m.state) return; },
      onMembers() { if (S && S.phase !== 'lobby') return; renderLobby(); },
      onState(state, fromJoin) { onState(state, fromJoin); },
      onEvent(e) { onEvent(e); },
      onInput(data, from) { onInput(data, from); },
      onPrivate(d) { if (d.k === 'role') { role = d.traitor ? 'roamer' : 'hero'; showRole(); } },
      onChat(msg) { if (chat) chat.add(msg); },
      onStart() { S = null; waitForHost(); },
      onRestart() { S = null; renderLobby(); },
      onError(m) { A.toast(m); },
      onClose() { A.toast('Reconnecting...'); },
      onHostChange(amHost) { if (amHost && S && !S.winner && S.phase !== 'lobby') { A.toast('You are the host now'); resumeAsHost(); } },
    });
    renderLobby();
  }
  function seatOf(h) { const i = SEATS.indexOf(h); return 's' + i; }
  function heroOfSeat(seat) { return seat ? SEATS[+seat.slice(1)] : null; }
  function renderLobby() {
    if (!room) return;
    const members = room.members;
    const mine = members.find(m => m.id === room.me);
    myHero = mine ? heroOfSeat(mine.seat) : null;
    const humans = members.filter(m => m.seat).length;
    lobby.traitor = room.settings.patch != null ? !!room.settings.patch : humans >= 4;
    const seats = SEATS.map(h => {
      const taken = members.find(m => m.seat === seatOf(h));
      const el = A.h('div', { class: 'ct-seat' + (taken ? ' taken' : '') + (taken && taken.id === room.me ? ' mine' : ''), onclick: () => { if (!taken || taken.id === room.me) room.seat(taken ? null : seatOf(h)); } },
        A.sprite(h, { label: false }).el, A.h('div', null, heroName(h)), A.h('div', { class: 'who' }, taken ? taken.name : 'AI (tap to take)'));
      return el;
    });
    const traitorBox = A.h('input', { type: 'checkbox', disabled: room.isHost ? null : '' });
    traitorBox.checked = lobby.traitor;
    traitorBox.addEventListener('change', () => room.settingsSet({ n: 4, patch: traitorBox.checked }));
    screen('lobby', A.h('div', { class: 'ct-wrap' },
      A.h('div', { class: 'ct-center' }, A.h('div', { class: 'ct-muted' }, 'Room code'), A.h('div', { class: 'ct-code' }, room ? lobby.code : ''),
        A.h('div', { class: 'ct-row', style: 'justify-content:center' },
          A.h('button', { class: 'ct-btn sm', onclick: () => A.share(lobby.code, 'Coffee Time: Overtime') }, 'Invite link'),
          A.h('button', { class: 'ct-btn sm ghost', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(lobby.code); A.toast('Code copied'); } }, 'Copy code'))),
      A.h('h3', { style: 'margin-top:14px' }, 'Pick your hero'),
      A.h('div', { class: 'ct-seats' }, ...seats),
      A.h('div', { class: 'ct-card', style: 'margin-top:12px' },
        A.h('label', { class: 'opt' }, traitorBox, A.h('span', null, A.h('b', null, 'Hidden Roamer'), A.h('span', { class: 'ct-muted' }, ' (needs 2 or more humans; best with 4)'))),
        A.h('div', { class: 'ct-muted', style: 'font-size:.85rem' }, `${members.length} in the room, ${humans} seated. Empty heroes are played by the AI.`)),
      A.h('div', { class: 'ct-row', style: 'margin-top:14px' },
        room.isHost ? A.h('button', { class: 'ct-btn peach', style: 'flex:1', onclick: hostStartOnline }, 'Start game') : A.h('div', { class: 'ct-muted', style: 'flex:1' }, 'Waiting for the host to start'),
        A.h('button', { class: 'ct-btn ghost sm', onclick: () => { room.close(); room = null; S = null; showHome(); } }, 'Leave'))));
  }
  function waitForHost() { screen('game', A.h('div', { class: 'ct-wrap ct-center', style: 'padding-top:60px' }, A.h('h2', null, 'Dealing the cards...'), A.h('div', { class: 'ct-muted' }, 'The host is starting the game.'))); }

  /* ================= starting ================= */
  function startSolo() {
    room = null; myHero = 'joe'; role = 'hero';
    S = OT.newGame({ joe: 'me' }, { traitor: false });
    S.names = { joe: myName || 'You' };
    buildGame(); hostStartRound();
  }
  function hostStartOnline() {
    const members = room.members;
    const players = {}, names = {};
    for (const m of members) if (m.seat) { players[heroOfSeat(m.seat)] = m.id; names[heroOfSeat(m.seat)] = m.name; }
    if (!Object.keys(players).length) { A.toast('Pick a hero first'); return; }
    const want = room.settings.patch != null ? !!room.settings.patch : Object.keys(players).length >= 4;
    S = OT.newGame(players, { traitor: want });
    S.names = names;
    room.start();
    // private role cards
    for (const h of SEATS) if (players[h]) room.toClient(players[h], { k: 'role', traitor: S.traitor === h });
    buildGame(); hostStartRound();
  }
  function resumeAsHost() { clearHostTimers(); if (S.phase === 'plan') hostArm(S.deadline, hostEndPlan); else if (S.phase === 'talk') hostArm(S.deadline, hostEndTalk); else if (S.phase === 'vote') hostArm(S.deadline, hostEndVote); else if (S.phase === 'fight') hostArm(now() + 1000, afterFight); }

  /* ================= host loop ================= */
  function clearHostTimers() { hostTimers.forEach(clearTimeout); hostTimers = []; }
  function hostArm(at, fn) { const t = setTimeout(fn, Math.max(0, at - now())); hostTimers.push(t); return t; }
  function sanitized() { const c = JSON.parse(JSON.stringify(S)); if (c.traitor && !c.exposed) c.traitor = 'hidden'; return c; }
  function broadcast() { if (room && room.isHost) room.setState(sanitized()); render(); }
  function emit(e) { if (room && room.isHost) room.event(e); onEvent(e); }

  function hostStartRound() {
    clearHostTimers();
    OT.startRound(S, now());
    S.robbedThisRound = false; S.slid = null;
    broadcast();
    // AI heroes place one card at a time, with a visible pause
    for (const h of OT.HEROES) if (S.heroes[h].player === 'ai') (async () => {
      const plan = OT.aiPlan(S, h);
      await A.ai.think(800, 2000);
      for (const c of plan) { if (S.phase !== 'plan') return; OT.place(S, h, c); emit({ type: 'placed', hero: h, n: S.heroes[h].placed.length }); await A.ai.think(1000, 3000); }
      if (S.phase !== 'plan') return;
      OT.setDone(S, h); emit({ type: 'done', hero: h }); maybeEndPlanEarly();
    })();
    hostArm(S.deadline, hostEndPlan);
  }
  function maybeEndPlanEarly() { if (S.phase === 'plan' && OT.allDone(S) && now() > S.deadline - OT.TIMES.plan + 3000) { clearHostTimers(); hostArm(now() + 800, hostEndPlan); } }
  function hostEndPlan() {
    if (S.phase !== 'plan') return;
    clearHostTimers();
    const ev = OT.resolve(S);
    emit({ type: 'fight', events: ev, state: sanitized() });
    hostArm(now() + S.fightMs + 600, afterFight);
  }
  function afterFight() {
    if (S.winner) { emit({ type: 'end', state: sanitized() }); return; }
    const rev = OT.roamerTurn(S);
    if (rev) { emit({ type: 'roamer', events: rev, state: sanitized() }); hostArm(now() + S.roamerMs + 400, afterRoamer); }
    else afterRoamer();
  }
  function afterRoamer() {
    if (S.winner) { emit({ type: 'end', state: sanitized() }); return; }
    OT.startTalk(S, now()); broadcast();
    hostArm(S.deadline, hostEndTalk);
  }
  function hostEndTalk() {
    if (S.phase !== 'talk') return;
    clearHostTimers();
    if (S.overtime.proposedBy) { const ok = OT.settleOvertime(S); emit({ type: 'overtime', ok }); }
    if (OT.needsVote(S)) hostStartVote(); else hostStartRound();
  }
  function hostStartVote() {
    OT.startVote(S, now()); broadcast();
    for (const h of OT.HEROES) if (S.heroes[h].player === 'ai') (async () => { await A.ai.think(4000, 12000); if (S.phase === 'vote') { OT.castVote(S, h, OT.aiVote(S, h)); emit({ type: 'voted', hero: h }); } })();
    hostArm(S.deadline, hostEndVote);
  }
  function hostEndVote() {
    if (S.phase !== 'vote') return;
    clearHostTimers();
    const r = OT.settleVote(S);
    emit({ type: 'verdict', result: r, state: sanitized() });
    if (S.winner) { hostArm(now() + 2500, () => emit({ type: 'end', state: sanitized() })); return; }
    hostArm(now() + 3500, hostStartRound);
  }
  function hostOvertimeProposal(h) {
    if (!OT.proposeOvertime(S, h, now())) return;
    broadcast(); emit({ type: 'otproposed', hero: h });
    for (const o of OT.HEROES) if (S.heroes[o].player === 'ai') (async () => { await A.ai.think(800, 3500); if (S.overtime.proposedBy) { OT.voteOvertime(S, o, S.clock < 45 ? Math.random() < 0.6 : Math.random() < 0.3); broadcast(); } })();
    hostArm(S.overtime.until, () => { if (S.phase === 'talk' && S.overtime.proposedBy) { const ok = OT.settleOvertime(S); broadcast(); emit({ type: 'overtime', ok }); } });
  }

  // inputs reach the host from clients (or from this phone in solo)
  function onInput(d, from) {
    if (!S || !isHost()) return;
    const h = d.hero; if (!h || !S.heroes[h]) return;
    const owner = S.heroes[h].player;
    if (room && owner !== from) return; // only your own hero
    switch (d.k) {
      case 'place': if (now() > S.deadline + 500) return; if (OT.place(S, h, d.card)) { broadcast(); emit({ type: 'placed', hero: h, n: S.heroes[h].placed.length }); } break;
      case 'unplace': if (OT.unplace(S, h, d.card)) broadcast(); break;
      case 'done': OT.setDone(S, h); broadcast(); emit({ type: 'done', hero: h }); maybeEndPlanEarly(); break;
      case 'rob': if (OT.traitorRob(S, h, d.victim)) { broadcast(); emit({ type: 'robbed', hero: d.victim, card: S.heroes[d.victim].robbed }); } break;
      case 'slide': if (OT.traitorLandslide(S, h, d.victim)) { broadcast(); emit({ type: 'rumble', hero: d.victim, text: `Landslide! ${heroName(d.victim)} slides back a segment.` }); } break;
      case 'propose': hostOvertimeProposal(h); break;
      case 'otvote': if (OT.voteOvertime(S, h, d.yes)) broadcast(); break;
      case 'vote': if (OT.castVote(S, h, d.target)) { broadcast(); emit({ type: 'voted', hero: h }); } break;
    }
  }
  function input(d) { d.hero = myHero; if (room) room.input(d); else onInput(d, 'me'); }

  /* ================= client side ================= */
  function onState(state, fromJoin) {
    if (playing) { pendingState = state; return; }
    S = state;
    if (fromJoin) { if (!S.phase || S.phase === 'lobby') { renderLobby(); return; } if (!game) buildGame(); const mine = room.members.find(m => m.id === room.me); myHero = mine ? heroOfSeat(mine.seat) : null; }
    if (!game) buildGame();
    render();
  }
  function onEvent(e) {
    if (!game && e.state) { S = e.state; buildGame(); }
    switch (e.type) {
      case 'fight': playFight(e.events, e.state); break;
      case 'roamer': playFight(e.events, e.state, true); break;
      case 'placed': if (!isHost()) { const H = S.heroes[e.hero]; if (H) H.placed = Array(e.n).fill('?'); } renderLanes(); break;
      case 'done': if (!isHost() && S.heroes[e.hero]) S.heroes[e.hero].done = true; renderLanes(); sprites.hero[e.hero] && sprites.hero[e.hero].say('Ready!', 1200); break;
      case 'robbed': robbedFx(e.hero); break;
      case 'rumble': A.sound.rumble(); A.shake(game.stage, 6, 500); caption(e.text); if (S.heroes[e.hero]) S.heroes[e.hero].seg = Math.max(0, S.heroes[e.hero].seg - (isHost() ? 0 : 1)); renderLanes(); break;
      case 'otproposed': caption(`${heroName(e.hero)} calls for OVERTIME!`); A.sound.chime(); render(); break;
      case 'overtime': caption(e.ok ? 'OVERTIME! Next round counts double.' : 'Overtime fails.'); if (e.ok) A.sound.win(); if (!isHost()) { S.overtime.proposedBy = null; S.overtime.next = e.ok; } render(); break;
      case 'voted': sprites.hero[e.hero] && sprites.hero[e.hero].say('Voted', 1000); break;
      case 'verdict': { if (!isHost()) S = e.state; const r = e.result; A.sound.chime(); verdictFx(r); break; }
      case 'end': if (!isHost()) S = e.state; showEnd(); break;
    }
  }

  /* ================= the game screen ================= */
  let game = null; // {root, stage, lanes, caption, phaseName, timer, hand, slots, meta, actions, talk, bottom}
  let sprites = { hero: {}, enemy: {}, king: null, roamer: null };
  let countdown = null;
  let handSig = '';
  function buildGame() {
    const topLeft = A.h('div');
    const phase = A.h('div', { class: 'phase' }, A.h('div', { class: 'name' }), A.h('div', { class: 'timer' }));
    const mute = A.h('button', { class: 'icon-btn', title: 'Sound', onclick: () => { A.sound.mute(!A.sound.muted); mute.textContent = A.sound.muted ? '🔇' : '🔊'; } }, A.sound.muted ? '🔇' : '🔊');
    const stage = A.h('div', { class: 'stage' });
    const cap = A.h('div', { class: 'caption' });
    const bottom = A.h('div');
    const root = screen('game', A.h('div', { class: 'ct-topbar' }, topLeft, phase, A.h('div', { class: 'top-right' }, mute)), stage, cap, bottom);
    clockUI = A.clock(topLeft, { size: 64 });
    game = { root, stage, cap, phaseName: phase.firstChild, timer: phase.lastChild, bottom };
    sprites = { hero: {}, enemy: {}, king: null, roamer: null };
    buildLanes();
    chat = null;
  }
  function buildLanes() {
    const lanes = A.h('div', { class: 'lanes' });
    for (const h of OT.HEROES) {
      const enemy = A.sprite('crumpet', { label: 'Crumpet', size: 60 }); enemy.el.classList.add('enemy'); enemy.flip(true);
      const hero = A.sprite(h, { size: 68 }); hero.el.classList.add('hero'); if (h === myHero) hero.el.classList.add('me');
      sprites.enemy[h] = enemy; sprites.hero[h] = hero;
      const bars = A.h('div', { class: 'bars' }, A.h('div', { class: 'bar ehp' }, A.h('i')), A.h('div', { class: 'placed-mini' }), A.h('div', { class: 'bar hp' }, A.h('i')), A.h('div', { class: 'bar heat' }, A.h('i')), A.h('div', { class: 'seg' }));
      lanes.append(A.h('div', { class: 'lane', 'data-hero': h }, enemy.el, bars, hero.el));
    }
    game.stage.innerHTML = ''; game.stage.append(lanes); game.lanes = lanes;
  }
  function laneOf(h) { return game.lanes.querySelector(`.lane[data-hero="${h}"]`); }
  function renderLanes() {
    if (!S || !game) return;
    for (const h of OT.HEROES) {
      const H = S.heroes[h], E = S.enemies[h], lane = laneOf(h);
      if (!lane) continue;
      const en = sprites.enemy[h];
      if (E) { en.el.classList.toggle('dead', !E.alive); A.$('.ct-label', en.el).textContent = E.name; A.$('img', en.el).src = A.CHARS[E.img === 'meangirl' ? 'meangirl' : E.img === 'king' ? 'king' : 'crumpet'].img; A.$('.bar.ehp i', lane).style.width = (100 * Math.max(0, E.hp) / E.maxHp) + '%'; en.freeze(E.frozen); }
      A.$('.bar.hp i', lane).style.width = (100 * H.hp / OT.HERO[h].hp) + '%';
      const heatBar = A.$('.bar.heat', lane); heatBar.style.display = H.heatMax ? '' : 'none'; A.$('i', heatBar).style.width = H.heatMax ? (100 * (H.heat - (S.phase === 'plan' ? OT.placedCost(S, h) : 0)) / H.heatMax) + '%' : '0';
      A.$('.seg', lane).textContent = `seg ${H.seg}` + (H.done && S.phase === 'plan' ? ' · ready' : '');
      const pm = A.$('.placed-mini', lane); pm.innerHTML = ''; for (const c of H.placed) pm.append(A.h('span', { class: h === myHero ? '' : 'back' }));
      sprites.hero[h].freeze(H.frozen > 0);
      const shortName = x => ({ miss: 'Hot Shot' }[x] || heroName(x));
      A.$('.ct-label', sprites.hero[h].el).textContent = (S.names && S.names[h]) ? S.names[h] : (H.player === 'ai' ? shortName(h) + ' (AI)' : shortName(h));
      
    }
    // King Tea and the Roamer in the corners
    if (S.kingOn && !sprites.king) { sprites.king = A.sprite('king', { label: 'King Tea', size: 54 }); sprites.king.el.classList.add('king'); game.stage.append(sprites.king.el); }
    if (S.traitor && !sprites.roamer) { sprites.roamer = A.sprite('roamer', { label: S.exposed ? 'Exposed!' : 'Riding with someone...', size: 50 }); sprites.roamer.el.classList.add('roamer-corner'); game.stage.append(sprites.roamer.el); }
    if (sprites.roamer && S.exposed) A.$('.ct-label', sprites.roamer.el).textContent = 'Exposed: ' + heroName(S.traitor);
  }
  function caption(t) { if (game) game.cap.textContent = t || ''; }
  function floatNum(el, text, cls) {
    const r = el.getBoundingClientRect(), sr = game.stage.getBoundingClientRect();
    const f = A.h('div', { class: 'float ' + cls, style: `left:${r.left - sr.left + r.width / 2}px;top:${r.top - sr.top + 8}px` }, text);
    game.stage.append(f); setTimeout(() => f.remove(), 1000);
  }

  function render() {
    if (!S || !game) return;
    const w = A.WORLDS[OT.worldIndex(S)];
    game.root.style.setProperty('--world-bg', w.bg);
    clockUI.set(S.clock, w.name + (S.round ? ` · Round ${S.round} of ${OT.ROUNDS}` : ''));
    renderLanes();
    if (countdown) { countdown.stop(); countdown = null; }
    game.timer.textContent = '';
    const names = { plan: 'Plan your cards', fight: 'FIGHT', talk: 'Talk' + (S.overtime.next ? ' · OVERTIME next' : ''), vote: 'The Duchess decides', end: 'Game over' };
    game.phaseName.textContent = (S.overtime.active && S.phase === 'plan' ? 'OVERTIME · ' : '') + (names[S.phase] || '');
    if (S.deadline && ['plan', 'talk', 'vote'].includes(S.phase)) countdown = A.countdown(game.timer, S.deadline, now, () => {});
    if (S.round !== lastRound && S.phase === 'plan') { lastRound = S.round; caption(`${w.name}. ${S.iceStorm ? 'Ice Storm: heat refills half as fast.' : S.kingOn ? 'King Tea is here with his Royal Guards.' : 'Beat your crumpet to advance.'}`); if (S.round === 1) A.sound.chime(); }
    if (S.phase === 'plan' && myHero) {
      const H = S.heroes[myHero];
      const sig = [S.round, H.hand.join(','), H.placed.join(','), H.done, H.heat, H.frozen, S.robbedThisRound, S.landslides].join('|');
      if (sig === handSig && game.bottom.querySelector('.hand-wrap')) return;
      handSig = sig;
    } else handSig = '';
    game.bottom.innerHTML = '';
    if (S.phase === 'plan') renderHand();
    else if (S.phase === 'talk') renderTalk();
    else if (S.phase === 'vote') renderVote();
    else if (S.phase === 'end') showEnd();
    else if (S.phase === 'fight') game.bottom.append(A.h('div', { class: 'talk ct-center ct-muted' }, 'Watch the fight...'));
  }

  /* ---------- hand ---------- */
  function renderHand() {
    if (!myHero) { game.bottom.append(A.h('div', { class: 'talk ct-center ct-muted' }, 'You are watching. Pick a hero in the lobby next game.')); return; }
    const H = S.heroes[myHero];
    const wrap = A.h('div', { class: 'hand-wrap' });
    const budget = H.heatMax ? H.heat - OT.placedCost(S, myHero) : null;
    wrap.append(A.h('div', { class: 'meta' }, A.h('span', null, A.h('b', null, heroName(myHero)), H.frozen > 0 ? ' · FROZEN (only Fire works)' : ''), A.h('span', null, budget == null ? 'Cards are free' : `Heat ${budget} / ${H.heatMax}`)));
    const slots = A.h('div', { class: 'slots' });
    for (let i = 0; i < 3; i++) { const c = H.placed[i]; slots.append(c ? A.h('div', { class: 'slot filled', onclick: () => { if (!H.done) input({ k: 'unplace', card: c }); } }, OT.CARDS[c].name) : A.h('div', { class: 'slot' }, 'empty')); }
    wrap.append(slots);
    const hand = A.h('div', { class: 'hand' });
    for (const c of H.hand) {
      const card = OT.CARDS[c], ok = OT.canPlace(S, myHero, c);
      hand.append(A.h('div', { class: 'card k-' + card.kind + (ok ? '' : ' no'), 'data-card': c, onclick: () => { if (ok) { A.sound.tap(); input({ k: 'place', card: c }); } else A.toast(H.frozen > 0 ? 'Frozen: only Fire works' : H.placed.length >= 3 ? 'Three cards is the limit' : 'Not enough heat'); } },
        A.h('div', { class: 'cost' }, H.heatMax ? card.cost : 0), A.h('div', { class: 'nm' }, card.name), A.h('div', { class: 'tx' }, card.text)));
    }
    wrap.append(hand);
    const done = A.h('button', { class: 'ct-btn peach', disabled: H.done ? '' : null, onclick: () => input({ k: 'done' }) }, H.done ? 'Waiting for the others' : 'Ready');
    wrap.append(A.h('div', { class: 'actions' }, done));
    if (role === 'roamer' && S.traitor && !S.exposed) wrap.append(traitorTools());
    game.bottom.append(wrap);
  }
  function traitorTools() {
    const others = OT.HEROES.filter(h => h !== myHero);
    const tools = A.h('div', { class: 'trait-tools' });
    const robbed = S.robbedThisRound;
    tools.append(A.h('button', { class: 'ct-btn sm', disabled: robbed ? '' : null, onclick: () => pickVictim('Rob a card from...', v => input({ k: 'rob', victim: v })) }, robbed ? 'Robbed this round' : 'Rob a card'));
    tools.append(A.h('button', { class: 'ct-btn sm', disabled: S.landslides <= 0 ? '' : null, onclick: () => pickVictim('Landslide on...', v => input({ k: 'slide', victim: v })) }, `Landslide (${S.landslides})`));
    return A.h('div', null, A.h('div', { class: 'ct-muted', style: 'font-size:.8rem;margin-top:8px' }, 'Only you see this. You ride with the Roamer.'), tools);
    function pickVictim(title, fn) {
      const m = A.modal(A.h('div', null, A.h('h3', null, title), A.h('div', { class: 'vote-grid' }, ...others.map(h => A.h('div', { class: 'vote-opt', onclick: () => { fn(h); m.close(); } }, A.sprite(h, { label: false }).el, A.h('div', null, heroName(h)))))));
    }
  }

  /* ---------- talk ---------- */
  function renderTalk() {
    const wrap = A.h('div', { class: 'talk' });
    if (!chat) chat = A.chat(A.h('div'), { side: 'coffee', onSend: m => { const msg = { id: A.uid(), from: myName || heroName(myHero || 'joe'), text: m.text, taunt: m.taunt, side: 'coffee' }; if (room) room.chat(msg); chat.add({ ...msg, mine: true }); if (myHero && sprites.hero[myHero]) sprites.hero[myHero].say(m.text); } });
    const ot = S.overtime;
    if (ot.proposedBy && !ot.next) {
      const yes = Object.values(ot.votes).filter(Boolean).length;
      const box = A.h('div', { class: 'ot-vote' }, A.h('b', null, `${heroName(ot.proposedBy)} calls OVERTIME: next round counts double.`), A.h('div', { class: 'ct-muted' }, `${yes} of ${OT.HEROES.length} say yes`),
        A.h('div', { class: 'ct-row' }, A.h('button', { class: 'ct-btn peach sm', onclick: () => input({ k: 'otvote', yes: true }) }, 'Yes, double it'), A.h('button', { class: 'ct-btn ghost sm', onclick: () => input({ k: 'otvote', yes: false }) }, 'No')));
      wrap.append(box);
    } else if (myHero && !ot.next) wrap.append(A.h('button', { class: 'ct-btn ot-propose', onclick: () => input({ k: 'propose' }) }, 'Call Overtime (double the next round)'));
    else if (ot.next) wrap.append(A.h('div', { class: 'ct-center', style: 'color:var(--yellow);margin-bottom:8px' }, 'OVERTIME is on. Next round counts double.'));
    wrap.append(chat.el);
    game.bottom.append(wrap);
  }

  /* ---------- vote ---------- */
  let myVote = null;
  function renderVote() {
    const wrap = A.h('div', { class: 'talk' });
    wrap.append(A.h('div', { class: 'ct-center' }, A.h('b', null, 'The Duchess sweeps in. Who is riding with the Roamer?'), A.h('div', { class: 'ct-muted', style: 'font-size:.85rem' }, S.traitor ? 'Freeze the right hero and the clock gives back 6 hours. Freeze an innocent and the Roamer gains 2.' : 'No traitor this game: whoever you freeze sits out a round.')));
    if (myHero) {
      const grid = A.h('div', { class: 'vote-grid' });
      for (const h of OT.HEROES) {
        if (h === myHero) continue;
        const H = S.heroes[h];
        grid.append(A.h('div', { class: 'vote-opt' + (myVote === h ? ' sel' : ''), onclick: () => { myVote = h; input({ k: 'vote', target: h }); render(); } }, A.sprite(h, { label: false }).el, A.h('div', null, heroName(h)), A.h('small', null, `${H.fails} round${H.fails === 1 ? '' : 's'} without advancing`)));
      }
      wrap.append(grid, A.h('button', { class: 'ct-btn ghost sm', onclick: () => { myVote = 'skip'; input({ k: 'vote', target: 'skip' }); render(); } }, myVote === 'skip' ? 'Skipping' : 'Skip'));
    }
    if (chat) wrap.append(chat.el);
    game.bottom.append(wrap);
  }
  function verdictFx(r) {
    myVote = null;
    if (!r.target) { caption('The Duchess finds nobody. Everyone shivers.'); return; }
    const sp = sprites.hero[r.target]; if (sp) { sp.freeze(true); sp.say(r.wasRoamer ? 'UNMASKED!' : 'Frozen!', 2500); }
    caption(r.wasRoamer ? `The Roamer rode with ${heroName(r.target)}! The clock gives back 6 hours.` : `${heroName(r.target)} is frozen.${S.traitor ? ' Innocent. The Roamer gains 2 hours.' : ''}`);
    if (r.wasRoamer) A.sound.win(); else A.sound.freeze();
    render();
  }
  function robbedFx(h) {
    const sp = sprites.hero[h]; if (sp) sp.say('My card!', 1500);
    if (h === myHero) { const c = A.$('.hand .card:last-child'); if (c) c.classList.add('vanish'); A.toast('The Roamer\'s grin... a card is gone.'); }
    if (sprites.roamer) { A.flash(sprites.roamer.el); sprites.roamer.say('Heh heh.', 1200); }
    A.sound.hit();
    setTimeout(() => { if (S.phase === 'plan') render(); }, 750);
  }
  function showRole() {
    const isR = role === 'roamer';
    A.modal(A.h('div', { class: 'role' + (isR ? ' tea' : '') }, A.sprite(isR ? 'roamer' : myHero || 'joe', { label: false }).el,
      A.h('h2', null, isR ? 'The Roamer rides with you.' : 'You are on Team Coffee.'),
      A.h('p', null, isR ? 'Play normally. Once a round you can rob a card from a teammate, and twice a game you can trigger a Landslide. You win if the clock reaches 60. Do not get caught by the Duchess.' : 'Beat your crumpet every round, keep your heat up, and watch for cards going missing. Someone may be working for the Roamer.'),
      A.h('button', { class: 'ct-btn', onclick: e => e.target.closest('.ct-modal-wrap').remove() }, 'Got it')), { dismiss: false });
  }

  /* ---------- the fight player ---------- */
  function playFight(events, finalState, isRoamer) {
    if (playing) { pendingState = finalState; return; }
    playing = true; pendingState = null;
    if (!isHost()) S = finalState; // we show the pre-fight picture and animate toward the result
    if (isHost()) { /* host already holds the final state */ }
    S.phase = 'fight';
    const pre = JSON.parse(JSON.stringify(S));
    // rewind the visible numbers so the replay can count them down
    const cm = events.find(e => e.type === 'clockmove');
    if (cm) pre.clock = cm.from;
    for (const h of OT.HEROES) {
      const E = pre.enemies[h], H = pre.heroes[h];
      if (E && E.maxHp && !isRoamer) { E.hp = E.maxHp; E.alive = true; E.frozen = false; }
      if (!isRoamer) { H.frozen = Math.max(0, H.frozen - (events.some(e => e.type === 'freeze' && e.hero === h) ? 1 : 0)); if (H.advanced) H.seg = Math.max(0, H.seg - 1); H.hp = Math.min(OT.HERO[h].hp, H.hp + events.filter(e => e.type === 'herohit' && e.hero === h).reduce((n, e) => n + e.n, 0) - events.filter(e => e.type === 'heal' && e.hero === h).reduce((n, e) => n + e.n, 0)); }
      else { H.hp = Math.min(OT.HERO[h].hp, H.hp + events.filter(e => e.type === 'herohit' && e.hero === h).reduce((n, e) => n + e.n, 0)); if (events.some(e => e.type === 'rumble' && e.hero === h)) H.seg++; }
    }
    const shown = pre;
    const hadChat = chat;
    game.bottom.innerHTML = '';
    game.bottom.append(A.h('div', { class: 'talk ct-center ct-muted' }, isRoamer ? 'The Roamer...' : 'Cards up. Watch the fight.'));
    const saved = S; S = shown; render(); S = saved;
    if (!isRoamer && !isHost()) { /* clients: hp numbers come from events */ }
    let i = 0;
    const t0 = performance.now();
    function step() {
      if (i >= events.length) { finish(); return; }
      const e = events[i];
      const due = t0 + e.at;
      if (performance.now() < due) { requestAnimationFrame(step); return; }
      i++; apply(e); requestAnimationFrame(step);
    }
    function apply(e) {
      const hs = e.hero && sprites.hero[e.hero], es = e.enemy && sprites.enemy[e.enemy];
      if (e.text) caption(e.text);
      switch (e.type) {
        case 'swing': hs && hs.swing(); A.sound.swing(); break;
        case 'hit': if (es) { es.hit(); floatNum(es.el, '-' + e.n, 'dmg'); const E = shown.enemies[e.enemy]; E.hp -= e.n; A.$('.bar.ehp i', laneOf(e.enemy)).style.width = (100 * Math.max(0, E.hp) / E.maxHp) + '%'; } break;
        case 'defeat': if (es) { es.el.classList.add('dead'); A.sound.win(); } break;
        case 'eswing': es && es.swing(); A.sound.swing(); break;
        case 'herohit': if (hs) { hs.hit(); floatNum(hs.el, '-' + e.n, 'hdmg'); A.shake(game.stage, 3, 200); const H = shown.heroes[e.hero]; H.hp = Math.max(0, H.hp - e.n); A.$('.bar.hp i', laneOf(e.hero)).style.width = (100 * H.hp / OT.HERO[e.hero].hp) + '%'; } break;
        case 'heal': if (hs) { floatNum(hs.el, '+' + e.n, 'heal'); hs.say('Ahh.', 800); } break;
        case 'freeze': if (hs) hs.freeze(true); break;
        case 'thaw': if (hs) { hs.freeze(false); hs.say('Warm!', 1000); } break;
        case 'frozen': if (hs) hs.say('...', 800); break;
        case 'fly': if (hs) { hs.say('Wheee!', 1200); hs.el.style.transition = 'transform .9s'; hs.el.style.transform = 'translateY(-40px)'; setTimeout(() => { hs.el.style.transform = ''; }, 900); } break;
        case 'enemyfrozen': es && es.freeze(true); break;
        case 'block': hs && hs.say('Blocked!', 800); break;
        case 'umbrella': hs && hs.say('Umbrella!', 1000); break;
        case 'rumble': A.sound.rumble(); A.shake(game.stage, 6, 500); break;
        case 'guard': if (!sprites.king) { sprites.king = A.sprite('king', { label: 'King Tea', size: 54 }); sprites.king.el.classList.add('king'); game.stage.append(sprites.king.el); } sprites.king.swing(); break;
        case 'clockmove': { const from = e.from, to = e.to, dur = 1500, t0 = performance.now(); A.sound.tick(); (function anim() { const k = Math.min(1, (performance.now() - t0) / dur); clockUI.set(from + (to - from) * k); if (k < 1) requestAnimationFrame(anim); else if (to > from) A.sound.tick(); })(); break; }
        case 'roamer': if (!sprites.roamer) { sprites.roamer = A.sprite('roamer', { label: 'The Roamer', size: 50 }); sprites.roamer.el.classList.add('roamer-corner'); game.stage.append(sprites.roamer.el); } sprites.roamer.el.style.transform = 'scale(1.3)'; A.sound.rumble(); break;
        case 'rswing': sprites.roamer && sprites.roamer.swing(); break;
        case 'rob': if (hs) hs.say('My card!', 1200); A.sound.hit(); break;
        case 'rsink': if (sprites.roamer) { sprites.roamer.el.style.transform = ''; if (!S.traitor) setTimeout(() => { if (sprites.roamer) { sprites.roamer.remove(); sprites.roamer = null; } }, 600); } break;
      }
    }
    function finish() {
      playing = false;
      if (!isHost() && pendingState) { S = pendingState; pendingState = null; }
      // for the host, S is already the real state; for clients finalState is
      if (!isHost() && finalState) S = finalState;
      chat = hadChat;
      if (S.phase === 'fight') { /* host moves on by timer; show the result until then */ renderLanes(); }
      else render();
    }
    requestAnimationFrame(step);
  }

  /* ---------- end ---------- */
  function showEnd() {
    clearHostTimers(); if (countdown) countdown.stop();
    const coffee = S.winner === 'coffee';
    if (coffee) A.sound.win(); else A.sound.lose();
    const rows = OT.HEROES.map(h => A.h('div', null, A.h('span', null, `${heroName(h)}${S.names && S.names[h] ? ' (' + S.names[h] + ')' : ''}${S.traitor === h ? ' · the Roamer' : ''}`), A.h('span', null, `seg ${S.heroes[h].seg} · ${S.heroes[h].fails} stalls`)));
    screen('end', A.h('div', { class: 'ct-wrap end' },
      A.sprite(coffee ? 'joe' : 'king', { label: false }).el,
      A.h('h1', null, coffee ? 'Coffee Time!' : 'Tea Time.'),
      A.h('p', null, S.reason),
      A.h('p', { class: 'ct-muted' }, `The clock stopped at ${S.clock} hours after ${S.round} rounds.`),
      S.traitor ? A.h('p', null, A.h('b', null, `The Roamer rode with ${heroName(S.traitor)}.`), S.exposed ? ' The Duchess caught them.' : ' Nobody caught them.') : null,
      A.h('div', { class: 'score' }, ...rows),
      A.h('button', { class: 'ct-btn peach', onclick: () => { if (room) { if (room.isHost) { room.restart(); renderLobby(); } else A.toast('Waiting for the host'); } else startSolo(); } }, room ? (room.isHost ? 'Back to the lobby' : 'Waiting for the host') : 'Play again'),
      A.h('button', { class: 'ct-btn ghost', onclick: () => { if (room) room.close(); room = null; S = null; game = null; showHome(); } }, 'Home')));
    game = null;
  }

  /* ---------- boot ---------- */
  showHome();
  const u = new URL(location.href), rc = (u.searchParams.get('room') || '').toUpperCase();
  if (/^[A-Z]{4}$/.test(rc)) { if (!myName) { A.toast('Type your name, then tap Join'); } else joinRoom(rc); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(() => {}).catch(() => {});
})();
