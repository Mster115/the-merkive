# Waypoint — content specification

*Daily Vector Geography Puzzle.* Triangulate a secret landmark location
using distance and compass bearing vectors across 5 strategic guesses.

Code: `packages/games/src/daily/waypoint/` — `pack.ts` (`validatePack`),
`logic.ts` (`init`, `reduce`, `summarize`).

## How it plays

- The player sees a shuffled bank of 8–20 landmark locations (name, region,
  country) but no coordinates.
- `guess_location` selects a candidate by `locationId` or `locationName`.
  The server computes geodesic distance (km, Haversine) and initial compass
  bearing (0–360°, mapped to 8-point cardinal arrow) from the guess to the
  secret target.
- Each guess consumes one of `maxGuesses` (default 5) attempts.
- The player uses the vector feedback to eliminate candidates and triangulate.
- Guessing the target → `solved`. Exhausting all guesses → `failed`.
- `give_up` → `failed` at any point.

Candidate coordinates are never exposed to the client — they stay in
`secretState`. The player picks from a list of names; the server does the math.

## Payload schema

```jsonc
{
  "gameId": "waypoint",
  "puzzleDate": "2026-08-01",
  "sourceRefs": [
    { "url": "https://en.wikipedia.org/wiki/Tokyo_Tower", "title": "Tokyo Tower" }
  ],
  "payload": {
    "target": {
      "id": "tokyo_tower",
      "name": "Tokyo Tower",
      "countryCode": "JP",
      "region": "Asia",
      "latitude": 35.6586,
      "longitude": 139.7454
    },
    "locations": [
      { "id": "eiffel_tower", "name": "Eiffel Tower", "countryCode": "FR", "region": "Europe", "latitude": 48.8584, "longitude": 2.2945 },
      { "id": "statue_of_liberty", "name": "Statue of Liberty", "countryCode": "US", "region": "North America", "latitude": 40.6892, "longitude": -74.0445 },
      { "id": "sydney_opera_house", "name": "Sydney Opera House", "countryCode": "AU", "region": "Oceania", "latitude": -33.8568, "longitude": 151.2153 }
    ],
    "maxGuesses": 5
  }
}
```

The target must also appear in `locations`. If it doesn't, `validatePack`
prepends it. The bank is shuffled server-side at `init()` time using `ctx.rng`.

### What `validatePack` does to your submission

1. Reads `payload.target` or falls back to `payload.targetLocationId` lookup.
2. Validates each location has a non-empty `name` and valid coordinates
   (latitude -90..90, longitude -180..180, via `latitude`/`longitude` fields
   or `coordinates: [lat, lng]` array).
3. Invalid locations are silently dropped.
4. If the target is not in the locations array, it is prepended.
5. `maxGuesses` defaults to 5 if not specified or invalid.

## Designing a good puzzle

**Bank size.** Target **12–16 locations** for a satisfying puzzle. Fewer than 8
makes it trivial; more than 20 overwhelms the dropdown on mobile.

**Geographic diversity.** Spread candidates across at least 3–4 continents so
vector feedback is meaningful. A bank of 15 European capitals produces tiny
distance deltas that don't differentiate.

**Decoy strategy.** Include locations that are:
- In the same region as the target (forces precision over broad direction)
- On the opposite side of the globe (early guess → big vector, helps orient)
- At similar latitudes but different longitudes (or vice versa) — these are
  the hardest to distinguish and make the puzzle interesting.

**Target selection.** Choose well-known landmarks, cities, or natural features.
Obscure locations frustrate players. The name should be recognizable to a
global audience.

**Coordinate precision.** Use at least 4 decimal places (≈11m accuracy).
Rounded coordinates produce misleading distance feedback.

## The discriminability analyser

`preflight` (and therefore `daily_check`) runs `analyzeWaypointBank` over every
waypoint pack. Waypoint has no solvability question — the target is always in
the bank — so the analyser grades *shape* instead:

| Field | Meaning |
| --- | --- |
| `firstGuessResolveRate` | Share of opening guesses that isolate the target outright. **The difficulty dial — aim 0.1–0.4.** |
| `parGuesses` | Guesses under optimal play. Expect 2 on a good bank; a floor, not a score. |
| `ambiguousWith` | Candidates no guess can separate from the target. **Non-empty is a blocker.** |
| `line` | The optimal probe sequence, for eyeballing. |

It models two readers deliberately. The **coin-flip check** assumes someone with
a mapping tool: if even they cannot split two candidates, the puzzle can end on
a coin toss and that is a hard failure. The **difficulty grading** assumes a
person eyeballing "about nine thousand kilometres, north-east" — grading against
the precise reader instead declares every globe-spanning bank trivial, which the
first version of the analyser did.

It takes your coordinates as true. A bank with Sydney in the northern hemisphere
analyses perfectly and plays as nonsense.

**Bank-item reuse warnings are expected.** There is a finite supply of
world-famous landmarks, so successive puzzles will share candidates. The
fingerprint covers target *plus* bank, so the puzzle itself still never repeats;
treat the warning as a nudge to rotate the target's region, not as a defect.

## Verification

Waypoint packs need **source citations** (`sourceRefs`) — each location should
be verifiable. The validator checks structural validity (coordinates in range,
target exists, locations non-empty) but does not verify that names match real
places. Fact-checking is the author's responsibility.

Two failure modes seen in practice, both caught only by double-sourcing:

- **Replica name collisions.** "Parthenon" resolves to Athens on Wikipedia and
  to the full-scale replica in Nashville on OpenStreetMap.
- **Extended features.** "Great Wall of China" returns points ~400 km apart,
  because it is a wall, not a place. Prefer point landmarks.

Before submitting, verify yourself:

- every location is a real, well-known place with accurate coordinates;
- the target is included in the locations array;
- no two locations share the same `id`;
- geographic spread is sufficient for interesting vector feedback;
- `sourceRefs` contains at least one citation.
