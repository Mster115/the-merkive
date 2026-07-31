import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../testing";
import { waypoint, haversineDistance, calculateBearing, bearingToOctant } from "../waypoint";
import { getDailyGame } from "../index";
import type { WaypointPublicState, WaypointSecretState, WaypointLocation } from "../waypoint/types";

const paris: WaypointLocation = {
  id: "paris",
  name: "Paris",
  coordinates: [48.8566, 2.3522],
  latitude: 48.8566,
  longitude: 2.3522,
  region: "Île-de-France",
  countryCode: "FR",
};

const london: WaypointLocation = {
  id: "london",
  name: "London",
  coordinates: [51.5074, -0.1278],
  latitude: 51.5074,
  longitude: -0.1278,
  region: "Greater London",
  countryCode: "GB",
};

const tokyo: WaypointLocation = {
  id: "tokyo",
  name: "Tokyo",
  coordinates: [35.6762, 139.6503],
  latitude: 35.6762,
  longitude: 139.6503,
  region: "Kanto",
  countryCode: "JP",
};

const sydney: WaypointLocation = {
  id: "sydney",
  name: "Sydney",
  coordinates: [-33.8688, 151.2093],
  latitude: -33.8688,
  longitude: 151.2093,
  region: "New South Wales",
  countryCode: "AU",
};

const berlin: WaypointLocation = {
  id: "berlin",
  name: "Berlin",
  coordinates: [52.52, 13.405],
  latitude: 52.52,
  longitude: 13.405,
  region: "Berlin",
  countryCode: "DE",
};

const rome: WaypointLocation = {
  id: "rome",
  name: "Rome",
  coordinates: [41.9028, 12.4964],
  latitude: 41.9028,
  longitude: 12.4964,
  region: "Lazio",
  countryCode: "IT",
};

const samplePackRaw = {
  target: paris,
  availableLocations: [paris, london, tokyo, sydney, berlin, rome],
  sourceRefs: [{ url: "https://example.com/geodata", title: "GeoData Source" }],
};

describe("Waypoint Daily Game Suite", () => {
  // =========================================================================
  // TIER 1: FEATURE COVERAGE
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("is properly registered in the daily game registry", () => {
      expect(getDailyGame("waypoint")).toBe(waypoint);
      expect(waypoint.meta.id).toBe("waypoint");
      expect(waypoint.meta.tags).toContain("geography");
    });

    it("generatePrompt produces a valid non-empty research prompt", () => {
      const prompt = waypoint.generatePrompt("2026-07-30");
      expect(prompt).toContain("2026-07-30");
      expect(prompt).toContain("Waypoint");
      expect(typeof prompt).toBe("string");
    });

    it("validatePack accepts a valid bare content pack", () => {
      const result = waypoint.validatePack(samplePackRaw, "2026-07-30");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.pack.gameId).toBe("waypoint");
        expect(result.pack.puzzleDate).toBe("2026-07-30");
        const payload = result.pack.payload as any;
        expect(payload.target.name).toBe("Paris");
        expect(payload.availableLocations.length).toBeGreaterThanOrEqual(4);
      }
    });

    it("init creates deterministic initial state without exposing target location name in publicState", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      expect(validated.ok).toBe(true);
      if (!validated.ok) return;

      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      const pub = run.state.publicState as WaypointPublicState;

      expect(["in_progress", "playing"]).toContain(run.phase);
      expect(pub.guesses).toEqual([]);
      expect(pub.maxGuesses).toBe(5);
      expect(pub.solved).toBe(false);
      expect(pub.targetLocationName).toBeFalsy(); // Hidden while playing!
    });

    it("guess_location action appends guess with correct distance, bearing, and arrow", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      // Guess London from Paris target
      const res = act(run, "guess_location", { locationName: "London" });
      expect(["in_progress", "playing"]).toContain(res.phase);
      expect(run.over).toBe(false);

      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses.length).toBe(1);

      const guess = pub.guesses[0]!;
      expect(guess.locationName).toBe("London");
      expect(guess.distanceKm).toBeGreaterThan(300);
      expect(guess.distanceKm).toBeLessThan(400);
      // London to Paris is ~155°, which quantizes to the SE sector (octant 3).
      expect(guess.octant).toBe(3);
    });

    it("give_up action transitions game to gave_up/failed phase and reveals secret target", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      const res = act(run, "give_up");
      expect(["failed", "gave_up"]).toContain(res.phase);
      expect(run.over).toBe(true);

      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.solved).toBe(false);
      expect(pub.targetLocationName).toBe("Paris");
    });

    it("summarize outputs valid DailySummary status, stats, and spoiler-free emoji share text", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      act(run, "guess_location", { locationName: "London" });
      act(run, "guess_location", { locationName: "Paris" });

      const summary = waypoint.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("solved");
      expect(summary.stats.completed).toBe(true);
      expect(summary.stats.score).toBe(2);
      expect(summary.stats.extra?.guessesUsed).toBe(2);
      expect(summary.stats.extra?.solved).toBe(1);

      // Share text formatting
      expect(summary.shareText).toContain("Waypoint #2026-07-30 2/5");
      expect(summary.shareText).toContain("↘️ 🟨"); // London guess (344 km -> second band)
      expect(summary.shareText).toContain("🎯 🟩"); // Paris guess
      expect(summary.shareText.toUpperCase()).not.toContain("PARIS");
      expect(summary.shareText.toUpperCase()).not.toContain("LONDON");
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("exact location match results in distanceKm === 0, 🎯 arrow, and solved phase", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      act(run, "guess_location", { locationName: "Paris" });
      const pub = run.state.publicState as WaypointPublicState;

      expect(run.phase).toBe("solved");
      expect(pub.solved).toBe(true);
      expect(pub.guesses[0]?.distanceKm).toBe(0);
      // A hit has no direction to report.
      expect(pub.guesses[0]?.octant).toBeUndefined();
      expect(pub.targetLocationName).toBe("Paris");
    });

    it("handles antipode (max distance ~20,000 km) and extreme distance matches", () => {
      const dist = haversineDistance(-48.8566, -177.6478, 48.8566, 2.3522);
      expect(dist).toBeGreaterThan(19900);
      expect(dist).toBeLessThan(20100);

      const bearing = calculateBearing(-48.8566, -177.6478, 48.8566, 2.3522);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);

      const octant = bearingToOctant(bearing);
      expect(octant).toBeGreaterThanOrEqual(0);
      expect(octant).toBeLessThanOrEqual(7);
    });

    it("rejects invalid action payloads with appropriate error codes without throwing", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      // Non-object payload
      const err1 = actErr(run, "guess_location", "invalid_string_payload");
      expect(err1.code).toBe("invalid_payload");

      // Non-existent location name and no coordinates
      const err2 = actErr(run, "guess_location", { locationName: "Atlantis" });
      expect(["invalid_location", "unknown_location"]).toContain(err2.code);

      // Unknown action type
      const err3 = actErr(run, "unknown_action_type", {});
      expect(err3.code).toBe("invalid_action");
    });

    it("prevents actions after game is solved or failed", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      // Solve the game
      act(run, "guess_location", { locationName: "Paris" });
      expect(run.phase).toBe("solved");

      // Attempting further guess returns attempt_over or already_over
      const errGuess = actErr(run, "guess_location", { locationName: "London" });
      expect(["attempt_over", "already_over"]).toContain(errGuess.code);

      // give_up after completion is an idempotent no-op
      const resGiveUp = act(run, "give_up");
      expect(resGiveUp.phase).toBe("solved");
    });

    it("validatePack rejects empty or malformed content pack payloads", () => {
      // Null pack
      const res1 = waypoint.validatePack(null, "2026-07-30");
      expect(res1.ok).toBe(false);

      // Missing target
      const res2 = waypoint.validatePack({ availableLocations: [] }, "2026-07-30");
      expect(res2.ok).toBe(false);

      // Invalid latitude (> 90)
      const res3 = waypoint.validatePack(
        {
          target: { name: "InvalidLat", coordinates: [120, 10], region: "X", countryCode: "XX" },
        },
        "2026-07-30"
      );
      expect(res3.ok).toBe(false);

      // Non-string name
      const res4 = waypoint.validatePack(
        {
          target: { name: 12345, coordinates: [10, 10], region: "X", countryCode: "XX" },
        },
        "2026-07-30"
      );
      expect(res4.ok).toBe(false);
    });

    it("enforces max 5 guesses limit, transitioning phase to failed on 5th wrong guess", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      // Make 4 unique wrong guesses
      act(run, "guess_location", { locationName: "London" });
      act(run, "guess_location", { locationName: "Tokyo" });
      act(run, "guess_location", { locationName: "Sydney" });
      act(run, "guess_location", { locationName: "Berlin" });
      expect(["in_progress", "playing"]).toContain(run.phase);

      // 5th wrong guess
      const res5 = act(run, "guess_location", { locationName: "Rome" });
      expect(res5.phase).toBe("failed");
      expect(run.over).toBe(true);

      const pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses.length).toBe(5);
      expect(pub.solved).toBe(false);
      expect(pub.targetLocationName).toBe("Paris");
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations", () => {
    it("handles sequential guesses narrowing down target location", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      // Sydney (far: ~16,960 km) -> Tokyo (mid: ~9,714 km) -> London (close: ~344 km) -> Paris (exact: 0 km)
      act(run, "guess_location", { locationName: "Sydney" });
      act(run, "guess_location", { locationName: "Tokyo" });
      act(run, "guess_location", { locationName: "London" });

      let pub = run.state.publicState as WaypointPublicState;
      expect(pub.guesses.length).toBe(3);
      expect(pub.guesses[0]!.distanceKm).toBeGreaterThan(pub.guesses[1]!.distanceKm);
      expect(pub.guesses[1]!.distanceKm).toBeGreaterThan(pub.guesses[2]!.distanceKm);

      // Final winning guess
      act(run, "guess_location", { locationName: "Paris" });
      pub = run.state.publicState as WaypointPublicState;
      expect(pub.phase).toBe("solved");
      expect(pub.guesses.length).toBe(4);
    });

    it("validatePack validates raw envelope format ({ gameId, puzzleDate, payload, sourceRefs }) and bare payload format equally", () => {
      const sourceRefs = [{ url: "https://example.com/map", title: "Map Ref" }];

      // Envelope format (used by pipeline)
      const envelope = {
        gameId: "waypoint",
        puzzleDate: "2026-07-30",
        payload: {
          target: paris,
          availableLocations: [paris, london],
        },
        sourceRefs,
      };

      const resEnv = waypoint.validatePack(envelope, "2026-07-30");
      expect(resEnv.ok).toBe(true);
      if (resEnv.ok) {
        expect(resEnv.pack.sourceRefs).toEqual(sourceRefs);
        expect((resEnv.pack.payload as any).target.name).toBe("Paris");
      }

      // Bare payload format (used by direct test callers)
      const bare = {
        target: paris,
        availableLocations: [paris, london],
      };
      const resBare = waypoint.validatePack(bare, "2026-07-30");
      expect(resBare.ok).toBe(true);
      if (resBare.ok) {
        expect((resBare.pack.payload as any).target.name).toBe("Paris");
      }
    });

    it("verifies state tracking consistency between init, reduce, and summarize", () => {
      const validated = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validated.ok) return;

      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validated.pack,
      });

      // Initial state summary
      let summary = waypoint.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("in_progress");
      expect(summary.stats.completed).toBe(false);

      // 1 guess summary
      act(run, "guess_location", { locationName: "London" });
      summary = waypoint.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("in_progress");

      // Give up summary
      act(run, "give_up");
      summary = waypoint.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("failed");
      expect(summary.stats.completed).toBe(true);
      expect(summary.stats.score).toBe(0);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS
  // =========================================================================
  describe("Tier 4: Real-World Scenarios", () => {
    it("simulates full daily puzzle lifecycle from seed init to emoji share card generation for a winning game", () => {
      const rawSubmissionEnvelope = {
        gameId: "waypoint",
        puzzleDate: "2026-07-30",
        payload: samplePackRaw,
        sourceRefs: [{ url: "https://maps.example.com", title: "Official Maps" }],
      };

      // Step 1: Content Pipeline Pack Validation
      const validatedPack = waypoint.validatePack(rawSubmissionEnvelope, "2026-07-30");
      expect(validatedPack.ok).toBe(true);
      if (!validatedPack.ok) return;

      // Step 2: Initialize game attempt from seed
      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validatedPack.pack,
        seed: "waypoint:2026-07-30:player-123",
      });

      expect(["in_progress", "playing"]).toContain(run.phase);

      // Step 3: Player makes strategic guesses
      // Guess 1: Tokyo (Far away -> ⬛ or 🟥)
      act(run, "guess_location", { locationName: "Tokyo" });
      // Guess 2: London (Close -> 🟩)
      act(run, "guess_location", { locationName: "London" });
      // Guess 3: Paris (Target location -> 🎯 🟩)
      act(run, "guess_location", { locationName: "Paris" });

      expect(run.phase).toBe("solved");
      expect(run.over).toBe(true);

      // Step 4: Generate client-side share card & summary
      const summary = waypoint.summarize(ctxOf(run), run.state);

      expect(summary.status).toBe("solved");
      expect(summary.stats.completed).toBe(true);
      expect(summary.stats.score).toBe(3);

      const expectedLines = summary.shareText.split("\n");
      expect(expectedLines[0]).toBe("Waypoint #2026-07-30 3/5");
      expect(expectedLines.length).toBe(4); // Title + 3 guesses
      expect(expectedLines[3]).toContain("🎯 🟩"); // Paris
    });

    it("simulates full daily puzzle lifecycle for a failed attempt on max guesses", () => {
      const validatedPack = waypoint.validatePack(samplePackRaw, "2026-07-30");
      if (!validatedPack.ok) return;

      const run = createDailyTestRun(waypoint, {
        puzzleDate: "2026-07-30",
        pack: validatedPack.pack,
      });

      // 5 unique wrong guesses
      const wrongGuesses = ["Tokyo", "Sydney", "London", "Berlin", "Rome"];
      for (let i = 0; i < 5; i++) {
        act(run, "guess_location", { locationName: wrongGuesses[i] });
      }

      expect(run.phase).toBe("failed");
      expect(run.over).toBe(true);

      const summary = waypoint.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("failed");
      expect(summary.stats.completed).toBe(true);
      expect(summary.stats.score).toBe(0);
      expect(summary.shareText).toContain("Waypoint #2026-07-30 X/5");
    });
  });
});
