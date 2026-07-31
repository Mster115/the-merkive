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
import type {
  WaypointOctant,
  WaypointPublicState,
  WaypointGuess,
  WaypointLocationPublic,
} from "./types";
import { WaypointMap } from "./WaypointMap";

/** i18n key suffixes for the eight compass sectors, 0 = N clockwise. */
const OCTANT_KEYS = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
] as const;

function octantKey(octant: WaypointOctant): string {
  return `daily.waypoint.dir.${OCTANT_KEYS[octant] ?? "n"}`;
}

export function Play({ publicState, phase, act, t }: DailyPlayProps) {
  const pub = publicState as WaypointPublicState;
  const [selectedId, setSelectedId] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmGiveUp, setConfirmGiveUp] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(true);
  const latestRowRef = React.useRef<HTMLLIElement | null>(null);
  const prevGuessCount = React.useRef(0);

  const isGameOver = phase !== "in_progress";

  // Move focus to the result the player just produced. Previously a guess
  // left focus on a Guess button that had become disabled, which reads to
  // assistive tech as the app locking up.
  React.useEffect(() => {
    const count = pub?.guesses.length ?? 0;
    if (count > prevGuessCount.current) latestRowRef.current?.focus();
    prevGuessCount.current = count;
  }, [pub?.guesses.length]);

  if (!pub) return null;

  const guessesLeft = pub.maxGuesses - pub.guesses.length;
  const guessedIds = new Set(pub.guesses.map((g) => g.locationId));

  // Guessed landmarks stay in the bank, disabled. Removing them shrank the
  // visible answer space each turn, which was itself a hint.
  const candidates: WaypointLocationPublic[] = pub.availableLocations;

  // Newest first: the result the player just caused sits next to the control
  // that caused it, rather than scrolling away above the fold.
  const orderedGuesses = pub.guesses
    .map((g, i) => ({ guess: g, index: i }))
    .reverse();

  const closest = pub.guesses.reduce<WaypointGuess | null>(
    (best, g) => (!best || g.distanceKm < best.distanceKm ? g : best),
    null
  );

  const describeGuess = (g: WaypointGuess) =>
    g.isCorrect
      ? t("daily.waypoint.bearingCorrect")
      : t("daily.waypoint.guessResult", {
          name: g.locationName,
          distance: g.distanceKm.toLocaleString(),
          direction:
            g.octant === undefined ? "" : t(octantKey(g.octant)),
        });

  const handleGuessSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedId || isSubmitting || isGameOver) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await act("guess_location", { locationId: selectedId });
    setIsSubmitting(false);

    if (!res.ok) setErrorMsg(res.error);
    else setSelectedId("");
  };

  const handleGiveUp = async () => {
    if (isGameOver || isSubmitting) return;
    if (!confirmGiveUp) {
      setConfirmGiveUp(true);
      return;
    }
    setIsSubmitting(true);
    await act("give_up");
    setIsSubmitting(false);
  };

  const selectedName = candidates.find((c) => c.id === selectedId)?.name;

  return (
    <div className="flex w-full flex-col gap-5 text-[var(--mb-text)]">
      {/* The outcome of a guess, not just the count of remaining ones. */}
      <div className="sr-only" aria-live="polite" role="status">
        {isGameOver
          ? pub.solved
            ? t("daily.waypoint.solvedAnnouncement")
            : t("daily.waypoint.failedAnnouncementFull", {
                target: pub.targetLocationName ?? "",
              })
          : pub.guesses.length > 0
            ? `${describeGuess(pub.guesses[pub.guesses.length - 1]!)} ${t(
                "daily.waypoint.guessesLeft",
                { count: guessesLeft }
              )}`
            : t("daily.waypoint.guessesLeft", { count: guessesLeft })}
      </div>

      {/* Header */}
      <Card raised className="bg-[var(--mb-surface)]">
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black uppercase tracking-wider [font-family:var(--mb-font-display)] sm:text-xl">
              {t("daily.waypoint.name")}
            </h2>
            {/* Decoration costs vertical pixels on the one size where they
                are scarce, so it only appears once there is room. */}
            <p className="hidden text-xs font-bold text-[var(--mb-text-dim)] sm:block">
              {t("daily.waypoint.tagline")}
            </p>
          </div>
          <Pill tone="accent" className="shrink-0">
            {t("daily.waypoint.guessCounter", {
              used: pub.guesses.length,
              max: pub.maxGuesses,
            })}
          </Pill>
        </div>
      </Card>

      {pub.guesses.length === 0 && !isGameOver && (
        <p className="text-sm font-bold text-[var(--mb-text-dim)]">
          {t("daily.waypoint.goal", { count: pub.maxGuesses })}
        </p>
      )}

      {/* Guess history — a real list, newest first. */}
      {pub.guesses.length > 0 && (
        <section>
          <h3 className="sr-only">{t("daily.waypoint.historyHeading")}</h3>
          <ol className="flex flex-col gap-2">
            {orderedGuesses.map(({ guess, index }) => (
              <li
                key={index}
                ref={index === pub.guesses.length - 1 ? latestRowRef : null}
                tabIndex={-1}
                className={`flex items-center justify-between gap-2 rounded-md border-2 border-black p-3 shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[var(--mb-line-bright)] ${
                  guess.isCorrect
                    ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
                    : "bg-[var(--mb-surface)]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-black bg-[var(--mb-gold)] text-[10px] font-black text-[var(--mb-on-gold)]"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="shrink-0" aria-hidden="true">
                    {guess.isCorrect || guess.octant === undefined ? (
                      <TargetIcon className="h-6 w-6" />
                    ) : (
                      <BearingArrowIcon
                        octant={guess.octant}
                        className="h-6 w-6"
                      />
                    )}
                  </span>
                  {/* Name and direction stack, so a long landmark name is not
                      squeezed to an ellipsis by the bearing word beside it. */}
                  <span className="flex min-w-0 flex-col">
                    {/* Wraps rather than truncates: "Great Pyramid of Giza"
                        and "Obelisco de Buenos Aires" both lose their tail to
                        an ellipsis at 360px otherwise. */}
                    <span className="font-bold leading-tight">
                      {guess.locationName}
                    </span>
                    {!guess.isCorrect && guess.octant !== undefined && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
                        {t(octantKey(guess.octant))}
                      </span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 rounded border-2 border-black bg-[var(--mb-gold)] px-2 py-1 font-mono text-xs font-black text-[var(--mb-on-gold)] sm:text-sm">
                  {guess.distanceKm.toLocaleString()} km
                </span>
                <span className="sr-only">{describeGuess(guess)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Map. Decorative — everything it shows is in the list above. */}
      {(pub.guesses.length > 0 || isGameOver) && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            className="flex min-h-12 items-center justify-between rounded-md border-2 border-black bg-[var(--mb-surface)] px-3 text-sm font-black uppercase tracking-wider shadow-[2px_2px_0_0_#000]"
          >
            {t("daily.waypoint.mapHeading")}
            <span aria-hidden="true">{mapOpen ? "–" : "+"}</span>
          </button>
          {mapOpen && (
            <>
              <WaypointMap
                guesses={pub.guesses}
                targetCoordinates={pub.targetCoordinates}
                targetLocationName={
                  isGameOver ? pub.targetLocationName : undefined
                }
                revealed={isGameOver}
              />
              <p className="text-[11px] font-bold leading-snug text-[var(--mb-text-dim)]">
                {isGameOver
                  ? t("daily.waypoint.mapCaptionRevealed")
                  : t("daily.waypoint.mapCaption")}
              </p>
            </>
          )}
        </section>
      )}

      {!isGameOver ? (
        <form onSubmit={handleGuessSubmit} className="flex flex-col gap-3">
          {/* Landmark bank. Tapping selects; only GUESS commits, so a
              mis-tap never spends a guess. */}
          <div
            role="radiogroup"
            aria-label={t("daily.waypoint.selectPrompt")}
            className="grid grid-cols-2 gap-2"
          >
            {candidates.map((loc) => {
              const used = guessedIds.has(loc.id);
              const active = selectedId === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={used || isSubmitting}
                  onClick={() => setSelectedId(loc.id)}
                  className={`min-h-14 rounded-md border-2 border-black px-2 py-2 text-left text-sm font-bold leading-tight shadow-[2px_2px_0_0_#000] transition-colors ${
                    used
                      ? "cursor-not-allowed bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] line-through opacity-60"
                      : active
                        ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                        : "bg-[var(--mb-surface)] text-[var(--mb-text)]"
                  }`}
                >
                  {loc.name}
                </button>
              );
            })}
          </div>

          {/* Guaranteed-correct input path: the OS picker, always present, for
              Voice Control, Switch Control and external keyboards. */}
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t("daily.waypoint.selectPrompt")}</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={isSubmitting}
              className="min-h-12 w-full rounded-md border-2 border-black bg-[var(--mb-surface)] px-3 font-bold text-[var(--mb-text)] focus:outline-none focus:ring-2 focus:ring-[var(--mb-line-bright)]"
            >
              <option value="">{t("daily.waypoint.inputPlaceholder")}</option>
              {candidates
                .filter((loc) => !guessedIds.has(loc.id))
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
            </select>
          </label>

          {errorMsg && (
            <div
              role="alert"
              className="rounded border-2 border-black bg-[var(--mb-danger)] p-2 text-xs font-bold text-[var(--mb-on-danger)]"
            >
              {errorMsg}
            </div>
          )}

          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t-2 border-black bg-[var(--mb-bg)] py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={isSubmitting || !selectedId}
              className="min-h-12 w-full"
            >
              {selectedName
                ? t("daily.waypoint.guessNamed", { name: selectedName })
                : t("daily.waypoint.guessButton")}
            </Button>
            <button
              type="button"
              onClick={handleGiveUp}
              onBlur={() => setConfirmGiveUp(false)}
              disabled={isSubmitting}
              className="min-h-12 self-center px-4 text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] underline hover:text-[var(--mb-text)]"
            >
              {confirmGiveUp
                ? t("daily.waypoint.giveUpConfirm")
                : t("daily.waypoint.giveUpButton")}
            </button>
          </div>
        </form>
      ) : (
        <Card raised className="bg-[var(--mb-surface)]">
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            {pub.solved ? (
              <div className="flex items-center justify-center gap-2 text-lg font-black text-[var(--mb-accent-2)] [font-family:var(--mb-font-display)]">
                <TargetIcon className="h-6 w-6 shrink-0" />
                {t("daily.waypoint.victoryTitle")}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-lg font-black text-[var(--mb-danger)] [font-family:var(--mb-font-display)]">
                <CloseIcon className="h-6 w-6 shrink-0" />
                {t("daily.waypoint.failedTitle")}
              </div>
            )}

            {pub.targetLocationName && (
              <p className="text-base font-black">
                {t("daily.waypoint.revealTarget", {
                  target: pub.targetLocationName,
                })}
                {pub.targetRegion ? (
                  <span className="block text-xs font-bold text-[var(--mb-text-dim)]">
                    {pub.targetRegion}
                  </span>
                ) : null}
              </p>
            )}

            <dl className="flex w-full justify-center gap-6 border-t-2 border-black pt-3 text-sm">
              <div>
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
                  {t("daily.waypoint.statGuesses")}
                </dt>
                <dd className="font-mono text-lg font-black">
                  {pub.guesses.length}/{pub.maxGuesses}
                </dd>
              </div>
              {closest && (
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
                    {t("daily.waypoint.statClosest")}
                  </dt>
                  <dd className="font-mono text-lg font-black">
                    {closest.distanceKm.toLocaleString()} km
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Card>
      )}
    </div>
  );
}

export const WaypointPlay = Play;
