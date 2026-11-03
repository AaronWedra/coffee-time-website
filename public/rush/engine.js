/* ============================================================
   COFFEE TIME: RUSH HOUR, the simulation.
   Pure: newGame(opts) -> state; step(state, dt, inputs, now) -> events[].
   Runs on the host phone (and in Node for balance tests). No DOM here.
   Times inside the state are simulation seconds (state.t); deadlines
   shown to players are converted to host-clock ms by the UI.
   ============================================================ */
(function (root) {
  'use strict';
  const E = {};
  const HEROES = ['joe', 'thermos', 'miss', 'don'];
  const LANES = ['joe', 'thermos', 'team', 'miss', 'don'];       // column order on the map
  const CHAMBER = 13, CROSS = [4, 8], COFFEE = [2, 6, 10];
  const WORLDS = ['coffee', 'donut', 'warp', 'crumpet', 'tea'];
  const WORLD_TIME = [150, 150, 150, 150, 200];                   // seconds of live play per world before the clock punishes
  const NEST_IDX = [2, 3, 5, 7, 9, 11];
  const ENEMY = { crumpet: { hp: 2, dmg: 0.8, name: 'Crumpet' }, fork: { hp: 3, dmg: 1, name: 'Crumpet with Fork' }, meangirls: { hp: 3, dmg: 1.2, name: 'Mean Girl Crumpets' }, body: { hp: 4, dmg: 1.5, name: 'Bodybuilder Crumpet' }, guard: { hp: 4, dmg: 1.5, name: 'Royal Guard' } };
  const WORLD_ENEMIES = [['crumpet', 'crumpet', 'fork', 'crumpet', 'crumpet', 'fork'], ['crumpet', 'fork', 'crumpet', 'meangirls', 'fork', 'fork'], ['fork', 'meangirls', 'fork', 'body', 'meangirls', 'meangirls'], ['meangirls', 'body', 'meangirls', 'body', 'body', 'body'], ['body', 'guard', 'body', 'guard', 'guard', 'guard']];
  const HERO = {
    joe:     { maxHeat: 10, drain: 0.18, atk: 1.0, speed: 0.75 },
    thermos: { maxHeat: 12, drain: 0.1, atk: 0.8, speed: 0.65, guard: 0.5 },
    miss:    { maxHeat: 8,  drain: 0.2, atk: 0.8, speed: 1.2, evade: true },
    don:     { maxHeat: 0,  drain: 0,    atk: 0.9, speed: 0.75, team: true },
  };
  const CARDS = {
    health:   { name: 'Health', text: 'Refill your heat.' },
    fire:     { name: 'Fire', text: 'Thaw instantly and refill. Plays itself if you freeze.' },
    sugar:    { name: 'Sugar Cube', text: 'Double speed for 6 seconds.' },
    sleepy:   { name: 'Sleepy Time Tea', text: 'Turn King Tea\'s clock back 4 hours.' },
    warp:     { name: 'Team Warp', text: 'Jump to the next crossroads.' },
    earth:    { name: 'Earth', text: 'Blocks the Roamer\'s next attack or snatch.' },
    wind:     { name: 'Wind Feather', text: 'Every hero gains 3 heat.' },
    protector:{ name: 'Card Protector', text: 'The Roamer cannot snatch while you hold this.' },
    bolt:     { name: 'Bolt', text: 'Move 50% faster while held.' },
    spoon:    { name: 'Spoon', text: 'Hit 50% harder while held.' },
    umbrella: { name: 'Umbrella', text: 'Blocks one freeze. Plays itself.' },
    bagel:    { name: 'Bagel', text: 'Push every crumpet on your lane back 2 spaces.' },
    landslide:{ name: 'Landslide', text: 'Push one crumpet back 3 spaces.' },
  };
  const PASSIVE = { protector: 1, bolt: 1, spoon: 1, umbrella: 1, earth: 1 };
  const DRAFT_POOL = ['health', 'fire', 'sugar', 'sleepy', 'warp', 'earth', 'wind', 'protector', 'bolt', 'spoon', 'umbrella', 'bagel', 'landslide'];
  E.HEROES = HEROES; E.LANES = LANES; E.CHAMBER = CHAMBER; E.CROSS = CROSS; E.COFFEE = COFFEE; E.CARDS = CARDS; E.ENEMY = ENEMY; E.WORLDS = WORLDS; E.HERO = HERO;

  function rngOf(seed) { let a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isCross = i => CROSS.includes(i);

  E.newGame = function (opts) {
    opts = opts || {};
    const s = {
      seed: opts.seed || (Math.random() * 1e9) | 0,
      phase: 'intro', world: 0, t: 0, phaseLeft: 5, worldT: 0,
      clock: 0, worldClock0: 0, worldPar: 11, overtime: false,
      heroes: {}, crumpets: [], graves: [], nests: [], drafts: {},
      duchess: { nextIn: 40, state: 'wait', row: -1, left: 0, human: !!opts.humanDuchess },
      roamer: { state: 'under', left: 0, cooldown: 20, reach: 0, target: null, lane: null, idx: 0, human: !!opts.humanRoamer, full: false },
      king: { on: false, pos: 0 },
      button: { hero: null, left: 0 },
      winner: null, log: [], nextId: 1,
      players: opts.players || {},     // heroKey -> {name, ai:boolean, pid}
    };
    for (const h of HEROES) {
      const p = (opts.players && opts.players[h]) || { name: null, ai: true };
      s.heroes[h] = { pos: 0, lane: h, heat: HERO[h].maxHeat, maxHeat: HERO[h].maxHeat, frozen: 0, moveTo: null, speedBoost: 0, card: null, draft: null, fight: null, ai: p.ai !== false, name: p.name || null, pid: p.pid || null, hits: 0, kos: 0, stuns: 0, aiThink: 0, chamber: false, umbrellaUsed: false };
    }
    s.rng = s.seed;
    setupWorld(s);
    return s;
  };

  function rnd(s) { const r = rngOf(s.rng); const v = r(); s.rng = (s.rng + 0x6D2B79F5) | 0; return v; }
  const NAMES = { joe: 'Cup Joe', thermos: 'Thermos', miss: 'Little Miss Hot Shot', don: 'Donette' };
  function nm(h) { return NAMES[h] || h; }
  function log(s, text) { s.log.push(text); if (s.log.length > 6) s.log.shift(); }

  function setupWorld(s) {
    s.crumpets = []; s.graves = []; s.nests = []; s.drafts = {};
    s.worldT = 0; s.worldClock0 = s.clock;
    s.duchess.nextIn = 40; s.duchess.state = 'wait';
    s.roamer.state = 'under'; s.roamer.cooldown = 25; s.roamer.full = (s.world % 3 === 2);
    s.king.on = s.overtime; s.king.pos = CHAMBER;
    s.button = { hero: null, left: 0 };
    for (const h of HEROES) { const H = s.heroes[h]; H.pos = 0; H.lane = h; H.moveTo = null; H.fight = null; H.chamber = false; H.draft = null; H.frozen = 0; if (HERO[h].maxHeat) H.heat = Math.max(H.heat, 4); }
    const kinds = WORLD_ENEMIES[s.world];
    for (const h of HEROES) for (let i = 0; i < NEST_IDX.length; i++) s.nests.push({ id: s.nextId++, lane: h, idx: NEST_IDX[i], kind: kinds[i], spawned: false, cleared: false });
    // Tea World: Royal Guards wait at the chamber door
    if (s.world === 4) for (const h of HEROES) s.nests.push({ id: s.nextId++, lane: h, idx: 12, kind: 'guard', spawned: false, cleared: false });
  }

  function heroesAlive(s) { return HEROES.filter(h => s.heroes[h].frozen <= 0); }
  function adjacent(s, a, b) {
    const A = s.heroes[a], B = s.heroes[b];
    if (A.lane === B.lane) return Math.abs(A.pos - B.pos) <= 1.2;
    // crossroads touch the team path
    const onCrossA = isCross(Math.round(A.pos)), onCrossB = isCross(Math.round(B.pos));
    if (A.lane === 'team' && onCrossB && Math.abs(A.pos - B.pos) <= 1.2) return true;
    if (B.lane === 'team' && onCrossA && Math.abs(A.pos - B.pos) <= 1.2) return true;
    return false;
  }
  function hasTeammateNear(s, h) { return HEROES.some(o => o !== h && s.heroes[o].frozen <= 0 && adjacent(s, h, o)); }
  function laneDist(a, b) { return Math.abs(LANES.indexOf(a) - LANES.indexOf(b)); }

  /* ---------- inputs ----------
     {type:'move', hero, to}             move along the current lane to space `to` (or onto/off the team path at a crossroads: to:'team'|'home')
     {type:'swing', hero, acc}           0..1 accuracy judged by the UI/host (ring)
     {type:'card', hero, pick}           choose a draft card id (or 'skip')
     {type:'use', hero}                  play the held card
     {type:'rise', grave}                human Roamer: rise from grave id
     {type:'sweep', row}                 human Duchess: sweep a row
  */
  function applyInput(s, inp, ev) {
    const H = s.heroes[inp.hero];
    switch (inp.type) {
      case 'move': {
        if (!H || H.frozen > 0 || H.fight || H.chamber) return;
        const at = Math.round(H.pos);
        if (inp.to === 'team') { if (isCross(at) && H.lane !== 'team' && Math.abs(H.pos - at) < 0.3) { H.lane = 'team'; H.pos = at; H.moveTo = null; ev.push({ e: 'lane', hero: inp.hero }); } return; }
        if (inp.to === 'home') { if (isCross(at) && H.lane === 'team' && Math.abs(H.pos - at) < 0.3) { H.lane = inp.hero; H.pos = at; H.moveTo = null; ev.push({ e: 'lane', hero: inp.hero }); } return; }
        const to = clamp(+inp.to | 0, 0, CHAMBER);
        if (H.lane === 'team' && (to < 4 || to > 8)) return;
        H.moveTo = to;
        return;
      }
      case 'swing': {
        if (!H || !H.fight) return;
        const f = H.fight; if (f.turn !== 'hero' || f.ringLeft <= 0 || f.swung) return;
        f.swung = true; f.acc = clamp(+inp.acc || 0, 0, 1);
        return;
      }
      case 'card': {
        if (!H || !H.draft) return;
        if (inp.pick !== 'skip' && H.draft.cards.includes(inp.pick)) { H.card = inp.pick; ev.push({ e: 'card', hero: inp.hero, card: inp.pick }); }
        H.draft = null; delete s.drafts[inp.hero];
        return;
      }
      case 'use': return useCard(s, inp.hero, ev);
      case 'rise': {
        if (!s.roamer.human || s.roamer.state !== 'under' || s.roamer.cooldown > 0) return;
        const g = s.graves.find(x => x.id === inp.grave); if (!g) return;
        roamerRise(s, g, ev); return;
      }
      case 'sweep': {
        if (!s.duchess.human || s.duchess.state !== 'ready') return;
        const row = clamp(+inp.row | 0, 1, 12); duchessStart(s, row, ev); return;
      }
    }
  }

  function useCard(s, h, ev) {
    const H = s.heroes[h]; const c = H.card; if (!c || PASSIVE[c]) return;
    if (H.frozen > 0 && c !== 'fire') return;
    H.card = null;
    switch (c) {
      case 'health': if (H.maxHeat) H.heat = H.maxHeat; break;
      case 'fire': H.frozen = 0; if (H.maxHeat) H.heat = H.maxHeat; break;
      case 'sugar': H.speedBoost = 6; break;
      case 'sleepy': s.clock = Math.max(0, s.clock - 4); ev.push({ e: 'clock', hero: h, hours: -4 }); break;
      case 'warp': { const at = Math.round(H.pos); const next = CROSS.find(x => x > at); if (next) { H.pos = next; H.moveTo = null; H.fight = null; } break; }
      case 'wind': for (const o of HEROES) { const O = s.heroes[o]; if (O.maxHeat) O.heat = Math.min(O.maxHeat, O.heat + 3); } break;
      case 'bagel': for (const c2 of s.crumpets) if (c2.lane === H.lane && !c2.dead) c2.pos = Math.min(CHAMBER, c2.pos + 2); if (H.fight) H.fight = null; break;
      case 'landslide': { const c2 = s.crumpets.filter(x => x.lane === H.lane && !x.dead).sort((a, b) => a.pos - b.pos)[0]; if (c2) { c2.pos = Math.min(CHAMBER, c2.pos + 3); if (H.fight && H.fight.enemy === c2.id) H.fight = null; } break; }
    }
    ev.push({ e: 'used', hero: h, card: c });
    log(s, `${nm(h)} plays ${CARDS[c].name}.`);
  }

  /* ---------- the step ---------- */
  E.step = function (s, dt, inputs, hostNow) {
    const ev = [];
    if (s.winner) return ev;
    s.t += dt;
    for (const inp of inputs || []) applyInput(s, inp, ev);

    if (s.phase === 'intro') { s.phaseLeft -= dt; if (s.phaseLeft <= 0) { s.phase = 'live'; ev.push({ e: 'live', world: s.world }); } return ev; }
    if (s.phase === 'interlude') {
      s.phaseLeft -= dt;
      if (!s.clockPaused) tickClock(s, dt, ev);
      if (s.phaseLeft <= 0) { s.world++; s.phase = 'intro'; s.phaseLeft = 5; s.clockPaused = false; setupWorld(s); ev.push({ e: 'intro', world: s.world }); }
      return ev;
    }
    if (s.phase === 'end') return ev;

    s.worldT += dt;
    tickClock(s, dt, ev);
    for (const h of HEROES) tickHero(s, h, dt, ev);
    tickNests(s, ev);
    tickCrumpets(s, dt, ev);
    tickFights(s, dt, ev);
    tickDuchess(s, dt, ev);
    tickRoamer(s, dt, ev);
    tickKing(s, dt, ev);
    tickButton(s, dt, ev);
    for (const h of HEROES) if (s.heroes[h].ai) aiHero(s, h, dt, ev);
    if (!s.roamer.human) aiRoamer(s, dt, ev);
    if (!s.duchess.human) aiDuchess(s, dt, ev);

    if (s.clock >= 60) { s.winner = 'tea'; s.phase = 'end'; ev.push({ e: 'end', winner: 'tea', why: 'King Tea\'s clock struck 60 hours.' }); }
    else if (heroesAlive(s).length === 0) { s.winner = 'tea'; s.phase = 'end'; ev.push({ e: 'end', winner: 'tea', why: 'Every hero is frozen.' }); }
    return ev;
  };

  function tickClock(s, dt, ev) {
    const was = Math.floor(s.clock);
    let rate = 0.155;                                                   // nearly 10 hours a minute at base; par pauses it between worlds
    rate += 0.004 * s.crumpets.filter(c => !c.dead).length;             // every standing crumpet
    rate += 0.006 * HEROES.filter(h => s.heroes[h].frozen > 0).length;  // every frozen hero
    if (s.phase === 'live' && s.worldT > WORLD_TIME[s.world]) rate *= 1.6;   // dawdling
    if (s.overtime) rate *= 2;
    s.clock = Math.min(60, s.clock + rate * dt);
    if (!s.overtime && s.clock >= 48) { s.overtime = true; s.king.on = true; ev.push({ e: 'overtime' }); log(s, 'OVERTIME. King Tea walks onto the board.'); }
    if (Math.floor(s.clock) > was) ev.push({ e: 'hour', clock: s.clock });
  }

  function tickHero(s, h, dt, ev) {
    const H = s.heroes[h], P = HERO[h];
    if (H.speedBoost > 0) H.speedBoost -= dt;
    if (H.frozen > 0) {
      const near = hasTeammateNear(s, h);
      H.frozen -= dt * (near ? 2 : 1);
      if (H.frozen <= 0) { H.frozen = 0; H.heat = Math.max(3, H.heat); ev.push({ e: 'thaw', hero: h }); log(s, `${nm(h)} thaws out.`); }
      return;
    }
    if (H.chamber) return;
    // heat
    if (P.maxHeat) {
      let drain = P.drain * (s.world === 3 ? 1.6 : 1) * (s.world === 4 ? 1.4 : 1);
      const at = Math.round(H.pos);
      if (hasTeammateNear(s, h)) H.heat += 0.8 * dt; else if (COFFEE.includes(at) && H.lane !== 'team' && Math.abs(H.pos - at) < 0.3) H.heat += 1.2 * dt; else H.heat -= drain * dt;
      H.heat = clamp(H.heat, 0, H.maxHeat);
      if (H.heat <= 0) freezeHero(s, h, ev, 'cold');
      if (H.frozen > 0) return;
    }
    // movement
    if (H.moveTo != null && !H.fight) {
      let v = P.speed * (H.speedBoost > 0 ? 2 : 1) * (H.card === 'bolt' ? 1.5 : 1);
      if (H.lane === 'team' && s.heroes.don.lane === 'team' && s.heroes.don.frozen <= 0) v *= 2;   // Donette opens the Team Path
      const dir = Math.sign(H.moveTo - H.pos);
      H.pos += dir * v * dt;
      if ((dir > 0 && H.pos >= H.moveTo) || (dir < 0 && H.pos <= H.moveTo) || dir === 0) { H.pos = H.moveTo; H.moveTo = null; }
      if (H.pos >= CHAMBER - 0.01 && H.lane !== 'team') { H.pos = CHAMBER; H.chamber = true; H.moveTo = null; ev.push({ e: 'chamber', hero: h }); log(s, `${nm(h)} reaches the Activation Chamber.`); }
      // a crumpet on the lane within 0.6 ahead starts a fight
    }
    if (!H.fight) {
      const c = s.crumpets.find(c => !c.dead && c.lane === H.lane && c.spawnLeft <= 0 && Math.abs(c.pos - H.pos) < 0.7);
      if (c) startFight(s, h, c, ev);
    }
    if (H.draft) { H.draft.left -= dt; if (H.draft.left <= 0) { H.card = H.draft.cards[0]; ev.push({ e: 'card', hero: h, card: H.card, auto: true }); H.draft = null; delete s.drafts[h]; } }
  }

  function freezeHero(s, h, ev, why) {
    const H = s.heroes[h];
    if (H.card === 'umbrella' && why !== 'cold') { H.card = null; ev.push({ e: 'used', hero: h, card: 'umbrella' }); return; }
    if (H.card === 'fire') { H.card = null; H.heat = H.maxHeat || 0; ev.push({ e: 'used', hero: h, card: 'fire' }); return; }
    H.frozen = 8; H.heat = 0; H.moveTo = null; H.fight = null; H.stuns++;
    ev.push({ e: 'freeze', hero: h, why }); log(s, `${nm(h)} is frozen (${why}).`);
  }

  function tickNests(s, ev) {
    for (const n of s.nests) {
      if (n.spawned) continue;
      const near = HEROES.some(h => { const H = s.heroes[h]; return H.lane === n.lane && H.frozen <= 0 && n.idx - H.pos <= 1.5 && n.idx - H.pos > -0.5; });
      if (near) { n.spawned = true; s.crumpets.push({ id: s.nextId++, nest: n.id, kind: n.kind, lane: n.lane, pos: n.idx, hp: ENEMY[n.kind].hp, maxHp: ENEMY[n.kind].hp, spawnLeft: 1.0, dead: false }); ev.push({ e: 'spawn', lane: n.lane, idx: n.idx, kind: n.kind }); }
    }
  }
  function tickCrumpets(s, dt) { for (const c of s.crumpets) if (!c.dead && c.spawnLeft > 0) c.spawnLeft -= dt; }

  function startFight(s, h, c, ev) {
    const H = s.heroes[h]; H.moveTo = null;
    H.fight = { enemy: c.id, turn: 'hero', ringLeft: 1.0, ringDur: 1.0, swung: false, acc: 0, swings: 0 };
    ev.push({ e: 'fight', hero: h, enemy: c.id, kind: c.kind });
  }
  function tickFights(s, dt, ev) {
    for (const h of HEROES) {
      const H = s.heroes[h]; if (!H.fight) continue;
      const f = H.fight, c = s.crumpets.find(x => x.id === f.enemy);
      if (!c || c.dead) { H.fight = null; continue; }
      f.ringLeft -= dt;
      if (f.turn === 'hero') {
        if (f.ringLeft <= -(H.ai ? 0 : 0.15) || f.swung) {   // humans get 150 ms of grace for the wire
          const acc = f.swung ? f.acc : 0;
          const full = acc >= 0.6;
          let dmg = (full ? 1 : 0.5) * HERO[h].atk * (H.card === 'spoon' ? 1.5 : 1);
          if (acc < 0.15 && !f.swung) dmg = 0;
          c.hp -= dmg; f.swings++; H.hits++;
          if (H.maxHeat) H.heat = Math.max(0.5, H.heat - (full ? 1 : 0.5));
          ev.push({ e: 'swing', hero: h, enemy: c.id, full, dmg, miss: dmg === 0 });
          if (c.hp <= 0) { c.dead = true; H.kos++; s.graves.push({ id: s.nextId++, lane: c.lane, idx: Math.round(c.pos) }); H.fight = null; ev.push({ e: 'ko', hero: h, enemy: c.id, kind: c.kind }); log(s, `${nm(h)} defeats a ${ENEMY[c.kind].name}.`);
            const n = s.nests.find(n => n.id === c.nest); if (n && !n.cleared) { n.cleared = true; offerDraft(s, h, ev); }
            continue; }
          f.turn = 'enemy'; f.ringLeft = 1.0; f.ringDur = 1.0; f.swung = false;
        }
      } else {
        if (f.ringLeft <= 0) {
          let dmg = ENEMY[c.kind].dmg * (HERO[h].guard ? HERO[h].guard : 1);
          if (H.maxHeat) H.heat -= dmg; else if (rnd(s) < 0.35) { /* Donette has no temperature: a hit pushes her back instead */ H.pos = Math.max(0, H.pos - 1); }
          ev.push({ e: 'ehit', hero: h, enemy: c.id, dmg });
          f.swings++;
          if (H.maxHeat && H.heat <= 0) { freezeHero(s, h, ev, 'crumpet'); continue; }
          f.turn = 'hero'; f.ringLeft = 1.0; f.ringDur = 1.0; f.swung = false;
        }
      }
    }
  }

  function offerDraft(s, h, ev) {
    const cards = []; const pool = DRAFT_POOL.slice();
    while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(rnd(s) * pool.length), 1)[0]);
    s.heroes[h].draft = { cards, left: 2.0 }; s.drafts[h] = cards;
    ev.push({ e: 'draft', hero: h, cards });
  }

  /* ---------- the Duchess ---------- */
  function tickDuchess(s, dt, ev) {
    const D = s.duchess;
    if (D.state === 'wait') { D.nextIn -= dt; if (D.nextIn <= 3 && D.nextIn + dt > 3) ev.push({ e: 'chime' }); if (D.nextIn <= 0) { D.state = 'ready'; D.readyFor = 0; } }
    else if (D.state === 'ready') { D.readyFor = (D.readyFor || 0) + dt; }
    else if (D.state === 'sweep') {
      D.left -= dt;
      if (D.left <= 0) {
        for (const h of HEROES) { const H = s.heroes[h]; if (H.frozen > 0 || H.chamber) continue; const at = Math.round(H.pos); if (at !== D.row || Math.abs(H.pos - at) > 0.6) continue; if (H.lane === 'team' || isCross(at)) continue; if (HERO[h].evade && rnd(s) < 0.7) { ev.push({ e: 'evade', hero: h }); continue; } freezeHero(s, h, ev, 'duchess'); }
        D.state = 'wait'; D.nextIn = 40; D.row = -1;
      }
    }
  }
  function duchessStart(s, row, ev) { const D = s.duchess; D.state = 'sweep'; D.row = row; D.left = 1.5; ev.push({ e: 'sweep', row }); log(s, 'The Duchess sweeps row ' + row + '.'); }
  function aiDuchess(s, dt, ev) {
    const D = s.duchess; if (D.state !== 'ready' || D.readyFor < 0.5) return;
    const targets = HEROES.filter(h => { const H = s.heroes[h]; const at = Math.round(H.pos); return H.frozen <= 0 && !H.chamber && H.lane !== 'team' && !isCross(at) && at > 0; });
    if (!targets.length) { D.readyFor = 0; D.nextIn = 8; D.state = 'wait'; return; }
    // the row with the most heroes
    const rows = {}; for (const h of targets) { const r = Math.round(s.heroes[h].pos); rows[r] = (rows[r] || 0) + 1; }
    const row = +Object.keys(rows).sort((a, b) => rows[b] - rows[a])[0];
    duchessStart(s, row, ev);
  }

  /* ---------- the Roamer, two beats ---------- */
  function tickRoamer(s, dt, ev) {
    const R = s.roamer;
    if (R.state === 'under') { R.cooldown -= dt; return; }
    R.left -= dt;
    if (R.left > 0) return;
    const T = R.target && s.heroes[R.target];
    switch (R.state) {
      case 'glow': R.state = 'rising'; R.left = 1.0; ev.push({ e: 'roamer', state: 'rising', lane: R.lane, idx: R.idx }); return;
      case 'rising': {
        R.reach = 1 + Math.floor(rnd(s) * 8); if (R.full) R.reach *= 2;
        const t = nearestHero(s, R.lane, R.idx, R.reach);
        R.target = t; R.state = 'swing'; R.left = 1.0;
        ev.push({ e: 'roamer', state: 'swing', reach: R.reach, target: t, lane: R.lane, idx: R.idx });
        log(s, t ? `The Roamer rises with reach ${R.reach} and goes for ${t}.` : `The Roamer rises with reach ${R.reach}. Nobody in reach.`);
        return;
      }
      case 'swing': {
        if (T && T.frozen <= 0 && !T.chamber) {
          if (T.card === 'earth') { T.card = null; ev.push({ e: 'used', hero: R.target, card: 'earth' }); }
          else { if (T.maxHeat) { T.heat -= 2; ev.push({ e: 'rhit', hero: R.target }); if (T.heat <= 0) freezeHero(s, R.target, ev, 'roamer'); } else { T.pos = Math.max(0, T.pos - 1); ev.push({ e: 'rhit', hero: R.target }); } }
        }
        R.state = 'rewind'; R.left = 2.0; ev.push({ e: 'roamer', state: 'rewind' }); return;
      }
      case 'rewind': {
        const t2 = nearestHero(s, R.lane, R.idx, R.reach, true); R.target = t2;
        R.state = 'snatch'; R.left = 0.8; ev.push({ e: 'roamer', state: 'snatch', target: t2 }); return;
      }
      case 'snatch': {
        const T2 = R.target && s.heroes[R.target];
        if (T2 && T2.card) {
          if (T2.card === 'protector') ev.push({ e: 'protected', hero: R.target });
          else if (T2.card === 'earth') { T2.card = null; ev.push({ e: 'used', hero: R.target, card: 'earth' }); }
          else { ev.push({ e: 'snatched', hero: R.target, card: T2.card }); log(s, `The Roamer snatches ${CARDS[T2.card].name} from ${R.target}.`); T2.card = null; }
        }
        R.state = 'sinking'; R.left = 1.0; ev.push({ e: 'roamer', state: 'sinking' }); return;
      }
      case 'sinking': {
        // Landslide: one hero slides back a space
        const cands = HEROES.filter(h => { const H = s.heroes[h]; return !H.chamber && H.pos > 0.5 && H.lane !== 'team' && H.frozen <= 0; }).sort((a, b) => s.heroes[b].pos - s.heroes[a].pos);
        if (cands.length) { const h = cands[0]; const H = s.heroes[h]; H.pos = Math.max(0, Math.round(H.pos) - 1); H.moveTo = null; H.fight = null; ev.push({ e: 'landslide', hero: h }); log(s, `Landslide! ${h} slides back.`); }
        R.state = 'under'; R.cooldown = 22; R.target = null; ev.push({ e: 'roamer', state: 'under' }); return;
      }
    }
  }
  function nearestHero(s, lane, idx, reach, needCard) {
    let best = null, bd = 1e9;
    for (const h of HEROES) { const H = s.heroes[h]; if (H.frozen > 0 || H.chamber) continue; if (needCard && !H.card) continue; const d = Math.abs(H.pos - idx) + laneDist(H.lane, lane) * 2; if (d <= reach && d < bd) { bd = d; best = h; } }
    return best;
  }
  function roamerRise(s, g, ev) { const R = s.roamer; R.state = 'glow'; R.left = 3.0; R.lane = g.lane; R.idx = g.idx; s.graves = s.graves.filter(x => x.id !== g.id); ev.push({ e: 'roamer', state: 'glow', lane: g.lane, idx: g.idx }); }
  function aiRoamer(s, dt, ev) {
    const R = s.roamer; if (R.state !== 'under' || R.cooldown > 0 || !s.graves.length) return;
    // the grave closest to the most heroes
    let best = null, bs = -1;
    for (const g of s.graves) { let sc = 0; for (const h of HEROES) { const H = s.heroes[h]; if (H.frozen > 0 || H.chamber) continue; const d = Math.abs(H.pos - g.idx) + laneDist(H.lane, g.lane) * 2; sc += d <= 8 ? (8 - d) : 0; } if (sc > bs) { bs = sc; best = g; } }
    if (best && bs > 0) roamerRise(s, best, ev);
    else R.cooldown = 5;
  }

  /* ---------- King Tea and the button ---------- */
  function tickKing(s, dt, ev) {
    if (!s.king.on) return;
    s.king.pos = Math.max(4, s.king.pos - 0.25 * dt);  // he walks down the Team Path
    for (const h of HEROES) { const H = s.heroes[h]; if (H.lane === 'team' && H.frozen <= 0 && Math.abs(H.pos - s.king.pos) < 0.6 && H.maxHeat) { H.heat -= 1.5 * dt; if (H.heat <= 0) freezeHero(s, h, ev, 'king'); } }
  }
  function tickButton(s, dt, ev) {
    const inside = HEROES.filter(h => s.heroes[h].chamber);
    if (!inside.length) { s.button.left = 0; return; }
    const need = Math.max(1, Math.ceil(heroesAlive(s).length / 2));
    if (inside.length >= need) {
      s.button.left += dt;
      if (s.button.left >= 3) {
        if (s.world === 4) { s.winner = 'coffee'; s.phase = 'end'; ev.push({ e: 'end', winner: 'coffee', why: 'The Activation Button is pressed. King Tea is stopped at ' + Math.floor(s.clock) + ' hours.' }); return; }
        const spent = s.clock - s.worldClock0;
        s.clockPaused = spent <= s.worldPar;
        s.phase = 'interlude'; s.phaseLeft = 10;
        ev.push({ e: 'cleared', world: s.world, spent, underPar: s.clockPaused });
        log(s, `${WORLDS[s.world]} World cleared in ${spent.toFixed(1)} hours.`);
      }
    } else s.button.left = Math.max(0, s.button.left - dt);
  }

  /* ---------- AI heroes: human pace ---------- */
  function aiHero(s, h, dt, ev) {
    const H = s.heroes[h];
    if (H.frozen > 0 || H.chamber) return;
    H.aiThink -= dt;
    // the swing: AI waits a "think" then swings with aim
    if (H.fight) {
      const f = H.fight;
      if (f.turn === 'hero' && !f.swung && f.ringLeft < 0.55 && H.aiThink <= 0) { f.swung = true; f.acc = aim(s, 0.75 + rnd(s) * 0.1); H.aiThink = 0.3 + rnd(s) * 0.5; }
      return;
    }
    if (H.draft) { if (H.aiThink <= 0) { const pick = pickCard(s, h, H.draft.cards); applyInput(s, { type: 'card', hero: h, pick }, ev); H.aiThink = 0.3 + rnd(s) * 0.5; } return; }
    if (H.aiThink > 0) return;
    H.aiThink = 0.3 + rnd(s) * 0.5;
    // play a useful card
    if (H.card && !PASSIVE[H.card]) {
      const c = H.card;
      if ((c === 'health' && H.maxHeat && H.heat < H.maxHeat * 0.35) || (c === 'sleepy' && s.clock > 30) || (c === 'wind' && HEROES.some(o => s.heroes[o].maxHeat && s.heroes[o].heat < 3)) || (c === 'sugar' && s.worldT > 60)) { useCard(s, h, ev); return; }
    }
    // thaw a frozen teammate first
    const frozen = HEROES.find(o => o !== h && s.heroes[o].frozen > 0 && s.heroes[o].lane === H.lane);
    if (frozen && Math.abs(s.heroes[frozen].pos - H.pos) > 1) { H.moveTo = Math.round(s.heroes[frozen].pos); return; }
    // warm up when cold: find a teammate or a coffee space
    const nestAhead = s.nests.some(n => n.lane === H.lane && !n.spawned && n.idx > H.pos && n.idx - H.pos <= 2.5);
    if (H.maxHeat && (H.heat < 3 || (nestAhead && H.heat < H.maxHeat * 0.4))) {
      const mate = HEROES.filter(o => o !== h && s.heroes[o].frozen <= 0 && s.heroes[o].lane === H.lane).sort((a, b) => Math.abs(s.heroes[a].pos - H.pos) - Math.abs(s.heroes[b].pos - H.pos))[0];
      if (mate && Math.abs(s.heroes[mate].pos - H.pos) <= 3) { H.moveTo = Math.round(s.heroes[mate].pos); return; }
      const at = Math.round(H.pos); const cof = COFFEE.filter(c => Math.abs(c - at) <= 2).sort((a, b) => Math.abs(a - at) - Math.abs(b - at))[0];
      if (cof != null && H.lane !== 'team') { H.moveTo = cof; return; }
    }
    // stay within two spaces of the nearest human (if any); otherwise press on
    const humans = HEROES.filter(o => !s.heroes[o].ai && s.heroes[o].frozen <= 0 && !s.heroes[o].chamber);
    if (humans.length) {
      const lead = humans.map(o => s.heroes[o].pos).reduce((a, b) => Math.max(a, b), 0);
      if (H.pos > lead + 2) { H.moveTo = null; return; }
    }
    if (H.moveTo == null) {
      // Donette heads for the Team Path at a crossroads
      const at = Math.round(H.pos);
      if (HERO[h].team && H.lane !== 'team' && isCross(at) && Math.abs(H.pos - at) < 0.3 && rnd(s) < 0.6) { applyInput(s, { type: 'move', hero: h, to: 'team' }, ev); H.moveTo = 8; return; }
      if (H.lane === 'team' && at >= 8) { applyInput(s, { type: 'move', hero: h, to: 'home' }, ev); }
      H.moveTo = Math.min(CHAMBER, Math.round(H.pos) + 2 + Math.floor(rnd(s) * 3));
      if (H.lane === 'team') H.moveTo = Math.min(8, H.moveTo);
    }
  }
  function aim(s, skill) { const r = (rnd(s) + rnd(s)) / 2; return clamp(1 - Math.abs(r - 0.5) * (2 - skill * 1.6), 0, 1); }
  function pickCard(s, h, cards) {
    const H = s.heroes[h];
    const order = H.maxHeat && H.heat < 4 ? ['fire', 'health', 'umbrella', 'wind', 'protector', 'sleepy', 'spoon', 'bolt', 'warp', 'sugar', 'earth', 'landslide', 'bagel']
      : ['sleepy', 'protector', 'spoon', 'bolt', 'warp', 'fire', 'health', 'wind', 'umbrella', 'sugar', 'earth', 'landslide', 'bagel'];
    return order.find(c => cards.includes(c)) || cards[0];
  }

  /* ---------- a compact snapshot for the wire ---------- */
  E.snapshot = function (s) {
    const h = {};
    for (const k of HEROES) { const H = s.heroes[k]; h[k] = { p: +H.pos.toFixed(2), l: H.lane, h: +H.heat.toFixed(1), m: H.maxHeat, f: +H.frozen.toFixed(1), c: H.card, d: H.draft ? { c: H.draft.cards, l: +H.draft.left.toFixed(1) } : null, g: H.fight ? { t: H.fight.turn, r: +H.fight.ringLeft.toFixed(2), e: H.fight.enemy, s: H.fight.swung } : null, ch: H.chamber, mt: H.moveTo, n: H.name, ai: H.ai, k: H.kos, st: H.stuns, sb: H.speedBoost > 0 };
    }
    return {
      ph: s.phase, w: s.world, t: +s.t.toFixed(1), pl: +s.phaseLeft.toFixed(1), wt: +s.worldT.toFixed(1), ck: +s.clock.toFixed(2), ot: s.overtime, cp: !!s.clockPaused,
      h,
      c: s.crumpets.filter(c => !c.dead).map(c => ({ i: c.id, k: c.kind, l: c.lane, p: +c.pos.toFixed(2), hp: c.hp, mh: c.maxHp, sp: +c.spawnLeft.toFixed(1) })),
      g: s.graves.map(g => ({ i: g.id, l: g.lane, x: g.idx })),
      n: s.nests.map(n => ({ i: n.id, l: n.lane, x: n.idx, s: n.spawned, k: n.kind })),
      d: { s: s.duchess.state, n: +s.duchess.nextIn.toFixed(1), r: s.duchess.row, l: +s.duchess.left.toFixed(1), hu: s.duchess.human },
      r: { s: s.roamer.state, l: s.roamer.lane, x: s.roamer.idx, re: s.roamer.reach, tg: s.roamer.target, cd: +s.roamer.cooldown.toFixed(1), fu: s.roamer.full, hu: s.roamer.human, lf: +s.roamer.left.toFixed(1) },
      k: { on: s.king.on, p: +s.king.pos.toFixed(2) },
      b: { l: +s.button.left.toFixed(1) },
      win: s.winner, log: s.log.slice(-4),
    };
  };

  root.RushEngine = E;
})(typeof window !== 'undefined' ? window : globalThis);
