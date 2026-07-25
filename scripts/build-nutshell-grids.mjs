#!/usr/bin/env node
/**
 * Builds the bank of Nutshell grids that `daily_grid` serves from.
 *
 * Searching for a good grid is expensive and serving one must be instant, so
 * the two are separated. The corner layouts fill in ~20ms but are eight
 * three-letter words — a vocabulary check rather than a solve. The richer
 * layouts score three to four times higher and take seconds to minutes each,
 * which is fine here and impossible inside a tool call.
 *
 * Run it when the bank runs low, or after editing the word list or patterns:
 *
 *   node scripts/build-nutshell-grids.mjs [count] [--minutes N]
 *
 * Output is committed. That makes the supply of puzzles an inspectable,
 * reviewable artifact rather than something regenerated differently on every
 * machine — and "never repeat a puzzle" is easier to reason about against a
 * finite list you can read.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { fillGrid, loadWordList, loadPatterns, scoreGrid, fingerprintPuzzle } from "./mcp/daily-mcp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../packages/games/src/daily/nutshell/grids.json");

const args = process.argv.slice(2);
const target = Number(args.find((a) => /^\d+$/.test(a)) ?? 60);
const minutesArg = args.indexOf("--minutes");
const budgetMs = (minutesArg === -1 ? 20 : Number(args[minutesArg + 1] ?? 20)) * 60_000;

const words = loadWordList();
const patterns = loadPatterns();

/** Richest layouts first — a grid of eight 3-letter words is the last resort. */
function potential(pattern) {
  const g = fillGrid(words, pattern, new Set(), 1);
  return g ? scoreGrid([...g.across, ...g.down].map((s) => s.answer)) : -1;
}

const ranked = patterns
  .map((p) => ({ pattern: p, potential: potential(p) }))
  .filter((p) => p.potential > 0)
  .sort((a, b) => b.potential - a.potential);

console.log(`word list: ${words.length}`);
console.log(`fillable patterns, richest first:`);
for (const r of ranked) console.log(`  ${r.pattern.id.padEnd(20)} sample score ${r.potential}`);

const deadline = Date.now() + budgetMs;
const seen = new Set();
const bank = [];

for (const { pattern } of ranked) {
  if (bank.length >= target || Date.now() > deadline) break;
  let consecutiveMisses = 0;

  for (let seed = 1; seed <= 5000; seed++) {
    if (bank.length >= target || Date.now() > deadline) break;

    const grid = fillGrid(words, pattern, new Set(), seed * 7919 + 13);
    if (!grid) break; // pattern is unfillable from this pool

    const payload = { across: grid.across, down: grid.down };
    const fingerprint = fingerprintPuzzle("nutshell", payload);
    if (seen.has(fingerprint)) {
      // Neighbouring seeds often land on the same solution; give up on a
      // pattern once it stops producing anything new rather than grinding.
      if (++consecutiveMisses > 40) break;
      continue;
    }
    consecutiveMisses = 0;
    seen.add(fingerprint);

    const answers = [...grid.across, ...grid.down].map((s) => s.answer);
    bank.push({
      patternId: grid.patternId,
      gridPattern: grid.gridPattern,
      score: scoreGrid(answers),
      fingerprint,
      across: grid.across.map((s) => ({ number: s.number, row: s.row, col: s.col, length: s.length, answer: s.answer })),
      down: grid.down.map((s) => ({ number: s.number, row: s.row, col: s.col, length: s.length, answer: s.answer })),
    });

    if (bank.length % 5 === 0) {
      console.log(`  ${bank.length}/${target} — ${Math.round((Date.now() - (deadline - budgetMs)) / 1000)}s elapsed`);
    }
  }
}

bank.sort((a, b) => b.score - a.score);
writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), grids: bank }, null, 2)}\n`);

console.log(`\nwrote ${bank.length} grids to ${OUT}`);
if (bank.length) {
  console.log(`score range: ${bank[bank.length - 1].score} … ${bank[0].score}`);
  console.log(`best:  ${[...bank[0].across, ...bank[0].down].map((s) => s.answer).join(", ")}`);
  console.log(`worst: ${[...bank[bank.length - 1].across, ...bank[bank.length - 1].down].map((s) => s.answer).join(", ")}`);
}
