import type { SeatIndex } from "@merky/game-sdk";
import type { Board, MerkissionerPrivateState, Role } from "./types";

export interface RoleCounts {
  merkizen: number;
  merkite: number;
  merkissioner: 1;
}

/** Role distribution by player count, per the frozen contract. */
export function roleCountsFor(playerCount: number): RoleCounts {
  switch (playerCount) {
    case 6:
      return { merkizen: 4, merkite: 1, merkissioner: 1 };
    case 7:
      return { merkizen: 4, merkite: 2, merkissioner: 1 };
    case 8:
      return { merkizen: 5, merkite: 2, merkissioner: 1 };
    case 9:
      return { merkizen: 6, merkite: 2, merkissioner: 1 };
    case 10:
      return { merkizen: 6, merkite: 3, merkissioner: 1 };
    case 11:
      return { merkizen: 7, merkite: 3, merkissioner: 1 };
    case 12:
      return { merkizen: 7, merkite: 4, merkissioner: 1 };
    case 5:
    default:
      return { merkizen: 3, merkite: 1, merkissioner: 1 };
  }
}

/** 5–6p share the small power track; 7+p share the large one. */
export function boardFor(playerCount: number): Board {
  return playerCount <= 6 ? "5-6" : "7-8";
}

/** 5–6p: boss and the lone Merkite know each other. 7–8p: Merkites know each other AND the boss; the boss knows nobody. */
export function mutualBossKnowledge(playerCount: number): boolean {
  return playerCount <= 6;
}

export interface RoleAssignment {
  roles: Partial<Record<SeatIndex, Role>>;
  bossSeat: SeatIndex;
  merkiteSeats: SeatIndex[];
}

/** Fisher-Yates shuffle using the deterministic match rng. */
export function shuffle<T>(array: readonly T[], rng: () => number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

/** Randomly assigns roles to every seat. Pure given `rng`. */
export function assignRoles(seatIndices: readonly SeatIndex[], rng: () => number): RoleAssignment {
  const counts = roleCountsFor(seatIndices.length);
  const shuffled = shuffle(seatIndices, rng);
  const bossSeat = shuffled[0] as SeatIndex;
  const merkiteSeats = shuffled.slice(1, 1 + counts.merkite) as SeatIndex[];
  const merkizenSeats = shuffled.slice(1 + counts.merkite) as SeatIndex[];

  const roles: Partial<Record<SeatIndex, Role>> = {};
  roles[bossSeat] = "merkissioner";
  for (const s of merkiteSeats) roles[s] = "merkite";
  for (const s of merkizenSeats) roles[s] = "merkizen";

  return { roles, bossSeat, merkiteSeats };
}

/**
 * Builds each seat's starting private knowledge. One uniform rule covers
 * every player count: Merkites always know the boss and their fellow
 * Merkites; the boss only knows their team when knowledge is mutual (5–6p).
 */
export function buildPrivateKnowledge(
  seat: SeatIndex,
  role: Role,
  assignment: RoleAssignment,
  playerCount: number
): Pick<MerkissionerPrivateState, "knownMerkites" | "knownBoss"> {
  if (role === "merkizen") {
    return { knownMerkites: [], knownBoss: null };
  }
  if (role === "merkite") {
    const others = assignment.merkiteSeats.filter((s) => s !== seat);
    return { knownMerkites: others, knownBoss: assignment.bossSeat };
  }
  // merkissioner
  const knownMerkites = mutualBossKnowledge(playerCount) ? [...assignment.merkiteSeats] : [];
  return { knownMerkites, knownBoss: null };
}

/** The public-facing team a role belongs to — the boss reads as Merkite. */
export function teamOfRole(role: Role): "merkizen" | "merkite" {
  return role === "merkizen" ? "merkizen" : "merkite";
}
