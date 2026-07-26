"use client";
import * as React from "react";
import { Button, Card, Panel, Pill, ConfettiBurst } from "@merky/ui";
import type { DailyPlayProps } from "../types";
import type { RelayPublicState } from "./types";

/**
 * Renders a word with its first and last letters called out — the two letters
 * that decide what can link to it.
 *
 * The emphasis has to be relative to whatever the chip sits on. Colouring the
 * first letter `--mb-accent` is invisible on the start chip (bg is
 * `--mb-accent`) and the last letter `--mb-gold` is invisible on the end chip
 * (bg `--mb-gold`) — playtesters saw "IRCUS" and "NEBUL". So a tinted chip
 * keeps its own `on-*` foreground and marks the letters with an underline
 * instead, which cannot collide with any background.
 */
function LinkedWord({ word, tinted }: { word: string; tinted: boolean }) {
  const first = word.charAt(0);
  const middle = word.slice(1, -1);
  const last = word.length > 1 ? word.slice(-1) : "";

  if (tinted) {
    const mark = "underline decoration-2 underline-offset-2";
    return (
      <>
        <span className={mark}>{first}</span>
        <span>{middle}</span>
        {last && <span className={mark}>{last}</span>}
      </>
    );
  }

  return (
    <>
      <span className="text-[var(--mb-accent)] font-black">{first}</span>
      <span>{middle}</span>
      {last && <span className="text-[var(--mb-gold)] font-black">{last}</span>}
    </>
  );
}

export function Play({
  publicState,
  phase,
  act,
  t,
}: DailyPlayProps) {
  const state = publicState as RelayPublicState;
  const [ariaMessage, setAriaMessage] = React.useState<string>("");
  const [copied, setCopied] = React.useState<boolean>(false);

  const {
    startWord = "",
    endWord = "",
    wordBank = [],
    chain = [startWord],
    usedWords = [],
    movesUsed = 0,
  } = state || {};

  const currentLastWord = chain[chain.length - 1] || startWord;
  const currentLastChar = currentLastWord.charAt(currentLastWord.length - 1).toUpperCase();
  const isSolved = phase === "solved";
  const isFailed = phase === "failed";
  const isOver = isSolved || isFailed;
  const targetReached = currentLastWord === endWord;

  const handleAddWord = async (word: string) => {
    if (isOver) return;
    const res = await act("add_word", { word });
    if (res.ok) {
      const nextLastChar = word.charAt(word.length - 1).toUpperCase();
      setAriaMessage(
        t("daily.relay.ariaAdded", {
          word,
          letter: nextLastChar,
        }) || `Added ${word}. Next word must start with ${nextLastChar}.`
      );
    } else {
      setAriaMessage(res.error);
    }
  };

  const handleRemoveLast = async () => {
    if (isOver || chain.length <= 1) return;
    const res = await act("remove_last");
    if (res.ok) {
      setAriaMessage(
        t("daily.relay.ariaRemoved") || "Removed last word."
      );
    } else {
      setAriaMessage(res.error);
    }
  };

  const handleSubmit = async () => {
    if (isOver) return;
    const res = await act("submit");
    if (res.ok) {
      setAriaMessage(t("daily.relay.ariaSolved") || "Puzzle solved!");
    } else {
      setAriaMessage(res.error);
    }
  };

  const handleGiveUp = async () => {
    if (isOver) return;
    const res = await act("give_up");
    if (res.ok) {
      setAriaMessage(t("daily.relay.ariaFailed") || "Puzzle failed.");
    }
  };

  return (
    // DailyPlayShell owns the page column — see DESIGN.md §7a.
    <div className="w-full space-y-5 text-[var(--mb-text)]">
      {/* Screen Reader ARIA Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaMessage}
      </div>

      {isSolved && <ConfettiBurst />}

      {/* Header Info */}
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider font-extrabold opacity-75">
            {t("daily.relay.target") || "Target"}
          </div>
          <div className="text-lg sm:text-xl font-black tracking-wide flex flex-wrap items-center gap-x-2">
            <span className="text-[var(--mb-accent)]">{startWord}</span>
            <span>→</span>
            <span className="text-[var(--mb-gold)]">{endWord}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* whitespace-nowrap: "Moves: 4" broke after the colon at 375px. */}
          <Pill
            tone={isSolved ? "ok" : isFailed ? "danger" : "accent"}
            className="whitespace-nowrap"
          >
            {t("daily.relay.moves") || "Moves"}: {movesUsed}
          </Pill>
          {isSolved && <Pill tone="ok">{t("daily.relay.solvedTitle") || "Solved!"}</Pill>}
          {isFailed && <Pill tone="danger">{t("daily.relay.failedTitle") || "Failed"}</Pill>}
        </div>
      </Card>

      {/* Chain Container */}
      <Panel className="p-4 space-y-3">
        <div className="text-xs font-extrabold uppercase tracking-wider opacity-75">
          {t("daily.relay.chainHeader") || "Current Chain"}
        </div>

        <div className="flex flex-wrap items-center gap-2 min-h-[56px] p-2 bg-[var(--mb-surface)] rounded-md border-2 border-black">
          {chain.map((w, idx) => {
            const isStart = idx === 0;
            const isEnd = w === endWord;
            const tinted = isStart || isEnd;

            return (
              <React.Fragment key={`${w}-${idx}`}>
                {idx > 0 && <span className="text-xs opacity-50 font-bold">→</span>}
                <div
                  className={`inline-flex items-center px-3 py-1.5 rounded border-2 border-black font-black uppercase text-sm select-none shadow-[2px_2px_0_0_#000] min-h-[44px] min-w-[44px] ${
                    isStart
                      ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                      : isEnd
                      ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                      : "bg-[var(--mb-surface-2)] text-[var(--mb-text)]"
                  }`}
                >
                  <LinkedWord word={w} tinted={tinted} />
                </div>
              </React.Fragment>
            );
          })}

          {!targetReached && (
            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded border-2 border-dashed border-black font-black text-sm text-[var(--mb-text-dim)] min-h-[44px] min-w-[44px]">
              ? ({currentLastChar})
            </div>
          )}
        </div>
      </Panel>

      {/* Word Bank */}
      <Panel className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-extrabold uppercase tracking-wider opacity-75">
            {t("daily.relay.bankHeader") || "Word Bank"}
          </div>
          <div className="text-xs opacity-75">
            {t("daily.relay.nextLetterPrompt") || "Starts with"}:{" "}
            <span className="font-black text-[var(--mb-accent)] text-sm">{currentLastChar}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {wordBank.map((w) => {
            const isUsed = usedWords.includes(w);
            const links = w.charAt(0).toUpperCase() === currentLastChar;

            return (
              <button
                key={w}
                type="button"
                disabled={isUsed || isOver}
                onClick={() => handleAddWord(w)}
                className={`flex items-center justify-center px-3 py-2 rounded-md border-2 border-black font-black uppercase text-sm transition-all min-h-[44px] select-none ${
                  isUsed
                    ? "opacity-30 bg-[var(--mb-surface-3)] line-through cursor-not-allowed border-[var(--mb-outline)]"
                    : links
                    ? "bg-[var(--mb-surface)] hover:bg-[var(--mb-surface-3)] shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                    : "bg-[var(--mb-surface)] opacity-70 hover:opacity-100 shadow-[2px_2px_0_0_#000]"
                }`}
              >
                {/* Bank tiles sit on --mb-surface, so the colour emphasis is
                    safe here; only the tinted chain chips need the underline
                    treatment. */}
                <LinkedWord word={w} tinted={false} />
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Action Controls */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="md"
            block
            disabled={isOver || chain.length <= 1}
            onClick={handleRemoveLast}
          >
            {t("daily.relay.undo") || "Undo"}
          </Button>

          <Button
            variant="primary"
            size="md"
            block
            disabled={isOver || !targetReached}
            onClick={handleSubmit}
          >
            {t("daily.relay.submit") || "Submit Chain"}
          </Button>
        </div>

        {!isOver && (
          <Button
            variant="danger"
            size="sm"
            block
            onClick={handleGiveUp}
          >
            {t("daily.relay.giveUp") || "Give Up"}
          </Button>
        )}
      </div>

      {/* Over Banner */}
      {isOver && (
        <Card className="p-4 text-center space-y-3 border-4">
          <div className="text-xl font-black uppercase">
            {isSolved
              ? t("daily.relay.solvedTitle") || "Puzzle Solved!"
              : t("daily.relay.failedTitle") || "Puzzle Failed"}
          </div>
          <p className="text-sm opacity-80">
            {isSolved
              ? `Completed in ${movesUsed} moves!`
              : `Reached end after ${movesUsed} moves.`}
          </p>
        </Card>
      )}
    </div>
  );
}
