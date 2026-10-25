// @ts-nocheck
// Coffee Time online rooms: one SQLite-backed Durable Object per 4-letter room code (Workers Free plan).
// Ported unchanged from the standalone app. The game rules run on the host's phone, not here.
export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map(); // ws -> member {id, name, seat}
    this.settings = { n: 2, patch: false };
    this.host = null;
    this.gameState = null;
    this.ready = state.blockConcurrencyWhile(async () => {
      this.gameState = (await state.storage.get('gameState')) || null;
      this.settings = (await state.storage.get('settings')) || this.settings;
      this.host = (await state.storage.get('host')) || null;
    });
    // rehydrate members from hibernated sockets
    for (const ws of state.getWebSockets()) {
      const att = ws.deserializeAttachment();
      if (att) this.sockets.set(ws, att);
    }
  }

  async fetch(request) {
    await this.ready;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  members() { return [...this.sockets.values()].map(m => ({ id: m.id, name: m.name, seat: m.seat || null })); }
  broadcast(obj, except) {
    const text = JSON.stringify(obj);
    for (const ws of this.sockets.keys()) { if (ws === except) continue; try { ws.send(text); } catch (e) { this.drop(ws); } }
  }
  sendTo(id, obj) { for (const [ws, m] of this.sockets) if (m.id === id) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } }
  async drop(ws) {
    const m = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (!m) return;
    if (this.host === m.id) {
      const next = [...this.sockets.values()][0];
      this.host = next ? next.id : null;
      await this.state.storage.put('host', this.host);
    }
    await this.announce();
  }
  async announce() {
    this.broadcast({ t: 'members', members: this.members(), host: this.host, settings: this.settings });
  }

  async webSocketMessage(ws, data) {
    await this.ready;
    let msg; try { msg = JSON.parse(data); } catch (e) { return; }
    const me = this.sockets.get(ws);

    if (msg.t === 'join') {
      const id = String(msg.clientId || crypto.randomUUID()).slice(0, 40);
      const name = String(msg.name || 'Player').slice(0, 24);
      // same client reconnecting: keep their seat, replace the socket
      let seat = null;
      for (const [other, m] of [...this.sockets]) if (m.id === id) { seat = m.seat || null; this.sockets.delete(other); try { other.close(1000, 'replaced'); } catch (e) {} }
      if (this.sockets.size >= 12) { ws.send(JSON.stringify({ t: 'error', message: 'Room is full.' })); ws.close(); return; }
      const member = { id, name, seat };
      this.sockets.set(ws, member);
      ws.serializeAttachment(member);
      if (!this.host) { this.host = id; await this.state.storage.put('host', id); }
      ws.send(JSON.stringify({ t: 'joined', you: id, members: this.members(), host: this.host, settings: this.settings, state: this.gameState }));
      this.broadcast({ t: 'members', members: this.members(), host: this.host, settings: this.settings }, ws);
      return;
    }
    if (!me) return;

    switch (msg.t) {
      case 'seat': {
        const seat = msg.seat ? String(msg.seat).slice(0, 4) : null;
        if (seat && !/^s[0-5]$/.test(seat)) return;
        me.seat = seat; ws.serializeAttachment(me);
        return this.announce();
      }
      case 'settings': {
        if (me.id !== this.host) return;
        const n = Math.min(6, Math.max(2, +msg.settings.n || 2));
        this.settings = { n, patch: !!msg.settings.patch };
        await this.state.storage.put('settings', this.settings);
        // seats beyond the new player count are cleared
        for (const [s, m] of this.sockets) if (m.seat && +m.seat.slice(1) >= n) { m.seat = null; s.serializeAttachment(m); }
        return this.announce();
      }
      case 'start':
        if (me.id !== this.host) return;
        return this.broadcast({ t: 'start' }, ws);
      case 'restart':
        if (me.id !== this.host) return;
        return this.broadcast({ t: 'restart' }, ws);
      case 'state': {
        if (me.id !== this.host) return;
        this.gameState = msg.state;
        await this.state.storage.put('gameState', msg.state);
        if (msg.state && msg.state.winner) await this.state.storage.setAlarm(Date.now() + 6 * 3600 * 1000);
        return this.broadcast({ t: 'state', state: msg.state }, ws);
      }
      case 'action':
        return this.sendTo(this.host, { t: 'action', option: String(msg.option).slice(0, 64), player: String(msg.player).slice(0, 8), from: me.id });
      case 'protect':
        return this.sendTo(this.host, { t: 'protect', hero: String(msg.hero).slice(0, 12), card: String(msg.card).slice(0, 16), from: me.id });
      case 'chat': {
        const m = msg.msg || {};
        const safe = { id: String(m.id || '').slice(0, 20), from: me.name, text: String(m.text || '').slice(0, 200), team: m.team ? String(m.team).slice(0, 10) : null, taunt: !!m.taunt, side: m.side ? String(m.side).slice(0, 10) : null, at: Date.now() };
        return this.broadcast({ t: 'chat', msg: safe, from: me.id }, ws);
      }
    }
  }

  async webSocketClose(ws) { await this.drop(ws); }
  async webSocketError(ws) { await this.drop(ws); }

  // tidy up finished rooms
  async alarm() {
    if (this.sockets.size === 0) await this.state.storage.deleteAll();
  }
}
