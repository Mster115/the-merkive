import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr } from "../../testing";
import { waypoint } from "../index";
import {
  haversineDistance,
  calculateBearing,
  bearingToOctant,
  distanceToProximityEmoji,
} from "../logic";
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
  {
    id: "sydney_opera_house",
    name: "Sydney Opera House",
    countryCode: "AU",
    region: "Oceania",
    latitude: -33.8568,
    longitude: 151.2153,
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

describe("Waypoint Daily Game Engine", () => {
  describe("Mathematical Utilities (Haversine & Bearing)", () => {
    it("computes 0 km distance for identical coordinates", () => {
      const dist = haversineDistance(35.6586, 139.7454, 35.6586, 139.7454);
      expect(dist).toBe(0);
    });

    it("computes accurate geodesic distance between Tokyo and Paris (~9700-9800 km)", () => {
      const dist = haversineDistance(35.6586, 139.7454, 48.8584, 2.2945);
      expect(dist).toBeGreaterThan(9600);
      expect(dist).toBeLessThan(9900);
    });

    it("computes initial compass bearing correctly", () => {
      expect(calculateBearing(0, 0, 10, 0)).toBe(0); // Due North
      expect(calculateBearing(0, 0, 0, 10)).toBe(90); // Due East
      expect(calculateBearing(0, 0, -10, 0)).toBe(180); // Due South
      expect(calculateBearing(0, 0, 0, -10)).toBe(270); // Due West
    });


    it("maps distance to proximity indicators", () => {
      expect(distanceToProximityEmoji(0, true)).toBe("🟩");
      expect(distanceToProximityEmoji(150)).toBe("🟩");
      expect(distanceToProximityEmoji(300)).toBe("🟨");
      expect(distanceToProximityEmoji(1200)).toBe("🟧");
      expect(distanceToProximityEmoji(3500)).toBe("🟥");
      expect(distanceToProximityEmoji(9000)).toBe("⬛");
    });

    it("quantizes bearings to eight sectors, including across the wrap", () => {
      // Sector boundaries sit at 22.5 + 45n.
      expect(bearingToOctant(0)).toBe(0);
      expect(bearingToOctant(22.4)).toBe(0);
      expect(bearingToOctant(22.5)).toBe(1);
      expect(bearingToOctant(90)).toBe(2);
      expect(bearingToOctant(180)).toBe(4);
      expect(bearingToOctant(337.5)).toBe(0); // wraps back to North
      expect(bearingToOctant(359.9)).toBe(0);
      // Out-of-range and negative inputs normalize rather than throw.
      expect(bearingToOctant(-90)).toBe(6);
      expect(bearingToOctant(450)).toBe(2);
    });

    it("never lets a bearing finer than a sector reach the caller", () => {
      // Two bearings inside the same sector must be indistinguishable. If this
      // fails, the direct-geodesic solve is back and one guess wins the game.
      for (let base = 0; base < 360; base += 45) {
        const a = bearingToOctant(base - 22.5 + 1);
        const b = bearingToOctant(base + 22.5 - 1);
        expect(a).toBe(b);
      }
    });

    it("spreads the bands so a shared grid is not all one colour", () => {
      // A globe-spanning bank produced almost nothing but the top band under
      // the old 500/2000/5000 thresholds, so shared grids had no shape.
      const sampled = [50, 400, 900, 2000, 4000, 7000, 12000, 19000].map((km) =>
        distanceToProximityEmoji(km)
      );
      expect(new Set(sampled).size).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Secret State Custody & State Initialization", () => {
    it("initializes without leaking target coordinates or location order to publicState", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      expect(run.phase).toBe("in_progress");

      const pub = run.state.publicState as WaypointPublicState;
      const sec = run.state.secretState as WaypointSecretState;

      // Secret state has target details.
      expect(sec.targetLocationId).toBe("tokyo_tower");
      expect(sec.targetLocationName).toBe("Tokyo Tower");
      expect(sec.targetCoordinates).toEqual({ latitude: 35.6586, longitude: 139.7454 });
      expect(sec.targetRegion).toBe("Asia");
      expect(sec.countryCode).toBe("JP");

      // Secret state has coordinate lookup for all candidates.
      expect(sec.locationCoordinates["tokyo_tower"]).toEqual([35.6586, 139.7454]);
      expect(sec.locationCoordinates["eiffel_tower"]).toEqual([48.8584, 2.2945]);

      // Public state does NOT expose target identity or coordinates.
      expect(pub.targetLocationName).toBeUndefined();
      expect((pub as unknown as Record<string, unknown>).targetCoordinates).toBeUndefined();
      expect((pub as unknown as Record<string, unknown>).countryCode).toBeUndefined();
      expect(pub.guesses).toEqual([]);

      // Candidates have NO coordinates.
      for (const loc of pub.availableLocations) {
        expect((loc as unknown as Record<string, unknown>).coordinates).toBeUndefined();
        expect((loc as unknown as Record<string, unknown>).latitude).toBeUndefined();
        expect((loc as unknown as Record<string, unknown>).longitude).toBeUndefined();
      }

      // Candidates are shuffled — the target is NOT guaranteed at index 0.
      // We verify that all 4 locations are present (order may vary).
      const ids = pub.availableLocations.map((l) => l.id).sort();
      expect(ids).toEqual([
        "eiffel_tower",
        "statue_of_liberty",
        "sydney_opera_house",
        "tokyo_tower",
      ]);
    });
  });

  describe("Game Logic & Action Reduction", () => {
    it("handles incorrect guess and updates vector feedback", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess_location", { locationId: "eiffel_tower" });

      expect(run.phase).toBe("in_progress");
      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses.length).toBe(1);
      expect(pub.guesses[0]!.locationId).toBe("eiffel_tower");
      expect(pub.guesses[0]!.isCorrect).toBe(false);
      expect(pub.guesses[0]!.distanceKm).toBeGreaterThan(9000);
      expect(pub.guesses[0]!.octant).toBeGreaterThanOrEqual(0);

      // The guessed landmark's own position is public so the map can plot it;
      // the exact bearing is not, and neither is the target.
      expect(pub.guesses[0]!.coordinates).toBeDefined();
      expect((pub.guesses[0] as unknown as Record<string, unknown>).bearingDeg).toBeUndefined();
      expect(pub.targetCoordinates).toBeUndefined();
    });

    it("rejects raw coordinate input", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      const err = actErr(run, "guess_location", {
        lat: 48.8584,
        lng: 2.2945,
      } as unknown as Record<string, unknown>);
      expect(err.code).toBe("unknown_location");
    });

    it("rejects unknown locations with snake_case error code", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      const err = actErr(run, "guess_location", { locationId: "unknown_place" });
      expect(err.code).toBe("unknown_location");
    });

    it("rejects duplicate guesses", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess_location", { locationId: "eiffel_tower" });
      const err = actErr(run, "guess_location", { locationId: "eiffel_tower" });
      expect(err.code).toBe("already_guessed");
    });

    it("solves puzzle when correct location is guessed", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess_location", { locationId: "eiffel_tower" });
      act(run, "guess_location", { locationId: "tokyo_tower" });

      expect(run.phase).toBe("solved");
      expect(run.over).toBe(true);

      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.status).toBe("solved");
      expect(pub.targetLocationName).toBe("Tokyo Tower");

      const summary = waypoint.summarize(
        {
          gameId: "waypoint",
          puzzleDate: "2026-07-30",
          seed: "waypoint:2026-07-30",
          now: 0,
          rng: () => 0.5,
        },
        run.state
      );

      expect(summary.status).toBe("solved");
      expect(summary.shareText).toContain("Waypoint #2026-07-30 2/5");
      expect(summary.shareText).toContain("🎯 🟩");
    });

    it("fails puzzle when max guesses exceeded", () => {
      const smallPack = {
        ...samplePack,
        payload: { ...samplePayload, maxGuesses: 2 },
      };
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: smallPack,
      });

      act(run, "guess_location", { locationId: "eiffel_tower" });
      act(run, "guess_location", { locationId: "statue_of_liberty" });

      expect(run.phase).toBe("failed");
      expect(run.over).toBe(true);
    });

    it("handles give_up correctly", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "give_up");

      expect(run.phase).toBe("failed");
      expect(run.over).toBe(true);
      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.targetLocationName).toBe("Tokyo Tower");
    });

    it("rejects guesses after game is over", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "give_up");
      const err = actErr(run, "guess_location", { locationId: "eiffel_tower" });
      expect(err.code).toBe("already_over");
    });

    it("allows give_up to be called idempotently when already failed", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });
      act(run, "give_up");
      expect(run.phase).toBe("failed");

      // Second give_up should not error.
      act(run, "give_up");
      expect(run.phase).toBe("failed");
    });

    it("supports guess by locationName", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess_location", { locationName: "Eiffel Tower" });
      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses.length).toBe(1);
      expect(pub.guesses[0]!.locationId).toBe("eiffel_tower");
    });

    it("supports guess action type alias", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess", { guess: "Eiffel Tower" });
      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses.length).toBe(1);
      expect(pub.guesses[0]!.locationId).toBe("eiffel_tower");
    });
  });

  describe("Share Card / Summary", () => {
    it("produces spoiler-free emoji share card on solve", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "guess_location", { locationId: "eiffel_tower" });
      act(run, "guess_location", { locationId: "tokyo_tower" });

      const summary = waypoint.summarize(
        {
          gameId: "waypoint",
          puzzleDate: "2026-07-30",
          seed: "waypoint:2026-07-30",
          now: 0,
          rng: () => 0.5,
        },
        run.state
      );

      expect(summary.status).toBe("solved");
      expect(summary.shareText).toContain("Waypoint #2026-07-30");
      expect(summary.shareText).toContain("2/5");
      // Should NOT contain the actual target name.
      expect(summary.shareText).not.toContain("Tokyo Tower");
    });

    it("produces X/N on failure", () => {
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: samplePack,
      });

      act(run, "give_up");

      const summary = waypoint.summarize(
        {
          gameId: "waypoint",
          puzzleDate: "2026-07-30",
          seed: "waypoint:2026-07-30",
          now: 0,
          rng: () => 0.5,
        },
        run.state
      );

      expect(summary.status).toBe("failed");
      expect(summary.shareText).toContain("X/5");
    });
  });

  describe("Pack Validation", () => {
    it("validates a well-formed envelope pack", () => {
      const res = waypoint.validatePack(
        {
          gameId: "waypoint",
          puzzleDate: "2026-07-30",
          sourceRefs: [],
          payload: samplePayload,
        },
        "2026-07-30"
      );
      expect(res.ok).toBe(true);
    });

    it("validates a bare payload (no envelope wrapper)", () => {
      const res = waypoint.validatePack(samplePayload, "2026-07-30");
      expect(res.ok).toBe(true);
    });

    it("rejects non-object input", () => {
      const res = waypoint.validatePack(null, "2026-07-30");
      expect(res.ok).toBe(false);
    });

    it("rejects pack with no valid locations", () => {
      const res = waypoint.validatePack({ payload: { locations: [] } }, "2026-07-30");
      expect(res.ok).toBe(false);
    });
  });
});
