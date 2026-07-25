# Editorial standards for daily content

Applies to every daily game. Game-specific rules live in the per-game
documents; where they conflict, the game-specific rule wins.

## 1. The one non-negotiable

**Never invent a fact, a source, or a citation.** A daily puzzle asserts its
answer key to the player as truth and offers no appeal — a wrong key is not a
small defect, it is the product failing at the only thing it claims to do. If
a fact cannot be verified against a real, retrievable source, the cell does not
ship. Drop it and pick a different one; an empty queue slot is recoverable, a
confidently wrong answer is not.

Corollaries:

- Every URL in `sourceRefs` must be one actually retrieved and read, not
  reconstructed from memory of what a URL for that topic probably looks like.
- A model's own recall is **not** a source. It may propose a candidate fact; a
  retrieved page confirms it.
- If a source is paywalled or fetch failed, it did not verify anything.

## 2. Source tiers

**Tier 1 — citable on their own** (two of these agreeing = verified):
- Primary/official: government statistics agencies, court filings, company
  filings, official org sites for facts about themselves, standards bodies,
  peer-reviewed papers.
- Reference: Britannica, national library/archive records, established
  almanacs, sport/league official record books.
- Major wire services and papers of record for events: AP, Reuters, BBC, AFP.

**Retrievability is part of the tier.** A source that cannot be fetched cannot
verify anything, and several obvious Tier-1 candidates block automated access:
Britannica and the CIA World Factbook both return `403`, and guessed URLs on
government sites usually `404`. What worked in practice: `science.nasa.gov`,
`periodic-table.rsc.org`, `usgs.gov` glossaries, `tsunami.gov`. **Search first
and fetch the URL the search returns** — do not guess URLs.

**Tier 2 — supporting only** (never the sole basis for an answer):
- Wikipedia (use it to *find* the primary source, then cite the primary one).
- Specialist enthusiast databases (IMDb, Discogs, Baseball-Reference) for
  non-controversial catalogue facts.
- Reputable secondary press.

**Tier 0 — not sources**: social posts, AI-generated summaries, content farms,
SEO listicles, forums, anything undated, anything whose own sourcing is
invisible.

Cite Tier 1 in `sourceRefs`. A `title` must be the page's actual title.

## 3. Fact-check rubric

Score each Nexus cell (word games skip this — see below):

| Check | Requirement |
| --- | --- |
| Verified | ≥2 independent Tier-1 sources state the answer, and they agree |
| Independent | Not two outlets republishing one wire story; not a site and its own mirror |
| Unique | No other answer also satisfies the question *and* both category labels |
| Stable | The answer will still be correct on the puzzle date and afterwards |
| Fresh enough | Nothing depending on a fact younger than 72h (retractions cluster there) |
| Unambiguous | Spelling/format variants are enumerated in `acceptableAnswers` |

A pack is `factCheck.status: "passed"` only if **all 9 cells** clear **all six
rows**. Otherwise `"needs_review"` with the specific failing cells named. There
is no partial pass — the grid ships as a unit.

Record the check honestly. Marking a pack passed because the queue is short is
the single worst failure mode available here: it converts a queue-health
warning into a live wrong answer, and the `draft` state exists precisely so
that trade never has to be made.

### Why word games are exempt

Nutshell and Relay assert nothing about the world. Their correctness is
structural and machine-verified: `solveGrid` proves every Nutshell answer comes
from the supplied pool and that crossing letters agree; `findValidChain` proves
a Relay chain exists. `validatePack` rejects them outright otherwise. Their
`sourceRefs` may be empty. Their editorial risk is *clue quality*, not truth —
covered in each game's document.

## 4. Originality and copyright

- Clues and questions must be **original text you wrote**. Never copy a clue
  from NYT/Guardian/any other puzzle, published or archived.
- Never use song lyrics, poem lines, or extended quotations as content.
- Trademarks and titles as *answers* are fine (they are facts). Reproducing
  copyrighted *text* is not.
- Don't reproduce another outlet's distinctive question phrasing even when the
  underlying fact is public.

## 4a. Cultural currency

A daily puzzle should feel like it belongs to the week it runs in. The routine
opens each run by searching for what is actually happening — releases, results,
awards, sport, science — and works some of it in: a few Nexus cells, Nutshell
clues (the words are fixed, so the clues carry it), a loosely themed Relay bank.

Two limits keep that from becoming a liability:

- **It must still be true later.** Puzzles are replayed from the archive for
  months. "The current champion" is wrong by then; "the 2026 champion" is
  permanent. Never "this week", "recently", or "currently".
- **Nothing younger than 72 hours.** Corrections and retractions cluster in the
  first days. A puzzle that ships a story that later collapsed is worse than one
  that ignored it.

Topical does not mean American, and it does not mean celebrity gossip. A
question that lands in Manila as well as Chicago is worth more than one that
does not.

## 5. Difficulty and feel

- **Nexus**: aim for a median solver getting 5–7 of 9. Include at least two
  cells most people will get and at most two genuinely hard ones. One guess per
  cell means near-misses are punished — reward recall, not spelling.
- **Nutshell**: everyday vocabulary. Wordplay in clues is welcome; obscurity is
  not. A 5×5 mini should take ~2 minutes.
- **Relay**: the intended chain should be findable in ~3 minutes; decoys should
  be plausible rather than nonsense.
- Prefer facts a broad audience can reach from more than one direction (a film,
  its star, its year) over single-path trivia.

## 6. Safety and inclusion

- No content about private individuals; public figures only, and only their
  public roles and work.
- Nothing that requires knowing about a death, crime, disaster, or medical
  condition of a named living person.
- No slurs, and no answers whose humour depends on a protected characteristic.
- Avoid US-only defaults where a global framing is available; when a question is
  region-specific, say so in the question text.
- Avoid live political controversies; settled civics and history are fine.

## 7. Variety and repeats

**The platform now refuses an exact repeat**: `submitPack` fingerprints every
pack's assembled answer key and rejects a match with `409 duplicate_puzzle`, so
the same puzzle can never ship twice whatever submits it. That is a floor, not
a variety policy — it says nothing about the same answer turning up two days
running. The rest is editorial:

- No answer repeats within 30 days, per game. `daily_history` will tell you
  which of your candidates are already spent.
- Nexus: no category label repeats within 14 days; no more than one cell per
  grid from any one domain pairing.
- Nutshell: no more than 3 words shared with the previous 7 days' grids.
- Relay: `startWord`/`endWord` pairs never repeat; vary the chain length.
- Rotate subject domains across a week so no single topic dominates.

`daily_history` answers "have I used this?" without handing back unplayed
answer keys, so the routine does not need to keep its own log.

## 8. Language

English (`en`) only for now. All player-facing strings inside a payload
(questions, clues) are content, not i18n keys — they ship as written. Game
*chrome* strings are separate and live in each game's `i18n` block in the repo.
