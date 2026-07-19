import type {
  GameContext,
  GameAction,
  GameStateIn,
  GameEvent,
  ReduceResult,
  ReduceError,
  SeatIndex,
} from "@merky/game-sdk";
import { ZAPLASH_CORE_PROMPTS } from "./packs";

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
}

export interface ZaplashPublicState {
  round: number;
  totalRounds: number;
  submittedSeats: SeatIndex[];
  currentMatchupIndex: number;
  totalMatchups: number;
  currentMatchup: MatchupState | null;
  _promptPool: string[];
  _usedPrompts: string[];
  _roundPrompts: PromptAssignment[];
  _roundMatchups: MatchupState[];
  _roundVotes: Record<number, Record<number, 0 | 1>>;
  _roundAnswers: Record<number, Record<number, string>>;
  /** Running cumulative totals — the platform's scores contract needs totals,
   * and reduce never receives prior scores, so the game carries its own. */
  _totals: Partial<Record<SeatIndex, number>>;
}

export interface ZaplashPrivateState {
  prompts: Array<{ index: number; text: string }>;
  answers: Record<number, string>;
}

export interface ZaplashSettings {
  rounds: number;
  writeSeconds: number;
  voteSeconds: number;
  zapBonus: boolean;
  packId: string;
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

function startRound(
  ctx: GameContext,
  round: number,
  totalRounds: number,
  existingPool: string[],
  existingUsed: string[],
  carriedTotals: Partial<Record<SeatIndex, number>>
): ReduceResult {
  const settings = getSettings(ctx);
  const activeSeats = ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
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
    _promptPool: remainingPool,
    _usedPrompts: used,
    _roundPrompts: roundPrompts,
    _roundMatchups: [],
    _roundVotes: {},
    _roundAnswers: {},
    _totals: carriedTotals,
  };

  const writeMs = settings.writeSeconds * 1000;

  return {
    publicState,
    privateState,
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

function buildMatchups(
  ctx: GameContext,
  pub: ZaplashPublicState,
  privateStateMap: Partial<Record<SeatIndex, unknown>>
): MatchupState[] {
  const activeSeats = ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
  const matchups: MatchupState[] = [];

  for (const pa of pub._roundPrompts) {
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
    });
  }

  return matchups;
}

function startNextMatchup(
  ctx: GameContext,
  pub: ZaplashPublicState,
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
        _roundMatchups: matchups,
      },
      phase: "scoreboard",
      scores: pub._totals,
      events: [{ type: "scoreboard" }],
      timer: { endsAt: ctx.now + scoreboardMs, kind: "scoreboard", durationMs: scoreboardMs },
    };
  }

  const current = matchups[matchupIdx]!;
  const voteMs = settings.voteSeconds * 1000;

  const voteMatchupPublic: MatchupState = {
    ...current,
    answers: current.answers.map((a) => ({ text: a.text })),
  };

  const nextPub: ZaplashPublicState = {
    ...pub,
    currentMatchupIndex: matchupIdx,
    totalMatchups: matchups.length,
    currentMatchup: voteMatchupPublic,
    _roundMatchups: matchups,
  };

  return {
    publicState: nextPub,
    phase: "vote",
    events: [{ type: "matchup_started", payload: { matchupIndex: matchupIdx } }],
    timer: { endsAt: ctx.now + voteMs, kind: "vote", durationMs: voteMs },
  };
}

function advanceToVote(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = state.publicState as ZaplashPublicState;
  const matchups = buildMatchups(ctx, pub, state.privateState);
  return startNextMatchup(ctx, pub, matchups, 0);
}

function startReveal(ctx: GameContext, state: GameStateIn): ReduceResult {
  const pub = state.publicState as ZaplashPublicState;
  const settings = getSettings(ctx);
  const matchup = pub.currentMatchup;

  if (!matchup) {
    return startNextMatchup(ctx, pub, pub._roundMatchups, pub.currentMatchupIndex + 1);
  }

  const mIdx = pub.currentMatchupIndex;
  const votesObj = pub._roundVotes[mIdx] ?? {};

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

  const revealMatchup: MatchupState = {
    ...matchup,
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

    const newAnswers = { ...priv.answers, [promptIndex]: trimmed };
    const newPriv: ZaplashPrivateState = { ...priv, answers: newAnswers };

    const finishedBoth = priv.prompts.length > 0 && priv.prompts.every((p) => newAnswers[p.index] !== undefined);
    const newSubmitted = [...pub.submittedSeats];
    if (finishedBoth && !newSubmitted.includes(seat)) {
      newSubmitted.push(seat);
    }

    const updatedPrivateState = { ...state.privateState, [seat]: newPriv };
    const activeSeats = ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
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

  if (action.type === "vote") {
    if (state.phase !== "vote") {
      return { error: "Not in vote phase", code: "bad_phase" };
    }

    const matchup = pub.currentMatchup;
    if (!matchup) {
      return { error: "No active matchup", code: "no_matchup" };
    }

    const seat = action.seat as SeatIndex;
    const [w0, w1] = matchup.writers;

    const seatObj = ctx.seats.find((s) => s.seatIndex === seat);
    if (seatObj?.abandoned || seat === w0 || seat === w1) {
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
    const currentVotes = pub._roundVotes[mIdx] ?? {};
    const newVotes: Record<number, 0 | 1> = { ...currentVotes, [seat]: ansIdx };
    const newVotedSeats = [...matchup.votedSeats, seat];

    const nextMatchup: MatchupState = {
      ...matchup,
      votedSeats: newVotedSeats,
    };

    const nextPub: ZaplashPublicState = {
      ...pub,
      currentMatchup: nextMatchup,
      _roundVotes: {
        ...pub._roundVotes,
        [mIdx]: newVotes,
      },
    };

    const activeSeats = ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
    const eligibleVoters = activeSeats.filter((s) => s !== w0 && s !== w1);
    const allVoted = eligibleVoters.every((s) => newVotedSeats.includes(s));

    if (allVoted) {
      return startReveal(ctx, { ...state, publicState: nextPub });
    }

    return {
      publicState: nextPub,
      phase: "vote",
      events: [{ type: "voted", payload: { seat } }],
    };
  }

  return { error: "Unknown action type", code: "unknown_action" };
}

export function onTickZaplash(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as ZaplashPublicState | null;
  if (!pub) return null;

  if (state.phase === "write") {
    return advanceToVote(ctx, state);
  }

  if (state.phase === "vote") {
    return startReveal(ctx, state);
  }

  if (state.phase === "reveal") {
    const nextIdx = pub.currentMatchupIndex + 1;
    return startNextMatchup(ctx, pub, pub._roundMatchups, nextIdx);
  }

  if (state.phase === "scoreboard") {
    const settings = getSettings(ctx);
    if (pub.round < settings.rounds) {
      return startRound(
        ctx,
        pub.round + 1,
        settings.rounds,
        pub._promptPool,
        pub._usedPrompts,
        pub._totals ?? {}
      );
    }
    return {
      publicState: pub,
      phase: "game_over",
      scores: pub._totals,
      events: [{ type: "game_over" }],
      timer: null,
      matchOver: true,
    };
  }

  return null;
}

export function awaitedSeatsZaplash(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as ZaplashPublicState | null;
  if (!pub) return [];

  const activeSeats = ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);

  if (state.phase === "write") {
    return activeSeats.filter((s) => !pub.submittedSeats.includes(s));
  }

  if (state.phase === "vote" && pub.currentMatchup) {
    const [w0, w1] = pub.currentMatchup.writers;
    const eligible = activeSeats.filter((s) => s !== w0 && s !== w1);
    return eligible.filter((s) => !pub.currentMatchup!.votedSeats.includes(s));
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
