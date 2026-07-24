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
  MerkGridPayload,
  MerkGridPublicState,
  MerkGridCellPublic,
} from "./types";
import { generatePrompt, normalizeAnswer, validatePack } from "./utils";
import { MerkGridPlay } from "./ui";

export const merkGridMeta: DailyGameMeta = {
  id: "merk-grid",
  nameKey: "daily.merk-grid.name",
  descriptionKey: "daily.merk-grid.description",
  taglineKey: "daily.merk-grid.tagline",
  estimatedMinutes: 5,
  tags: ["trivia", "matrix", "grid", "solo"],
};

export const en: Record<string, string> = {
  "daily.merk-grid.name": "Merk Grid",
  "daily.merk-grid.description":
    "A 3x3 trivia intersection matrix. Solve all 9 intersecting questions!",
  "daily.merk-grid.tagline": "3x3 Trivia Matrix",
  "daily.merk-grid.guessPlaceholder": "Type your answer...",
  "daily.merk-grid.submitGuess": "Submit Answer",
  "daily.merk-grid.revealCell": "Reveal Answer",
  "daily.merk-grid.submitGrid": "Submit Grid",
  "daily.merk-grid.solvedTitle": "Puzzle Solved!",
  "daily.merk-grid.failedTitle": "Puzzle Complete",
  "daily.merk-grid.copyShare": "Copy Result",
  "daily.merk-grid.copied": "Copied to clipboard!",
  "daily.merk-grid.scoreLabel": "Score",
  "daily.merk-grid.selectCellHint": "Select a cell to answer",
  "daily.merk-grid.cellLocked": "Cell is locked",
  "daily.merk-grid.answerWas": "Answer:",
};

export const merkGrid = defineDailyGame({
  meta: merkGridMeta,
  i18n: { en },
  generatePrompt,
  validatePack,

  init(ctx: DailyContext, pack: DailyContentPack) {
    const payload = pack.payload as MerkGridPayload;
    const cells: MerkGridCellPublic[] = payload.cells.map((c) => ({
      row: c.row,
      col: c.col,
      question: c.question,
      status: "unanswered",
    }));

    const publicState: MerkGridPublicState = {
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
    const publicState = state.publicState as MerkGridPublicState;
    const secretState = state.secretState as MerkGridPayload;

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

      // An incorrect guess is NOT further guessable — one attempt per cell, matching standard trivia-grid rules.
      const updatedStatus = isCorrect ? ("correct" as const) : ("incorrect" as const);
      const newScore = isCorrect ? publicState.score + 1 : publicState.score;

      const updatedCells = [...publicState.cells];
      updatedCells[cellIndex] = {
        ...currentCell,
        status: updatedStatus,
      };

      return {
        publicState: {
          ...publicState,
          cells: updatedCells,
          score: newScore,
        },
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

      const finalPhase = publicState.score === 9 ? "solved" : "failed";

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
    const publicState = state.publicState as MerkGridPublicState;
    const phaseStatus =
      state.phase === "solved"
        ? "solved"
        : state.phase === "failed"
        ? "failed"
        : "in_progress";

    const score = publicState?.score ?? 0;
    const cells = publicState?.cells ?? [];

    const dateHeader = `Merk Grid — ${ctx.puzzleDate}`;
    const scoreLine = `${score}/9`;

    const gridRows: string[] = [];
    for (let r = 0; r < 3; r++) {
      let rowStr = "";
      for (let c = 0; c < 3; c++) {
        const cell = cells.find((cell) => cell.row === r && cell.col === c);
        if (cell && cell.status === "correct") {
          rowStr += "🟩";
        } else {
          rowStr += "⬜";
        }
      }
      gridRows.push(rowStr);
    }

    const shareText = `${dateHeader}\n${scoreLine}\n\n${gridRows.join("\n")}`;

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
        },
      },
    };
  },

  ui: {
    Play: MerkGridPlay,
  },
});
