import type {
  GameContext,
  GameAction,
  GameStateIn,
  ReduceResult,
  ReduceError,
  SeatIndex,
  SeatPublic,
} from "@merky/game-sdk";
import type { Card, DeclareSuit, Suit } from "./cards";
import { cardPointValue, createDeck, isLegalPlay, isWildCard, SUITS } from "./cards";
import type {
  EightstormPrivateState,
  EightstormPublicState,
  EightstormSecret,
  EightstormSettings,
} from "./types";

export function shuffle<T>(array: T[], rng: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    const target = copy[j];
    if (tmp !== undefined && target !== undefined) {
      copy[i] = target;
      copy[j] = tmp;
    }
  }
  return copy;
}

export function getNextSeat(
  currentSeat: SeatIndex,
  seats: SeatPublic[],
  direction: 1 | -1,
  step = 1
): SeatIndex {
  const activeSeats = seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
  if (activeSeats.length === 0) return currentSeat;
  const idx = activeSeats.indexOf(currentSeat);
  const startIdx = idx >= 0 ? idx : 0;
  const n = activeSeats.length;
  const rawIdx = (startIdx + direction * step) % n;
  const nextIdx = (rawIdx + n) % n;
  return activeSeats[nextIdx] ?? currentSeat;
}

export function getSettings(ctx: GameContext): EightstormSettings {
  return {
    drawTwoOnTwo: Boolean(ctx.settings.drawTwoOnTwo ?? true),
    skipOnJack: Boolean(ctx.settings.skipOnJack ?? true),
    reverseOnAce: Boolean(ctx.settings.reverseOnAce ?? true),
    jokers: Boolean(ctx.settings.jokers ?? false),
    turnSeconds: typeof ctx.settings.turnSeconds === "number" ? ctx.settings.turnSeconds : 45,
  };
}

function drawFromPile(
  drawPile: Card[],
  discardPile: Card[],
  count: number,
  rng: () => number
): { drawn: Card[]; newDrawPile: Card[]; newDiscardPile: Card[] } {
  let curDraw = [...drawPile];
  let curDiscard = [...discardPile];

  if (curDraw.length < count && curDiscard.length > 1) {
    const top = curDiscard[curDiscard.length - 1]!;
    const rest = curDiscard.slice(0, curDiscard.length - 1);
    const reshuffled = shuffle(rest, rng);
    curDraw = [...curDraw, ...reshuffled];
    curDiscard = [top];
  }

  const actualCount = Math.min(count, curDraw.length);
  const drawn = curDraw.slice(0, actualCount);
  const newDrawPile = curDraw.slice(actualCount);

  return { drawn, newDrawPile, newDiscardPile: curDiscard };
}

export function initEightstorm(ctx: GameContext): ReduceResult {
  const settings = getSettings(ctx);
  const fullDeck = shuffle(createDeck(settings.jokers), ctx.rng);
  const cardsPerPlayer = ctx.seats.length === 2 ? 7 : 5;

  const hands: Partial<Record<SeatIndex, Card[]>> = {};
  let cardPointer = 0;

  for (const s of ctx.seats) {
    hands[s.seatIndex] = fullDeck.slice(cardPointer, cardPointer + cardsPerPlayer);
    cardPointer += cardsPerPlayer;
  }

  let remaining = fullDeck.slice(cardPointer);
  let starterCard: Card | null = null;
  const wildPile: Card[] = [];

  while (remaining.length > 0) {
    const candidate = remaining.shift()!;
    if (isWildCard(candidate)) {
      wildPile.push(candidate);
    } else {
      starterCard = candidate;
      break;
    }
  }

  if (!starterCard) {
    starterCard = wildPile.pop() ?? { id: "S-A", suit: "S", rank: "A" };
  }

  const drawPile = [...remaining, ...wildPile];
  const discardPile = [starterCard];

  const firstSeat = ctx.seats[0]?.seatIndex ?? 0;
  const handCounts: Record<number, number> = {};
  const privateState: Partial<Record<SeatIndex, EightstormPrivateState>> = {};

  for (const s of ctx.seats) {
    const h = hands[s.seatIndex] ?? [];
    handCounts[s.seatIndex] = h.length;
    privateState[s.seatIndex] = { hand: h };
  }

  const publicState: EightstormPublicState = {
    activeSeat: firstSeat,
    direction: 1,
    topCard: starterCard,
    declaredSuit: null,
    pendingDraw: 0,
    drewThisTurn: false,
    handCounts,
    drawPileCount: drawPile.length,
    lastPlay: null,
    outSeat: null,
  };

  const secretState: EightstormSecret = { drawPile, discardPile };
  const turnMs = settings.turnSeconds * 1000;

  return {
    publicState,
    privateState,
    secretState,
    phase: "turn",
    events: [{ type: "game_started" }],
    timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
  };
}

export function reduceEightstorm(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = state.publicState as EightstormPublicState | null;
  if (!pub) return { error: "State not initialized", code: "invalid_state" };

  if (state.phase !== "turn") {
    return { error: "Not in turn phase", code: "bad_phase" };
  }

  if (action.seat !== pub.activeSeat) {
    return { error: "Not your turn", code: "not_your_turn" };
  }

  const activeSeat = action.seat as SeatIndex;
  const settings = getSettings(ctx);
  const priv = (state.privateState[activeSeat] as EightstormPrivateState | undefined) ?? { hand: [] };
  const secret: EightstormSecret = (state.secretState as EightstormSecret | undefined) ?? {
    drawPile: [],
    discardPile: [],
  };
  const turnMs = settings.turnSeconds * 1000;

  if (action.type === "play") {
    const payload = action.payload as { cardId?: string; declareSuit?: DeclareSuit } | undefined;
    const cardId = payload?.cardId;
    const declareSuit = payload?.declareSuit;

    if (!cardId) {
      return { error: "Card ID required", code: "missing_card_id" };
    }

    const cardIndex = priv.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      return { error: "Card not in hand", code: "not_your_card" };
    }

    const card = priv.hand[cardIndex]!;

    if (isWildCard(card)) {
      if (!declareSuit || !SUITS.includes(declareSuit)) {
        return { error: "Wild card requires declaring a suit", code: "need_suit" };
      }
    }

    if (!isLegalPlay(card, pub.topCard, pub.declaredSuit, pub.pendingDraw, settings.drawTwoOnTwo)) {
      return { error: "Illegal card play", code: "illegal_card" };
    }

    const newHand = [...priv.hand.slice(0, cardIndex), ...priv.hand.slice(cardIndex + 1)];
    const newDiscard = [...secret.discardPile, card];
    const newHandCounts = { ...pub.handCounts, [activeSeat]: newHand.length };

    if (newHand.length === 0) {
      let opponentSum = 0;
      for (const s of ctx.seats) {
        if (s.seatIndex !== activeSeat) {
          const oHand = (state.privateState[s.seatIndex] as EightstormPrivateState | undefined)?.hand ?? [];
          for (const c of oHand) {
            opponentSum += cardPointValue(c);
          }
        }
      }

      const winPub: EightstormPublicState = {
        ...pub,
        topCard: card,
        declaredSuit: isWildCard(card) ? declareSuit ?? null : null,
        pendingDraw: 0,
        drewThisTurn: false,
        handCounts: newHandCounts,
        lastPlay: { seat: activeSeat, action: "play", cardId: card.id },
        outSeat: activeSeat,
      };

      return {
        publicState: winPub,
        privateState: { [activeSeat]: { hand: newHand } },
        secretState: { ...secret, discardPile: newDiscard },
        phase: "game_over",
        scores: { [activeSeat]: opponentSum },
        events: [
          { type: "card_played", payload: { seat: activeSeat, cardId: card.id } },
          { type: "player_won", payload: { seat: activeSeat } },
        ],
        timer: null,
        matchOver: true,
      };
    }

    let nextPendingDraw = pub.pendingDraw;
    if (card.rank === "2" && settings.drawTwoOnTwo) {
      nextPendingDraw += 2;
    }

    let nextDirection = pub.direction;
    if (card.rank === "A" && settings.reverseOnAce) {
      nextDirection = (nextDirection * -1) as 1 | -1;
    }

    const activeSeatsCount = ctx.seats.filter((s) => !s.abandoned).length;
    let nextSeat: SeatIndex;

    if (card.rank === "A" && settings.reverseOnAce && activeSeatsCount === 2) {
      nextSeat = activeSeat;
    } else {
      const step = card.rank === "J" && settings.skipOnJack ? 2 : 1;
      nextSeat = getNextSeat(activeSeat, ctx.seats, nextDirection, step);
    }

    const nextPub: EightstormPublicState = {
      ...pub,
      activeSeat: nextSeat,
      direction: nextDirection,
      topCard: card,
      declaredSuit: isWildCard(card) ? declareSuit ?? null : null,
      pendingDraw: nextPendingDraw,
      drewThisTurn: false,
      handCounts: newHandCounts,
      lastPlay: { seat: activeSeat, action: "play", cardId: card.id },
    };

    return {
      publicState: nextPub,
      privateState: { [activeSeat]: { hand: newHand } },
      secretState: { ...secret, discardPile: newDiscard },
      phase: "turn",
      events: [{ type: "card_played", payload: { seat: activeSeat, cardId: card.id } }],
      timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
    };
  }

  if (action.type === "draw") {
    if (pub.pendingDraw === 0 && pub.drewThisTurn) {
      return { error: "Already drew a card this turn", code: "already_drew" };
    }

    const countToDraw = pub.pendingDraw > 0 ? pub.pendingDraw : 1;
    const { drawn, newDrawPile, newDiscardPile } = drawFromPile(
      secret.drawPile,
      secret.discardPile,
      countToDraw,
      ctx.rng
    );

    if (drawn.length === 0 && pub.pendingDraw === 0) {
      const nextSeat = getNextSeat(activeSeat, ctx.seats, pub.direction, 1);
      const passPub: EightstormPublicState = {
        ...pub,
        activeSeat: nextSeat,
        drewThisTurn: false,
        pendingDraw: 0,
        lastPlay: { seat: activeSeat, action: "pass" },
      };
      return {
        publicState: passPub,
        secretState: { drawPile: newDrawPile, discardPile: newDiscardPile },
        phase: "turn",
        events: [{ type: "passed", payload: { seat: activeSeat } }],
        timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
      };
    }

    const newHand = [...priv.hand, ...drawn];
    const newHandCounts = { ...pub.handCounts, [activeSeat]: newHand.length };

    if (pub.pendingDraw > 0) {
      const nextSeat = getNextSeat(activeSeat, ctx.seats, pub.direction, 1);
      const nextPub: EightstormPublicState = {
        ...pub,
        activeSeat: nextSeat,
        pendingDraw: 0,
        drewThisTurn: false,
        handCounts: newHandCounts,
        drawPileCount: newDrawPile.length,
        lastPlay: { seat: activeSeat, action: "draw" },
      };

      return {
        publicState: nextPub,
        privateState: { [activeSeat]: { hand: newHand } },
        secretState: { drawPile: newDrawPile, discardPile: newDiscardPile },
        phase: "turn",
        events: [{ type: "cards_drawn", payload: { seat: activeSeat, count: drawn.length } }],
        timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
      };
    }

    const nextPub: EightstormPublicState = {
      ...pub,
      drewThisTurn: true,
      handCounts: newHandCounts,
      drawPileCount: newDrawPile.length,
      lastPlay: { seat: activeSeat, action: "draw" },
    };

    return {
      publicState: nextPub,
      privateState: { [activeSeat]: { hand: newHand } },
      secretState: { drawPile: newDrawPile, discardPile: newDiscardPile },
      phase: "turn",
      events: [{ type: "cards_drawn", payload: { seat: activeSeat, count: drawn.length } }],
      timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
    };
  }

  if (action.type === "pass") {
    if (!pub.drewThisTurn || pub.pendingDraw > 0) {
      return { error: "Must draw before passing", code: "must_draw_first" };
    }

    const nextSeat = getNextSeat(activeSeat, ctx.seats, pub.direction, 1);
    const nextPub: EightstormPublicState = {
      ...pub,
      activeSeat: nextSeat,
      drewThisTurn: false,
      lastPlay: { seat: activeSeat, action: "pass" },
    };

    return {
      publicState: nextPub,
      phase: "turn",
      events: [{ type: "passed", payload: { seat: activeSeat } }],
      timer: { endsAt: ctx.now + turnMs, kind: "turn", durationMs: turnMs },
    };
  }

  return { error: "Unknown action type", code: "unknown_action" };
}

export function onTickEightstorm(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as EightstormPublicState | null;
  if (!pub || state.phase !== "turn") return null;

  const seat = pub.activeSeat;

  if (pub.pendingDraw > 0) {
    const res = reduceEightstorm(ctx, state, { type: "draw", seat });
    return isReduceError(res) ? null : res;
  }

  if (pub.drewThisTurn) {
    const res = reduceEightstorm(ctx, state, { type: "pass", seat });
    return isReduceError(res) ? null : res;
  }

  const drawRes = reduceEightstorm(ctx, state, { type: "draw", seat });
  if (isReduceError(drawRes)) return null;

  const intermediateState: GameStateIn = {
    publicState: drawRes.publicState,
    privateState: drawRes.privateState ? { ...state.privateState, ...drawRes.privateState } : state.privateState,
    secretState: drawRes.secretState !== undefined ? drawRes.secretState : state.secretState,
    phase: drawRes.phase,
  };

  const passRes = reduceEightstorm(ctx, intermediateState, { type: "pass", seat });
  if (isReduceError(passRes)) return drawRes;
  // The platform applies exactly one ReduceResult per tick, so the drawn
  // card's private-hand patch (and any pile change from the draw) must
  // survive the chained pass.
  return {
    ...passRes,
    privateState: { ...(drawRes.privateState ?? {}), ...(passRes.privateState ?? {}) },
    secretState: passRes.secretState !== undefined ? passRes.secretState : drawRes.secretState,
    events: [...drawRes.events, ...passRes.events],
  };
}

export function awaitedSeatsEightstorm(_ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as EightstormPublicState | null;
  if (!pub || state.phase !== "turn") return [];
  return [pub.activeSeat];
}

export function suggestBotActionEightstorm(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): { type: string; payload?: unknown } | null {
  const pub = state.publicState as EightstormPublicState | null;
  if (!pub || state.phase !== "turn" || pub.activeSeat !== seat) return null;

  const settings = getSettings(ctx);
  const priv = (state.privateState[seat] as EightstormPrivateState | undefined) ?? { hand: [] };

  const selectBestSuit = (hand: Card[]): DeclareSuit => {
    const counts: Record<DeclareSuit, number> = { S: 0, H: 0, D: 0, C: 0 };
    for (const c of hand) {
      if (c.suit in counts) {
        counts[c.suit as DeclareSuit]++;
      }
    }
    let max = -1;
    let best: DeclareSuit = "S";
    for (const s of SUITS) {
      if (counts[s] > max) {
        max = counts[s];
        best = s;
      }
    }
    return best;
  };

  if (pub.pendingDraw > 0) {
    if (settings.drawTwoOnTwo) {
      const twoCard = priv.hand.find((c) => c.rank === "2");
      if (twoCard) {
        const payload: { cardId: string; declareSuit?: DeclareSuit } = { cardId: twoCard.id };
        if (isWildCard(twoCard)) {
          payload.declareSuit = selectBestSuit(priv.hand);
        }
        return { type: "play", payload };
      }
    }
    return { type: "draw" };
  }

  const legalCards = priv.hand.filter((c) =>
    isLegalPlay(c, pub.topCard, pub.declaredSuit, pub.pendingDraw, settings.drawTwoOnTwo)
  );

  if (legalCards.length > 0) {
    const card = legalCards[0]!;
    const payload: { cardId: string; declareSuit?: DeclareSuit } = { cardId: card.id };
    if (isWildCard(card)) {
      payload.declareSuit = selectBestSuit(priv.hand);
    }
    return { type: "play", payload };
  }

  if (!pub.drewThisTurn) {
    return { type: "draw" };
  }

  return { type: "pass" };
}

export function onSeatAbandonedEightstorm(
  ctx: GameContext,
  state: GameStateIn,
  _seat: SeatIndex
): ReduceResult | null {
  const pub = state.publicState as EightstormPublicState | null;
  if (!pub || state.phase !== "turn") return null;

  const activeSeats = ctx.seats.filter((s) => !s.abandoned);
  if (activeSeats.length === 1) {
    const winner = activeSeats[0]!;
    const winnerSeat = winner.seatIndex;

    let opponentSum = 0;
    for (const s of ctx.seats) {
      if (s.seatIndex !== winnerSeat) {
        const oHand = (state.privateState[s.seatIndex] as EightstormPrivateState | undefined)?.hand ?? [];
        for (const c of oHand) {
          opponentSum += cardPointValue(c);
        }
      }
    }

    const winPub: EightstormPublicState = {
      ...pub,
      outSeat: winnerSeat,
    };

    return {
      publicState: winPub,
      phase: "game_over",
      scores: { [winnerSeat]: opponentSum },
      events: [{ type: "player_won", payload: { seat: winnerSeat } }],
      timer: null,
      matchOver: true,
    };
  }

  return null;
}

function isReduceError(r: unknown): r is ReduceError {
  return typeof r === "object" && r !== null && "error" in r;
}
