import type {
  GameContext,
  GameAction,
  GameStateIn,
  ReduceResult,
  ReduceError,
  SeatIndex,
  SeatPublic,
} from "@merky/game-sdk";
import type { Tile, Meld } from "./tiles";
import { isValidMeld, meldValue, validateCommit, rackPipSum } from "./tiles";

export interface TileTangleSettings {
  turnSeconds: number;
  initialMeldPoints: number;
}

export interface TileTanglePublicState {
  table: Meld[];
  activeSeat: SeatIndex;
  rackCounts: Partial<Record<SeatIndex, number>>;
  drawPileCount: number;
  hasMelded: Partial<Record<SeatIndex, boolean>>;
  winner: SeatIndex | null;
  endReason?: string;
  lastAction: { seat: SeatIndex; kind: "commit" | "draw"; placedCount?: number } | null;
  turnsWithoutCommit: number;
}

export interface TileTanglePrivateState {
  rack: Tile[];
}

export interface TileTangleSecret {
  drawPile: Tile[];
}

export function getSettings(ctx: GameContext): TileTangleSettings {
  return {
    turnSeconds: typeof ctx.settings.turnSeconds === "number" ? ctx.settings.turnSeconds : 90,
    initialMeldPoints: typeof ctx.settings.initialMeldPoints === "number" ? ctx.settings.initialMeldPoints : 30,
  };
}

export function shuffle<T>(array: T[], rng: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    const target = arr[j];
    if (tmp !== undefined && target !== undefined) {
      arr[i] = target;
      arr[j] = tmp;
    }
  }
  return arr;
}

export function getNextSeat(currentSeat: SeatIndex, seats: SeatPublic[]): SeatIndex {
  const numSeats = seats.length;
  if (numSeats === 0) return currentSeat;
  for (let i = 1; i <= numSeats; i++) {
    const nextIdx = ((currentSeat + i) % numSeats) as SeatIndex;
    const s = seats.find((seat) => seat.seatIndex === nextIdx);
    if (s && !s.abandoned) {
      return nextIdx;
    }
  }
  return currentSeat;
}

export function createFullDeck(setCount = 1): Tile[] {
  const deck: Tile[] = [];
  for (let set = 0; set < setCount; set++) {
    const prefix = set === 0 ? "" : `s${set}-`;
    // 4 colors (0..3), numbers (1..13), 2 copies
    for (let copy = 0; copy < 2; copy++) {
      for (let n = 1; n <= 13; n++) {
        for (let c = 0; c < 4; c++) {
          deck.push({
            id: `${prefix}${copy}-${n}-${c}`,
            n,
            c,
          });
        }
      }
    }
    // 2 jokers
    deck.push({ id: `${prefix}j-0`, n: 0, c: 0, joker: true });
    deck.push({ id: `${prefix}j-1`, n: 0, c: 0, joker: true });
  }
  return deck;
}

export function initTileTangle(ctx: GameContext): ReduceResult {
  const settings = getSettings(ctx);
  const deck = shuffle(createFullDeck(ctx.seats.length >= 5 ? 2 : 1), ctx.rng);

  const privateState: Partial<Record<SeatIndex, TileTanglePrivateState>> = {};
  const rackCounts: Partial<Record<SeatIndex, number>> = {};
  const hasMelded: Partial<Record<SeatIndex, boolean>> = {};

  let pointer = 0;
  for (const s of ctx.seats) {
    const playerRack = deck.slice(pointer, pointer + 14);
    pointer += 14;
    privateState[s.seatIndex] = { rack: playerRack };
    rackCounts[s.seatIndex] = playerRack.length;
    hasMelded[s.seatIndex] = false;
  }

  const drawPile = deck.slice(pointer);
  const firstSeat = ctx.seats[0]?.seatIndex ?? 0;
  const turnMs = settings.turnSeconds * 1000;

  const publicState: TileTanglePublicState = {
    table: [],
    activeSeat: firstSeat,
    rackCounts,
    drawPileCount: drawPile.length,
    hasMelded,
    winner: null,
    lastAction: null,
    turnsWithoutCommit: 0,
  };

  return {
    publicState,
    privateState,
    secretState: { drawPile } satisfies TileTangleSecret,
    phase: "playing",
    events: [{ type: "game_started" }],
    timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
  };
}

export function reduceTileTangle(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = state.publicState as TileTanglePublicState | null;
  if (!pub) return { error: "State not initialized", code: "invalid_state" };

  if (state.phase !== "playing") {
    return { error: "Game is over", code: "bad_phase" };
  }

  if (action.seat === "system" || action.seat !== pub.activeSeat) {
    return { error: "Not your turn", code: "not_your_turn" };
  }

  const activeSeat = action.seat as SeatIndex;
  const settings = getSettings(ctx);
  const priv = (state.privateState[activeSeat] as TileTanglePrivateState | undefined) ?? { rack: [] };
  const turnMs = settings.turnSeconds * 1000;

  if (action.type === "commit") {
    const payload = action.payload as { melds?: Tile[][]; placedTileIds?: string[] } | undefined;
    const melds = payload?.melds ?? [];
    const placedTileIds = payload?.placedTileIds ?? [];

    const playerHasMelded = pub.hasMelded[activeSeat] ?? false;
    const validation = validateCommit(
      pub.table,
      priv.rack,
      { melds, placedTileIds },
      playerHasMelded,
      settings.initialMeldPoints
    );

    if (!validation.ok) {
      return { error: validation.error, code: validation.code };
    }

    const placedSet = new Set(placedTileIds);
    const newRack = priv.rack.filter((t) => !placedSet.has(t.id));
    const newHasMelded = { ...pub.hasMelded, [activeSeat]: true };
    const newRackCounts = { ...pub.rackCounts, [activeSeat]: newRack.length };

    const newTable: Meld[] = melds.map((mTiles, i) => ({
      id: `m-${i}`,
      tiles: mTiles,
    }));

    if (newRack.length === 0) {
      const winPub: TileTanglePublicState = {
        ...pub,
        table: newTable,
        rackCounts: newRackCounts,
        hasMelded: newHasMelded,
        lastAction: { seat: activeSeat, kind: "commit", placedCount: placedTileIds.length },
        turnsWithoutCommit: 0,
      };
      return endMatchWithWinner(
        ctx,
        { ...state, publicState: winPub, privateState: { ...state.privateState, [activeSeat]: { rack: newRack } } },
        activeSeat,
        "cleared_rack"
      );
    }

    const nextSeat = getNextSeat(activeSeat, ctx.seats);
    const nextPub: TileTanglePublicState = {
      ...pub,
      table: newTable,
      activeSeat: nextSeat,
      rackCounts: newRackCounts,
      hasMelded: newHasMelded,
      lastAction: { seat: activeSeat, kind: "commit", placedCount: placedTileIds.length },
      turnsWithoutCommit: 0,
    };

    return {
      publicState: nextPub,
      privateState: { [activeSeat]: { rack: newRack } },
      phase: "playing",
      events: [{ type: "commit", payload: { seat: activeSeat, placedCount: placedTileIds.length } }],
      timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
    };
  }

  if (action.type === "draw") {
    const secret = (state.secretState as TileTangleSecret | undefined) ?? { drawPile: [] };
    const newDrawPile = [...secret.drawPile];
    const newRack = [...priv.rack];

    if (newDrawPile.length > 0) {
      const drawnTile = newDrawPile.pop()!;
      newRack.push(drawnTile);
    }

    const newRackCounts = { ...pub.rackCounts, [activeSeat]: newRack.length };
    const turnsWithoutCommit = pub.turnsWithoutCommit + 1;

    if (newDrawPile.length === 0 && turnsWithoutCommit >= ctx.seats.length) {
      // Stalemate end: player with lowest rack pip sum wins
      let lowestSeat = activeSeat;
      let minPips = Infinity;

      for (const s of ctx.seats) {
        const sSeat = s.seatIndex;
        const sRack =
          sSeat === activeSeat
            ? newRack
            : (state.privateState[sSeat] as TileTanglePrivateState | undefined)?.rack ?? [];
        const pips = rackPipSum(sRack);
        if (pips < minPips) {
          minPips = pips;
          lowestSeat = sSeat;
        }
      }

      const endPub: TileTanglePublicState = {
        ...pub,
        rackCounts: newRackCounts,
        drawPileCount: 0,
        lastAction: { seat: activeSeat, kind: "draw" },
        turnsWithoutCommit,
      };

      return {
        ...endMatchWithWinner(
          ctx,
          { ...state, publicState: endPub, privateState: { ...state.privateState, [activeSeat]: { rack: newRack } } },
          lowestSeat,
          "stalemate"
        ),
        secretState: { drawPile: newDrawPile } satisfies TileTangleSecret,
      };
    }

    const nextSeat = getNextSeat(activeSeat, ctx.seats);
    const nextPub: TileTanglePublicState = {
      ...pub,
      activeSeat: nextSeat,
      rackCounts: newRackCounts,
      drawPileCount: newDrawPile.length,
      lastAction: { seat: activeSeat, kind: "draw" },
      turnsWithoutCommit,
    };

    return {
      publicState: nextPub,
      privateState: { [activeSeat]: { rack: newRack } },
      secretState: { drawPile: newDrawPile } satisfies TileTangleSecret,
      phase: "playing",
      events: [{ type: "draw", payload: { seat: activeSeat } }],
      timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
    };
  }

  return { error: "Unknown action type", code: "unknown_action" };
}

function endMatchWithWinner(
  ctx: GameContext,
  state: GameStateIn,
  winnerSeat: SeatIndex,
  reason: string
): ReduceResult {
  const pub = state.publicState as TileTanglePublicState;
  let winnerScore = 0;
  const scores: Partial<Record<SeatIndex, number>> = {};

  for (const s of ctx.seats) {
    const seatIdx = s.seatIndex;
    if (seatIdx !== winnerSeat) {
      const rack = (state.privateState[seatIdx] as TileTanglePrivateState | undefined)?.rack ?? [];
      const loserPips = rackPipSum(rack);
      scores[seatIdx] = -loserPips;
      winnerScore += loserPips;
    }
  }
  scores[winnerSeat] = winnerScore;

  const nextPub: TileTanglePublicState = {
    ...pub,
    winner: winnerSeat,
    endReason: reason,
  };

  return {
    publicState: nextPub,
    phase: "game_over",
    scores,
    events: [{ type: "game_over", payload: { winner: winnerSeat, reason } }],
    timer: null,
    matchOver: true,
  };
}

export function onTickTileTangle(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as TileTanglePublicState | null;
  if (!pub || state.phase !== "playing") return null;

  const res = reduceTileTangle(ctx, state, { type: "draw", seat: pub.activeSeat });
  return isReduceError(res) ? null : res;
}

export function awaitedSeatsTileTangle(_ctx: GameContext, state: GameStateIn): SeatIndex[] {
  if (state.phase !== "playing") return [];
  const pub = state.publicState as TileTanglePublicState | null;
  if (!pub) return [];
  return [pub.activeSeat];
}

export function suggestBotActionTileTangle(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): { type: string; payload?: unknown } | null {
  const pub = state.publicState as TileTanglePublicState | null;
  if (!pub || state.phase !== "playing" || pub.activeSeat !== seat) return null;

  const settings = getSettings(ctx);
  const priv = (state.privateState[seat] as TileTanglePrivateState | undefined) ?? { rack: [] };
  const rack = priv.rack;
  const hasMelded = pub.hasMelded[seat] ?? false;
  const table = pub.table;

  if (!hasMelded) {
    // Search rack for any single valid meld >= initialMeldPoints
    const n = rack.length;

    // Size 3
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const combo = [rack[i]!, rack[j]!, rack[k]!];
          if (isValidMeld(combo) && meldValue(combo) >= settings.initialMeldPoints) {
            const placedTileIds = combo.map((t) => t.id);
            const proposedMelds = [...table.map((m) => m.tiles), combo];
            return { type: "commit", payload: { melds: proposedMelds, placedTileIds } };
          }
        }
      }
    }

    // Size 4
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          for (let l = k + 1; l < n; l++) {
            const combo = [rack[i]!, rack[j]!, rack[k]!, rack[l]!];
            if (isValidMeld(combo) && meldValue(combo) >= settings.initialMeldPoints) {
              const placedTileIds = combo.map((t) => t.id);
              const proposedMelds = [...table.map((m) => m.tiles), combo];
              return { type: "commit", payload: { melds: proposedMelds, placedTileIds } };
            }
          }
        }
      }
    }

    return { type: "draw" };
  } else {
    // Try extending existing meld using 1 rack tile
    for (let mIdx = 0; mIdx < table.length; mIdx++) {
      const meldTiles = table[mIdx]!.tiles;
      for (const t of rack) {
        // try start, end, middle positions
        const candidates = [
          [t, ...meldTiles],
          [...meldTiles, t],
        ];

        for (const cand of candidates) {
          if (isValidMeld(cand)) {
            const placedTileIds = [t.id];
            const proposedMelds = table.map((m, idx) => (idx === mIdx ? cand : m.tiles));
            return { type: "commit", payload: { melds: proposedMelds, placedTileIds } };
          }
        }
      }
    }

    return { type: "draw" };
  }
}

export function onSeatAbandonedTileTangle(
  ctx: GameContext,
  state: GameStateIn,
  _seat: SeatIndex
): ReduceResult | null {
  const pub = state.publicState as TileTanglePublicState | null;
  if (!pub || state.phase !== "playing") return null;

  const activeSeats = ctx.seats.filter((s) => !s.abandoned);
  if (activeSeats.length === 1) {
    const winnerSeat = activeSeats[0]!.seatIndex;
    return endMatchWithWinner(ctx, state, winnerSeat, "last_standing");
  }

  return null;
}

function isReduceError(r: unknown): r is ReduceError {
  return typeof r === "object" && r !== null && "error" in r;
}
