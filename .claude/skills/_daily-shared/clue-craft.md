# Crossword clue craft

Reference for Nutshell. These are the conventions professional crossword editors
apply; following them is most of the difference between a puzzle that feels
hand-made and one that feels generated.

## Contents

- The substitutability rule
- Agreement: part of speech, tense, number
- Signalling non-standard answers
- The question-mark convention
- Clue variety in a small grid
- Crosswordese
- Fairness: the Natick principle
- Machine-generation failure modes

## The substitutability rule

**A clue and its answer must be interchangeable in a natural sentence** without
breaking syntax, tense or part of speech. This is the single test that catches
most bad clues.

| Answer | Clue | Test | |
| --- | --- | --- | --- |
| `QUICK` | Fast | "She gave a [quick/fast] response." | ✅ |
| `QUICK` | Swiftly | "She gave a [quick/*swiftly] response." | ❌ adverb for adjective |
| `ELATE` | Make ecstatic | "The news will [elate/make ecstatic] them." | ✅ |
| `ELATE` | Ecstatic | "The news will [elate/*ecstatic] them." | ❌ adjective for verb |

## Agreement

- **Number.** `CAT` → "Feline pet", never "Feline pets". `GEESE` → "V-formation
  flyers", never "Honking bird".
- **Tense.** `RUN` → "Sprint on foot"; `RAN` → "Sprinted on foot"; `RUNNING` →
  "Sprinting on foot". An `-ING` answer takes an `-ING` clue.
- **Transitivity.** `SEEK` → "Look for" (takes an object); `SOAR` → "Fly high"
  (does not).
- **Degree.** `COLD` → "Chilly"; `COLDER` → "More chilly"; `COLDEST` → "Most
  chilly".

## Signalling non-standard answers

Whenever the answer is not plain, singular, unabbreviated English, **the clue
must say so.** An unsignalled deviation reads as an error to the solver.

| Answer type | Requirement | Good | Bad |
| --- | --- | --- | --- |
| Abbreviation | "for short", "in brief", "Abbr.", or an abbreviation inside the clue | `MGR` → "Dept. head" | `MGR` → "Office manager" |
| Foreign word | Name the language or locale | `ETE` → "Summer, in Paris" | `ETE` → "Warmest season" |
| Plural | Plural definition | `GEESE` → "V-formation flyers" | `GEESE` → "Honking bird" |
| Slang/informal | "slangily", "informally", or slang phrasing | `PEEPS` → "Pals, informally" | `PEEPS` → "Friends" |

## The question-mark convention

A trailing `?` is a strict signal, not decoration.

- **Wordplay, pun or misdirection → `?` required.** "Bar fixture?" → `SOAP`.
- **Literal definition → `?` forbidden.** "Washing block" → `SOAP`.

Using `?` on a straight definition tells the solver to look for a trick that
isn't there, which is worse than no signal at all.

## Clue variety in a small grid

Ten clues, all of the same type, makes a flat puzzle. A good rough mix for a
5×5:

- **Straight definitions** — about half. The backbone.
- **Wordplay / puns** (each with `?`) — two or three. The reason to play.
- **Trivia / general knowledge** — one or two, and only accessible ones.
- **Fill-in-the-blank** — at most one, as an easy anchor.

Give the solver at least two answers gettable on sight; a mini where nothing
falls immediately is a mini nobody finishes.

## Crosswordese

Words that survive in puzzles only because their letters are convenient, not
because anyone says them. They are the clearest tell of a machine-made or
lazily-filled grid.

**Avoid seeding:** ADIT, ALEE, ANOA, ASEA, EBON, ECRU, ELAN, ERNE, ESNE, ETUI,
NENE, OLEO, ONER, ORT, OSIER, SNEE.

**Fine, but clue them from the modern world, not the dictionary:**

| Word | Not this | This |
| --- | --- | --- |
| `OREO` | "Nabisco treat" | "Twist, lick, dunk cookie" |
| `ALOE` | "Liliaceous plant" | "Sunburn-soothing gel" |
| `EEL` | "Snake-like fish" | "Unagi, at a sushi bar" |
| `ARIA` | "Operatic solo" | "Showstopper at La Scala" |

Note this is a judgment list, not a validated blacklist — `daily_grid` draws from
its own pool, so treat it as guidance for seeds and for spotting a dull grid
worth rerolling.

## Fairness: the Natick principle

Named by Michael Sharp (*Rex Parker Does the NYT Crossword*) after a puzzle
crossing the town NATICK with N.C. WYETH at a letter no solver could deduce.

> **If an entry is a niche proper noun or a low-frequency word, every entry
> crossing it must be ordinary everyday vocabulary.**

Two obscure proper nouns must never intersect. In a 5×5 there is no room to
recover from a blind guess — the solver simply fails.

Practical corollaries for a global audience:

- Prefer globally recognised names over locally famous ones. A US college town,
  a state postal abbreviation, or a domestic sports acronym fails outside its
  country.
- If an intersection admits more than one valid letter (`CA_E`/`SA_E` works with
  N, T, R, M, V), **both** crossing clues must pin their answer down exactly.

## Machine-generation failure modes

The specific mistakes that make a generated puzzle feel wrong:

1. **Letter-level claims.** Never assert an anagram, a reversal, a letter count
   or a "starts/ends with" fact — these are unreliable to compute token-wise and
   a wrong one is instantly visible.
2. **Root leakage.** "One who goes out for a run" for `RUNNER`. The answer's stem
   must not appear in its clue.
3. **Part-of-speech drift.** A past-tense clue on a present-tense answer.
4. **Dictionary dumps.** "A carnivorous quadruped of the family Canidae" for
   `DOG` — correct, and lifeless.
5. **Unsignalled abbreviations and foreign words** — see above; the most common
   generated-clue error.
