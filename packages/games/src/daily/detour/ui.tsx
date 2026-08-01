"use client";
import * as React from "react";
import {
  Button,
  Card,
  Panel,
  Pill,
  GameIcon,
  CheckIcon,
  CloseIcon,
  LightbulbIcon,
  TargetIcon,
} from "@merky/ui";
import type { DailyPlayProps } from "../types";
import type { DetourPoiPublic, DetourPublicState, DetourSubmittedHop } from "./types";
import { DetourMap } from "./DetourMap";

export function DetourPlay({ publicState, act, t }: DailyPlayProps) {
  const state = publicState as DetourPublicState;
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedPoiId, setSelectedPoiId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmGiveUp, setConfirmGiveUp] = React.useState(false);

  const filteredCandidates = React.useMemo(() => {
    if (!searchTerm.trim()) return state.candidatePois || [];
    const term = searchTerm.toLowerCase();
    return (state.candidatePois || []).filter(
      (p: DetourPoiPublic) =>
        p.name.toLowerCase().includes(term) ||
        p.district.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
    );
  }, [state.candidatePois, searchTerm]);

  const isGameOver = state.phase === "solved" || state.phase === "failed";

  const handleGuess = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPoiId || isSubmitting || isGameOver) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await act("guess_hop", { poiId: selectedPoiId });
    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setSelectedPoiId(null);
    setSearchTerm("");
  };

  const handleRevealClue = async () => {
    if (isSubmitting || isGameOver) return;
    setIsSubmitting(true);
    const res = await act("reveal_clue");
    setIsSubmitting(false);
    if (!res.ok) setErrorMsg(res.error);
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

  // The outcome of the last action, not just a bare counter.
  const lastHop = state.hopsSubmitted[state.hopsSubmitted.length - 1];
  const liveMessage = isGameOver
    ? state.solved
      ? t("daily.detour.solvedAnnouncement")
      : t("daily.detour.failedAnnouncementFull", {
          name: state.destinationPoi?.name ?? "",
        })
    : lastHop
      ? lastHop.isCorrect
        ? `${t("daily.detour.hopCorrectNamed", { name: lastHop.poiName })} ${t(
            "daily.detour.hopCounter",
            { used: state.currentHopIndex, total: state.totalHops }
          )}`
        : t("daily.detour.detourAnnouncement", {
            name: lastHop.poiName,
            distance: lastHop.detourDistanceKm ?? 0,
          })
      : t("daily.detour.hopCounter", {
          used: state.currentHopIndex,
          total: state.totalHops,
        });

  const selectedName = (state.candidatePois || []).find(
    (p) => p.id === selectedPoiId
  )?.name;

  return (
    <div className="flex w-full flex-col gap-4 text-[var(--mb-text)]">
      <div className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </div>

      {/* City banner */}
      <Card raised className="bg-[var(--mb-surface)]">
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider [font-family:var(--mb-font-display)] sm:text-xl">
              <GameIcon
                gameId="detour"
                className="h-6 w-6 shrink-0 text-[var(--mb-accent)]"
              />
              <span className="truncate">{state.cityName}</span>
            </h2>
            <p className="text-xs font-bold text-[var(--mb-text-dim)]">
              {t("daily.detour.destinationSummary", {
                district: state.destinationSummary.district,
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Pill tone="accent">
              {t("daily.detour.hopCounter", {
                used: state.currentHopIndex,
                total: state.totalHops,
              })}
            </Pill>
            {state.score.wrongTurns > 0 && (
              <Pill tone="danger">
                {t("daily.detour.detourCount", { count: state.score.wrongTurns })}
              </Pill>
            )}
          </div>
        </div>
      </Card>

      {/* Stranger's directions */}
      <Card raised className="bg-[var(--mb-surface)]">
        <div className="flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
              {t("daily.detour.strangerClueHeading")}
              {" · "}
              {t("daily.detour.clueTier", { tier: state.currentClueTier })}
            </span>
            {!isGameOver && state.currentClueTier < 4 && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleRevealClue}
                disabled={isSubmitting}
                className="shrink-0 gap-1"
              >
                <LightbulbIcon className="h-4 w-4" />
                {t("daily.detour.requestHintButton")}
              </Button>
            )}
          </div>
          <blockquote className="border-l-4 border-[var(--mb-accent)] pl-3 text-base font-semibold italic leading-relaxed">
            {state.currentClue}
          </blockquote>
        </div>
      </Card>

      <DetourMap
        t={t}
        cityName={state.cityName}
        startPoi={state.startPoi}
        hopsSubmitted={state.hopsSubmitted}
        currentHopIndex={state.currentHopIndex}
        totalHops={state.totalHops}
        destinationPoi={state.destinationPoi}
      />

      {/* Districts the tier-4 hints have opened up. This is what unshrouding
          buys now that the map no longer masks a fabricated pin field. */}
      {state.unshroudedDistricts.length > 0 && (
        <section className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
            {t("daily.detour.districtsHeading")}
          </h3>
          {state.unshroudedDistricts.map((d) => (
            <Pill key={d} tone="accent">
              {d}
            </Pill>
          ))}
        </section>
      )}

      {/* Hop history — newest first, beside the control that produced it. */}
      {state.hopsSubmitted.length > 0 && (
        <section>
          <h3 className="sr-only">{t("daily.detour.historyHeading")}</h3>
          <ol className="flex flex-col gap-2">
            {state.hopsSubmitted
              .map((h, i) => ({ hop: h, index: i }))
              .reverse()
              .map(({ hop, index }: { hop: DetourSubmittedHop; index: number }) => (
                <li
                  key={index}
                  className={`flex items-center justify-between gap-2 rounded-md border-2 border-black p-3 shadow-[2px_2px_0_0_#000] ${
                    hop.isCorrect
                      ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
                      : "bg-[var(--mb-surface)]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0" aria-hidden="true">
                      {hop.isCorrect ? (
                        <CheckIcon className="h-5 w-5" />
                      ) : (
                        <CloseIcon className="h-5 w-5 text-[var(--mb-danger)]" />
                      )}
                    </span>
                    <span className="font-bold leading-tight">{hop.poiName}</span>
                  </div>
                  {!hop.isCorrect && (
                    <span className="shrink-0 rounded border-2 border-black bg-[var(--mb-gold)] px-2 py-1 font-mono text-xs font-black text-[var(--mb-on-gold)]">
                      {t("daily.detour.detourDistance", {
                        distance: hop.detourDistanceKm ?? 0,
                      })}
                    </span>
                  )}
                </li>
              ))}
          </ol>
        </section>
      )}

      {!isGameOver ? (
        <form onSubmit={handleGuess} className="flex flex-col gap-3">
          <label
            htmlFor="detour-search-input"
            className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)]"
          >
            {t("daily.detour.selectPrompt")}
          </label>

          <input
            id="detour-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("daily.detour.inputPlaceholder")}
            className="min-h-12 w-full rounded-md border-2 border-black bg-[var(--mb-surface)] px-3 font-bold text-[var(--mb-text)] focus:outline-none focus:ring-2 focus:ring-[var(--mb-line-bright)]"
          />

          {/* Tapping selects; only the commit button spends a hop. */}
          <div
            role="radiogroup"
            aria-label={t("daily.detour.selectPrompt")}
            className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2"
          >
            {filteredCandidates.length === 0 ? (
              <p className="p-3 text-center text-xs font-bold text-[var(--mb-text-dim)]">
                {t("daily.detour.noMatchingLocations")}
              </p>
            ) : (
              filteredCandidates.map((poi: DetourPoiPublic) => {
                const active = selectedPoiId === poi.id;
                return (
                  <button
                    key={poi.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isSubmitting}
                    onClick={() => setSelectedPoiId(poi.id)}
                    className={`flex min-h-14 flex-col justify-center rounded-md border-2 border-black px-3 py-2 text-left shadow-[2px_2px_0_0_#000] transition-colors ${
                      active
                        ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)]"
                        : "bg-[var(--mb-surface)] text-[var(--mb-text)]"
                    }`}
                  >
                    <span className="text-sm font-bold leading-tight">
                      {poi.name}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                      {poi.district}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded border-2 border-black bg-[var(--mb-danger)] p-2 text-xs font-bold text-[var(--mb-on-danger)]"
            >
              {errorMsg}
            </div>
          )}

          {/* Primary control docks to the bottom on phones, matching the other
              daily games; give-up stays a ghost, never a red bar. */}
          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t-2 border-black bg-[var(--mb-bg)] py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={isSubmitting || !selectedPoiId}
              className="min-h-12 w-full"
            >
              {selectedName
                ? t("daily.detour.guessNamed", { name: selectedName })
                : t("daily.detour.guessButton")}
            </Button>
            <button
              type="button"
              onClick={handleGiveUp}
              onBlur={() => setConfirmGiveUp(false)}
              disabled={isSubmitting}
              className="min-h-12 self-center px-4 text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] underline hover:text-[var(--mb-text)]"
            >
              {confirmGiveUp
                ? t("daily.detour.giveUpConfirm")
                : t("daily.detour.giveUpButton")}
            </button>
          </div>
        </form>
      ) : (
        <Card raised className="bg-[var(--mb-surface)]">
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            {state.solved ? (
              <div className="flex items-center justify-center gap-2 text-lg font-black text-[var(--mb-accent-2)] [font-family:var(--mb-font-display)]">
                <TargetIcon className="h-6 w-6 shrink-0" />
                {t("daily.detour.victoryTitle")}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-lg font-black text-[var(--mb-danger)] [font-family:var(--mb-font-display)]">
                <CloseIcon className="h-6 w-6 shrink-0" />
                {t("daily.detour.failedTitle")}
              </div>
            )}

            {state.destinationPoi && (
              <p className="text-base font-black">
                {t("daily.detour.destinationRevealed", {
                  name: state.destinationPoi.name,
                })}
                <span className="block text-xs font-bold text-[var(--mb-text-dim)]">
                  {state.destinationPoi.district}
                </span>
              </p>
            )}

            <dl className="flex w-full justify-center gap-6 border-t-2 border-black pt-3 text-sm">
              <div>
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
                  {t("daily.detour.statWrongTurns")}
                </dt>
                <dd className="font-mono text-lg font-black">
                  {state.score.wrongTurns}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--mb-text-dim)]">
                  {t("daily.detour.statCluesUsed")}
                </dt>
                <dd className="font-mono text-lg font-black">
                  {state.score.cluesRevealed}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      )}
    </div>
  );
}
