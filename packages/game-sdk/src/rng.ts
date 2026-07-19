/** xmur3 string hash → 32-bit seed stream. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32 PRNG over a 32-bit seed. Returns floats in [0,1). */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(seed: string): () => number {
  return mulberry32(xmur3(seed)());
}

/**
 * The canonical per-reduce RNG: deterministic given the match seed and the
 * state version the action is applied against. Server and test harness both
 * use this so reducers replay identically.
 */
export function matchRng(seed: string, version: number): () => number {
  return seededRng(`${seed}:${version}`);
}

export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function pick<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) throw new Error("pick from empty array");
  return items[Math.floor(rng() * items.length)]!;
}
