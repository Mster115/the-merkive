import type {
  ContentPack,
  GameModule,
  ReduceResult,
  SeatIndex,
} from "@merky/game-sdk";
import { isReduceError } from "@merky/game-sdk";
import { getGame } from "@merky/games";
import type { MatchRecord, MatchUpdate, PlayerSeatRecord, RoomRecord, RoomStore } from "./store/types";
import { buildCtx, matchView, roomView } from "./views";
import { errors, ServiceError } from "./errors";

/** Safety caps for system cascades (tick chains, bot streaks). */
const MAX_SYSTEM_STEPS = 24;
const MAX_EVENTS_KEPT = 50;

export interface RuntimeDeps {
  store: RoomStore;
}

function requireGame(gameId: string | null): GameModule {
  const game = gameId ? getGame(gameId) : undefined;
  if (!game) throw errors.gameUnknown();
  return game;
}

/**
 * Persist one ReduceResult against the in-memory copy of the match, mutate
 * the copy on success, and publish the public patch + changed private states.
 */
async function persistAndPublish(
  { store }: RuntimeDeps,
  room: RoomRecord,
  match: MatchRecord,
  result: ReduceResult,
  actorSeat: SeatIndex | "system"
): Promise<"ok" | "conflict"> {
  const update: MatchUpdate = {
    version: match.version + 1,
    phase: result.phase,
    publicState: result.publicState,
    privateStatePatch: result.privateState,
    scoresPatch: result.scores,
    timer: result.timer,
    over: result.matchOver === true ? true : undefined,
    events: result.events.slice(0, MAX_EVENTS_KEPT),
    actorSeat,
  };
  const outcome = await store.applyMatchUpdate(match.id, match.version, update);
  if (outcome === "conflict") return "conflict";

  match.version = update.version;
  match.phase = update.phase;
  match.publicState = update.publicState;
  if (update.privateStatePatch) {
    match.privateState = { ...match.privateState, ...update.privateStatePatch };
  }
  if (update.scoresPatch) match.scores = { ...match.scores, ...update.scoresPatch };
  if (update.timer !== undefined) match.timer = update.timer;
  if (update.over) match.over = true;

  await store.publish(room.code, {
    kind: "match",
    match: matchView(match),
    events: update.events,
  });
  if (update.privateStatePatch) {
    for (const key of Object.keys(update.privateStatePatch)) {
      const seat = Number(key) as SeatIndex;
      await store.publish(room.code, {
        kind: "private",
        seat,
        version: match.version,
        privateState: match.privateState[seat] ?? null,
      });
    }
  }
  return "ok";
}

/** Start a match: seed, init at version 0, persist the post-init record. */
export async function startMatchRuntime(
  deps: RuntimeDeps,
  room: RoomRecord,
  seats: PlayerSeatRecord[],
  resolvedPack: ContentPack | undefined
): Promise<MatchRecord> {
  const game = requireGame(room.gameId);
  const settings: Record<string, unknown> = {
    ...game.meta.defaultSettings,
    ...room.settings,
  };
  if (resolvedPack) settings._pack = resolvedPack;

  const base: MatchRecord = {
    id: crypto.randomUUID(),
    roomId: room.id,
    gameId: game.meta.id,
    status: "active",
    phase: "init",
    seed: crypto.randomUUID(),
    version: 0,
    settings,
    publicState: null,
    privateState: {},
    scores: {},
    timer: null,
    over: false,
    startedAt: Date.now(),
    endedAt: null,
  };

  const result = game.init(buildCtx(room, base, seats));
  base.version = 1;
  base.phase = result.phase;
  base.publicState = result.publicState;
  base.privateState = { ...(result.privateState ?? {}) };
  base.scores = { ...(result.scores ?? {}) };
  base.timer = result.timer ?? null;
  base.over = result.matchOver === true;

  await deps.store.createMatch(base, result.events);

  await deps.store.publish(room.code, {
    kind: "match",
    match: matchView(base),
    events: result.events,
  });
  for (const key of Object.keys(base.privateState)) {
    const seat = Number(key) as SeatIndex;
    await deps.store.publish(room.code, {
      kind: "private",
      seat,
      version: base.version,
      privateState: base.privateState[seat] ?? null,
    });
  }
  return base;
}

/**
 * Drive all pending system work: expired timers (onTick) and bot coverage of
 * abandoned awaited seats. Runs until quiescent or the step cap is reached.
 * Returns true if anything was applied.
 */
export async function advanceSystem(
  deps: RuntimeDeps,
  room: RoomRecord,
  match: MatchRecord,
  seats: PlayerSeatRecord[]
): Promise<boolean> {
  const game = requireGame(match.gameId);
  let didWork = false;

  for (let step = 0; step < MAX_SYSTEM_STEPS; step++) {
    if (match.over || match.status !== "active") break;

    if (match.timer && Date.now() >= match.timer.endsAt && game.onTick) {
      const result = game.onTick(buildCtx(room, match, seats), {
        publicState: match.publicState,
        privateState: match.privateState,
        phase: match.phase,
      });
      if (result) {
        const outcome = await persistAndPublish(deps, room, match, result, "system");
        if (outcome === "conflict") break;
        didWork = true;
        continue;
      }
      // A due timer the game ignores would spin the loop — drop it once.
      const cleared = await deps.store.applyMatchUpdate(match.id, match.version, {
        version: match.version + 1,
        phase: match.phase,
        publicState: match.publicState,
        timer: null,
        events: [],
        actorSeat: "system",
      });
      if (cleared === "ok") {
        match.version += 1;
        match.timer = null;
        didWork = true;
      }
      break;
    }

    const abandonedAwaited = game
      .awaitedSeats(buildCtx(room, match, seats), {
        publicState: match.publicState,
        privateState: match.privateState,
        phase: match.phase,
      })
      .filter((seat) => seats.find((s) => s.seatIndex === seat)?.abandoned);

    let botActed = false;
    for (const seat of abandonedAwaited) {
      const bot = game.suggestBotAction?.(
        buildCtx(room, match, seats),
        { publicState: match.publicState, privateState: match.privateState, phase: match.phase },
        seat
      );
      if (!bot) continue;
      const result = game.reduce(
        buildCtx(room, match, seats),
        { publicState: match.publicState, privateState: match.privateState, phase: match.phase },
        { type: bot.type, seat, payload: bot.payload }
      );
      if (isReduceError(result)) continue;
      const outcome = await persistAndPublish(deps, room, match, result, seat);
      if (outcome === "conflict") return didWork;
      didWork = true;
      botActed = true;
      break; // re-evaluate awaited seats from the new state
    }
    if (!botActed) break;
  }
  return didWork;
}

/** Run a seat hook (onSeatAbandoned / onSeatReplaced) and persist its result. */
export async function applySeatHook(
  deps: RuntimeDeps,
  room: RoomRecord,
  match: MatchRecord,
  seats: PlayerSeatRecord[],
  seat: SeatIndex,
  hook: "onSeatAbandoned" | "onSeatReplaced"
): Promise<void> {
  const game = requireGame(match.gameId);
  const fn = game[hook];
  if (!fn) return;
  const result = fn(buildCtx(room, match, seats), {
    publicState: match.publicState,
    privateState: match.privateState,
    phase: match.phase,
  }, seat);
  if (result) await persistAndPublish(deps, room, match, result, "system");
}

/** Apply a player's intent. Throws ServiceError for auth/validation failures. */
export async function applyPlayerAction(
  deps: RuntimeDeps,
  room: RoomRecord,
  match: MatchRecord,
  seats: PlayerSeatRecord[],
  seat: SeatIndex,
  action: { type: string; payload?: unknown }
): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  const game = requireGame(match.gameId);

  // Fire any due timer first so the action lands on current state.
  await advanceSystem(deps, room, match, seats);
  if (match.over || match.status !== "active") throw errors.noActiveMatch();

  const result = game.reduce(
    buildCtx(room, match, seats),
    { publicState: match.publicState, privateState: match.privateState, phase: match.phase },
    { type: action.type, seat, payload: action.payload }
  );
  if (isReduceError(result)) {
    return { ok: false, code: result.code, error: result.error };
  }
  const outcome = await persistAndPublish(deps, room, match, result, seat);
  if (outcome === "conflict") throw errors.versionConflict();

  await advanceSystem(deps, room, match, seats);
  return { ok: true };
}

/** Close out a finished or aborted match and return the room to the lobby. */
export async function finalizeMatch(
  deps: RuntimeDeps,
  room: RoomRecord,
  match: MatchRecord,
  seats: PlayerSeatRecord[],
  status: "completed" | "aborted"
): Promise<void> {
  const endedAt = Date.now();
  await deps.store.applyMatchUpdate(match.id, match.version, {
    version: match.version + 1,
    phase: match.phase,
    publicState: match.publicState,
    status,
    endedAt,
    over: true,
    events: [],
    actorSeat: "system",
  });
  match.version += 1;
  match.status = status;
  match.over = true;

  await deps.store.updateRoom(room.id, {
    status: "lobby",
    pausedAt: null,
    // An aborted match has no meaningful result — keep the previous podium.
    lastMatch:
      status === "completed"
        ? {
            gameId: match.gameId,
            endedAt,
            scores: match.scores,
            seats: seats.map((s) => ({
              seatIndex: s.seatIndex,
              displayName: s.displayName,
              avatarId: s.avatarId,
            })),
          }
        : room.lastMatch,
  });
  const updated = await deps.store.getRoomById(room.id);
  if (updated) {
    Object.assign(room, updated);
    const spectators = await deps.store.listSpectators(room.id);
    await deps.store.publish(room.code, {
      kind: "room",
      room: roomView(updated, seats, spectators.filter((s) => s.connected).length),
    });
    await deps.store.publish(room.code, {
      kind: "match",
      match: matchView(match),
      events: [{ type: status === "completed" ? "match_completed" : "match_aborted" }],
    });
  }
}

export { requireGame, persistAndPublish };
export type { ServiceError };
