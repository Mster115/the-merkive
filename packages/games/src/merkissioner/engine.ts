import type { GameContext, GameEvent, GameStateIn, ReduceResult, SeatIndex, TimerInfo } from "@merky/game-sdk";
import {
  checkReshuffle,
  discardCards,
  discardPileCount,
  drawCards,
  drawPileCount,
  initialSecret,
  peekCards,
} from "./deck";
import {
  allSeats,
  baseSeconds,
  carryPrivate,
  getSettings,
  livingSeats,
  makeTimer,
  nextLivingSeat,
  nonAbandonedLiving,
  powerForNthMerkite,
  powerPhaseFor,
} from "./helpers";
import { assignRoles, boardFor, buildPrivateKnowledge, teamOfRole } from "./roles";
import type {
  Decree,
  LastVoteSummary,
  MerkissionerPrivateState,
  MerkissionerPublicState,
  MerkissionerSecret,
  PowerKind,
  Role,
  Team,
  Vote,
  WinReason,
} from "./types";

/** Every return point goes through here so no field is ever forgotten mid-chain. */
function result(
  pub: MerkissionerPublicState,
  priv: Partial<Record<SeatIndex, unknown>>,
  secret: MerkissionerSecret,
  phase: string,
  events: GameEvent[],
  timer: TimerInfo | null | undefined,
  extra?: { scores?: Partial<Record<SeatIndex, number>>; matchOver?: boolean }
): ReduceResult {
  return {
    publicState: pub,
    privateState: priv,
    secretState: secret,
    phase,
    events,
    timer,
    ...(extra?.scores ? { scores: extra.scores } : {}),
    ...(extra?.matchOver ? { matchOver: true } : {}),
  };
}

function pubOf(state: GameStateIn): MerkissionerPublicState {
  return state.publicState as MerkissionerPublicState;
}

function secretOf(state: GameStateIn): MerkissionerSecret {
  return (state.secretState as MerkissionerSecret) ?? initialSecret();
}

function privOf(state: GameStateIn, seat: SeatIndex): MerkissionerPrivateState | undefined {
  return state.privateState[seat] as MerkissionerPrivateState | undefined;
}

function incrementTrack(pub: MerkissionerPublicState, decree: Decree): MerkissionerPublicState {
  return decree === "merkite"
    ? { ...pub, merkiteEnacted: pub.merkiteEnacted + 1 }
    : { ...pub, merkizenEnacted: pub.merkizenEnacted + 1 };
}

/* ------------------------------------------------------------------ */
/* Init                                                                 */
/* ------------------------------------------------------------------ */

export function initMerkissioner(ctx: GameContext): ReduceResult {
  const seats = allSeats(ctx);
  const playerCount = seats.length;
  const board = boardFor(playerCount);
  const assignment = assignRoles(seats, ctx.rng);
  const startChair = (seats[Math.floor(ctx.rng() * seats.length)] ?? seats[0] ?? 0) as SeatIndex;

  const privateState: Partial<Record<SeatIndex, unknown>> = {};
  for (const seat of seats) {
    const role: Role = assignment.roles[seat] ?? "merkizen";
    const knowledge = buildPrivateKnowledge(seat, role, assignment, playerCount);
    const priv: MerkissionerPrivateState = {
      role,
      knownMerkites: knowledge.knownMerkites,
      knownBoss: knowledge.knownBoss,
      myVote: null,
      hand: null,
      auditResults: [],
      peek: null,
    };
    privateState[seat] = priv;
  }

  const secret = initialSecret();
  const pub: MerkissionerPublicState = {
    playerCount,
    board,
    merkizenEnacted: 0,
    merkiteEnacted: 0,
    gridlock: 0,
    drawCount: drawPileCount(secret),
    discardCount: discardPileCount(secret),
    readySeats: [],
    banishedSeats: [],
    auditedSeats: [],
    chairSeat: startChair,
    nomineeSeat: null,
    commissionerSeat: null,
    lastChairSeat: null,
    lastCommissionerSeat: null,
    rotationAnchorSeat: startChair,
    pendingSnapTarget: null,
    votedSeats: [],
    vetoRefusedThisSession: false,
    activePower: null,
    roundNumber: 0,
    lastVote: null,
    lastEnacted: null,
    lastAudit: null,
    lastPeekBy: null,
    lastSnap: null,
    lastBanish: null,
    anarchyCount: 0,
    winnerTeam: null,
    winReason: null,
    revealedRoles: null,
    _totals: {},
  };

  const settings = getSettings(ctx);
  const ms = 45 * 1000; // huddle is fixed regardless of pace
  return result(
    pub,
    privateState,
    secret,
    "huddle",
    [{ type: "match_started", payload: { playerCount, board } }],
    makeTimer(ctx, "huddle", ms, settings.timersEnabled)
  );
}

/* ------------------------------------------------------------------ */
/* Huddle                                                              */
/* ------------------------------------------------------------------ */

export function applyReadyUp(ctx: GameContext, state: GameStateIn, seat: SeatIndex): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const readySeats = pub.readySeats.includes(seat) ? pub.readySeats : [...pub.readySeats, seat];
  const nextPub: MerkissionerPublicState = { ...pub, readySeats };
  const events: GameEvent[] = [{ type: "huddle_ready", payload: { seat } }];

  if (nonAbandonedLiving(ctx, nextPub).every((s) => readySeats.includes(s))) {
    return beginFirstNominate(ctx, { ...state, publicState: nextPub }, events);
  }
  return result(nextPub, state.privateState, secretOf(state), "huddle", events, settings.timersEnabled ? undefined : null);
}

export function forceReadyAll(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = pubOf(state);
  const missing = allSeats(ctx).filter((s) => !pub.readySeats.includes(s));
  const nextPub: MerkissionerPublicState = { ...pub, readySeats: [...pub.readySeats, ...missing] };
  return beginFirstNominate(ctx, { ...state, publicState: nextPub }, [{ type: "huddle_timeout", payload: {} }]);
}

/* ------------------------------------------------------------------ */
/* Nominate rotation (shared by every path that starts a new government) */
/* ------------------------------------------------------------------ */

function enterNominate(
  ctx: GameContext,
  state: GameStateIn,
  chairSeat: SeatIndex,
  rotationAnchorSeat: SeatIndex,
  roundNumber: number,
  extraEvents: GameEvent[]
): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const nextPub: MerkissionerPublicState = {
    ...pub,
    chairSeat,
    rotationAnchorSeat,
    pendingSnapTarget: null,
    nomineeSeat: null,
    commissionerSeat: null,
    votedSeats: [],
    vetoRefusedThisSession: false,
    activePower: null,
    roundNumber,
  };
  const privateState: Partial<Record<SeatIndex, unknown>> = { ...state.privateState };
  for (const seat of livingSeats(ctx, nextPub)) {
    privateState[seat] = carryPrivate(state.privateState, seat, { myVote: null });
  }
  const ms = baseSeconds(settings.pace) * 1000;
  return result(
    nextPub,
    privateState,
    secretOf(state),
    "nominate",
    [...extraEvents, { type: "nominate_started", payload: { chairSeat, round: roundNumber } }],
    makeTimer(ctx, "nominate", ms, settings.timersEnabled)
  );
}

function beginFirstNominate(ctx: GameContext, state: GameStateIn, extraEvents: GameEvent[]): ReduceResult {
  const pub = pubOf(state);
  return enterNominate(ctx, state, pub.chairSeat, pub.rotationAnchorSeat, 1, extraEvents);
}

/** Chair rotation: consumes a pending Snap Election target if present, else advances clockwise from the anchor. */
function beginNominate(ctx: GameContext, state: GameStateIn, extraEvents: GameEvent[]): ReduceResult {
  const pub = pubOf(state);
  const usingSnap = pub.pendingSnapTarget !== null;
  const nextChair = usingSnap ? (pub.pendingSnapTarget as SeatIndex) : nextLivingSeat(ctx, pub, pub.rotationAnchorSeat);
  const nextAnchor = usingSnap ? pub.rotationAnchorSeat : nextChair;
  return enterNominate(ctx, state, nextChair, nextAnchor, pub.roundNumber + 1, extraEvents);
}

export function applyNominate(ctx: GameContext, state: GameStateIn, target: SeatIndex, auto: boolean): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const nextPub: MerkissionerPublicState = { ...pub, nomineeSeat: target };
  const ms = Math.round(baseSeconds(settings.pace) * 0.75) * 1000;
  return result(
    nextPub,
    state.privateState,
    secretOf(state),
    "vote",
    [{ type: "nominee_chosen", payload: { chairSeat: pub.chairSeat, nomineeSeat: target, auto } }],
    makeTimer(ctx, "vote", ms, settings.timersEnabled)
  );
}

/* ------------------------------------------------------------------ */
/* Vote                                                                 */
/* ------------------------------------------------------------------ */

export function applyCastVote(ctx: GameContext, state: GameStateIn, seat: SeatIndex, vote: Vote): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const votedSeats = pub.votedSeats.includes(seat) ? pub.votedSeats : [...pub.votedSeats, seat];
  const nextPub: MerkissionerPublicState = { ...pub, votedSeats };
  const seatPriv = carryPrivate(state.privateState, seat, { myVote: vote });
  const nextPrivMap = { ...state.privateState, [seat]: seatPriv };
  const events: GameEvent[] = [{ type: "vote_cast", payload: { seat } }];

  const stillWaiting = nonAbandonedLiving(ctx, nextPub).filter((s) => !votedSeats.includes(s));
  if (stillWaiting.length === 0) {
    return revealVoteNow(ctx, { ...state, publicState: nextPub, privateState: nextPrivMap }, events, false);
  }
  return result(
    nextPub,
    nextPrivMap,
    secretOf(state),
    "vote",
    events,
    settings.timersEnabled ? undefined : null
  );
}

export function forceResolveVote(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = pubOf(state);
  const privMap: Partial<Record<SeatIndex, unknown>> = { ...state.privateState };
  const votedSeats = [...pub.votedSeats];
  for (const seat of livingSeats(ctx, pub)) {
    const prior = (privMap[seat] as MerkissionerPrivateState | undefined)?.myVote;
    if (prior == null) {
      const vote: Vote = ctx.rng() < 0.5 ? "yeah" : "nah";
      privMap[seat] = carryPrivate(privMap, seat, { myVote: vote });
      if (!votedSeats.includes(seat)) votedSeats.push(seat);
    }
  }
  const nextPub: MerkissionerPublicState = { ...pub, votedSeats };
  return revealVoteNow(
    ctx,
    { ...state, publicState: nextPub, privateState: privMap },
    [{ type: "vote_timeout", payload: {} }],
    true
  );
}

/**
 * Called after a seat abandons mid-vote: if every remaining non-abandoned
 * seat has already voted, reveal now WITHOUT fabricating a vote for the
 * abandoned seat(s) — they are simply excluded from the tally (contract:
 * "no bot votes" for abandoned seats in the vote phase). Distinct from
 * `forceResolveVote`, which auto-casts rng votes for slow-but-connected
 * seats when the timer expires.
 */
export function checkVoteCompletionAfterAbandon(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = pubOf(state);
  if (!nonAbandonedLiving(ctx, pub).every((s) => pub.votedSeats.includes(s))) return null;
  return revealVoteNow(ctx, state, [], false);
}

function revealVoteNow(ctx: GameContext, state: GameStateIn, extraEvents: GameEvent[], auto: boolean): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const living = livingSeats(ctx, pub);
  let yeah = 0;
  let nah = 0;
  const votes: Partial<Record<SeatIndex, Vote>> = {};
  for (const seat of living) {
    const v = privOf(state, seat)?.myVote ?? null;
    if (v === "yeah") {
      yeah += 1;
      votes[seat] = v;
    } else if (v === "nah") {
      nah += 1;
      votes[seat] = v;
    }
  }
  const passed = yeah > nah;
  const chairSeat = pub.chairSeat;
  const nomineeSeat = pub.nomineeSeat as SeatIndex;
  const lastVote: LastVoteSummary = {
    chairSeat,
    nomineeSeat,
    tally: { yeah, nah },
    passed,
    votes: settings.revealVotes ? votes : null,
    auto,
  };
  const events: GameEvent[] = [
    ...extraEvents,
    { type: "vote_revealed", payload: { chairSeat, nomineeSeat, yeah, nah, passed } },
  ];

  if (passed) {
    const nomineeRole = privOf(state, nomineeSeat)?.role;
    const bossElected = nomineeRole === "merkissioner" && pub.merkiteEnacted >= 3;
    const votedPub: MerkissionerPublicState = {
      ...pub,
      lastVote,
      gridlock: 0,
      lastChairSeat: chairSeat,
      lastCommissionerSeat: nomineeSeat,
      commissionerSeat: nomineeSeat,
      nomineeSeat: null,
    };
    const votedState: GameStateIn = { ...state, publicState: votedPub };
    if (bossElected) {
      return buildGameOver(ctx, votedState, "merkite", "boss_elected", events);
    }
    return dealLegislativeHand(ctx, votedState, events);
  }

  const failedPub: MerkissionerPublicState = { ...pub, lastVote, nomineeSeat: null };
  return advanceAfterFailedOrVetoedTerm(ctx, { ...state, publicState: failedPub }, events);
}

function advanceAfterFailedOrVetoedTerm(ctx: GameContext, state: GameStateIn, extraEvents: GameEvent[]): ReduceResult {
  const pub = pubOf(state);
  const gridlock = pub.gridlock + 1;
  const nextPub: MerkissionerPublicState = { ...pub, gridlock };
  const nextState: GameStateIn = { ...state, publicState: nextPub };
  if (gridlock >= 3) {
    return triggerAnarchy(ctx, nextState, extraEvents);
  }
  return beginNominate(ctx, nextState, extraEvents);
}

function triggerAnarchy(ctx: GameContext, state: GameStateIn, extraEvents: GameEvent[]): ReduceResult {
  const pub = pubOf(state);
  const secret = secretOf(state);
  const { cards, secret: nextSecret } = drawCards(secret, 1, ctx.rng);
  const enacted: Decree = cards[0] ?? "merkizen";

  let nextPub = incrementTrack(pub, enacted);
  nextPub = {
    ...nextPub,
    gridlock: 0,
    lastChairSeat: null,
    lastCommissionerSeat: null,
    lastEnacted: { type: enacted, viaAnarchy: true, chairSeat: null, commissionerSeat: null },
    anarchyCount: pub.anarchyCount + 1,
    drawCount: drawPileCount(nextSecret),
    discardCount: discardPileCount(nextSecret),
  };
  const events: GameEvent[] = [...extraEvents, { type: "anarchy_triggered", payload: { type: enacted } }];
  const nextState: GameStateIn = { ...state, publicState: nextPub, secretState: nextSecret };

  if (nextPub.merkizenEnacted >= 5) {
    return buildGameOver(ctx, nextState, "merkizen", "merkizen_decrees", events);
  }
  if (nextPub.merkiteEnacted >= 6) {
    return buildGameOver(ctx, nextState, "merkite", "merkite_decrees", events);
  }
  return beginNominate(ctx, nextState, events);
}

/* ------------------------------------------------------------------ */
/* Legislative session                                                  */
/* ------------------------------------------------------------------ */

function dealLegislativeHand(ctx: GameContext, state: GameStateIn, extraEvents: GameEvent[]): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const { cards, secret: nextSecret } = drawCards(secretOf(state), 3, ctx.rng);
  const chairPriv = carryPrivate(state.privateState, pub.chairSeat, { hand: cards, peek: null });
  const nextPub: MerkissionerPublicState = {
    ...pub,
    drawCount: drawPileCount(nextSecret),
    discardCount: discardPileCount(nextSecret),
  };
  const ms = baseSeconds(settings.pace) * 1000;
  return result(
    nextPub,
    { ...state.privateState, [pub.chairSeat]: chairPriv },
    nextSecret,
    "legislative_chair",
    [...extraEvents, { type: "hand_dealt", payload: { chairSeat: pub.chairSeat } }],
    makeTimer(ctx, "legislative_chair", ms, settings.timersEnabled)
  );
}

export function applyDiscard(ctx: GameContext, state: GameStateIn, index: number, auto: boolean): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const hand = privOf(state, pub.chairSeat)?.hand ?? [];
  const discarded = hand[index] as Decree;
  const remaining = hand.filter((_, i) => i !== index);
  const nextSecret = discardCards(secretOf(state), [discarded]);

  const chairPriv = carryPrivate(state.privateState, pub.chairSeat, { hand: null });
  const commissionerSeat = pub.commissionerSeat as SeatIndex;
  const commPriv = carryPrivate(state.privateState, commissionerSeat, { hand: remaining });
  const nextPub: MerkissionerPublicState = {
    ...pub,
    drawCount: drawPileCount(nextSecret),
    discardCount: discardPileCount(nextSecret),
  };
  const ms = baseSeconds(settings.pace) * 1000;
  return result(
    nextPub,
    { ...state.privateState, [pub.chairSeat]: chairPriv, [commissionerSeat]: commPriv },
    nextSecret,
    "legislative_commissioner",
    [{ type: "decree_discarded", payload: { by: pub.chairSeat, auto } }],
    makeTimer(ctx, "legislative_commissioner", ms, settings.timersEnabled)
  );
}

export function applyEnact(ctx: GameContext, state: GameStateIn, index: number, auto: boolean): ReduceResult {
  const pub = pubOf(state);
  const commissionerSeat = pub.commissionerSeat as SeatIndex;
  const hand = privOf(state, commissionerSeat)?.hand ?? [];
  const enacted = hand[index] as Decree;
  const other = hand.filter((_, i) => i !== index);

  let nextSecret = discardCards(secretOf(state), other);
  nextSecret = checkReshuffle(nextSecret);

  let nextPub = incrementTrack(pub, enacted);
  nextPub = {
    ...nextPub,
    drawCount: drawPileCount(nextSecret),
    discardCount: discardPileCount(nextSecret),
    lastEnacted: { type: enacted, viaAnarchy: false, chairSeat: pub.chairSeat, commissionerSeat },
  };

  const chairPriv = carryPrivate(state.privateState, pub.chairSeat, { hand: null });
  const commPriv = carryPrivate(state.privateState, commissionerSeat, { hand: null });
  const nextPrivMap = { ...state.privateState, [pub.chairSeat]: chairPriv, [commissionerSeat]: commPriv };
  const events: GameEvent[] = [
    { type: "decree_enacted", payload: { type: enacted, chairSeat: pub.chairSeat, commissionerSeat, auto } },
  ];
  const nextState: GameStateIn = { publicState: nextPub, privateState: nextPrivMap, secretState: nextSecret, phase: state.phase };

  if (nextPub.merkizenEnacted >= 5) {
    return buildGameOver(ctx, nextState, "merkizen", "merkizen_decrees", events);
  }
  if (nextPub.merkiteEnacted >= 6) {
    return buildGameOver(ctx, nextState, "merkite", "merkite_decrees", events);
  }

  if (enacted === "merkite") {
    const power = powerForNthMerkite(pub.board, nextPub.merkiteEnacted);
    if (power !== null) {
      const settings = getSettings(ctx);
      const poweredPub: MerkissionerPublicState = { ...nextPub, activePower: power };
      const ms = baseSeconds(settings.pace) * 1000;
      return result(
        poweredPub,
        nextPrivMap,
        nextSecret,
        powerPhaseFor(power),
        [...events, { type: "power_triggered", payload: { power, chairSeat: pub.chairSeat } }],
        makeTimer(ctx, powerPhaseFor(power), ms, settings.timersEnabled)
      );
    }
  }

  return beginNominate(ctx, nextState, events);
}

export function applyProposeVeto(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const ms = Math.round(baseSeconds(settings.pace) * 0.5) * 1000;
  return result(
    pub,
    state.privateState,
    secretOf(state),
    "veto_pending",
    [{ type: "veto_proposed", payload: { commissionerSeat: pub.commissionerSeat } }],
    makeTimer(ctx, "veto_pending", ms, settings.timersEnabled)
  );
}

export function applyResolveVeto(ctx: GameContext, state: GameStateIn, agree: boolean, auto: boolean): ReduceResult {
  const pub = pubOf(state);
  const settings = getSettings(ctx);
  const commissionerSeat = pub.commissionerSeat as SeatIndex;

  if (!agree) {
    const nextPub: MerkissionerPublicState = { ...pub, vetoRefusedThisSession: true };
    const ms = baseSeconds(settings.pace) * 1000;
    return result(
      nextPub,
      state.privateState,
      secretOf(state),
      "legislative_commissioner",
      [{ type: "veto_refused", payload: { chairSeat: pub.chairSeat, auto } }],
      makeTimer(ctx, "legislative_commissioner", ms, settings.timersEnabled)
    );
  }

  const hand = privOf(state, commissionerSeat)?.hand ?? [];
  let nextSecret = discardCards(secretOf(state), hand);
  nextSecret = checkReshuffle(nextSecret);
  const chairPriv = carryPrivate(state.privateState, pub.chairSeat, { hand: null });
  const commPriv = carryPrivate(state.privateState, commissionerSeat, { hand: null });
  const nextPub: MerkissionerPublicState = {
    ...pub,
    drawCount: drawPileCount(nextSecret),
    discardCount: discardPileCount(nextSecret),
  };
  const nextState: GameStateIn = {
    publicState: nextPub,
    privateState: { ...state.privateState, [pub.chairSeat]: chairPriv, [commissionerSeat]: commPriv },
    secretState: nextSecret,
    phase: state.phase,
  };
  return advanceAfterFailedOrVetoedTerm(ctx, nextState, [
    { type: "veto_agreed", payload: { chairSeat: pub.chairSeat, commissionerSeat, auto } },
  ]);
}

/* ------------------------------------------------------------------ */
/* Powers                                                               */
/* ------------------------------------------------------------------ */

export function applyUsePower(
  ctx: GameContext,
  state: GameStateIn,
  target: SeatIndex | null,
  kind: PowerKind,
  auto: boolean
): ReduceResult {
  const pub = pubOf(state);

  if (kind === "audit") {
    const t = target as SeatIndex;
    const targetRole = privOf(state, t)?.role ?? "merkizen";
    const party: Team = teamOfRole(targetRole);
    const priorResults = privOf(state, pub.chairSeat)?.auditResults ?? [];
    const chairPriv = carryPrivate(state.privateState, pub.chairSeat, {
      auditResults: [...priorResults, { seat: t, party }],
    });
    const nextPub: MerkissionerPublicState = {
      ...pub,
      auditedSeats: [...pub.auditedSeats, t],
      activePower: null,
      lastAudit: { by: pub.chairSeat, target: t },
    };
    const nextState: GameStateIn = {
      ...state,
      publicState: nextPub,
      privateState: { ...state.privateState, [pub.chairSeat]: chairPriv },
    };
    return beginNominate(ctx, nextState, [
      { type: "power_resolved", payload: { power: "audit", by: pub.chairSeat, target: t, auto } },
    ]);
  }

  if (kind === "snap") {
    const t = target as SeatIndex;
    const nextPub: MerkissionerPublicState = {
      ...pub,
      activePower: null,
      pendingSnapTarget: t,
      lastSnap: { by: pub.chairSeat, target: t },
    };
    return beginNominate(ctx, { ...state, publicState: nextPub }, [
      { type: "power_resolved", payload: { power: "snap", by: pub.chairSeat, target: t, auto } },
    ]);
  }

  if (kind === "peek") {
    const { cards, secret: nextSecret } = peekCards(secretOf(state), 3, ctx.rng);
    const chairPriv = carryPrivate(state.privateState, pub.chairSeat, { peek: cards });
    const nextPub: MerkissionerPublicState = {
      ...pub,
      activePower: null,
      lastPeekBy: pub.chairSeat,
      drawCount: drawPileCount(nextSecret),
      discardCount: discardPileCount(nextSecret),
    };
    const nextState: GameStateIn = {
      publicState: nextPub,
      privateState: { ...state.privateState, [pub.chairSeat]: chairPriv },
      secretState: nextSecret,
      phase: state.phase,
    };
    return beginNominate(ctx, nextState, [
      { type: "power_resolved", payload: { power: "peek", by: pub.chairSeat, auto } },
    ]);
  }

  // banish
  const t = target as SeatIndex;
  const wasBoss = privOf(state, t)?.role === "merkissioner";
  const nextPub: MerkissionerPublicState = {
    ...pub,
    activePower: null,
    banishedSeats: [...pub.banishedSeats, t],
    lastBanish: { by: pub.chairSeat, target: t, wasBoss },
  };
  const events: GameEvent[] = [
    { type: "power_resolved", payload: { power: "banish", by: pub.chairSeat, target: t, auto } },
  ];
  const nextState: GameStateIn = { ...state, publicState: nextPub };
  if (wasBoss) {
    return buildGameOver(ctx, nextState, "merkizen", "boss_banished", events);
  }
  return beginNominate(ctx, nextState, events);
}

/* ------------------------------------------------------------------ */
/* Game over                                                           */
/* ------------------------------------------------------------------ */

function buildGameOver(
  ctx: GameContext,
  state: GameStateIn,
  winnerTeam: Team,
  winReason: WinReason,
  extraEvents: GameEvent[]
): ReduceResult {
  const pub = pubOf(state);
  const revealedRoles: Partial<Record<SeatIndex, Role>> = {};
  const totals: Partial<Record<SeatIndex, number>> = {};
  for (const seat of allSeats(ctx)) {
    const role = privOf(state, seat)?.role ?? "merkizen";
    revealedRoles[seat] = role;
    totals[seat] = teamOfRole(role) === winnerTeam ? 100 : 0;
  }
  const nextPub: MerkissionerPublicState = {
    ...pub,
    winnerTeam,
    winReason,
    revealedRoles,
    activePower: null,
    _totals: totals,
  };
  return result(
    nextPub,
    state.privateState,
    secretOf(state),
    "game_over",
    [...extraEvents, { type: "game_over", payload: { winnerTeam, winReason } }],
    null,
    { scores: totals, matchOver: true }
  );
}
