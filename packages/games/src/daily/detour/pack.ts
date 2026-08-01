import type { DailyContentPack } from "../types";
import type { DetourContentPayload, DetourPoi, DetourHopClues } from "./types";

export function generatePrompt(puzzleDate: string): string {
  return `Detour Daily Urban Navigation Puzzle Brief (${puzzleDate})

Authoring Requirements:
1. Select a featured world city (e.g. "Philadelphia", "New York City", "Tokyo", "London", "Paris", "San Francisco").
2. Provide a multi-hop navigation route (3 to 4 sequential POI hops):
   - Hop 0: Start POI (e.g. "30th Street Station")
   - Hop 1..N: Sequential intermediate POIs leading to the final Destination POI.
3. Each hop in the route must contain:
   - poiId: Unique snake_case identifier (e.g. "phl_city_hall")
   - poiName: Clear display name (e.g. "Dilworth Park & City Hall")
   - district: Neighborhood or borough name (e.g. "Center City")
   - coordinates: [latitude, longitude] in decimal degrees (-90 to 90, -180 to 180)
   - category: Landmark category (e.g. "Civic Plaza & Municipal Building")
   - clues:
     - tier1_vector: Distance and general direction (e.g. "Walk ~0.8 miles East across the river corridor.")
     - tier2_stranger: Conversational "stranger directions" narrative (e.g. "Head east down Market Street until you see a bustling plaza with interactive fountains...")
     - tier3_category: Category and architectural summary tag
     - tier4_radiusBounds: [minLat, minLng, maxLat, maxLng] coordinate bounds bounding box
4. Provide candidatePois: Bank of 8-16 real city POIs in that city for players to choose/guess from.

Clue discipline — this is what decides whether the puzzle is any good:
   NEVER name the target, or any distinctive part of its name, in tiers 1-3.
   A tier-2 clue reading "...the plaza outside City Hall" for the target
   "Dilworth Park & City Hall" ends the hop instantly and makes tiers 3 and 4
   dead weight. Describe what the player passes and sees, not what they are
   looking for.

   The four tiers must genuinely escalate:
   - tier1_vector: geometry only — approximate distance in km and a compass
     direction. No proper nouns.
   - tier2_stranger: the route as a stranger would tell it — streets, transit
     lines, things you pass. Names the *way*, never the *destination*.
   - tier3_category: what kind of place it is, plus the district.
   - tier4_radiusBounds: [minLat, minLng, maxLat, maxLng]. This is the only
     tier that unshrouds the district on the map.

Bank shape:
   Each hop the player must find needs at least one DECOY landmark in the same
   district — validatePack rejects a pack where a target is alone in its
   district, because the tier-4 hint would then name it outright. Prefer
   decoys that also plausibly match the tier-3 category.`;
}

function isValidCoord(coord: unknown): coord is [number, number] {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    typeof coord[0] === "number" &&
    !isNaN(coord[0]) &&
    coord[0] >= -90 &&
    coord[0] <= 90 &&
    typeof coord[1] === "number" &&
    !isNaN(coord[1]) &&
    coord[1] >= -180 &&
    coord[1] <= 180
  );
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

  const rawPayload = payloadObj as Partial<DetourContentPayload>;
  // A content gate must reject, never invent. Defaulting a missing city to
  // Philadelphia (and every bad coordinate to Philadelphia City Hall) meant a
  // malformed Tokyo pack validated clean with Pennsylvania geography in it.
  if (typeof rawPayload.cityName !== "string" || rawPayload.cityName.trim().length === 0) {
    return { ok: false, error: "cityName is required and must be a non-empty string" };
  }
  if (typeof rawPayload.cityCode !== "string" || rawPayload.cityCode.trim().length === 0) {
    return { ok: false, error: "cityCode is required and must be a non-empty string" };
  }
  const cityName = rawPayload.cityName.trim();
  const cityCode = rawPayload.cityCode.trim().toUpperCase();

  const rawRoute = Array.isArray(rawPayload.route) ? rawPayload.route : [];
  if (rawRoute.length < 2) {
    return { ok: false, error: "Route must contain at least 2 hops (Start POI and Destination POI)" };
  }

  const normalizedRoute: Array<{
    hopIndex: number;
    poiId: string;
    poiName: string;
    district: string;
    coordinates: [number, number];
    category: string;
    aliases?: string[];
    clues: DetourHopClues;
  }> = [];

  for (let i = 0; i < rawRoute.length; i++) {
    const item = rawRoute[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `route[${i}] must be an object` };
    }
    const name = typeof item.poiName === "string" ? item.poiName.trim() : "";
    if (!name) {
      return { ok: false, error: `route[${i}].poiName is required and must be a non-empty string` };
    }
    const id =
      typeof item.poiId === "string" && item.poiId.trim().length > 0
        ? item.poiId.trim()
        : name.toLowerCase().replace(/\s+/g, "_");
    const district = typeof item.district === "string" ? item.district.trim() : "";
    if (!district) {
      return { ok: false, error: `route[${i}] (${name}) requires a non-empty district` };
    }
    const category = typeof item.category === "string" ? item.category.trim() : "";
    if (!category) {
      return { ok: false, error: `route[${i}] (${name}) requires a non-empty category` };
    }
    if (!isValidCoord(item.coordinates)) {
      return {
        ok: false,
        error: `route[${i}] (${name}) requires valid [latitude, longitude] coordinates`,
      };
    }
    const coords: [number, number] = [item.coordinates[0], item.coordinates[1]];

    const cluesRaw = (
      item.clues && typeof item.clues === "object" ? item.clues : {}
    ) as Partial<DetourHopClues>;
    // The final route entry is the destination; nothing is navigated *from* it,
    // so its clues are never read. Every other hop must carry real authored
    // clues — auto-filling "Head towards <name>" printed the answer in tier 1.
    const isDestination = i === rawRoute.length - 1;
    if (!isDestination) {
      for (const key of ["tier1_vector", "tier2_stranger", "tier3_category"] as const) {
        if (typeof cluesRaw[key] !== "string" || cluesRaw[key]!.trim().length === 0) {
          return { ok: false, error: `route[${i}] (${name}) requires a non-empty clues.${key}` };
        }
      }
      if (
        cluesRaw.tier4_radiusBounds !== undefined &&
        (!Array.isArray(cluesRaw.tier4_radiusBounds) || cluesRaw.tier4_radiusBounds.length !== 4)
      ) {
        return {
          ok: false,
          error: `route[${i}] (${name}) clues.tier4_radiusBounds must be [minLat, minLng, maxLat, maxLng]`,
        };
      }
    }
    const clues: DetourHopClues = {
      tier1_vector: typeof cluesRaw.tier1_vector === "string" ? cluesRaw.tier1_vector.trim() : "",
      tier2_stranger:
        typeof cluesRaw.tier2_stranger === "string" ? cluesRaw.tier2_stranger.trim() : "",
      tier3_category:
        typeof cluesRaw.tier3_category === "string" ? cluesRaw.tier3_category.trim() : "",
      tier4_radiusBounds:
        Array.isArray(cluesRaw.tier4_radiusBounds) && cluesRaw.tier4_radiusBounds.length === 4
          ? (cluesRaw.tier4_radiusBounds as [number, number, number, number])
          : undefined,
    };

    normalizedRoute.push({
      hopIndex: i,
      poiId: id,
      poiName: name,
      district,
      coordinates: coords,
      category,
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      clues,
    });
  }

  if (normalizedRoute.length < 2) {
    return { ok: false, error: "Valid route steps must contain at least 2 valid POIs" };
  }

  const candidatePois: DetourPoi[] = [];
  const rawCandidates = Array.isArray(rawPayload.candidatePois) ? rawPayload.candidatePois : [];

  for (let i = 0; i < rawCandidates.length; i++) {
    const c = rawCandidates[i];
    if (!c || typeof c !== "object") {
      return { ok: false, error: `candidatePois[${i}] must be an object` };
    }
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!name) {
      return { ok: false, error: `candidatePois[${i}].name is required and must be non-empty` };
    }
    const id =
      typeof c.id === "string" && c.id.trim().length > 0 ? c.id.trim() : name.toLowerCase().replace(/\s+/g, "_");
    if (!isValidCoord(c.coordinates)) {
      return {
        ok: false,
        error: `candidatePois[${i}] (${name}) requires valid [latitude, longitude] coordinates`,
      };
    }
    const district = typeof c.district === "string" ? c.district.trim() : "";
    if (!district) {
      return { ok: false, error: `candidatePois[${i}] (${name}) requires a non-empty district` };
    }
    const category = typeof c.category === "string" ? c.category.trim() : "";
    if (!category) {
      return { ok: false, error: `candidatePois[${i}] (${name}) requires a non-empty category` };
    }

    candidatePois.push({
      id,
      name,
      district,
      coordinates: [c.coordinates[0], c.coordinates[1]],
      category,
      aliases: Array.isArray(c.aliases) ? c.aliases : [],
    });
  }

  // Ensure all route POIs are present in candidatePois
  for (const r of normalizedRoute) {
    if (!candidatePois.some((c) => c.id === r.poiId || c.name.toLowerCase() === r.poiName.toLowerCase())) {
      candidatePois.push({
        id: r.poiId,
        name: r.poiName,
        district: r.district,
        coordinates: r.coordinates,
        category: r.category,
        aliases: r.aliases,
      });
    }
  }

  // Ids key the secret POI lookup, so a collision silently resolves a guess to
  // the wrong landmark.
  const seenIds = new Set<string>();
  for (const c of candidatePois) {
    if (seenIds.has(c.id)) {
      return { ok: false, error: `duplicate candidate POI id "${c.id}"` };
    }
    seenIds.add(c.id);
  }

  if (candidatePois.length < 6) {
    return {
      ok: false,
      error: `candidatePois must contain at least 6 landmarks (got ${candidatePois.length}); the route POIs alone make the answer obvious`,
    };
  }

  // Every hop the player must *find* has to share its district with at least
  // one decoy. Otherwise the tier-4 hint, which unshrouds that district, names
  // the answer outright and the clue ladder collapses to two rungs.
  const districtCounts = new Map<string, number>();
  for (const c of candidatePois) {
    districtCounts.set(c.district, (districtCounts.get(c.district) ?? 0) + 1);
  }
  for (const hop of normalizedRoute.slice(1)) {
    if ((districtCounts.get(hop.district) ?? 0) < 2) {
      return {
        ok: false,
        error: `district "${hop.district}" holds only the target ${hop.poiName}; add at least one decoy landmark in that district so the tier-4 hint does not give the hop away`,
      };
    }
  }

  const normalizedPayload: DetourContentPayload = {
    cityName,
    cityCode,
    route: normalizedRoute,
    candidatePois,
  };

  const sourceRefs = Array.isArray(envelope.sourceRefs)
    ? (envelope.sourceRefs as { url: string; title: string }[])
    : Array.isArray(payloadObj.sourceRefs)
    ? (payloadObj.sourceRefs as { url: string; title: string }[])
    : [];

  return {
    ok: true,
    pack: {
      gameId: "detour",
      puzzleDate,
      payload: normalizedPayload,
      sourceRefs,
    },
  };
}
