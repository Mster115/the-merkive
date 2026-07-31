import type { DailyStatus, DailySummary } from "../types";

export interface WaypointLocation {
  id?: string;
  name: string;
  countryCode: string;
  region: string;
  latitude?: number;
  longitude?: number;
  coordinates?: [number, number]; // [latitude, longitude]
  population?: number;
  hints?: string[];
}

/** Client-visible candidate — coordinates are deliberately omitted. */
export interface WaypointLocationPublic {
  id: string;
  name: string;
  region?: string;
  countryCode?: string;
}

/**
 * Compass octant, 0 = N and increasing clockwise (1 = NE, 2 = E, ...).
 *
 * The exact bearing is deliberately NOT part of a guess. Distance plus an
 * exact bearing from a known landmark is the direct geodesic problem — it has
 * a closed-form solution, so shipping the precise angle let one guess pin the
 * target every time. The content analyser (`analyzeWaypointBank`) has always
 * graded banks against a player reading a 45-degree sector, so quantizing here
 * is what makes the played game match the graded game.
 */
export type WaypointOctant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WaypointGuess {
  locationId?: string;
  locationName: string;
  distanceKm: number;
  /** Undefined once the guess is correct — there is no direction to a hit. */
  octant?: WaypointOctant;
  /**
   * Where the guessed landmark itself sits, so the map can plot it. This is
   * not a leak: the player chose a named, public place, and its position is a
   * fact about a name they already hold. Coordinates for landmarks that have
   * NOT been guessed stay in `secretState` and must never appear here.
   */
  coordinates?: [number, number];
  isCorrect?: boolean;
}

export interface WaypointPublicState {
  guesses: WaypointGuess[];
  phase: "in_progress" | "solved" | "failed";
  status: DailyStatus;
  targetLocationName?: string;
  /** Revealed only once the attempt is over, so the endgame map can plot it. */
  targetCoordinates?: [number, number];
  targetRegion?: string;
  maxGuesses: number;
  solved: boolean;
  availableLocations: WaypointLocationPublic[];
}

export interface WaypointSecretState {
  targetLocationId: string;
  targetLocationName: string;
  targetCoordinates: { latitude: number; longitude: number };
  targetRegion: string;
  countryCode: string;
  /** Coordinate lookup for every candidate, keyed by location id. */
  locationCoordinates: Record<string, [number, number]>;
}

export interface WaypointContentPayload {
  target?: WaypointLocation;
  targetLocationId?: string;
  availableLocations?: WaypointLocation[];
  locations?: WaypointLocation[];
  maxGuesses?: number;
  hint?: string;
}

export type WaypointAction =
  | {
      type: "guess_location" | "guess";
      payload?: {
        locationId?: string;
        locationName?: string;
        guess?: string;
      };
    }
  | {
      type: "give_up";
    };

export type WaypointSummary = DailySummary;
