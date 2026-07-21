import type { GameContext, SeatIndex, TimerInfo } from "@merky/game-sdk";
import type {
  Board,
  MerkissionerPrivateState,
  MerkissionerPublicState,
  MerkissionerSettings,
  Pace,
  PowerKind,
} from "./types";

const PACE_SECONDS: Record<Pace, number> = { relaxed: 90, standard: 60, speedy: 30 };

export function getSettings(ctx: GameContext): MerkissionerSettings {
  const paceRaw = ctx.settings.pace;
  const pace: Pace = paceRaw === "relaxed" || paceRaw === "speedy" ? paceRaw : "standard";
  const timersEnabled = typeof ctx.settings.timersEnabled === "boolean" ? ctx.settings.timersEnabled : true;
  const revealVotes = typeof ctx.settings.revealVotes === "boolean" ? ctx.settings.revealVotes : true;
  return { pace, timersEnabled, revealVotes };
}

export function baseSeconds(pace: Pace): number {
  return PACE_SECONDS[pace];
}

/** `timersEnabled: false` means every result must carry an explicit `timer: null` — never omit. */
export function makeTimer(ctx: GameContext, kind: string, ms: number, enabled: boolean): TimerInfo | null {
  return enabled ? { endsAt: ctx.now + ms, kind, durationMs: ms } : null;
}

export function allSeats(ctx: GameContext): SeatIndex[] {
  return ctx.seats.map((s) => s.seatIndex);
}

export function isAbandoned(ctx: GameContext, seat: SeatIndex): boolean {
  return ctx.seats.find((s) => s.seatIndex === seat)?.abandoned === true;
}

/** All seats not (yet) banished, in table order. Abandoned seats still count as "living" — bots cover them. */
export function livingSeats(ctx: GameContext, pub: MerkissionerPublicState): SeatIndex[] {
  return allSeats(ctx).filter((s) => !pub.banishedSeats.includes(s));
}

export function nonAbandonedLiving(ctx: GameContext, pub: MerkissionerPublicState): SeatIndex[] {
  return livingSeats(ctx, pub).filter((s) => !isAbandoned(ctx, s));
}

/** Next living seat clockwise (ascending seatIndex, wrapping) from `afterSeat`. */
export function nextLivingSeat(ctx: GameContext, pub: MerkissionerPublicState, afterSeat: SeatIndex): SeatIndex {
  const living = livingSeats(ctx, pub);
  if (living.length === 0) return afterSeat;
  const idx = living.indexOf(afterSeat);
  const startIdx = idx >= 0 ? idx : 0;
  const nextIdx = (startIdx + 1) % living.length;
  return living[nextIdx] ?? afterSeat;
}

/** Which power (if any) the Nth enacted Merkite decree unlocks, per board. The 6th is the Merkite win, not a power. */
export function powerForNthMerkite(board: Board, n: number): PowerKind | null {
  if (board === "5-6") {
    if (n === 3) return "peek";
    if (n === 4 || n === 5) return "banish";
    return null;
  }
  if (n === 2) return "audit";
  if (n === 3) return "snap";
  if (n === 4 || n === 5) return "banish";
  return null;
}

export function phaseToPowerKind(phase: string): PowerKind | null {
  switch (phase) {
    case "power_audit":
      return "audit";
    case "power_snap":
      return "snap";
    case "power_peek":
      return "peek";
    case "power_banish":
      return "banish";
    default:
      return null;
  }
}

export function powerPhaseFor(kind: PowerKind): string {
  return `power_${kind}`;
}

export interface ActionRejection {
  code: string;
  error: string;
}

/** Legal nominee targets: any living seat except the Chair, banished seats, and term-limited seats. */
export function validateNominateTarget(
  ctx: GameContext,
  pub: MerkissionerPublicState,
  chairSeat: SeatIndex,
  targetRaw: unknown
): ActionRejection | null {
  if (typeof targetRaw !== "number" || !allSeats(ctx).includes(targetRaw as SeatIndex)) {
    return { code: "invalid_target", error: "That seat does not exist." };
  }
  const target = targetRaw as SeatIndex;
  if (target === chairSeat) {
    return { code: "self_nomination", error: "You cannot nominate yourself." };
  }
  if (pub.banishedSeats.includes(target)) {
    return { code: "target_banished", error: "That player has been banished from the council." };
  }
  const livingCount = livingSeats(ctx, pub).length;
  if (pub.lastCommissionerSeat === target) {
    return { code: "term_limited", error: "That player just served as Commissioner." };
  }
  if (pub.lastChairSeat === target && livingCount > 5) {
    return { code: "term_limited", error: "That player just served as Chair." };
  }
  return null;
}

export function legalNomineeTargets(ctx: GameContext, pub: MerkissionerPublicState): SeatIndex[] {
  return livingSeats(ctx, pub).filter((t) => validateNominateTarget(ctx, pub, pub.chairSeat, t) === null);
}

export function pickRandomLegalNominee(
  ctx: GameContext,
  pub: MerkissionerPublicState,
  rng: () => number
): SeatIndex | null {
  const legal = legalNomineeTargets(ctx, pub);
  if (legal.length === 0) return null;
  return legal[Math.floor(rng() * legal.length)] ?? legal[0] ?? null;
}

/** Legal power targets: any living seat except the Chair and banished seats; audits additionally exclude repeats. */
export function validatePowerTarget(
  ctx: GameContext,
  pub: MerkissionerPublicState,
  chairSeat: SeatIndex,
  targetRaw: unknown,
  kind: PowerKind
): ActionRejection | null {
  if (typeof targetRaw !== "number" || !allSeats(ctx).includes(targetRaw as SeatIndex)) {
    return { code: "invalid_target", error: "That seat does not exist." };
  }
  const target = targetRaw as SeatIndex;
  if (target === chairSeat) {
    return { code: "self_target", error: "You cannot target yourself." };
  }
  if (pub.banishedSeats.includes(target)) {
    return { code: "target_banished", error: "That player has been banished from the council." };
  }
  if (kind === "audit" && pub.auditedSeats.includes(target)) {
    return { code: "already_audited", error: "That player has already been audited." };
  }
  return null;
}

export function legalPowerTargets(ctx: GameContext, pub: MerkissionerPublicState, kind: PowerKind): SeatIndex[] {
  return livingSeats(ctx, pub).filter((t) => validatePowerTarget(ctx, pub, pub.chairSeat, t, kind) === null);
}

export function pickRandomLegalPowerTarget(
  ctx: GameContext,
  pub: MerkissionerPublicState,
  kind: PowerKind,
  rng: () => number
): SeatIndex | null {
  const legal = legalPowerTargets(ctx, pub, kind);
  if (legal.length === 0) return null;
  return legal[Math.floor(rng() * legal.length)] ?? legal[0] ?? null;
}

const BLANK_PRIVATE: MerkissionerPrivateState = {
  role: "merkizen",
  knownMerkites: [],
  knownBoss: null,
  myVote: null,
  hand: null,
  auditResults: [],
  peek: null,
};

/** Always route private-state edits through this so no field is ever accidentally dropped. */
export function carryPrivate(
  prevMap: Partial<Record<SeatIndex, unknown>>,
  seat: SeatIndex,
  patch: Partial<MerkissionerPrivateState>
): MerkissionerPrivateState {
  const prev = (prevMap[seat] as MerkissionerPrivateState | undefined) ?? BLANK_PRIVATE;
  return { ...prev, ...patch };
}
