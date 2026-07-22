"use client";

import * as React from "react";
import type { ControllerProps } from "@merky/game-sdk";
import { Button, Card, Panel, Pill, cn } from "@merky/ui";
import type { MerkadePrivateState, MerkadePublicState } from "./types";
import { DoodleGrid, COLOR_PALETTE, createEmptyGrid } from "./DoodleGrid";

export function MerkadeController({ seat, match, privateState, act, t }: ControllerProps) {
  const pub = match.publicState as MerkadePublicState | null;
  const priv = (privateState ?? {}) as MerkadePrivateState;

  const [fibText, setFibText] = React.useState("");
  const [guessText, setGuessText] = React.useState("");
  const [doodleGrid, setDoodleGrid] = React.useState<number[][]>(createEmptyGrid());
  const [activeColor, setActiveColor] = React.useState<number>(1);

  const [majorityChoice, setMajorityChoice] = React.useState<0 | 1 | null>(null);
  const [majorityPrediction, setMajorityPrediction] = React.useState<0 | 1 | null>(null);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setErrorMessage(null);
  }, [match.phase, pub?.doodleSpotlightIndex]);

  if (!pub) {
    return (
      <div className="p-4 text-center text-sm font-bold text-[var(--mb-text-dim)]">
        {t("games.merkade.ui.loading")}
      </div>
    );
  }

  const handleAct = async (type: string, payload: any) => {
    setErrorMessage(null);
    const res = await act(type, payload);
    if (!res.ok) {
      setErrorMessage(res.error || res.code);
    }
  };

  const isGameOver = match.over || match.phase === "game_over";

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto p-4 select-none justify-between gap-4">
      {/* Accessibility live region */}
      <div className="sr-only" aria-live="polite">
        {t(`games.merkade.phase.${match.phase}`)}
      </div>

      {/* Header Info */}
      {!isGameOver && (
        <div className="flex items-center justify-between gap-2 bg-[var(--mb-surface-2)] p-3 rounded-xl border-2 border-black shadow-[var(--mb-shadow)]">
          <span className="font-black text-sm text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.merkade.ui.track_header", { current: pub.roundIndex + 1, total: pub.roundPlan.length })}
          </span>
          <Pill tone="neutral" className="text-xs px-2.5 py-0.5 font-black uppercase [font-family:var(--mb-font-display)]">
            {t(`games.merkade.phase.${match.phase}`)}
          </Pill>
        </div>
      )}

      {/* Main Controller Content */}
      <div className="my-auto flex flex-col gap-4">
        {/* Error message banner */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-900/80 border-2 border-red-500 text-red-100 text-xs font-bold text-center animate-shake">
            {errorMessage}
          </div>
        )}

        {/* --- TRACK INTRO --- */}
        {match.phase === "track_intro" && (
          <Panel className="p-6 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black text-center flex flex-col gap-3">
            <h3 className="text-2xl font-black text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.track_ready")}
            </h3>
            <p className="text-sm font-bold text-[var(--mb-text-dim)]">
              {t("games.merkade.ui.next_track_starting")}
            </p>
          </Panel>
        )}

        {/* --- FIB ANSWER --- */}
        {match.phase === "fib_answer" && (
          <Panel className="p-5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black flex flex-col gap-4">
            <h3 className="text-lg font-black text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)] leading-snug">
              {pub.fibFact}
            </h3>

            {priv.fibHasSubmitted ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <span className="font-black text-sm text-green-400 uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.lie_submitted")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-[var(--mb-text-dim)] uppercase tracking-wider">
                  {t("games.merkade.ui.write_fake_answer")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={40}
                    value={fibText}
                    onChange={(e) => setFibText(e.target.value)}
                    placeholder={t("games.merkade.ui.fib_placeholder")}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mb-gold)]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-[var(--mb-text-dim)]">
                    {fibText.length}/40
                  </span>
                </div>

                <Button
                  variant="primary"
                  disabled={fibText.trim().length === 0}
                  onClick={() => handleAct("submit_fib_lie", { text: fibText })}
                  className="w-full min-h-[44px] font-black uppercase [font-family:var(--mb-font-display)]"
                >
                  {t("games.merkade.ui.submit_lie")}
                </Button>
              </div>
            )}
          </Panel>
        )}

        {/* --- FIB VOTE --- */}
        {match.phase === "fib_vote" && (
          <Panel className="p-5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black flex flex-col gap-3">
            <h3 className="text-sm font-black text-[var(--mb-text-dim)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.spot_truth_prompt")}
            </h3>

            {priv.fibHasVoted ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <span className="font-black text-sm text-green-400 uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.vote_locked_in")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {(pub.fibOptions ?? []).map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAct("submit_fib_vote", { optionIndex: idx })}
                    className={cn(
                      "min-h-[44px] p-3 rounded-xl border-2 border-black text-left font-black text-sm uppercase tracking-wider flex items-center justify-between mb-press shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]",
                      "bg-[var(--mb-surface-3)] text-white hover:bg-[var(--mb-gold)] hover:text-black"
                    )}
                  >
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* --- DOODLE DRAW --- */}
        {match.phase === "doodle_draw" && (
          <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black flex flex-col gap-3">
            <div className="text-center">
              <span className="text-xs font-bold text-[var(--mb-text-dim)] uppercase tracking-wider">
                {t("games.merkade.ui.your_doodle_prompt")}
              </span>
              <h3 className="text-xl font-black text-[var(--mb-pink)] uppercase [font-family:var(--mb-font-display)]">
                "{priv.doodleWord ?? "something funny"}"
              </h3>
            </div>

            {priv.doodleHasSubmitted ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <span className="font-black text-sm text-green-400 uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.drawing_submitted")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <DoodleGrid
                  grid={doodleGrid}
                  readOnly={false}
                  activeColor={activeColor}
                  onChange={setDoodleGrid}
                  className="w-full"
                />

                {/* Palette picker */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveColor(c.id)}
                        className={cn(
                          "w-11 h-11 rounded-lg border-2 border-black transition-transform",
                          c.bgClass,
                          activeColor === c.id && "scale-110 ring-2 ring-white shadow-[2px_2px_0_0_#000]"
                        )}
                        aria-label={t(c.labelKey)}
                        aria-pressed={activeColor === c.id}
                        title={t(c.labelKey)}
                      />
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => setDoodleGrid(createEmptyGrid())}
                    className="text-xs px-3 min-h-[36px]"
                  >
                    {t("games.merkade.ui.clear")}
                  </Button>
                </div>

                <Button
                  variant="primary"
                  onClick={() => handleAct("submit_drawing", { grid: doodleGrid })}
                  className="w-full min-h-[44px] font-black uppercase [font-family:var(--mb-font-display)] mt-1"
                >
                  {t("games.merkade.ui.submit_drawing")}
                </Button>
              </div>
            )}
          </Panel>
        )}

        {/* --- DOODLE GUESS --- */}
        {match.phase === "doodle_guess" && (
          <Panel className="p-5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black flex flex-col gap-4">
            {seat === pub.doodleCurrentArtist ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <p className="font-black text-sm text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.you_are_artist")}
                </p>
              </div>
            ) : priv.doodleHasGuessed ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <span className="font-black text-sm text-green-400 uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.guess_submitted")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-[var(--mb-text-dim)] uppercase tracking-wider">
                  {t("games.merkade.ui.guess_the_drawing")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={40}
                    value={guessText}
                    onChange={(e) => setGuessText(e.target.value)}
                    placeholder={t("games.merkade.ui.guess_placeholder")}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mb-pink)]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-[var(--mb-text-dim)]">
                    {guessText.length}/40
                  </span>
                </div>

                <Button
                  variant="primary"
                  disabled={guessText.trim().length === 0}
                  onClick={() => handleAct("submit_guess", { text: guessText })}
                  className="w-full min-h-[44px] font-black uppercase [font-family:var(--mb-font-display)]"
                >
                  {t("games.merkade.ui.submit_guess")}
                </Button>
              </div>
            )}
          </Panel>
        )}

        {/* --- DOODLE VOTE --- */}
        {match.phase === "doodle_vote" && (
          <Panel className="p-5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black flex flex-col gap-3">
            {seat === pub.doodleCurrentArtist ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <p className="font-black text-sm text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.artist_waiting_vote")}
                </p>
              </div>
            ) : priv.doodleHasVoted ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <span className="font-black text-sm text-green-400 uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.vote_locked_in")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {(pub.doodleGuessOptions ?? []).map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAct("submit_guess_vote", { optionIndex: idx })}
                    className={cn(
                      "min-h-[44px] p-3 rounded-xl border-2 border-black text-left font-black text-sm uppercase tracking-wider flex items-center justify-between mb-press shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)]",
                      "bg-[var(--mb-surface-3)] text-white hover:bg-[var(--mb-pink)] hover:text-black"
                    )}
                  >
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* --- MAJORITY ANSWER --- */}
        {match.phase === "majority_answer" && (
          <Panel className="p-5 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black flex flex-col gap-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
              {pub.majorityPrompt}
            </h3>

            {priv.majorityHasSubmitted ? (
              <div className="p-4 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-center">
                <span className="font-black text-sm text-green-400 uppercase tracking-wider [font-family:var(--mb-font-display)]">
                  {t("games.merkade.ui.choice_submitted")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Step 1: Your Choice */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--mb-gold)] uppercase tracking-wider">
                    {t("games.merkade.ui.majority_step1")}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(pub.majorityOptions ?? ["Option A", "Option B"]).map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMajorityChoice(idx as 0 | 1)}
                        className={cn(
                          "min-h-[48px] p-2 rounded-xl border-2 border-black font-black text-xs uppercase tracking-wider mb-press [font-family:var(--mb-font-display)]",
                          majorityChoice === idx
                            ? "bg-[var(--mb-gold)] text-black shadow-[2px_2px_0_0_#000]"
                            : "bg-[var(--mb-surface-3)] text-white"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Predict Majority */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--mb-accent)] uppercase tracking-wider">
                    {t("games.merkade.ui.majority_step2")}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(pub.majorityOptions ?? ["Option A", "Option B"]).map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMajorityPrediction(idx as 0 | 1)}
                        className={cn(
                          "min-h-[48px] p-2 rounded-xl border-2 border-black font-black text-xs uppercase tracking-wider mb-press [font-family:var(--mb-font-display)]",
                          majorityPrediction === idx
                            ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)] shadow-[2px_2px_0_0_#000]"
                            : "bg-[var(--mb-surface-3)] text-white"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  disabled={majorityChoice === null || majorityPrediction === null}
                  onClick={() =>
                    majorityChoice !== null &&
                    majorityPrediction !== null &&
                    handleAct("submit_majority", {
                      choice: majorityChoice,
                      predictedMajority: majorityPrediction,
                    })
                  }
                  className="w-full min-h-[44px] font-black uppercase [font-family:var(--mb-font-display)] mt-2"
                >
                  {t("games.merkade.ui.submit_majority")}
                </Button>
              </div>
            )}
          </Panel>
        )}

        {/* --- REVEAL PHASES WAIT STATES --- */}
        {(match.phase === "fib_reveal" || match.phase === "doodle_reveal_one" || match.phase === "majority_reveal") && (
          <Panel className="p-6 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black text-center flex flex-col gap-2">
            <h3 className="text-xl font-black text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.look_at_tv")}
            </h3>
            <p className="text-xs font-bold text-[var(--mb-text-dim)]">
              {t("games.merkade.ui.results_revealing")}
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
