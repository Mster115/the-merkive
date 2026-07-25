import { defineDailyGame } from "../types";
import type {
  DailyAction,
  DailyContentPack,
  DailyContext,
  DailyGameMeta,
  DailyReduceError,
  DailyReduceResult,
  DailyStateIn,
  DailySummary,
} from "../types";
import type {
  NexusPayload,
  NexusPublicState,
  NexusCellPublic,
} from "./types";
import { pointsForAttempt } from "./types";
import { generatePrompt, normalizeAnswer, validatePack } from "./utils";

import { NexusPlay } from "./ui";
import { HowToPlay } from "./HowToPlay";

/**
 * Scores land on quarter points, and repeated float addition drifts
 * (0.5 + 0.25 + 0.25 is not reliably 1). Snap to two decimals so the number the
 * player sees, and the one written to `daily_attempts.score`, stay exact.
 */
function roundScore(n: number): number {
  return Math.round(n * 100) / 100;
}

export const nexusMeta: DailyGameMeta = {
  id: "nexus",
  nameKey: "daily.nexus.name",
  descriptionKey: "daily.nexus.description",
  taglineKey: "daily.nexus.tagline",
  estimatedMinutes: 5,
  tags: ["trivia", "matrix", "grid", "solo"],
};

export const en: Record<string, string> = {
  "daily.nexus.name": "Nexus",
  "daily.nexus.description":
    "Where categories collide. Solve all 9 questions where a row and column meet.",
  "daily.nexus.tagline": "Daily Trivia Crossroads",
  "daily.nexus.guessPlaceholder": "Type your answer...",
  "daily.nexus.submitGuess": "Submit Answer",
  "daily.nexus.revealCell": "Reveal Answer",
  "daily.nexus.submitGrid": "Submit Grid",
  "daily.nexus.solvedTitle": "Puzzle Solved!",
  "daily.nexus.failedTitle": "Puzzle Complete",
  "daily.nexus.scoreLabel": "Score",
  "daily.nexus.selectCellHint": "Select a cell to answer",
  "daily.nexus.cellLocked": "Cell is locked",
  "daily.nexus.answerWas": "Answer:",
  "daily.nexus.skipCell": "Give up on this one",
  "daily.nexus.skipped": "Gave up",
  "daily.nexus.revealed": "Revealed",
  "daily.nexus.correctIn": "Correct · {points} pt",
  "daily.nexus.worthFull": "Worth 1 point on your first try.",
  "daily.nexus.worthNext":
    "{attempts} tried — get it now and it's worth {points}.",
  "daily.nexus.worthNothing":
    "{attempts} tries so far — no points left here, but you can still finish the grid.",
  "daily.nexus.howto.goal":
    "Nine questions, each sitting where a row category crosses a column category.",
  "daily.nexus.howto.step1":
    "Tap a square to open its question. The answer has to satisfy both of its categories at once.",
  "daily.nexus.howto.step2":
    "Type your answer and submit it. Spelling is forgiving, and common alternative names are accepted.",
  "daily.nexus.howto.step3":
    "Wrong guess? The square stays open — it is just worth less: 1 point first try, then 1/2, then 1/4, then nothing. Keep going or give up on it.",
  "daily.nexus.howto.step4":
    "Once all nine squares are resolved, submit the grid to lock in your score.",
  "daily.nexus.howto.note":
    "Reveal shows you the answer but scores nothing, and it counts on your shared result.",
  "daily.nexus.howto.colA": "Symbols",
  "daily.nexus.howto.colB": "Firsts",
  "daily.nexus.howto.rowA": "Astronomy",
  "daily.nexus.howto.rowB": "Chemistry",
  "daily.nexus.howto.diagramCaption": "Astronomy × Symbols → one question",
  "daily.nexus.howto.diagramAlt":
    "A grid with Astronomy and Chemistry as row categories and Symbols and Firsts as column categories. The highlighted square is where Astronomy meets Symbols.",
};

export const nexus = defineDailyGame({
  meta: nexusMeta,
  i18n: { en },
  generatePrompt,
  validatePack,

  init(ctx: DailyContext, pack: DailyContentPack) {
    const payload = pack.payload as NexusPayload;
    const cells: NexusCellPublic[] = payload.cells.map((c) => ({
      row: c.row,
      col: c.col,
      question: c.question,
      status: "unanswered",
    }));

    const publicState: NexusPublicState = {
      rowLabels: payload.rowLabels,
      colLabels: payload.colLabels,
      cells,
      score: 0,
    };

    return {
      publicState,
      secretState: payload,
      phase: "in_progress",
    };
  },

  reduce(
    _ctx: DailyContext,
    state: DailyStateIn,
    action: DailyAction
  ): DailyReduceResult | DailyReduceError {
    const publicState = state.publicState as NexusPublicState;
    const secretState = state.secretState as NexusPayload;

    if (!publicState || !secretState) {
      return { error: "Invalid state structure", code: "invalid_state" };
    }

    if (action.type === "answer_cell") {
      const payload = action.payload as { row?: unknown; col?: unknown; guess?: unknown };
      const row = Number(payload?.row);
      const col = Number(payload?.col);
      const guess = typeof payload?.guess === "string" ? payload.guess : "";

      if (![0, 1, 2].includes(row) || ![0, 1, 2].includes(col)) {
        return { error: "Invalid cell coordinates", code: "invalid_payload" };
      }

      // An empty guess is rejected rather than counted — a dropped input or a
      // stray submit should not push the cell down the scoring ladder.
      if (normalizeAnswer(guess) === "") {
        return { error: "Answer cannot be empty", code: "empty_guess" };
      }

      if (state.phase !== "in_progress") {
        return { error: "Attempt is already over", code: "cell_locked" };
      }

      const cellIndex = publicState.cells.findIndex((c) => c.row === row && c.col === col);
      if (cellIndex === -1) {
        return { error: "Cell not found", code: "cell_not_found" };
      }

      const currentCell = publicState.cells[cellIndex]!;
      if (currentCell.status !== "unanswered") {
        return { error: "Cell is already locked", code: "cell_locked" };
      }

      const secretCell = secretState.cells.find((c) => c.row === row && c.col === col);
      if (!secretCell) {
        return { error: "Secret cell definition missing", code: "cell_not_found" };
      }

      const normGuess = normalizeAnswer(guess);
      const normCanonical = normalizeAnswer(secretCell.answer);
      const normAcceptable = secretCell.acceptableAnswers.map(normalizeAnswer);

      const isCorrect =
        normGuess !== "" &&
        (normGuess === normCanonical || normAcceptable.includes(normGuess));

      // A wrong guess costs value, not the cell. It used to lock immediately —
      // "when you get a question wrong you can't fix it" — which turned a
      // typo into a dead square. The cell now stays open and simply pays less:
      // 1 on the first try, then 0.5, then 0.25, then nothing. A player who
      // wants to keep going for a full grid still can.
      //
      // `?? 0` rather than a bare read: an attempt started before this change
      // has cells with no `attempts` field, and treating that as NaN would
      // poison the score for anyone mid-puzzle at deploy time.
      const attemptsBefore = currentCell.attempts ?? 0;
      const attempts = attemptsBefore + 1;
      const points = isCorrect ? pointsForAttempt(attemptsBefore) : 0;

      const updatedCells = [...publicState.cells];
      updatedCells[cellIndex] = {
        ...currentCell,
        status: isCorrect ? "correct" : "unanswered",
        attempts,
        ...(isCorrect ? { points } : {}),
      };

      return {
        publicState: {
          ...publicState,
          cells: updatedCells,
          score: roundScore(publicState.score + points),
        },
        phase: "in_progress",
        events: [],
      };
    }

    if (action.type === "skip_cell") {
      // Unlimited retries need a way out, or a player who cannot get a cell can
      // never resolve the grid and never submit. Distinct from reveal_cell:
      // this one does not show the answer, it just closes the square.
      const payload = action.payload as { row?: unknown; col?: unknown };
      const row = Number(payload?.row);
      const col = Number(payload?.col);

      if (![0, 1, 2].includes(row) || ![0, 1, 2].includes(col)) {
        return { error: "Invalid cell coordinates", code: "invalid_payload" };
      }

      if (state.phase !== "in_progress") {
        return { error: "Attempt is already over", code: "cell_locked" };
      }

      const cellIndex = publicState.cells.findIndex((c) => c.row === row && c.col === col);
      if (cellIndex === -1) {
        return { error: "Cell not found", code: "cell_not_found" };
      }

      const currentCell = publicState.cells[cellIndex]!;
      if (currentCell.status !== "unanswered") {
        return { error: "Cell is already locked", code: "cell_locked" };
      }

      const updatedCells = [...publicState.cells];
      updatedCells[cellIndex] = { ...currentCell, status: "incorrect" };

      return {
        publicState: { ...publicState, cells: updatedCells },
        phase: "in_progress",
        events: [],
      };
    }

    if (action.type === "reveal_cell") {
      const payload = action.payload as { row?: unknown; col?: unknown };
      const row = Number(payload?.row);
      const col = Number(payload?.col);

      if (![0, 1, 2].includes(row) || ![0, 1, 2].includes(col)) {
        return { error: "Invalid cell coordinates", code: "invalid_payload" };
      }

      if (state.phase !== "in_progress") {
        return { error: "Attempt is already over", code: "cell_locked" };
      }

      const cellIndex = publicState.cells.findIndex((c) => c.row === row && c.col === col);
      if (cellIndex === -1) {
        return { error: "Cell not found", code: "cell_not_found" };
      }

      const currentCell = publicState.cells[cellIndex]!;
      if (currentCell.status !== "unanswered") {
        return { error: "Cell is already locked", code: "cell_locked" };
      }

      const secretCell = secretState.cells.find((c) => c.row === row && c.col === col);
      if (!secretCell) {
        return { error: "Secret cell definition missing", code: "cell_not_found" };
      }

      const updatedCells = [...publicState.cells];
      updatedCells[cellIndex] = {
        ...currentCell,
        status: "revealed",
        answer: secretCell.answer,
      };

      return {
        publicState: {
          ...publicState,
          cells: updatedCells,
        },
        phase: "in_progress",
        events: [],
      };
    }

    if (action.type === "submit") {
      if (state.phase !== "in_progress") {
        return { error: "Attempt is already over", code: "already_submitted" };
      }

      const hasUnanswered = publicState.cells.some((c) => c.status === "unanswered");
      if (hasUnanswered) {
        return {
          error: "All 9 cells must be resolved before submitting",
          code: "incomplete",
        };
      }

      // Populate answers on all cells for final public view
      const updatedCells = publicState.cells.map((cell) => {
        const secretCell = secretState.cells.find(
          (c) => c.row === cell.row && c.col === cell.col
        );
        return {
          ...cell,
          answer: secretCell?.answer ?? cell.answer,
        };
      });

      // All nine correct, regardless of how many tries each took. Testing
      // `score === 9` would mark a perfect-but-retried grid as failed, since a
      // cell answered on the second go is only worth half a point.
      const finalPhase = publicState.cells.every((c) => c.status === "correct")
        ? "solved"
        : "failed";

      return {
        publicState: {
          ...publicState,
          cells: updatedCells,
        },
        phase: finalPhase,
        attemptOver: true,
        events: [],
      };
    }

    return {
      error: `Unknown action type: ${action.type}`,
      code: "invalid_action",
    };
  },

  summarize(ctx: DailyContext, state: DailyStateIn): DailySummary {
    const publicState = state.publicState as NexusPublicState;
    const phaseStatus =
      state.phase === "solved"
        ? "solved"
        : state.phase === "failed"
        ? "failed"
        : "in_progress";

    const score = publicState?.score ?? 0;
    const cells = publicState?.cells ?? [];

    const dateHeader = `Nexus — ${ctx.puzzleDate}`;
    const scoreLine = `${score}/9`;

    // Spoiler-free "route" grid, Wordle-style: which cells landed and how hard
    // they were, without ever printing a question or an answer. A correct cell
    // is shaded by the try it fell on, so a grid full of 🟩 reads as a
    // genuinely different result from one full of 🟧 — which is the point of
    // sharing it at all.
    const gridRows: string[] = [];
    for (let r = 0; r < 3; r++) {
      let rowStr = "";
      for (let c = 0; c < 3; c++) {
        const cell = cells.find((cell) => cell.row === r && cell.col === c);
        if (cell?.status === "correct") {
          const attempts = cell.attempts ?? 1;
          rowStr += attempts <= 1 ? "🟩" : attempts === 2 ? "🟨" : attempts === 3 ? "🟧" : "🟦";
        } else if (cell?.status === "revealed") {
          rowStr += "👁️";
        } else if (cell?.status === "incorrect") {
          rowStr += "🟥";
        } else {
          rowStr += "⬜";
        }
      }
      gridRows.push(rowStr);
    }

    const totalAttempts = cells.reduce((sum, c) => sum + (c.attempts ?? 0), 0);
    const attemptsLine =
      totalAttempts > 0 ? `\nAttempts: ${totalAttempts}` : "";

    const shareText = `${dateHeader}\n${scoreLine}${attemptsLine}\n\n${gridRows.join("\n")}`;

    const revealsUsed = cells.filter((c) => c.status === "revealed").length;
    const completed = phaseStatus === "solved" || phaseStatus === "failed";

    return {
      status: phaseStatus,
      shareText,
      stats: {
        completed,
        score,
        extra: {
          revealsUsed,
          totalAttempts,
        },
      },
    };
  },

  ui: {
    Play: NexusPlay,
    HowToPlay,
  },
});
