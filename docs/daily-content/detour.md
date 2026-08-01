# Detour (`detour`) — Daily Content Pack Format

`detour` is a single-player daily urban navigation and city wayfinding puzzle. Players navigate step-by-step from a known Start Point of Interest (POI) to a hidden Destination POI across a multi-hop route.

---

## 1. Submission Envelope Structure

Daily content packs are submitted via the administrative content pipeline (`scripts/daily-content.mjs`). Submissions take the envelope form:

```json
{
  "gameId": "detour",
  "puzzleDate": "2026-08-01",
  "payload": {
    "cityName": "Philadelphia",
    "cityCode": "PHL",
    "route": [
      {
        "hopIndex": 0,
        "poiId": "phl_30th_st",
        "poiName": "30th Street Station",
        "district": "University City",
        "coordinates": [39.9558, -75.1820],
        "category": "Train Station",
        "clues": {
          "tier1_vector": "Head about 1.6 km east, across the river.",
          "tier2_stranger": "Follow Market Street east over the bridge and keep going until the sidewalk opens out into a broad granite plaza with fountains set flush into the ground.",
          "tier3_category": "Civic plaza | Center City",
          "tier4_radiusBounds": [39.9500, -75.1700, 39.9600, -75.1600]
        }
      },
      {
        "hopIndex": 1,
        "poiId": "phl_city_hall",
        "poiName": "Dilworth Park & City Hall",
        "district": "Center City",
        "coordinates": [39.9526, -75.1635],
        "category": "Civic Plaza",
        "clues": {
          "tier1_vector": "Travel about 5.3 km south.",
          "tier2_stranger": "Go underground and take the Broad Street Line south, staying on it past the stadium crowds until the train can go no further.",
          "tier3_category": "Subway terminus | South Philadelphia",
          "tier4_radiusBounds": [39.9000, -75.1800, 39.9200, -75.1600]
        }
      },
      {
        "hopIndex": 2,
        "poiId": "phl_nrg_station",
        "poiName": "NRG Station (Sports Complex)",
        "district": "South Philadelphia",
        "coordinates": [39.9056, -75.1706],
        "category": "Subway Station",
        "clues": {
          "tier1_vector": "Walk about 0.6 km southeast.",
          "tier2_stranger": "Come up from the platform, cross Pattison Avenue, and head for the largest of the arenas ringing the lot.",
          "tier3_category": "NFL stadium | Sports Complex",
          "tier4_radiusBounds": [39.8900, -75.1800, 39.9100, -75.1600]
        }
      },
      {
        "hopIndex": 3,
        "poiId": "phl_linc",
        "poiName": "Lincoln Financial Field",
        "district": "Sports Complex",
        "coordinates": [39.9008, -75.1675],
        "category": "NFL Stadium",
        "clues": {
          "tier1_vector": "",
          "tier2_stranger": "",
          "tier3_category": "",
          "tier4_radiusBounds": [39.8900, -75.1700, 39.9100, -75.1500]
        }
      }
    ],
    "candidatePois": [
      {
        "id": "phl_30th_st",
        "name": "30th Street Station",
        "district": "University City",
        "coordinates": [39.9558, -75.1820],
        "category": "Train Station"
      },
      {
        "id": "phl_city_hall",
        "name": "Dilworth Park & City Hall",
        "district": "Center City",
        "coordinates": [39.9526, -75.1635],
        "category": "Civic Plaza"
      },
      {
        "id": "phl_nrg_station",
        "name": "NRG Station (Sports Complex)",
        "district": "South Philadelphia",
        "coordinates": [39.9056, -75.1706],
        "category": "Subway Station"
      },
      {
        "id": "phl_linc",
        "name": "Lincoln Financial Field",
        "district": "Sports Complex",
        "coordinates": [39.9008, -75.1675],
        "category": "NFL Stadium"
      },
      {
        "id": "phl_art_museum",
        "name": "Philadelphia Museum of Art",
        "district": "Fairmount",
        "coordinates": [39.9656, -75.1810],
        "category": "Art Museum"
      },
      {
        "id": "phl_reading_terminal",
        "name": "Reading Terminal Market",
        "district": "Center City",
        "coordinates": [39.9533, -75.1592],
        "category": "Food Market"
      },
      {
        "id": "phl_independence_hall",
        "name": "Independence Hall",
        "district": "Old City",
        "coordinates": [39.9489, -75.1500],
        "category": "Historic Site"
      },
      {
        "id": "phl_italian_market",
        "name": "9th Street Italian Market",
        "district": "South Philadelphia",
        "coordinates": [39.9370, -75.1585],
        "category": "Street Market"
      },
      {
        "id": "phl_citizens_bank_park",
        "name": "Citizens Bank Park",
        "district": "Sports Complex",
        "coordinates": [39.9061, -75.1665],
        "category": "MLB Ballpark"
      }
    ]
  },
  "sourceRefs": [
    {
      "url": "https://www.phila.gov",
      "title": "City of Philadelphia Geographic Data"
    }
  ]
}
```

---

## 2. Clue Progression Tiers

The clues on `route[i]` describe the journey **to** `route[i + 1]`. The final
route entry is the destination; nothing is navigated away from it, so its
`clues` are never read and may be left empty.

Each earlier hop specifies 4 tiers, which must genuinely escalate:

1. **Tier 1 (Vector)**: Approximate distance in km and a compass direction. Geometry only — no proper nouns.
2. **Tier 2 (Stranger Narrative)**: The route as a stranger would tell it — streets, transit lines, things you pass. Names the *way*, never the *destination*.
3. **Tier 3 (Category)**: What kind of place it is, plus the district.
4. **Tier 4 (Radius & District Hint)**: Bounding box `[minLat, minLng, maxLat, maxLng]`. **This is the only tier that unshrouds the district.**

> **Never name the target, or a distinctive word from its name, in tiers 1–3.**
> A tier-2 clue reading "…the plaza outside City Hall" for the target
> "Dilworth Park & City Hall" ends the hop instantly and makes tiers 3 and 4
> dead weight. `scripts/daily-content.mjs` warns when a clue echoes a word of
> five or more letters from the POI it leads to.

---

## 3. Validation Rules (`validatePack`)

`validatePack` **rejects**; it never substitutes a default. An earlier version
silently defaulted a missing city to Philadelphia and every malformed
coordinate to Philadelphia City Hall, so a broken pack for any other city
validated clean with Pennsylvania geography inside it.

1. **City**: `cityName` and `cityCode` are required and must be non-empty.
2. **Route Length**: Must contain ≥ 2 hops (Hop 0 Start POI through Hop N Destination POI).
3. **Route fields**: Every hop requires a non-empty `poiName`, `district` and `category`, and valid coordinates.
4. **Clues**: Every hop except the last requires non-empty `tier1_vector`, `tier2_stranger` and `tier3_category`. Missing clues are no longer auto-generated — the generated text named the answer.
5. **Candidate Bank**: Must contain ≥ 6 candidate POIs (8 to 16 recommended), each with a non-empty `name`, `district`, `category` and valid coordinates. All route POIs are appended if absent.
6. **District decoys**: Every hop the player must find needs **at least one other candidate in the same district**, or the tier-4 hint names it outright. This is a hard reject.
7. **Coordinates**: Every POI coordinate must be a valid `[latitude, longitude]` tuple with −90 ≤ lat ≤ 90 and −180 ≤ lng ≤ 180.
8. **Unique ids**: No two candidate POIs may share an `id` — ids key the secret lookup, so a collision silently resolves a guess to the wrong landmark.
9. **Encapsulation**: Answer keys, route POI IDs, coordinates, and unrevealed clue scripts live in `secretState`. `publicState` receives only public candidate fields (`id`, `name`, `district`, `category`) — **never coordinates**, since publishing the bank's coordinates would let a player solve the tier-1 vector clue with arithmetic.

---

## 4. What the player sees before they act

`publicState.destinationSummary` carries **the destination's district only**. It
previously carried the category too, and the pair identified the target
outright — in this sample, "NFL Stadium | Sports Complex" matched exactly one of
nine candidates, so the final hop was solved for free at turn zero and its
tier-3 category hint was worthless.

The district-decoy rule (§3.6) is what keeps this honest: because the
destination is the last hop, its district is guaranteed to hold at least two
candidates. **When you add a destination, check that its district decoy is a
plausible destination too** — "Sports Complex" holding a stadium and a ballpark
works; a district whose only other entry is a bus shelter does not.

`unshroudedDistricts` starts as the start POI's district alone — the place the
player is already standing. Nothing else is revealed until a tier-4 hint is
bought or a hop is solved.
