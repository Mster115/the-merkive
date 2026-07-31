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

export interface WaypointGuess {
  locationId?: string;
  locationName: string;
  distanceKm: number;
  bearingDeg: number;
  cardinalArrow: "↑" | "↗️" | "→" | "↘️" | "↓" | "↙️" | "←" | "↖️" | "🎯";
  directionArrow?: string;
  isCorrect?: boolean;
}

export interface WaypointPublicState {
  guesses: WaypointGuess[];
  phase: "in_progress" | "solved" | "failed";
  status: DailyStatus;
  targetLocationName?: string;
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
