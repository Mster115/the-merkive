export interface Tile {
  id: string;
  n: number; // 1..13 (0 for joker)
  c: number; // 0..3 (0 for joker)
  joker?: boolean;
}

export interface Meld {
  id: string;
  tiles: Tile[];
}

export type CommitValidationResult =
  | {
      ok: true;
      placedTiles: Tile[];
      newMeldsTotal: number;
    }
  | {
      ok: false;
      code: string;
      error: string;
    };

export function rackPipSum(rack: Tile[]): number {
  let sum = 0;
  for (const t of rack) {
    if (t.joker) sum += 30;
    else sum += t.n;
  }
  return sum;
}

/**
 * Checks if an array of tiles forms a valid GROUP or RUN.
 */
export function isValidMeld(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 13) return false;
  return isGroup(tiles) || isRun(tiles);
}

/**
 * Calculates the total point value of a meld, substituting jokers with their inferred values.
 */
export function meldValue(tiles: Tile[]): number {
  if (!isValidMeld(tiles)) return 0;
  const reals = tiles.filter((t) => !t.joker);
  const allSameN = reals.length === 0 || reals.every((r) => r.n === reals[0]!.n);

  if (allSameN && isGroup(tiles)) {
    return getGroupValue(tiles);
  }
  if (isRun(tiles)) {
    return getRunValue(tiles);
  }
  if (isGroup(tiles)) {
    return getGroupValue(tiles);
  }
  return 0;
}

function isGroup(tiles: Tile[]): boolean {
  const len = tiles.length;
  if (len < 3 || len > 4) return false;

  const reals = tiles.filter((t) => !t.joker);
  if (reals.length === 0) return true;

  const firstN = reals[0]!.n;
  if (firstN < 1 || firstN > 13) return false;

  const colors = new Set<number>();
  for (const t of reals) {
    if (t.n !== firstN) return false;
    if (colors.has(t.c)) return false;
    colors.add(t.c);
  }

  return true;
}

function getGroupValue(tiles: Tile[]): number {
  const reals = tiles.filter((t) => !t.joker);
  const n = reals.length > 0 ? reals[0]!.n : 13;
  return n * tiles.length;
}

function isRun(tiles: Tile[]): boolean {
  const len = tiles.length;
  if (len < 3 || len > 13) return false;

  const reals = tiles.filter((t) => !t.joker);
  if (reals.length === 0) return true;

  const firstColor = reals[0]!.c;
  const numbers = reals.map((t) => t.n);

  for (const t of reals) {
    if (t.c !== firstColor) return false;
  }

  const numSet = new Set(numbers);
  if (numSet.size !== numbers.length) return false;

  const minN = Math.min(...numbers);
  const maxN = Math.max(...numbers);

  if (minN < 1 || maxN > 13) return false;
  if (maxN - minN + 1 > len) return false;

  const minStartN = Math.max(1, maxN - len + 1);
  const maxStartN = Math.min(minN, 13 - len + 1);

  return minStartN <= maxStartN;
}

function getRunValue(tiles: Tile[]): number {
  const len = tiles.length;
  const reals = tiles.filter((t) => !t.joker);

  if (reals.length === 0) {
    const startN = 13 - len + 1;
    return len * startN + (len * (len - 1)) / 2;
  }

  const numbers = reals.map((t) => t.n);
  const minN = Math.min(...numbers);
  const maxN = Math.max(...numbers);

  const minStartN = Math.max(1, maxN - len + 1);
  const maxStartN = Math.min(minN, 13 - len + 1);

  // Try array order first
  let arrayStartN: number | null = null;
  for (let s = minStartN; s <= maxStartN; s++) {
    let matches = true;
    for (let i = 0; i < len; i++) {
      const t = tiles[i]!;
      if (!t.joker && t.n !== s + i) {
        matches = false;
        break;
      }
    }
    if (matches) {
      arrayStartN = s;
      break;
    }
  }

  const chosenStartN = arrayStartN ?? maxStartN;
  return len * chosenStartN + (len * (len - 1)) / 2;
}

function extractTiles(m: Tile[] | { tiles: Tile[] }): Tile[] {
  return Array.isArray(m) ? m : m.tiles;
}

/**
 * Validates a table commit proposal.
 */
export function validateCommit(
  oldTable: (Tile[] | { tiles: Tile[] })[],
  rack: Tile[],
  proposal: { melds: Tile[][]; placedTileIds: string[] },
  hasMelded: boolean = true,
  initialMeldPoints: number = 30
): CommitValidationResult {
  const { melds, placedTileIds } = proposal;

  if (placedTileIds.length === 0) {
    return { ok: false, code: "nothing_placed", error: "Must place at least one tile from your rack" };
  }

  const uniquePlaced = new Set(placedTileIds);
  if (uniquePlaced.size !== placedTileIds.length) {
    return { ok: false, code: "tiles_not_conserved", error: "Duplicate tile IDs in placedTileIds" };
  }

  const rackMap = new Map<string, Tile>();
  for (const t of rack) {
    rackMap.set(t.id, t);
  }

  const placedTiles: Tile[] = [];
  for (const id of placedTileIds) {
    const tile = rackMap.get(id);
    if (!tile) {
      return { ok: false, code: "not_in_rack", error: `Tile ${id} is not in your rack` };
    }
    placedTiles.push(tile);
  }

  for (const meld of melds) {
    if (!isValidMeld(meld)) {
      return { ok: false, code: "invalid_meld", error: "One or more melds on the table are invalid" };
    }
  }

  const oldTileIds: string[] = [];
  for (const m of oldTable) {
    for (const t of extractTiles(m)) {
      oldTileIds.push(t.id);
    }
  }

  const expectedIds = [...oldTileIds, ...placedTileIds].sort();
  const proposedIds: string[] = [];
  for (const meld of melds) {
    for (const t of meld) {
      proposedIds.push(t.id);
    }
  }
  proposedIds.sort();

  if (expectedIds.length !== proposedIds.length) {
    return { ok: false, code: "tiles_not_conserved", error: "Table tile count does not match expected" };
  }

  for (let i = 0; i < expectedIds.length; i++) {
    if (expectedIds[i] !== proposedIds[i]) {
      return { ok: false, code: "tiles_not_conserved", error: "Table tiles do not match expected tile set" };
    }
  }

  if (!hasMelded) {
    const oldMeldKeyCounts = new Map<string, number>();
    for (const m of oldTable) {
      const tiles = extractTiles(m);
      const key = tiles.map((t) => t.id).sort().join(",");
      oldMeldKeyCounts.set(key, (oldMeldKeyCounts.get(key) ?? 0) + 1);
    }

    const proposedMeldsUnmatched: Tile[][] = [];
    for (const meld of melds) {
      const key = meld.map((t) => t.id).sort().join(",");
      const count = oldMeldKeyCounts.get(key) ?? 0;
      if (count > 0) {
        if (count === 1) oldMeldKeyCounts.delete(key);
        else oldMeldKeyCounts.set(key, count - 1);
      } else {
        proposedMeldsUnmatched.push(meld);
      }
    }

    if (oldMeldKeyCounts.size > 0) {
      return {
        ok: false,
        code: "cannot_rearrange_before_meld",
        error: "Cannot modify or rearrange existing table melds before your initial meld",
      };
    }

    let newMeldsTotal = 0;
    for (const meld of proposedMeldsUnmatched) {
      newMeldsTotal += meldValue(meld);
    }

    if (newMeldsTotal < initialMeldPoints) {
      return {
        ok: false,
        code: "initial_meld_too_low",
        error: `Initial meld points (${newMeldsTotal}) is less than required (${initialMeldPoints})`,
      };
    }

    return { ok: true, placedTiles, newMeldsTotal };
  }

  let newMeldsTotal = 0;
  for (const meld of melds) {
    newMeldsTotal += meldValue(meld);
  }

  return { ok: true, placedTiles, newMeldsTotal };
}
