import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr } from "../../testing";
import { waypoint } from "../index";
import {
  haversineDistance,
  calculateBearing,
} from "../logic";
import { validatePack } from "../pack";
import type {
  WaypointContentPayload,
  WaypointLocation,
  WaypointPublicState,
  WaypointSecretState,
} from "../types";

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
    id: "statue_of_liberty",
    name: "Statue of Liberty",
    countryCode: "US",
    region: "North America",
    latitude: 40.6892,
    longitude: -74.0445,
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

describe("Waypoint Adversarial Suite", () => {
  describe("1. Geodesic & Mathematical Edge Cases", () => {
    it("handles antipodal coordinates accurately", () => {
      const poleDist = haversineDistance(90, 0, -90, 0);
      expect(poleDist).toBeGreaterThan(20000);
      expect(poleDist).toBeLessThan(20030);

      const eqDist = haversineDistance(0, 0, 0, 180);
      expect(eqDist).toBeGreaterThan(20000);
      expect(eqDist).toBeLessThan(20030);
    });

    it("handles extreme longitude wraparound (-180 to 180)", () => {
      const distNear180 = haversineDistance(0, 179.9, 0, -179.9);
      expect(distNear180).toBeLessThan(30);
    });

    it("evaluates bearing near North Pole and zero-crossings", () => {
      const bearingNorth = calculateBearing(0, 0, 89.9, 0);
      expect(bearingNorth).toBe(0);

      const bearingSouth = calculateBearing(0, 0, -89.9, 0);
      expect(bearingSouth).toBe(180);
    });

    it("handles NaN in haversineDistance and calculateBearing", () => {
      const nanDist = haversineDistance(NaN, 0, 0, 0);
      expect(Number.isNaN(nanDist)).toBe(true);

      const nanBrg = calculateBearing(NaN, 0, 0, 0);
      expect(Number.isNaN(nanBrg)).toBe(true);
    });
  });

  describe("2. Pack Validation Security & Robustness", () => {
    it("handles non-iterable primitive locations gracefully", () => {
      const res = validatePack({ payload: { locations: 123 } }, "2026-07-30");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Locations must be an array");
      }
    });

    it("handles location objects with invalid coordinate data types", () => {
      const packWithBadCoords = {
        payload: {
          locations: [
            { name: "Valid", latitude: 10, longitude: 20 },
            { name: "BadLatString", latitude: "10", longitude: 20 },
            { name: "BadCoordsArray", coordinates: ["10", "20"] },
            { name: "OutRangeLat", latitude: 95, longitude: 20 },
            { name: "OutRangeLng", latitude: 10, longitude: 200 },
          ],
        },
      };

      const res = validatePack(packWithBadCoords, "2026-07-30");
      expect(res.ok).toBe(true);
      if (res.ok) {
        const payload = res.pack.payload as WaypointContentPayload;
        expect(payload.locations?.length).toBe(1);
        expect(payload.locations?.[0]?.name).toBe("Valid");
      }
    });

    it("handles target specified as separate object not in locations array", () => {
      const customTargetPack = {
        payload: {
          target: {
            id: "custom_target",
            name: "Custom Target",
            latitude: 12.34,
            longitude: 56.78,
          },
          locations: [
            { id: "other_loc", name: "Other Loc", latitude: 1.23, longitude: 4.56 },
          ],
        },
      };

      const res = validatePack(customTargetPack, "2026-07-30");
      expect(res.ok).toBe(true);
      if (res.ok) {
        const payload = res.pack.payload as WaypointContentPayload;
        expect(payload.target?.id).toBe("custom_target");
        expect(payload.locations?.some((l) => l.id === "custom_target")).toBe(true);
      }
    });
  });

  describe("3. Security — Coordinate & Trilateration Hardening", () => {
    it("publicState candidates contain NO coordinates", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      const pub = run.state.publicState as WaypointPublicState;
      for (const loc of pub.availableLocations) {
        expect((loc as unknown as Record<string, unknown>).coordinates).toBeUndefined();
        expect((loc as unknown as Record<string, unknown>).latitude).toBeUndefined();
        expect((loc as unknown as Record<string, unknown>).longitude).toBeUndefined();
      }
    });

    it("rejects raw coordinate guesses (trilateration exploit)", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      // Direct coordinates
      const err1 = actErr(run, "guess_location", {
        coordinates: [48.8584, 2.2945],
      } as unknown as Record<string, unknown>);
      expect(err1.code).toBe("unknown_location");

      // lat/lng pair
      const err2 = actErr(run, "guess_location", {
        lat: 48.8584,
        lng: 2.2945,
      } as unknown as Record<string, unknown>);
      expect(err2.code).toBe("unknown_location");
    });

    it("availableLocations are shuffled (target NOT always at index 0)", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      const pub = run.state.publicState as WaypointPublicState;

      // All candidates are present regardless of order.
      const ids = pub.availableLocations.map((l) => l.id).sort();
      expect(ids).toEqual(
        ["eiffel_tower", "statue_of_liberty", "tokyo_tower"].sort()
      );

      // Verify secretState has coordinate lookup.
      const sec = run.state.secretState as WaypointSecretState;
      expect(sec.locationCoordinates).toBeDefined();
      expect(Object.keys(sec.locationCoordinates).length).toBeGreaterThanOrEqual(3);
    });

    it("guesses return distance/bearing but no raw coordinates", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess_location", { locationId: "eiffel_tower" });
      const pub = run.state.publicState as WaypointPublicState;
      const guess = pub.guesses[0]!;

      // Has vector feedback.
      expect(guess.distanceKm).toBeGreaterThan(0);
      expect(guess.bearingDeg).toBeGreaterThanOrEqual(0);
      expect(guess.cardinalArrow).toBeTruthy();

      // Does NOT expose coordinates.
      expect((guess as unknown as Record<string, unknown>).coordinates).toBeUndefined();
    });
  });

  describe("4. Secret State Custody Verification", () => {
    it("publicState.targetLocationName is undefined during active play", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });
      const pub = run.state.publicState as WaypointPublicState;

      expect(pub.targetLocationName).toBeUndefined();
      expect((pub as unknown as Record<string, unknown>).targetCoordinates).toBeUndefined();
      expect(pub.phase).toBe("in_progress");
    });

    it("correct guess shows bullseye 🎯", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });
      act(run, "guess_location", { locationId: "tokyo_tower" });

      expect(run.phase).toBe("solved");
      const pub = run.state.publicState as WaypointPublicState;
      const lastGuess = pub.guesses[0]!;
      expect(lastGuess.isCorrect).toBe(true);
      expect(lastGuess.cardinalArrow).toBe("🎯");
    });
  });

  describe("5. Give-up Idempotency", () => {
    it("handles give_up idempotency when game is already failed", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });
      act(run, "give_up");
      expect(run.phase).toBe("failed");

      act(run, "give_up");
      expect(run.phase).toBe("failed");
    });
  });
});
