"use client";

import * as React from "react";
import type { StageProps } from "@merky/game-sdk";
import { Card, Panel, Pill, cn, WhimsicalAvatarFace } from "@merky/ui";
import type { MerkadePublicState, RoundFormat } from "./types";
import { DoodleGrid } from "./DoodleGrid";

function FormatBadge({ format, t, active }: { format: RoundFormat; t: (key: string) => string; active?: boolean }) {
  const tone = format === "fib" ? "accent" : format === "doodle" ? "danger" : "gold";
  const nameKey = `games.merkade.format.${format}`;
  return (
    <Pill
      tone={tone}
      className={cn(
        "text-xs px-3 py-1 font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]",
        active && "scale-110 -rotate-1 shadow-[3px_3px_0_0_#000]"
      )}
    >
      {t(nameKey)}
    </Pill>
  );
}

export function MerkadeStage({ room, match, t }: StageProps) {
  const pub = match.publicState as MerkadePublicState | null;

  if (!pub) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-3xl font-black uppercase tracking-tight text-[var(--mb-gold)] [font-family:var(--mb-font-display)] mb-wobble">
        {t("games.merkade.name")} — {t("games.merkade.ui.loading")}
      </div>
    );
  }

  const isGameOver = match.over || match.phase === "game_over";

  const scoresObj = match.scores ?? {};
  const sortedSeats = [...room.seats].sort(
    (a, b) => (scoresObj[b.seatIndex] ?? 0) - (scoresObj[a.seatIndex] ?? 0)
  );

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-4 md:p-8 justify-between select-none">
      {/* Live accessibility region */}
      <div className="sr-only" aria-live="polite">
        {t(`games.merkade.phase.${match.phase}`)}
      </div>

      {/* Header Round Progress Bar */}
      {!isGameOver && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--mb-surface-2)] p-4 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] -rotate-[0.5deg]">
          <div className="flex items-center gap-3">
            <span className="font-black text-2xl text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.round_header", {
                current: pub.roundIndex + 1,
                total: pub.roundPlan.length,
              })}
            </span>
            {pub.roundPlan[pub.roundIndex] && (
              <FormatBadge format={pub.roundPlan[pub.roundIndex]!} t={t} active />
            )}
          </div>

          {/* Round strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {pub.roundPlan.map((fmt, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-md font-black text-xs border border-black transition-transform",
                  idx === pub.roundIndex
                    ? "bg-[var(--mb-gold)] text-black scale-110 shadow-[2px_2px_0_0_#000]"
                    : idx < pub.roundIndex
                    ? "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)] opacity-50"
                    : "bg-[var(--mb-surface-3)] text-white"
                )}
                title={t("games.merkade.ui.round_tooltip", { num: idx + 1, format: t(`games.merkade.format.${fmt}`) })}
              >
                {idx + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase specific content */}
      <div className="my-auto py-4 flex flex-col items-center justify-center min-h-[360px]">
        {/* --- ROUND INTRO --- */}
        {match.phase === "round_intro" && (
          <Panel className="p-8 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center max-w-lg w-full flex flex-col items-center gap-4 mb-pop">
            <Pill tone="gold" className="text-sm px-4 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.upcoming_round")}
            </Pill>
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight [font-family:var(--mb-font-display)] -rotate-1">
              {pub.roundPlan[pub.roundIndex] ? t(`games.merkade.format.${pub.roundPlan[pub.roundIndex]!}`) : ""}
            </h2>
            <p className="text-sm font-bold text-[var(--mb-text-dim)] uppercase tracking-wider">
              {pub.roundPlan[pub.roundIndex] ? t(`games.merkade.format_desc.${pub.roundPlan[pub.roundIndex]!}`) : ""}
            </p>
          </Panel>
        )}

        {/* --- FIB ANSWER --- */}
        {match.phase === "fib_answer" && (
          <Panel className="p-8 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center max-w-2xl w-full flex flex-col items-center gap-6">
            <Pill tone="accent" className="text-xs px-3 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.phase.fib_answer")}
            </Pill>
            <h2 className="text-2xl md:text-4xl font-black text-[var(--mb-gold)] uppercase tracking-tight [font-family:var(--mb-font-display)] leading-snug">
              {pub.fibFact}
            </h2>
            <p className="text-base font-bold text-[var(--mb-text-dim)]">
              {t("games.merkade.ui.submitted_count", {
                count: pub.fibSubmittedCount ?? 0,
                total: room.seats.filter((s) => !s.abandoned).length,
              })}
            </p>
          </Panel>
        )}

        {/* --- FIB VOTE --- */}
        {match.phase === "fib_vote" && (
          <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
            <Panel className="p-6 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center w-full">
              <h2 className="text-2xl md:text-3xl font-black text-[var(--mb-gold)] uppercase tracking-tight [font-family:var(--mb-font-display)]">
                {pub.fibFact}
              </h2>
            </Panel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {(pub.fibOptions ?? []).map((opt, idx) => (
                <Card
                  key={idx}
                  className="p-4 rounded-xl bg-[var(--mb-surface-3)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center gap-4 text-left -rotate-[0.5deg]"
                >
                  <span className="w-9 h-9 rounded-lg bg-[var(--mb-gold)] text-black font-black text-lg flex items-center justify-center border-2 border-black shrink-0 shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]">
                    {idx + 1}
                  </span>
                  <span className="text-lg font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
                    {opt}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* --- FIB REVEAL --- */}
        {match.phase === "fib_reveal" && pub.fibReveal && (
          <div className="flex flex-col items-center gap-6 w-full max-w-3xl mb-pop">
            <Panel className="p-6 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center w-full">
              <Pill tone="gold" className="text-xs px-3 py-1 font-black uppercase mb-2 [font-family:var(--mb-font-display)]">
                {t("games.merkade.ui.the_truth")}
              </Pill>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--mb-accent)] uppercase tracking-tight [font-family:var(--mb-font-display)]">
                {pub.fibReveal.options[pub.fibReveal.truthIndex]}
              </h2>
            </Panel>

            <div className="grid grid-cols-1 gap-3 w-full">
              {pub.fibReveal.options.map((opt, idx) => {
                const isTruth = idx === pub.fibReveal!.truthIndex;
                const votes = pub.fibReveal!.voteCounts[idx] ?? 0;
                const authorSeat = Object.entries(pub.fibReveal!.authorsBySeat).find(
                  ([_, optionIdx]) => optionIdx === idx
                )?.[0];
                const authorPlayer = authorSeat !== undefined ? room.seats.find((s) => s.seatIndex === Number(authorSeat)) : null;

                return (
                  <Card
                    key={idx}
                    className={cn(
                      "p-4 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between gap-4 text-left",
                      isTruth
                        ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] scale-[1.02]"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-lg uppercase tracking-wider [font-family:var(--mb-font-display)]">
                        {opt}
                      </span>
                      {isTruth && (
                        <Pill tone="gold" className="text-[0.65rem] px-2 py-0.5 uppercase font-black">
                          {t("games.merkade.ui.truth_badge")}
                        </Pill>
                      )}
                      {authorPlayer && (
                        <span className="text-xs font-bold opacity-80">
                          {t("games.merkade.ui.fooled_by", { name: authorPlayer.displayName })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base [font-family:var(--mb-font-display)]">
                        {t(votes === 1 ? "games.merkade.ui.vote_singular" : "games.merkade.ui.votes_plural", { count: votes })}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* --- DOODLE DRAW --- */}
        {match.phase === "doodle_draw" && (
          <Panel className="p-8 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center max-w-lg w-full flex flex-col items-center gap-4">
            <Pill tone="danger" className="text-xs px-3 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.phase.doodle_draw")}
            </Pill>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.drawing_in_progress")}
            </h2>
            <p className="text-base font-bold text-[var(--mb-text-dim)]">
              {t("games.merkade.ui.submitted_count", {
                count: pub.doodleSubmittedCount ?? 0,
                total: room.seats.filter((s) => !s.abandoned).length,
              })}
            </p>
          </Panel>
        )}

        {/* --- DOODLE GUESS --- */}
        {match.phase === "doodle_guess" && (
          <div className="flex flex-col items-center gap-6 w-full max-w-xl">
            <Panel className="p-4 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center w-full flex flex-col items-center gap-4">
              <Pill tone="danger" className="text-xs px-3 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
                {t("games.merkade.ui.artist_spotlight", {
                  name: room.seats.find((s) => s.seatIndex === pub.doodleCurrentArtist)?.displayName ?? "Artist",
                })}
              </Pill>
              <DoodleGrid grid={pub.doodleCurrentGrid} readOnly className="max-w-md" />
            </Panel>
          </div>
        )}

        {/* --- DOODLE VOTE --- */}
        {match.phase === "doodle_vote" && (
          <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-center">
              <Panel className="p-4 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center flex flex-col items-center gap-2">
                <Pill tone="danger" className="text-[0.65rem] px-2 py-0.5 font-black uppercase [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.artist_drawing_label", {
                    name: room.seats.find((s) => s.seatIndex === pub.doodleCurrentArtist)?.displayName ?? "Artist",
                  })}
                </Pill>
                <DoodleGrid grid={pub.doodleCurrentGrid} readOnly className="w-full" />
              </Panel>

              <div className="flex flex-col gap-3">
                {(pub.doodleGuessOptions ?? []).map((opt, idx) => (
                  <Card
                    key={idx}
                    className="p-3.5 rounded-xl bg-[var(--mb-surface-3)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center gap-3 text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[var(--mb-gold)] text-black font-black text-base flex items-center justify-center border-2 border-black shrink-0 shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]">
                      {idx + 1}
                    </span>
                    <span className="text-base font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
                      {opt}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- DOODLE REVEAL ONE --- */}
        {match.phase === "doodle_reveal_one" && pub.doodleReveal && (
          <div className="flex flex-col items-center gap-6 w-full max-w-3xl mb-pop">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-center">
              <Panel className="p-4 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center flex flex-col items-center gap-3">
                <Pill tone="gold" className="text-xs px-3 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.real_prompt")}
                </Pill>
                <h3 className="text-2xl font-black text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)]">
                  {pub.doodleReveal.options[pub.doodleReveal.truthIndex]}
                </h3>
                <DoodleGrid grid={pub.doodleCurrentGrid} readOnly className="w-full" />
              </Panel>

              <div className="flex flex-col gap-3">
                {pub.doodleReveal.options.map((opt, idx) => {
                  const isTruth = idx === pub.doodleReveal!.truthIndex;
                  const votes = pub.doodleReveal!.voteCounts[idx] ?? 0;
                  const authorSeat = Object.entries(pub.doodleReveal!.authorsBySeat).find(
                    ([_, optionIdx]) => optionIdx === idx
                  )?.[0];
                  const authorPlayer = authorSeat !== undefined ? room.seats.find((s) => s.seatIndex === Number(authorSeat)) : null;

                  return (
                    <Card
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center justify-between gap-3 text-left",
                        isTruth
                          ? "bg-[var(--mb-gold)] text-black font-black"
                          : "bg-[var(--mb-surface-2)] text-white"
                      )}
                    >
                      <div>
                        <p className="font-black text-base uppercase tracking-wider [font-family:var(--mb-font-display)]">
                          {opt}
                        </p>
                        {authorPlayer && (
                          <span className="text-[0.65rem] font-bold opacity-80">
                            {t("games.merkade.ui.authored_by", { name: authorPlayer.displayName })}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-sm [font-family:var(--mb-font-display)] shrink-0">
                        {t(votes === 1 ? "games.merkade.ui.vote_singular" : "games.merkade.ui.votes_plural", { count: votes })}
                      </span>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- MAJORITY ANSWER --- */}
        {match.phase === "majority_answer" && (
          <Panel className="p-8 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center max-w-2xl w-full flex flex-col items-center gap-6">
            <Pill tone="gold" className="text-xs px-3 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.phase.majority_answer")}
            </Pill>
            <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight [font-family:var(--mb-font-display)] leading-snug">
              {pub.majorityPrompt}
            </h2>
            <div className="grid grid-cols-2 gap-4 w-full">
              {(pub.majorityOptions ?? ["A", "B"]).map((opt, i) => (
                <Panel key={i} className="p-4 rounded-xl bg-[var(--mb-surface-3)] border-2 border-black text-center">
                  <span className="font-black text-lg text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)]">
                    {opt}
                  </span>
                </Panel>
              ))}
            </div>
            <p className="text-base font-bold text-[var(--mb-text-dim)]">
              {t("games.merkade.ui.submitted_count", {
                count: pub.majoritySubmittedCount ?? 0,
                total: room.seats.filter((s) => !s.abandoned).length,
              })}
            </p>
          </Panel>
        )}

        {/* --- MAJORITY REVEAL --- */}
        {match.phase === "majority_reveal" && pub.majorityReveal && (
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl mb-pop">
            <Panel className="p-6 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center w-full flex flex-col items-center gap-4">
              <Pill tone="gold" className="text-xs px-3 py-1 font-black uppercase [font-family:var(--mb-font-display)]">
                {t("games.merkade.ui.majority_winner")}
              </Pill>
              <h2 className="text-3xl md:text-4xl font-black text-[var(--mb-gold)] uppercase tracking-tight [font-family:var(--mb-font-display)]">
                {pub.majorityOptions ? pub.majorityOptions[pub.majorityReveal.majorityOptionIndex] : ""}
              </h2>
            </Panel>

            <div className="grid grid-cols-2 gap-4 w-full">
              {(pub.majorityOptions ?? ["A", "B"]).map((opt, idx) => {
                const count = pub.majorityReveal!.counts[idx as 0 | 1];
                const isWinner = idx === pub.majorityReveal!.majorityOptionIndex;
                return (
                  <Card
                    key={idx}
                    className={cn(
                      "p-6 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] flex flex-col items-center justify-center gap-2 text-center",
                      isWinner
                        ? "bg-[var(--mb-gold)] text-black scale-105"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <span className="font-black text-xl uppercase [font-family:var(--mb-font-display)]">
                      {opt}
                    </span>
                    <span className="font-black text-3xl [font-family:var(--mb-font-display)]">
                      {t(count === 1 ? "games.merkade.ui.vote_singular" : "games.merkade.ui.votes_plural", { count })}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* --- GAME OVER PODIUM --- */}
        {isGameOver && (
          <Panel className="p-8 rounded-2xl bg-[var(--mb-surface-2)] border-[4px] border-black shadow-[var(--mb-shadow)] text-center max-w-xl w-full flex flex-col items-center gap-6 mb-pop">
            <Pill tone="gold" className="text-sm px-4 py-1 font-black uppercase tracking-wider [font-family:var(--mb-font-display)]">
              {t("games.merkade.phase.game_over")}
            </Pill>
            <h2 className="text-4xl font-black text-[var(--mb-gold)] uppercase tracking-tight [font-family:var(--mb-font-display)] mb-neon-gold">
              {t("games.merkade.ui.final_standings")}
            </h2>
            <div className="flex flex-col gap-3 w-full">
              {sortedSeats.map((seat, rank) => {
                const score = scoresObj[seat.seatIndex] ?? 0;
                return (
                  <div
                    key={seat.seatIndex}
                    className={cn(
                      "p-3 rounded-xl border-2 border-black flex items-center justify-between px-4 shadow-[2px_2px_0_0_#000]",
                      rank === 0
                        ? "bg-[var(--mb-gold)] text-black font-black scale-105"
                        : rank === 1
                        ? "bg-gray-200 text-black font-black"
                        : rank === 2
                        ? "bg-amber-600 text-white font-black"
                        : "bg-[var(--mb-surface-3)] text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-lg [font-family:var(--mb-font-display)] w-6">
                        #{rank + 1}
                      </span>
                      <WhimsicalAvatarFace avatarId={seat.avatarId} className="w-8 h-8 shrink-0" />
                      <span className="font-black text-base uppercase [font-family:var(--mb-font-display)]">
                        {seat.displayName}
                      </span>
                    </div>
                    <span className="font-black text-lg [font-family:var(--mb-font-display)]">
                      {score} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
