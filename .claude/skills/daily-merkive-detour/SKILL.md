---
name: daily-merkive-detour
description: Fills The Merkive's daily Detour puzzle — an urban wayfinding game where the player hops between real city landmarks using escalating stranger-directions clues, choosing from a bank of POIs. Verifies every coordinate and walks the route by hand before it queues, since no solver grades Detour. Use when running the scheduled Detour content fill, when the Detour queue needs topping up, or when asked to draft or queue Detour puzzles.
---

# Daily fill — Detour

You keep The Merkive's Detour wayfinding puzzle supplied with content, running
unattended on a schedule through the `merkive-daily` MCP tools. Handle
**detour only** — Nexus, Nutshell, Relay and Waypoint have their own scheduled
tasks. Do not submit for them.

Detour is the most expensive of the daily games to author, for one reason:
**every hop is three factual claims at once** — that the landmark exists where
you say it does, that the route between hops is real, and that the clue
describing that route is both true and not a giveaway. The first two are
durable facts; the third is craft, and it is where this puzzle goes wrong.

**Read these first:**

- [Run procedure](../_daily-shared/run-procedure.md) — `daily_plan` →
  `daily_brief` → `daily_check` → `daily_submit`, and the draft gate
- [Workflow graph](../_daily-shared/workflow-graph.md) — the authoritative
  control flow: every failure edge, retry budget and terminal state
- [Editorial rules](../_daily-shared/editorial.md) — originality, safety,
  language
- [Clue craft](../_daily-shared/clue-craft.md) — writing a clue that points
  without pointing
- [Research and sourcing](../_daily-shared/sources.md) — specifically
  [what counts as two independent sources](../_daily-shared/sources.md#what-counts-as-two-independent-sources)

Deeper background, only if something here is ambiguous:
[docs/daily-content/detour.md](../../../docs/daily-content/detour.md) for the
full pack format, and `daily_brief` for the live payload schema. Trust
`daily_brief` over any document — the code is the contract.

## The mechanic

The player starts at a known **Start POI** in one city and must reach a hidden
**Destination POI** in 2–4 hops. At each hop they see one clue and pick a
landmark from a **shuffled bank of POI cards** — name, district, category, and
*no coordinates*. A correct pick advances them; a wrong one is a "detour",
scored with the distance it cost. The attempt fails at `totalHops + 5` wrong
turns.

Each hop carries a **four-tier clue ladder**, revealed on request, and the
player's score counts how many rungs they had to buy:

| tier | what it gives | what it must not give |
| --- | --- | --- |
| 1 `tier1_vector` | approximate distance in km, compass direction | any proper noun |
| 2 `tier2_stranger` | the route as a stranger tells it — streets, transit lines, what you pass | the destination's name |
| 3 `tier3_category` | what kind of place it is, plus the district | — |
| 4 `tier4_radiusBounds` | bounding box; **the only tier that unshrouds the district** | — |

The clues on `route[i]` describe the journey **to** `route[i + 1]`. The last
route entry is the destination — nothing is navigated away from it, so its
clues are never read and may be left empty.

The map draws **only the trail the player has already walked** — the start and
their committed hops. It never plots the unguessed bank, deliberately: real
coordinates for the whole bank would turn every tier-1 clue into arithmetic.

## What no tool will catch for you

`daily_check` runs the schema and the repeat check, and since 2026‑07‑31 it
also runs Detour's structural rules (bank size, district decoys, missing
clues, and a warning when a clue echoes its target's name). **There is no
solver and no difficulty analyser for Detour** — nothing equivalent to
Waypoint's `analyzeWaypointBank`. Nothing will tell you the puzzle is too easy,
too hard, or unsolvable.

So the walkthrough in [Before you submit](#before-you-submit) is not a
formality. It is the only difficulty check that exists.

## Building a route

- **One city per puzzle**, named in `cityName` with a short `cityCode`. A city
  a global audience can place — a player who has never heard of the city cannot
  read a stranger's directions through it.
- **2–4 hops.** Three is the good default: enough to feel like a journey, short
  enough for the three-minute budget. The route array holds hops + 1 entries,
  because Hop 0 is the start.
- **Hops of 0.5–8 km.** Much shorter and the tier-1 vector cannot discriminate;
  much longer and it stops being a walk through a city.
- **Real, connected legs.** The tier-2 clue describes an actual way to get from
  one hop to the next. If no plausible route exists, the clue will be fiction
  and a player who knows the city will be actively misled.
- **Well-known landmarks only**, for the route POIs especially. The player must
  recognise the target from a category and a district.
- **Coordinates to at least 4 decimal places**, and sanity-check the sign — a
  dropped minus still validates and quietly wrecks every distance.
- **Unique snake_case `poiId` / `id`**, no collisions: ids key the secret
  lookup, so a duplicate silently mislabels a guess.

## Building the bank

`candidatePois` is the answer space, and its shape is the difficulty dial.

- **8–16 POIs.** Six is the hard floor `validatePack` enforces; below about
  eight the target is obvious by elimination. Above sixteen it is a wall of
  cards on a phone.
- **Every hop target needs at least one decoy in its own district.** This is a
  **hard reject**, not advice. The tier-4 hint unshrouds the district, so a
  target alone in its district is named outright by the hint the player paid
  for — the clue ladder collapses from four rungs to two.
- **Prefer decoys that also fit the tier-3 category.** A "civic plaza in Center
  City" is a real narrowing if two candidates match it, and a giveaway if one
  does. This is the single most effective thing you can do to make a day
  interesting.
- **Spread the districts.** A bank where twelve of sixteen POIs sit in one
  district makes the district hint worthless.
- **Include the route POIs.** `validatePack` appends them if you forget, but a
  bank the validator completed is a bank you never checked for decoys.
- **Unique ids.** Two candidates sharing an `id` is a hard reject: ids key the
  secret lookup, so a collision resolves a guess to the wrong landmark.
- **The destination's decoy must itself be a plausible destination.** Before
  the player acts they are told the destination's *district* — nothing more,
  because district plus category once identified it outright. So the decoy
  sharing that district is the only thing standing between the player and a
  free final hop. A stadium beside a ballpark works; a stadium beside a bus
  shelter does not.

## Writing the clues

This is where Detour puzzles fail. The rule is one line:

> **Never name the target, or a distinctive word from its name, in tiers 1–3.**

The shipped sample once read, for the target *Dilworth Park & City Hall*:

> "Head east down Market Street until you see a bustling plaza with interactive
> fountains outside City Hall."

That is a tier-2 clue that ends the hop, and it makes tiers 3 and 4 dead
weight. The fix describes what the player *sees on arrival* without naming it:

> "Follow Market Street east over the bridge and keep going until the sidewalk
> opens out into a broad granite plaza with fountains set flush into the
> ground."

`daily_check` warns when a clue contains a word of five or more letters from
its target's name. Treat that warning as a blocker unless the word is genuinely
generic in that city.

Other habits worth keeping:

- **Tier 1 is geometry, full stop.** "About 1.6 km east, across the river" —
  no street names, no landmarks.
- **Tier 2 names the way, never the destination.** Streets, transit lines,
  bridges, what you pass. It should read like a person talking.
- **Tier 3 is a category and a district**, in that order, lower-cased naturally
  — "Civic plaza | Center City". Make the category one that at least two bank
  entries plausibly satisfy.
- **Tier 4 bounds should contain the target and a little slack**, not hug it.

## Before you submit

Run `daily_check` first and clear every problem. Then, because nothing else
will:

1. **Verify every coordinate against two independent sources** — the place's
   own reference page plus an unrelated gazetteer or mapping source. Two pages
   restating the same wiki entry are one source. Do this for the whole bank,
   not just the route.
2. **Confirm each leg is really traversable** the way tier 2 describes it —
   the transit line runs, the bridge exists, the direction is right.
3. **Walk the puzzle as a player who does not know the answer.** For each hop,
   read tier 1 alone and ask which bank entries survive it; then tier 2; then
   tier 3. If the bank collapses to one entry before tier 3, the clue is too
   strong. If it is still wide open after tier 4, the hop is unfair.
   **Start this walk at turn zero**, from the destination district alone: if
   that already names the destination, the last hop is free.
4. **Check the tier-4 district actually holds a decoy** — the reject exists
   because this is easy to get wrong when editing a bank late.

## The fact-check bar

Detour asserts real-world geography, so it never queues on the Relay "asserts
nothing" argument. But landmarks and street layouts are durable facts, so **the
normal case is `factCheck.status: "passed"`** once every coordinate is
double-sourced and every leg confirmed. Send that string literally, with
`sourceRefs` carrying at least one citation per source you actually used.

Use `"needs_review"` when any of these is true:

- a coordinate or a route leg you could only confirm from one source;
- a transit connection that may have changed — closures and rerouting are the
  one part of this puzzle that does go stale;
- a landmark whose name is contested or has recently been renamed;
- a city or target you are not confident a global audience recognises.

Those two strings are the only permitted values; anything else is rejected. See
[the gate](../_daily-shared/run-procedure.md#the-draft--queued-gate).

## Variety across days

`daily_history` and `daily_submit` enforce the no-repeat rule on the
fingerprint — city plus route plus bank — so an exact rerun is refused. That is
a floor, not variety.

**Rotate the city.** Detour's failure mode across days is a Philadelphia rut:
the same city with a new route is a much smaller change than it looks, because
the bank and the districts repeat. Change continents week to week, and do not
reuse a city until several others have run.

## Report

Per [run-procedure.md](../_daily-shared/run-procedure.md), plus:

- the city and the full route, hop by hop;
- the bank size and its district spread;
- confirmation that every coordinate was double-sourced and every leg checked;
- for each hop, how many bank entries survive tier 1, tier 2 and tier 3 — the
  walkthrough numbers, since no analyser produces them;
- any `daily_check` clue-echo warnings and why you accepted them.
