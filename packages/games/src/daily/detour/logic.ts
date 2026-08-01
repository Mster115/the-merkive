import type {
  DailyAction,
  DailyContext,
  DailyContentPack,
  DailyReduceError,
  DailyReduceResult,
  DailyStateIn,
  DailyStatus,
} from "../types";
import type {
  DetourContentPayload,
  DetourPoi,
  DetourPoiPublic,
  DetourPublicState,
  DetourSecretState,
  DetourSubmittedHop,
  DetourSummary,
} from "./types";

/** Haversine formula to compute distance in km between two lat/lng pairs */
export function calculateDistanceKm(coord1: [number, number], coord2: [number, number]): number {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/** Deterministic Fisher-Yates shuffle using provided RNG */
function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export function samplePack(): DetourContentPayload {
  return {
    cityName: "Philadelphia",
    cityCode: "PHL",
    route: [
      {
        hopIndex: 0,
        poiId: "phl_30th_st",
        poiName: "30th Street Station",
        district: "University City",
        coordinates: [39.9558, -75.182],
        category: "Train Station",
        clues: {
          // Clues must never name the target: tier 1 is geometry only, tier 2
          // is landmarks you pass, tier 3 is the category, tier 4 is bounds.
          tier1_vector: "Head about 1.6 km east, across the river.",
          tier2_stranger:
            "Follow Market Street east over the bridge and keep going until the sidewalk opens out into a broad granite plaza with fountains set flush into the ground.",
          tier3_category: "Civic plaza | Center City",
          tier4_radiusBounds: [39.95, -75.17, 39.96, -75.16],
        },
      },
      {
        hopIndex: 1,
        poiId: "phl_city_hall",
        poiName: "Dilworth Park & City Hall",
        district: "Center City",
        coordinates: [39.9526, -75.1635],
        category: "Civic Plaza",
        clues: {
          tier1_vector: "Travel about 5.3 km south.",
          tier2_stranger:
            "Go underground and take the Broad Street Line south, staying on it past the stadium crowds until the train can go no further.",
          tier3_category: "Subway terminus | South Philadelphia",
          tier4_radiusBounds: [39.9, -75.18, 39.92, -75.16],
        },
      },
      {
        hopIndex: 2,
        poiId: "phl_nrg_station",
        poiName: "NRG Station (Sports Complex)",
        district: "South Philadelphia",
        coordinates: [39.9056, -75.1706],
        category: "Subway Station",
        clues: {
          tier1_vector: "Walk about 0.6 km southeast.",
          tier2_stranger:
            "Come up from the platform, cross Pattison Avenue, and head for the largest of the arenas ringing the lot.",
          tier3_category: "NFL stadium | Sports Complex",
          tier4_radiusBounds: [39.89, -75.18, 39.91, -75.16],
        },
      },
      {
        hopIndex: 3,
        poiId: "phl_linc",
        poiName: "Lincoln Financial Field",
        district: "Sports Complex",
        coordinates: [39.9008, -75.1675],
        category: "NFL Stadium",
        clues: {
          tier1_vector: "You have arrived at the destination!",
          tier2_stranger: "Welcome to Lincoln Financial Field!",
          tier3_category: "Destination Reached",
          tier4_radiusBounds: [39.89, -75.17, 39.91, -75.15],
        },
      },
    ],
    candidatePois: [
      {
        id: "phl_30th_st",
        name: "30th Street Station",
        district: "University City",
        coordinates: [39.9558, -75.182],
        category: "Train Station",
      },
      {
        id: "phl_city_hall",
        name: "Dilworth Park & City Hall",
        district: "Center City",
        coordinates: [39.9526, -75.1635],
        category: "Civic Plaza",
      },
      {
        id: "phl_nrg_station",
        name: "NRG Station (Sports Complex)",
        district: "South Philadelphia",
        coordinates: [39.9056, -75.1706],
        category: "Subway Station",
      },
      {
        id: "phl_linc",
        name: "Lincoln Financial Field",
        district: "Sports Complex",
        coordinates: [39.9008, -75.1675],
        category: "NFL Stadium",
      },
      {
        // Decoy sharing South Philadelphia with NRG Station, so the tier-4
        // district hint narrows the field without naming the hop.
        id: "phl_italian_market",
        name: "9th Street Italian Market",
        district: "South Philadelphia",
        coordinates: [39.937, -75.1585],
        category: "Street Market",
      },
      {
        id: "phl_art_museum",
        name: "Philadelphia Museum of Art",
        district: "Fairmount",
        coordinates: [39.9656, -75.181],
        category: "Art Museum",
      },
      {
        id: "phl_reading_terminal",
        name: "Reading Terminal Market",
        district: "Center City",
        coordinates: [39.9533, -75.1592],
        category: "Food Market",
      },
      {
        id: "phl_independence_hall",
        name: "Independence Hall",
        district: "Old City",
        coordinates: [39.9489, -75.15],
        category: "Historic Site",
      },
      {
        id: "phl_citizens_bank_park",
        name: "Citizens Bank Park",
        district: "Sports Complex",
        coordinates: [39.9061, -75.1665],
        category: "MLB Ballpark",
      },
    ],
  };
}

export function init(
  ctx: DailyContext,
  pack: DailyContentPack
): {
  publicState: DetourPublicState;
  secretState: DetourSecretState;
  phase: string;
} {
  const payload = (pack.payload as DetourContentPayload) || samplePack();
  const route = payload.route || samplePack().route;

  const startStep = route[0]!;
  const destinationStep = route[route.length - 1]!;
  const solutionRouteSteps = route.slice(1); // Hop 1 through Destination

  const poiLookup: Record<string, DetourPoi> = {};
  for (const p of payload.candidatePois || []) {
    poiLookup[p.id] = p;
    poiLookup[p.name.toLowerCase()] = p;
  }
  for (const r of route) {
    poiLookup[r.poiId] = {
      id: r.poiId,
      name: r.poiName,
      district: r.district,
      coordinates: r.coordinates,
      category: r.category,
      aliases: r.aliases,
    };
  }

  const rawCandidatesPublic: DetourPoiPublic[] = (payload.candidatePois || []).map((p) => ({
    id: p.id,
    name: p.name,
    district: p.district,
    category: p.category,
  }));

  // Deterministically shuffle candidate POIs using ctx.rng
  const candidatePoisPublic = shuffleArray(rawCandidatesPublic, ctx.rng);

  const secretState: DetourSecretState = {
    solutionRoute: solutionRouteSteps.map((step, idx) => ({
      hopIndex: idx,
      poiId: step.poiId,
      poiName: step.poiName,
      district: step.district,
      coordinates: step.coordinates,
      clues: route[idx]!.clues,
    })),
    poiLookup,
  };

  const firstHopClue =
    route[0]?.clues.tier1_vector || "Follow the directions to your destination.";

  const publicState: DetourPublicState = {
    phase: "in_progress",
    status: "in_progress",
    cityName: payload.cityName || "Philadelphia",
    cityCode: payload.cityCode || "PHL",
    startPoi: {
      id: startStep.poiId,
      name: startStep.poiName,
      district: startStep.district,
      coordinates: startStep.coordinates,
    },
    destinationSummary: {
      district: destinationStep.district,
    },
    totalHops: solutionRouteSteps.length,
    currentHopIndex: 0,
    hopsSubmitted: [],
    currentClue: firstHopClue,
    currentClueTier: 1,
    unshroudedDistricts: [startStep.district],
    score: {
      totalHopsUsed: 0,
      par: solutionRouteSteps.length,
      wrongTurns: 0,
      cluesRevealed: 0,
    },
    candidatePois: candidatePoisPublic,
    solved: false,
  };

  return { publicState, secretState, phase: "in_progress" };
}

export function reduce(
  ctx: DailyContext,
  state: DailyStateIn,
  action: DailyAction
): DailyReduceResult | DailyReduceError {
  const pub = state.publicState as DetourPublicState;
  const sec = state.secretState as DetourSecretState;

  if (!pub || !sec) {
    return { error: "Invalid state structure", code: "invalid_state" };
  }

  if (pub.phase !== "in_progress") {
    if (action.type === "give_up") {
      return { publicState: pub, phase: pub.phase, events: [] };
    }
    return { error: "Attempt is already over", code: "already_over" };
  }

  if (action.type === "give_up") {
    const targetHop = sec.solutionRoute[sec.solutionRoute.length - 1]!;
    const nextState: DetourPublicState = {
      ...pub,
      phase: "failed",
      status: "failed",
      solved: false,
      destinationPoi: {
        id: targetHop.poiId,
        name: targetHop.poiName,
        district: targetHop.district,
        coordinates: targetHop.coordinates,
      },
    };
    return {
      publicState: nextState,
      phase: "failed",
      events: [],
      attemptOver: true,
    };
  }

  if (action.type === "reveal_clue") {
    if (pub.currentClueTier >= 4) {
      return { error: "All hints already revealed for this hop", code: "hints_exhausted" };
    }
    const currentTarget = sec.solutionRoute[pub.currentHopIndex]!;
    const nextTier = pub.currentClueTier + 1;

    let nextClue = "";
    if (nextTier === 2) {
      nextClue = currentTarget.clues.tier2_stranger;
    } else if (nextTier === 3) {
      nextClue = currentTarget.clues.tier3_category;
    } else if (nextTier === 4) {
      if (currentTarget.clues.tier4_radiusBounds) {
        const [minLat, minLng, maxLat, maxLng] = currentTarget.clues.tier4_radiusBounds;
        nextClue = `District bounds hint: ${currentTarget.district} [${minLat}, ${minLng}, ${maxLat}, ${maxLng}]`;
      } else {
        nextClue = `District hint: ${currentTarget.district} radius area`;
      }
    }

    // Only the tier-4 hint is *about* location, so only it may unshroud the
    // target's district. Unshrouding at tier 2 sold the tier-4 payoff at the
    // tier-2 price: on the sample pack it cut an 8-landmark bank to 2, because
    // publicState.candidatePois carries each POI's district.
    const nextUnshrouded =
      nextTier >= 4
        ? Array.from(new Set([...pub.unshroudedDistricts, currentTarget.district]))
        : pub.unshroudedDistricts;

    const nextState: DetourPublicState = {
      ...pub,
      currentClueTier: nextTier,
      currentClue: nextClue,
      unshroudedDistricts: nextUnshrouded,
      score: {
        ...pub.score,
        cluesRevealed: pub.score.cluesRevealed + 1,
      },
    };
    return {
      publicState: nextState,
      phase: "in_progress",
      events: [],
    };
  }

  if (action.type === "guess_hop") {
    const payload = (action.payload as { poiId?: string; poiName?: string }) || {};
    const poiId = payload.poiId;
    const poiName = payload.poiName;

    let guessedPoi = sec.poiLookup[poiId || ""];
    if (!guessedPoi && poiName) {
      guessedPoi = sec.poiLookup[poiName.toLowerCase()];
    }

    if (!guessedPoi) {
      return { error: "Invalid location guess", code: "invalid_location" };
    }

    const currentTargetHop = sec.solutionRoute[pub.currentHopIndex]!;
    const isCorrect =
      guessedPoi.id === currentTargetHop.poiId ||
      guessedPoi.name.toLowerCase() === currentTargetHop.poiName.toLowerCase();

    const previousCoords =
      pub.hopsSubmitted.length > 0
        ? pub.hopsSubmitted[pub.hopsSubmitted.length - 1]!.coordinates || pub.startPoi.coordinates
        : pub.startPoi.coordinates;

    if (isCorrect) {
      const newHop: DetourSubmittedHop = {
        hopIndex: pub.currentHopIndex,
        poiId: currentTargetHop.poiId,
        poiName: currentTargetHop.poiName,
        isCorrect: true,
        cluesUsed: pub.currentClueTier - 1,
        coordinates: currentTargetHop.coordinates,
      };

      const nextHops = [...pub.hopsSubmitted, newHop];
      const nextUnshrouded = Array.from(new Set([...pub.unshroudedDistricts, currentTargetHop.district]));
      const nextHopIdx = pub.currentHopIndex + 1;
      const isWon = nextHopIdx >= pub.totalHops;

      const nextClue = isWon
        ? "Destination Reached!"
        : sec.solutionRoute[nextHopIdx]!.clues.tier1_vector;

      const finalDestinationHop = sec.solutionRoute[sec.solutionRoute.length - 1]!;

      const nextState: DetourPublicState = {
        ...pub,
        currentHopIndex: nextHopIdx,
        hopsSubmitted: nextHops,
        unshroudedDistricts: nextUnshrouded,
        currentClueTier: 1,
        currentClue: nextClue,
        score: {
          ...pub.score,
          totalHopsUsed: pub.score.totalHopsUsed + 1,
        },
        phase: isWon ? "solved" : "in_progress",
        status: isWon ? "solved" : "in_progress",
        solved: isWon,
        destinationPoi: isWon
          ? {
              id: finalDestinationHop.poiId,
              name: finalDestinationHop.poiName,
              district: finalDestinationHop.district,
              coordinates: finalDestinationHop.coordinates,
            }
          : undefined,
      };

      return {
        publicState: nextState,
        phase: isWon ? "solved" : "in_progress",
        events: [],
        attemptOver: isWon,
      };
    } else {
      const detourDist = calculateDistanceKm(previousCoords, guessedPoi.coordinates);
      const wrongTurns = pub.score.wrongTurns + 1;
      const maxWrongTurns = pub.totalHops + 5;
      const isFailed = wrongTurns >= maxWrongTurns;

      const newHop: DetourSubmittedHop = {
        hopIndex: pub.currentHopIndex,
        poiId: guessedPoi.id,
        poiName: guessedPoi.name,
        isCorrect: false,
        cluesUsed: pub.currentClueTier - 1,
        detourDistanceKm: detourDist,
        coordinates: guessedPoi.coordinates,
      };

      const finalDestinationHop = sec.solutionRoute[sec.solutionRoute.length - 1]!;

      const nextState: DetourPublicState = {
        ...pub,
        hopsSubmitted: [...pub.hopsSubmitted, newHop],
        score: {
          ...pub.score,
          wrongTurns,
          totalHopsUsed: pub.score.totalHopsUsed + 1,
        },
        phase: isFailed ? "failed" : "in_progress",
        status: isFailed ? "failed" : "in_progress",
        solved: false,
        destinationPoi: isFailed
          ? {
              id: finalDestinationHop.poiId,
              name: finalDestinationHop.poiName,
              district: finalDestinationHop.district,
              coordinates: finalDestinationHop.coordinates,
            }
          : undefined,
      };

      return {
        publicState: nextState,
        phase: isFailed ? "failed" : "in_progress",
        events: [],
        attemptOver: isFailed,
      };
    }
  }

  return { error: "Unknown action type", code: "unknown_action" };
}

export function summarize(
  ctx: DailyContext,
  state: DailyStateIn
): DetourSummary {
  const publicState = state.publicState as DetourPublicState;
  const isWon = publicState.phase === "solved";
  const isFailed = publicState.phase === "failed";
  const parDelta = publicState.score.wrongTurns;
  const parText = parDelta === 0 ? "Par +0 🟩" : `Par +${parDelta} 🟨`;

  const routeEmojis = publicState.hopsSubmitted
    .map((h) => (h.isCorrect ? "🟩" : "🟥"))
    .join("");

  const status: DailyStatus = isWon ? "solved" : isFailed ? "failed" : "in_progress";

  // Matches the other daily games: a dated header, a score line, then the
  // emoji grid. No URL — none of the others carry one, and the domain that
  // used to be hard-coded here was not the one the app deploys to. The city is
  // named but never the destination, so the card stays spoiler-free.
  const header = ctx.puzzleDate ? `Detour — ${ctx.puzzleDate}` : "Detour";
  const scoreLine = `${publicState.cityName} · ${
    publicState.hopsSubmitted.filter((h) => h.isCorrect).length
  }/${publicState.totalHops} hops | ${parText}`;
  const shareText = `${header}\n${scoreLine}\n\n${routeEmojis}`;

  return {
    status,
    shareText,
    stats: {
      completed: isWon,
      extra: {
        wrongTurns: publicState.score.wrongTurns,
        cluesRevealed: publicState.score.cluesRevealed,
        totalHopsUsed: publicState.score.totalHopsUsed,
      },
    },
  };
}
