import type {
  GameAction,
  GameContext,
  GameStateIn,
  ReduceError,
  ReduceResult,
  SeatIndex,
} from "@merky/game-sdk";
import {
  applyCastVote,
  applyDiscard,
  applyEnact,
  applyNominate,
  applyProposeVeto,
  applyReadyUp,
  applyResolveVeto,
  applyUsePower,
  checkVoteCompletionAfterAbandon,
  forceReadyAll,
  forceResolveVote,
  initMerkissioner,
} from "./engine";
import {
  nonAbandonedLiving,
  phaseToPowerKind,
  pickRandomLegalNominee,
  pickRandomLegalPowerTarget,
  validateNominateTarget,
  validatePowerTarget,
} from "./helpers";
import type { MerkissionerPrivateState, MerkissionerPublicState, PowerKind, Vote } from "./types";

export function initMerkissionerGame(ctx: GameContext): ReduceResult {
  return initMerkissioner(ctx);
}

export function reduceMerkissioner(
  ctx: GameContext,
  state: GameStateIn,
  action: GameAction
): ReduceResult | ReduceError {
  const pub = state.publicState as MerkissionerPublicState | null;
  if (!pub) return { error: "State not initialized", code: "invalid_state" };

  // Banished seats may never act, in any phase, for any action type.
  if (action.seat !== "system" && pub.banishedSeats.includes(action.seat)) {
    return { error: "You have been banished from the council.", code: "seat_banished" };
  }

  switch (action.type) {
    case "ready_up": {
      if (state.phase !== "huddle") return { error: "The huddle is already over.", code: "bad_phase" };
      if (action.seat === "system") return { error: "Invalid actor.", code: "bad_phase" };
      if (pub.readySeats.includes(action.seat)) {
        return { error: "You already confirmed you're ready.", code: "already_ready" };
      }
      return applyReadyUp(ctx, state, action.seat);
    }

    case "nominate": {
      if (state.phase !== "nominate") return { error: "Nominations are closed right now.", code: "bad_phase" };
      if (action.seat === "system" || action.seat !== pub.chairSeat) {
        return { error: "Only the Chair may nominate a Commissioner.", code: "not_chair" };
      }
      const payload = action.payload as { seat?: unknown } | undefined;
      const rejection = validateNominateTarget(ctx, pub, pub.chairSeat, payload?.seat);
      if (rejection) return rejection;
      return applyNominate(ctx, state, payload?.seat as SeatIndex, false);
    }

    case "cast_vote": {
      if (state.phase !== "vote") return { error: "Voting is closed right now.", code: "bad_phase" };
      if (action.seat === "system") return { error: "Invalid actor.", code: "invalid_vote" };
      const payload = action.payload as { vote?: unknown } | undefined;
      if (payload?.vote !== "yeah" && payload?.vote !== "nah") {
        return { error: "Vote must be MERK YEAH! or MERK NAH!.", code: "invalid_vote" };
      }
      return applyCastVote(ctx, state, action.seat, payload.vote as Vote);
    }

    case "discard_decree": {
      if (state.phase !== "legislative_chair") {
        return { error: "There is nothing to discard right now.", code: "bad_phase" };
      }
      if (action.seat === "system" || action.seat !== pub.chairSeat) {
        return { error: "Only the Chair may discard a decree.", code: "not_chair" };
      }
      const hand = (state.privateState[pub.chairSeat] as MerkissionerPrivateState | undefined)?.hand ?? [];
      const payload = action.payload as { index?: unknown } | undefined;
      const index = payload?.index;
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= hand.length) {
        return { error: "That is not a valid card to discard.", code: "invalid_index" };
      }
      return applyDiscard(ctx, state, index, false);
    }

    case "enact_decree": {
      if (state.phase !== "legislative_commissioner") {
        return { error: "There is nothing to enact right now.", code: "bad_phase" };
      }
      if (action.seat === "system" || pub.commissionerSeat === null || action.seat !== pub.commissionerSeat) {
        return { error: "Only the Commissioner may enact a decree.", code: "not_commissioner" };
      }
      const hand = (state.privateState[pub.commissionerSeat] as MerkissionerPrivateState | undefined)?.hand ?? [];
      const payload = action.payload as { index?: unknown } | undefined;
      const index = payload?.index;
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= hand.length) {
        return { error: "That is not a valid card to enact.", code: "invalid_index" };
      }
      return applyEnact(ctx, state, index, false);
    }

    case "propose_veto": {
      if (state.phase !== "legislative_commissioner") {
        return { error: "You cannot propose a veto right now.", code: "bad_phase" };
      }
      if (action.seat === "system" || pub.commissionerSeat === null || action.seat !== pub.commissionerSeat) {
        return { error: "Only the Commissioner may propose a veto.", code: "not_commissioner" };
      }
      if (pub.merkiteEnacted < 5) return { error: "The veto is not unlocked yet.", code: "veto_locked" };
      if (pub.vetoRefusedThisSession) {
        return { error: "The veto was already refused this session.", code: "veto_already_resolved" };
      }
      return applyProposeVeto(ctx, state);
    }

    case "resolve_veto": {
      if (state.phase !== "veto_pending") return { error: "There is no veto to resolve.", code: "bad_phase" };
      if (action.seat === "system" || action.seat !== pub.chairSeat) {
        return { error: "Only the Chair may resolve the veto.", code: "not_chair" };
      }
      const payload = action.payload as { agree?: unknown } | undefined;
      return applyResolveVeto(ctx, state, payload?.agree === true, false);
    }

    case "use_power": {
      const kind: PowerKind | null = phaseToPowerKind(state.phase);
      if (kind === null) return { error: "There is no power to use right now.", code: "bad_phase" };
      if (action.seat === "system" || action.seat !== pub.chairSeat) {
        return { error: "Only the Chair may use this power.", code: "not_chair" };
      }
      if (kind === "peek") return applyUsePower(ctx, state, null, "peek", false);
      const payload = action.payload as { seat?: unknown } | undefined;
      const rejection = validatePowerTarget(ctx, pub, pub.chairSeat, payload?.seat, kind);
      if (rejection) return rejection;
      return applyUsePower(ctx, state, payload?.seat as SeatIndex, kind, false);
    }

    default:
      return { error: "Unknown action.", code: "unknown_action" };
  }
}

export function onTickMerkissioner(ctx: GameContext, state: GameStateIn): ReduceResult | null {
  const pub = state.publicState as MerkissionerPublicState | null;
  if (!pub) return null;

  switch (state.phase) {
    case "huddle":
      return forceReadyAll(ctx, state);

    case "nominate": {
      const target = pickRandomLegalNominee(ctx, pub, ctx.rng);
      if (target === null) return null;
      return applyNominate(ctx, state, target, true);
    }

    case "vote":
      return forceResolveVote(ctx, state);

    case "legislative_chair": {
      const hand = (state.privateState[pub.chairSeat] as MerkissionerPrivateState | undefined)?.hand ?? [];
      if (hand.length === 0) return null;
      return applyDiscard(ctx, state, Math.floor(ctx.rng() * hand.length), true);
    }

    case "legislative_commissioner": {
      if (pub.commissionerSeat === null) return null;
      const hand = (state.privateState[pub.commissionerSeat] as MerkissionerPrivateState | undefined)?.hand ?? [];
      if (hand.length === 0) return null;
      return applyEnact(ctx, state, Math.floor(ctx.rng() * hand.length), true);
    }

    case "veto_pending":
      return applyResolveVeto(ctx, state, false, true);

    case "power_audit":
    case "power_snap":
    case "power_banish": {
      const kind = phaseToPowerKind(state.phase) as PowerKind;
      const target = pickRandomLegalPowerTarget(ctx, pub, kind, ctx.rng);
      if (target === null) return null;
      return applyUsePower(ctx, state, target, kind, true);
    }

    case "power_peek":
      return applyUsePower(ctx, state, null, "peek", true);

    default:
      return null;
  }
}

export function awaitedSeatsMerkissioner(ctx: GameContext, state: GameStateIn): SeatIndex[] {
  const pub = state.publicState as MerkissionerPublicState | null;
  if (!pub) return [];

  switch (state.phase) {
    case "huddle":
      return nonAbandonedLiving(ctx, pub).filter((s) => !pub.readySeats.includes(s));
    case "nominate":
      return [pub.chairSeat];
    case "vote":
      return nonAbandonedLiving(ctx, pub).filter((s) => !pub.votedSeats.includes(s));
    case "legislative_chair":
      return [pub.chairSeat];
    case "legislative_commissioner":
      return pub.commissionerSeat !== null ? [pub.commissionerSeat] : [];
    case "veto_pending":
      return [pub.chairSeat];
    case "power_audit":
    case "power_snap":
    case "power_peek":
    case "power_banish":
      return [pub.chairSeat];
    default:
      return [];
  }
}

export function suggestBotActionMerkissioner(
  ctx: GameContext,
  state: GameStateIn,
  seat: SeatIndex
): { type: string; payload?: unknown } | null {
  const pub = state.publicState as MerkissionerPublicState | null;
  if (!pub) return null;

  switch (state.phase) {
    case "nominate": {
      if (seat !== pub.chairSeat) return null;
      const target = pickRandomLegalNominee(ctx, pub, ctx.rng);
      return target !== null ? { type: "nominate", payload: { seat: target } } : null;
    }
    case "legislative_chair": {
      if (seat !== pub.chairSeat) return null;
      const hand = (state.privateState[seat] as MerkissionerPrivateState | undefined)?.hand ?? [];
      if (hand.length === 0) return null;
      return { type: "discard_decree", payload: { index: Math.floor(ctx.rng() * hand.length) } };
    }
    case "legislative_commissioner": {
      if (seat !== pub.commissionerSeat) return null;
      const hand = (state.privateState[seat] as MerkissionerPrivateState | undefined)?.hand ?? [];
      if (hand.length === 0) return null;
      return { type: "enact_decree", payload: { index: Math.floor(ctx.rng() * hand.length) } };
    }
    case "veto_pending":
      return seat === pub.chairSeat ? { type: "resolve_veto", payload: { agree: false } } : null;
    case "power_audit":
    case "power_snap":
    case "power_banish": {
      if (seat !== pub.chairSeat) return null;
      const kind = phaseToPowerKind(state.phase) as PowerKind;
      const target = pickRandomLegalPowerTarget(ctx, pub, kind, ctx.rng);
      return target !== null ? { type: "use_power", payload: { seat: target } } : null;
    }
    case "power_peek":
      return seat === pub.chairSeat ? { type: "use_power", payload: {} } : null;
    default:
      return null;
  }
}

export function onSeatAbandonedMerkissioner(
  ctx: GameContext,
  state: GameStateIn,
  _seat: SeatIndex
): ReduceResult | null {
  const pub = state.publicState as MerkissionerPublicState | null;
  if (!pub) return null;

  if (state.phase === "huddle") {
    if (nonAbandonedLiving(ctx, pub).every((s) => pub.readySeats.includes(s))) {
      return forceReadyAll(ctx, state);
    }
    return null;
  }

  if (state.phase === "vote") {
    return checkVoteCompletionAfterAbandon(ctx, state);
  }

  // nominate/legislative/veto/power: the mandatory actor stays awaited even
  // when abandoned (bot coverage handles it on its own schedule) — no
  // immediate re-check needed here.
  return null;
}
