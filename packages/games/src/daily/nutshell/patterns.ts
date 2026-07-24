export interface DerivedSlot {
  number: number;
  row: number;
  col: number;
  length: number;
  dir: "across" | "down";
}

export interface PatternTemplate {
  id: string;
  gridPattern: string[];
  across: DerivedSlot[];
  down: DerivedSlot[];
}

export function computeSlotsFromPattern(gridPattern: string[]): {
  across: DerivedSlot[];
  down: DerivedSlot[];
} {
  const rows = gridPattern.length;
  const cols = gridPattern[0]?.length ?? 0;
  const across: DerivedSlot[] = [];
  const down: DerivedSlot[] = [];
  let currentNum = 1;

  for (let r = 0; r < rows; r++) {
    const rowStr = gridPattern[r];
    if (!rowStr) continue;

    for (let c = 0; c < cols; c++) {
      if (rowStr[c] === "#") continue;

      const prevCharAcross = c > 0 ? rowStr[c - 1] : undefined;
      const nextCharAcross = c + 1 < cols ? rowStr[c + 1] : undefined;

      const startsAcross =
        (c === 0 || prevCharAcross === "#") &&
        c + 1 < cols &&
        nextCharAcross !== "#";

      const prevRowStr = r > 0 ? gridPattern[r - 1] : undefined;
      const nextRowStr = r + 1 < rows ? gridPattern[r + 1] : undefined;
      const prevCharDown = prevRowStr ? prevRowStr[c] : undefined;
      const nextCharDown = nextRowStr ? nextRowStr[c] : undefined;

      const startsDown =
        (r === 0 || prevCharDown === "#") &&
        r + 1 < rows &&
        nextCharDown !== "#";

      if (startsAcross || startsDown) {
        const number = currentNum++;
        if (startsAcross) {
          let len = 0;
          while (c + len < cols && rowStr[c + len] !== "#") {
            len++;
          }
          across.push({ number, row: r, col: c, length: len, dir: "across" });
        }
        if (startsDown) {
          let len = 0;
          while (r + len < rows && (gridPattern[r + len]?.[c] ?? "#") !== "#") {
            len++;
          }
          down.push({ number, row: r, col: c, length: len, dir: "down" });
        }
      }
    }
  }

  return { across, down };
}

const RAW_PATTERNS: { id: string; gridPattern: string[] }[] = [
  {
    id: "all_open",
    gridPattern: [
      ".....",
      ".....",
      ".....",
      ".....",
      ".....",
    ],
  },
  {
    id: "tl_br_blocked",
    gridPattern: [
      "#....",
      ".....",
      ".....",
      ".....",
      "....#",
    ],
  },
  {
    id: "tr_bl_blocked",
    gridPattern: [
      "....#",
      ".....",
      ".....",
      ".....",
      "#....",
    ],
  },
  {
    id: "four_corners_blocked",
    gridPattern: [
      "#...#",
      ".....",
      ".....",
      ".....",
      "#...#",
    ],
  },
  {
    id: "tl_bl_blocked",
    gridPattern: [
      "#....",
      ".....",
      ".....",
      ".....",
      "#....",
    ],
  },
];

export const PATTERN_LIBRARY: PatternTemplate[] = RAW_PATTERNS.map((p) => {
  const { across, down } = computeSlotsFromPattern(p.gridPattern);
  return {
    id: p.id,
    gridPattern: p.gridPattern,
    across,
    down,
  };
});
