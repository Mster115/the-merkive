import type { DailyContentPack } from "../types";
import type { WaypointContentPayload, WaypointLocation } from "./types";

export function generatePrompt(puzzleDate: string): string {
  return `Waypoint Daily Puzzle Brief (${puzzleDate})

Authoring Requirements:
1. Provide a curated set of 8-20 landmark locations across diverse global regions.
2. Each location must contain:
   - id: Unique snake_case string identifier (e.g. "tokyo_tower", "eiffel_tower", "sydney_opera_house")
   - name: Clear display name (e.g. "Tokyo Tower")
   - countryCode: 2-character uppercase ISO country code (e.g. "JP", "FR", "AU")
   - region: Region or continent name (e.g. "Asia", "Europe", "Oceania")
   - latitude: Decimal degrees between -90.0 and 90.0
   - longitude: Decimal degrees between -180.0 and 180.0
3. Target Location:
   - Select one featured target location by setting targetLocationId or target to its id/object.
4. Guess Limit:
   - Set maxGuesses (default is 5).
5. Source References:
   - Include valid citations in sourceRefs.

Bank shape — this is what decides whether the puzzle is any good:
   A bank of famous landmarks scattered evenly over the globe is a ONE-GUESS
   puzzle. Their distances from any origin are all so different that a single
   reading identifies the target outright, no matter how coarse the feedback:
   measured over a 13-landmark global bank, one opening guess isolated the
   target 92% of the time even with distance rounded to the nearest 1,000km.
   Coarsening feedback does not fix this. Only bank composition does.

   So: cluster the bank. Give the target several NEIGHBOURS at roughly
   300-2,000km — near enough that one distance-and-sector reading cannot
   separate them, far enough that they are not the same city. Regrouping the
   same 13 landmarks into regional clusters took the one-guess resolve rate
   from 66% to 44%; adding a proper near-cluster around the target takes it to
   about 0.14, which is the band the analyser wants.

   Do NOT place two candidates within ~75km of each other. Nothing else in the
   bank can tell such a pair apart, and the puzzle ends on a coin flip —
   \`analyzeWaypointBank\` rejects this outright.

   Run \`analyzeWaypointBank\` before submitting and aim for
   firstGuessResolveRate between 0.1 and 0.4 with no problems reported.`;
}

export function getLocationCoords(loc: Partial<WaypointLocation>): [number, number] | null {
  if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    const [lat, lng] = loc.coordinates;
    if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number" && !isNaN(loc.latitude) && !isNaN(loc.longitude) && loc.latitude >= -90 && loc.latitude <= 90 && loc.longitude >= -180 && loc.longitude <= 180) {
    return [loc.latitude, loc.longitude];
  }
  return null;
}

export function validatePack(
  raw: unknown,
  puzzleDate: string
): { ok: true; pack: DailyContentPack } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Content pack submission must be a non-null object" };
  }

  const envelope = raw as Record<string, unknown>;
  const payloadObj = (
    typeof envelope.payload === "object" && envelope.payload !== null
      ? envelope.payload
      : raw
  ) as Record<string, unknown>;

  if (!payloadObj || typeof payloadObj !== "object") {
    return { ok: false, error: "Missing pack payload" };
  }

  const rawPayload = payloadObj as Partial<WaypointContentPayload>;
  const rawLocations = rawPayload.locations ?? rawPayload.availableLocations ?? [];

  if (!Array.isArray(rawLocations)) {
    return { ok: false, error: "Locations must be an array" };
  }

  let targetLoc: WaypointLocation | null = null;

  if (rawPayload.target && typeof rawPayload.target === "object") {
    const coords = getLocationCoords(rawPayload.target);
    if (typeof rawPayload.target.name === "string" && rawPayload.target.name.trim().length > 0 && coords) {
      targetLoc = {
        id: rawPayload.target.id ?? rawPayload.target.name.toLowerCase().replace(/\s+/g, "_"),
        name: rawPayload.target.name.trim(),
        region: typeof rawPayload.target.region === "string" ? rawPayload.target.region.trim() : "Global",
        countryCode: typeof rawPayload.target.countryCode === "string" ? rawPayload.target.countryCode.trim().toUpperCase() : "XX",
        coordinates: coords,
        latitude: coords[0],
        longitude: coords[1],
        population: rawPayload.target.population,
        hints: rawPayload.target.hints,
      };
    } else {
      return { ok: false, error: "Target location has invalid name or coordinates (-90..90, -180..180)" };
    }
  }

  const validLocations: WaypointLocation[] = [];

  for (const loc of rawLocations) {
    if (!loc || typeof loc !== "object") continue;
    const coords = getLocationCoords(loc);
    if (typeof loc.name === "string" && loc.name.trim().length > 0 && coords) {
      validLocations.push({
        id: loc.id ?? loc.name.toLowerCase().replace(/\s+/g, "_"),
        name: loc.name.trim(),
        region: typeof loc.region === "string" ? loc.region.trim() : "Global",
        countryCode: typeof loc.countryCode === "string" ? loc.countryCode.trim().toUpperCase() : "XX",
        coordinates: coords,
        latitude: coords[0],
        longitude: coords[1],
        population: loc.population,
        hints: loc.hints,
      });
    }
  }

  if (validLocations.length === 0 && !targetLoc) {
    return { ok: false, error: "Pack must contain at least valid locations" };
  }

  if (!targetLoc) {
    if (rawPayload.targetLocationId) {
      const found = validLocations.find((l) => l.id === rawPayload.targetLocationId);
      if (found) targetLoc = found;
    } else if (validLocations.length > 0) {
      targetLoc = validLocations[0]!;
    }
  }

  if (!targetLoc) {
    return { ok: false, error: "Target location must be specified and valid" };
  }

  // Ensure target is in validLocations
  if (!validLocations.some((l) => l.name === targetLoc!.name || l.id === targetLoc!.id)) {
    validLocations.unshift(targetLoc);
  }

  const maxGuesses = typeof rawPayload.maxGuesses === "number" && rawPayload.maxGuesses > 0 ? Math.floor(rawPayload.maxGuesses) : 5;

  const normalizedPayload: WaypointContentPayload = {
    target: targetLoc,
    targetLocationId: targetLoc.id,
    availableLocations: validLocations,
    locations: validLocations,
    maxGuesses,
    hint: rawPayload.hint,
  };

  const sourceRefs = Array.isArray(envelope.sourceRefs)
    ? (envelope.sourceRefs as { url: string; title: string }[])
    : Array.isArray(payloadObj.sourceRefs)
    ? (payloadObj.sourceRefs as { url: string; title: string }[])
    : [];

  return {
    ok: true,
    pack: {
      gameId: "waypoint",
      puzzleDate,
      payload: normalizedPayload,
      sourceRefs,
    },
  };
}
