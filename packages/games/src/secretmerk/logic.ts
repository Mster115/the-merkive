import type {
  GameAction,
  GameContext,
  GameStateIn,
  ReduceError,
  ReduceResult,
  SeatIndex,
} from "@merky/game-sdk";

export type SecretRole = "loyalist" | "merker" | "secret_merk";
export type Team = "loyalists" | "merkers";
export type DecreeType = "loyalist" | "merker";
export type Phase =
  | "nominate"
  | "vote"
  | "legislative_president"
  | "legislative_chancellor"
  | "executive_investigate"
  | "executive_nominate"
  | "executive_peek"
  | "executive_execute"
  | "game_over";

export interface SecretMerkPublicState {
  presidentSeat: SeatIndex;
  chancellorSeat: SeatIndex | null;
  nominatedChancellor: SeatIndex | null;
  lastPresidentSeat: SeatIndex | null;
  lastChancellorSeat: SeatIndex | null;
  votes: Partial<Record<SeatIndex, boolean>>;
  loyalistPassed: number;
  merkerPassed: number;
  failedElections: number;
  deckCount: number;
  discardCount: number;
  phase: Phase;
  activePower: "investigate" | "nominate" | "peek" | "execute" | null;
  lastVotePassed: boolean | null;
  lastEnacted: DecreeType | null;
  investigatedSeat: SeatIndex | null;
  investigationIsMerker: boolean | null;
  executedSeat: SeatIndex | null;
  deadSeats: SeatIndex[];
  winnerTeam: Team | null;
  winReason: string | null;
  _roles: Partial<Record<SeatIndex, SecretRole>>;
  _deck: DecreeType[];
  _discard: DecreeType[];
}

export interface SecretMerkPrivateState {
  role: SecretRole;
  team: Team;
  knownMerkers: SeatIndex[];
  drawnDecrees: DecreeType[] | null;
  peekedDecrees: DecreeType[] | null;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = res[i]!;
    res[i] = res[j]!;
    res[j] = tmp;
  }
  return res;
}

function createDecreeDeck(rng: () => number): DecreeType[] {
  const deck: DecreeType[] = [
    ...Array<DecreeType>(6).fill("loyalist"),
    ...Array<DecreeType>(11).fill("merker"),
  ];
  return shuffle(deck, rng);
}

export function initSecretMerk(ctx: GameContext): ReduceResult {
  const seats = ctx.seats.map((s) => s.seatIndex).sort((a, b) => a - b);
  const count = seats.length;

  let merkerCount = 1;
  if (count >= 7) merkerCount = 2;
  if (count >= 9) merkerCount = 3;

  const rolesList: SecretRole[] = [
    "secret_merk",
    ...Array<SecretRole>(merkerCount).fill("merker"),
    ...Array<SecretRole>(count - 1 - merkerCount).fill("loyalist"),
  ];

  const shuffledRoles = shuffle(rolesList, ctx.rng);
  const roles: Partial<Record<SeatIndex, SecretRole>> = {};
  const merkerSeats: SeatIndex[] = [];

  seats.forEach((seat, idx) => {
    const role = shuffledRoles[idx]!;
    roles[seat] = role;
    if (role === "merker" || role === "secret_merk") {
      merkerSeats.push(seat);
    }
  });

  const privates: Partial<Record<SeatIndex, SecretMerkPrivateState>> = {};
  seats.forEach((seat) => {
    const role = roles[seat]!;
    const team: Team = role === "loyalist" ? "loyalists" : "merkers";

    let knownMerkers: SeatIndex[] = [];
    if (role === "merker") {
      knownMerkers = merkerSeats;
    } else if (role === "secret_merk" && count <= 6) {
      knownMerkers = merkerSeats;
    }

    privates[seat] = {
      role,
      team,
      knownMerkers,
      drawnDecrees: null,
      peekedDecrees: null,
    };
  });

  const deck = createDecreeDeck(ctx.rng);

  const pub: SecretMerkPublicState = {
    presidentSeat: seats[0]!,
    chancellorSeat: null,
    nominatedChancellor: null,
    lastPresidentSeat: null,
    lastChancellorSeat: null,
    votes: {},
    loyalistPassed: 0,
    merkerPassed: 0,
    failedElections: 0,
    deckCount: deck.length,
    discardCount: 0,
    phase: "nominate",
    activePower: null,
    lastVotePassed: null,
    lastEnacted: null,
    investigatedSeat: null,
    investigationIsMerker: null,
    executedSeat: null,
    deadSeats: [],
    winnerTeam: null,
    winReason: null,
    _roles: roles,
    _deck: deck,
    _discard: [],
  };

  return {
    publicState: pub,
    privateState: privates,
    phase: "nominate",
    events: [{ type: "game_started", payload: { firstPresident: seats[0] } }],
  };
}

function getNextPresident(
  current: SeatIndex,
  seats: SeatIndex[],
  deadSeats: SeatIndex[]
): SeatIndex {
  const alive = seats.filter((s) => !deadSeats.includes(s)).sort((a, b) => a - b);
  const idx = alive.indexOf(current);
  if (idx === -1 || idx === alive.length - 1) {
    return alive[0]!;
  }
  return alive[idx + 1]!;
}

export function reduceSecretMerk(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = { ...(state.publicState as SecretMerkPublicState) };
  const privates: Partial<Record<SeatIndex, SecretMerkPrivateState>> = {
    ...(state.privateState as Record<SeatIndex, SecretMerkPrivateState>),
  };
  let deck = [...pub._deck];
  let discard = [...pub._discard];

  const aliveSeats = ctx.seats
    .map((s) => s.seatIndex)
    .filter((s) => !pub.deadSeats.includes(s));

  const type = action.type;
  const seat = action.seat as SeatIndex;
  const payload = (action.payload ?? {}) as Record<string, unknown>;

  // 1. NOMINATE CHANCELLOR
  if (type === "nominate_chancellor") {
    if (pub.phase !== "nominate") return { error: "Not in nomination phase", code: "bad_phase" };
    if (seat !== pub.presidentSeat) return { error: "Only President can nominate", code: "not_president" };

    const nominee = Number(payload.nomineeSeat) as SeatIndex;
    if (isNaN(nominee) || !aliveSeats.includes(nominee)) {
      return { error: "Invalid nominee seat", code: "invalid_nominee" };
    }
    if (nominee === pub.presidentSeat) {
      return { error: "President cannot nominate themselves", code: "self_nominate" };
    }
    if (nominee === pub.lastChancellorSeat) {
      return { error: "Term limit: Cannot re-elect previous Chancellor", code: "term_limit" };
    }
    if (aliveSeats.length > 5 && nominee === pub.lastPresidentSeat) {
      return { error: "Term limit: Cannot elect previous President in large games", code: "term_limit" };
    }

    pub.nominatedChancellor = nominee;
    pub.votes = {};
    pub.phase = "vote";

    return {
      publicState: { ...pub, _deck: deck, _discard: discard },
      privateState: privates,
      phase: pub.phase,
      events: [{ type: "nominated", payload: { president: seat, nominee } }],
    };
  }

  // 2. VOTE ON GOVERNMENT
  if (type === "vote") {
    if (pub.phase !== "vote") return { error: "Not in voting phase", code: "bad_phase" };
    if (!aliveSeats.includes(seat)) return { error: "Dead players cannot vote", code: "player_dead" };

    const voteYes = Boolean(payload.vote);
    pub.votes = { ...pub.votes, [seat]: voteYes };

    const votesCount = Object.keys(pub.votes).length;
    if (votesCount >= aliveSeats.length) {
      const yesVotes = Object.values(pub.votes).filter(Boolean).length;
      const passed = yesVotes > aliveSeats.length / 2;

      pub.lastVotePassed = passed;

      if (passed) {
        pub.failedElections = 0;
        pub.chancellorSeat = pub.nominatedChancellor;

        // Check Secret Merk Chancellor win condition
        if (pub.merkerPassed >= 3 && pub._roles[pub.chancellorSeat!] === "secret_merk") {
          pub.phase = "game_over";
          pub.winnerTeam = "merkers";
          pub.winReason = "The Secret Merk was elected Chancellor after 3 Merker Decrees!";
          return {
            publicState: { ...pub, _deck: deck, _discard: discard },
            privateState: privates,
            phase: "game_over",
            matchOver: true,
            events: [{ type: "game_over", payload: { winner: "merkers" } }],
          };
        }

        if (deck.length < 3) {
          deck = shuffle([...deck, ...discard], ctx.rng);
          discard = [];
        }

        const drawn = deck.splice(0, 3);
        pub.deckCount = deck.length;
        pub.discardCount = discard.length;

        privates[pub.presidentSeat] = {
          ...privates[pub.presidentSeat]!,
          drawnDecrees: drawn,
        };

        pub.phase = "legislative_president";
      } else {
        pub.failedElections += 1;
        pub.nominatedChancellor = null;

        if (pub.failedElections >= 3) {
          if (deck.length < 1) {
            deck = shuffle([...deck, ...discard], ctx.rng);
            discard = [];
          }
          const forced = deck.shift()!;
          pub.deckCount = deck.length;
          pub.failedElections = 0;
          pub.lastEnacted = forced;

          if (forced === "loyalist") pub.loyalistPassed += 1;
          if (forced === "merker") pub.merkerPassed += 1;

          if (pub.loyalistPassed >= 5) {
            pub.phase = "game_over";
            pub.winnerTeam = "loyalists";
            pub.winReason = "5 Loyalist Decrees enacted!";
          } else if (pub.merkerPassed >= 6) {
            pub.phase = "game_over";
            pub.winnerTeam = "merkers";
            pub.winReason = "6 Merker Decrees enacted!";
          }
        }

        if (pub.phase !== "game_over") {
          pub.presidentSeat = getNextPresident(pub.presidentSeat, aliveSeats, pub.deadSeats);
          pub.phase = "nominate";
        }
      }
    }

    return {
      publicState: { ...pub, _deck: deck, _discard: discard },
      privateState: privates,
      phase: pub.phase,
      matchOver: pub.phase === "game_over",
      events: [{ type: "vote_cast", payload: { seat, voteYes } }],
    };
  }

  // 3. LEGISLATIVE: PRESIDENT DISCARDS 1 DECREE
  if (type === "discard_president") {
    if (pub.phase !== "legislative_president") return { error: "Not in President discard phase", code: "bad_phase" };
    if (seat !== pub.presidentSeat) return { error: "Only President can discard", code: "not_president" };

    const discardIdx = Number(payload.discardIndex);
    const drawn = privates[pub.presidentSeat]?.drawnDecrees;
    if (!drawn || discardIdx < 0 || discardIdx >= drawn.length) {
      return { error: "Invalid discard index", code: "invalid_discard" };
    }

    const remaining = [...drawn];
    const [discarded] = remaining.splice(discardIdx, 1);
    discard.push(discarded!);
    pub.discardCount = discard.length;

    privates[pub.presidentSeat] = {
      ...privates[pub.presidentSeat]!,
      drawnDecrees: null,
    };
    privates[pub.chancellorSeat!] = {
      ...privates[pub.chancellorSeat!]!,
      drawnDecrees: remaining,
    };

    pub.phase = "legislative_chancellor";

    return {
      publicState: { ...pub, _deck: deck, _discard: discard },
      privateState: privates,
      phase: pub.phase,
      events: [{ type: "president_discarded", payload: { president: seat } }],
    };
  }

  // 4. LEGISLATIVE: CHANCELLOR ENACTS 1 DECREE
  if (type === "enact_chancellor") {
    if (pub.phase !== "legislative_chancellor") return { error: "Not in Chancellor enact phase", code: "bad_phase" };
    if (seat !== pub.chancellorSeat) return { error: "Only Chancellor can enact", code: "not_chancellor" };

    const enactIdx = Number(payload.enactIndex);
    const drawn = privates[pub.chancellorSeat]?.drawnDecrees;
    if (!drawn || enactIdx < 0 || enactIdx >= drawn.length) {
      return { error: "Invalid enact index", code: "invalid_enact" };
    }

    const enacted = drawn[enactIdx]!;
    const discarded = drawn[1 - enactIdx]!;
    discard.push(discarded);
    pub.discardCount = discard.length;
    pub.lastEnacted = enacted;

    privates[pub.chancellorSeat] = {
      ...privates[pub.chancellorSeat]!,
      drawnDecrees: null,
    };

    if (enacted === "loyalist") {
      pub.loyalistPassed += 1;
    } else {
      pub.merkerPassed += 1;
    }

    if (pub.loyalistPassed >= 5) {
      pub.phase = "game_over";
      pub.winnerTeam = "loyalists";
      pub.winReason = "5 Loyalist Decrees enacted!";
      return {
        publicState: { ...pub, _deck: deck, _discard: discard },
        privateState: privates,
        phase: "game_over",
        matchOver: true,
        events: [{ type: "enacted", payload: { decree: enacted, winner: "loyalists" } }],
      };
    }

    if (pub.merkerPassed >= 6) {
      pub.phase = "game_over";
      pub.winnerTeam = "merkers";
      pub.winReason = "6 Merker Decrees enacted!";
      return {
        publicState: { ...pub, _deck: deck, _discard: discard },
        privateState: privates,
        phase: "game_over",
        matchOver: true,
        events: [{ type: "enacted", payload: { decree: enacted, winner: "merkers" } }],
      };
    }

    pub.lastPresidentSeat = pub.presidentSeat;
    pub.lastChancellorSeat = pub.chancellorSeat;

    if (enacted === "merker") {
      const count = aliveSeats.length;
      const m = pub.merkerPassed;
      if (m === 1 && count >= 9) pub.phase = "executive_investigate";
      else if (m === 2 && count >= 7) pub.phase = "executive_investigate";
      else if (m === 3) pub.phase = count >= 7 ? "executive_nominate" : "executive_peek";
      else if (m === 4 || m === 5) pub.phase = "executive_execute";
    }

    if (!pub.phase.startsWith("executive")) {
      pub.presidentSeat = getNextPresident(pub.presidentSeat, aliveSeats, pub.deadSeats);
      pub.nominatedChancellor = null;
      pub.chancellorSeat = null;
      pub.phase = "nominate";
    }

    return {
      publicState: { ...pub, _deck: deck, _discard: discard },
      privateState: privates,
      phase: pub.phase,
      events: [{ type: "enacted", payload: { decree: enacted } }],
    };
  }

  // 5. EXECUTIVE ACTION: INVESTIGATE IDENTITY
  if (type === "investigate") {
    if (pub.phase !== "executive_investigate") return { error: "Not in investigation phase", code: "bad_phase" };
    if (seat !== pub.presidentSeat) return { error: "Only President can investigate", code: "not_president" };

    const target = Number(payload.targetSeat) as SeatIndex;
    if (!aliveSeats.includes(target) || target === pub.presidentSeat) {
      return { error: "Invalid target seat", code: "invalid_target" };
    }

    const role = pub._roles[target];
    const isMerker = role === "merker" || role === "secret_merk";
    pub.investigatedSeat = target;
    pub.investigationIsMerker = isMerker;

    pub.presidentSeat = getNextPresident(pub.presidentSeat, aliveSeats, pub.deadSeats);
    pub.nominatedChancellor = null;
    pub.chancellorSeat = null;
    pub.phase = "nominate";

    return {
      publicState: { ...pub, _deck: deck, _discard: discard },
      privateState: privates,
      phase: pub.phase,
      events: [{ type: "investigated", payload: { president: seat, target } }],
    };
  }

  // 6. EXECUTIVE ACTION: EXECUTE PLAYER
  if (type === "execute") {
    if (pub.phase !== "executive_execute") return { error: "Not in execution phase", code: "bad_phase" };
    if (seat !== pub.presidentSeat) return { error: "Only President can execute", code: "not_president" };

    const target = Number(payload.targetSeat) as SeatIndex;
    if (!aliveSeats.includes(target) || target === pub.presidentSeat) {
      return { error: "Invalid target seat", code: "invalid_target" };
    }

    pub.deadSeats = [...pub.deadSeats, target];
    pub.executedSeat = target;

    if (pub._roles[target] === "secret_merk") {
      pub.phase = "game_over";
      pub.winnerTeam = "loyalists";
      pub.winReason = "The Secret Merk was executed!";
      return {
        publicState: { ...pub, _deck: deck, _discard: discard },
        privateState: privates,
        phase: "game_over",
        matchOver: true,
        events: [{ type: "executed", payload: { president: seat, target, isSecretMerk: true } }],
      };
    }

    const remainingAlive = aliveSeats.filter((s) => s !== target);
    pub.presidentSeat = getNextPresident(pub.presidentSeat, remainingAlive, pub.deadSeats);
    pub.nominatedChancellor = null;
    pub.chancellorSeat = null;
    pub.phase = "nominate";

    return {
      publicState: { ...pub, _deck: deck, _discard: discard },
      privateState: privates,
      phase: pub.phase,
      events: [{ type: "executed", payload: { president: seat, target, isSecretMerk: false } }],
    };
  }

  return { error: "Unknown action", code: "unknown_action" };
}

export function onTickSecretMerk(): null {
  return null;
}

export function onSeatAbandonedSecretMerk(): null {
  return null;
}

export function awaitedSeatsSecretMerk(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as SecretMerkPublicState | null;
  if (!pub) return [];

  if (pub.phase === "nominate") return [pub.presidentSeat];
  if (pub.phase === "vote") {
    const aliveSeats = ctx.seats.map((s) => s.seatIndex).filter((s) => !pub.deadSeats.includes(s));
    return aliveSeats.filter((s) => pub.votes[s] === undefined);
  }
  if (pub.phase === "legislative_president") return [pub.presidentSeat];
  if (pub.phase === "legislative_chancellor" && pub.chancellorSeat !== null) return [pub.chancellorSeat];
  if (pub.phase.startsWith("executive")) return [pub.presidentSeat];

  return [];
}

export function suggestBotActionSecretMerk(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): { type: string; payload?: unknown } | null {
  const pub = state.publicState as SecretMerkPublicState | null;
  if (!pub) return null;

  if (pub.phase === "nominate" && seat === pub.presidentSeat) {
    const aliveSeats = ctx.seats.map((s) => s.seatIndex).filter((s) => !pub.deadSeats.includes(s) && s !== seat);
    if (aliveSeats.length > 0) return { type: "nominate_chancellor", payload: { nomineeSeat: aliveSeats[0] } };
  }

  if (pub.phase === "vote") {
    return { type: "vote", payload: { vote: true } };
  }

  if (pub.phase === "legislative_president" && seat === pub.presidentSeat) {
    return { type: "discard_president", payload: { discardIndex: 0 } };
  }

  if (pub.phase === "legislative_chancellor" && seat === pub.chancellorSeat) {
    return { type: "enact_chancellor", payload: { enactIndex: 0 } };
  }

  if (pub.phase === "executive_investigate" && seat === pub.presidentSeat) {
    const aliveSeats = ctx.seats.map((s) => s.seatIndex).filter((s) => !pub.deadSeats.includes(s) && s !== seat);
    if (aliveSeats.length > 0) return { type: "investigate", payload: { targetSeat: aliveSeats[0] } };
  }

  if (pub.phase === "executive_execute" && seat === pub.presidentSeat) {
    const aliveSeats = ctx.seats.map((s) => s.seatIndex).filter((s) => !pub.deadSeats.includes(s) && s !== seat);
    if (aliveSeats.length > 0) return { type: "execute", payload: { targetSeat: aliveSeats[0] } };
  }

  return null;
}
