"use client";
import * as React from "react";
import { Button, Card, Panel, Pill, ConfettiBurst } from "@merky/ui";
import type { DailyPlayProps } from "../types";
import type { RelayPublicState } from "./types";

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
    <div className="w-full max-w-md mx-auto p-4 space-y-5 text-[var(--mb-text)]">
      {/* Screen Reader ARIA Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaMessage}
      </div>

      {isSolved && <ConfettiBurst />}

      {/* Header Info */}
      <Card className="flex items-center justify-between gap-2 p-4">
        <div>
          <div className="text-xs uppercase tracking-wider font-extrabold opacity-75">
            {t("daily.relay.target") || "Target"}
          </div>
          <div className="text-lg font-black tracking-wide flex items-center gap-2">
            <span className="text-[var(--mb-accent)]">{startWord}</span>
            <span>→</span>
            <span className="text-[var(--mb-gold)]">{endWord}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Pill tone={isSolved ? "ok" : isFailed ? "danger" : "accent"}>
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
            const firstChar = w.charAt(0);
            const midChars = w.slice(1, -1);
            const lastChar = w.slice(-1);

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
                  <span className="text-red-500 font-black">{firstChar}</span>
                  <span>{midChars}</span>
                  <span className="text-blue-500 font-black">{lastChar}</span>
                </div>
              </React.Fragment>
            );
          })}

          {!targetReached && (
            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded border-2 border-dashed border-black font-black text-sm text-[var(--mb-text-muted)] min-h-[44px] min-w-[44px]">
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
            <span className="font-black text-red-500 text-sm">{currentLastChar}</span>
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
                    ? "opacity-30 bg-gray-300 dark:bg-gray-800 line-through cursor-not-allowed border-gray-400"
                    : links
                    ? "bg-[var(--mb-surface)] hover:bg-[var(--mb-surface-3)] shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                    : "bg-[var(--mb-surface)] opacity-70 hover:opacity-100 shadow-[2px_2px_0_0_#000]"
                }`}
              >
                <span className="text-red-500">{w.charAt(0)}</span>
                <span>{w.slice(1)}</span>
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
