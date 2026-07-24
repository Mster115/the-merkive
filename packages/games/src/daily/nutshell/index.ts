import type {
  DailyAction,
  DailyContentPack,
  DailyContext,
  DailyGameModule,
  DailyReduceError,
  DailyReduceResult,
  DailyStateIn,
  DailySummary,
} from "../types";
import { defineDailyGame } from "../types";
import type {
  NutshellCell,
  NutshellPayload,
  NutshellPublicState,
  NutshellPublicSlot,
  NutshellSecretState,
  WordCandidate,
} from "./types";
import { solveGrid } from "./grid-solver";
import { Play } from "./ui";

function getSolutionLetter(
  payload: NutshellPayload,
  r: number,
  c: number
): string | null {
  for (const a of payload.across) {
    if (a.row === r && c >= a.col && c < a.col + a.length) {
      return a.answer[c - a.col] ?? null;
    }
  }
  for (const d of payload.down) {
    if (d.col === c && r >= d.row && r < d.row + d.length) {
      return d.answer[r - d.row] ?? null;
    }
  }
  return null;
}

export const nutshell: DailyGameModule = defineDailyGame({
  meta: {
    id: "nutshell",
    nameKey: "daily.nutshell.name",
    descriptionKey: "daily.nutshell.description",
    estimatedMinutes: 2,
    tags: ["crossword", "word", "puzzle", "daily"],
  },

  i18n: {
    en: {
      "daily.nutshell.name": "Nutshell",
      "daily.nutshell.description": "The daily puzzle, in a nutshell — a 5x5 mini crossword.",
      "daily.nutshell.across": "Across",
      "daily.nutshell.down": "Down",
      "daily.nutshell.check_cell": "Check Cell",
      "daily.nutshell.check_all": "Check All",
      "daily.nutshell.reveal_cell": "Reveal Cell",
      "daily.nutshell.submit": "Submit",
      "daily.nutshell.give_up": "Give Up",
      "daily.nutshell.solved": "Puzzle Solved!",
      "daily.nutshell.failed": "Puzzle Failed",
      "daily.nutshell.checks_used": "Checks: {count}",
      "daily.nutshell.reveals_used": "Reveals: {count}",
      "daily.nutshell.incomplete_error": "Grid is incomplete or incorrect.",
      "daily.nutshell.invalid_cell_error": "Invalid cell selection.",
    },
  },

  generatePrompt(puzzleDate: string): string {
    return `Generate a pool of 15-25 candidate 3, 4, or 5-letter word and clue pairs for a daily 5x5 mini crossword puzzle for date ${puzzleDate}.
Each candidate must be formatted as a JSON object with "word" (uppercase A-Z, 3-5 letters) and "clue" (original text).
Instruct:
- No obscure proper nouns or niche trivia requiring specific knowledge.
- No copyrighted phrases.
- Clues must be original text, favor wordplay and clear definitions.
- Words should contain common English letters that can interlock easily in a 5x5 grid.`;
  },

  validatePack(
    raw: unknown,
    puzzleDate: string
  ): { ok: true; pack: DailyContentPack } | { ok: false; error: string } {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Raw pack must be an object" };
    }

    const envelope = raw as Record<string, unknown>;
    // The pipeline hands us the submission envelope
    // ({ gameId, puzzleDate, payload, sourceRefs }); direct callers and tests
    // may pass the bare payload. Accept both — see daily/types.ts.
    const obj =
      typeof envelope.payload === "object" && envelope.payload !== null
        ? (envelope.payload as Record<string, unknown>)
        : envelope;

    const sourceRefs = Array.isArray(envelope.sourceRefs)
      ? (envelope.sourceRefs as { url: string; title: string }[])
      : Array.isArray(obj.sourceRefs)
      ? (obj.sourceRefs as { url: string; title: string }[])
      : [];

    // Every submission must go through the solver — that's the only place
    // crossing-letter agreement is actually verified. A pre-assembled grid
    // shortcut would let an inconsistent (unsolvable) grid through unchecked.
    const pool = (obj.candidates ?? obj.pool ?? obj.words ?? obj) as WordCandidate[];
    if (Array.isArray(pool)) {
      const assembledPayload = solveGrid(pool);
      if (assembledPayload) {
        return {
          ok: true,
          pack: {
            gameId: "nutshell",
            puzzleDate,
            payload: assembledPayload,
            sourceRefs,
          },
        };
      }
      return {
        ok: false,
        error: "Failed to assemble valid crossword grid from candidate pool",
      };
    }

    return {
      ok: false,
      error: "Invalid pack structure: expected a candidates pool ({ candidates: [{word, clue}] })",
    };
  },

  init(
    ctx: DailyContext,
    pack: DailyContentPack
  ): { publicState: NutshellPublicState; secretState: NutshellSecretState; phase: string } {
    const payload = pack.payload as NutshellPayload;

    const grid: NutshellCell[][] = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => {
        const isBlocked = payload.gridPattern[r]?.[c] === "#";
        return {
          row: r,
          col: c,
          letter: null,
          blocked: isBlocked,
        };
      })
    );

    const across: NutshellPublicSlot[] = payload.across.map((a) => ({
      number: a.number,
      row: a.row,
      col: a.col,
      length: a.length,
      clue: a.clue,
    }));

    const down: NutshellPublicSlot[] = payload.down.map((d) => ({
      number: d.number,
      row: d.row,
      col: d.col,
      length: d.length,
      clue: d.clue,
    }));

    const publicState: NutshellPublicState = {
      grid,
      across,
      down,
      checksUsed: 0,
      revealsUsed: 0,
      startedAtMs: ctx.now,
      completedAtMs: null,
    };

    return {
      publicState,
      secretState: payload,
      phase: "in_progress",
    };
  },

  reduce(
    ctx: DailyContext,
    state: DailyStateIn,
    action: DailyAction
  ): DailyReduceResult | DailyReduceError {
    const pub = state.publicState as NutshellPublicState;
    const sec = state.secretState as NutshellSecretState;

    if (state.phase !== "in_progress") {
      if (action.type === "submit" || action.type === "give_up") {
        return {
          publicState: pub,
          phase: state.phase,
          events: [],
        };
      }
      // Every other action mutates the grid (letters, checks, reveals) — once
      // the attempt is over, none of that may still apply, or a stray/replayed
      // client action could corrupt the completed stats (e.g. inflating
      // revealsUsed after a clean solve).
      return { error: "Attempt is already over", code: "attempt_over" };
    }

    if (action.type === "set_cell") {
      const payload = action.payload as {
        row?: number;
        col?: number;
        letter?: string | null;
      };
      if (
        payload.row === undefined ||
        payload.col === undefined ||
        payload.row < 0 ||
        payload.row > 4 ||
        payload.col < 0 ||
        payload.col > 4
      ) {
        return { error: "Cell coordinates out of bounds", code: "invalid_cell" };
      }

      const cell = pub.grid[payload.row]?.[payload.col];
      if (!cell || cell.blocked) {
        return { error: "Cannot write to blocked cell", code: "invalid_cell" };
      }

      let letter: string | null = null;
      if (typeof payload.letter === "string" && payload.letter.trim().length > 0) {
        const clean = payload.letter.trim().toUpperCase();
        if (!/^[A-Z]$/.test(clean)) {
          return { error: "Invalid letter character", code: "invalid_cell" };
        }
        letter = clean;
      }

      const newGrid = pub.grid.map((row, r) =>
        row.map((c, colIdx) => {
          if (r === payload.row && colIdx === payload.col) {
            return {
              ...c,
              letter,
              checked: false,
              correct: undefined,
            };
          }
          return c;
        })
      );

      return {
        publicState: { ...pub, grid: newGrid },
        phase: state.phase,
        events: [],
      };
    }

    if (action.type === "check_cell") {
      const payload = action.payload as { row?: number; col?: number };
      if (
        payload.row === undefined ||
        payload.col === undefined ||
        payload.row < 0 ||
        payload.row > 4 ||
        payload.col < 0 ||
        payload.col > 4
      ) {
        return { error: "Cell coordinates out of bounds", code: "invalid_cell" };
      }

      const cell = pub.grid[payload.row]?.[payload.col];
      if (!cell || cell.blocked) {
        return { error: "Cannot check blocked cell", code: "invalid_cell" };
      }

      const sol = getSolutionLetter(sec, payload.row, payload.col);
      const isCorrect = cell.letter !== null && cell.letter === sol;

      const newGrid = pub.grid.map((row, r) =>
        row.map((c, colIdx) => {
          if (r === payload.row && colIdx === payload.col) {
            return {
              ...c,
              checked: true,
              correct: isCorrect,
            };
          }
          return c;
        })
      );

      return {
        publicState: {
          ...pub,
          grid: newGrid,
          checksUsed: pub.checksUsed + 1,
        },
        phase: state.phase,
        events: [],
      };
    }

    if (action.type === "check_all") {
      let checksAdded = 1;
      const newGrid = pub.grid.map((row, r) =>
        row.map((c, colIdx) => {
          if (c.blocked || !c.letter) return c;
          const sol = getSolutionLetter(sec, r, colIdx);
          return {
            ...c,
            checked: true,
            correct: c.letter === sol,
          };
        })
      );

      return {
        publicState: {
          ...pub,
          grid: newGrid,
          checksUsed: pub.checksUsed + checksAdded,
        },
        phase: state.phase,
        events: [],
      };
    }

    if (action.type === "reveal_cell") {
      const payload = action.payload as { row?: number; col?: number };
      if (
        payload.row === undefined ||
        payload.col === undefined ||
        payload.row < 0 ||
        payload.row > 4 ||
        payload.col < 0 ||
        payload.col > 4
      ) {
        return { error: "Cell coordinates out of bounds", code: "invalid_cell" };
      }

      const cell = pub.grid[payload.row]?.[payload.col];
      if (!cell || cell.blocked) {
        return { error: "Cannot reveal blocked cell", code: "invalid_cell" };
      }

      const sol = getSolutionLetter(sec, payload.row, payload.col);
      if (!sol) {
        return { error: "No solution found for cell", code: "invalid_cell" };
      }

      const newGrid = pub.grid.map((row, r) =>
        row.map((c, colIdx) => {
          if (r === payload.row && colIdx === payload.col) {
            return {
              ...c,
              letter: sol,
              revealed: true,
              checked: true,
              correct: true,
            };
          }
          return c;
        })
      );

      return {
        publicState: {
          ...pub,
          grid: newGrid,
          revealsUsed: pub.revealsUsed + 1,
        },
        phase: state.phase,
        events: [],
      };
    }

    if (action.type === "give_up") {
      return {
        publicState: {
          ...pub,
          completedAtMs: ctx.now,
        },
        phase: "failed",
        events: [],
        attemptOver: true,
      };
    }

    if (action.type === "submit") {
      // Validate every open cell matches solution
      let allCorrect = true;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const cell = pub.grid[r]?.[c];
          if (cell && !cell.blocked) {
            const sol = getSolutionLetter(sec, r, c);
            if (!cell.letter || cell.letter !== sol) {
              allCorrect = false;
              break;
            }
          }
        }
        if (!allCorrect) break;
      }

      if (!allCorrect) {
        return {
          error: "Grid is incomplete or incorrect",
          code: "incomplete",
        };
      }

      return {
        publicState: {
          ...pub,
          completedAtMs: ctx.now,
        },
        phase: "solved",
        events: [],
        attemptOver: true,
      };
    }

    return { error: `Unknown action type "${action.type}"`, code: "unknown_action" };
  },

  summarize(ctx: DailyContext, state: DailyStateIn): DailySummary {
    const pub = state.publicState as NutshellPublicState;
    const phase = state.phase;

    let status: "solved" | "failed" | "in_progress" = "in_progress";
    if (phase === "solved") status = "solved";
    else if (phase === "failed") status = "failed";

    const checksUsed = pub?.checksUsed ?? 0;
    const revealsUsed = pub?.revealsUsed ?? 0;
    const startedAtMs = pub?.startedAtMs ?? ctx.now;
    const completedAtMs = pub?.completedAtMs;
    const durationMs = completedAtMs ? completedAtMs - startedAtMs : ctx.now - startedAtMs;

    const formattedTime = `${Math.floor(durationMs / 1000)}s`;

    let shareLine = "";
    if (status === "solved") {
      shareLine = `Solved in ${formattedTime} | 🔍 ${checksUsed} | 💡 ${revealsUsed}`;
    } else if (status === "failed") {
      shareLine = `Failed | 🔍 ${checksUsed} | 💡 ${revealsUsed}`;
    } else {
      shareLine = `In progress | 🔍 ${checksUsed} | 💡 ${revealsUsed}`;
    }

    const shareText = `Nutshell — ${ctx.puzzleDate}\n${shareLine}`;

    return {
      status,
      shareText,
      stats: {
        completed: status === "solved",
        durationMs,
        extra: {
          checksUsed,
          revealsUsed,
        },
      },
    };
  },

  ui: {
    Play,
  },
});
