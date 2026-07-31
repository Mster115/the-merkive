"use client";
import * as React from "react";
import {
  Button,
  Card,
  Pill,
  BearingArrowIcon,
  TargetIcon,
  CloseIcon,
} from "@merky/ui";
import type { DailyPlayProps } from "../types";
import type { WaypointPublicState, WaypointGuess } from "./types";

export function Play({ publicState, phase, act, t }: DailyPlayProps) {
  const pub = publicState as WaypointPublicState;
  const [selectedId, setSelectedId] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!pub) return null;

  const isGameOver = phase !== "in_progress";
  const guessesLeft = pub.maxGuesses - pub.guesses.length;

  // Build the candidate list: exclude already-guessed locations.
  const guessedIds = new Set(pub.guesses.map((g) => g.locationId));
  const candidates = pub.availableLocations.filter(
    (loc) => !guessedIds.has(loc.id)
  );

  const handleGuessSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedId || isSubmitting || isGameOver) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await act("guess_location", { locationId: selectedId });
    setIsSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error);
    } else {
      setSelectedId("");
    }
  };

  const handleGiveUp = async () => {
    if (isGameOver || isSubmitting) return;
    setIsSubmitting(true);
    await act("give_up");
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full text-[var(--mb-text)]">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite">
        {isGameOver
          ? pub.solved
            ? t("daily.waypoint.solvedAnnouncement")
            : t("daily.waypoint.failedAnnouncement")
          : t("daily.waypoint.guessesLeft", { count: guessesLeft })}
      </div>

      {/* Header */}
      <Card raised className="bg-[var(--mb-surface)]">
        <div className="flex items-center justify-between p-4">
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-wider [font-family:var(--mb-font-display)]">
              {t("daily.waypoint.name")}
            </h2>
            <p className="text-xs font-bold text-[var(--mb-text-dim)]">
              {t("daily.waypoint.tagline")}
            </p>
          </div>
          <Pill tone="accent" className="shrink-0">
            {pub.guesses.length} / {pub.maxGuesses}
          </Pill>
        </div>
      </Card>

      {/* Guess History */}
      {pub.guesses.length > 0 && (
        <div className="flex flex-col gap-2">
          {pub.guesses.map((guess: WaypointGuess, idx: number) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] ${
                guess.isCorrect
                  ? "bg-[var(--mb-accent-2)]"
                  : "bg-[var(--mb-surface)]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0" aria-hidden="true">
                  {guess.isCorrect ? (
                    <TargetIcon className="w-6 h-6" />
                  ) : (
                    <BearingArrowIcon
                      bearingDeg={guess.bearingDeg}
                      className="w-6 h-6"
                    />
                  )}
                </span>
                <span className="sr-only">
                  {guess.isCorrect
                    ? t("daily.waypoint.bearingCorrect")
                    : t("daily.waypoint.bearingLabel", {
                        bearing: guess.bearingDeg,
                      })}
                </span>
                <span className="font-bold truncate">{guess.locationName}</span>
              </div>
              <div className="font-mono font-black text-sm bg-[var(--mb-gold)] text-[var(--mb-on-gold)] px-2 py-1 border-2 border-black rounded shrink-0">
                {guess.distanceKm.toLocaleString()} km
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input / Actions */}
      {!isGameOver ? (
        <form
          onSubmit={handleGuessSubmit}
          className="sticky bottom-0 z-10 -mx-4 flex w-[calc(100%+2rem)] flex-col gap-2 border-t-2 border-black bg-[var(--mb-bg)] px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:w-full sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0"
        >
          {errorMsg && (
            <div className="p-2 text-xs font-bold bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-2 border-black rounded">
              {errorMsg}
            </div>
          )}
          <div className="flex flex-row gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="flex-1 min-w-0 min-h-11 px-3 border-2 border-black rounded-md bg-[var(--mb-surface)] text-[var(--mb-text)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--mb-line-bright)] appearance-none"
              disabled={isSubmitting}
              aria-label={t("daily.waypoint.selectPrompt")}
            >
              <option value="">{t("daily.waypoint.inputPlaceholder")}</option>
              {candidates.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.region ? ` (${loc.region})` : ""}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={isSubmitting || !selectedId}
            >
              {t("daily.waypoint.guessButton")}
            </Button>
          </div>
          <button
            type="button"
            onClick={handleGiveUp}
            disabled={isSubmitting}
            className="self-end text-xs font-bold underline text-[var(--mb-text-dim)] hover:text-[var(--mb-text)] min-h-11 px-2"
          >
            {t("daily.waypoint.giveUpButton")}
          </button>
        </form>
      ) : (
        <Card raised className="bg-[var(--mb-surface)] text-center">
          <div className="p-4">
            {pub.solved ? (
              <div className="flex items-center justify-center gap-2 text-[var(--mb-accent-2)] font-black text-lg [font-family:var(--mb-font-display)]">
                <TargetIcon className="w-6 h-6 shrink-0" />
                {t("daily.waypoint.victoryTitle")}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-[var(--mb-danger)] font-black text-lg [font-family:var(--mb-font-display)]">
                <CloseIcon className="w-6 h-6 shrink-0" />
                {t("daily.waypoint.failedTitle")}
              </div>
            )}
            {pub.targetLocationName && (
              <p className="mt-2 text-sm font-bold">
                {t("daily.waypoint.revealTarget", {
                  target: pub.targetLocationName,
                })}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export const WaypointPlay = Play;
