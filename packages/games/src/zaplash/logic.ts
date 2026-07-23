import type {
  GameContext,
  GameAction,
  GameStateIn,
  GameEvent,
  ReduceResult,
  ReduceError,
  SeatIndex,
} from "@merky/game-sdk";
import { ZAPLASH_CORE_PROMPTS, ZAPLASH_SAFETY_QUIPS } from "./packs";

export interface PromptAssignment {
  promptIndex: number;
  promptText: string;
  writers: [SeatIndex, SeatIndex];
}

export interface MatchupAnswer {
  text: string;
  writerSeat?: SeatIndex;
}

export interface MatchupState {
  promptIndex: number;
  promptText: string;
  answers: MatchupAnswer[];
  writers: [SeatIndex, SeatIndex];
  votedSeats: SeatIndex[];
  votesPerAnswer?: [number, number];
  pointsAwarded?: [number, number];
  zapSeat?: SeatIndex | null;
  /** Both writers submitted the exact same text (case/whitespace-insensitive) — 0 points, no vote. */
  jinx?: boolean;
}

/**
 * The client-visible projection of a matchup. `writers` (which seat authored
 * `answers[0]` vs `answers[1]`) must never reach any client before the vote
 * is locked in — that ordered mapping is exactly what anonymous voting is
 * meant to hide. `excludedSeats` is the same two seats, sorted independently
 * of answer order, so it can safely drive "who can't vote here" UI without
 * leaking which answer either of them wrote. Authorship is only ever
 * revealed the intended way: `answers[i].writerSeat`, populated at reveal.
 */
export type PublicMatchupState = Omit<MatchupState, "writers"> & {
  excludedSeats: SeatIndex[];
};

function toPublicMatchup(m: MatchupState): PublicMatchupState {
  const { writers, ...rest } = m;
  return { ...rest, excludedSeats: [...writers].sort((a, b) => a - b) };
}

export interface FinaleAnswer {
  seat: SeatIndex;
  text: string;
}

export interface FinaleResult {
  seat: SeatIndex;
  text: string;
  votes: number;
  /** 0-indexed placement; tied vote counts share a rank. */
  rank: number;
  points: number;
}

export interface FinaleState {
  promptText: string;
  submittedSeats: SeatIndex[];
  /** Populated once writing closes — shuffled, missing/blank answers dropped. */
  answers: FinaleAnswer[];
  votedSeats: SeatIndex[];
  /** voterSeat -> targetSeat */
  votes: Record<number, SeatIndex>;
  results: FinaleResult[] | null;
}

export interface ZaplashPublicState {
  round: number;
  totalRounds: number;
  submittedSeats: SeatIndex[];
  currentMatchupIndex: number;
  totalMatchups: number;
  currentMatchup: PublicMatchupState | null;
  /** Running cumulative totals — the platform's scores contract needs totals,
   * and reduce never receives prior scores, so the game carries its own. */
  _totals: Partial<Record<SeatIndex, number>>;
  /** The climactic final round, once the last regular round's scoreboard has passed. */
  finale: FinaleState | null;
}

export interface ZaplashPrivateState {
  prompts: Array<{ index: number; text: string }>;
  answers: Record<number, string>;
  finaleAnswer?: string;
}

/**
 * Server-only round bookkeeping. `roundMatchups` and `roundPrompts` carry
 * real writer-seat identities and must never be sent to any client — see
 * `PublicMatchupState`. `roundVotes` holds each seat's live vote choice
 * (which of the two answers), which must also stay hidden until reveal so
 * later voters can't see a running tally and follow the crowd.
 */
export interface ZaplashSecret {
  promptPool: string[];
  usedPrompts: string[];
  roundPrompts: PromptAssignment[];
  roundMatchups: MatchupState[];
  roundVotes: Record<number, Record<number, 0 | 1>>;
}

export interface ZaplashSettings {
  rounds: number;
  writeSeconds: number;
  voteSeconds: number;
  zapBonus: boolean;
  packId: string;
  lightningRound: boolean;
}

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

export function getSettings(ctx: GameContext): ZaplashSettings {
  return {
    rounds: typeof ctx.settings.rounds === "number" ? ctx.settings.rounds : 2,
    writeSeconds: typeof ctx.settings.writeSeconds === "number" ? ctx.settings.writeSeconds : 90,
    voteSeconds: typeof ctx.settings.voteSeconds === "number" ? ctx.settings.voteSeconds : 25,
    zapBonus: Boolean(ctx.settings.zapBonus ?? true),
    packId: typeof ctx.settings.packId === "string" ? ctx.settings.packId : "zaplash-core",
    lightningRound: Boolean(ctx.settings.lightningRound ?? true),
  };
}

function getPromptPool(ctx: GameContext): string[] {
  const pack = ctx.settings._pack as { payload?: { prompts?: string[] } } | undefined;
  const prompts = pack?.payload?.prompts;
  if (Array.isArray(prompts) && prompts.length > 0) {
    return prompts;
  }
  return ZAPLASH_CORE_PROMPTS;
}

function pickSafetyQuip(ctx: GameContext): string {
  const idx = Math.floor(ctx.rng() * ZAPLASH_SAFETY_QUIPS.length);
  return ZAPLASH_SAFETY_QUIPS[idx] ?? ZAPLASH_SAFETY_QUIPS[0]!;
}

function activeSeatsOf(ctx: GameContext): SeatIndex[] {
  return ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
}

function startRound(
  ctx: GameContext,
  round: number,
  totalRounds: number,
  existingPool: string[],
  existingUsed: string[],
  carriedTotals: Partial<Record<SeatIndex, number>>
): ReduceResult {
  const settings = getSettings(ctx);
  const activeSeats = activeSeatsOf(ctx);
  const N = activeSeats.length;

  let pool = [...existingPool];
  let used = [...existingUsed];

  if (pool.length === 0) {
    pool = getPromptPool(ctx);
  }

  if (pool.length < N) {
    const fresh = getPromptPool(ctx);
    pool = [...pool, ...shuffle(fresh, ctx.rng)];
  }

  const shuffledPool = shuffle(pool, ctx.rng);
  const chosenPrompts = shuffledPool.slice(0, N);
  const remainingPool = shuffledPool.slice(N);
  used = [...used, ...chosenPrompts];

  const roundPrompts: PromptAssignment[] = [];
  const privateState: Partial<Record<SeatIndex, ZaplashPrivateState>> = {};

  for (let i = 0; i < N; i++) {
    const pText = chosenPrompts[i] ?? `Prompt ${i + 1}`;
    const writer0 = activeSeats[i] ?? 0;
    const writer1 = activeSeats[(i + 1) % N] ?? 0;
    roundPrompts.push({
      promptIndex: i,
      promptText: pText,
      writers: [writer0, writer1],
    });
  }

  for (let i = 0; i < N; i++) {
    const seat = activeSeats[i]!;
    const p1 = roundPrompts[i]!;
    const p2Idx = (i - 1 + N) % N;
    const p2 = roundPrompts[p2Idx]!;
    privateState[seat] = {
      prompts: [
        { index: p1.promptIndex, text: p1.promptText },
        { index: p2.promptIndex, text: p2.promptText },
      ],
      answers: {},
    };
  }

  const publicState: ZaplashPublicState = {
    round,
    totalRounds,
    submittedSeats: [],
    currentMatchupIndex: 0,
    totalMatchups: 0,
    currentMatchup: null,
    _totals: carriedTotals,
    finale: null,
  };

  const secretState: ZaplashSecret = {
    promptPool: remainingPool,
    usedPrompts: used,
    roundPrompts,
    roundMatchups: [],
    roundVotes: {},
  };

  const writeMs = settings.writeSeconds * 1000;

  return {
    publicState,
    privateState,
    secretState,
    phase: "write",
    scores: carriedTotals,
    events: [{ type: "round_started", payload: { round } }],
    timer: { endsAt: ctx.now + writeMs, kind: "write", durationMs: writeMs },
  };
}

export function initZaplash(ctx: GameContext): ReduceResult {
  const settings = getSettings(ctx);
  const initialPool = shuffle(getPromptPool(ctx), ctx.rng);
  return startRound(ctx, 1, settings.rounds, initialPool, [], {});
}

function applyWriteAnswer(
  ctx: GameContext,
  state: GameStateIn,
  pub: ZaplashPublicState,
  seat: SeatIndex,
  promptIndex: number,
  text: string
): ReduceResult {
  const priv = (state.privateState[seat] as ZaplashPrivateState | undefined) ?? {
    prompts: [],
    answers: {},
  };
  const newAnswers = { ...priv.answers, [promptIndex]: text };
  const newPriv: ZaplashPrivateState = { ...priv, answers: newAnswers };

  const finishedBoth = priv.prompts.length > 0 && priv.prompts.every((p) => newAnswers[p.index] !== undefined);
  const newSubmitted = [...pub.submittedSeats];
  if (finishedBoth && !newSubmitted.includes(seat)) {
    newSubmitted.push(seat);
  }

  const updatedPrivateState = { ...state.privateState, [seat]: newPriv };
  const activeSeats = activeSeatsOf(ctx);
  const allDone = activeSeats.every((s) => newSubmitted.includes(s));

  const nextPub: ZaplashPublicState = {
    ...pub,
    submittedSeats: newSubmitted,
  };

  if (allDone) {
    return advanceToVote(ctx, { ...state, publicState: nextPub, privateState: updatedPrivateState });
  }

  return {
    publicState: nextPub,
    privateState: { [seat]: newPriv },
    phase: "write",
    events: [{ type: "answer_submitted", payload: { seat, promptIndex } }],
  };
}

function buildMatchups(
  ctx: GameContext,
  roundPrompts: PromptAssignment[],
  privateStateMap: Partial<Record<SeatIndex, unknown>>
): MatchupState[] {
  const activeSeats = activeSeatsOf(ctx);
  const matchups: MatchupState[] = [];
  const norm = (s: string) => s.trim().toLowerCase();

  for (const pa of roundPrompts) {
    const [w0, w1] = pa.writers;
    const p0Priv = (privateStateMap[w0] as ZaplashPrivateState | undefined)?.answers?.[pa.promptIndex];
    const p1Priv = (privateStateMap[w1] as ZaplashPrivateState | undefined)?.answers?.[pa.promptIndex];

    const text0 = p0Priv && p0Priv.trim().length > 0 ? p0Priv.trim() : "…";
    const text1 = p1Priv && p1Priv.trim().length > 0 ? p1Priv.trim() : "…";

    if (text0 === "…" && text1 === "…") {
      continue;
    }

    const eligible = activeSeats.filter((s) => s !== w0 && s !== w1);
    if (eligible.length === 0) {
      continue;
    }

    const isJinx = text0 !== "…" && text1 !== "…" && norm(text0) === norm(text1);

    const order = ctx.rng() < 0.5 ? [0, 1] : [1, 0];
    const firstIdx = order[0]!;
    const secondIdx = order[1]!;

    const firstWriter = firstIdx === 0 ? w0 : w1;
    const secondWriter = secondIdx === 0 ? w0 : w1;
    const firstText = firstIdx === 0 ? text0 : text1;
    const secondText = secondIdx === 0 ? text0 : text1;

    matchups.push({
      promptIndex: pa.promptIndex,
      promptText: pa.promptText,
      answers: [{ text: firstText }, { text: secondText }],
      writers: [firstWriter, secondWriter],
      votedSeats: [],
      jinx: isJinx,
    });
  }

  return matchups;
}

function revealJinx(
  ctx: GameContext,
  pub: ZaplashPublicState,
  secret: ZaplashSecret,
  matchups: MatchupState[],
  matchupIdx: number
): ReduceResult {
  const current = matchups[matchupIdx]!;
  const [w0, w1] = current.writers;

  const revealMatchup: PublicMatchupState = {
    ...toPublicMatchup(current),
    answers: [
      { text: current.answers[0]?.text ?? "", writerSeat: w0 },
      { text: current.answers[1]?.text ?? "", writerSeat: w1 },
    ],
    votesPerAnswer: [0, 0],
    pointsAwarded: [0, 0],
    zapSeat: null,
  };

  const revealPub: ZaplashPublicState = {
    ...pub,
    currentMatchupIndex: matchupIdx,
    totalMatchups: matchups.length,
    currentMatchup: revealMatchup,
  };

  const revealMs = 6000;

  return {
    publicState: revealPub,
    secretState: { ...secret, roundMatchups: matchups } satisfies ZaplashSecret,
    phase: "reveal",
    scores: pub._totals,
    events: [{ type: "jinx", payload: { matchupIndex: matchupIdx } }],
    timer: { endsAt: ctx.now + revealMs, kind: "reveal", durationMs: revealMs },
  };
}

function startNextMatchup(
  ctx: GameContext,
  pub: ZaplashPublicState,
  secret: ZaplashSecret,
  matchups: MatchupState[],
  matchupIdx: number
): ReduceResult {
  const settings = getSettings(ctx);

  if (matchupIdx >= matchups.length) {
    const scoreboardMs = 7000;
    return {
      publicState: {
        ...pub,
        currentMatchupIndex: matchups.length,
        totalMatchups: matchups.length,
        currentMatchup: null,
      },
      secretState: { ...secret, roundMatchups: matchups } satisfies ZaplashSecret,
      phase: "scoreboard",
      scores: pub._totals,
      events: [{ type: "scoreboard" }],
      timer: { endsAt: ctx.now + scoreboardMs, kind: "scoreboard", durationMs: scoreboardMs },
    };
  }

  const current = matchups[matchupIdx]!;

  if (current.jinx) {
    return revealJinx(ctx, pub, secret, matchups, matchupIdx);
  }

  const voteMs = settings.voteSeconds * 1000;

  const voteMatchupPublic: PublicMatchupState = {
    ...toPublicMatchup(current),
    answers: current.answers.map((a) => ({ text: a.text })),
  };

  const nextPub: ZaplashPublicState = {
    ...pub,
    currentMatchupIndex: matchupIdx,
    totalMatchups: matchups.length,
    currentMatchup: voteMatchupPublic,
  };

  return {
    publicState: nextPub,
    secretState: { ...secret, roundMatchups: matchups } satisfies ZaplashSecret,
    phase: "vote",
    events: [{ type: "matchup_started", payload: { matchupIndex: matchupIdx } }],
    timer: { endsAt: ctx.now + voteMs, kind: "vote", durationMs: voteMs },
  };
}

function advanceToVote(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = state.publicState as ZaplashPublicState;
  const secret = state.secretState as ZaplashSecret;
  const matchups = buildMatchups(ctx, secret.roundPrompts, state.privateState);
  return startNextMatchup(ctx, pub, secret, matchups, 0);
}

function startReveal(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = state.publicState as ZaplashPublicState;
  const secret = state.secretState as ZaplashSecret;
  const settings = getSettings(ctx);
  const mIdx = pub.currentMatchupIndex;
  const matchup = secret.roundMatchups[mIdx];

  if (!pub.currentMatchup || !matchup) {
    return startNextMatchup(ctx, pub, secret, secret.roundMatchups, mIdx + 1);
  }

  const votesObj = secret.roundVotes[mIdx] ?? {};

  let votes0 = 0;
  let votes1 = 0;
  for (const v of Object.values(votesObj)) {
    if (v === 0) votes0++;
    if (v === 1) votes1++;
  }

  let pts0 = votes0 * 100;
  let pts1 = votes1 * 100;

  let zapSeat: SeatIndex | null = null;
  const totalVotes = votes0 + votes1;

  if (settings.zapBonus && totalVotes >= 2) {
    if (votes0 === totalVotes && votes1 === 0) {
      zapSeat = matchup.writers[0];
      pts0 += 50;
    } else if (votes1 === totalVotes && votes0 === 0) {
      zapSeat = matchup.writers[1];
      pts1 += 50;
    }
  }

  const updatedScores: Partial<Record<SeatIndex, number>> = { ...(pub._totals ?? {}) };
  const w0 = matchup.writers[0];
  const w1 = matchup.writers[1];

  updatedScores[w0] = (updatedScores[w0] ?? 0) + pts0;
  updatedScores[w1] = (updatedScores[w1] ?? 0) + pts1;

  const revealMatchup: PublicMatchupState = {
    ...toPublicMatchup(matchup),
    answers: [
      { text: matchup.answers[0]?.text ?? "", writerSeat: w0 },
      { text: matchup.answers[1]?.text ?? "", writerSeat: w1 },
    ],
    votesPerAnswer: [votes0, votes1],
    pointsAwarded: [pts0, pts1],
    zapSeat,
  };

  const revealPub: ZaplashPublicState = {
    ...pub,
    currentMatchup: revealMatchup,
    _totals: updatedScores,
  };

  const events: GameEvent[] = [{ type: "reveal", payload: { matchupIndex: mIdx } }];
  if (zapSeat !== null) {
    events.push({ type: "zap", payload: { seat: zapSeat } });
  }

  const revealMs = 6000;

  return {
    publicState: revealPub,
    phase: "reveal",
    scores: updatedScores,
    events,
    timer: { endsAt: ctx.now + revealMs, kind: "reveal", durationMs: revealMs },
  };
}

/* ------------------------------------------------------------------ */
/* Lightning Round — the climactic finale after the last regular round */
/* ------------------------------------------------------------------ */

function finishMatch(pub: ZaplashPublicState): ReduceResult {
  return {
    publicState: pub,
    phase: "game_over",
    scores: pub._totals,
    events: [{ type: "game_over" }],
    timer: null,
    matchOver: true,
  };
}

function startFinaleWrite(
  ctx: GameContext,
  pub: ZaplashPublicState,
  secret: ZaplashSecret
): ReduceResult | null {
  const settings = getSettings(ctx);
  const activeSeats = activeSeatsOf(ctx);
  if (activeSeats.length < 2) return null;

  let pool = [...secret.promptPool];
  if (pool.length === 0) {
    pool = shuffle(getPromptPool(ctx), ctx.rng);
  }
  const shuffledPool = shuffle(pool, ctx.rng);
  const promptText = shuffledPool[0] ?? "The worst possible thing to say right now: _____";
  const remainingPool = shuffledPool.slice(1);
  const used = [...secret.usedPrompts, promptText];

  const finale: FinaleState = {
    promptText,
    submittedSeats: [],
    answers: [],
    votedSeats: [],
    votes: {},
    results: null,
  };

  const writeMs = settings.writeSeconds * 1000;

  return {
    publicState: {
      ...pub,
      finale,
    },
    secretState: { ...secret, promptPool: remainingPool, usedPrompts: used } satisfies ZaplashSecret,
    phase: "finale_write",
    scores: pub._totals,
    events: [{ type: "finale_started" }],
    timer: { endsAt: ctx.now + writeMs, kind: "finale_write", durationMs: writeMs },
  };
}

function finalizeFinaleAnswer(
  ctx: GameContext,
  state: GameStateIn,
  pub: ZaplashPublicState,
  seat: SeatIndex,
  text: string
): ReduceResult {
  const finale = pub.finale!;
  const priv = (state.privateState[seat] as ZaplashPrivateState | undefined) ?? {
    prompts: [],
    answers: {},
  };
  const newPriv: ZaplashPrivateState = { ...priv, finaleAnswer: text };

  const newSubmitted = finale.submittedSeats.includes(seat)
    ? finale.submittedSeats
    : [...finale.submittedSeats, seat];
  const nextFinale: FinaleState = { ...finale, submittedSeats: newSubmitted };
  const nextPub: ZaplashPublicState = { ...pub, finale: nextFinale };

  const updatedPrivateState = { ...state.privateState, [seat]: newPriv };
  const activeSeats = activeSeatsOf(ctx);
  const allDone = activeSeats.every((s) => newSubmitted.includes(s));

  if (allDone) {
    return advanceToFinaleVote(ctx, { ...state, publicState: nextPub, privateState: updatedPrivateState });
  }

  return {
    publicState: nextPub,
    privateState: { [seat]: newPriv },
    phase: "finale_write",
    events: [{ type: "finale_answer_submitted", payload: { seat } }],
  };
}

function advanceToFinaleVote(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = state.publicState as ZaplashPublicState;
  const finale = pub.finale!;
  const settings = getSettings(ctx);
  const activeSeats = activeSeatsOf(ctx);

  const rawEntries: FinaleAnswer[] = [];
  for (const seat of activeSeats) {
    const priv = state.privateState[seat] as ZaplashPrivateState | undefined;
    const text = priv?.finaleAnswer?.trim();
    if (text && text.length > 0) {
      rawEntries.push({ seat, text });
    }
  }
  const shuffledEntries = shuffle(rawEntries, ctx.rng);

  if (shuffledEntries.length < 2) {
    const nextFinale: FinaleState = { ...finale, answers: shuffledEntries };
    return finaleReveal(ctx, { ...state, publicState: { ...pub, finale: nextFinale } });
  }

  const nextFinale: FinaleState = { ...finale, answers: shuffledEntries };
  const nextPub: ZaplashPublicState = { ...pub, finale: nextFinale };
  const voteMs = settings.voteSeconds * 1000;

  return {
    publicState: nextPub,
    phase: "finale_vote",
    events: [{ type: "finale_voting_started" }],
    timer: { endsAt: ctx.now + voteMs, kind: "finale_vote", durationMs: voteMs },
  };
}

function finaleReveal(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = state.publicState as ZaplashPublicState;
  const finale = pub.finale!;

  const counts: Record<number, number> = {};
  for (const target of Object.values(finale.votes)) {
    counts[target] = (counts[target] ?? 0) + 1;
  }

  const awardMedals = finale.answers.length >= 2;
  const medalBonus = [500, 300, 150];

  const withVotes = finale.answers.map((a) => ({ seat: a.seat, text: a.text, votes: counts[a.seat] ?? 0 }));
  const sorted = [...withVotes].sort((a, b) => b.votes - a.votes || a.seat - b.seat);

  const results: FinaleResult[] = [];
  const updatedScores: Partial<Record<SeatIndex, number>> = { ...(pub._totals ?? {}) };

  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    if (i > 0 && sorted[i - 1]!.votes !== entry.votes) {
      rank = i;
    }
    const bonus = awardMedals && rank < 3 ? medalBonus[rank]! : 0;
    const points = entry.votes * 100 + bonus;
    results.push({ seat: entry.seat, text: entry.text, votes: entry.votes, rank, points });
    updatedScores[entry.seat] = (updatedScores[entry.seat] ?? 0) + points;
  }

  const nextFinale: FinaleState = { ...finale, results };
  const nextPub: ZaplashPublicState = { ...pub, finale: nextFinale, _totals: updatedScores };

  const events: GameEvent[] = [{ type: "finale_reveal" }];
  const winner = results.find((r) => r.rank === 0);
  if (winner && winner.points > 0) {
    events.push({ type: "finale_winner", payload: { seat: winner.seat } });
  }

  const revealMs = 9000;

  return {
    publicState: nextPub,
    phase: "finale_reveal",
    scores: updatedScores,
    events,
    timer: { endsAt: ctx.now + revealMs, kind: "finale_reveal", durationMs: revealMs },
  };
}

export function reduceZaplash(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = state.publicState as ZaplashPublicState | null;
  if (!pub) return { error: "State not initialized", code: "invalid_state" };

  if (action.type === "submit_answer") {
    if (state.phase !== "write") {
      return { error: "Not in write phase", code: "bad_phase" };
    }

    const payload = action.payload as { promptIndex?: number; text?: string } | undefined;
    const promptIndex = payload?.promptIndex;
    const text = payload?.text;

    if (typeof promptIndex !== "number") {
      return { error: "Prompt index required", code: "bad_prompt" };
    }

    const seat = action.seat as SeatIndex;
    const priv = (state.privateState[seat] as ZaplashPrivateState | undefined) ?? {
      prompts: [],
      answers: {},
    };

    const assigned = priv.prompts.some((p) => p.index === promptIndex);
    if (!assigned) {
      return { error: "Not your prompt", code: "not_your_prompt" };
    }

    if (priv.answers[promptIndex] !== undefined) {
      return { error: "Already submitted answer for this prompt", code: "already_submitted" };
    }

    const trimmed = (text ?? "").trim();
    if (trimmed.length === 0) {
      return { error: "Answer cannot be empty", code: "empty_answer" };
    }
    if (trimmed.length > 120) {
      return { error: "Answer must be 120 characters or fewer", code: "too_long" };
    }

    return applyWriteAnswer(ctx, state, pub, seat, promptIndex, trimmed);
  }

  if (action.type === "use_safety_quip") {
    if (state.phase !== "write") {
      return { error: "Not in write phase", code: "bad_phase" };
    }

    const payload = action.payload as { promptIndex?: number } | undefined;
    const promptIndex = payload?.promptIndex;
    if (typeof promptIndex !== "number") {
      return { error: "Prompt index required", code: "bad_prompt" };
    }

    const seat = action.seat as SeatIndex;
    const priv = (state.privateState[seat] as ZaplashPrivateState | undefined) ?? {
      prompts: [],
      answers: {},
    };

    const assigned = priv.prompts.some((p) => p.index === promptIndex);
    if (!assigned) {
      return { error: "Not your prompt", code: "not_your_prompt" };
    }

    if (priv.answers[promptIndex] !== undefined) {
      return { error: "Already submitted answer for this prompt", code: "already_submitted" };
    }

    return applyWriteAnswer(ctx, state, pub, seat, promptIndex, pickSafetyQuip(ctx));
  }

  if (action.type === "vote") {
    if (state.phase !== "vote") {
      return { error: "Not in vote phase", code: "bad_phase" };
    }

    const matchup = pub.currentMatchup;
    if (!matchup) {
      return { error: "No active matchup", code: "no_matchup" };
    }

    const secret = state.secretState as ZaplashSecret;
    const seat = action.seat as SeatIndex;

    const seatObj = ctx.seats.find((s) => s.seatIndex === seat);
    if (seatObj?.abandoned || matchup.excludedSeats.includes(seat)) {
      return { error: "Writers cannot vote on their own matchup", code: "not_eligible" };
    }

    if (matchup.votedSeats.includes(seat)) {
      return { error: "Already voted in this matchup", code: "already_voted" };
    }

    const payload = action.payload as { answerIndex?: number } | undefined;
    const ansIdx = payload?.answerIndex;
    if (ansIdx !== 0 && ansIdx !== 1) {
      return { error: "Invalid answer choice", code: "invalid_choice" };
    }

    const mIdx = pub.currentMatchupIndex;
    const currentVotes = secret.roundVotes[mIdx] ?? {};
    const newVotes: Record<number, 0 | 1> = { ...currentVotes, [seat]: ansIdx };
    const newVotedSeats = [...matchup.votedSeats, seat];

    const nextMatchup: PublicMatchupState = {
      ...matchup,
      votedSeats: newVotedSeats,
    };

    const nextPub: ZaplashPublicState = {
      ...pub,
      currentMatchup: nextMatchup,
    };

    const nextSecret: ZaplashSecret = {
      ...secret,
      roundVotes: {
        ...secret.roundVotes,
        [mIdx]: newVotes,
      },
    };

    const activeSeats = activeSeatsOf(ctx);
    const eligibleVoters = activeSeats.filter((s) => !matchup.excludedSeats.includes(s));
    const allVoted = eligibleVoters.every((s) => newVotedSeats.includes(s));

    if (allVoted) {
      return startReveal(ctx, { ...state, publicState: nextPub, secretState: nextSecret });
    }

    return {
      publicState: nextPub,
      secretState: nextSecret,
      phase: "vote",
      events: [{ type: "voted", payload: { seat } }],
    };
  }

  if (action.type === "submit_finale_answer") {
    if (state.phase !== "finale_write") {
      return { error: "Not in finale writing phase", code: "bad_phase" };
    }
    if (!pub.finale) {
      return { error: "No active finale", code: "no_finale" };
    }

    const seat = action.seat as SeatIndex;
    if (pub.finale.submittedSeats.includes(seat)) {
      return { error: "Already submitted", code: "already_submitted" };
    }

    const payload = action.payload as { text?: string } | undefined;
    const trimmed = (payload?.text ?? "").trim();
    if (trimmed.length === 0) {
      return { error: "Answer cannot be empty", code: "empty_answer" };
    }
    if (trimmed.length > 120) {
      return { error: "Answer must be 120 characters or fewer", code: "too_long" };
    }

    return finalizeFinaleAnswer(ctx, state, pub, seat, trimmed);
  }

  if (action.type === "use_finale_safety_quip") {
    if (state.phase !== "finale_write") {
      return { error: "Not in finale writing phase", code: "bad_phase" };
    }
    if (!pub.finale) {
      return { error: "No active finale", code: "no_finale" };
    }

    const seat = action.seat as SeatIndex;
    if (pub.finale.submittedSeats.includes(seat)) {
      return { error: "Already submitted", code: "already_submitted" };
    }

    return finalizeFinaleAnswer(ctx, state, pub, seat, pickSafetyQuip(ctx));
  }

  if (action.type === "finale_vote") {
    if (state.phase !== "finale_vote") {
      return { error: "Not in finale voting phase", code: "bad_phase" };
    }
    if (!pub.finale) {
      return { error: "No active finale", code: "no_finale" };
    }

    const seat = action.seat as SeatIndex;
    const seatObj = ctx.seats.find((s) => s.seatIndex === seat);
    if (seatObj?.abandoned) {
      return { error: "Not eligible to vote", code: "not_eligible" };
    }
    if (pub.finale.votedSeats.includes(seat)) {
      return { error: "Already voted", code: "already_voted" };
    }

    const payload = action.payload as { targetSeat?: number } | undefined;
    const targetSeat = payload?.targetSeat;
    if (typeof targetSeat !== "number") {
      return { error: "Invalid vote target", code: "invalid_choice" };
    }
    if (targetSeat === seat) {
      return { error: "Cannot vote for yourself", code: "self_vote" };
    }
    const targetEntry = pub.finale.answers.find((a) => a.seat === targetSeat);
    if (!targetEntry) {
      return { error: "Invalid vote target", code: "invalid_choice" };
    }

    const newVotes: Record<number, SeatIndex> = { ...pub.finale.votes, [seat]: targetSeat as SeatIndex };
    const newVotedSeats = [...pub.finale.votedSeats, seat];
    const nextFinale: FinaleState = { ...pub.finale, votes: newVotes, votedSeats: newVotedSeats };
    const nextPub: ZaplashPublicState = { ...pub, finale: nextFinale };

    const activeSeats = activeSeatsOf(ctx);
    const allVoted = activeSeats.every((s) => newVotedSeats.includes(s));

    if (allVoted) {
      return finaleReveal(ctx, { ...state, publicState: nextPub });
    }

    return {
      publicState: nextPub,
      phase: "finale_vote",
      events: [{ type: "finale_voted", payload: { seat } }],
    };
  }

  return { error: "Unknown action type", code: "unknown_action" };
}

export function onTickZaplash(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as ZaplashPublicState | null;
  if (!pub) return null;
  const secret = state.secretState as ZaplashSecret | undefined;

  if (state.phase === "write") {
    return advanceToVote(ctx, state);
  }

  if (state.phase === "vote") {
    return startReveal(ctx, state);
  }

  if (state.phase === "reveal" && secret) {
    const nextIdx = pub.currentMatchupIndex + 1;
    return startNextMatchup(ctx, pub, secret, secret.roundMatchups, nextIdx);
  }

  if (state.phase === "scoreboard" && secret) {
    const settings = getSettings(ctx);
    if (pub.round < settings.rounds) {
      return startRound(
        ctx,
        pub.round + 1,
        settings.rounds,
        secret.promptPool,
        secret.usedPrompts,
        pub._totals ?? {}
      );
    }
    if (settings.lightningRound) {
      const finaleResult = startFinaleWrite(ctx, pub, secret);
      if (finaleResult) return finaleResult;
    }
    return finishMatch(pub);
  }

  if (state.phase === "finale_write") {
    return advanceToFinaleVote(ctx, state);
  }

  if (state.phase === "finale_vote") {
    return finaleReveal(ctx, state);
  }

  if (state.phase === "finale_reveal") {
    return finishMatch(pub);
  }

  return null;
}

export function awaitedSeatsZaplash(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as ZaplashPublicState | null;
  if (!pub) return [];

  const activeSeats = activeSeatsOf(ctx);

  if (state.phase === "write") {
    return activeSeats.filter((s) => !pub.submittedSeats.includes(s));
  }

  if (state.phase === "vote" && pub.currentMatchup) {
    const excluded = pub.currentMatchup.excludedSeats;
    const eligible = activeSeats.filter((s) => !excluded.includes(s));
    return eligible.filter((s) => !pub.currentMatchup!.votedSeats.includes(s));
  }

  if (state.phase === "finale_write" && pub.finale) {
    return activeSeats.filter((s) => !pub.finale!.submittedSeats.includes(s));
  }

  if (state.phase === "finale_vote" && pub.finale) {
    return activeSeats.filter((s) => !pub.finale!.votedSeats.includes(s));
  }

  return [];
}

export function onSeatAbandonedZaplash(
  ctx: GameContext,
  state: GameStateIn,
  _seat: SeatIndex
): ReduceResult | null {
  const pub = state.publicState as ZaplashPublicState | null;
  if (!pub) return null;

  const remainingAwaited = awaitedSeatsZaplash(ctx, state);
  if (remainingAwaited.length === 0) {
    return onTickZaplash(ctx, state);
  }

  return null;
}
