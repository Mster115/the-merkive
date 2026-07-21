import type { Decree, MerkissionerSecret } from "./types";

/** The frozen 17-card deck composition: 6 Merkizen decrees, 11 Merkite decrees. */
export const DECK_MERKIZEN_COUNT = 6;
export const DECK_MERKITE_COUNT = 11;
export const DECK_TOTAL = DECK_MERKIZEN_COUNT + DECK_MERKITE_COUNT;

export function initialSecret(): MerkissionerSecret {
  return {
    draw: { merkizen: DECK_MERKIZEN_COUNT, merkite: DECK_MERKITE_COUNT },
    discard: { merkizen: 0, merkite: 0 },
    topStack: [],
  };
}

/** Hypergeometric single-card sample: mutates the passed-in (already-copied) counts object. */
function sampleOneFrom(counts: { merkizen: number; merkite: number }, rng: () => number): Decree {
  const total = counts.merkizen + counts.merkite;
  if (total <= 0) {
    // Defensive only — callers must reshuffle before this can happen.
    return "merkizen";
  }
  const r = rng();
  if (r < counts.merkite / total) {
    counts.merkite -= 1;
    return "merkite";
  }
  counts.merkizen -= 1;
  return "merkizen";
}

/**
 * Draws `n` concrete cards: committed `topStack` cards first (in the exact
 * order they were shown by a Docket Peek), then hypergeometric samples from
 * the draw pile. Pure — returns a fresh secret, never mutates the input.
 */
export function drawCards(
  secret: MerkissionerSecret,
  n: number,
  rng: () => number
): { cards: Decree[]; secret: MerkissionerSecret } {
  const topStack = [...secret.topStack];
  const draw = { ...secret.draw };
  const discard = { ...secret.discard };
  const cards: Decree[] = [];

  while (cards.length < n) {
    const fromStack = topStack.shift();
    if (fromStack !== undefined) {
      cards.push(fromStack);
      continue;
    }
    if (draw.merkizen + draw.merkite <= 0) {
      // Safety net: should never trigger if reshuffle checks ran on schedule.
      draw.merkizen += discard.merkizen;
      draw.merkite += discard.merkite;
      discard.merkizen = 0;
      discard.merkite = 0;
    }
    cards.push(sampleOneFrom(draw, rng));
  }

  return { cards, secret: { draw, discard, topStack } };
}

/**
 * Docket Peek: samples `n` concrete cards straight off the draw pile,
 * removing them from the counts and committing them to the front of
 * `topStack` so the very next draws are truthful to what was shown.
 */
export function peekCards(
  secret: MerkissionerSecret,
  n: number,
  rng: () => number
): { cards: Decree[]; secret: MerkissionerSecret } {
  const draw = { ...secret.draw };
  const discard = { ...secret.discard };
  const cards: Decree[] = [];

  for (let i = 0; i < n; i++) {
    if (draw.merkizen + draw.merkite <= 0) {
      draw.merkizen += discard.merkizen;
      draw.merkite += discard.merkite;
      discard.merkizen = 0;
      discard.merkite = 0;
    }
    cards.push(sampleOneFrom(draw, rng));
  }

  return { cards, secret: { draw, discard, topStack: [...secret.topStack, ...cards] } };
}

/** Moves discarded decrees into the discard pile counts. */
export function discardCards(secret: MerkissionerSecret, decrees: readonly Decree[]): MerkissionerSecret {
  const discard = { ...secret.discard };
  for (const d of decrees) {
    if (d === "merkite") discard.merkite += 1;
    else discard.merkizen += 1;
  }
  return { draw: { ...secret.draw }, discard, topStack: [...secret.topStack] };
}

/** "Reshuffle discard into draw when draw < 3 at the end of any legislative session (and only then)." */
export function checkReshuffle(secret: MerkissionerSecret): MerkissionerSecret {
  const drawTotal = secret.draw.merkizen + secret.draw.merkite;
  if (drawTotal >= 3) return secret;
  return {
    draw: {
      merkizen: secret.draw.merkizen + secret.discard.merkizen,
      merkite: secret.draw.merkite + secret.discard.merkite,
    },
    discard: { merkizen: 0, merkite: 0 },
    topStack: [...secret.topStack],
  };
}

export function drawPileCount(secret: MerkissionerSecret): number {
  return secret.draw.merkizen + secret.draw.merkite;
}

export function discardPileCount(secret: MerkissionerSecret): number {
  return secret.discard.merkizen + secret.discard.merkite;
}

/**
 * Conservation invariant used by tests: every card is always accounted for
 * across the draw pile, discard pile, committed top-stack, any hands
 * currently in flight, and the two enacted tracks.
 */
export function totalCards(
  secret: MerkissionerSecret,
  handsInFlight: readonly Decree[][],
  merkizenEnacted: number,
  merkiteEnacted: number
): number {
  const inHands = handsInFlight.reduce((sum, hand) => sum + hand.length, 0);
  return (
    secret.draw.merkizen +
    secret.draw.merkite +
    secret.discard.merkizen +
    secret.discard.merkite +
    secret.topStack.length +
    inHands +
    merkizenEnacted +
    merkiteEnacted
  );
}
