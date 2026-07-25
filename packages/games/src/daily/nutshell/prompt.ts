import { PATTERN_LIBRARY, type PatternTemplate, type DerivedSlot } from "./patterns";

/**
 * Hand-written grids for the content brief, keyed by pattern id.
 *
 * Only used to illustrate a valid fill. `pickRecommendedPattern` prefers a
 * pattern that has one, but never depends on it — an entry going missing (or
 * its pattern leaving the library) drops the example, it does not break the
 * brief.
 */
const EXAMPLE_FILLS: Record<string, { across: string[]; down: string[] }> = {
  staircase_tl_br: {
    across: ["ARC", "MINOR", "ANGLE", "SCREW", "SHY"],
    down: ["ANGRY", "ROLE", "CREW", "MASS", "INCH"],
  },
};

/** Slot lengths of a pattern, counted by length: `{ 3: 2, 4: 4, 5: 4 }`. */
export function lengthHistogram(pattern: PatternTemplate): Record<number, number> {
  const hist: Record<number, number> = {};
  for (const slot of [...pattern.across, ...pattern.down]) {
    hist[slot.length] = (hist[slot.length] ?? 0) + 1;
  }
  return hist;
}

/**
 * The pattern the brief should ask a constructor to design for.
 *
 * Fewest five-letter slots first, because those are what everyday vocabulary
 * runs out of — an all-open 5x5 needs a double word square and is effectively
 * unfillable from common words. Ties break toward a pattern with a worked
 * example, then toward library order (which is already easiest-first), so this
 * tracks `PATTERN_LIBRARY` automatically instead of naming a pattern that a
 * later edit could reorder or remove.
 */
export function pickRecommendedPattern(
  patterns: PatternTemplate[] = PATTERN_LIBRARY
): PatternTemplate {
  const first = patterns[0];
  if (!first) throw new Error("PATTERN_LIBRARY is empty");

  return patterns.reduce((best, candidate) => {
    const bestFives = lengthHistogram(best)[5] ?? 0;
    const candFives = lengthHistogram(candidate)[5] ?? 0;
    if (candFives !== bestFives) return candFives < bestFives ? candidate : best;

    const bestHasExample = best.id in EXAMPLE_FILLS;
    const candHasExample = candidate.id in EXAMPLE_FILLS;
    if (candHasExample !== bestHasExample) return candHasExample ? candidate : best;

    return best; // library order wins the remaining ties
  }, first);
}

function describeSlots(slots: DerivedSlot[]): string {
  return slots
    .map((s) => `    (row ${s.row}, col ${s.col}) length ${s.length}`)
    .join("\n");
}

function describeHistogram(hist: Record<number, number>): string {
  return Object.keys(hist)
    .map(Number)
    .sort((a, b) => a - b)
    .map((len) => `${hist[len]} ${len}-letter`)
    .join(", ");
}

function describeExample(pattern: PatternTemplate): string {
  const fill = EXAMPLE_FILLS[pattern.id];
  if (!fill) return "";
  if (
    fill.across.length !== pattern.across.length ||
    fill.down.length !== pattern.down.length
  ) {
    return ""; // the pattern changed shape; an out-of-date example helps nobody
  }

  // Render the example into the pattern's own grid so the picture can never
  // disagree with the geometry printed above it.
  const rows = pattern.gridPattern.map((row) => row.split(""));
  pattern.across.forEach((slot, i) => {
    const word = fill.across[i]!;
    for (let k = 0; k < slot.length; k++) rows[slot.row]![slot.col + k] = word[k]!;
  });

  const picture = rows
    .map((cells) => `  ${cells.map((ch) => (ch === "#" ? "." : ch)).join(" ")}`)
    .join("\n");

  return `\nWorked example of a valid fill:\n\n${picture}\n\n  across: ${fill.across.join(
    ", "
  )}\n  down:   ${fill.down.join(", ")}\n`;
}

/**
 * The content brief for a Nutshell puzzle.
 *
 * It asks for a *constructed* grid rather than a loose pool of nice words,
 * because `solveGrid` verifies an interlock — it does not discover one.
 * Measured: a pool of ~1,200 curated everyday 3-5 letter words yields NO fill
 * on any of the seven patterns — the search exhausts, and neither a 20M step
 * budget nor twelve shuffled restarts changes that — while ten words chosen to
 * interlock solve instantly, and still solve with ~12 spares added. Fills do
 * appear once the word list reaches a few thousand entries, but at that depth
 * they are archaic (URARE, NEUME, IWIS): of 400 grids solved from a 14k
 * dictionary, none had all ten words in everyday vocabulary. With 0-2 blocked
 * squares a fill is close to a double word square, so it has to be designed
 * rather than discovered. Asking for a pool produces submissions `validatePack`
 * rejects with "Failed to assemble valid crossword grid from candidate pool".
 *
 * Every geometry fact below is derived from `PATTERN_LIBRARY`, so editing the
 * library updates the brief rather than silently making it wrong.
 *
 * Keep in step with docs/daily-content/nutshell.md.
 */
export function generatePrompt(puzzleDate: string): string {
  const pattern = pickRecommendedPattern();
  const hist = lengthHistogram(pattern);
  const blocked = pattern.gridPattern.map((row) => `  ${row}`).join("\n");
  const totalSlots = pattern.across.length + pattern.down.length;

  return `Construct a 5x5 mini crossword grid for date ${puzzleDate}, then submit its words.

IMPORTANT: you must design the interlocking grid yourself. The server's solver
verifies a construction; it does not discover one. Submitting an assortment of
words and hoping a grid is found inside them does not work — a pool of ~1,200
everyday words yields no valid grid at all, on any layout, while
${totalSlots} words chosen to interlock are accepted immediately.

Design for this layout ("#" is a blocked square, "." is a letter):

${blocked}

  across slots:
${describeSlots(pattern.across)}

  down slots:
${describeSlots(pattern.down)}

So: ${describeHistogram(hist)} words, ${totalSlots} in total, all distinct. A
mirror image of this layout is equally acceptable. Do not design for a fully
open 5x5 — that requires a double word square, which everyday English cannot
supply.
${describeExample(pattern)}
Procedure:
1. Fill the longest across slots first, choosing words whose shared columns
   spell plausible letter sequences.
2. Read the columns off and find real words for them, adjusting the across
   words whenever a column will not resolve. Expect several passes.
3. Fill the shortest across slots last; they are the most forgiving.
4. Verify every crossing by hand: at each shared cell the across word's letter
   must equal the down word's letter. Do this before submitting, every time.
5. Write an original clue for each word.

Aids: favour common letters (E A R S T L N O I) at crossings; vowel-rich short
words (ERA, OAT, ICE, ARIA, OBOE) rescue awkward columns; -S, -ED and -ER
endings help a column resolve; use at most one word containing J, Q, X, Z or V.

Submit payload.candidates as your ${totalSlots} grid words plus about ten spare
candidates (spares give the solver alternates if one word has a flaw, and are
harmless). Each candidate is a JSON object with "word" (uppercase A-Z, 3-5
letters only — no spaces, digits, hyphens, apostrophes or accents, or it is
silently dropped) and "clue" (original text).

Clues: original text only, never lifted from a published crossword; roughly 60
characters maximum; part of speech and number matching the answer; no obscure
proper nouns, niche trivia, or copyrighted phrases; never contain the answer
word; signal abbreviations ("Doctor, briefly").`;
}
