import * as React from "react";
import type { DailyPlayProps } from "../types";
import type { NexusPublicState, NexusCellPublic } from "./types";
import { pointsForAttempt } from "./types";
import { Button, Card, Panel, Pill, CheckIcon, CloseIcon, EyeIcon, QuestionIcon } from "@merky/ui";

export const NexusPlay: React.FC<DailyPlayProps> = ({
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

  const attempts = selectedCell?.attempts ?? 0;
  const nextValue = pointsForAttempt(attempts);

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
      return;
    }
    // Cleared whether right or wrong — a wrong guess leaves the cell open, and
    // re-submitting the same wrong word is never what the player meant.
    setGuessText("");
  };

  const handleSkip = async () => {
    if (!selectedCoords) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await act("skip_cell", {
      row: selectedCoords.row,
      col: selectedCoords.col,
    });
    setIsSubmitting(false);
    if (!res.ok) setErrorMsg(res.error);
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
    // No max-width here: DailyPlayShell owns the responsive column (DESIGN.md
    // §7a). Pinning this to max-w-md kept desktop players in a phone strip.
    <div className="w-full space-y-4 text-[var(--mb-text)]">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite">
        {announceText}
      </div>

      {/* Header */}
      <Card className="p-3 bg-[var(--mb-surface)] border-2 border-black shadow-[var(--mb-shadow)]">
        {/* No game title here: the shell's header already carries the name,
            the date and the description. */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-black uppercase tracking-wide text-[var(--mb-violet)]">
              {t("daily.nexus.tagline")}
            </span>
          </div>
          <div className="text-right shrink-0">
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
        {/* Labels and questions grow with the viewport instead of clamping
            harder: at 375px they stay small, but a tablet or desktop player
            gets type they can actually read. Category names carry a `title`
            because they are the one place a clamp can still bite. */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
          {/* Top-Left Corner */}
          <div className="flex items-center justify-center p-1 bg-[var(--mb-surface-3)] border border-black rounded text-[10px] sm:text-xs lg:text-sm font-black uppercase text-[var(--mb-text-dim)]">
            3x3
          </div>
          {/* Column Labels */}
          {state.colLabels.map((colLabel, colIdx) => (
            <div
              key={`col-hdr-${colIdx}`}
              title={colLabel}
              className="min-w-0 p-1 sm:p-1.5 bg-[var(--mb-surface-3)] border border-black rounded text-[10px] sm:text-sm lg:text-base font-extrabold uppercase text-[var(--mb-violet)] flex items-center justify-center min-h-[40px] sm:min-h-[48px] leading-tight"
            >
              {/* w-full, not a bare text node: an anonymous flex item sizes to
                  max-content, so `break-words` never gets a narrower line box
                  to break against and "SUPERLATIVES" just clipped. */}
              <span className="w-full break-words">{colLabel}</span>
            </div>
          ))}

          {/* Matrix Rows */}
          {[0, 1, 2].map((rowIdx) => (
            <React.Fragment key={`row-${rowIdx}`}>
              {/* Row Label */}
              <div
                title={state.rowLabels[rowIdx]}
                className="min-w-0 p-1 sm:p-1.5 bg-[var(--mb-surface-3)] border border-black rounded text-[10px] sm:text-sm lg:text-base font-extrabold uppercase text-[var(--mb-violet)] flex items-center justify-center min-h-[56px] sm:min-h-[72px] leading-tight"
              >
                <span className="w-full break-words">{state.rowLabels[rowIdx]}</span>
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
                } else if (cell?.status === "unanswered" && (cell?.attempts ?? 0) > 0) {
                  // Missed at least once but still open — worth less, not lost.
                  cellBg = "bg-[var(--mb-warn)] text-[var(--mb-on-gold)]";
                  StatusBadge = QuestionIcon;
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
                    className={`min-w-0 min-h-[56px] sm:min-h-[72px] lg:min-h-[88px] w-full border-2 border-black rounded-md p-1 sm:p-1.5 flex flex-col items-center justify-between gap-1 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent)] ${cellBg} ${
                      isSelected ? "ring-4 ring-[var(--mb-accent)] scale-[1.02]" : ""
                    }`}
                    aria-label={`Row ${rowIdx + 1} Col ${colIdx + 1}: ${cell?.status}`}
                  >
                    {/* The clamp stays — a full question cannot fit a grid cell
                        — but it now breaks at a word boundary and gets more
                        room to work with as the viewport grows. The full text
                        is always readable in the panel below. */}
                    <span className="text-[11px] sm:text-xs lg:text-sm font-bold leading-tight line-clamp-2 lg:line-clamp-3 w-full text-center break-words">
                      {cell?.question}
                    </span>
                    <span className="self-end">
                      <StatusBadge className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
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
              <Pill tone="ok" className="whitespace-nowrap">
                {t("daily.nexus.correctIn", {
                  points: String(selectedCell.points ?? 1),
                  attempts: String(selectedCell.attempts ?? 1),
                })}
              </Pill>
            )}
            {selectedCell.status === "incorrect" && (
              <Pill tone="danger" className="whitespace-nowrap">{t("daily.nexus.skipped")}</Pill>
            )}
            {selectedCell.status === "revealed" && (
              <Pill tone="gold" className="whitespace-nowrap">{t("daily.nexus.revealed")}</Pill>
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

          {/* Answer input stays available for as long as the cell is open. */}
          {selectedCell.status === "unanswered" && !isGameOver && (
            <div className="space-y-2 pt-1">
              {/* Stacked at phone width, side-by-side from sm. A single row
                  here gave the input `flex-1` and squeezed the button below
                  its label width, so "Submit Answer" painted outside its own
                  border as a clipped "UBMI/NSWE". See DESIGN.md §7b. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAnswer();
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder={t("daily.nexus.guessPlaceholder")}
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 sm:min-w-0 px-3 py-2 text-base bg-[var(--mb-surface-2)] border-2 border-black rounded text-[var(--mb-text)] focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent)] placeholder:text-[var(--mb-text-dim)] min-h-[44px]"
                />
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={isSubmitting || !guessText.trim()}
                  className="w-full sm:w-auto min-h-[44px] px-4 font-bold"
                >
                  {t("daily.nexus.submitGuess")}
                </Button>
              </form>

              {/* What the *next* correct answer is worth, rather than lives
                  remaining — that is the actual decision in front of the
                  player. Guessing stays open even at zero, so someone chasing
                  a complete grid is never locked out of a square. */}
              <p className="text-xs font-bold text-[var(--mb-text-dim)]">
                {attempts === 0
                  ? t("daily.nexus.worthFull")
                  : nextValue > 0
                  ? t("daily.nexus.worthNext", {
                      points: String(nextValue),
                      attempts: String(attempts),
                    })
                  : t("daily.nexus.worthNothing", { attempts: String(attempts) })}
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="text-xs text-[var(--mb-text-dim)]"
                >
                  {t("daily.nexus.skipCell")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReveal}
                  disabled={isSubmitting}
                  className="text-xs text-[var(--mb-text-dim)] hover:text-[var(--mb-danger)]"
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
