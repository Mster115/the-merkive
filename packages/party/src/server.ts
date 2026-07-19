import type * as Party from "partykit/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-PartyKit-Secret",
};

interface MemoryDb {
  rooms: Map<string, any>;
  roomIdByCode: Map<string, string>;
  seats: Map<string, any[]>;
  spectators: Map<string, any[]>;
  matches: Map<string, any>;
  activeMatchByRoom: Map<string, string>;
  eventSeq: Map<string, number>;
  packs: any[];
}

function createDb(): MemoryDb {
  return {
    rooms: new Map(),
    roomIdByCode: new Map(),
    seats: new Map(),
    spectators: new Map(),
    matches: new Map(),
    activeMatchByRoom: new Map(),
    eventSeq: new Map(),
    packs: [],
  };
}

const clone = <T>(v: T): T => structuredClone(v);

export default class TheMerkiveServer implements Party.Server {
  db: MemoryDb | null = null;
  
  constructor(readonly room: Party.Room) {}

  async getDb(): Promise<MemoryDb> {
    if (!this.db) {
      const saved = await this.room.storage.get<any>("db");
      if (saved) {
        this.db = {
          rooms: new Map(saved.rooms || []),
          roomIdByCode: new Map(saved.roomIdByCode || []),
          seats: new Map(saved.seats || []),
          spectators: new Map(saved.spectators || []),
          matches: new Map(saved.matches || []),
          activeMatchByRoom: new Map(saved.activeMatchByRoom || []),
          eventSeq: new Map(saved.eventSeq || []),
          packs: saved.packs || [],
        };
      } else {
        this.db = createDb();
      }
    }
    return this.db;
  }

  async saveDb() {
    if (this.db) {
      await this.room.storage.put("db", {
        rooms: Array.from(this.db.rooms.entries()),
        roomIdByCode: Array.from(this.db.roomIdByCode.entries()),
        seats: Array.from(this.db.seats.entries()),
        spectators: Array.from(this.db.spectators.entries()),
        matches: Array.from(this.db.matches.entries()),
        activeMatchByRoom: Array.from(this.db.activeMatchByRoom.entries()),
        eventSeq: Array.from(this.db.eventSeq.entries()),
        packs: this.db.packs,
      });
    }
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const kind = url.searchParams.get("kind");
    const seat = url.searchParams.get("seat");
    conn.setState({ kind: kind || "public", seat: seat || null });
  }

  async onRequest(req: Party.Request) {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS, status: 200 });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    
    // Broadcast is handled specially for the specific room code DO
    if (path.endsWith("/broadcast") || (req.method === "POST" && !path.includes("/store/"))) {
      try {
        const body = (await req.json()) as { msg: any };
        if (body.msg) {
          const msg = body.msg;
          if (msg.kind === "private" || msg.seat !== undefined) {
            const targetSeat = msg.seat;
            for (const connection of this.room.getConnections()) {
              const state = connection.state as { seat?: string | null };
              if (state && state.seat === targetSeat) {
                connection.send(JSON.stringify(msg));
              }
            }
          } else {
            this.room.broadcast(JSON.stringify(msg));
          }
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch (e) {
        return new Response("Bad request", { status: 400, headers: CORS });
      }
    }

    // Only process store APIs if this is the "store" room DO
    if (this.room.id !== "store") {
      return new Response("Not Found", { status: 404, headers: CORS });
    }

    const db = await this.getDb();
    
    try {
      if (req.method === "POST" && path.endsWith("/create-room")) {
        const room = await req.json() as any;
        db.rooms.set(room.id, clone(room));
        db.roomIdByCode.set(room.code.toUpperCase(), room.id);
        db.seats.set(room.id, []);
        db.spectators.set(room.id, []);
        await this.saveDb();
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "GET" && path.endsWith("/get-room")) {
        const code = url.searchParams.get("code");
        const id = url.searchParams.get("id");
        let room = null;
        if (id) {
          room = db.rooms.get(id);
        } else if (code) {
          const roomId = db.roomIdByCode.get(code.toUpperCase());
          if (roomId) room = db.rooms.get(roomId);
        }
        return new Response(JSON.stringify(room || null), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/update-room")) {
        const { roomId, patch } = await req.json() as any;
        const room = db.rooms.get(roomId);
        if (room) {
          Object.assign(room, clone(patch), { updatedAt: Date.now() });
          await this.saveDb();
        }
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "GET" && path.endsWith("/list-rooms")) {
        const active = [...db.rooms.values()].filter((r) => r.status !== "expired").map(clone);
        return new Response(JSON.stringify(active), { headers: CORS });
      }

      if (req.method === "DELETE" && path.endsWith("/delete-room")) {
        const roomId = url.searchParams.get("roomId");
        if (roomId) {
          const room = db.rooms.get(roomId);
          if (room) {
            db.rooms.delete(roomId);
            db.roomIdByCode.delete(room.code.toUpperCase());
            db.seats.delete(roomId);
            db.spectators.delete(roomId);
            const matchId = db.activeMatchByRoom.get(roomId);
            if (matchId) db.activeMatchByRoom.delete(roomId);
            for (const [id, m] of db.matches) {
              if (m.roomId === roomId) db.matches.delete(id);
            }
            await this.saveDb();
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "GET" && path.endsWith("/seats")) {
        const roomId = url.searchParams.get("roomId");
        const seats = clone(roomId ? (db.seats.get(roomId) ?? []) : []).sort((a, b) => a.seatIndex - b.seatIndex);
        return new Response(JSON.stringify(seats), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/upsert-seat")) {
        const seat = await req.json() as any;
        const seats = db.seats.get(seat.roomId) ?? [];
        const i = seats.findIndex((s) => s.seatIndex === seat.seatIndex);
        if (i >= 0) seats[i] = clone(seat);
        else seats.push(clone(seat));
        db.seats.set(seat.roomId, seats);
        await this.saveDb();
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/update-seat")) {
        const { roomId, seatIndex, patch } = await req.json() as any;
        const seat = (db.seats.get(roomId) ?? []).find((s) => s.seatIndex === seatIndex);
        if (seat) {
          Object.assign(seat, clone(patch));
          await this.saveDb();
        }
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "DELETE" && path.endsWith("/remove-seat")) {
        const roomId = url.searchParams.get("roomId");
        const seatIndex = Number(url.searchParams.get("seatIndex"));
        if (roomId) {
          const seats = db.seats.get(roomId) ?? [];
          db.seats.set(roomId, seats.filter((s) => s.seatIndex !== seatIndex));
          await this.saveDb();
        }
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "GET" && path.endsWith("/spectators")) {
        const roomId = url.searchParams.get("roomId");
        const sp = clone(roomId ? (db.spectators.get(roomId) ?? []) : []);
        return new Response(JSON.stringify(sp), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/upsert-spectator")) {
        const spectator = await req.json() as any;
        const list = db.spectators.get(spectator.roomId) ?? [];
        const i = list.findIndex((s) => s.uid === spectator.uid);
        if (i >= 0) list[i] = clone(spectator);
        else list.push(clone(spectator));
        db.spectators.set(spectator.roomId, list);
        await this.saveDb();
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "DELETE" && path.endsWith("/remove-spectator")) {
        const roomId = url.searchParams.get("roomId");
        const uid = url.searchParams.get("uid");
        if (roomId && uid) {
          const list = db.spectators.get(roomId) ?? [];
          db.spectators.set(roomId, list.filter((s) => s.uid !== uid));
          await this.saveDb();
        }
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/create-match")) {
        const { match, initialEvents } = await req.json() as any;
        db.matches.set(match.id, clone(match));
        db.activeMatchByRoom.set(match.roomId, match.id);
        db.eventSeq.set(match.id, 0);
        await this.saveDb();
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      if (req.method === "GET" && path.endsWith("/get-match")) {
        const id = url.searchParams.get("id");
        const roomId = url.searchParams.get("roomId");
        const active = url.searchParams.get("active");
        let m = null;
        if (id) {
          m = db.matches.get(id);
        } else if (roomId && active) {
          const matchId = db.activeMatchByRoom.get(roomId);
          if (matchId) {
            const temp = db.matches.get(matchId);
            if (temp && temp.status === "active") m = temp;
          }
        }
        return new Response(JSON.stringify(m ? clone(m) : null), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/apply-match-update")) {
        const { matchId, expectedVersion, update } = await req.json() as any;
        const m = db.matches.get(matchId);
        if (!m || m.version !== expectedVersion) {
          return new Response(JSON.stringify({ status: "conflict" }), { headers: CORS });
        }
        m.version = update.version;
        m.phase = update.phase;
        m.publicState = clone(update.publicState);
        if (update.privateStatePatch) {
          m.privateState = { ...m.privateState, ...clone(update.privateStatePatch) };
        }
        if (update.scoresPatch) {
          m.scores = { ...m.scores, ...clone(update.scoresPatch) };
        }
        if (update.timer !== undefined) m.timer = clone(update.timer);
        if (update.over) m.over = true;
        if (update.status) {
          m.status = update.status;
          if (update.status !== "active") db.activeMatchByRoom.delete(m.roomId);
        }
        if (update.endedAt !== undefined) m.endedAt = update.endedAt;
        const seq = db.eventSeq.get(matchId) ?? 0;
        db.eventSeq.set(matchId, seq + (update.events?.length || 0));
        await this.saveDb();
        return new Response(JSON.stringify({ status: "ok" }), { headers: CORS });
      }

      if (req.method === "GET" && path.endsWith("/list-packs")) {
        const gameId = url.searchParams.get("gameId");
        const packs = db.packs.filter((p) => p.gameId === gameId);
        return new Response(JSON.stringify(clone(packs)), { headers: CORS });
      }

      if (req.method === "POST" && path.endsWith("/create-pack")) {
        const pack = await req.json() as any;
        db.packs.push(clone(pack));
        await this.saveDb();
        return new Response(JSON.stringify({ success: true }), { headers: CORS });
      }

      return new Response("Not Found", { status: 404, headers: CORS });
    } catch (e) {
      console.error(e);
      return new Response("Server error", { status: 500, headers: CORS });
    }
  }
}
