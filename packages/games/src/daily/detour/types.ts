import type { DailyStatus, DailySummary } from "../types";

export interface DetourPoi {
  id: string;
  name: string;
  district: string;
  coordinates: [number, number]; // [lat, lng]
  category: string;
  aliases?: string[];
}

/**
 * Deliberately carries NO coordinates. Publishing them would let a player
 * solve the tier-1 "about 1.6 km east" clue with arithmetic instead of city
 * knowledge, collapsing the clue ladder — the same failure that made Waypoint
 * a one-guess puzzle. The map therefore plots only the start and the hops the
 * player has already committed.
 */
export interface DetourPoiPublic {
  id: string;
  name: string;
  district: string;
  category: string;
}

export interface DetourHopClues {
  tier1_vector: string;
  tier2_stranger: string;
  tier3_category: string;
  tier4_radiusBounds?: [number, number, number, number];
}

export interface DetourSubmittedHop {
  hopIndex: number;
  poiId: string;
  poiName: string;
  isCorrect: boolean;
  cluesUsed: number;
  detourDistanceKm?: number;
  coordinates?: [number, number];
}

export interface DetourPublicState {
  phase: "in_progress" | "solved" | "failed";
  status: DailyStatus;
  cityName: string;
  cityCode: string;
  startPoi: {
    id: string;
    name: string;
    district: string;
    coordinates: [number, number];
  };
  /**
   * The goal framing, deliberately coarse. It carries the district only —
   * broadcasting the destination's category alongside it identified the target
   * outright (in the sample pack, "NFL Stadium | Sports Complex" matched
   * exactly one of nine candidates), so the last hop was solved for free at
   * turn zero and its tier-3 category hint was worthless. The district-decoy
   * rule in validatePack guarantees at least two candidates share this
   * district.
   */
  destinationSummary: {
    district: string;
  };
  totalHops: number;
  currentHopIndex: number;
  hopsSubmitted: DetourSubmittedHop[];
  currentClue: string;
  currentClueTier: number;
  unshroudedDistricts: string[];
  score: {
    totalHopsUsed: number;
    par: number;
    wrongTurns: number;
    cluesRevealed: number;
  };
  candidatePois: DetourPoiPublic[];
  solved: boolean;
  destinationPoi?: {
    id: string;
    name: string;
    district: string;
    coordinates: [number, number];
  };
}

export interface DetourSecretState {
  solutionRoute: Array<{
    hopIndex: number;
    poiId: string;
    poiName: string;
    district: string;
    coordinates: [number, number];
    clues: DetourHopClues;
  }>;
  poiLookup: Record<string, DetourPoi>;
}

export interface DetourContentPayload {
  cityName: string;
  cityCode: string;
  route: Array<{
    hopIndex: number;
    poiId: string;
    poiName: string;
    district: string;
    coordinates: [number, number];
    category: string;
    aliases?: string[];
    clues: DetourHopClues;
  }>;
  candidatePois: DetourPoi[];
}

export type DetourAction =
  | {
      type: "guess_hop";
      payload?: {
        poiId?: string;
        poiName?: string;
      };
    }
  | {
      type: "reveal_clue";
    }
  | {
      type: "give_up";
    };

export type DetourSummary = DailySummary;
