import type {
  DailyContext,
  DailyStateIn,
  DailyAction,
  DailyContentPack,
  DailyReduceResult,
  DailyReduceError,
  DailySummary,
  DailyStatus,
} from "../types";
import type {
  WaypointContentPayload,
  WaypointGuess,
  WaypointLocation,
  WaypointLocationPublic,
  WaypointPublicState,
  WaypointSecretState,
} from "./types";
import { getLocationCoords } from "./pack";

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates exact geodesic distance between two [lat, lng] pairs in km
 * using the Haversine formula (unrounded).
 */
export function exactHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const a =
    sinDLat * sinDLat +
    Math.cos(radLat1) * Math.cos(radLat2) * sinDLng * sinDLng;

  const clamped = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
  return EARTH_RADIUS_KM * c;
}

/**
 * Rounded geodesic distance in km.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return Math.round(exactHaversineDistance(lat1, lng1, lat2, lng2));
}

/**
 * Compass initial bearing in degrees (0..360) from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (Math.abs(lat1) === 90) {
    if (lat1 === 90) return lat2 === 90 ? 0 : 180;
    return 0;
  }

  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x =
    Math.cos(radLat1) * Math.sin(radLat2) -
    Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLng);

  const brg = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brg + 360) % 360);
}

/**
 * Maps compass bearing + distance to a cardinal directional arrow.
 */
export function bearingToCardinalArrow(
  bearingDeg: number,
  distanceKm: number
): WaypointGuess["cardinalArrow"] {
  if (distanceKm === 0) return "🎯";

  const b = ((bearingDeg % 360) + 360) % 360;

  if (b >= 337.5 || b < 22.5) return "↑";
  if (b >= 22.5 && b < 67.5) return "↗️";
  if (b >= 67.5 && b < 112.5) return "→";
  if (b >= 112.5 && b < 157.5) return "↘️";
  if (b >= 157.5 && b < 202.5) return "↓";
  if (b >= 202.5 && b < 247.5) return "↙️";
  if (b >= 247.5 && b < 292.5) return "←";
  return "↖️";
}


export function distanceToProximityEmoji(
  distanceKm: number,
  isMatch?: boolean
): string {
  if (isMatch || distanceKm === 0) return "🟩";
  if (distanceKm < 500) return "🟩";
  if (distanceKm < 2000) return "🟨";
  if (distanceKm < 5000) return "🟧";
  return "⬛";
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

/**
 * Seeded shuffle identical to Relay's shuffleBank — prevents the target from
 * sitting at a predictable index in publicState.
 */
function shuffleLocations(
  locs: WaypointLocationPublic[],
  rng: () => number
): WaypointLocationPublic[] {
  const out = [...locs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function init(
  ctx: DailyContext,
  pack: DailyContentPack
): { publicState: WaypointPublicState; secretState: WaypointSecretState; phase: string } {
  const payload = pack.payload as WaypointContentPayload;
  const available = payload.availableLocations ?? payload.locations ?? [];
  const target = payload.target ?? available[0]!;

  const targetCoords = getLocationCoords(target) ?? [0, 0];

  // Build coordinate lookup for secretState — keyed by location id.
  const locationCoordinates: Record<string, [number, number]> = {};
  for (const loc of available) {
    const id = loc.id ?? loc.name.toLowerCase().replace(/\s+/g, "_");
    const coords = getLocationCoords(loc);
    if (coords) {
      locationCoordinates[id] = coords;
    }
  }

  // Public candidates: name/id/region/countryCode only — NO coordinates.
  const sanitizedLocations: WaypointLocationPublic[] = available.map((loc) => ({
    id: loc.id ?? loc.name.toLowerCase().replace(/\s+/g, "_"),
    name: loc.name,
    region: loc.region,
    countryCode: loc.countryCode,
  }));

  const publicState: WaypointPublicState = {
    guesses: [],
    phase: "in_progress",
    status: "in_progress",
    targetLocationName: undefined,
    maxGuesses: payload.maxGuesses ?? 5,
    solved: false,
    availableLocations: shuffleLocations(sanitizedLocations, ctx.rng),
  };

  const targetId =
    target.id ?? payload.targetLocationId ?? target.name.toLowerCase().replace(/\s+/g, "_");

  const secretState: WaypointSecretState = {
    targetLocationId: targetId,
    targetCoordinates: { latitude: targetCoords[0], longitude: targetCoords[1] },
    targetRegion: target.region,
    countryCode: target.countryCode,
    targetLocationName: target.name,
    locationCoordinates,
  };

  return {
    publicState,
    secretState,
    phase: "in_progress",
  };
}

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

export function reduce(
  ctx: DailyContext,
  state: DailyStateIn,
  action: DailyAction
): DailyReduceResult | DailyReduceError {
  const pub = state.publicState as WaypointPublicState;
  const sec = state.secretState as WaypointSecretState;

  if (!pub || !sec) {
    return { error: "Invalid state structure", code: "invalid_state" };
  }

  // Handle actions when game is already over.
  if (pub.phase !== "in_progress") {
    if (action.type === "give_up") {
      return { publicState: pub, phase: pub.phase, events: [] };
    }
    return { error: "Attempt is already over", code: "already_over" };
  }

  if (action.type === "give_up") {
    const updatedPub: WaypointPublicState = {
      ...pub,
      phase: "failed",
      status: "failed",
      solved: false,
      targetLocationName: sec.targetLocationName,
    };
    return {
      publicState: updatedPub,
      phase: "failed",
      events: [{ type: "game_over", payload: { result: "failed" } }],
      attemptOver: true,
    };
  }

  if (action.type === "guess_location" || action.type === "guess") {
    if (!action.payload || typeof action.payload !== "object") {
      return { error: "Payload must be an object", code: "invalid_payload" };
    }

    const payloadObj = action.payload as {
      locationId?: string;
      locationName?: string;
      guess?: string;
    };

    // ---- Resolve guess to a candidate from the bank ONLY ----

    let matchedCandidate: WaypointLocationPublic | undefined;

    // Try locationId first.
    if (payloadObj.locationId) {
      matchedCandidate = pub.availableLocations.find(
        (loc) => loc.id === payloadObj.locationId
      );
    }

    // Try locationName / guess if no id match.
    const nameInput = payloadObj.locationName ?? payloadObj.guess;
    if (!matchedCandidate && nameInput && typeof nameInput === "string") {
      const searchName = nameInput.trim().toLowerCase();
      matchedCandidate = pub.availableLocations.find(
        (loc) =>
          loc.name.trim().toLowerCase() === searchName ||
          loc.id === searchName
      );
    }

    if (!matchedCandidate) {
      return { error: "Unknown location", code: "unknown_location" };
    }

    const guessId = matchedCandidate.id;
    const guessName = matchedCandidate.name;

    // Check duplicate guess.
    if (
      pub.guesses.some(
        (g) => g.locationId === guessId ||
          g.locationName.toLowerCase() === guessName.toLowerCase()
      )
    ) {
      return { error: "Location already guessed", code: "already_guessed" };
    }

    // Look up coordinates from secretState — never from publicState.
    const guessCoords = sec.locationCoordinates[guessId];
    if (!guessCoords) {
      return { error: "Unknown location coordinates", code: "unknown_location" };
    }

    const targetLat = sec.targetCoordinates.latitude;
    const targetLng = sec.targetCoordinates.longitude;

    const distanceKm = haversineDistance(guessCoords[0], guessCoords[1], targetLat, targetLng);
    const exactDistKm = exactHaversineDistance(guessCoords[0], guessCoords[1], targetLat, targetLng);
    const bearingDeg = calculateBearing(guessCoords[0], guessCoords[1], targetLat, targetLng);

    const isIdMatch = guessId === sec.targetLocationId;
    const isExactMatch = exactDistKm < 0.1;
    const isCorrect = isIdMatch || isExactMatch;

    const cardinalArrow = isCorrect
      ? "🎯" as const
      : bearingToCardinalArrow(bearingDeg, distanceKm);

    const newGuess: WaypointGuess = {
      locationId: guessId,
      locationName: guessName,
      distanceKm,
      bearingDeg,
      cardinalArrow,
      directionArrow: cardinalArrow,
      isCorrect: !!isCorrect,
    };

    const newGuesses = [...pub.guesses, newGuess];

    let newPhase: WaypointPublicState["phase"] = "in_progress";
    let newStatus: DailyStatus = "in_progress";
    let solved = false;
    let attemptOver = false;
    let targetLocationName = pub.targetLocationName;

    if (isCorrect) {
      newPhase = "solved";
      newStatus = "solved";
      solved = true;
      attemptOver = true;
      targetLocationName = sec.targetLocationName;
    } else if (newGuesses.length >= pub.maxGuesses) {
      newPhase = "failed";
      newStatus = "failed";
      solved = false;
      attemptOver = true;
      targetLocationName = sec.targetLocationName;
    }

    const updatedPub: WaypointPublicState = {
      ...pub,
      guesses: newGuesses,
      phase: newPhase,
      status: newStatus,
      solved,
      targetLocationName,
    };

    return {
      publicState: updatedPub,
      phase: newPhase,
      events: attemptOver
        ? [{ type: "game_over", payload: { result: newPhase } }]
        : [{ type: "guess_made", payload: { guess: newGuess } }],
      attemptOver,
    };
  }

  return { error: `Unknown action type: ${action.type}`, code: "invalid_action" };
}

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

export function summarize(ctx: DailyContext, state: DailyStateIn): DailySummary {
  const pub = state.publicState as WaypointPublicState;

  const puzzleDate = ctx?.puzzleDate ?? "";
  const header = puzzleDate ? `Waypoint #${puzzleDate}` : "Waypoint";

  if (!pub) {
    return {
      status: "in_progress",
      shareText: header,
      stats: { completed: false },
    };
  }

  let status: DailyStatus = "in_progress";
  if (pub.phase === "solved" || pub.status === "solved") status = "solved";
  else if (pub.phase === "failed" || pub.status === "failed") status = "failed";

  const numGuesses = pub.guesses.length;
  const attemptsStr =
    status === "solved" ? `${numGuesses}/${pub.maxGuesses}` : `X/${pub.maxGuesses}`;

  const emojiLines = pub.guesses.map((g) => {
    const colorEmoji = distanceToProximityEmoji(g.distanceKm, g.isCorrect);
    const arrow = g.cardinalArrow ?? g.directionArrow ?? "🎯";
    return `${arrow} ${colorEmoji}`;
  });

  const shareText = [`${header} ${attemptsStr}`, ...emojiLines].join("\n").trim();

  return {
    status,
    shareText,
    stats: {
      completed: status !== "in_progress",
      score: status === "solved" ? numGuesses : 0,
      extra: {
        guessesUsed: numGuesses,
        solved: status === "solved" ? 1 : 0,
      },
    },
  };
}
