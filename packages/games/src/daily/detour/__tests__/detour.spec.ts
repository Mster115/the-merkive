import { describe, it, expect } from "vitest";
import { createDailyTestRun, act, actErr, ctxOf } from "../../testing";
import { detour } from "../index";
import { samplePack } from "../logic";
import { validatePack } from "../pack";
import type { DetourPublicState, DetourSecretState } from "../types";
import { getCityGeography, generateProceduralGeography } from "../cityGeography";


describe("detour daily game module", () => {
  it("initializes publicState and secretState correctly without leaking secret coordinates or target route POIs", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [{ url: "https://phila.gov", title: "Phila GIS" }],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    const pub = run.state.publicState as DetourPublicState;
    const sec = run.state.secretState as DetourSecretState;

    expect(pub.cityName).toBe("Philadelphia");
    expect(pub.cityCode).toBe("PHL");
    expect(pub.totalHops).toBe(3);
    expect(pub.currentHopIndex).toBe(0);
    expect(pub.phase).toBe("in_progress");
    expect(pub.status).toBe("in_progress");
    expect(pub.unshroudedDistricts).toContain("University City");
    expect(pub.startPoi.name).toBe("30th Street Station");
    // The summary carries the district only — see the turn-zero leak suite.
    expect(pub.destinationSummary.district).toBe("Sports Complex");
    expect(pub.destinationPoi).toBeUndefined();

    // Secret state checks
    expect(sec.solutionRoute.length).toBe(3);
    expect(sec.solutionRoute[0]?.poiId).toBe("phl_city_hall");
    expect(sec.solutionRoute[2]?.poiId).toBe("phl_linc");

    // Zero secret leak checks in publicState candidatePois
    for (const poi of pub.candidatePois) {
      expect((poi as unknown as Record<string, unknown>).coordinates).toBeUndefined();
    }
  });

  it("handles correct hop submissions sequentially until victory", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    // Hop 1: City Hall
    act(run, "guess_hop", { poiId: "phl_city_hall" });
    let pub = run.state.publicState as DetourPublicState;
    expect(pub.currentHopIndex).toBe(1);
    expect(pub.unshroudedDistricts).toContain("Center City");
    expect(pub.phase).toBe("in_progress");

    // Hop 2: NRG Station
    act(run, "guess_hop", { poiId: "phl_nrg_station" });
    pub = run.state.publicState as DetourPublicState;
    expect(pub.currentHopIndex).toBe(2);
    expect(pub.unshroudedDistricts).toContain("South Philadelphia");
    expect(pub.phase).toBe("in_progress");

    // Hop 3: Lincoln Financial Field (Destination)
    act(run, "guess_hop", { poiId: "phl_linc" });
    pub = run.state.publicState as DetourPublicState;
    expect(pub.phase).toBe("solved");
    expect(pub.status).toBe("solved");
    expect(pub.solved).toBe(true);
    expect(pub.destinationPoi?.name).toBe("Lincoln Financial Field");

    const summary = detour.summarize(ctxOf(run), run.state);
    expect(summary.status).toBe("solved");
    expect(summary.shareText).toContain("Detour");
    expect(summary.stats.completed).toBe(true);
  });

  it("escalates clues through all 4 tiers (Tier 1 stranger, Tier 2 vector) and rejects further hint requests", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    let pub = run.state.publicState as DetourPublicState;
    expect(pub.currentClueTier).toBe(1);
    // Tier 1 is stranger narrative
    expect(pub.currentClue).toContain("Market Street");

    // Tier 1 -> Tier 2 (Vector distance/direction hint)
    act(run, "reveal_clue");
    pub = run.state.publicState as DetourPublicState;
    expect(pub.currentClueTier).toBe(2);
    expect(pub.currentClue).toContain("1.6 km");

    // Tier 2 -> Tier 3 (Category / Architectural tag)
    act(run, "reveal_clue");
    pub = run.state.publicState as DetourPublicState;
    expect(pub.currentClueTier).toBe(3);
    expect(pub.currentClue).toContain("Civic plaza");
    // Tier 3 names the kind of place but must not yet open the district.
    expect(pub.unshroudedDistricts).not.toContain("Center City");

    // Tier 3 -> Tier 4 (Radius / District bounds hint)
    act(run, "reveal_clue");
    pub = run.state.publicState as DetourPublicState;
    expect(pub.currentClueTier).toBe(4);
    expect(pub.currentClue).toContain("bounds");
    expect(pub.unshroudedDistricts).toContain("Center City");

    // Attempting Tier 5 hint request must return error
    actErr(run, "reveal_clue");
  });

  it("handles wrong turn detours and accumulates distance penalties", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    // Wrong guess: Art Museum
    act(run, "guess_hop", { poiId: "phl_art_museum" });
    const pub = run.state.publicState as DetourPublicState;
    expect(pub.currentHopIndex).toBe(0); // Hop index not advanced
    expect(pub.score.wrongTurns).toBe(1);
    expect(pub.hopsSubmitted.length).toBe(1);
    expect(pub.hopsSubmitted[0]?.isCorrect).toBe(false);
    expect(pub.hopsSubmitted[0]?.detourDistanceKm).toBeGreaterThan(0);
  });

  it("fails the game when maximum wrong turn threshold is exceeded", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    // Max wrong turns = totalHops (3) + 5 = 8 wrong turns
    const maxWrongTurns = 3 + 5;
    for (let i = 0; i < maxWrongTurns - 1; i++) {
      act(run, "guess_hop", { poiId: "phl_art_museum" });
    }
    let pub = run.state.publicState as DetourPublicState;
    expect(pub.phase).toBe("in_progress");

    // 8th wrong turn triggers failure
    act(run, "guess_hop", { poiId: "phl_art_museum" });
    pub = run.state.publicState as DetourPublicState;
    expect(pub.phase).toBe("failed");
    expect(pub.status).toBe("failed");
    expect(pub.destinationPoi?.id).toBe("phl_linc");

    const summary = detour.summarize(ctxOf(run), run.state);
    expect(summary.status).toBe("failed");
    expect(summary.stats.completed).toBe(false);
  });

  it("handles give up action correctly", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    act(run, "give_up");
    const pub = run.state.publicState as DetourPublicState;
    expect(pub.phase).toBe("failed");
    expect(pub.status).toBe("failed");
    expect(pub.destinationPoi?.name).toBe("Lincoln Financial Field");
  });

  it("rejects actions after attempt is over", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    act(run, "give_up");
    actErr(run, "guess_hop", { poiId: "phl_city_hall" });
    actErr(run, "reveal_clue");
  });

  it("strictly enforces zero secret leaks in stringified publicState during active play", () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };

    const run = createDailyTestRun(detour, {
      puzzleDate: "2026-08-01",
      pack,
    });

    const pub = run.state.publicState as DetourPublicState;
    const jsonString = JSON.stringify(pub);

    // Destination exact POI details must NOT be present in active publicState
    expect(pub.destinationPoi).toBeUndefined();
    expect(jsonString).not.toContain('"destinationPoi"');

    // Candidate POIs must NOT contain coordinates
    for (const poi of pub.candidatePois) {
      expect((poi as unknown as Record<string, unknown>).coordinates).toBeUndefined();
    }
  });

  it("validates content pack with envelope and bare payload formats", () => {
    const resEnvelope = validatePack(
      {
        gameId: "detour",
        puzzleDate: "2026-08-01",
        payload: samplePack(),
        sourceRefs: [{ url: "https://example.com", title: "Example Source" }],
      },
      "2026-08-01"
    );
    expect(resEnvelope.ok).toBe(true);

    if (resEnvelope.ok) {
      expect(resEnvelope.pack.sourceRefs.length).toBe(1);
    }

    const resBare = validatePack(samplePack(), "2026-08-01");
    expect(resBare.ok).toBe(true);

    const resInvalid = validatePack(
      {
        cityName: "EmptyCity",
        route: [],
      },
      "2026-08-01"
    );
    expect(resInvalid.ok).toBe(false);
  });
});

describe("detour validatePack rejects rather than fabricates", () => {
  // The previous validator silently substituted defaults for anything missing
  // or malformed, so a broken pack validated clean with invented geography in
  // it. A content gate must reject.
  const withRoute = (mutate: (p: ReturnType<typeof samplePack>) => void) => {
    const payload = samplePack();
    mutate(payload);
    return validatePack(payload, "2026-08-01");
  };

  it("does not default a missing city to Philadelphia", () => {
    const res = withRoute((p) => {
      (p as { cityName?: string }).cityName = undefined;
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/cityName/);
  });

  it("does not substitute Philadelphia coordinates for a bad route coordinate", () => {
    const res = withRoute((p) => {
      p.route[1]!.coordinates = [999, 999];
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/coordinates/);
  });

  it("does not substitute coordinates for a bad candidate POI", () => {
    const res = withRoute((p) => {
      (p.candidatePois[2] as { coordinates?: unknown }).coordinates = undefined;
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/coordinates/);
  });

  it("does not auto-generate a clue that names the target", () => {
    const res = withRoute((p) => {
      (p.route[0]!.clues as { tier2_stranger?: string }).tier2_stranger = "";
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/tier2_stranger/);
  });

  it("allows the destination hop to omit clues, since none are ever read from it", () => {
    const res = withRoute((p) => {
      p.route[p.route.length - 1]!.clues = {
        tier1_vector: "",
        tier2_stranger: "",
        tier3_category: "",
      };
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a bank too small to hide the answer", () => {
    const res = withRoute((p) => {
      p.candidatePois = p.candidatePois.slice(0, 3);
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/at least 6/);
  });

  it("rejects a target left alone in its district, which the tier-4 hint would name", () => {
    const res = withRoute((p) => {
      // Strip the only other South Philadelphia landmark, stranding NRG Station.
      p.candidatePois = p.candidatePois.filter(
        (c) => c.id !== "phl_italian_market"
      );
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/South Philadelphia/);
  });

  it("accepts the sample pack, which must model the rules it documents", () => {
    expect(validatePack(samplePack(), "2026-08-01").ok).toBe(true);
  });

  it("rejects duplicate POI ids, which silently mislabel a guess", () => {
    const res = withRoute((p) => {
      p.candidatePois[3]!.id = p.candidatePois[2]!.id;
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/duplicate/i);
  });
});

describe("detour publishes no free answer at turn zero", () => {
  const startState = () => {
    const pack = {
      gameId: "detour",
      puzzleDate: "2026-08-01",
      payload: samplePack(),
      sourceRefs: [],
    };
    const run = createDailyTestRun(detour, { puzzleDate: "2026-08-01", pack });
    return run.state.publicState as DetourPublicState;
  };

  it("does not identify the destination from destinationSummary alone", () => {
    // Broadcasting the destination's category *and* district resolved it to
    // exactly one of nine candidates before the player acted, which solved the
    // last hop for free and made its tier-3 category hint worthless.
    const pub = startState();
    const matches = pub.candidatePois.filter(
      (p) => p.district === pub.destinationSummary.district
    );
    expect(matches.length).toBeGreaterThan(1);
    expect(
      (pub.destinationSummary as Record<string, unknown>).category
    ).toBeUndefined();
  });

  it("unshrouds only the district the player is already standing in", () => {
    // Revealing the start's own district tells the player nothing they do not
    // know. What must never be unshrouded at turn zero is a district holding a
    // target they still have to find.
    const pub = startState();
    expect(pub.unshroudedDistricts).toEqual([pub.startPoi.district]);
  });

  it("keeps every route POI id present exactly once in the bank", () => {
    const pub = startState();
    const ids = pub.candidatePois.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("detour city geography resolution", () => {
  it("resolves hand-crafted geography presets for featured cities", () => {
    const paris = getCityGeography("Paris", "PAR");
    expect(paris.cityName).toBe("Paris");
    expect(paris.polylines.some((p) => p.name === "Seine")).toBe(true);

    const philly = getCityGeography("Philadelphia", "PHL");
    expect(philly.cityName).toBe("Philadelphia");
    expect(philly.polylines.some((p) => p.name === "Delaware River")).toBe(true);

    const nyc = getCityGeography("New York City", "NYC");
    expect(nyc.polylines.some((p) => p.name === "Hudson River")).toBe(true);
  });

  it("generates deterministic procedural geography for unknown cities", () => {
    const geo1 = generateProceduralGeography("Kuala Lumpur", 3.139, 101.686);
    expect(geo1.cityName).toBe("Kuala Lumpur");
    expect(geo1.polylines.length).toBeGreaterThan(0);
    expect(geo1.polylines.some((p) => p.type === "river")).toBe(true);

    const geo2 = generateProceduralGeography("Kuala Lumpur", 3.139, 101.686);
    expect(geo1).toEqual(geo2); // Deterministic output
  });
});


