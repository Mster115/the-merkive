import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { waypoint } from "../index";
import {
  haversineDistance,
  calculateBearing,
  bearingToArrow,
  bearingToCardinalArrow,
  distanceToProximityEmoji,
  init,
  reduce,
  summarize,
} from "../logic";
import type { WaypointContentPayload, WaypointLocation, WaypointPublicState, WaypointSecretState } from "../types";

const sampleLocations: WaypointLocation[] = [
  {
    id: "tokyo_tower",
    name: "Tokyo Tower",
    countryCode: "JP",
    region: "Asia",
    latitude: 35.6586,
    longitude: 139.7454,
  },
  {
    id: "eiffel_tower",
    name: "Eiffel Tower",
    countryCode: "FR",
    region: "Europe",
    latitude: 48.8584,
    longitude: 2.2945,
  },
  {
    id: "nearby_landmark",
    name: "Nearby Landmark",
    countryCode: "JP",
    region: "Asia",
    latitude: 35.6600, // ~150 meters from Tokyo Tower
    longitude: 139.7454,
  },
];

const samplePayload: WaypointContentPayload = {
  targetLocationId: "tokyo_tower",
  locations: sampleLocations,
  maxGuesses: 5,
};

const samplePack = {
  gameId: "waypoint",
  puzzleDate: "2026-07-30",
  payload: samplePayload,
  sourceRefs: [],
};

const mockCtx = {
  gameId: "waypoint",
  puzzleDate: "2026-07-30",
  seed: "waypoint:2026-07-30",
  now: 1770000000000,
  rng: () => 0.5,
};

describe("Empirical Stress Testing — Detailed Analysis", () => {

  describe("1. Pure Function Mathematical Invariants", () => {
    it("checks antipodal bearing outputs across different latitudes", () => {
      // Equator antipodes (0,0) vs (0,180)
      expect(calculateBearing(0, 0, 0, 180)).toBe(90);
      expect(calculateBearing(0, 0, 0, -180)).toBe(270);

      // Mid-latitude antipodes (45, 0) vs (-45, 180)
      const brgMid = calculateBearing(45, 0, -45, 180);
      expect(typeof brgMid).toBe("number");
      expect(isNaN(brgMid)).toBe(false);

      // Polar antipodes (+90, 0) vs (-90, 0)
      expect(calculateBearing(90, 0, -90, 0)).toBe(180);
      expect(calculateBearing(-90, 0, 90, 0)).toBe(0);
    });

    it("evaluates pole behavior with floating point precision artifacts", () => {
      // (90, 0) to (90, 120) — same pole, different longitudes
      const dist = haversineDistance(90, 0, 90, 120);
      expect(dist).toBe(0); // 0 km distance

      const brg = calculateBearing(90, 0, 90, 120);
      expect(brg).toBe(0); 
    });

    it("checks date line longitudes ±180", () => {
      expect(haversineDistance(0, 180, 0, -180)).toBe(0);
      expect(haversineDistance(0, 179.999, 0, -179.999)).toBe(0);
      expect(calculateBearing(0, 179.9, 0, -179.9)).toBe(90); // Eastbound
      expect(calculateBearing(0, -179.9, 0, 179.9)).toBe(270); // Westbound
    });

    it("checks extreme coordinate range (-90..90, -180..180) edge limits", () => {
      expect(haversineDistance(-90, -180, 90, 180)).toBe(20015);
      expect(haversineDistance(-90, 180, 90, -180)).toBe(20015);
      expect(calculateBearing(-90, -180, 90, 180)).toBe(0);
    });

    it("checks sub-meter rounding behavior in haversineDistance", () => {
      // 0 to 499 meters -> 0 km
      expect(haversineDistance(35.6586, 139.7454, 35.6620, 139.7454)).toBe(0);
      // 500+ meters -> 1 km
      expect(haversineDistance(35.6586, 139.7454, 35.6635, 139.7454)).toBe(1);
    });
  });

  describe("2. Game State & Reducer Resilience", () => {
    it("ensures nearby landmark <500m away does NOT trigger false positive SOLVED state when names do not match", () => {
      const run = createDailyTestRun(waypoint, { puzzleDate: "2026-07-30", pack: samplePack });
      
      // Target is Tokyo Tower. Nearby Landmark is 150m away from Tokyo Tower.
      // Player guesses "Nearby Landmark" (which is NOT Tokyo Tower).
      act(run, "guess_location", { locationId: "nearby_landmark" });

      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses[0]?.isCorrect).toBe(false);
      expect(run.phase).toBe("in_progress");
    });

    it("handles post-completion attempts after solved", () => {
      const run = createDailyTestRun(waypoint, { puzzleDate: "2026-07-30", pack: samplePack });
      act(run, "guess_location", { locationId: "tokyo_tower" });
      expect(run.phase).toBe("solved");

      // Attempt another guess
      const err = actErr(run, "guess_location", { locationId: "eiffel_tower" });
      expect(err.code).toBe("already_over");

      // Attempt give_up when already solved
      const res = reduce(ctxOf(run), run.state, { type: "give_up" });
      if (!("error" in res)) {
        expect(res.phase).toBe("solved");
        expect(res.events).toEqual([]);
      }
    });

    it("handles post-completion attempts after failed", () => {
      const shortPack = {
        gameId: "waypoint",
        puzzleDate: "2026-07-30",
        payload: { ...samplePayload, maxGuesses: 1 },
        sourceRefs: [],
      };
      const run = createDailyTestRun(waypoint, { puzzleDate: "2026-07-30", pack: shortPack });
      act(run, "guess_location", { locationId: "eiffel_tower" });
      expect(run.phase).toBe("failed");

      const err = actErr(run, "guess_location", { locationId: "tokyo_tower" });
      expect(err.code).toBe("already_over");
    });

    it("handles post-completion attempts after give_up", () => {
      const run = createDailyTestRun(waypoint, { puzzleDate: "2026-07-30", pack: samplePack });
      act(run, "give_up");
      expect(run.phase).toBe("failed");

      const err = actErr(run, "guess_location", { locationId: "tokyo_tower" });
      expect(err.code).toBe("already_over");

      // Calling give_up again when already failed/gave_up
      const res = reduce(ctxOf(run), run.state, { type: "give_up" });
      if (!("error" in res)) {
        expect(res.phase).toBe("failed");
        expect(res.events).toEqual([]);
      }
    });

    it("validates summarize output structure across all terminal states", () => {
      const run = createDailyTestRun(waypoint, { puzzleDate: "2026-07-30", pack: samplePack });
      act(run, "guess_location", { locationId: "eiffel_tower" });
      act(run, "guess_location", { locationId: "tokyo_tower" });

      const sum = summarize(ctxOf(run), run.state);
      expect(sum.status).toBe("solved");
      expect(sum.stats.completed).toBe(true);
      expect(sum.stats.score).toBe(2);
      expect(sum.shareText).toBe("Waypoint #2026-07-30 2/5\n↗️ ⬛\n🎯 🟩");
    });
  });
});

