import { describe, it, expect } from "vitest";
import {
  createTestMatch,
  act,
  fireTimer,
  abandonSeat,
  botStep,
} from "@merky/game-sdk/testing";
import { tiletangle } from "../index";
import type { Tile } from "../tiles";
import { isValidMeld, meldValue, validateCommit } from "../tiles";
import type { TileTanglePrivateState, TileTanglePublicState } from "../logic";

describe("Tile Tangle - Validation Engine", () => {
  it("validates groups and runs correctly", () => {
    // Valid group (3 different colors, same number)
    const validGroup3: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "0-7-1", n: 7, c: 1 },
      { id: "0-7-2", n: 7, c: 2 },
    ];
    expect(isValidMeld(validGroup3)).toBe(true);
    expect(meldValue(validGroup3)).toBe(21);

    // Valid group (4 different colors)
    const validGroup4: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "0-7-1", n: 7, c: 1 },
      { id: "0-7-2", n: 7, c: 2 },
      { id: "0-7-3", n: 7, c: 3 },
    ];
    expect(isValidMeld(validGroup4)).toBe(true);
    expect(meldValue(validGroup4)).toBe(28);

    // Invalid group: duplicate color
    const dupeColorGroup: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "1-7-0", n: 7, c: 0 },
      { id: "0-7-1", n: 7, c: 1 },
    ];
    expect(isValidMeld(dupeColorGroup)).toBe(false);

    // Valid run (consecutive numbers, same color)
    const validRun: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "0-8-0", n: 8, c: 0 },
      { id: "0-9-0", n: 9, c: 0 },
    ];
    expect(isValidMeld(validRun)).toBe(true);
    expect(meldValue(validRun)).toBe(24);

    // Invalid run: wrap-around (12, 13, 1)
    const wrapRun: Tile[] = [
      { id: "0-12-0", n: 12, c: 0 },
      { id: "0-13-0", n: 13, c: 0 },
      { id: "0-1-0", n: 1, c: 0 },
    ];
    expect(isValidMeld(wrapRun)).toBe(false);

    // Invalid 2-tile melds
    const twoTiles: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "0-8-0", n: 8, c: 0 },
    ];
    expect(isValidMeld(twoTiles)).toBe(false);
  });

  it("handles joker substitutions and two-joker melds", () => {
    const singleJokerRun: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "j-0", n: 0, c: 0, joker: true },
      { id: "0-9-0", n: 9, c: 0 },
    ];
    expect(isValidMeld(singleJokerRun)).toBe(true);
    expect(meldValue(singleJokerRun)).toBe(24); // 7 + 8 + 9

    const twoJokerGroup: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "j-0", n: 0, c: 0, joker: true },
      { id: "j-1", n: 0, c: 0, joker: true },
    ];
    expect(isValidMeld(twoJokerGroup)).toBe(true);
    expect(meldValue(twoJokerGroup)).toBe(21); // 7 * 3
  });

  it("catches validateCommit tile conservation errors", () => {
    const rack: Tile[] = [
      { id: "0-7-0", n: 7, c: 0 },
      { id: "0-7-1", n: 7, c: 1 },
      { id: "0-7-2", n: 7, c: 2 },
    ];

    // Dropped tile
    const droppedRes = validateCommit(
      [],
      rack,
      {
        melds: [
          [
            { id: "0-7-0", n: 7, c: 0 },
            { id: "0-7-1", n: 7, c: 1 },
          ],
        ],
        placedTileIds: ["0-7-0", "0-7-1", "0-7-2"],
      },
      false,
      20
    );
    expect(droppedRes.ok).toBe(false);
    if (!droppedRes.ok) expect(droppedRes.code).toBe("invalid_meld");

    // Duplicated tile in proposal
    const dupRes = validateCommit(
      [],
      rack,
      {
        melds: [
          [
            { id: "0-7-0", n: 7, c: 0 },
            { id: "0-7-0", n: 7, c: 0 },
            { id: "0-7-1", n: 7, c: 1 },
          ],
        ],
        placedTileIds: ["0-7-0", "0-7-1", "0-7-2"],
      },
      false,
      20
    );
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) expect(dupRes.code).toBe("invalid_meld");

    // Foreign tile not in rack/table
    const foreignRes = validateCommit(
      [],
      rack,
      {
        melds: [
          [
            { id: "0-7-0", n: 7, c: 0 },
            { id: "0-7-1", n: 7, c: 1 },
            { id: "9-9-9", n: 7, c: 2 },
          ],
        ],
        placedTileIds: ["0-7-0", "0-7-1", "0-7-2"],
      },
      false,
      20
    );
    expect(foreignRes.ok).toBe(false);
    if (!foreignRes.ok) expect(foreignRes.code).toBe("tiles_not_conserved");
  });

  it("enforces pre-meld rearrangement and initial meld threshold", () => {
    const oldTableMeld: Tile[] = [
      { id: "0-1-0", n: 1, c: 0 },
      { id: "0-2-0", n: 2, c: 0 },
      { id: "0-3-0", n: 3, c: 0 },
    ];
    const oldTable = [oldTableMeld];

    const rack: Tile[] = [
      { id: "0-4-0", n: 4, c: 0 },
      { id: "0-10-1", n: 10, c: 1 },
      { id: "0-10-2", n: 10, c: 2 },
      { id: "0-10-3", n: 10, c: 3 },
    ];

    // Attempting to modify old table before melding -> rejected
    const rearrangeRes = validateCommit(
      oldTable,
      rack,
      {
        melds: [
          [
            { id: "0-1-0", n: 1, c: 0 },
            { id: "0-2-0", n: 2, c: 0 },
            { id: "0-3-0", n: 3, c: 0 },
            { id: "0-4-0", n: 4, c: 0 },
          ],
          [
            { id: "0-10-1", n: 10, c: 1 },
            { id: "0-10-2", n: 10, c: 2 },
            { id: "0-10-3", n: 10, c: 3 },
          ],
        ],
        placedTileIds: ["0-4-0", "0-10-1", "0-10-2", "0-10-3"],
      },
      false,
      30
    );
    expect(rearrangeRes.ok).toBe(false);
    if (!rearrangeRes.ok) expect(rearrangeRes.code).toBe("cannot_rearrange_before_meld");

    // Initial meld 27 points (9*3 = 27) -> rejected
    const lowRack: Tile[] = [
      { id: "0-9-0", n: 9, c: 0 },
      { id: "0-9-1", n: 9, c: 1 },
      { id: "0-9-2", n: 9, c: 2 },
    ];
    const lowRes = validateCommit(
      [],
      lowRack,
      {
        melds: [lowRack],
        placedTileIds: ["0-9-0", "0-9-1", "0-9-2"],
      },
      false,
      30
    );
    expect(lowRes.ok).toBe(false);
    if (!lowRes.ok) expect(lowRes.code).toBe("initial_meld_too_low");

    // Initial meld 30 points (10*3 = 30) -> accepted
    const passRack: Tile[] = [
      { id: "0-10-0", n: 10, c: 0 },
      { id: "0-10-1", n: 10, c: 1 },
      { id: "0-10-2", n: 10, c: 2 },
    ];
    const passRes = validateCommit(
      [],
      passRack,
      {
        melds: [passRack],
        placedTileIds: ["0-10-0", "0-10-1", "0-10-2"],
      },
      false,
      30
    );
    expect(passRes.ok).toBe(true);
  });

  it("property test: 200 random valid melds pass and 200 corrupted melds fail", () => {
    let validCount = 0;
    let corruptedCount = 0;

    for (let i = 0; i < 200; i++) {
      // Generate valid run or group
      const isRun = i % 2 === 0;
      let tiles: Tile[] = [];
      if (isRun) {
        const len = 3 + (i % 6); // 3..8
        const color = i % 4;
        const startN = 1 + (i % (14 - len));
        for (let j = 0; j < len; j++) {
          tiles.push({ id: `r-${i}-${j}`, n: startN + j, c: color });
        }
      } else {
        const len = 3 + (i % 2); // 3..4
        const n = 1 + (i % 13);
        for (let j = 0; j < len; j++) {
          tiles.push({ id: `g-${i}-${j}`, n, c: j });
        }
      }

      // Add joker randomly to ~50%
      if (i % 3 === 0 && tiles.length > 0) {
        tiles[0] = { id: `joker-${i}`, n: 0, c: 0, joker: true };
      }

      if (isValidMeld(tiles)) validCount++;

      // Corrupt it
      let corruptTiles = [...tiles];
      if (i % 3 === 0) {
        // change length to 2
        corruptTiles = corruptTiles.slice(0, 2);
      } else if (i % 3 === 1) {
        // dupe color / invalid numbers
        corruptTiles.push({ id: `corrupt-${i}`, n: 99, c: 0 });
      } else {
        // wrap around number
        corruptTiles = [
          { id: "c1", n: 12, c: 0 },
          { id: "c2", n: 13, c: 0 },
          { id: "c3", n: 1, c: 0 },
        ];
      }

      if (!isValidMeld(corruptTiles)) corruptedCount++;
    }

    expect(validCount).toBe(200);
    expect(corruptedCount).toBe(200);
  });
});

describe("Tile Tangle - Reducer & Match Flow", () => {
  it("initializes match with 14 tiles per player and pool of 106", () => {
    const m = createTestMatch(tiletangle, { players: 4, seed: "init-seed-1" });
    const pub = m.state.publicState as TileTanglePublicState;

    expect(pub.drawPileCount).toBe(106 - 4 * 14); // 50
    expect(Object.keys(pub.rackCounts).length).toBe(4);
    for (let s = 0; s < 4; s++) {
      expect(pub.rackCounts[s as keyof typeof pub.rackCounts]).toBe(14);
      const priv = m.state.privateState[s as keyof typeof m.state.privateState] as TileTanglePrivateState;
      expect(priv.rack.length).toBe(14);
    }
  });

  it("runs full 2-player scripted match to game_over with scoring math checked", () => {
    const m = createTestMatch(tiletangle, { players: 2, seed: "scripted-1" });
    let pub = m.state.publicState as TileTanglePublicState;
    let priv0 = m.state.privateState[0] as TileTanglePrivateState;

    act(m, 0, "draw", {});
    pub = m.state.publicState as TileTanglePublicState;
    expect(pub.activeSeat).toBe(1);

    act(m, 1, "draw", {});
    pub = m.state.publicState as TileTanglePublicState;
    expect(pub.activeSeat).toBe(0);

    // Give player 0 a winning rack commit
    priv0 = m.state.privateState[0] as TileTanglePrivateState;
    const customRack: Tile[] = [
      { id: "custom-10-0", n: 10, c: 0 },
      { id: "custom-10-1", n: 10, c: 1 },
      { id: "custom-10-2", n: 10, c: 2 },
    ];
    m.state.privateState[0] = { rack: customRack };

    act(m, 0, "commit", {
      melds: [customRack],
      placedTileIds: ["custom-10-0", "custom-10-1", "custom-10-2"],
    });

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");

    const p1Rack = (m.state.privateState[1] as TileTanglePrivateState).rack;
    let p1Pips = 0;
    for (const t of p1Rack) p1Pips += t.joker ? 30 : t.n;

    expect(m.scores[0]).toBe(p1Pips);
    expect(m.scores[1]).toBe(-p1Pips);
  });

  it("handles initial meld gate then later table rearrangement", () => {
    const m = createTestMatch(tiletangle, { players: 2, seed: "rearrange-seed" });

    // Give seat 0 initial meld (10, 10, 10 = 30 points)
    const meld1: Tile[] = [
      { id: "0-10-0", n: 10, c: 0 },
      { id: "0-10-1", n: 10, c: 1 },
      { id: "0-10-2", n: 10, c: 2 },
    ];
    const priv0 = m.state.privateState[0] as TileTanglePrivateState;
    priv0.rack.push(...meld1);

    act(m, 0, "commit", {
      melds: [meld1],
      placedTileIds: meld1.map((t) => t.id),
    });

    let pub = m.state.publicState as TileTanglePublicState;
    expect(pub.hasMelded[0]).toBe(true);
    expect(pub.table.length).toBe(1);

    // Seat 1 draws
    act(m, 1, "draw", {});

    // Seat 0 now extends meld1 to 4 tiles (adds 10 of color 3)
    const tile4: Tile = { id: "0-10-3", n: 10, c: 3 };
    priv0.rack.push(tile4);

    const meld1Extended = [...meld1, tile4];
    act(m, 0, "commit", {
      melds: [meld1Extended],
      placedTileIds: [tile4.id],
    });

    pub = m.state.publicState as TileTanglePublicState;
    expect(pub.table[0]?.tiles.length).toBe(4);
  });

  it("draw path + pile exhaustion stalemate ending", () => {
    const m = createTestMatch(tiletangle, { players: 2, seed: "stalemate-seed" });
    const pub = m.state.publicState as TileTanglePublicState;
    pub._drawPile = []; // Empty draw pile
    pub.drawPileCount = 0;

    // Both players pass 2 turns total -> stalemate
    act(m, 0, "draw", {});
    expect(m.over).toBe(false);
    act(m, 1, "draw", {});

    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");
  });

  it("timer onTick auto-draw advances turn", () => {
    const m = createTestMatch(tiletangle, { players: 2, seed: "timer-seed" });
    let pub = m.state.publicState as TileTanglePublicState;
    expect(pub.activeSeat).toBe(0);

    fireTimer(m);

    pub = m.state.publicState as TileTanglePublicState;
    expect(pub.activeSeat).toBe(1);
  });

  it("handles abandoned seat and bot coverage", () => {
    const m = createTestMatch(tiletangle, { players: 3, seed: "bot-seed" });
    let pub = m.state.publicState as TileTanglePublicState;
    expect(pub.activeSeat).toBe(0);

    abandonSeat(m, 0);
    const count = botStep(m);
    expect(count).toBe(1);

    pub = m.state.publicState as TileTanglePublicState;
    expect(pub.activeSeat).toBe(1);
  });

  it("instant win on last-player-standing when seats abandoned", () => {
    const m = createTestMatch(tiletangle, { players: 3, seed: "abandon-win" });

    abandonSeat(m, 1);
    expect(m.over).toBe(false);

    abandonSeat(m, 2);
    expect(m.over).toBe(true);
    expect(m.state.phase).toBe("game_over");
    expect((m.state.publicState as TileTanglePublicState).winner).toBe(0);
  });

  it("is deterministic given the same seed", () => {
    const m1 = createTestMatch(tiletangle, { players: 3, seed: "det-seed-123" });
    const m2 = createTestMatch(tiletangle, { players: 3, seed: "det-seed-123" });

    const p1_0 = (m1.state.privateState[0] as TileTanglePrivateState).rack;
    const p2_0 = (m2.state.privateState[0] as TileTanglePrivateState).rack;

    expect(p1_0).toEqual(p2_0);
  });
});
