import type { SeatIndex } from "@merky/game-sdk";

/** Hidden role. The boss's team allegiance is "merkite" for scoring/knowledge purposes. */
export type Role = "merkizen" | "merkite" | "merkissioner";
/** Public-facing team (the boss counts as team merkite). */
export type Team = "merkizen" | "merkite";
/** A decree card is nothing more than its party tag — no further identity. */
export type Decree = "merkizen" | "merkite";
export type Vote = "yeah" | "nah";
export type Pace = "relaxed" | "standard" | "speedy";
/** Which power (if any) the Nth Merkite decree unlocks, per board. */
export type PowerKind = "audit" | "snap" | "peek" | "banish";
export type Board = "5-6" | "7-8";

export type WinReason =
  | "merkizen_decrees"
  | "boss_banished"
  | "merkite_decrees"
  | "boss_elected";

export interface LastVoteSummary {
  chairSeat: SeatIndex;
  nomineeSeat: SeatIndex;
  tally: { yeah: number; nah: number };
  passed: boolean;
  /** Per-seat cast votes — present ONLY when the `revealVotes` setting is on. */
  votes: Partial<Record<SeatIndex, Vote>> | null;
  auto: boolean;
}

export interface LastEnactedSummary {
  type: Decree;
  viaAnarchy: boolean;
  /** Null only for a MERKY ANARCHY chaos-enact, which has no acting government. */
  chairSeat: SeatIndex | null;
  commissionerSeat: SeatIndex | null;
}

export interface LastBanishSummary {
  by: SeatIndex;
  target: SeatIndex;
  wasBoss: boolean;
}

export interface LastSnapSummary {
  by: SeatIndex;
  target: SeatIndex;
}

export interface LastAuditSummary {
  by: SeatIndex;
  target: SeatIndex;
}

/**
 * Everything a client (TV or any phone) ever receives, broadcast verbatim.
 * MUST NEVER contain: roles, deck/discard composition, hands, uncast votes,
 * audit results, or peeked cards. See logic.ts for the enforcement.
 */
export interface MerkissionerPublicState {
  playerCount: number;
  board: Board;
  merkizenEnacted: number;
  merkiteEnacted: number;
  gridlock: number;
  drawCount: number;
  discardCount: number;
  readySeats: SeatIndex[];
  banishedSeats: SeatIndex[];
  auditedSeats: SeatIndex[];
  chairSeat: SeatIndex;
  nomineeSeat: SeatIndex | null;
  commissionerSeat: SeatIndex | null;
  lastChairSeat: SeatIndex | null;
  lastCommissionerSeat: SeatIndex | null;
  rotationAnchorSeat: SeatIndex;
  pendingSnapTarget: SeatIndex | null;
  votedSeats: SeatIndex[];
  vetoRefusedThisSession: boolean;
  activePower: PowerKind | null;
  roundNumber: number;
  lastVote: LastVoteSummary | null;
  lastEnacted: LastEnactedSummary | null;
  lastAudit: LastAuditSummary | null;
  lastPeekBy: SeatIndex | null;
  lastSnap: LastSnapSummary | null;
  lastBanish: LastBanishSummary | null;
  anarchyCount: number;
  winnerTeam: Team | null;
  winReason: WinReason | null;
  revealedRoles: Partial<Record<SeatIndex, Role>> | null;
  /** Cumulative per-seat totals — set exactly once, at game_over. */
  _totals: Partial<Record<SeatIndex, number>>;
}

/** Per-seat legitimate knowledge only. Never merged for you — always carry every field forward. */
export interface MerkissionerPrivateState {
  role: Role;
  knownMerkites: SeatIndex[];
  knownBoss: SeatIndex | null;
  myVote: Vote | null;
  hand: Decree[] | null;
  auditResults: { seat: SeatIndex; party: Team }[];
  peek: Decree[] | null;
}

/** Server-only: the composition of the draw/discard piles and any committed top-of-deck cards. */
export interface MerkissionerSecret {
  draw: { merkizen: number; merkite: number };
  discard: { merkizen: number; merkite: number };
  topStack: Decree[];
}

export interface MerkissionerSettings {
  pace: Pace;
  timersEnabled: boolean;
  revealVotes: boolean;
}
