/* ============================================================
   COFFEE TIME: OVERTIME. The pure rules. No DOM, no timers.
   Runs in the browser (window.OT) and in Node for simulation.
   The host phone owns the state; everything here is a function
   from state to state plus a list of events to animate.
   ============================================================ */
(function (root) {
  'use strict';
  const OT = {};
  const clone = o => JSON.parse(JSON.stringify(o));
  function rng(s) { s.seed |= 0; s.seed = s.seed + 0x6D2B79F5 | 0; let t = Math.imul(s.seed ^ s.seed >>> 15, 1 | s.seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  OT.rng = rng;
  function shuffle(a, s) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const pick = (a, s) => a[Math.floor(rng(s) * a.length)];

  OT.HEROES = ['miss', 'joe', 'thermos', 'don'];
  OT.HERO = {
    joe:     { name: 'Cup Joe', atk: 6, hp: 10, heat: 8,  tip: 'Hits hardest.' },
    thermos: { name: 'Thermos', atk: 4, hp: 12, heat: 10, tip: 'Keeps heat longest, protects friends.' },
    miss:    { name: 'Little Miss Hot Shot', atk: 4, hp: 9, heat: 8, tip: 'Quick. Acts first every fight.' },
    don:     { name: 'Donette', atk: 4, hp: 10, heat: 0, tip: 'No heat gauge. Cards are free, and she draws one extra.' },
  };
  OT.WORLD_OF_ROUND = [null, 0, 1, 2, 2, 3, 3, 4, 4]; // index into Arena.WORLDS
  OT.WORLD_NAMES = ['Coffee World', 'Donut World', 'Warp World', 'Crumpet World', 'Tea World'];
  OT.ROUNDS = 8;
  OT.VOTE_AFTER = [3, 6];
  OT.TIMES = { plan: 30000, talk: 20000, vote: 30000, overtime: 5000, reveal: 1500 };

  // Journey Cards as they work in this card battle. cost in heat (Donette pays nothing).
  OT.CARDS = {
    health:    { name: 'Health', cost: 2, kind: 'heat', text: 'Heal 4 health.' },
    honey:     { name: 'Honey Bee Queen', cost: 3, kind: 'move', text: 'Dotty flies you past this fight. You advance untouched.' },
    sprinkles: { name: 'Sprinkles', cost: 2, kind: 'attack', text: '+2 attack and +1 heat. Transforms into whatever you need.' },
    sugar:     { name: 'Sugar Cube', cost: 1, kind: 'attack', text: 'Swing twice this fight.' },
    ice:       { name: 'Ice', cost: 2, kind: 'protect', text: 'Freeze your crumpet: it skips its attack.' },
    sleepy:    { name: 'Sleepy Time Tea', cost: 3, kind: 'special', text: 'Turn King Tea\'s clock back 3 hours.' },
    warp:      { name: 'Team Warp', cost: 2, kind: 'attack', text: 'Fight beside a teammate: you both deal +3 to each other\'s crumpet.' },
    fire:      { name: 'Fire', cost: 1, kind: 'heat', text: 'Reheat to full. The only card a frozen hero can play.' },
    earth:     { name: 'Earth', cost: 1, kind: 'protect', text: 'Offer Earth to the Roamer: he cannot rob or slide you this round.' },
    wind:      { name: 'Wind Feather', cost: 1, kind: 'special', text: 'Draw 2 cards now.' },
    protector: { name: 'Card Protector', cost: 1, kind: 'protect', text: 'Your hand cannot be robbed this round.' },
    bolt:      { name: 'Bolt', cost: 2, kind: 'attack', text: '+2 attack this fight.', patch: true },
    spoon:     { name: 'Spoon', cost: 2, kind: 'attack', text: '+1 to every swing, and the first swing cannot miss.', patch: true },
    umbrella:  { name: 'Umbrella', cost: 1, kind: 'protect', text: 'Shields you from freezing this round (and Ice Storm).', patch: true },
    bagel:     { name: 'Bagel', cost: 2, kind: 'protect', text: 'Every crumpet deals 2 less damage this fight, team wide.', patch: true },
    landslide: { name: 'Landslide', cost: 2, kind: 'attack', text: 'The ground gives way: 3 damage to every crumpet.', patch: true },
  };
  OT.DECK = ['health', 'health', 'health', 'honey', 'sprinkles', 'sprinkles', 'sugar', 'sugar', 'sugar', 'ice', 'ice', 'sleepy', 'sleepy', 'warp', 'warp', 'fire', 'fire', 'earth', 'earth', 'wind', 'wind', 'protector', 'protector', 'bolt', 'bolt', 'spoon', 'spoon', 'umbrella', 'umbrella', 'bagel', 'landslide', 'landslide'];
  OT.ENEMIES = {
    crumpet:  { name: 'Crumpet', hp: 8,  atk: 2, img: 'crumpet' },
    fork:     { name: 'Crumpet with Fork', hp: 10, atk: 3, img: 'crumpet' },
    meangirl: { name: 'Mean Girl Crumpets', hp: 11, atk: 3, img: 'meangirl' },
    body:     { name: 'Bodybuilder Crumpet', hp: 12, atk: 4, img: 'crumpet' },
    guard:    { name: 'Royal Guard', hp: 6, atk: 2, img: 'king' },
  };
  // which crumpets show up per round (gets harder)
  OT.ROUND_ENEMIES = [null, ['crumpet', 'crumpet', 'crumpet', 'fork'], ['crumpet', 'fork', 'crumpet', 'fork'], ['fork', 'fork', 'meangirl', 'crumpet'], ['fork', 'meangirl', 'fork', 'meangirl'], ['meangirl', 'body', 'fork', 'meangirl'], ['body', 'meangirl', 'body', 'fork'], ['body', 'body', 'meangirl', 'body'], ['body', 'body', 'body', 'body']];
  OT.CLOCK = { base: 3, perFail: 2, perStanding: 0, roamerSteal: 1, win: 60, kingAt: 48 };

  /* ---------- new game ---------- */
  // players: {heroId: clientId|'ai'}, opts: {traitor:boolean, seed}
  OT.newGame = function (players, opts) {
    opts = opts || {};
    const s = { seed: opts.seed || (Date.now() & 0x7fffffff), phase: 'lobby', round: 0, clock: 0, log: [], winner: null, reason: '',
      heroes: {}, deck: [], discard: [], enemies: {}, events: [], overtime: { proposedBy: null, votes: {}, active: false, next: false },
      votes: {}, voteResults: [], innocentFrozen: 0, traitor: null, exposed: false, landslides: 2, roamerLastRound: 0, iceStorm: false, kingOn: false, deadline: 0, humans: 0 };
    for (const h of OT.HEROES) s.heroes[h] = { id: h, player: players[h] || 'ai', hp: OT.HERO[h].hp, heat: OT.HERO[h].heat, heatMax: OT.HERO[h].heat, hand: [], placed: [], done: false, frozen: 0, seg: 0, robbed: null, fails: 0, advanced: false };
    s.humans = Object.values(players).filter(p => p && p !== 'ai').length;
    s.deck = shuffle(OT.DECK, s);
    if (opts.traitor) { const humanHeroes = OT.HEROES.filter(h => s.heroes[h].player !== 'ai'); if (humanHeroes.length >= 2) s.traitor = pick(humanHeroes, s); }
    return s;
  };
  OT.traitorOn = s => !!s.traitor;
  OT.worldIndex = s => OT.WORLD_OF_ROUND[s.round] || 0;

  function draw(s, h, n) {
    const H = s.heroes[h];
    for (let i = 0; i < n; i++) {
      if (!s.deck.length) { if (!s.discard.length) return; s.deck = shuffle(s.discard, s); s.discard = []; }
      H.hand.push(s.deck.pop());
    }
  }
  function log(s, t) { s.log.push(t); if (s.log.length > 60) s.log.shift(); }

  /* ---------- planning ---------- */
  OT.startRound = function (s, now) {
    s.round++;
    s.phase = 'plan';
    s.iceStorm = OT.worldIndex(s) === 4;
    s.overtime.active = s.overtime.next; s.overtime.next = false; s.overtime.proposedBy = null; s.overtime.votes = {};
    s.kingOn = s.clock >= OT.CLOCK.kingAt;
    s.events = [];
    for (const h of OT.HEROES) {
      const H = s.heroes[h];
      H.placed = []; H.done = H.player === 'ai' ? false : false; H.robbed = null; H.advanced = false;
      if (H.frozen > 0) H.frozen--;
      H.hp = Math.min(OT.HERO[h].hp, H.hp + 2);
      // heat refill: 3 + 1 per teammate on the same segment, halved in an Ice Storm
      let refill = 3 + OT.HEROES.filter(o => o !== h && s.heroes[o].seg === H.seg).length;
      if (s.iceStorm) refill = Math.ceil(refill / 2);
      if (H.heatMax > 0) H.heat = Math.min(H.heatMax, H.heat + refill);
      const target = h === 'don' ? 6 : 5;
      draw(s, h, Math.max(0, target - H.hand.length));
    }
    const list = OT.ROUND_ENEMIES[s.round];
    s.enemies = {};
    OT.HEROES.forEach((h, i) => { const e = OT.ENEMIES[list[i]]; s.enemies[h] = { type: list[i], name: e.name, hp: e.hp, maxHp: e.hp, atk: e.atk, img: e.img, frozen: false, alive: true }; });
    if (s.kingOn) for (const h of OT.HEROES) s.enemies[h].guard = { hp: OT.ENEMIES.guard.hp, atk: OT.ENEMIES.guard.atk, alive: true };
    s.deadline = (now || 0) + OT.TIMES.plan;
    log(s, `Round ${s.round}: ${OT.WORLD_NAMES[OT.worldIndex(s)]}.${s.overtime.active ? ' OVERTIME: this round counts double.' : ''}`);
    return s;
  };

  OT.canPlace = function (s, h, card) {
    const H = s.heroes[h];
    if (s.phase !== 'plan' || H.done) return false;
    if (!H.hand.includes(card) || H.placed.length >= 3) return false;
    if (H.frozen > 0 && card !== 'fire') return false;
    const cost = H.heatMax === 0 ? 0 : OT.CARDS[card].cost;
    return cost <= H.heat - OT.placedCost(s, h);
  };
  OT.placedCost = (s, h) => s.heroes[h].heatMax === 0 ? 0 : s.heroes[h].placed.reduce((n, c) => n + OT.CARDS[c].cost, 0);
  OT.place = function (s, h, card) {
    if (!OT.canPlace(s, h, card)) return false;
    const H = s.heroes[h];
    H.hand.splice(H.hand.indexOf(card), 1); H.placed.push(card);
    return true;
  };
  OT.unplace = function (s, h, card) {
    const H = s.heroes[h];
    if (s.phase !== 'plan' || H.done) return false;
    const i = H.placed.indexOf(card); if (i < 0) return false;
    H.placed.splice(i, 1); H.hand.push(card); return true;
  };
  OT.setDone = function (s, h) { if (s.phase === 'plan') s.heroes[h].done = true; };
  OT.allDone = s => OT.HEROES.every(h => s.heroes[h].done);

  // the traitor's rob: once a round, during planning, a card vanishes from a teammate's hand
  OT.traitorRob = function (s, h, victim) {
    if (!s.traitor || s.traitor !== h || s.phase !== 'plan' || s.robbedThisRound) return false;
    const V = s.heroes[victim]; if (!V || victim === h) return false;
    if (V.placed.includes('protector') || V.placed.includes('earth') || V.hand.length === 0) { s.robbedThisRound = true; return false; }
    const card = pick(V.hand, s); V.hand.splice(V.hand.indexOf(card), 1); s.discard.push(card); V.robbed = card; s.robbedThisRound = true;
    s.clock = Math.min(OT.CLOCK.win, s.clock + OT.CLOCK.roamerSteal * (s.overtime.active ? 2 : 1));
    log(s, `The Roamer's grin flashes over ${OT.HERO[victim].name}'s hand. A card is gone.`);
    return true;
  };
  OT.traitorLandslide = function (s, h, victim) {
    if (!s.traitor || s.traitor !== h || s.landslides <= 0 || s.phase !== 'plan') return false;
    const V = s.heroes[victim]; if (!V || V.seg <= 0 || V.placed.includes('earth')) return false;
    V.seg--; s.landslides--; log(s, `Landslide! ${OT.HERO[victim].name} slides back a segment.`); s.slid = victim; return true;
  };

  /* ---------- the fight: computed once, played everywhere ---------- */
  OT.resolve = function (s) {
    s.phase = 'fight';
    s.robbedThisRound = false;
    const ev = []; let t = 0;
    const push = (e, gap) => { e.at = t; ev.push(e); t += gap == null ? 700 : gap; };
    const mult = s.overtime.active ? 2 : 1;
    const bagel = OT.HEROES.some(h => s.heroes[h].placed.includes('bagel'));
    const warpers = OT.HEROES.filter(h => s.heroes[h].placed.includes('warp') && s.heroes[h].frozen === 0);
    let clockDelta = 0, fails = 0;
    push({ type: 'start', text: s.overtime.active ? 'OVERTIME! Everything counts double.' : 'Cards up!' }, 900);
    // pay costs, discard placed, apply instant effects
    for (const h of OT.HEROES) {
      const H = s.heroes[h];
      if (H.heatMax > 0) H.heat -= OT.placedCost(s, h);
      for (const c of H.placed) {
        if (c === 'fire') { H.heat = H.heatMax; if (H.frozen) { H.frozen = 0; push({ type: 'thaw', hero: h, text: `${OT.HERO[h].name} reheats!` }); } }
        if (c === 'health') { H.hp = Math.min(OT.HERO[h].hp, H.hp + 4); push({ type: 'heal', hero: h, n: 4 }); }
        if (c === 'sprinkles' && H.heatMax > 0) H.heat = Math.min(H.heatMax, H.heat + 1);
        if (c === 'wind') { draw(s, h, 2); push({ type: 'text', hero: h, text: 'Wind Feather: 2 cards' }, 500); }
        if (c === 'sleepy') { clockDelta -= 3; push({ type: 'clock', hero: h, n: -3, text: 'Sleepy Time Tea: the clock turns back 3 hours' }); }
      }
    }
    // landslide hits every crumpet first
    for (const h of OT.HEROES) for (const c of s.heroes[h].placed) if (c === 'landslide') {
      push({ type: 'rumble', hero: h, text: `${OT.HERO[h].name}'s Landslide!` }, 600);
      for (const e of OT.HEROES) { const E = s.enemies[e]; if (E.alive) { E.hp -= 3; push({ type: 'hit', enemy: e, n: 3 }, 350); if (E.hp <= 0) { E.alive = false; push({ type: 'defeat', enemy: e }, 500); } } }
    }
    // each hero fights their own crumpet, Little Miss first
    for (const h of OT.HEROES) {
      const H = s.heroes[h], E = s.enemies[h], P = H.placed;
      if (H.frozen > 0) { push({ type: 'frozen', hero: h, text: `${OT.HERO[h].name} is frozen solid.` }, 900); continue; }
      if (P.includes('honey')) { push({ type: 'fly', hero: h, text: `Dotty carries ${OT.HERO[h].name} past the fight!` }, 1000); H.advanced = true; continue; }
      let atk = OT.HERO[h].atk + (P.includes('bolt') ? 2 : 0) + (P.includes('sprinkles') ? 2 : 0) + (P.includes('spoon') ? 1 : 0);
      const swings = P.includes('sugar') ? 2 : 1;
      for (let i = 0; i < swings && E.alive; i++) {
        const miss = !(P.includes('spoon') && i === 0) && rng(s) < 0.12;
        push({ type: 'swing', hero: h, enemy: h }, 450);
        if (miss) { push({ type: 'miss', hero: h, text: 'Miss!' }, 600); continue; }
        const dmg = atk + Math.floor(rng(s) * 3) - 1; // small wobble
        E.hp -= dmg; push({ type: 'hit', enemy: h, n: dmg }, 600);
        if (E.hp <= 0) { E.alive = false; push({ type: 'defeat', enemy: h, hero: h, text: `${E.name} is toast!` }, 800); }
      }
      // Team Warp: warpers help each other
      if (P.includes('warp') && E.alive) {
        const mate = warpers.find(o => o !== h) || OT.HEROES.find(o => o !== h && s.heroes[o].frozen === 0);
        if (mate) { push({ type: 'swing', hero: mate, enemy: h, text: `${OT.HERO[mate].name} warps in!` }, 450); E.hp -= 3; push({ type: 'hit', enemy: h, n: 3 }, 600); if (E.hp <= 0) { E.alive = false; push({ type: 'defeat', enemy: h, hero: h }, 800); } }
      }
      if (E.alive && !E.frozen) {
        if (P.includes('ice')) { E.frozen = true; push({ type: 'enemyfrozen', enemy: h, text: 'Iced! The crumpet skips its turn.' }, 700); }
        else {
          let d = Math.max(0, E.atk - (bagel ? 2 : 0) - (h === 'thermos' ? 1 : 0));
          push({ type: 'eswing', enemy: h, hero: h }, 450);
          if (d > 0) { H.hp -= d; push({ type: 'herohit', hero: h, n: d }, 600); } else push({ type: 'block', hero: h, text: 'Blocked!' }, 500);
        }
      }
      // Royal Guards once the King is on
      if (E.guard && E.guard.alive) {
        push({ type: 'guard', hero: h, text: 'A Royal Guard strikes!' }, 450);
        H.hp -= E.guard.atk; push({ type: 'herohit', hero: h, n: E.guard.atk }, 600);
      }
      if (H.hp <= 0) {
        H.hp = 0;
        if (P.includes('umbrella')) { H.hp = 1; push({ type: 'umbrella', hero: h, text: 'Umbrella! Saved from the cold.' }, 700); }
        else { H.frozen = 1; push({ type: 'freeze', hero: h, text: `${OT.HERO[h].name}'s health is drained. Frozen next round.` }, 900); }
      }
      if (H.heatMax > 0 && H.heat <= 0 && !P.includes('umbrella')) { H.heat = 0; if (!H.frozen) { H.frozen = 1; push({ type: 'freeze', hero: h, text: `${OT.HERO[h].name} ran out of heat. Frozen next round.` }, 900); } }
      if (!E.alive) H.advanced = true;
    }
    // the clock moves
    for (const h of OT.HEROES) { const H = s.heroes[h]; if (H.advanced) H.seg++; else { fails++; H.fails++; } }
    const standing = OT.HEROES.filter(h => s.enemies[h].alive).length;
    clockDelta += OT.CLOCK.base + fails * OT.CLOCK.perFail + standing * OT.CLOCK.perStanding;
    clockDelta = Math.round(clockDelta * 2) / 2 * mult;
    const before = s.clock;
    s.clock = Math.max(0, Math.min(OT.CLOCK.win, s.clock + clockDelta));
    push({ type: 'clockmove', from: before, to: s.clock, n: clockDelta, text: clockDelta >= 0 ? `King Tea turns the clock forward ${clockDelta} hours.` : `The clock turns back ${-clockDelta} hours!` }, 1800);
    for (const h of OT.HEROES) { s.discard.push(...s.heroes[h].placed); s.heroes[h].placed = []; }
    s.events = ev;
    s.fightMs = t;
    log(s, ev.filter(e => e.text).map(e => e.text).join(' '));
    OT.checkEnd(s);
    return ev;
  };

  OT.checkEnd = function (s) {
    if (s.winner) return;
    if (s.clock >= OT.CLOCK.win) { s.winner = 'tea'; s.reason = 'King Tea\'s clock struck 60 hours. Tea Time.'; }
    else if (s.traitor && s.innocentFrozen >= 2) { s.winner = 'tea'; s.reason = 'The Duchess froze two innocent heroes. The Roamer walks free.'; }
    else if (s.round >= OT.ROUNDS && s.phase !== 'plan') { s.winner = 'coffee'; s.reason = 'The heroes reached King Tea\'s throne and pressed the button!'; }
    if (s.winner) s.phase = 'end';
  };

  /* ---------- talk, overtime, votes ---------- */
  OT.startTalk = function (s, now) { s.phase = 'talk'; s.deadline = now + OT.TIMES.talk; s.overtime.proposedBy = null; s.overtime.votes = {}; };
  OT.proposeOvertime = function (s, h, now) { if (s.phase !== 'talk' || s.overtime.proposedBy || s.overtime.next) return false; s.overtime.proposedBy = h; s.overtime.votes = { [h]: true }; s.overtime.until = now + OT.TIMES.overtime; return true; };
  OT.voteOvertime = function (s, h, yes) { if (!s.overtime.proposedBy) return false; s.overtime.votes[h] = !!yes; return true; };
  OT.settleOvertime = function (s) {
    if (!s.overtime.proposedBy) return false;
    const yes = Object.values(s.overtime.votes).filter(Boolean).length;
    const voters = OT.HEROES.length;
    s.overtime.next = yes > voters / 2;
    log(s, s.overtime.next ? 'OVERTIME called! Next round counts double.' : 'Overtime proposal fails.');
    s.overtime.proposedBy = null; s.overtime.votes = {};
    return s.overtime.next;
  };
  OT.needsVote = s => OT.VOTE_AFTER.includes(s.round) && !s.winner;
  OT.startVote = function (s, now) { s.phase = 'vote'; s.votes = {}; s.deadline = now + OT.TIMES.vote; };
  OT.castVote = function (s, h, target) { if (s.phase !== 'vote') return false; s.votes[h] = target || 'skip'; return true; };
  OT.settleVote = function (s) {
    const tally = {};
    for (const h of OT.HEROES) { const v = s.votes[h] || 'skip'; if (v !== 'skip') tally[v] = (tally[v] || 0) + 1; }
    let target = null, best = 0;
    for (const k in tally) if (tally[k] > best) { best = tally[k]; target = k; }
    const tie = Object.values(tally).filter(n => n === best).length > 1;
    const result = { round: s.round, target: tie ? null : target, wasRoamer: false, tally };
    if (result.target) {
      s.heroes[result.target].frozen = Math.max(s.heroes[result.target].frozen, 1);
      if (result.target === s.traitor) { result.wasRoamer = true; s.exposed = true; s.clock = Math.max(0, s.clock - 6); log(s, `The Duchess unmasks the Roamer riding with ${OT.HERO[result.target].name}! The clock gives back 6 hours.`); }
      else { if (s.traitor) s.innocentFrozen++; if (s.traitor) s.clock = Math.min(OT.CLOCK.win, s.clock + 2); log(s, `The Duchess freezes ${OT.HERO[result.target].name}. ${s.traitor ? 'Innocent. The Roamer gains 2 hours.' : ''}`); }
    } else log(s, 'The Duchess sweeps through. Nobody is frozen.');
    s.voteResults.push(result);
    OT.checkEnd(s);
    return result;
  };

  /* ---------- the open Roamer (no traitor): attack, then rob, then a landslide ---------- */
  OT.roamerTurn = function (s) {
    if (s.traitor || s.winner) return null;
    if (s.roamerLastRound === s.round - 1 || OT.VOTE_AFTER.includes(s.round)) return null; // never twice in a row, never before a vote
    const victims = OT.HEROES.filter(h => s.heroes[h].frozen === 0);
    if (!victims.length) return null;
    const ev = []; let t = 0;
    const push = (e, gap) => { e.at = t; ev.push(e); t += gap == null ? 700 : gap; };
    const a = pick(victims, s);
    push({ type: 'roamer', text: 'The Roamer rises from a grave!' }, 1200);
    push({ type: 'rswing', hero: a }, 500);
    s.heroes[a].hp = Math.max(1, s.heroes[a].hp - 3); push({ type: 'herohit', hero: a, n: 3 }, 700);
    const others = victims.filter(h => h !== a && s.heroes[h].hand.length && !s.heroes[h].placed.includes('earth'));
    if (others.length) { const v = pick(others, s); const card = pick(s.heroes[v].hand, s); s.heroes[v].hand.splice(s.heroes[v].hand.indexOf(card), 1); s.discard.push(card); push({ type: 'rob', hero: v, card, text: `He snatches ${OT.CARDS[card].name} from ${OT.HERO[v].name}!` }, 1000); }
    if (s.landslides > 0 && rng(s) < 0.5) { const v = pick(victims.filter(h => s.heroes[h].seg > 0), s); if (v) { s.heroes[v].seg--; s.landslides--; push({ type: 'rumble', hero: v, text: `Landslide! ${OT.HERO[v].name} slides back.` }, 900); } }
    push({ type: 'rsink', text: 'He sinks back under.' }, 800);
    s.roamerLastRound = s.round; s.roamerEvents = ev; s.roamerMs = t;
    return ev;
  };

  /* ---------- AI ---------- */
  // returns the cards an AI hero wants to place, in order (the UI places them one at a time)
  OT.aiPlan = function (s, h) {
    const H = s.heroes[h], E = s.enemies[h];
    const have = c => H.hand.includes(c);
    const out = []; let budget = H.heatMax === 0 ? 99 : H.heat;
    const take = c => { if (have(c) && !out.includes(c) && out.length < 3 && OT.CARDS[c].cost <= budget) { out.push(c); budget -= H.heatMax === 0 ? 0 : OT.CARDS[c].cost; return true; } return false; };
    if (H.frozen > 0) { take('fire'); return out; }
    if (H.heatMax > 0 && H.heat <= 2) take('fire');
    if (H.hp <= 4) take('health');
    if (s.clock >= 40) take('sleepy');
    if (E.hp - OT.HERO[h].atk > 2) { take('sugar'); take('bolt'); take('sprinkles'); take('spoon'); take('landslide'); }
    if (s.traitor && !s.exposed && rng(s) < 0.4) take('protector');
    if (E.atk >= 3 && H.hp <= 6) { take('ice'); take('bagel'); }
    if (E.hp >= 12 && rng(s) < 0.5) take('honey');
    if (out.length < 2) { take('warp'); take('wind'); take('umbrella'); take('earth'); }
    // keep some heat in reserve on a bad refill
    return out;
  };
  OT.aiVote = function (s, h) {
    const others = OT.HEROES.filter(o => o !== h);
    if (s.exposed && s.traitor && s.traitor !== h) return s.traitor;
    // suspicion: whoever failed most, with noise
    const scored = others.map(o => ({ o, n: s.heroes[o].fails + rng(s) * 2 })).sort((a, b) => b.n - a.n);
    return rng(s) < 0.35 ? 'skip' : scored[0].o;
  };

  /* ---------- a whole AI-only game, for balance ---------- */
  OT.simulate = function (seed, opts) {
    const s = OT.newGame({}, { seed, traitor: false });
    let guard = 0;
    while (!s.winner && guard++ < 50) {
      OT.startRound(s, 0);
      for (const h of OT.HEROES) for (const c of OT.aiPlan(s, h)) OT.place(s, h, c);
      OT.resolve(s);
      if (s.winner) break;
      if (OT.needsVote(s)) { OT.startVote(s, 0); for (const h of OT.HEROES) OT.castVote(s, h, OT.aiVote(s, h)); OT.settleVote(s); }
      if (!s.winner) OT.roamerTurn(s);
      if (!s.winner && rng(s) < (opts && opts.overtimeRate != null ? opts.overtimeRate : 0.15)) s.overtime.next = true;
    }
    return s;
  };

  root.OT = OT;
})(typeof window !== 'undefined' ? window : globalThis);
