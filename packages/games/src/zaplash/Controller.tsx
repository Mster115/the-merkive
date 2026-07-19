"use client";

import * as React from "react";
import type { ControllerProps } from "@merky/game-sdk";
import { Button, buzz, Card, Panel, Pill, cn } from "@merky/ui";
import type { ZaplashPrivateState, ZaplashPublicState } from "./logic";

export function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function LockIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function EyeIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PopcornIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4" />
      <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export function FinishFlagIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function ZaplashController({ match, seat, privateState, act, t }: ControllerProps) {
  const pub = match.publicState as ZaplashPublicState | null;
  const priv = privateState as ZaplashPrivateState | null;

  const [inputTexts, setInputTexts] = React.useState<Record<number, string>>({});
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  if (!pub) {
    return (
      <div className="p-6 text-center font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)] mb-wobble">
        {t("games.zaplash.name")} — {t("games.zaplash.ui.loading")}
      </div>
    );
  }

  const isGameOver = match.over || match.phase === "game_over";
  const assignedPrompts = priv?.prompts ?? [];
  const submittedAnswers = priv?.answers ?? {};

  const handleSubmit = async (promptIndex: number) => {
    setErrorMsg(null);
    const text = inputTexts[promptIndex] ?? "";
    const res = await act("submit_answer", { promptIndex, text });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz(20);
    }
  };

  const handleVote = async (answerIndex: 0 | 1) => {
    setErrorMsg(null);
    const res = await act("vote", { answerIndex });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz(20);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full max-w-md mx-auto p-4 gap-4 select-none">
      {/* Live accessibility region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {t(`games.zaplash.phase.${match.phase}`)}
      </div>

      {/* Header Info */}
      <Card className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] -rotate-[0.5deg]">
        <div className="flex items-center gap-2">
          <Pill tone="accent" className="text-xs px-3 py-1 font-black uppercase tracking-wider [font-family:var(--mb-font-display)] border border-black shadow-[2px_2px_0_0_#000]">
            ⚡ {t("games.zaplash.name")}
          </Pill>
        </div>
        <span className="font-black text-xs sm:text-sm text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
          {t("games.zaplash.ui.round_info", {
            round: pub.round,
            total: pub.totalRounds,
          })}
        </span>
      </Card>

      {/* Error Toast / Alert */}
      {errorMsg && (
        <div role="alert" className="p-3.5 text-sm font-black bg-[var(--mb-danger)] border-[3px] border-black text-[var(--mb-on-danger)] rounded-xl text-center shadow-[var(--mb-shadow)] uppercase tracking-wide [font-family:var(--mb-font-display)] mb-shake">
          {errorMsg}
        </div>
      )}

      {/* WRITE PHASE */}
      {match.phase === "write" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-black text-[var(--mb-gold)] text-center uppercase tracking-wider [font-family:var(--mb-font-display)] mb-wobble-fast">
            ✍️ {t("games.zaplash.ui.write_prompts_title")}
          </h2>

          {assignedPrompts.map((p, idx) => {
            const isSubmitted = submittedAnswers[p.index] !== undefined;
            const textVal = isSubmitted ? (submittedAnswers[p.index] ?? "") : (inputTexts[p.index] ?? "");
            const inputId = `zaplash-prompt-${p.index}`;

            return (
              <Card
                key={p.index}
                className={cn(
                  "p-4 rounded-xl flex flex-col gap-3 border-[3px] border-black transition-all shadow-[var(--mb-shadow)]",
                  idx % 2 === 0 ? "-rotate-[0.5deg]" : "rotate-[0.5deg]",
                  isSubmitted
                    ? "bg-[var(--mb-surface-3)] border-black"
                    : "bg-[var(--mb-surface-2)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-black text-[var(--mb-violet)] tracking-wider [font-family:var(--mb-font-display)]">
                    {t("games.zaplash.ui.prompt_num", { num: idx + 1 })}
                  </span>
                  {isSubmitted && (
                    <span className="text-xs font-black uppercase text-[var(--mb-on-accent-2)] bg-[var(--mb-accent-2)] px-2.5 py-1 rounded-lg flex items-center gap-1 border border-black shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)] mb-pop">
                      <CheckIcon className="w-3.5 h-3.5" />
                      {t("games.zaplash.ui.submitted")}
                    </span>
                  )}
                </div>

                <p id={`${inputId}-label`} className="font-extrabold text-base text-white leading-snug break-words">
                  "{p.text}"
                </p>

                {!isSubmitted ? (
                  <>
                    <textarea
                      id={inputId}
                      aria-labelledby={`${inputId}-label`}
                      value={textVal}
                      onChange={(e) =>
                        setInputTexts({ ...inputTexts, [p.index]: e.target.value })
                      }
                      maxLength={120}
                      rows={2}
                      placeholder={t("games.zaplash.ui.type_answer_ph")}
                      className="w-full p-3 rounded-xl bg-white text-black border-2 border-black font-extrabold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent-2)] text-base resize-none shadow-[2px_2px_0_0_#000]"
                    />
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--mb-text-dim)]">
                      <span className="font-mono">{120 - textVal.length} {t("games.zaplash.ui.chars_left")}</span>
                      <Button
                        variant="primary"
                        size="md"
                        disabled={textVal.trim().length === 0 || textVal.length > 120}
                        onClick={() => handleSubmit(p.index)}
                        className="min-h-[44px] min-w-[100px] font-black uppercase tracking-wider [font-family:var(--mb-font-display)] mb-press shadow-[var(--mb-shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent-2)]"
                      >
                        {t("games.zaplash.ui.submit_btn")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="p-3 rounded-xl bg-[var(--mb-surface)] text-sm font-bold italic text-[var(--mb-gold)] border border-black/40">
                    "{textVal}"
                  </p>
                )}
              </Card>
            );
          })}

          {pub.submittedSeats.includes(seat) && (
            <Panel className="p-4 text-center rounded-xl bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-[3px] border-black shadow-[var(--mb-shadow)] mb-breathe">
              <p className="font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)]">
                ⏳ {t("games.zaplash.ui.waiting_for_others")}
              </p>
            </Panel>
          )}
        </div>
      )}

      {/* VOTE PHASE */}
      {match.phase === "vote" && pub.currentMatchup && (() => {
        const [w0, w1] = pub.currentMatchup.writers ?? [-1, -1];
        const isWriter = seat === w0 || seat === w1;
        const hasVoted = pub.currentMatchup.votedSeats.includes(seat);

        return (
          <div className="flex flex-col gap-4">
            <Panel className="p-4 rounded-xl text-center bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] -rotate-[0.5deg]">
              <span className="text-xs uppercase font-black text-[var(--mb-violet)] tracking-widest [font-family:var(--mb-font-display)]">
                {t("games.zaplash.ui.matchup_progress", {
                  current: pub.currentMatchupIndex + 1,
                  total: pub.totalMatchups,
                })}
              </span>
              <p className="font-black text-xl text-white mt-1 break-words [font-family:var(--mb-font-display)]">
                "{pub.currentMatchup.promptText}"
              </p>
            </Panel>

            {isWriter ? (
              <Card className="p-6 text-center rounded-xl bg-[var(--mb-gold)] text-black border-[3px] border-black shadow-[var(--mb-shadow-lg)] flex flex-col items-center gap-2 rotate-1 mb-pop">
                <PopcornIcon className="w-10 h-10 text-black mb-tada" />
                <p className="font-black text-lg uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.zaplash.ui.you_wrote_one")}
                </p>
              </Card>
            ) : hasVoted ? (
              <Card className="p-6 text-center rounded-xl bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] flex flex-col items-center gap-2 -rotate-1 mb-pop">
                <LockIcon className="w-10 h-10 text-[var(--mb-on-accent-2)]" />
                <p className="font-black text-lg uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.zaplash.ui.vote_locked")}
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3.5">
                {pub.currentMatchup.answers.map((ans, idx) => {
                  const label = idx === 0 ? "A" : "B";
                  return (
                    <Button
                      key={idx}
                      variant="secondary"
                      size="lg"
                      onClick={() => handleVote(idx as 0 | 1)}
                      className={cn(
                        "p-5 text-left flex flex-col items-start gap-2 min-h-[92px] rounded-xl justify-center font-black tracking-normal border-[3px] border-black shadow-[var(--mb-shadow-lg)] mb-press active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:ring-2 focus-visible:ring-[var(--mb-accent-2)] whitespace-normal break-words w-full bg-[var(--mb-surface-2)] text-white hover:bg-[var(--mb-surface-3)]",
                        idx === 0 ? "-rotate-1" : "rotate-1"
                      )}
                    >
                      <span className="text-xs font-black px-3 py-1 rounded-md bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black [font-family:var(--mb-font-display)] uppercase shadow-[2px_2px_0_0_#000]">
                        CHOICE {label}
                      </span>
                      <span className="text-lg font-black text-white break-words w-full">{ans.text}</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* REVEAL & SCOREBOARD PHASE */}
      {(match.phase === "reveal" || match.phase === "scoreboard") && (
        <Card className="p-6 text-center rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] flex flex-col items-center gap-3 mb-breathe">
          <EyeIcon className="w-12 h-12 text-[var(--mb-gold)]" />
          <p className="font-black text-xl text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.zaplash.ui.look_at_tv")}
          </p>
        </Card>
      )}

      {/* GAME OVER PHASE */}
      {isGameOver && (
        <Card className="p-6 text-center rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] flex flex-col items-center gap-3 mb-tada rotate-1">
          <FinishFlagIcon className="w-12 h-12 text-[var(--mb-gold)]" />
          <p className="font-black text-2xl text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.zaplash.ui.game_over")}
          </p>
        </Card>
      )}
    </div>
  );
}
