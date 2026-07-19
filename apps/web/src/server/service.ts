import type { ContentPack, SeatIndex } from "@merky/game-sdk";
import { getGame } from "@merky/games";
import { TICK_ACTION, type ClientSnapshot } from "@/shared/messages";
import { errors, ServiceError } from "./errors";
import { normalizeCode, randomCode } from "./codes";
import { withRoomLock } from "./lock";
import { getStore } from "./store";
import type {
  CustomPackRecord,
  PlayerSeatRecord,
  RoomRecord,
  RoomStore,
} from "./store/types";
import {
  advanceSystem,
  applyPlayerAction,
  applySeatHook,
  finalizeMatch,
  startMatchRuntime,
} from "./runtime";
import { buildSnapshot, roomView } from "./views";

const PLAYER_GRACE_MS = 60_000;
const HOST_GRACE_MS = 45_000;
const LOBBY_IDLE_MS = 30 * 60_000;
const GAME_IDLE_MS = 2 * 60 * 60_000;
const PAUSE_MAX_MS = 5 * 60_000;
const ROOM_ABSOLUTE_MS = 6 * 60 * 60_000;
const SPECTATOR_CAP = 20;
const SWEEP_INTERVAL_MS = 2_500;
const RATE_LIMIT = { windowMs: 10_000, max: 30 };

declare global {
  // eslint-disable-next-line no-var
  var __mbSweeper: ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __mbConnCounts: Map<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __mbIdempotency: Map<string, { ok: true } | { ok: false; code: string; error: string }> | undefined;
  // eslint-disable-next-line no-var
  var __mbRate: Map<string, { count: number; resetAt: number }> | undefined;
}

const connCounts = (globalThis.__mbConnCounts ??= new Map());
const idempotencyCache = (globalThis.__mbIdempotency ??= new Map());
const rateBuckets = (globalThis.__mbRate ??= new Map());

function checkRateLimit(uid: string): void {
  const now = Date.now();
  const bucket = rateBuckets.get(uid);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(uid, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.max) throw errors.rateLimited();
}

function rememberIdempotent(
  key: string,
  result: { ok: true } | { ok: false; code: string; error: string }
): void {
  if (idempotencyCache.size > 500) {
    const first = idempotencyCache.keys().next().value;
    if (first) idempotencyCache.delete(first);
  }
  idempotencyCache.set(key, result);
}

async function getRoomOrThrow(store: RoomStore, rawCode: string): Promise<RoomRecord> {
  const code = normalizeCode(rawCode);
  if (!code) throw errors.roomNotFound();
  const room = await store.getRoomByCode(code);
  if (!room || room.status === "expired") throw errors.roomNotFound();
  return room;
}

async function publishRoom(store: RoomStore, room: RoomRecord): Promise<void> {
  const [seats, spectators] = await Promise.all([
    store.listSeats(room.id),
    store.listSpectators(room.id),
  ]);
  await store.publish(room.code, {
    kind: "room",
    room: roomView(room, seats, spectators.filter((s) => s.connected).length),
  });
}

async function reassignHost(
  store: RoomStore,
  room: RoomRecord,
  seats: PlayerSeatRecord[]
): Promise<boolean> {
  const hostSeat = seats.find((s) => s.seatIndex === room.hostSeat);
  const hostAlive =
    hostSeat &&
    !hostSeat.abandoned &&
    (hostSeat.connected ||
      (hostSeat.disconnectedAt !== null && Date.now() - hostSeat.disconnectedAt < HOST_GRACE_MS));
  if (hostAlive) return false;

  const candidates = seats
    .filter((s) => !s.abandoned && s.seatIndex !== room.hostSeat)
    .sort((a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt - b.joinedAt);
  const next = candidates[0];
  if (!next || next.seatIndex === room.hostSeat) return false;
  await store.updateRoom(room.id, { hostSeat: next.seatIndex });
  room.hostSeat = next.seatIndex;
  return true;
}

/* ------------------------------------------------------------------ */
/* Public service API (each entry point takes the room lock)           */
/* ------------------------------------------------------------------ */

export interface JoinResult {
  token: string;
  snapshot: ClientSnapshot;
}

export async function createRoom(
  uid: string,
  name: string,
  avatarId: string
): Promise<{ code: string } & JoinResult> {
  const store = getStore();
  ensureSweeper();

  let code = randomCode();
  for (let i = 0; i < 8 && (await store.getRoomByCode(code)); i++) code = randomCode();

  const now = Date.now();
  const room: RoomRecord = {
    id: crypto.randomUUID(),
    code,
    status: "lobby",
    hostSeat: 0,
    gameId: null,
    settings: {},
    maxPlayers: 8,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ROOM_ABSOLUTE_MS,
    pausedAt: null,
    lastMatch: null,
  };
  await store.createRoom(room);
  await store.upsertSeat({
    roomId: room.id,
    seatIndex: 0,
    playerUid: uid,
    displayName: name,
    avatarId,
    connected: true,
    joinedAt: now,
    lastSeenAt: now,
    disconnectedAt: null,
    abandoned: false,
  });
  const snapshot = await snapshotForUid(store, room, uid);
  return { code, token: uid, snapshot };
}

export async function joinRoom(
  rawCode: string,
  opts: {
    uid: string | null;
    fresh: boolean;
    name: string;
    avatarId: string;
    role: "player" | "spectator";
  }
): Promise<JoinResult> {
  const store = getStore();
  ensureSweeper();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    const seats = await store.listSeats(room.id);

    // Reclaim an existing seat with the same identity (reconnect path).
    if (!opts.fresh && opts.uid) {
      const mine = seats.find((s) => s.playerUid === opts.uid);
      if (mine) {
        if (mine.abandoned) await reclaimSeat(store, room, seats, mine);
        await publishRoom(store, room);
        return { token: opts.uid, snapshot: await snapshotForUid(store, room, opts.uid) };
      }
    }

    const uid = opts.fresh || !opts.uid ? crypto.randomUUID() : opts.uid;
    const now = Date.now();

    if (opts.role === "spectator") {
      const spectators = await store.listSpectators(room.id);
      if (spectators.filter((s) => s.connected).length >= SPECTATOR_CAP) {
        throw errors.spectatorCap();
      }
      await store.upsertSpectator({
        roomId: room.id,
        uid,
        displayName: opts.name,
        avatarId: opts.avatarId,
        connected: true,
        lastSeenAt: now,
      });
      await publishRoom(store, room);
      return { token: uid, snapshot: await snapshotForUid(store, room, uid) };
    }

    if (room.status === "lobby") {
      let seatIndex: SeatIndex | null = null;
      for (let i = 0; i < room.maxPlayers; i++) {
        if (!seats.some((s) => s.seatIndex === i)) {
          seatIndex = i as SeatIndex;
          break;
        }
      }
      if (seatIndex === null) throw errors.roomFull();
      await store.upsertSeat({
        roomId: room.id,
        seatIndex,
        playerUid: uid,
        displayName: opts.name,
        avatarId: opts.avatarId,
        connected: true,
        joinedAt: now,
        lastSeenAt: now,
        disconnectedAt: null,
        abandoned: false,
      });
      const freshSeats = await store.listSeats(room.id);
      await reassignHost(store, room, freshSeats);
      await publishRoom(store, room);
      return { token: uid, snapshot: await snapshotForUid(store, room, uid) };
    }

    // Mid-game join: only into an abandoned seat, only if the game allows it.
    const game = room.gameId ? getGame(room.gameId) : undefined;
    if (!game?.meta.supportsMidGameJoin) throw errors.roomInGame();
    const abandoned = seats.find((s) => s.abandoned);
    if (!abandoned) throw errors.roomInGame();

    await store.updateSeat(room.id, abandoned.seatIndex, {
      playerUid: uid,
      displayName: opts.name,
      avatarId: opts.avatarId,
      connected: true,
      joinedAt: now,
      lastSeenAt: now,
      disconnectedAt: null,
      abandoned: false,
    });
    const freshSeats = await store.listSeats(room.id);
    const match = await store.getActiveMatch(room.id);
    if (match) {
      await applySeatHook({ store }, room, match, freshSeats, abandoned.seatIndex, "onSeatReplaced");
      await advanceSystem({ store }, room, match, freshSeats);
      if (match.over) await finalizeMatch({ store }, room, match, freshSeats, "completed");
    }
    await publishRoom(store, room);
    return { token: uid, snapshot: await snapshotForUid(store, room, uid) };
  });
}

async function reclaimSeat(
  store: RoomStore,
  room: RoomRecord,
  seats: PlayerSeatRecord[],
  seat: PlayerSeatRecord
): Promise<void> {
  await store.updateSeat(room.id, seat.seatIndex, {
    abandoned: false,
    connected: true,
    disconnectedAt: null,
    lastSeenAt: Date.now(),
  });
  const freshSeats = await store.listSeats(room.id);
  const match = await store.getActiveMatch(room.id);
  if (match) {
    await applySeatHook({ store }, room, match, freshSeats, seat.seatIndex, "onSeatReplaced");
    await advanceSystem({ store }, room, match, freshSeats);
  }
}

export async function leaveRoom(rawCode: string, uid: string): Promise<void> {
  const store = getStore();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    const seats = await store.listSeats(room.id);
    const seat = seats.find((s) => s.playerUid === uid);

    if (!seat) {
      await store.removeSpectator(room.id, uid);
      await publishRoom(store, room);
      return;
    }

    if (room.status === "lobby") {
      await store.removeSeat(room.id, seat.seatIndex);
    } else {
      await store.updateSeat(room.id, seat.seatIndex, {
        abandoned: true,
        connected: false,
        disconnectedAt: Date.now(),
      });
      const freshSeats = await store.listSeats(room.id);
      const match = await store.getActiveMatch(room.id);
      if (match) {
        await applySeatHook({ store }, room, match, freshSeats, seat.seatIndex, "onSeatAbandoned");
        await advanceSystem({ store }, room, match, freshSeats);
        if (match.over) await finalizeMatch({ store }, room, match, freshSeats, "completed");
      }
    }
    const remaining = await store.listSeats(room.id);
    await reassignHost(store, room, remaining);
    await publishRoom(store, room);
  });
}

export async function kickSeat(
  rawCode: string,
  byUid: string,
  seatIndex: SeatIndex
): Promise<void> {
  const store = getStore();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    const seats = await store.listSeats(room.id);
    const host = seats.find((s) => s.playerUid === byUid);
    if (!host || host.seatIndex !== room.hostSeat) throw errors.notHost();
    const target = seats.find((s) => s.seatIndex === seatIndex);
    if (!target || target.seatIndex === host.seatIndex) return;

    if (room.status === "lobby") {
      await store.removeSeat(room.id, target.seatIndex);
    } else {
      await store.updateSeat(room.id, target.seatIndex, {
        abandoned: true,
        connected: false,
        disconnectedAt: Date.now(),
      });
      const freshSeats = await store.listSeats(room.id);
      const match = await store.getActiveMatch(room.id);
      if (match) {
        await applySeatHook({ store }, room, match, freshSeats, target.seatIndex, "onSeatAbandoned");
        await advanceSystem({ store }, room, match, freshSeats);
        if (match.over) await finalizeMatch({ store }, room, match, freshSeats, "completed");
      }
    }
    await store.publish(room.code, { kind: "bye", reason: "kicked", seat: target.seatIndex });
    await publishRoom(store, room);
  });
}

export async function transferHost(
  rawCode: string,
  byUid: string,
  seatIndex: SeatIndex
): Promise<void> {
  const store = getStore();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    const seats = await store.listSeats(room.id);
    const host = seats.find((s) => s.playerUid === byUid);
    if (!host || host.seatIndex !== room.hostSeat) throw errors.notHost();
    const target = seats.find((s) => s.seatIndex === seatIndex && !s.abandoned);
    if (!target) throw errors.notSeated();
    await store.updateRoom(room.id, { hostSeat: target.seatIndex });
    room.hostSeat = target.seatIndex;
    await publishRoom(store, room);
  });
}

export async function updateRoomSettings(
  rawCode: string,
  byUid: string,
  patch: { gameId?: string; settings?: Record<string, unknown> }
): Promise<void> {
  const store = getStore();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    if (room.status !== "lobby") throw errors.notInLobby();
    const seats = await store.listSeats(room.id);
    const host = seats.find((s) => s.playerUid === byUid);
    if (!host || host.seatIndex !== room.hostSeat) throw errors.notHost();

    const update: Partial<RoomRecord> = {};
    if (patch.gameId !== undefined) {
      const game = getGame(patch.gameId);
      if (!game) throw errors.gameUnknown();
      update.gameId = game.meta.id;
      if (patch.gameId !== room.gameId) update.settings = {};
    }
    if (patch.settings) {
      const gameId = update.gameId ?? room.gameId;
      const game = gameId ? getGame(gameId) : undefined;
      if (!game) throw errors.gameUnknown();
      const allowed = new Set([
        ...Object.keys(game.meta.defaultSettings),
        ...game.meta.settingFields.map((f) => f.key),
      ]);
      const merged: Record<string, unknown> = { ...(update.settings ?? room.settings) };
      for (const [key, value] of Object.entries(patch.settings)) {
        if (!allowed.has(key)) continue;
        const field = game.meta.settingFields.find((f) => f.key === key);
        if (field?.type === "number" && typeof value === "number") {
          merged[key] = Math.min(field.max, Math.max(field.min, Math.round(value)));
        } else {
          merged[key] = value;
        }
      }
      update.settings = merged;
    }
    await store.updateRoom(room.id, update);
    Object.assign(room, update);
    await publishRoom(store, room);
  });
}

export async function startMatch(rawCode: string, byUid: string): Promise<void> {
  const store = getStore();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    if (room.status !== "lobby") throw errors.notInLobby();
    const seats = await store.listSeats(room.id);
    const host = seats.find((s) => s.playerUid === byUid);
    if (!host || host.seatIndex !== room.hostSeat) throw errors.notHost();
    const game = room.gameId ? getGame(room.gameId) : undefined;
    if (!game) throw errors.gameUnknown();
    if (seats.length < game.meta.minPlayers) throw errors.needPlayers(game.meta.minPlayers);
    if (seats.length > game.meta.maxPlayers) {
      throw errors.needPlayers(game.meta.maxPlayers);
    }

    const packId = { ...game.meta.defaultSettings, ...room.settings }.packId;
    const pack = typeof packId === "string" ? await resolvePack(store, game.meta.id, packId) : undefined;

    await startMatchRuntime({ store }, room, seats, pack);
    await store.updateRoom(room.id, { status: "in_game", pausedAt: null });
    room.status = "in_game";
    await publishRoom(store, room);
  });
}

export async function endMatch(rawCode: string, byUid: string): Promise<void> {
  const store = getStore();
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    const seats = await store.listSeats(room.id);
    const host = seats.find((s) => s.playerUid === byUid);
    if (!host || host.seatIndex !== room.hostSeat) throw errors.notHost();
    const match = await store.getActiveMatch(room.id);
    if (!match) throw errors.noActiveMatch();
    await finalizeMatch({ store }, room, match, seats, "aborted");
  });
}

export async function applyAction(
  rawCode: string,
  uid: string,
  action: { type: string; payload?: unknown; idempotencyKey?: string }
): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  const store = getStore();
  ensureSweeper();
  checkRateLimit(uid);
  return withRoomLock(rawCode, async () => {
    const room = await getRoomOrThrow(store, rawCode);
    const match = await store.getActiveMatch(room.id);
    if (!match) throw errors.noActiveMatch();
    const seats = await store.listSeats(room.id);

    if (action.type === TICK_ACTION) {
      await advanceSystem({ store }, room, match, seats);
      if (match.over && match.status === "active") {
        await finalizeMatch({ store }, room, match, seats, "completed");
      }
      return { ok: true } as const;
    }

    const seat = seats.find((s) => s.playerUid === uid);
    if (!seat) throw errors.notSeated();

    const idemKey = action.idempotencyKey ? `${match.id}:${seat.seatIndex}:${action.idempotencyKey}` : null;
    if (idemKey) {
      const prior = idempotencyCache.get(idemKey);
      if (prior) return prior;
    }

    if (seat.abandoned) {
      await store.updateSeat(room.id, seat.seatIndex, {
        abandoned: false,
        connected: true,
        disconnectedAt: null,
      });
      const freshSeats = await store.listSeats(room.id);
      await applySeatHook({ store }, room, match, freshSeats, seat.seatIndex, "onSeatReplaced");
      await publishRoom(store, room);
    }

    await store.updateSeat(room.id, seat.seatIndex, { lastSeenAt: Date.now() });
    const currentSeats = await store.listSeats(room.id);

    const result = await applyPlayerAction(
      { store },
      room,
      match,
      currentSeats,
      seat.seatIndex,
      { type: action.type, payload: action.payload }
    );
    if (match.over && match.status === "active") {
      await finalizeMatch({ store }, room, match, currentSeats, "completed");
    }
    if (idemKey) rememberIdempotent(idemKey, result);
    return result;
  });
}

export async function snapshotFor(rawCode: string, uid: string | null): Promise<ClientSnapshot> {
  const store = getStore();
  ensureSweeper();
  const room = await getRoomOrThrow(store, rawCode);
  return snapshotForUid(store, room, uid);
}

async function snapshotForUid(
  store: RoomStore,
  room: RoomRecord,
  uid: string | null
): Promise<ClientSnapshot> {
  const [seats, spectators, match] = await Promise.all([
    store.listSeats(room.id),
    store.listSpectators(room.id),
    store.getActiveMatch(room.id),
  ]);
  const seat = uid ? seats.find((s) => s.playerUid === uid) : undefined;
  return buildSnapshot(
    room,
    seats,
    spectators.filter((s) => s.connected).length,
    match,
    seat
      ? { seatIndex: seat.seatIndex, role: "player" }
      : { seatIndex: null, role: "spectator" }
  );
}

/* ------------------------------------------------------------------ */
/* Packs                                                               */
/* ------------------------------------------------------------------ */

export async function listPacks(gameId: string): Promise<ContentPack[]> {
  const store = getStore();
  const game = getGame(gameId);
  if (!game) throw errors.gameUnknown();
  const builtin = game.packs ?? [];
  const custom = await store.listCustomPacks(gameId);
  return [
    ...builtin,
    ...custom.map((c) => ({
      id: c.id,
      gameId: c.gameId,
      title: c.title,
      locale: c.locale,
      payload: c.payload,
    })),
  ];
}

async function resolvePack(
  store: RoomStore,
  gameId: string,
  packId: string
): Promise<ContentPack | undefined> {
  const packs = await listPacks(gameId);
  return packs.find((p) => p.id === packId);
}

export async function createPack(
  gameId: string,
  title: string,
  locale: string,
  payload: unknown
): Promise<CustomPackRecord> {
  const store = getStore();
  const game = getGame(gameId);
  if (!game) throw errors.gameUnknown();
  if (JSON.stringify(payload).length > 50_000) {
    throw new ServiceError("pack_too_large", "Pack is too large.", 413);
  }
  const pack: CustomPackRecord = {
    id: crypto.randomUUID(),
    gameId,
    title: title.slice(0, 60) || "Custom pack",
    locale,
    payload,
    createdAt: Date.now(),
  };
  await store.createCustomPack(pack);
  return pack;
}

/* ------------------------------------------------------------------ */
/* Presence (called by the realtime routes)                            */
/* ------------------------------------------------------------------ */

export async function presenceOpen(rawCode: string, uid: string): Promise<void> {
  const store = getStore();
  ensureSweeper();
  const key = `${rawCode.toUpperCase()}|${uid}`;
  connCounts.set(key, (connCounts.get(key) ?? 0) + 1);
  if (connCounts.get(key) !== 1) return;

  await withRoomLock(rawCode, async () => {
    const room = await store.getRoomByCode(normalizeCode(rawCode) ?? "");
    if (!room || room.status === "expired") return;
    const seats = await store.listSeats(room.id);
    const seat = seats.find((s) => s.playerUid === uid);
    const now = Date.now();
    if (seat) {
      await store.updateSeat(room.id, seat.seatIndex, {
        connected: true,
        disconnectedAt: null,
        lastSeenAt: now,
      });
      if (room.pausedAt) {
        await store.updateRoom(room.id, { pausedAt: null });
        room.pausedAt = null;
      }
    } else {
      const spectators = await store.listSpectators(room.id);
      const spec = spectators.find((s) => s.uid === uid);
      if (spec) await store.upsertSpectator({ ...spec, connected: true, lastSeenAt: now });
    }
    await publishRoom(store, room);
  });
}

export async function presenceClose(rawCode: string, uid: string): Promise<void> {
  const store = getStore();
  const key = `${rawCode.toUpperCase()}|${uid}`;
  const count = (connCounts.get(key) ?? 1) - 1;
  if (count > 0) {
    connCounts.set(key, count);
    return;
  }
  connCounts.delete(key);

  await withRoomLock(rawCode, async () => {
    const room = await store.getRoomByCode(normalizeCode(rawCode) ?? "");
    if (!room || room.status === "expired") return;
    const seats = await store.listSeats(room.id);
    const seat = seats.find((s) => s.playerUid === uid);
    if (seat) {
      await store.updateSeat(room.id, seat.seatIndex, {
        connected: false,
        disconnectedAt: Date.now(),
      });
    } else {
      const spectators = await store.listSpectators(room.id);
      const spec = spectators.find((s) => s.uid === uid);
      if (spec) await store.upsertSpectator({ ...spec, connected: false, lastSeenAt: Date.now() });
    }
    await publishRoom(store, room);
  });
}

/* ------------------------------------------------------------------ */
/* Sweeper: graces, host transfer, pause/expiry, timers, bots          */
/* ------------------------------------------------------------------ */

export function ensureSweeper(): void {
  if (globalThis.__mbSweeper) return;
  const store = getStore();
  if (store.kind !== "memory") return; // supabase mode: cron hits /api/sweep
  globalThis.__mbSweeper = setInterval(() => {
    void sweepAll().catch(() => undefined);
  }, SWEEP_INTERVAL_MS);
}

export async function sweepAll(): Promise<void> {
  const store = getStore();
  const rooms = await store.listActiveRooms();
  for (const stale of rooms) {
    try {
      await withRoomLock(stale.code, () => sweepRoom(store, stale.code));
    } catch {
      // one broken room must not stall the sweep
    }
  }
}

async function sweepRoom(store: RoomStore, code: string): Promise<void> {
  const room = await store.getRoomByCode(code);
  if (!room || room.status === "expired") return;
  const now = Date.now();
  const seats = await store.listSeats(room.id);
  const spectators = await store.listSpectators(room.id);
  let dirty = false;

  const lastActivity = Math.max(
    room.updatedAt,
    ...seats.map((s) => s.lastSeenAt),
    ...spectators.map((s) => s.lastSeenAt),
    0
  );
  const idleLimit = room.status === "in_game" ? GAME_IDLE_MS : LOBBY_IDLE_MS;
  if (room.expiresAt <= now || lastActivity + idleLimit <= now) {
    await expireRoom(store, room);
    return;
  }

  // Disconnect graces.
  for (const seat of seats) {
    if (seat.connected || seat.abandoned || seat.disconnectedAt === null) continue;
    if (now - seat.disconnectedAt < PLAYER_GRACE_MS) continue;
    if (room.status === "lobby") {
      await store.removeSeat(room.id, seat.seatIndex);
      dirty = true;
    } else {
      await store.updateSeat(room.id, seat.seatIndex, { abandoned: true });
      const freshSeats = await store.listSeats(room.id);
      const match = await store.getActiveMatch(room.id);
      if (match) {
        await applySeatHook({ store }, room, match, freshSeats, seat.seatIndex, "onSeatAbandoned");
      }
      dirty = true;
    }
  }

  const liveSeats = await store.listSeats(room.id);

  if (await reassignHost(store, room, liveSeats)) dirty = true;

  // Pause / expire a match nobody is connected to.
  if (room.status === "in_game") {
    const anyConnected = liveSeats.some((s) => s.connected);
    if (!anyConnected && room.pausedAt === null) {
      await store.updateRoom(room.id, { pausedAt: now });
      room.pausedAt = now;
      dirty = true;
    } else if (anyConnected && room.pausedAt !== null) {
      await store.updateRoom(room.id, { pausedAt: null });
      room.pausedAt = null;
      dirty = true;
    }
    if (room.pausedAt !== null && now - room.pausedAt >= PAUSE_MAX_MS) {
      await expireRoom(store, room);
      return;
    }
  }

  // Timers + bot coverage.
  const match = await store.getActiveMatch(room.id);
  if (match) {
    const worked = await advanceSystem({ store }, room, match, liveSeats);
    if (match.over && match.status === "active") {
      await finalizeMatch({ store }, room, match, liveSeats, "completed");
      dirty = false; // finalize already published
    } else if (worked) {
      // advanceSystem published match patches; room row unchanged
    }
  }

  if (dirty) await publishRoom(store, room);
}

async function expireRoom(store: RoomStore, room: RoomRecord): Promise<void> {
  await store.publish(room.code, { kind: "bye", reason: "expired" });
  await store.updateRoom(room.id, { status: "expired" });
}
