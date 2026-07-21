"use client";

import * as React from "react";
import type { ControllerProps, SeatIndex, Translate } from "@merky/game-sdk";
import { Button, Card, Panel, Pill, cn } from "@merky/ui";
import { Dial } from "./Dial";
import {
  CLUE_MAX_LEN,
  otherTeam,
  teamOf,
  type TeamId,
  type YougotitPrivateState,
  type YougotitPublicState,
} from "./logic";
import { BassIcon, DirectionArrowIcon, OracleIcon, TrebleIcon, UndercutIcon } from "./icons";

type RunAct = (type: string, payload?: unknown) => Promise<{ ok: boolean }>;

const TEAM_TONE: Record<TeamId, { text: string; bg: string; border: string; on: string }> = {
  bass: {
    text: "text-[var(--mb-accent-2)]",
    bg: "bg-[var(--mb-accent-2)]",
    border: "border-[var(--mb-accent-2)]",
    on: "text-[var(--mb-on-accent-2)]",
  },
  treble: {
    text: "text-[var(--mb-pink)]",
    bg: "bg-[var(--mb-pink)]",
    border: "border-[var(--mb-pink)]",
    on: "text-[var(--mb-on-pink)]",
  },
};

function teamLabel(t: Translate, team: TeamId): string {
  return t(team === "bass" ? "games.yougotit.team.bass" : "games.yougotit.team.treble");
}

function dialAriaLabel(t: Translate, pub: YougotitPublicState): string {
  return t("games.yougotit.ui.dial_aria", { left: pub.prompt.left, right: pub.prompt.right });
}

function nudgeLabels(t: Translate) {
  return {
    nudgeMinus5: t("games.yougotit.ui.nudge_minus5"),
    nudgeMinus1: t("games.yougotit.ui.nudge_minus1"),
    nudgePlus1: t("games.yougotit.ui.nudge_plus1"),
    nudgePlus5: t("games.yougotit.ui.nudge_plus5"),
  };
}

export function YougotitController({ room, match, seat, privateState, act, t }: ControllerProps) {
  const pub = match.publicState as YougotitPublicState | null;
  const priv = privateState as YougotitPrivateState | null;
  const phase = match.phase;

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [clueText, setClueText] = React.useState("");

  const turnNumber = pub?.turnNumber;
  React.useEffect(() => {
    setClueText("");
    setErrorMsg(null);
  }, [turnNumber]);

  if (!pub) {
    return (
      <div className="p-6 text-center font-bold">
        {t("games.yougotit.name")} — {t("games.yougotit.ui.loading")}
      </div>
    );
  }

  const myTeam = teamOf(pub, seat);
  const isOracle = pub.oracleSeat === seat;
  const opposingTeam = myTeam ? otherTeam(myTeam) : null;
  const tone = myTeam ? TEAM_TONE[myTeam] : null;
  const oracleName = room.seats.find((s) => s.seatIndex === pub.oracleSeat)?.displayName ?? "?";

  const runAct: RunAct = async (type, payload) => {
    setErrorMsg(null);
    const res = await act(type, payload);
    if (!res.ok) setErrorMsg(res.error);
    return res;
  };

  const roleLabel = !myTeam
    ? t("games.yougotit.ui.role_spectating")
    : isOracle
    ? t("games.yougotit.ui.role_oracle")
    : myTeam === pub.activeTeam
    ? t("games.yougotit.ui.role_guesser")
    : t("games.yougotit.ui.role_undercutter");

  return (
    <div className="flex flex-col min-h-full w-full max-w-md mx-auto p-3 gap-3 select-none">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {roleLabel}
      </div>

      {/* Header: team plate + role, always visible */}
      <Card
        className={cn(
          "flex items-center justify-between p-3 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] -rotate-[0.4deg]",
          tone ? tone.bg : "bg-[var(--mb-surface-2)]"
        )}
      >
        <span
          className={cn(
            "flex items-center gap-1.5 font-black uppercase text-sm [font-family:var(--mb-font-display)]",
            tone ? tone.on : "text-[var(--mb-text)]"
          )}
        >
          {myTeam === "bass" && <BassIcon className="w-4 h-4" />}
          {myTeam === "treble" && <TrebleIcon className="w-4 h-4" />}
          {myTeam ? teamLabel(t, myTeam) : t("games.yougotit.ui.role_spectating")}
        </span>
        <Pill tone={isOracle ? "gold" : "neutral"} className="text-[0.65rem] gap-1">
          {isOracle && <OracleIcon className="w-3 h-3" />}
          {roleLabel}
        </Pill>
      </Card>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 text-sm font-black bg-[var(--mb-danger)] border-2 border-black text-[var(--mb-on-danger)] rounded-xl text-center shadow-[var(--mb-shadow)] mb-shake uppercase tracking-wide [font-family:var(--mb-font-display)]"
        >
          {errorMsg}
        </div>
      )}

      {phase === "clue" && (
        <CluePhasePanel
          pub={pub}
          priv={priv}
          isOracle={isOracle}
          myTeam={myTeam}
          oracleName={oracleName}
          clueText={clueText}
          setClueText={setClueText}
          runAct={runAct}
          t={t}
        />
      )}

      {phase === "guess" && (
        <GuessPhasePanel pub={pub} priv={priv} seat={seat} isOracle={isOracle} myTeam={myTeam} runAct={runAct} t={t} />
      )}

      {phase === "steal" && (
        <StealPhasePanel
          pub={pub}
          priv={priv}
          seat={seat}
          myTeam={myTeam}
          opposingTeam={opposingTeam}
          runAct={runAct}
          t={t}
        />
      )}

      {phase === "reveal" && pub.lastTurn && <RevealPanel pub={pub} myTeam={myTeam} t={t} />}

      {(match.over || phase === "game_over") && pub.winnerTeam && (
        <GameOverPanel winnerTeam={pub.winnerTeam} myTeam={myTeam} t={t} />
      )}
    </div>
  );
}

/** Read-only dial + optional clue recap, used for every "nothing to do yet" waiting state. */
function WaitingCard({
  title,
  subtitle,
  pub,
  showPointer,
  t,
}: {
  title: string;
  subtitle?: string;
  pub: YougotitPublicState;
  showPointer?: boolean;
  t: Translate;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 p-4 border-[3px] border-black shadow-[var(--mb-shadow)]">
      <p className="text-center font-black uppercase text-base text-[var(--mb-violet)] [font-family:var(--mb-font-display)] mb-wobble">
        {title}
      </p>
      {subtitle && <p className="text-center text-xs font-bold text-[var(--mb-text-dim)]">{subtitle}</p>}
      <Dial
        pointerAngle={showPointer ? pub.pointerAngle : 90}
        interactive={false}
        revealed={false}
        size={300}
        leftLabel={pub.prompt.left}
        rightLabel={pub.prompt.right}
        labels={{ slider: dialAriaLabel(t, pub) }}
      />
      {pub.clue && (
        <p className="text-center text-lg font-black italic text-white [font-family:var(--mb-font-display)]">
          &ldquo;{pub.clue}&rdquo;
        </p>
      )}
    </Card>
  );
}

function CluePhasePanel({
  pub,
  priv,
  isOracle,
  myTeam,
  oracleName,
  clueText,
  setClueText,
  runAct,
  t,
}: {
  pub: YougotitPublicState;
  priv: YougotitPrivateState | null;
  isOracle: boolean;
  myTeam: TeamId | null;
  oracleName: string;
  clueText: string;
  setClueText: (v: string) => void;
  runAct: RunAct;
  t: Translate;
}) {
  if (isOracle) {
    const target = typeof priv?.targetAngle === "number" ? priv.targetAngle : undefined;
    const remaining = CLUE_MAX_LEN - clueText.length;
    const trimmed = clueText.trim();
    const submit = () => {
      if (!trimmed) return;
      void runAct("submit_clue", { text: trimmed });
    };
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-sm font-black uppercase text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
          {t("games.yougotit.ui.you_are_oracle")}
        </p>
        <Dial
          pointerAngle={90}
          targetAngle={target}
          revealed={target !== undefined}
          interactive={false}
          size={320}
          leftLabel={pub.prompt.left}
          rightLabel={pub.prompt.right}
          labels={{ slider: dialAriaLabel(t, pub) }}
        />
        <p className="text-center text-xs font-bold text-[var(--mb-text-dim)]">
          {t("games.yougotit.ui.target_secret_hint")}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
            {t("games.yougotit.ui.clue_prompt_title")}
          </span>
          <input
            type="text"
            value={clueText}
            maxLength={CLUE_MAX_LEN}
            onChange={(e) => setClueText(e.target.value)}
            placeholder={t("games.yougotit.ui.clue_placeholder")}
            aria-label={t("games.yougotit.ui.clue_prompt_title")}
            className="min-h-11 px-3 rounded-lg border-2 border-black bg-[var(--mb-paper)] text-black font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-[var(--mb-line-bright)]"
          />
          <span className="text-[0.65rem] font-bold text-[var(--mb-text-dim)] text-right">
            {t("games.yougotit.ui.clue_chars_left", { count: remaining })}
          </span>
        </label>
        <Button variant="primary" size="lg" block onClick={submit} disabled={trimmed.length === 0}>
          {t("games.yougotit.ui.submit_clue")}
        </Button>
      </div>
    );
  }

  return (
    <WaitingCard
      title={t("games.yougotit.ui.oracle_thinking", { name: oracleName })}
      subtitle={myTeam === pub.activeTeam ? undefined : t("games.yougotit.ui.opponent_turn_hint")}
      pub={pub}
      t={t}
    />
  );
}

function GuessPhasePanel({
  pub,
  priv,
  seat,
  isOracle,
  myTeam,
  runAct,
  t,
}: {
  pub: YougotitPublicState;
  priv: YougotitPrivateState | null;
  seat: SeatIndex;
  isOracle: boolean;
  myTeam: TeamId | null;
  runAct: RunAct;
  t: Translate;
}) {
  const isGuesser = myTeam === pub.activeTeam && !isOracle;
  const isLocked = pub.readySeats.includes(seat);

  if (isOracle) {
    const target = typeof priv?.targetAngle === "number" ? priv.targetAngle : undefined;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-sm font-black uppercase text-[var(--mb-gold)] [font-family:var(--mb-font-display)] mb-pop">
          {t("games.yougotit.ui.tension_view")}
        </p>
        <Dial
          pointerAngle={pub.pointerAngle}
          targetAngle={target}
          revealed={target !== undefined}
          interactive={false}
          size={320}
          leftLabel={pub.prompt.left}
          rightLabel={pub.prompt.right}
          labels={{ slider: dialAriaLabel(t, pub) }}
        />
        <p className="text-center text-lg font-black italic text-white [font-family:var(--mb-font-display)]">
          &ldquo;{pub.clue}&rdquo;
        </p>
      </div>
    );
  }

  if (isGuesser) {
    const onDrag = (angle: number) => {
      void runAct("move_pointer", { angle });
    };
    const lockIn = () => {
      void runAct("lock_pointer");
    };
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-lg font-black italic text-white [font-family:var(--mb-font-display)]">
          &ldquo;{pub.clue}&rdquo;
        </p>
        <Dial
          pointerAngle={pub.pointerAngle}
          interactive
          onDrag={onDrag}
          size={320}
          leftLabel={pub.prompt.left}
          rightLabel={pub.prompt.right}
          labels={{ slider: dialAriaLabel(t, pub), ...nudgeLabels(t) }}
        />
        <p className="text-center text-xs font-bold text-[var(--mb-text-dim)]">
          {t("games.yougotit.ui.drag_instructions")}
        </p>
        <Button variant={isLocked ? "secondary" : "primary"} size="lg" block onClick={lockIn} disabled={isLocked}>
          {isLocked ? t("games.yougotit.ui.locked_in") : t("games.yougotit.ui.lock_it_in")}
        </Button>
        {isLocked && (
          <p className="text-center text-[0.7rem] font-bold text-[var(--mb-text-dim)]">
            {t("games.yougotit.ui.change_mind_hint")}
          </p>
        )}
      </div>
    );
  }

  return (
    <WaitingCard
      title={t("games.yougotit.ui.guess_in_progress")}
      subtitle={t("games.yougotit.ui.pointer_readout", { angle: pub.pointerAngle })}
      pub={pub}
      showPointer
      t={t}
    />
  );
}

function StealPhasePanel({
  pub,
  priv,
  seat,
  myTeam,
  opposingTeam,
  runAct,
  t,
}: {
  pub: YougotitPublicState;
  priv: YougotitPrivateState | null;
  seat: SeatIndex;
  myTeam: TeamId | null;
  opposingTeam: TeamId | null;
  runAct: RunAct;
  t: Translate;
}) {
  const isUndercutter = myTeam !== null && myTeam === opposingTeam;
  const hasVoted = pub.stealVotedSeats.includes(seat);
  const myVote = priv?.undercutDir ?? null;

  if (isUndercutter) {
    const vote = (dir: "left" | "right") => {
      void runAct("guess_direction", { dir });
    };
    return (
      <div className="flex flex-col gap-3">
        <Panel className="flex items-center justify-center gap-2 p-3 border-2 border-black bg-[var(--mb-danger)] text-[var(--mb-on-danger)] mb-pop">
          <UndercutIcon className="w-6 h-6" />
          <span className="font-black uppercase [font-family:var(--mb-font-display)]">
            {t("games.yougotit.ui.undercut_title")}
          </span>
        </Panel>
        <p className="text-center text-sm font-bold text-[var(--mb-text-dim)]">
          {t("games.yougotit.ui.undercut_body", { angle: pub.pointerAngle })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => vote("left")}
            aria-pressed={myVote === "left"}
            aria-label={t("games.yougotit.ui.undercut_left")}
            className={cn(
              "min-h-20 rounded-xl border-[3px] border-black flex flex-col items-center justify-center gap-1 font-black uppercase [font-family:var(--mb-font-display)] transition-all mb-press",
              myVote === "left"
                ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)] shadow-[var(--mb-shadow)]"
                : "bg-[var(--mb-surface-2)] text-[var(--mb-text)] shadow-[2px_2px_0_0_#000]"
            )}
          >
            <DirectionArrowIcon dir="left" className="w-8 h-8" />
            {t("games.yougotit.ui.undercut_left")}
          </button>
          <button
            type="button"
            onClick={() => vote("right")}
            aria-pressed={myVote === "right"}
            aria-label={t("games.yougotit.ui.undercut_right")}
            className={cn(
              "min-h-20 rounded-xl border-[3px] border-black flex flex-col items-center justify-center gap-1 font-black uppercase [font-family:var(--mb-font-display)] transition-all mb-press",
              myVote === "right"
                ? "bg-[var(--mb-accent)] text-[var(--mb-on-accent)] shadow-[var(--mb-shadow)]"
                : "bg-[var(--mb-surface-2)] text-[var(--mb-text)] shadow-[2px_2px_0_0_#000]"
            )}
          >
            <DirectionArrowIcon dir="right" className="w-8 h-8" />
            {t("games.yougotit.ui.undercut_right")}
          </button>
        </div>
        {hasVoted && (
          <p className="text-center text-xs font-bold text-[var(--mb-accent-2)] uppercase [font-family:var(--mb-font-display)]">
            {t("games.yougotit.ui.undercut_locked")}
          </p>
        )}
      </div>
    );
  }

  return (
    <WaitingCard
      title={t("games.yougotit.ui.undercut_waiting")}
      subtitle={t("games.yougotit.ui.pointer_readout", { angle: pub.pointerAngle })}
      pub={pub}
      showPointer
      t={t}
    />
  );
}

function RevealPanel({ pub, myTeam, t }: { pub: YougotitPublicState; myTeam: TeamId | null; t: Translate }) {
  const turn = pub.lastTurn;
  if (!turn) return null;
  const tone = myTeam ? TEAM_TONE[myTeam] : null;

  let headline: string;
  if (myTeam === turn.activeTeam) {
    headline =
      turn.points === 4
        ? t("games.yougotit.ui.reveal_bullseye")
        : turn.points > 0
        ? t("games.yougotit.ui.reveal_points", { points: turn.points })
        : t("games.yougotit.ui.reveal_miss");
  } else if (myTeam && turn.undercut?.toTeam === myTeam) {
    headline = t("games.yougotit.ui.reveal_undercut_won", { team: teamLabel(t, myTeam) });
  } else if (myTeam && myTeam !== turn.activeTeam && turn.undercut) {
    headline = t("games.yougotit.ui.reveal_undercut_whiffed");
  } else {
    headline =
      turn.points > 0
        ? t("games.yougotit.ui.reveal_points", { points: turn.points })
        : t("games.yougotit.ui.reveal_miss");
  }

  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-2 p-5 border-[3px] border-black shadow-[var(--mb-shadow)] mb-pop text-center",
        tone ? tone.bg : "bg-[var(--mb-surface-2)]"
      )}
    >
      <p
        className={cn(
          "text-2xl font-black uppercase italic [font-family:var(--mb-font-display)]",
          tone ? tone.on : "text-white"
        )}
      >
        {headline}
      </p>
      <p className={cn("text-sm font-bold", tone ? tone.on : "text-[var(--mb-text-dim)]")}>
        {t("games.yougotit.ui.reveal_target", { angle: turn.targetAngle })}
      </p>
    </Card>
  );
}

function GameOverPanel({
  winnerTeam,
  myTeam,
  t,
}: {
  winnerTeam: TeamId;
  myTeam: TeamId | null;
  t: Translate;
}) {
  const won = myTeam === winnerTeam;
  const tone = TEAM_TONE[winnerTeam];
  return (
    <Card
      raised
      className={cn(
        "flex flex-col items-center gap-2 p-6 border-4 border-black shadow-[var(--mb-shadow-lg)] mb-pop text-center",
        tone.bg
      )}
    >
      {winnerTeam === "bass" ? (
        <BassIcon className={cn("w-12 h-12", tone.on)} />
      ) : (
        <TrebleIcon className={cn("w-12 h-12", tone.on)} />
      )}
      <p className={cn("text-3xl font-black uppercase italic [font-family:var(--mb-font-display)]", tone.on)}>
        {myTeam === null
          ? t("games.yougotit.ui.game_over_title")
          : won
          ? t("games.yougotit.ui.victory")
          : t("games.yougotit.ui.defeat")}
      </p>
      <p className={cn("text-sm font-bold uppercase [font-family:var(--mb-font-display)]", tone.on)}>
        {t("games.yougotit.ui.winner_banner", { team: teamLabel(t, winnerTeam) })}
      </p>
    </Card>
  );
}
