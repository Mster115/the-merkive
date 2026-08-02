"use client";

import * as React from "react";
import type { ControllerProps } from "@merky/game-sdk";
import { Button, Card, Panel, Pill, cn } from "@merky/ui";
import type { MerkadePrivateState, MerkadePublicState } from "./types";
import { DoodleGrid, COLOR_PALETTE, createEmptyGrid } from "./DoodleGrid";

export function MerkadeController({ room, seat, match, privateState, act, t }: ControllerProps) {
  const pub = match.publicState as MerkadePublicState | null;
  const priv = (privateState ?? {}) as MerkadePrivateState;

  const [fibText, setFibText] = React.useState("");
  const [guessText, setGuessText] = React.useState("");
  const [doodleGrid, setDoodleGrid] = React.useState<number[][]>(createEmptyGrid());
  const [activeColor, setActiveColor] = React.useState<number>(1);

  const [majorityChoice, setMajorityChoice] = React.useState<0 | 1 | null>(null);
  const [majorityPrediction, setMajorityPrediction] = React.useState<0 | 1 | null>(null);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

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

  const handleAct = async (type: string, payload?: unknown) => {
    if (pending) return;
    setErrorMessage(null);
    setPending(true);
    try {
      const res = await act(type, payload);
      if (!res.ok) {
        setErrorMessage(res.error || res.code);
      }
    } finally {
      setPending(false);
    }
  };

  const isGameOver = match.over || match.phase === "game_over";

  return (
    <div className="flex flex-col min-h-full w-full p-4 select-none justify-between gap-4 overflow-y-auto">
      {/* Accessibility live region */}
      <div className="sr-only" aria-live="polite">
        {t(`games.merkade.phase.${match.phase}`)}
      </div>

      {/* Header Info */}
      {!isGameOver && (
        <div className="flex items-center justify-between gap-2 bg-[var(--mb-surface-2)] p-3 rounded-xl border-2 border-black shadow-[var(--mb-shadow)]">
          <span className="font-black text-sm text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
            {t("games.merkade.ui.round_header", { current: pub.roundIndex + 1, total: pub.roundPlan.length })}
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

        {/* --- ROUND INTRO --- */}
        {match.phase === "round_intro" && (
          <Panel className="p-6 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black text-center flex flex-col gap-3">
            <h3 className="text-2xl font-black text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.round_ready")}
            </h3>
            <p className="text-sm font-bold text-[var(--mb-text-dim)]">
              {t("games.merkade.ui.next_round_starting")}
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
                    className="w-full min-h-[44px] pl-3 pr-14 py-2 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mb-gold)]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-[var(--mb-text-dim)]">
                    {fibText.length}/40
                  </span>
                </div>

                <Button
                  variant="primary"
                  disabled={fibText.trim().length === 0 || pending}
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
                    disabled={pending}
                    onClick={() => handleAct("submit_fib_vote", { optionIndex: idx })}
                    className={cn(
                      "min-h-[44px] p-3 rounded-xl border-2 border-black text-left font-black text-sm uppercase tracking-wider flex items-center justify-between mb-press shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)] disabled:opacity-60",
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
                "{priv.doodleWord ?? t("games.merkade.ui.fallback_doodle_word")}"
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
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
                    className="text-xs px-3 min-h-[44px]"
                  >
                    {t("games.merkade.ui.clear")}
                  </Button>
                </div>

                <Button
                  variant="primary"
                  disabled={pending}
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
                    className="w-full min-h-[44px] pl-3 pr-14 py-2 rounded-lg bg-[var(--mb-surface-3)] border-2 border-black text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mb-pink)]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-[var(--mb-text-dim)]">
                    {guessText.length}/40
                  </span>
                </div>

                <Button
                  variant="primary"
                  disabled={guessText.trim().length === 0 || pending}
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
                    disabled={pending}
                    onClick={() => handleAct("submit_guess_vote", { optionIndex: idx })}
                    className={cn(
                      "min-h-[44px] p-3 rounded-xl border-2 border-black text-left font-black text-sm uppercase tracking-wider flex items-center justify-between mb-press shadow-[2px_2px_0_0_#000] [font-family:var(--mb-font-display)] disabled:opacity-60 break-words",
                      "bg-[var(--mb-surface-3)] text-white hover:bg-[var(--mb-pink)] hover:text-black"
                    )}
                  >
                    <span className="break-words">{opt}</span>
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
                    {(pub.majorityOptions ?? [t("games.merkade.ui.default_option_a"), t("games.merkade.ui.default_option_b")]).map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMajorityChoice(idx as 0 | 1)}
                        className={cn(
                          "min-h-[48px] p-2 rounded-xl border-2 border-black font-black text-xs uppercase tracking-wider mb-press [font-family:var(--mb-font-display)] break-words",
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
                    {(pub.majorityOptions ?? [t("games.merkade.ui.default_option_a"), t("games.merkade.ui.default_option_b")]).map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMajorityPrediction(idx as 0 | 1)}
                        className={cn(
                          "min-h-[48px] p-2 rounded-xl border-2 border-black font-black text-xs uppercase tracking-wider mb-press [font-family:var(--mb-font-display)] break-words",
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
                  disabled={majorityChoice === null || majorityPrediction === null || pending}
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

        {/* --- FIB REVEAL --- */}
        {match.phase === "fib_reveal" && pub.fibReveal && (
          <div className="flex flex-col gap-3">
            <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black text-center">
              <Pill tone="gold" className="text-[0.65rem] px-2 py-0.5 font-black uppercase mb-1 [font-family:var(--mb-font-display)]">
                {t("games.merkade.ui.the_truth")}
              </Pill>
              <h3 className="text-xl font-black text-[var(--mb-accent)] uppercase tracking-tight [font-family:var(--mb-font-display)]">
                {pub.fibReveal.options[pub.fibReveal.truthIndex]}
              </h3>
            </Panel>

            <div className="flex flex-col gap-2">
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
                      "p-3 rounded-xl border-2 border-black flex items-center justify-between gap-3 text-left",
                      isTruth
                        ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] font-black"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)] break-words">
                        {opt}
                      </span>
                      {isTruth && (
                        <span className="text-[0.65rem] font-black uppercase tracking-wider text-[var(--mb-on-accent-2)]">
                          {t("games.merkade.ui.truth_badge")}
                        </span>
                      )}
                      {authorPlayer && (
                        <span className="text-[0.65rem] font-bold opacity-80 truncate">
                          {t("games.merkade.ui.fooled_by", { name: authorPlayer.displayName })}
                        </span>
                      )}
                    </div>
                    <span className="font-black text-xs [font-family:var(--mb-font-display)] shrink-0">
                      {t(votes === 1 ? "games.merkade.ui.vote_singular" : "games.merkade.ui.votes_plural", { count: votes })}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* --- DOODLE REVEAL ONE --- */}
        {match.phase === "doodle_reveal_one" && pub.doodleReveal && (
          <div className="flex flex-col gap-3">
            <Panel className="p-3 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black text-center flex flex-col items-center gap-2">
              <Pill tone="gold" className="text-[0.65rem] px-2 py-0.5 font-black uppercase [font-family:var(--mb-font-display)]">
                {t("games.merkade.ui.real_prompt")}
              </Pill>
              <h3 className="text-xl font-black text-[var(--mb-gold)] uppercase [font-family:var(--mb-font-display)]">
                {pub.doodleReveal.options[pub.doodleReveal.truthIndex]}
              </h3>
              {pub.doodleCurrentGrid && (
                <DoodleGrid grid={pub.doodleCurrentGrid} readOnly className="w-full max-w-[180px]" />
              )}
            </Panel>

            <div className="flex flex-col gap-2">
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
                      "p-3 rounded-xl border-2 border-black flex items-center justify-between gap-3 text-left",
                      isTruth
                        ? "bg-[var(--mb-gold)] text-black font-black"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-black text-sm uppercase tracking-wider [font-family:var(--mb-font-display)] break-words">
                        {opt}
                      </p>
                      {authorPlayer && (
                        <span className="text-[0.65rem] font-bold opacity-80 truncate">
                          {t("games.merkade.ui.authored_by", { name: authorPlayer.displayName })}
                        </span>
                      )}
                    </div>
                    <span className="font-black text-xs [font-family:var(--mb-font-display)] shrink-0">
                      {t(votes === 1 ? "games.merkade.ui.vote_singular" : "games.merkade.ui.votes_plural", { count: votes })}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* --- MAJORITY REVEAL --- */}
        {match.phase === "majority_reveal" && pub.majorityReveal && (
          <div className="flex flex-col gap-3">
            <Panel className="p-4 rounded-xl bg-[var(--mb-surface-2)] border-[3px] border-black text-center flex flex-col items-center gap-2">
              <Pill tone="gold" className="text-[0.65rem] px-2 py-0.5 font-black uppercase [font-family:var(--mb-font-display)]">
                {t("games.merkade.ui.majority_winner")}
              </Pill>
              <h3 className="text-2xl font-black text-[var(--mb-gold)] uppercase tracking-tight [font-family:var(--mb-font-display)]">
                {pub.majorityOptions ? pub.majorityOptions[pub.majorityReveal.majorityOptionIndex] : ""}
              </h3>
            </Panel>

            <div className="grid grid-cols-2 gap-2 w-full">
              {(pub.majorityOptions ?? ["A", "B"]).map((opt, idx) => {
                const count = pub.majorityReveal!.counts[idx as 0 | 1];
                const isWinner = idx === pub.majorityReveal!.majorityOptionIndex;
                return (
                  <Card
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl border-2 border-black flex flex-col items-center justify-center gap-1 text-center",
                      isWinner
                        ? "bg-[var(--mb-gold)] text-black font-black"
                        : "bg-[var(--mb-surface-2)] text-white"
                    )}
                  >
                    <span className="font-black text-sm uppercase [font-family:var(--mb-font-display)] break-words">
                      {opt}
                    </span>
                    <span className="font-black text-xl [font-family:var(--mb-font-display)]">
                      {t(count === 1 ? "games.merkade.ui.vote_singular" : "games.merkade.ui.votes_plural", { count })}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* --- LIVE SCORE TRACKER ON CONTROLLER --- */}
        {(match.phase === "fib_reveal" || match.phase === "doodle_reveal_one" || match.phase === "majority_reveal") && match.scores && (
          <Panel className="p-3 rounded-xl bg-[var(--mb-surface-2)] border-2 border-black flex flex-col gap-2">
            <span className="text-[0.65rem] font-black uppercase text-[var(--mb-gold)] tracking-wider text-center [font-family:var(--mb-font-display)]">
              {t("games.merkade.ui.scores_header")}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {room.seats.map((s) => {
                const score = match.scores?.[s.seatIndex] ?? 0;
                return (
                  <span
                    key={s.seatIndex}
                    className="px-2 py-1 rounded-lg bg-[var(--mb-surface-3)] text-white border border-black text-xs font-bold flex items-center gap-1"
                  >
                    <span>{s.displayName}:</span>
                    <span className="font-black text-[var(--mb-accent-2)]">{score}</span>
                  </span>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
