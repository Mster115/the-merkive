"use client";

import * as React from "react";
import type { StageProps } from "@merky/game-sdk";
import { Card, Panel, PencilIcon, Pill, RankBadge, ScoreBoard, cn, sfx, WhimsicalAvatarFace, WhimsicalPlayerChip } from "@merky/ui";
import type { ZaplashPublicState } from "./logic";

export function ZapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h8l-2 8 12-12h-8l3-8z" />
    </svg>
  );
}

export function TrophyIcon({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" strokeWidth="2.5" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 5l1.2 2.4 2.8.4-2 2 .5 2.7L12 11.2 9.5 12.5l.5-2.7-2-2 2.8-.4L12 5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function DotsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="20" cy="12" r="2" />
    </svg>
  );
}

export function ZaplashStage({ room, match, t }: StageProps) {
  const pub = match.publicState as ZaplashPublicState | null;

  if (!pub) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-3xl font-black uppercase tracking-tight text-[var(--mb-gold)] [font-family:var(--mb-font-display)] mb-wobble">
        {t("games.zaplash.name")} — {t("games.zaplash.ui.loading")}
      </div>
    );
  }

  const isGameOver = match.over || match.phase === "game_over";

  // Compute live rankings for scoreboard or game_over
  const scoresObj = match.scores ?? {};
  const sortedSeats = [...room.seats].sort(
    (a, b) => (scoresObj[b.seatIndex] ?? 0) - (scoresObj[a.seatIndex] ?? 0)
  );

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto p-4 md:p-8 justify-between select-none">
      {/* Live accessibility region */}
      <div className="sr-only" aria-live="polite">
        {t(`games.zaplash.phase.${match.phase}`)}
      </div>

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 bg-[var(--mb-surface-2)] p-4 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] -rotate-[0.5deg]">
        <div className="flex items-center gap-3">
          <Pill tone="accent" className="text-base px-4 py-1.5 font-black flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0_0_#000] uppercase tracking-wider [font-family:var(--mb-font-display)] -rotate-1">
            <ZapIcon className="w-5 h-5 text-[var(--mb-gold)]" />
            {t("games.zaplash.name")}
          </Pill>
          <span className="font-black text-2xl text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.zaplash.ui.round_info", {
              round: pub.round,
              total: pub.totalRounds,
            })}
          </span>
        </div>

        {match.phase === "vote" && pub.currentMatchup && (
          <Pill tone="gold" className="text-base px-4 py-1.5 font-black uppercase tracking-wider [font-family:var(--mb-font-display)] border-2 border-black shadow-[2px_2px_0_0_#000] rotate-1">
            {t("games.zaplash.ui.matchup_progress", {
              current: pub.currentMatchupIndex + 1,
              total: pub.totalMatchups,
            })}
          </Pill>
        )}

        {(match.phase === "finale_write" || match.phase === "finale_vote" || match.phase === "finale_reveal") && (
          <Pill tone="danger" className="text-base px-4 py-1.5 font-black flex items-center gap-1.5 uppercase tracking-wider [font-family:var(--mb-font-display)] border-2 border-black shadow-[2px_2px_0_0_#000] rotate-1 mb-blink">
            <ZapIcon className="w-5 h-5" /> {t("games.zaplash.ui.finale_title")}
          </Pill>
        )}
      </div>

      {/* Main Content Area */}
      <div className="my-auto py-6">
        {/* WRITE PHASE */}
        {match.phase === "write" && (
          <div className="flex flex-col items-center justify-center text-center gap-8">
            <h2 className="flex items-center justify-center gap-4 text-5xl md:text-7xl font-black tracking-tight uppercase [font-family:var(--mb-font-display)] mb-neon-gold -rotate-1 mb-wobble-fast">
              <PencilIcon className="w-12 h-12 md:w-16 md:h-16 shrink-0" /> {t("games.zaplash.ui.players_writing")}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 w-full max-w-5xl">
              {room.seats.map((seat, i) => {
                const isDone = pub.submittedSeats.includes(seat.seatIndex);
                return (
                  <Panel
                    key={seat.seatIndex}
                    className={cn(
                      "p-5 rounded-2xl flex items-center justify-between border-[3px] border-black transition-all transform shadow-[var(--mb-shadow-lg)]",
                      i % 2 === 0 ? "-rotate-1" : "rotate-1",
                      isDone
                        ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] scale-105 mb-pop"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <WhimsicalAvatarFace avatarId={seat.avatarId} size={48} />
                      <span className="font-black text-xl truncate [font-family:var(--mb-font-display)]">{seat.displayName}</span>
                    </div>
                    <span
                      className={cn(
                        "font-black text-xs px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center gap-1 border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)] shrink-0 ml-2",
                        isDone ? "bg-white text-black" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]"
                      )}
                    >
                      {isDone ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-emerald-600" />
                          {t("games.zaplash.ui.done")}
                        </>
                      ) : (
                        t("games.zaplash.ui.writing")
                      )}
                    </span>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {/* VOTE PHASE */}
        {match.phase === "vote" && pub.currentMatchup && (
          <div className="flex flex-col items-center text-center gap-8 max-w-5xl mx-auto">
            <div className="bg-[var(--mb-surface)] border-4 border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-6 w-full -rotate-[0.5deg]">
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight break-words px-4 text-center [font-family:var(--mb-font-display)] tracking-tight">
                "{pub.currentMatchup.promptText}"
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-2">
              {pub.currentMatchup.answers.map((ans, idx) => {
                const label = idx === 0 ? "A" : "B";
                return (
                  <Card
                    key={idx}
                    raised
                    className={cn(
                      "mb-flip-in p-8 rounded-2xl bg-[var(--mb-surface-2)] border-4 border-black shadow-[var(--mb-shadow-lg)] flex flex-col items-start gap-4 text-left relative min-h-[180px] justify-center mb-lift",
                      idx === 0 ? "-rotate-1" : "rotate-1"
                    )}
                    style={{ animationDelay: `${idx * 180}ms` }}
                  >
                    <span className="absolute top-4 right-4 text-2xl font-black px-4 py-1 rounded-xl bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]">
                      {label}
                    </span>
                    <p className="text-3xl md:text-4xl font-extrabold text-white leading-snug break-words w-full">
                      {ans.text}
                    </p>
                  </Card>
                );
              })}
            </div>

            {/* Voter Status Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <span className="text-base font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)] mr-2">
                {t("games.zaplash.ui.voted_status")}:
              </span>
              {room.seats.map((seat) => {
                const isWriter = pub.currentMatchup?.excludedSeats.includes(seat.seatIndex) ?? false;
                const hasVoted = pub.currentMatchup?.votedSeats.includes(seat.seatIndex);

                if (isWriter) return null;

                return (
                  <WhimsicalPlayerChip
                    key={seat.seatIndex}
                    displayName={seat.displayName}
                    avatarId={seat.avatarId}
                    highlight={hasVoted}
                    trailing={
                      hasVoted ? (
                        <CheckIcon className="w-4 h-4 text-[var(--mb-accent-2)] font-bold" />
                      ) : (
                        <DotsIcon className="w-4 h-4 text-[var(--mb-text-dim)]" />
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* REVEAL PHASE */}
        {match.phase === "reveal" && pub.currentMatchup && (
          pub.currentMatchup.jinx ? (
            <div className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto mb-shake">
              <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tight [font-family:var(--mb-font-display)] mb-neon-pink rotate-1">
                ⚡ {t("games.zaplash.ui.jinx_title")}
              </h2>
              <p className="text-xl md:text-2xl font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
                {t("games.zaplash.ui.jinx_subtitle")}
              </p>
              <Card raised className="p-8 rounded-2xl bg-[var(--mb-surface-2)] border-4 border-black shadow-[var(--mb-shadow-lg)] max-w-2xl -rotate-1">
                <p className="text-3xl md:text-4xl font-black text-white leading-snug break-words">
                  "{pub.currentMatchup.answers[0]?.text ?? ""}"
                </p>
              </Card>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {pub.currentMatchup.answers.map((ans, idx) => {
                  const writerSeat = ans.writerSeat !== undefined ? room.seats.find((s) => s.seatIndex === ans.writerSeat) : null;
                  return writerSeat ? (
                    <div key={idx} className="flex items-center gap-2 bg-[var(--mb-surface-2)] border-2 border-black rounded-xl px-3 py-2 shadow-[2px_2px_0_0_#000]">
                      <WhimsicalAvatarFace avatarId={writerSeat.avatarId} size={40} />
                      <span className="font-black text-base text-white [font-family:var(--mb-font-display)]">{writerSeat.displayName}</span>
                      <span className="font-black text-sm text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">+0</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ) : (
          <div className="flex flex-col items-center text-center gap-8 max-w-5xl mx-auto">
            {pub.currentMatchup.zapSeat !== null && pub.currentMatchup.zapSeat !== undefined && (
              <ZapMoment key={`${pub.currentMatchupIndex}`} />
            )}
            <div className="bg-[var(--mb-surface)] border-4 border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-5 w-full">
              <h2 className="text-2xl md:text-4xl font-black text-white leading-tight break-words px-4 text-center tracking-tight [font-family:var(--mb-font-display)]">
                "{pub.currentMatchup.promptText}"
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-2">
              {pub.currentMatchup.answers.map((ans, idx) => {
                const label = idx === 0 ? "A" : "B";
                const writerSeat = ans.writerSeat !== undefined ? room.seats.find((s) => s.seatIndex === ans.writerSeat) : null;
                const votes = pub.currentMatchup?.votesPerAnswer?.[idx] ?? 0;
                const pts = pub.currentMatchup?.pointsAwarded?.[idx] ?? 0;
                const otherVotes = pub.currentMatchup?.votesPerAnswer?.[idx === 0 ? 1 : 0] ?? 0;
                const isWinner = votes > otherVotes;
                const isZap = pub.currentMatchup?.zapSeat === ans.writerSeat && votes > 0;

                return (
                  <Card
                    key={idx}
                    raised
                    className={cn(
                      "mb-pop p-7 rounded-2xl flex flex-col justify-between gap-6 border-4 border-black text-left relative min-h-[240px] transition-transform duration-500 shadow-[var(--mb-shadow-lg)]",
                      isZap
                        ? "mb-shake bg-[var(--mb-gold)] text-black rotate-1 scale-[1.03]"
                        : isWinner
                        ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] -rotate-1 scale-[1.02]"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                    style={{ animationDelay: `${idx * 200}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl font-black px-4 py-1.5 rounded-xl bg-[var(--mb-accent)] text-white border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]">
                        {label}
                      </span>
                      {isZap && (
                        <span className="px-4 py-1.5 rounded-xl bg-pink-600 text-white font-black text-xl border-2 border-black shadow-[3px_3px_0_0_#000] flex items-center gap-1.5 uppercase [font-family:var(--mb-font-display)] mb-tada mb-shake">
                          <ZapIcon className="w-5 h-5 shrink-0" /> ZAP! +50
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "text-3xl md:text-4xl font-black leading-snug break-words w-full",
                        isZap ? "text-black" : isWinner ? "text-[var(--mb-on-accent-2)]" : "text-white"
                      )}
                    >
                      {ans.text}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t-2 border-black/40">
                      {writerSeat ? (
                        <div className="flex items-center gap-3">
                          <WhimsicalAvatarFace avatarId={writerSeat.avatarId} size={44} />
                          <span
                            className={cn(
                              "font-black text-xl [font-family:var(--mb-font-display)]",
                              isZap ? "text-black" : isWinner ? "text-[var(--mb-on-accent-2)]" : "text-white"
                            )}
                          >
                            {writerSeat.displayName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-base font-bold opacity-70">???</span>
                      )}

                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-xl font-black px-3.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)] uppercase",
                            isZap ? "bg-white text-black" : isWinner ? "bg-white text-black" : "bg-[var(--mb-gold)] text-black"
                          )}
                        >
                          {t("games.zaplash.ui.votes_count", { count: votes })}
                        </span>
                        {pts > 0 && (
                          <span
                            className={cn(
                              "mb-tada text-3xl font-black [font-family:var(--mb-font-display)] drop-shadow-[2px_2px_0_#000]",
                              isZap ? "text-pink-700" : isWinner ? "text-[var(--mb-on-accent-2)]" : "text-[var(--mb-accent-2)]"
                            )}
                            style={{ animationDelay: "500ms" }}
                          >
                            +{pts}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
          )
        )}

        {/* SCOREBOARD PHASE */}
        {match.phase === "scoreboard" && (
          <div className="flex flex-col items-center justify-center text-center gap-6 max-w-3xl mx-auto">
            <h2 className="flex items-center justify-center gap-4 text-5xl md:text-7xl font-black uppercase tracking-tight [font-family:var(--mb-font-display)] mb-neon-gold -rotate-1 mb-wobble-fast">
              <TrophyIcon className="w-12 h-12 md:w-16 md:h-16 shrink-0" /> {t("games.zaplash.ui.scoreboard_title")}
            </h2>

            <ScoreBoard
              rows={sortedSeats.map((s) => ({
                seatIndex: s.seatIndex,
                displayName: s.displayName,
                avatarId: s.avatarId,
                points: scoresObj[s.seatIndex] ?? 0,
              }))}
              className="w-full"
            />
          </div>
        )}

        {/* LIGHTNING ROUND — WRITE PHASE */}
        {match.phase === "finale_write" && pub.finale && (
          <div className="flex flex-col items-center justify-center text-center gap-6">
            <h2 className="flex items-center justify-center gap-4 text-4xl md:text-6xl font-black tracking-tight uppercase [font-family:var(--mb-font-display)] mb-neon-pink -rotate-1 mb-wobble-fast">
              <ZapIcon className="w-10 h-10 md:w-14 md:h-14 shrink-0 text-[var(--mb-gold)]" /> {t("games.zaplash.ui.finale_write_title")}
            </h2>

            <div className="bg-[var(--mb-surface)] border-4 border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-6 w-full max-w-4xl -rotate-[0.5deg]">
              <h3 className="text-3xl md:text-5xl font-black text-white leading-tight break-words px-2 text-center [font-family:var(--mb-font-display)] tracking-tight">
                "{pub.finale.promptText}"
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 w-full max-w-5xl">
              {room.seats.map((seat, i) => {
                const isDone = pub.finale!.submittedSeats.includes(seat.seatIndex);
                return (
                  <Panel
                    key={seat.seatIndex}
                    className={cn(
                      "p-5 rounded-2xl flex items-center justify-between border-[3px] border-black transition-all transform shadow-[var(--mb-shadow-lg)]",
                      i % 2 === 0 ? "-rotate-1" : "rotate-1",
                      isDone
                        ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] scale-105 mb-pop"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <WhimsicalAvatarFace avatarId={seat.avatarId} size={48} />
                      <span className="font-black text-xl truncate [font-family:var(--mb-font-display)]">{seat.displayName}</span>
                    </div>
                    <span
                      className={cn(
                        "font-black text-xs px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center gap-1 border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)] shrink-0 ml-2",
                        isDone ? "bg-white text-black" : "bg-[var(--mb-surface-3)] text-[var(--mb-text-dim)]"
                      )}
                    >
                      {isDone ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-emerald-600" />
                          {t("games.zaplash.ui.done")}
                        </>
                      ) : (
                        t("games.zaplash.ui.writing")
                      )}
                    </span>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {/* LIGHTNING ROUND — VOTE PHASE */}
        {match.phase === "finale_vote" && pub.finale && (
          <div className="flex flex-col items-center text-center gap-8 max-w-6xl mx-auto">
            <div className="bg-[var(--mb-surface)] border-4 border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-6 w-full -rotate-[0.5deg]">
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight break-words px-4 text-center [font-family:var(--mb-font-display)] tracking-tight">
                "{pub.finale.promptText}"
              </h2>
            </div>

            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
              {t("games.zaplash.ui.finale_vote_title")}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {pub.finale.answers.map((ans, idx) => {
                const label = String.fromCharCode(65 + idx);
                return (
                  <Card
                    key={ans.seat}
                    raised
                    className={cn(
                      "mb-flip-in p-6 rounded-2xl bg-[var(--mb-surface-2)] border-4 border-black shadow-[var(--mb-shadow-lg)] flex flex-col items-start gap-3 text-left relative min-h-[150px] justify-center mb-lift",
                      idx % 2 === 0 ? "-rotate-1" : "rotate-1"
                    )}
                    style={{ animationDelay: `${idx * 120}ms` }}
                  >
                    <span className="text-xl font-black px-3.5 py-1 rounded-xl bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]">
                      {label}
                    </span>
                    <p className="text-xl md:text-2xl font-extrabold text-white leading-snug break-words w-full">
                      {ans.text}
                    </p>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <span className="text-base font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)] mr-2">
                {t("games.zaplash.ui.voted_status")}:
              </span>
              {room.seats.map((seat) => {
                const hasVoted = pub.finale!.votedSeats.includes(seat.seatIndex);
                return (
                  <WhimsicalPlayerChip
                    key={seat.seatIndex}
                    displayName={seat.displayName}
                    avatarId={seat.avatarId}
                    highlight={hasVoted}
                    trailing={
                      hasVoted ? (
                        <CheckIcon className="w-4 h-4 text-[var(--mb-accent-2)] font-bold" />
                      ) : (
                        <DotsIcon className="w-4 h-4 text-[var(--mb-text-dim)]" />
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* LIGHTNING ROUND — REVEAL PHASE */}
        {match.phase === "finale_reveal" && pub.finale && (
          <div className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto">
            {pub.finale.results && pub.finale.results.length > 0 && <FinaleWinnerFx key="finale-winner-fx" />}

            <h2 className="flex items-center justify-center gap-4 text-4xl md:text-6xl font-black uppercase tracking-tight [font-family:var(--mb-font-display)] mb-neon-gold rotate-1 mb-wobble-fast">
              <TrophyIcon className="w-12 h-12 md:w-16 md:h-16 shrink-0" /> {t("games.zaplash.ui.finale_reveal_title")}
            </h2>

            {!pub.finale.results || pub.finale.results.length === 0 ? (
              <Panel className="p-6 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)]">
                <p className="font-black text-lg text-[var(--mb-text-dim)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.zaplash.ui.finale_not_enough")}
                </p>
              </Panel>
            ) : (
              <ol className="flex flex-col gap-3 w-full mb-stagger" aria-label="Lightning Round results">
                {pub.finale.results.map((r, i) => {
                  const seatObj = room.seats.find((s) => s.seatIndex === r.seat);
                  return (
                    <li
                      key={r.seat}
                      style={{ "--mb-i": i } as React.CSSProperties}
                      className={cn(
                        "mb-rise flex items-center gap-4 p-4 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] text-left",
                        r.rank === 0 ? "bg-[var(--mb-gold)] text-black scale-[1.02]" : "bg-[var(--mb-surface-2)] text-white"
                      )}
                    >
                      <RankBadge rank={r.rank} className="w-10 h-10 text-lg shrink-0" />
                      {seatObj && <WhimsicalAvatarFace avatarId={seatObj.avatarId} size={44} />}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate [font-family:var(--mb-font-display)] opacity-80">
                          {seatObj?.displayName ?? "???"}
                        </p>
                        <p className="text-lg md:text-xl font-extrabold truncate break-words">{r.text}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span className="text-xs font-black uppercase tracking-wider opacity-70 [font-family:var(--mb-font-display)]">
                          {t("games.zaplash.ui.votes_count", { count: r.votes })}
                        </span>
                        <span className="text-2xl font-black [font-family:var(--mb-font-display)]">+{r.points}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {/* GAME OVER PHASE */}
        {isGameOver && (
          <div className="flex flex-col items-center justify-center text-center gap-6 max-w-xl mx-auto py-8">
            <TrophyIcon className="w-24 h-24 text-[var(--mb-gold)] mb-tada drop-shadow-[6px_6px_0_#000]" />
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tight [font-family:var(--mb-font-display)] mb-neon-gold rotate-1">
              {t("games.zaplash.ui.wrap_title")}
            </h2>
            <p className="text-2xl font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
              {t("games.zaplash.ui.wrap_subtitle")}
            </p>
          </div>
        )}
      </div>

      {/* Footer Seat List */}
      {!isGameOver && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {room.seats.map((seat) => (
            <WhimsicalPlayerChip
              key={seat.seatIndex}
              displayName={seat.displayName}
              avatarId={seat.avatarId}
              isHost={seat.isHost}
              connected={seat.connected}
              abandoned={seat.abandoned}
              trailing={
                <span className="font-black text-sm text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
                  {scoresObj[seat.seatIndex] ?? 0}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Full-screen lightning flash + zap sting for unanimous-vote reveals. */
function ZapMoment() {
  React.useEffect(() => {
    sfx.play("zap");
  }, []);
  return <div aria-hidden="true" className="mb-zapflash" />;
}

/** Victory sting for the Lightning Round results reveal. */
function FinaleWinnerFx() {
  React.useEffect(() => {
    sfx.play("win");
  }, []);
  return null;
}
