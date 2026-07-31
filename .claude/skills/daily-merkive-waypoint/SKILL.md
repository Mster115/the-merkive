---
name: daily-merkive-waypoint
description: Fills The Merkive's daily Waypoint puzzle — a vector geography game where the player triangulates a secret landmark from distance and compass-bearing feedback across a bank of real locations. Verifies every coordinate before it goes in, and queues packs through the merkive-daily MCP tools. Use when running the scheduled Waypoint content fill, when the Waypoint queue needs topping up, or when asked to draft or queue Waypoint puzzles.
---

# Daily fill — Waypoint

You keep The Merkive's Waypoint geography puzzle supplied with content, running
unattended on a schedule through the `merkive-daily` MCP tools. Handle
**waypoint only** — Nexus, Nutshell and Relay have their own scheduled tasks. Do
not submit for them.

Waypoint sits between Relay and Nexus in cost. It is not wordplay: **every
location in the bank is a factual claim about where a real place is**, and a
wrong coordinate produces distance and bearing feedback that quietly makes the
puzzle unsolvable. But the claims are the most durable kind there is — landmarks
do not move — so a modest verification pass covers it, and there is no
topicality budget to spend.

**Read these first:**

- [Run procedure](../_daily-shared/run-procedure.md) — `daily_plan` →
  `daily_brief` → `daily_submit`, and the draft gate
- [Workflow graph](../_daily-shared/workflow-graph.md) — the authoritative
  control flow: every failure edge, retry budget and terminal state
- [Editorial rules](../_daily-shared/editorial.md) — originality, safety,
  language
- [Research and sourcing](../_daily-shared/sources.md) — specifically
  [what counts as two independent sources](../_daily-shared/sources.md#what-counts-as-two-independent-sources)

Deeper background, only if something here is ambiguous:
[docs/daily-content/waypoint.md](../../../docs/daily-content/waypoint.md) for
the full spec, and `daily_brief` for the live payload schema. Trust
`daily_brief` over any document — the code is the contract.

## The mechanic

The player sees a **shuffled bank of landmark names** — name, region, country,
and *no coordinates*. They pick one; the server returns the geodesic distance in
km and an 8-point compass arrow pointing from that guess toward the secret
target. Five guesses. The bank is the puzzle: the player triangulates by
elimination.

`daily_check` **does** analyse Waypoint, but only for puzzle *shape* — see
[what the analyser can and cannot tell you](#what-daily_check-checks). It knows
nothing about whether a coordinate is correct, only whether the bank makes an
interesting puzzle assuming the coordinates are true. **Verifying the
coordinates themselves is entirely on you.**

## Building a bank

- **12–16 locations.** Under 8 is trivial and the validator warns; over 20 turns
  a 3-minute puzzle into scrolling a dropdown on a phone.
- **Spread across at least 3–4 continents** so the feedback carries information
  at all. A bank of fifteen European capitals produces distance deltas too small
  to differentiate.
- **But spread alone makes the puzzle trivial**, and this is the mistake to
  watch for. Thirteen famous landmarks scattered evenly over the globe are all
  so far apart that a single distance-and-bearing reading pins the target
  outright — one probe, then name it. **Put three or four candidates within a
  few thousand kilometres of the target**, so the first reading narrows the
  field to a cluster and the player has to work inside it. The far-flung
  entries orient; the near ones are the actual puzzle.
- **Well-known targets only.** A player who has never heard of the target cannot
  recognise it in the dropdown, and the puzzle becomes a coin flip. Famous
  landmarks, major cities, unmistakable natural features.
- **Coordinates to at least 4 decimal places.** Rounded coordinates skew the
  distances the whole puzzle is read from.
- **Unique snake_case `id` per location**, and no two locations sharing an id —
  ids key the secret coordinate lookup, so a collision silently mislabels a
  guess.
- **Include the target in `locations`.** `validatePack` will prepend it if you
  forget, but a bank where the target was appended by the validator is a bank you
  never checked for spread.

### Decoys — the actual craft

The bank's shape is what makes a day easy or interesting:

- **One or two far-side-of-the-globe entries.** A player's opening guess wants a
  big vector to orient from.
- **Two or three in the target's own region.** These force precision once the
  broad direction is known — without them the puzzle ends on guess two.
- **The hard ones: similar latitude, very different longitude** (or the reverse).
  These are what stop a player reading the answer straight off a single bearing.

## What `daily_check` checks

Run it before every submit. For Waypoint it reports:

- **`firstGuessResolveRate` is the difficulty dial** — the share of opening
  guesses that isolate the target outright. **Aim for 0.1–0.4.** Above 0.6 the
  analyser calls the bank trivial; at 0 the puzzle may be a slog.
- **`parGuesses`** — guesses needed under optimal play. Expect **2** on almost
  any well-built bank, because a player who knows to probe next to the target
  gets there in one step. It is a floor, not a difficulty score: do not tune
  against it, and do not read par 2 as "too easy". A bank with par 2 and a
  resolve rate of 0.08 is a good puzzle — the optimal line exists, but few
  players find it first try.
- **A coin flip is a blocker.** If two candidates cannot be told apart by *any*
  guess in the bank — measured against a reader with a mapping tool, not a
  casual one — the puzzle can end on a guess between two indistinguishable
  places. Replace one of them.
- **Trivial warnings** when most opening guesses isolate the target outright, or
  when the target is the only candidate in its region so the first bearing gives
  it away.

What it cannot do: it takes your coordinates as true. A bank with Sydney in the
northern hemisphere analyses perfectly and plays as nonsense. It also says
nothing about whether the target is *recognisable*, which stays a judgement call.

## Verify before you submit

For **every** location, not just the target:

1. Confirm the place is real and the name is the one a global audience knows it
   by.
2. Check latitude and longitude against **two independent sources** — the
   coordinates on the place's own reference page and a second, unrelated
   gazetteer or mapping source. Two pages that both restate the same wiki entry
   are one source.
3. Sanity-check the sign. A dropped minus puts Sydney in the northern hemisphere
   and is the single most common way this puzzle breaks; the coordinates still
   validate.

Then run `daily_check` and read `parGuesses` before you walk the puzzle
yourself. The analyser catches the coin flip and the trivial bank; your own
walkthrough catches the things it cannot see — an unrecognisable target, a
coordinate that validates but is wrong.

## The fact-check bar

Waypoint asserts real-world facts, so it never queues on the Relay "asserts
nothing" argument. But landmark coordinates are the most durable class of fact
there is, so **the normal case is `factCheck.status: "passed"`** once you have
double-sourced every coordinate as above. Send that string literally, with
`sourceRefs` carrying at least one citation per source you actually used.

Use `"needs_review"` when any of these is true:

- a coordinate you could only confirm from one source;
- a location whose name or status is contested — disputed territories,
  places with competing official names, anything where the region or country
  code is a political claim rather than a fact;
- a target you are not confident a global audience recognises.

Those two strings are the only permitted values; anything else is rejected. See
[the gate](../_daily-shared/run-procedure.md#the-draft--queued-gate).

## Variety across days

`daily_history` and `daily_submit` enforce the no-repeat rule on the fingerprint
— target name plus bank — so an exact rerun is refused. That is a floor, not
variety. Rotate the **target's region** day to day, and avoid rebuilding the same
bank around a new target: a player who sees the same fifteen landmarks every
morning is solving a different puzzle than the one intended.

## Report

Per [run-procedure.md](../_daily-shared/run-procedure.md), plus the target you
chose and why it is recognisable, the bank size and its continental spread,
confirmation that every coordinate was double-sourced, and `daily_check`'s
`firstGuessResolveRate` for the bank you submitted.
