import * as React from "react";
import type { DailyPlayProps } from "../types";
import type { NexusPublicState, NexusCellPublic } from "./types";
import { Button, Card, Panel, Pill, CheckIcon, CloseIcon, EyeIcon, QuestionIcon } from "@merky/ui";

export const NexusPlay: React.FC<DailyPlayProps> = ({
  meta,
  puzzleDate,
  publicState,
  phase,
  act,
  t,
}) => {
  const state = publicState as NexusPublicState | null;

  const [selectedCoords, setSelectedCoords] = React.useState<{
    row: number;
    col: number;
  } | null>({ row: 0, col: 0 });
  const [guessText, setGuessText] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Clear input when selection changes
  React.useEffect(() => {
    setGuessText("");
    setErrorMsg(null);
  }, [selectedCoords?.row, selectedCoords?.col]);

  if (!state || !Array.isArray(state.cells)) {
    return (
      <div className="p-4 text-center text-[var(--mb-text-dim)]">
        Loading puzzle...
      </div>
    );
  }

  const selectedCell: NexusCellPublic | undefined = selectedCoords
    ? state.cells.find(
        (c) => c.row === selectedCoords.row && c.col === selectedCoords.col
      )
    : undefined;

  const allResolved = state.cells.every((c) => c.status !== "unanswered");
  const isGameOver = phase === "solved" || phase === "failed";

  const handleAnswer = async () => {
    if (!selectedCoords || !guessText.trim()) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await act("answer_cell", {
      row: selectedCoords.row,
      col: selectedCoords.col,
      guess: guessText.trim(),
    });
    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error);
    } else {
      setGuessText("");
    }
  };

  const handleReveal = async () => {
    if (!selectedCoords) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await act("reveal_cell", {
      row: selectedCoords.row,
      col: selectedCoords.col,
    });
    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error);
    }
  };

  const handleSubmitGrid = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await act("submit");
    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error);
    }
  };

  const announceText = isGameOver
    ? phase === "solved"
      ? `Puzzle solved! Score ${state.score} of 9.`
      : `Puzzle finished. Score ${state.score} of 9.`
    : `Phase: ${phase}. Current score: ${state.score} of 9.`;

  return (
    <div className="w-full max-w-md mx-auto p-3 sm:p-4 space-y-4 text-[var(--mb-text)]">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite">
        {announceText}
      </div>

      {/* Header */}
      <Card className="p-3 bg-[var(--mb-surface)] border-2 border-black shadow-[var(--mb-shadow)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-[var(--mb-violet)]">
              {t(meta.nameKey)}
            </h1>
            <p className="text-xs text-[var(--mb-text-dim)]">{puzzleDate}</p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-extrabold text-[var(--mb-text-dim)] block">
              {t("daily.nexus.scoreLabel")}
            </span>
            <span className="text-2xl font-black text-[var(--mb-gold)]">
              {state.score} / 9
            </span>
          </div>
        </div>
      </Card>

      {/* 3x3 Trivia Matrix Grid */}
      <Card className="p-2 sm:p-3 bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow-lg)]">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
          {/* Top-Left Corner */}
          <div className="flex items-center justify-center p-1 bg-[var(--mb-surface-3)] border border-black rounded text-[10px] sm:text-xs font-black uppercase text-[var(--mb-text-dim)]">
            3x3
          </div>
          {/* Column Labels */}
          {state.colLabels.map((colLabel, colIdx) => (
            <div
              key={`col-hdr-${colIdx}`}
              className="p-1 sm:p-1.5 bg-[var(--mb-surface-3)] border border-black rounded text-[10px] sm:text-xs font-extrabold uppercase text-[var(--mb-violet)] flex items-center justify-center min-h-[36px] line-clamp-2 leading-tight"
            >
              {colLabel}
            </div>
          ))}

          {/* Matrix Rows */}
          {[0, 1, 2].map((rowIdx) => (
            <React.Fragment key={`row-${rowIdx}`}>
              {/* Row Label */}
              <div className="p-1 sm:p-1.5 bg-[var(--mb-surface-3)] border border-black rounded text-[10px] sm:text-xs font-extrabold uppercase text-[var(--mb-violet)] flex items-center justify-center min-h-[50px] line-clamp-2 leading-tight">
                {state.rowLabels[rowIdx]}
              </div>

              {/* Row Cells */}
              {[0, 1, 2].map((colIdx) => {
                const cell = state.cells.find(
                  (c) => c.row === rowIdx && c.col === colIdx
                );
                const isSelected =
                  selectedCoords?.row === rowIdx &&
                  selectedCoords?.col === colIdx;

                let cellBg = "bg-[var(--mb-surface)] text-[var(--mb-text)]";
                let StatusBadge: React.ComponentType<{ className?: string }> = QuestionIcon;

                if (cell?.status === "correct") {
                  cellBg = "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]";
                  StatusBadge = CheckIcon;
                } else if (cell?.status === "incorrect") {
                  cellBg = "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]";
                  StatusBadge = CloseIcon;
                } else if (cell?.status === "revealed") {
                  cellBg = "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]";
                  StatusBadge = EyeIcon;
                }

                return (
                  <button
                    key={`cell-${rowIdx}-${colIdx}`}
                    type="button"
                    onClick={() => setSelectedCoords({ row: rowIdx, col: colIdx })}
                    className={`min-h-[50px] sm:min-h-[56px] w-full border-2 border-black rounded-md p-1 flex flex-col items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent)] ${cellBg} ${
                      isSelected ? "ring-4 ring-[var(--mb-accent)] scale-[1.02]" : ""
                    }`}
                    aria-label={`Row ${rowIdx + 1} Col ${colIdx + 1}: ${cell?.status}`}
                  >
                    <span className="text-[10px] sm:text-xs font-bold leading-tight line-clamp-2 w-full text-center">
                      {cell?.question}
                    </span>
                    <span className="self-end">
                      <StatusBadge className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Selected Cell Action Panel */}
      {selectedCoords && selectedCell && (
        <Panel className="p-3 sm:p-4 space-y-3 bg-[var(--mb-surface)] border-2 border-black shadow-[var(--mb-shadow)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Pill tone="accent">
                {state.rowLabels[selectedCoords.row]}
              </Pill>
              <span className="text-xs text-[var(--mb-text-dim)]">×</span>
              <Pill tone="accent">
                {state.colLabels[selectedCoords.col]}
              </Pill>
            </div>
            {selectedCell.status === "correct" && (
              <Pill tone="ok">Correct</Pill>
            )}
            {selectedCell.status === "incorrect" && (
              <Pill tone="danger">Incorrect</Pill>
            )}
            {selectedCell.status === "revealed" && (
              <Pill tone="gold">Revealed</Pill>
            )}
          </div>

          <p className="text-sm font-semibold leading-snug">
            {selectedCell.question}
          </p>

          {/* Answer details if revealed or attempt over */}
          {selectedCell.answer && (
            <div className="p-2 bg-[var(--mb-surface-2)] border border-black rounded text-xs">
              <span className="font-bold text-[var(--mb-gold)]">
                {t("daily.nexus.answerWas")}{" "}
              </span>
              <span className="font-extrabold">{selectedCell.answer}</span>
            </div>
          )}

          {/* Answer Input and Action Buttons if Unanswered */}
          {selectedCell.status === "unanswered" && !isGameOver && (
            <div className="space-y-2 pt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAnswer();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder={t("daily.nexus.guessPlaceholder")}
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--mb-surface-2)] border-2 border-black rounded text-[var(--mb-text)] focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent)] placeholder:text-[var(--mb-text-dim)] min-h-[44px]"
                />
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={isSubmitting || !guessText.trim()}
                  className="min-h-[44px] px-4 font-bold"
                >
                  {t("daily.nexus.submitGuess")}
                </Button>
              </form>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReveal}
                  disabled={isSubmitting}
                  className="text-xs text-[var(--mb-text-dim)] hover:text-[var(--mb-danger)] min-h-[44px]"
                >
                  {t("daily.nexus.revealCell")}
                </Button>
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-bold text-[var(--mb-danger)]">
              {errorMsg}
            </p>
          )}
        </Panel>
      )}

      {/* Grid Submit Action (When all 9 are answered/revealed but not submitted) */}
      {allResolved && !isGameOver && (
        <Card className="p-3 bg-[var(--mb-surface)] border-2 border-black text-center space-y-2">
          <p className="text-xs font-bold text-[var(--mb-text-dim)]">
            All 9 cells resolved! Ready to finalize your grid.
          </p>
          <Button
            variant="gold"
            size="lg"
            block
            onClick={handleSubmitGrid}
            disabled={isSubmitting}
            className="min-h-[44px] font-black uppercase text-base"
          >
            {t("daily.nexus.submitGrid")}
          </Button>
        </Card>
      )}

      {/* Game Over Banner */}
      {isGameOver && (
        <Card className="p-4 bg-[var(--mb-surface)] border-[3px] border-black text-center space-y-3 shadow-[var(--mb-shadow)]">
          <h2 className="text-xl font-black uppercase text-[var(--mb-gold)]">
            {phase === "solved"
              ? t("daily.nexus.solvedTitle")
              : t("daily.nexus.failedTitle")}
          </h2>
          <p className="text-sm">
            Final Score:{" "}
            <span className="font-extrabold text-[var(--mb-accent-2)]">
              {state.score} / 9
            </span>
          </p>
        </Card>
      )}
    </div>
  );
};
