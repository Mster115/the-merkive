import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { detour } from "../index";
import { samplePack, calculateDistanceKm } from "../logic";
import type { DetourContentPayload, DetourPublicState } from "../types";
import type { DailyReduceResult } from "../../types";

describe("detour empirical challenger test suite", () => {
  // 1. Wrong turn penalty limit tests
  describe("wrong turn penalty limit", () => {
    it("strictly enforces wrongTurns >= totalHops + 5 threshold for default pack (totalHops = 3)", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      const maxWrongTurns = 3 + 5; // 8 wrong turns max

      // 7 wrong turns should remain in_progress
      for (let i = 1; i <= maxWrongTurns - 1; i++) {
        act(run, "guess_hop", { poiId: "phl_art_museum" });
        const pubMid = run.state.publicState as DetourPublicState;
        expect(pubMid.score.wrongTurns).toBe(i);
        expect(pubMid.score.totalHopsUsed).toBe(i);
        expect(pubMid.phase).toBe("in_progress");
        expect(pubMid.status).toBe("in_progress");
        expect(pubMid.destinationPoi).toBeUndefined();
      }

      // 8th wrong turn triggers failure threshold
      act(run, "guess_hop", { poiId: "phl_art_museum" });
      const pubFail = run.state.publicState as DetourPublicState;
      expect(pubFail.score.wrongTurns).toBe(8);
      expect(pubFail.score.totalHopsUsed).toBe(8);
      expect(pubFail.phase).toBe("failed");
      expect(pubFail.status).toBe("failed");
      expect(pubFail.solved).toBe(false);
      expect(pubFail.destinationPoi).toBeDefined();
      expect(pubFail.destinationPoi?.id).toBe("phl_linc");

      // Verify post-failure attempt rejection
      actErr(run, "guess_hop", { poiId: "phl_city_hall" });
      actErr(run, "reveal_clue");
    });

    it("dynamically adjusts wrong turn penalty limit based on totalHops for custom payload length", () => {
      const customPayload: DetourContentPayload = {
        cityName: "TestCity",
        cityCode: "TST",
        route: [
          {
            hopIndex: 0,
            poiId: "start_poi",
            poiName: "Start Location",
            district: "North",
            coordinates: [40.0, -75.0],
            category: "Station",
            clues: {
              tier1_vector: "Go east",
              tier2_stranger: "Keep going east",
              tier3_category: "Monument",
            },
          },
          {
            hopIndex: 1,
            poiId: "dest_poi",
            poiName: "End Location",
            district: "East",
            coordinates: [40.1, -74.9],
            category: "Park",
            clues: {
              tier1_vector: "Arrived",
              tier2_stranger: "Welcome",
              tier3_category: "End",
            },
          },
        ],
        candidatePois: [
          { id: "start_poi", name: "Start Location", district: "North", coordinates: [40.0, -75.0], category: "Station" },
          { id: "dest_poi", name: "End Location", district: "East", coordinates: [40.1, -74.9], category: "Park" },
          { id: "wrong_poi", name: "Wrong Location", district: "South", coordinates: [39.9, -75.1], category: "Shop" },
        ],
      };

      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: customPayload,
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });
      const pub = run.state.publicState as DetourPublicState;
      expect(pub.totalHops).toBe(1);

      // maxWrongTurns = 1 + 5 = 6
      for (let i = 0; i < 5; i++) {
        act(run, "guess_hop", { poiId: "wrong_poi" });
      }
      expect((run.state.publicState as DetourPublicState).phase).toBe("in_progress");

      act(run, "guess_hop", { poiId: "wrong_poi" });
      const pubFail = run.state.publicState as DetourPublicState;
      expect(pubFail.phase).toBe("failed");
      expect(pubFail.score.wrongTurns).toBe(6);
    });

    it("handles wrong turns interspersed across multiple hops before hitting limit", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      // Hop 0: 3 wrong guesses
      for (let i = 0; i < 3; i++) {
        act(run, "guess_hop", { poiId: "phl_art_museum" });
      }
      expect((run.state.publicState as DetourPublicState).currentHopIndex).toBe(0);

      // Solve Hop 0 -> Hop index 1
      act(run, "guess_hop", { poiId: "phl_city_hall" });
      let pub = run.state.publicState as DetourPublicState;
      expect(pub.currentHopIndex).toBe(1);
      expect(pub.score.wrongTurns).toBe(3);
      expect(pub.score.totalHopsUsed).toBe(4);

      // Hop 1: 4 wrong guesses (Total wrong = 7)
      for (let i = 0; i < 4; i++) {
        act(run, "guess_hop", { poiId: "phl_art_museum" });
      }
      pub = run.state.publicState as DetourPublicState;
      expect(pub.score.wrongTurns).toBe(7);
      expect(pub.phase).toBe("in_progress");

      // Hop 1: 5th wrong guess on hop 1 (Total wrong = 8 -> FAIL)
      act(run, "guess_hop", { poiId: "phl_art_museum" });
      pub = run.state.publicState as DetourPublicState;
      expect(pub.phase).toBe("failed");
      expect(pub.destinationPoi?.id).toBe("phl_linc");
    });
  });

  // 2. Give_up action tests
  describe("give_up action", () => {
    it("allows giving up at start (hop 0) and sets attemptOver and destinationPoi", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      const res = detour.reduce(ctxOf(run), run.state, { type: "give_up" });
      expect("error" in res).toBe(false);
      if (!("error" in res)) {
        const reduceRes = res as DailyReduceResult;
        const pub = reduceRes.publicState as DetourPublicState;
        expect(reduceRes.phase).toBe("failed");
        expect(reduceRes.attemptOver).toBe(true);
        expect(pub.status).toBe("failed");
        expect(pub.destinationPoi?.name).toBe("Lincoln Financial Field");
      }
    });

    it("allows giving up mid-attempt (after hop 1) and correctly identifies target destination", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "guess_hop", { poiId: "phl_city_hall" });
      act(run, "give_up");

      const pub = run.state.publicState as DetourPublicState;
      expect(pub.phase).toBe("failed");
      expect(pub.status).toBe("failed");
      expect(pub.currentHopIndex).toBe(1);
      expect(pub.destinationPoi?.id).toBe("phl_linc");

      const summary = detour.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("failed");
      expect(summary.stats.completed).toBe(false);
    });

    it("returns idempotent current state when give_up is called after game is already over", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "give_up");
      const pubBefore = run.state.publicState as DetourPublicState;

      // Repeat give_up
      const res = detour.reduce(ctxOf(run), run.state, { type: "give_up" });
      expect("error" in res).toBe(false);
      if (!("error" in res)) {
        const reduceRes = res as DailyReduceResult;
        const pubAfter = reduceRes.publicState as DetourPublicState;
        expect(reduceRes.phase).toBe("failed");
        expect(pubAfter).toEqual(pubBefore);
      }
    });
  });

  // 3. Par calculations and summary tests
  describe("par calculations and summarize output", () => {
    it("calculates Par +0 for a zero wrong turn perfect solve", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "guess_hop", { poiId: "phl_city_hall" });
      act(run, "guess_hop", { poiId: "phl_nrg_station" });
      act(run, "guess_hop", { poiId: "phl_linc" });

      const pub = run.state.publicState as DetourPublicState;
      expect(pub.score.par).toBe(3);
      expect(pub.score.totalHopsUsed).toBe(3);
      expect(pub.score.wrongTurns).toBe(0);

      const summary = detour.summarize(ctxOf(run), run.state);
      expect(summary.status).toBe("solved");
      expect(summary.shareText).toContain("Par +0 🟩");
      expect(summary.shareText).toContain("3/3 hops");
      expect(summary.shareText).toContain("🟩🟩🟩");
      expect(summary.stats.completed).toBe(true);
      expect(summary.stats.extra?.wrongTurns).toBe(0);
      expect(summary.stats.extra?.totalHopsUsed).toBe(3);
    });

    it("calculates Par +2 for 2 wrong turns with correct route emojis", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "guess_hop", { poiId: "phl_art_museum" }); // Wrong (🟥)
      act(run, "guess_hop", { poiId: "phl_city_hall" });   // Correct (🟩)
      act(run, "guess_hop", { poiId: "phl_reading_terminal" }); // Wrong (🟥)
      act(run, "guess_hop", { poiId: "phl_nrg_station" }); // Correct (🟩)
      act(run, "guess_hop", { poiId: "phl_linc" });       // Correct (🟩)

      const pub = run.state.publicState as DetourPublicState;
      expect(pub.score.wrongTurns).toBe(2);
      expect(pub.score.totalHopsUsed).toBe(5);

      const summary = detour.summarize(ctxOf(run), run.state);
      expect(summary.shareText).toContain("Par +2 🟨");
      expect(summary.shareText).toContain("3/3 hops");
      expect(summary.shareText).toContain("🟥🟩🟥🟩🟩");
      expect(summary.stats.extra?.wrongTurns).toBe(2);
      expect(summary.stats.extra?.totalHopsUsed).toBe(5);
    });

    it("correctly includes cluesRevealed counter in stats without modifying par delta", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "reveal_clue"); // Clue 1
      act(run, "reveal_clue"); // Clue 2
      act(run, "guess_hop", { poiId: "phl_city_hall" });
      act(run, "guess_hop", { poiId: "phl_nrg_station" });
      act(run, "guess_hop", { poiId: "phl_linc" });

      const pub = run.state.publicState as DetourPublicState;
      expect(pub.score.cluesRevealed).toBe(2);
      expect(pub.score.wrongTurns).toBe(0);

      const summary = detour.summarize(ctxOf(run), run.state);
      expect(summary.shareText).toContain("Par +0 🟩");
      expect(summary.stats.extra?.cluesRevealed).toBe(2);
    });
  });

  // 4. Fog-of-war unshrouding tests
  describe("fog-of-war unshrouding", () => {
    it("starts with only startPoi district unshrouded", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });
      const pub = run.state.publicState as DetourPublicState;

      expect(pub.unshroudedDistricts).toEqual(["University City"]);
    });

    it("unshrouds the target district only at tier 4, not on the first hint", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      // Tiers 2 and 3 must not leak where the target is. Unshrouding here sold
      // the tier-4 payoff at the tier-2 price: because publicState carries each
      // candidate's district, opening "Center City" cut the bank to two.
      act(run, "reveal_clue"); // -> tier 2
      let pub = run.state.publicState as DetourPublicState;
      expect(pub.unshroudedDistricts).toContain("University City");
      expect(pub.unshroudedDistricts).not.toContain("Center City");

      act(run, "reveal_clue"); // -> tier 3
      pub = run.state.publicState as DetourPublicState;
      expect(pub.unshroudedDistricts).not.toContain("Center City");

      act(run, "reveal_clue"); // -> tier 4, the location hint
      pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(4);
      expect(pub.unshroudedDistricts).toContain("Center City");
    });

    it("unshrouds target district when correct hop guess is made", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "guess_hop", { poiId: "phl_city_hall" }); // Center City
      const pub = run.state.publicState as DetourPublicState;
      expect(pub.unshroudedDistricts).toContain("Center City");
    });

    it("does NOT unshroud district of an incorrect guess location", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      // Art Museum is in Fairmount district
      act(run, "guess_hop", { poiId: "phl_art_museum" });
      const pub = run.state.publicState as DetourPublicState;

      expect(pub.unshroudedDistricts).not.toContain("Fairmount");
      expect(pub.unshroudedDistricts).toEqual(["University City"]);
    });

    it("handles deduplication of districts when multiple hops belong to same district", () => {
      const payload: DetourContentPayload = {
        cityName: "MultiDistrictCity",
        cityCode: "MDC",
        route: [
          {
            hopIndex: 0,
            poiId: "start_poi",
            poiName: "Start POI",
            district: "Downtown",
            coordinates: [10, 10],
            category: "Hub",
            clues: { tier1_vector: "Go step 1", tier2_stranger: "", tier3_category: "" },
          },
          {
            hopIndex: 1,
            poiId: "hop1_poi",
            poiName: "Hop 1 POI",
            district: "Downtown",
            coordinates: [10.1, 10.1],
            category: "Shop",
            clues: { tier1_vector: "Go step 2", tier2_stranger: "", tier3_category: "" },
          },
          {
            hopIndex: 2,
            poiId: "hop2_poi",
            poiName: "Hop 2 POI",
            district: "Downtown",
            coordinates: [10.2, 10.2],
            category: "Park",
            clues: { tier1_vector: "Done", tier2_stranger: "", tier3_category: "" },
          },
        ],
        candidatePois: [
          { id: "start_poi", name: "Start POI", district: "Downtown", coordinates: [10, 10], category: "Hub" },
          { id: "hop1_poi", name: "Hop 1 POI", district: "Downtown", coordinates: [10.1, 10.1], category: "Shop" },
          { id: "hop2_poi", name: "Hop 2 POI", district: "Downtown", coordinates: [10.2, 10.2], category: "Park" },
        ],
      };

      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload,
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "guess_hop", { poiId: "hop1_poi" });
      const pub = run.state.publicState as DetourPublicState;
      expect(pub.unshroudedDistricts).toEqual(["Downtown"]);
    });
  });

  // 5. Clue escalation (Tiers 1-4) tests
  describe("clue escalation (Tiers 1-4)", () => {
    it("escalates clues properly from Tier 1 up to Tier 4 and rejects Tier 5 (noting current route index alignment)", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      let pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(1);
      expect(pub.currentClue).toBe(samplePack().route[0]!.clues.tier1_vector);

      // Tier 2
      act(run, "reveal_clue");
      pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(2);
      expect(pub.currentClue).toContain("Market Street");
      expect(pub.score.cluesRevealed).toBe(1);

      // Tier 3
      act(run, "reveal_clue");
      pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(3);
      expect(pub.currentClue).toBe(samplePack().route[0]!.clues.tier3_category);
      expect(pub.score.cluesRevealed).toBe(2);

      // Tier 4
      act(run, "reveal_clue");
      pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(4);
      expect(pub.currentClue).toContain("District bounds hint: Center City [39.95, -75.17, 39.96, -75.16]");
      expect(pub.score.cluesRevealed).toBe(3);

      // Tier 5 attempt returns hints_exhausted
      const errRes = detour.reduce(ctxOf(run), run.state, { type: "reveal_clue" });
      expect("error" in errRes).toBe(true);
      if ("error" in errRes) {
        expect(errRes.code).toBe("hints_exhausted");
      }
    });

    it("resets currentClueTier to 1 and updates currentClue upon solving a hop", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      // Reveal up to Tier 3 on Hop 0
      act(run, "reveal_clue");
      act(run, "reveal_clue");
      let pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(3);

      // Solve Hop 0
      act(run, "guess_hop", { poiId: "phl_city_hall" });
      pub = run.state.publicState as DetourPublicState;

      // Hop index is now 1, tier resets to 1, clue updates to Hop 1 tier 1 vector
      expect(pub.currentHopIndex).toBe(1);
      expect(pub.currentClueTier).toBe(1);
      expect(pub.currentClue).toBe(samplePack().route[1]!.clues.tier1_vector);
      expect(pub.hopsSubmitted[0]?.cluesUsed).toBe(2); // Tier 3 clue used => 3 - 1 = 2 clues used
    });

    it("maintains currentClueTier and currentClue when a guess is wrong", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "reveal_clue"); // Tier 2
      let pub = run.state.publicState as DetourPublicState;
      expect(pub.currentClueTier).toBe(2);
      const clueText = pub.currentClue;

      act(run, "guess_hop", { poiId: "phl_art_museum" }); // Wrong guess
      pub = run.state.publicState as DetourPublicState;

      expect(pub.currentClueTier).toBe(2);
      expect(pub.currentClue).toBe(clueText);
    });

    it("uses fallback format for Tier 4 clue when tier4_radiusBounds is undefined", () => {
      const payload: DetourContentPayload = {
        cityName: "NoBoundsCity",
        cityCode: "NBC",
        route: [
          {
            hopIndex: 0,
            poiId: "start_poi",
            poiName: "Start POI",
            district: "Uptown",
            coordinates: [20, 20],
            category: "Hub",
            clues: { tier1_vector: "Go north", tier2_stranger: "", tier3_category: "" },
          },
          {
            hopIndex: 1,
            poiId: "end_poi",
            poiName: "End POI",
            district: "Midtown",
            coordinates: [20.1, 20.1],
            category: "Park",
            clues: {
              tier1_vector: "Walk north",
              tier2_stranger: "Stranger tip",
              tier3_category: "Park category",
              // tier4_radiusBounds omitted
            },
          },
        ],
        candidatePois: [
          { id: "start_poi", name: "Start POI", district: "Uptown", coordinates: [20, 20], category: "Hub" },
          { id: "end_poi", name: "End POI", district: "Midtown", coordinates: [20.1, 20.1], category: "Park" },
        ],
      };

      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload,
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "reveal_clue"); // Tier 2
      act(run, "reveal_clue"); // Tier 3
      act(run, "reveal_clue"); // Tier 4
      const pub = run.state.publicState as DetourPublicState;

      expect(pub.currentClueTier).toBe(4);
      expect(pub.currentClue).toBe("District hint: Midtown radius area");
    });
  });

  // 6. Additional domain & distance tests
  describe("haversine distance and location resolution", () => {
    it("computes accurate Haversine distance in km", () => {
      // 30th Street Station (39.9558, -75.182) to City Hall (39.9526, -75.1635)
      const dist = calculateDistanceKm([39.9558, -75.182], [39.9526, -75.1635]);
      // Approx 1.6 km
      expect(dist).toBeGreaterThan(1.0);
      expect(dist).toBeLessThan(2.2);
    });

    it("rejects invalid location guess with invalid_location error without incrementing wrongTurns", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      actErr(run, "guess_hop", { poiId: "non_existent_poi" });
      const pub = run.state.publicState as DetourPublicState;
      expect(pub.score.wrongTurns).toBe(0);
      expect(pub.hopsSubmitted.length).toBe(0);
    });

    it("accepts guess by case-insensitive poiName when poiId is missing", () => {
      const pack = {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [],
      };
      const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });

      act(run, "guess_hop", { poiName: "DILWORTH PARK & CITY HALL" });
      const pub = run.state.publicState as DetourPublicState;
      expect(pub.currentHopIndex).toBe(1);
      expect(pub.hopsSubmitted[0]?.isCorrect).toBe(true);
    });
  });
});
