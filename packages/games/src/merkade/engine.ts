import type { GameAction, GameContext, GameStateIn, ReduceError, ReduceResult, SeatIndex } from "@merky/game-sdk";
import type { MerkadePublicState, MerkadePrivateState, MerkadeSecretState, MerkadeSettings, RoundFormat } from "./types";
import { corePack, type MerkadePackPayload } from "./packs";
import { scoreTruthHunt, scoreMajority } from "./scoring";
import { isValidGrid, createEmptyGrid } from "./DoodleGrid";

export function getSettings(ctx: GameContext): MerkadeSettings {
  return {
    roundCount: typeof ctx.settings.roundCount === "number" ? ctx.settings.roundCount : 6,
    answerSeconds: typeof ctx.settings.answerSeconds === "number" ? ctx.settings.answerSeconds : 30,
    voteSeconds: typeof ctx.settings.voteSeconds === "number" ? ctx.settings.voteSeconds : 20,
    drawSeconds: typeof ctx.settings.drawSeconds === "number" ? ctx.settings.drawSeconds : 60,
    guessSeconds: typeof ctx.settings.guessSeconds === "number" ? ctx.settings.guessSeconds : 25,
    pack: typeof ctx.settings.pack === "string" ? ctx.settings.pack : "core",
  };
}

function getPack(ctx: GameContext): MerkadePackPayload {
  const defaultPayload = corePack.payload as MerkadePackPayload;
  const resolvedPack = ctx.settings._pack as { payload?: unknown } | undefined;
  const pack = (resolvedPack?.payload ?? defaultPayload) as Partial<MerkadePackPayload>;
  return {
    trivia: Array.isArray(pack.trivia) && pack.trivia.length > 0 ? pack.trivia : defaultPayload.trivia,
    doodleWords: Array.isArray(pack.doodleWords) && pack.doodleWords.length > 0 ? pack.doodleWords : defaultPayload.doodleWords,
    majorityPrompts: Array.isArray(pack.majorityPrompts) && pack.majorityPrompts.length > 0 ? pack.majorityPrompts : defaultPayload.majorityPrompts,
  };
}

function shuffleArray<T>(arr: T[], rng: GameContext["rng"]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

export function initEngine(ctx: GameContext): ReduceResult {
  const settings = getSettings(ctx);
  const bag: RoundFormat[] = ["fib", "doodle", "majority"];
  const plan: RoundFormat[] = [];

  while (plan.length < settings.roundCount) {
    const shuffledBag = shuffleArray(bag, ctx.rng);
    plan.push(...shuffledBag);
  }
  const roundPlan = plan.slice(0, settings.roundCount);

  const publicState: MerkadePublicState = {
    roundPlan,
    roundIndex: 0,
    phase: "track_intro",
  };

  const secretState: MerkadeSecretState = {
    totals: {},
  };

  return {
    phase: "track_intro",
    publicState,
    privateState: {} as Record<SeatIndex, MerkadePrivateState>,
    secretState,
    scores: {},
    events: [],
    timer: {
      endsAt: ctx.now + 4000,
      kind: "track_intro",
      durationMs: 4000,
    },
  };
}

function getActiveSeats(ctx: GameContext): SeatIndex[] {
  return ctx.seats.filter((s) => !s.abandoned).map((s) => s.seatIndex);
}

function startRound(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const settings = getSettings(ctx);
  const pack = getPack(ctx);
  const format = pub.roundPlan[pub.roundIndex] ?? "fib";

  if (format === "fib") {
    const triviaIdx = Math.floor(ctx.rng() * pack.trivia.length);
    const item = pack.trivia[triviaIdx] ?? { fact: "Trivia question?", answer: "Answer" };

    const newPub: MerkadePublicState = {
      roundPlan: pub.roundPlan,
      roundIndex: pub.roundIndex,
      phase: "fib_answer",
      fibFact: item.fact,
      fibSubmittedCount: 0,
    };

    const newSecret: MerkadeSecretState = {
      ...secret,
      fib: {
        fact: item.fact,
        truth: item.answer,
        decoysBySeat: {},
        votesBySeat: {},
      },
      doodle: null,
      majority: null,
    };

    const privateState: Record<SeatIndex, MerkadePrivateState> = {} as Record<SeatIndex, MerkadePrivateState>;
    for (const seat of ctx.seats) {
      privateState[seat.seatIndex] = { fibHasSubmitted: false };
    }

    return {
      phase: "fib_answer",
      publicState: newPub,
      privateState,
      secretState: newSecret,
      scores: secret.totals,
      events: [],
      timer: {
        endsAt: ctx.now + settings.answerSeconds * 1000,
        kind: "fib_answer",
        durationMs: settings.answerSeconds * 1000,
      },
    };
  } else if (format === "doodle") {
    const artistOrder: SeatIndex[] = ctx.seats.map((s) => s.seatIndex);
    const shuffledWords = shuffleArray(pack.doodleWords, ctx.rng);
    const wordsBySeat: Partial<Record<SeatIndex, string>> = {};

    for (let i = 0; i < artistOrder.length; i++) {
      const seat = artistOrder[i]!;
      wordsBySeat[seat] = shuffledWords[i % shuffledWords.length] ?? "a fun doodle";
    }

    const newPub: MerkadePublicState = {
      roundPlan: pub.roundPlan,
      roundIndex: pub.roundIndex,
      phase: "doodle_draw",
      doodleArtistOrder: artistOrder,
      doodleSubmittedCount: 0,
    };

    const newSecret: MerkadeSecretState = {
      ...secret,
      doodle: {
        wordsBySeat,
        gridsBySeat: {},
        guessesBySeat: {},
        votesForCurrent: {},
      },
      fib: null,
      majority: null,
    };

    const privateState: Record<SeatIndex, MerkadePrivateState> = {} as Record<SeatIndex, MerkadePrivateState>;
    for (const seat of ctx.seats) {
      privateState[seat.seatIndex] = {
        doodleWord: wordsBySeat[seat.seatIndex],
        doodleHasSubmitted: false,
      };
    }

    return {
      phase: "doodle_draw",
      publicState: newPub,
      privateState,
      secretState: newSecret,
      scores: secret.totals,
      events: [],
      timer: {
        endsAt: ctx.now + settings.drawSeconds * 1000,
        kind: "doodle_draw",
        durationMs: settings.drawSeconds * 1000,
      },
    };
  } else {
    // majority
    const promptIdx = Math.floor(ctx.rng() * pack.majorityPrompts.length);
    const item = pack.majorityPrompts[promptIdx] ?? {
      prompt: "Which is better?",
      options: ["Option A", "Option B"],
    };

    const newPub: MerkadePublicState = {
      roundPlan: pub.roundPlan,
      roundIndex: pub.roundIndex,
      phase: "majority_answer",
      majorityPrompt: item.prompt,
      majorityOptions: item.options,
      majoritySubmittedCount: 0,
    };

    const newSecret: MerkadeSecretState = {
      ...secret,
      majority: {
        prompt: item.prompt,
        options: item.options,
        choicesBySeat: {},
        predictionsBySeat: {},
      },
      fib: null,
      doodle: null,
    };

    const privateState: Record<SeatIndex, MerkadePrivateState> = {} as Record<SeatIndex, MerkadePrivateState>;
    for (const seat of ctx.seats) {
      privateState[seat.seatIndex] = { majorityHasSubmitted: false };
    }

    return {
      phase: "majority_answer",
      publicState: newPub,
      privateState,
      secretState: newSecret,
      scores: secret.totals,
      events: [],
      timer: {
        endsAt: ctx.now + settings.answerSeconds * 1000,
        kind: "majority_answer",
        durationMs: settings.answerSeconds * 1000,
      },
    };
  }
}

function advanceRound(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const nextRoundIndex = pub.roundIndex + 1;
  if (nextRoundIndex >= pub.roundPlan.length) {
    const finalPub: MerkadePublicState = {
      ...pub,
      roundIndex: nextRoundIndex - 1,
      phase: "game_over",
    };
    return {
      phase: "game_over",
      matchOver: true,
      publicState: finalPub,
      privateState: {} as Record<SeatIndex, MerkadePrivateState>,
      secretState: secret,
      scores: secret.totals,
      events: [],
      timer: null,
    };
  }

  const nextPub: MerkadePublicState = {
    roundPlan: pub.roundPlan,
    roundIndex: nextRoundIndex,
    phase: "track_intro",
  };

  return {
    phase: "track_intro",
    publicState: nextPub,
    privateState: {} as Record<SeatIndex, MerkadePrivateState>,
    secretState: secret,
    scores: secret.totals,
    events: [],
    timer: {
      endsAt: ctx.now + 4000,
      kind: "track_intro",
      durationMs: 4000,
    },
  };
}

function transitionToFibVote(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const settings = getSettings(ctx);
  const fibSecret = secret.fib;
  const truth = fibSecret?.truth ?? "Truth";
  const decoysBySeat = fibSecret?.decoysBySeat ?? {};

  const rawOptions: string[] = [truth];
  const authorMap: Partial<Record<SeatIndex, number>> = {};

  for (const seatStr of Object.keys(decoysBySeat)) {
    const seat = Number(seatStr) as SeatIndex;
    const decoyText = (decoysBySeat as Record<number, string | undefined>)[seat]?.trim();
    if (!decoyText) continue;
    if (decoyText.toLowerCase() === truth.trim().toLowerCase()) continue;

    const existingIdx = rawOptions.findIndex((opt) => opt.toLowerCase() === decoyText.toLowerCase());
    if (existingIdx >= 0) {
      authorMap[seat] = existingIdx;
    } else {
      rawOptions.push(decoyText);
      authorMap[seat] = rawOptions.length - 1;
    }
  }

  const shuffledIndices = rawOptions.map((_, i) => i);
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng() * (i + 1));
    const temp = shuffledIndices[i]!;
    shuffledIndices[i] = shuffledIndices[j]!;
    shuffledIndices[j] = temp;
  }

  const shuffledOptions: string[] = new Array(rawOptions.length);
  const oldToNew: Record<number, number> = {};
  for (let newIdx = 0; newIdx < shuffledIndices.length; newIdx++) {
    const oldIdx = shuffledIndices[newIdx]!;
    shuffledOptions[newIdx] = rawOptions[oldIdx]!;
    oldToNew[oldIdx] = newIdx;
  }

  const truthIndex = oldToNew[0] ?? 0;
  const finalAuthorsBySeat: Partial<Record<SeatIndex, number>> = {};
  for (const [seatStr, oldIdx] of Object.entries(authorMap)) {
    const seat = Number(seatStr) as SeatIndex;
    if (oldIdx !== undefined && oldToNew[oldIdx] !== undefined) {
      finalAuthorsBySeat[seat] = oldToNew[oldIdx];
    }
  }

  const newPub: MerkadePublicState = {
    ...pub,
    phase: "fib_vote",
    fibOptions: shuffledOptions,
  };

  const newSecret: MerkadeSecretState = {
    ...secret,
    fib: {
      ...(fibSecret ?? { fact: "", truth: "", decoysBySeat: {} }),
      options: shuffledOptions,
      truthIndex,
      authorsBySeat: finalAuthorsBySeat,
      votesBySeat: {},
    },
  };

  const privateState: Record<SeatIndex, MerkadePrivateState> = {} as Record<SeatIndex, MerkadePrivateState>;
  for (const seat of ctx.seats) {
    privateState[seat.seatIndex] = { fibHasVoted: false };
  }

  return {
    phase: "fib_vote",
    publicState: newPub,
    privateState,
    secretState: newSecret,
    scores: secret.totals,
    events: [],
    timer: {
      endsAt: ctx.now + settings.voteSeconds * 1000,
      kind: "fib_vote",
      durationMs: settings.voteSeconds * 1000,
    },
  };
}

function transitionToFibReveal(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const fibSecret = secret.fib;
  const options = fibSecret?.options ?? [];
  const truthIndex = fibSecret?.truthIndex ?? 0;
  const votesBySeat = fibSecret?.votesBySeat ?? {};
  const authorsBySeat = fibSecret?.authorsBySeat ?? {};

  const roundScores = scoreTruthHunt({
    options,
    truthIndex,
    votesBySeat,
    authorsBySeat,
  });

  const voteCounts = options.map((_, i) => Object.values(votesBySeat).filter((v) => v === i).length);

  const newTotals: Partial<Record<SeatIndex, number>> = { ...secret.totals };
  for (const [seatStr, score] of Object.entries(roundScores)) {
    const seat = Number(seatStr) as SeatIndex;
    (newTotals as Record<number, number>)[seat] =
      ((newTotals as Record<number, number>)[seat] ?? 0) + (score ?? 0);
  }

  const newPub: MerkadePublicState = {
    ...pub,
    phase: "fib_reveal",
    fibReveal: {
      truthIndex,
      options,
      voteCounts,
      votesBySeat,
      authorsBySeat,
      roundScores,
    },
  };

  const newSecret: MerkadeSecretState = {
    ...secret,
    totals: newTotals,
  };

  return {
    phase: "fib_reveal",
    publicState: newPub,
    privateState: {} as Record<SeatIndex, MerkadePrivateState>,
    secretState: newSecret,
    scores: newTotals,
    events: [],
    timer: {
      endsAt: ctx.now + 6000,
      kind: "fib_reveal",
      durationMs: 6000,
    },
  };
}

function startDoodleSpotlight(
  ctx: GameContext,
  pub: MerkadePublicState,
  secret: MerkadeSecretState,
  spotlightIndex: number
): ReduceResult {
  const settings = getSettings(ctx);
  const artistOrder = pub.doodleArtistOrder ?? [];
  const gridsBySeat = secret.doodle?.gridsBySeat ?? {};

  let validIdx = spotlightIndex;
  while (validIdx < artistOrder.length) {
    const candidateArtist = artistOrder[validIdx]!;
    const isAbandoned = ctx.seats.find((s) => s.seatIndex === candidateArtist)?.abandoned;
    const hasGrid = Boolean((gridsBySeat as Record<number, number[][] | undefined>)[candidateArtist]);
    if (!isAbandoned && hasGrid) {
      break;
    }
    validIdx++;
  }

  if (validIdx >= artistOrder.length) {
    return advanceRound(ctx, pub, secret);
  }

  const currentArtist = artistOrder[validIdx]!;
  const currentGrid = (gridsBySeat as Record<number, number[][]>)[currentArtist]!;

  const newPub: MerkadePublicState = {
    ...pub,
    phase: "doodle_guess",
    doodleSpotlightIndex: validIdx,
    doodleCurrentArtist: currentArtist,
    doodleCurrentGrid: currentGrid,
    doodleGuessOptions: undefined,
    doodleReveal: undefined,
  };

  const newSecret: MerkadeSecretState = {
    ...secret,
    doodle: {
      ...(secret.doodle ?? { wordsBySeat: {}, gridsBySeat: {}, guessesBySeat: {}, votesForCurrent: {} }),
      guessesBySeat: {},
      votesForCurrent: {},
    },
  };

  const privateState: Record<SeatIndex, MerkadePrivateState> = {} as Record<SeatIndex, MerkadePrivateState>;
  for (const seat of ctx.seats) {
    if (seat.seatIndex !== currentArtist) {
      privateState[seat.seatIndex] = { doodleHasGuessed: false };
    } else {
      privateState[seat.seatIndex] = {};
    }
  }

  return {
    phase: "doodle_guess",
    publicState: newPub,
    privateState,
    secretState: newSecret,
    scores: secret.totals,
    events: [],
    timer: {
      endsAt: ctx.now + settings.guessSeconds * 1000,
      kind: "doodle_guess",
      durationMs: settings.guessSeconds * 1000,
    },
  };
}

function transitionToDoodleVote(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const settings = getSettings(ctx);
  const doodleSecret = secret.doodle;
  const currentArtist = pub.doodleCurrentArtist ?? 0;
  const realWord = (doodleSecret?.wordsBySeat as Record<number, string | undefined>)?.[currentArtist] ?? "doodle";
  const guessesBySeat = doodleSecret?.guessesBySeat ?? {};

  const rawOptions: string[] = [realWord];
  const authorMap: Partial<Record<SeatIndex, number>> = {};

  for (const seatStr of Object.keys(guessesBySeat)) {
    const seat = Number(seatStr) as SeatIndex;
    if (seat === currentArtist) continue;
    const guessText = (guessesBySeat as Record<number, string | undefined>)[seat]?.trim();
    if (!guessText) continue;
    if (guessText.toLowerCase() === realWord.trim().toLowerCase()) continue;

    const existingIdx = rawOptions.findIndex((opt) => opt.toLowerCase() === guessText.toLowerCase());
    if (existingIdx >= 0) {
      authorMap[seat] = existingIdx;
    } else {
      rawOptions.push(guessText);
      authorMap[seat] = rawOptions.length - 1;
    }
  }

  const shuffledIndices = rawOptions.map((_, i) => i);
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng() * (i + 1));
    const temp = shuffledIndices[i]!;
    shuffledIndices[i] = shuffledIndices[j]!;
    shuffledIndices[j] = temp;
  }

  const shuffledOptions: string[] = new Array(rawOptions.length);
  const oldToNew: Record<number, number> = {};
  for (let newIdx = 0; newIdx < shuffledIndices.length; newIdx++) {
    const oldIdx = shuffledIndices[newIdx]!;
    shuffledOptions[newIdx] = rawOptions[oldIdx]!;
    oldToNew[oldIdx] = newIdx;
  }

  const truthIndex = oldToNew[0] ?? 0;
  const finalAuthorsBySeat: Partial<Record<SeatIndex, number>> = {};
  for (const [seatStr, oldIdx] of Object.entries(authorMap)) {
    const seat = Number(seatStr) as SeatIndex;
    if (oldIdx !== undefined && oldToNew[oldIdx] !== undefined) {
      finalAuthorsBySeat[seat] = oldToNew[oldIdx];
    }
  }

  const newPub: MerkadePublicState = {
    ...pub,
    phase: "doodle_vote",
    doodleGuessOptions: shuffledOptions,
  };

  const newSecret: MerkadeSecretState = {
    ...secret,
    doodle: {
      ...(doodleSecret ?? { wordsBySeat: {}, gridsBySeat: {}, guessesBySeat: {}, votesForCurrent: {} }),
      options: shuffledOptions,
      truthIndex,
      authorsBySeat: finalAuthorsBySeat,
      votesForCurrent: {},
    },
  };

  const privateState: Record<SeatIndex, MerkadePrivateState> = {} as Record<SeatIndex, MerkadePrivateState>;
  for (const seat of ctx.seats) {
    if (seat.seatIndex !== currentArtist) {
      privateState[seat.seatIndex] = { doodleHasVoted: false };
    } else {
      privateState[seat.seatIndex] = {};
    }
  }

  return {
    phase: "doodle_vote",
    publicState: newPub,
    privateState,
    secretState: newSecret,
    scores: secret.totals,
    events: [],
    timer: {
      endsAt: ctx.now + settings.voteSeconds * 1000,
      kind: "doodle_vote",
      durationMs: settings.voteSeconds * 1000,
    },
  };
}

function transitionToDoodleRevealOne(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const doodleSecret = secret.doodle;
  const options = doodleSecret?.options ?? [];
  const truthIndex = doodleSecret?.truthIndex ?? 0;
  const votesBySeat = doodleSecret?.votesForCurrent ?? {};
  const authorsBySeat = doodleSecret?.authorsBySeat ?? {};
  const artist = pub.doodleCurrentArtist ?? 0;

  const roundScores = scoreTruthHunt({
    options,
    truthIndex,
    votesBySeat,
    authorsBySeat,
    artistSeat: artist,
    artistBonusPerFooled: 250,
  });

  const voteCounts = options.map((_, i) => Object.values(votesBySeat).filter((v) => v === i).length);

  const newTotals: Partial<Record<SeatIndex, number>> = { ...secret.totals };
  for (const [seatStr, score] of Object.entries(roundScores)) {
    const seat = Number(seatStr) as SeatIndex;
    (newTotals as Record<number, number>)[seat] =
      ((newTotals as Record<number, number>)[seat] ?? 0) + (score ?? 0);
  }

  const newPub: MerkadePublicState = {
    ...pub,
    phase: "doodle_reveal_one",
    doodleReveal: {
      truthIndex,
      options,
      voteCounts,
      votesBySeat,
      authorsBySeat,
      artist,
      roundScores,
    },
  };

  const newSecret: MerkadeSecretState = {
    ...secret,
    totals: newTotals,
  };

  return {
    phase: "doodle_reveal_one",
    publicState: newPub,
    privateState: {} as Record<SeatIndex, MerkadePrivateState>,
    secretState: newSecret,
    scores: newTotals,
    events: [],
    timer: {
      endsAt: ctx.now + 5000,
      kind: "doodle_reveal_one",
      durationMs: 5000,
    },
  };
}

function transitionToMajorityReveal(ctx: GameContext, pub: MerkadePublicState, secret: MerkadeSecretState): ReduceResult {
  const majoritySecret = secret.majority;
  const choicesBySeat = majoritySecret?.choicesBySeat ?? {};
  const predictionsBySeat = majoritySecret?.predictionsBySeat ?? {};

  const { counts, majorityOptionIndex, roundScores } = scoreMajority({
    choicesBySeat,
    predictionsBySeat,
  });

  const newTotals: Partial<Record<SeatIndex, number>> = { ...secret.totals };
  for (const [seatStr, score] of Object.entries(roundScores)) {
    const seat = Number(seatStr) as SeatIndex;
    (newTotals as Record<number, number>)[seat] =
      ((newTotals as Record<number, number>)[seat] ?? 0) + (score ?? 0);
  }

  const newPub: MerkadePublicState = {
    ...pub,
    phase: "majority_reveal",
    majorityReveal: {
      counts,
      majorityOptionIndex,
      choicesBySeat,
      predictionsBySeat,
      roundScores,
    },
  };

  const newSecret: MerkadeSecretState = {
    ...secret,
    totals: newTotals,
  };

  return {
    phase: "majority_reveal",
    publicState: newPub,
    privateState: {} as Record<SeatIndex, MerkadePrivateState>,
    secretState: newSecret,
    scores: newTotals,
    events: [],
    timer: {
      endsAt: ctx.now + 6000,
      kind: "majority_reveal",
      durationMs: 6000,
    },
  };
}

export function awaitedSeatsEngine(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as MerkadePublicState | undefined;
  const priv = state.privateState as Record<SeatIndex, MerkadePrivateState> | undefined;
  if (!pub || !priv) return [];

  const activeSeats = getActiveSeats(ctx);

  if (pub.phase === "fib_answer") {
    return activeSeats.filter((seat) => !priv[seat]?.fibHasSubmitted);
  } else if (pub.phase === "fib_vote") {
    return activeSeats.filter((seat) => !priv[seat]?.fibHasVoted);
  } else if (pub.phase === "doodle_draw") {
    return activeSeats.filter((seat) => !priv[seat]?.doodleHasSubmitted);
  } else if (pub.phase === "doodle_guess") {
    const artist = pub.doodleCurrentArtist;
    return activeSeats.filter((seat) => seat !== artist && !priv[seat]?.doodleHasGuessed);
  } else if (pub.phase === "doodle_vote") {
    const artist = pub.doodleCurrentArtist;
    return activeSeats.filter((seat) => seat !== artist && !priv[seat]?.doodleHasVoted);
  } else if (pub.phase === "majority_answer") {
    return activeSeats.filter((seat) => !priv[seat]?.majorityHasSubmitted);
  }

  return [];
}

export function reduceEngine(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = state.publicState as MerkadePublicState;
  const privMap = state.privateState as Record<SeatIndex, MerkadePrivateState>;
  const secret = state.secretState as MerkadeSecretState;
  const seat = action.seat as SeatIndex;
  const priv = (privMap as Record<number, MerkadePrivateState | undefined>)[seat] ?? {};

  switch (action.type) {
    case "submit_fib_lie": {
      if (pub.phase !== "fib_answer") {
        return { error: "Action allowed in fib_answer phase only", code: "wrong_phase" };
      }
      if (priv.fibHasSubmitted) {
        return { error: "Already submitted a lie", code: "already_submitted" };
      }
      const textPayload = action.payload as { text?: string } | undefined;
      const rawText = typeof textPayload?.text === "string" ? textPayload.text : "";
      const trimmed = rawText.trim();
      if (trimmed.length === 0) {
        return { error: "Text cannot be empty", code: "empty_text" };
      }
      if (trimmed.length > 40) {
        return { error: "Text exceeds 40 characters limit", code: "text_too_long" };
      }
      const truth = secret.fib?.truth ?? "";
      if (trimmed.toLowerCase() === truth.trim().toLowerCase()) {
        return { error: "Cannot submit the true answer as a lie", code: "is_the_truth" };
      }

      const newSecret: MerkadeSecretState = {
        ...secret,
        fib: {
          ...(secret.fib ?? { fact: "", truth: "", decoysBySeat: {}, votesBySeat: {} }),
          decoysBySeat: {
            ...(secret.fib?.decoysBySeat ?? {}),
            [seat]: trimmed,
          },
        },
      };

      const newPrivMap: Record<SeatIndex, MerkadePrivateState> = {
        ...privMap,
        [seat]: { ...priv, fibHasSubmitted: true },
      };

      const newPub: MerkadePublicState = {
        ...pub,
        fibSubmittedCount: (pub.fibSubmittedCount ?? 0) + 1,
      };

      const newState: GameStateIn = {
        phase: pub.phase,
        publicState: newPub,
        privateState: newPrivMap,
        secretState: newSecret,
      };

      if (awaitedSeatsEngine(ctx, newState).length === 0) {
        return transitionToFibVote(ctx, newPub, newSecret);
      }

      return {
        phase: pub.phase,
        publicState: newPub,
        privateState: { [seat]: { ...priv, fibHasSubmitted: true } },
        secretState: newSecret,
        scores: secret.totals,
        events: [],
      };
    }

    case "submit_fib_vote": {
      if (pub.phase !== "fib_vote") {
        return { error: "Action allowed in fib_vote phase only", code: "wrong_phase" };
      }
      if (priv.fibHasVoted) {
        return { error: "Already voted", code: "already_submitted" };
      }
      const optionPayload = action.payload as { optionIndex?: number } | undefined;
      const optionIndex = typeof optionPayload?.optionIndex === "number" ? optionPayload.optionIndex : -1;
      const options = pub.fibOptions ?? [];
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
        return { error: "Invalid option index", code: "invalid_option_index" };
      }

      const authorsBySeat = secret.fib?.authorsBySeat ?? {};
      if ((authorsBySeat as Record<number, number | undefined>)[seat] === optionIndex) {
        return { error: "Cannot vote for your own lie", code: "own_lie" };
      }

      const newSecret: MerkadeSecretState = {
        ...secret,
        fib: {
          ...(secret.fib ?? { fact: "", truth: "", decoysBySeat: {}, votesBySeat: {} }),
          votesBySeat: {
            ...(secret.fib?.votesBySeat ?? {}),
            [seat]: optionIndex,
          },
        },
      };

      const newPrivMap: Record<SeatIndex, MerkadePrivateState> = {
        ...privMap,
        [seat]: { ...priv, fibHasVoted: true },
      };

      const newState: GameStateIn = {
        phase: pub.phase,
        publicState: pub,
        privateState: newPrivMap,
        secretState: newSecret,
      };

      if (awaitedSeatsEngine(ctx, newState).length === 0) {
        return transitionToFibReveal(ctx, pub, newSecret);
      }

      return {
        phase: pub.phase,
        publicState: pub,
        privateState: { [seat]: { ...priv, fibHasVoted: true } },
        secretState: newSecret,
        scores: secret.totals,
        events: [],
      };
    }

    case "submit_drawing": {
      if (pub.phase !== "doodle_draw") {
        return { error: "Action allowed in doodle_draw phase only", code: "wrong_phase" };
      }
      if (priv.doodleHasSubmitted) {
        return { error: "Already submitted drawing", code: "already_submitted" };
      }
      const gridPayload = action.payload as { grid?: unknown } | undefined;
      const grid = gridPayload?.grid;
      if (!isValidGrid(grid)) {
        return { error: "Invalid drawing grid format", code: "invalid_grid" };
      }

      const newSecret: MerkadeSecretState = {
        ...secret,
        doodle: {
          ...(secret.doodle ?? { wordsBySeat: {}, gridsBySeat: {}, guessesBySeat: {}, votesForCurrent: {} }),
          gridsBySeat: {
            ...(secret.doodle?.gridsBySeat ?? {}),
            [seat]: grid,
          },
        },
      };

      const newPrivMap: Record<SeatIndex, MerkadePrivateState> = {
        ...privMap,
        [seat]: { ...priv, doodleHasSubmitted: true },
      };

      const newPub: MerkadePublicState = {
        ...pub,
        doodleSubmittedCount: (pub.doodleSubmittedCount ?? 0) + 1,
      };

      const newState: GameStateIn = {
        phase: pub.phase,
        publicState: newPub,
        privateState: newPrivMap,
        secretState: newSecret,
      };

      if (awaitedSeatsEngine(ctx, newState).length === 0) {
        return startDoodleSpotlight(ctx, newPub, newSecret, 0);
      }

      return {
        phase: pub.phase,
        publicState: newPub,
        privateState: { [seat]: { ...priv, doodleHasSubmitted: true } },
        secretState: newSecret,
        scores: secret.totals,
        events: [],
      };
    }

    case "submit_guess": {
      if (pub.phase !== "doodle_guess") {
        return { error: "Action allowed in doodle_guess phase only", code: "wrong_phase" };
      }
      if (seat === pub.doodleCurrentArtist) {
        return { error: "Artist cannot submit a guess for their own drawing", code: "not_your_turn" };
      }
      if (priv.doodleHasGuessed) {
        return { error: "Already submitted guess", code: "already_submitted" };
      }
      const textPayload = action.payload as { text?: string } | undefined;
      const rawText = typeof textPayload?.text === "string" ? textPayload.text : "";
      const trimmed = rawText.trim();
      if (trimmed.length === 0) {
        return { error: "Guess text cannot be empty", code: "empty_text" };
      }
      if (trimmed.length > 40) {
        return { error: "Guess text exceeds 40 characters limit", code: "text_too_long" };
      }
      const currentArtist = pub.doodleCurrentArtist ?? 0;
      const realWord = (secret.doodle?.wordsBySeat as Record<number, string | undefined>)?.[currentArtist] ?? "";
      if (trimmed.toLowerCase() === realWord.trim().toLowerCase()) {
        return { error: "Cannot submit the true doodle word as a guess", code: "is_the_truth" };
      }

      const newSecret: MerkadeSecretState = {
        ...secret,
        doodle: {
          ...(secret.doodle ?? { wordsBySeat: {}, gridsBySeat: {}, guessesBySeat: {}, votesForCurrent: {} }),
          guessesBySeat: {
            ...(secret.doodle?.guessesBySeat ?? {}),
            [seat]: trimmed,
          },
        },
      };

      const newPrivMap: Record<SeatIndex, MerkadePrivateState> = {
        ...privMap,
        [seat]: { ...priv, doodleHasGuessed: true },
      };

      const newState: GameStateIn = {
        phase: pub.phase,
        publicState: pub,
        privateState: newPrivMap,
        secretState: newSecret,
      };

      if (awaitedSeatsEngine(ctx, newState).length === 0) {
        return transitionToDoodleVote(ctx, pub, newSecret);
      }

      return {
        phase: pub.phase,
        publicState: pub,
        privateState: { [seat]: { ...priv, doodleHasGuessed: true } },
        secretState: newSecret,
        scores: secret.totals,
        events: [],
      };
    }

    case "submit_guess_vote": {
      if (pub.phase !== "doodle_vote") {
        return { error: "Action allowed in doodle_vote phase only", code: "wrong_phase" };
      }
      if (seat === pub.doodleCurrentArtist) {
        return { error: "Artist cannot vote on their own drawing", code: "not_your_turn" };
      }
      if (priv.doodleHasVoted) {
        return { error: "Already voted", code: "already_submitted" };
      }
      const optionPayload = action.payload as { optionIndex?: number } | undefined;
      const optionIndex = typeof optionPayload?.optionIndex === "number" ? optionPayload.optionIndex : -1;
      const options = pub.doodleGuessOptions ?? [];
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
        return { error: "Invalid option index", code: "invalid_option_index" };
      }

      const authorsBySeat = secret.doodle?.authorsBySeat ?? {};
      if ((authorsBySeat as Record<number, number | undefined>)[seat] === optionIndex) {
        return { error: "Cannot vote for your own guess", code: "own_guess" };
      }

      const newSecret: MerkadeSecretState = {
        ...secret,
        doodle: {
          ...(secret.doodle ?? { wordsBySeat: {}, gridsBySeat: {}, guessesBySeat: {}, votesForCurrent: {} }),
          votesForCurrent: {
            ...(secret.doodle?.votesForCurrent ?? {}),
            [seat]: optionIndex,
          },
        },
      };

      const newPrivMap: Record<SeatIndex, MerkadePrivateState> = {
        ...privMap,
        [seat]: { ...priv, doodleHasVoted: true },
      };

      const newState: GameStateIn = {
        phase: pub.phase,
        publicState: pub,
        privateState: newPrivMap,
        secretState: newSecret,
      };

      if (awaitedSeatsEngine(ctx, newState).length === 0) {
        return transitionToDoodleRevealOne(ctx, pub, newSecret);
      }

      return {
        phase: pub.phase,
        publicState: pub,
        privateState: { [seat]: { ...priv, doodleHasVoted: true } },
        secretState: newSecret,
        scores: secret.totals,
        events: [],
      };
    }

    case "submit_majority": {
      if (pub.phase !== "majority_answer") {
        return { error: "Action allowed in majority_answer phase only", code: "wrong_phase" };
      }
      if (priv.majorityHasSubmitted) {
        return { error: "Already submitted choice", code: "already_submitted" };
      }
      const majorityPayload = action.payload as { choice?: unknown; predictedMajority?: unknown } | undefined;
      const choice = majorityPayload?.choice;
      const predictedMajority = majorityPayload?.predictedMajority;

      if ((choice !== 0 && choice !== 1) || (predictedMajority !== 0 && predictedMajority !== 1)) {
        return { error: "Invalid choice or prediction", code: "invalid_choice" };
      }

      const newSecret: MerkadeSecretState = {
        ...secret,
        majority: {
          ...(secret.majority ?? { prompt: "", options: ["", ""], choicesBySeat: {}, predictionsBySeat: {} }),
          choicesBySeat: {
            ...(secret.majority?.choicesBySeat ?? {}),
            [seat]: choice,
          },
          predictionsBySeat: {
            ...(secret.majority?.predictionsBySeat ?? {}),
            [seat]: predictedMajority,
          },
        },
      };

      const newPrivMap: Record<SeatIndex, MerkadePrivateState> = {
        ...privMap,
        [seat]: { ...priv, majorityHasSubmitted: true },
      };

      const newPub: MerkadePublicState = {
        ...pub,
        majoritySubmittedCount: (pub.majoritySubmittedCount ?? 0) + 1,
      };

      const newState: GameStateIn = {
        phase: pub.phase,
        publicState: newPub,
        privateState: newPrivMap,
        secretState: newSecret,
      };

      if (awaitedSeatsEngine(ctx, newState).length === 0) {
        return transitionToMajorityReveal(ctx, newPub, newSecret);
      }

      return {
        phase: pub.phase,
        publicState: newPub,
        privateState: { [seat]: { ...priv, majorityHasSubmitted: true } },
        secretState: newSecret,
        scores: secret.totals,
        events: [],
      };
    }

    default:
      return { error: "Unknown action type", code: "unknown_action" };
  }
}

export function onTickEngine(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as MerkadePublicState;
  const secret = state.secretState as MerkadeSecretState;

  switch (pub.phase) {
    case "track_intro":
      return startRound(ctx, pub, secret);

    case "fib_answer":
      return transitionToFibVote(ctx, pub, secret);

    case "fib_vote":
      return transitionToFibReveal(ctx, pub, secret);

    case "fib_reveal":
      return advanceRound(ctx, pub, secret);

    case "doodle_draw":
      return startDoodleSpotlight(ctx, pub, secret, 0);

    case "doodle_guess":
      return transitionToDoodleVote(ctx, pub, secret);

    case "doodle_vote":
      return transitionToDoodleRevealOne(ctx, pub, secret);

    case "doodle_reveal_one": {
      const nextSpotlight = (pub.doodleSpotlightIndex ?? 0) + 1;
      const artistOrder = pub.doodleArtistOrder ?? [];
      if (nextSpotlight < artistOrder.length) {
        return startDoodleSpotlight(ctx, pub, secret, nextSpotlight);
      } else {
        return advanceRound(ctx, pub, secret);
      }
    }

    case "majority_answer":
      return transitionToMajorityReveal(ctx, pub, secret);

    case "majority_reveal":
      return advanceRound(ctx, pub, secret);

    default:
      return null;
  }
}

export function onSeatAbandonedEngine(
  ctx: GameContext,
  state: GameStateIn,
  _abandonedSeat: SeatIndex
): ReduceResult | null {
  const pub = state.publicState as MerkadePublicState;
  const secret = state.secretState as MerkadeSecretState;

  const remainingAwaited = awaitedSeatsEngine(ctx, state);
  if (remainingAwaited.length === 0) {
    switch (pub.phase) {
      case "fib_answer":
        return transitionToFibVote(ctx, pub, secret);
      case "fib_vote":
        return transitionToFibReveal(ctx, pub, secret);
      case "doodle_draw":
        return startDoodleSpotlight(ctx, pub, secret, 0);
      case "doodle_guess":
        return transitionToDoodleVote(ctx, pub, secret);
      case "doodle_vote":
        return transitionToDoodleRevealOne(ctx, pub, secret);
      case "majority_answer":
        return transitionToMajorityReveal(ctx, pub, secret);
    }
  }

  return null;
}

export function suggestBotActionEngine(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): GameAction | null {
  const pub = state.publicState as MerkadePublicState;
  const secret = state.secretState as MerkadeSecretState;

  if (pub.phase === "fib_answer") {
    const truth = secret.fib?.truth ?? "";
    let botLie = "A mystery answer";
    if (botLie.toLowerCase() === truth.toLowerCase()) {
      botLie = "Another guess";
    }
    return { type: "submit_fib_lie", seat, payload: { text: botLie } };
  }

  if (pub.phase === "fib_vote") {
    const options = pub.fibOptions ?? [];
    const ownLieIdx = (secret.fib?.authorsBySeat as Record<number, number | undefined>)?.[seat];
    const validIndices: number[] = [];
    for (let i = 0; i < options.length; i++) {
      if (i !== ownLieIdx) validIndices.push(i);
    }
    const choice = validIndices[Math.floor(ctx.rng() * validIndices.length)] ?? 0;
    return { type: "submit_fib_vote", seat, payload: { optionIndex: choice } };
  }

  if (pub.phase === "doodle_draw") {
    return { type: "submit_drawing", seat, payload: { grid: createEmptyGrid() } };
  }

  if (pub.phase === "doodle_guess") {
    const currentArtist = pub.doodleCurrentArtist ?? 0;
    const realWord = (secret.doodle?.wordsBySeat as Record<number, string | undefined>)?.[currentArtist] ?? "";
    let botGuess = "A mystery object";
    if (botGuess.toLowerCase() === realWord.toLowerCase()) {
      botGuess = "A funny shape";
    }
    return { type: "submit_guess", seat, payload: { text: botGuess } };
  }

  if (pub.phase === "doodle_vote") {
    const options = pub.doodleGuessOptions ?? [];
    const ownGuessIdx = (secret.doodle?.authorsBySeat as Record<number, number | undefined>)?.[seat];
    const validIndices: number[] = [];
    for (let i = 0; i < options.length; i++) {
      if (i !== ownGuessIdx) validIndices.push(i);
    }
    const choice = validIndices[Math.floor(ctx.rng() * validIndices.length)] ?? 0;
    return { type: "submit_guess_vote", seat, payload: { optionIndex: choice } };
  }

  if (pub.phase === "majority_answer") {
    const choice = ctx.rng() < 0.5 ? 0 : 1;
    const predictedMajority = ctx.rng() < 0.5 ? 0 : 1;
    return { type: "submit_majority", seat, payload: { choice, predictedMajority } };
  }

  return null;
}
