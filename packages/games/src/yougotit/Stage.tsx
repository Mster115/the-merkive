"use client";

import * as React from "react";
import type { StageProps, Translate, RoomView } from "@merky/game-sdk";
import { Card, Panel, Pill, PlayerChip, ConfettiBurst, CountUp, cn, sfx } from "@merky/ui";
import { Dial } from "./Dial";
import { otherTeam, type LastTurnSummary, type TeamId, type YougotitPublicState } from "./logic";
import { BassIcon, OracleIcon, SparkleIcon, TargetIcon, TrebleIcon, UndercutIcon } from "./icons";

const TEAM_TONE: Record<TeamId, { text: string; bg: string; border: string }> = {
  bass: { text: "text-[var(--mb-accent-2)]", bg: "bg-[var(--mb-accent-2)]", border: "border-[var(--mb-accent-2)]" },
  treble: { text: "text-[var(--mb-pink)]", bg: "bg-[var(--mb-pink)]", border: "border-[var(--mb-pink)]" },
};

function teamLabel(t: Translate, team: TeamId): string {
  return t(team === "bass" ? "games.yougotit.team.bass" : "games.yougotit.team.treble");
}

function phaseAnnouncement(t: Translate, phase: string): string {
  switch (phase) {
    case "clue":
      return t("games.yougotit.phase.clue");
    case "guess":
      return t("games.yougotit.phase.guess");
    case "steal":
      return t("games.yougotit.phase.steal");
    case "reveal":
      return t("games.yougotit.phase.reveal");
    case "game_over":
      return t("games.yougotit.phase.game_over");
    default:
      return "";
  }
}

export function YougotitStage({ room, match, t }: StageProps) {
  const pub = match.publicState as YougotitPublicState | null;
  const phase = match.phase;

  const lastVersionRef = React.useRef(match.version);
  React.useEffect(() => {
    if (match.version !== lastVersionRef.current) {
      lastVersionRef.current = match.version;
      if (phase === "reveal") sfx.play("zap");
      if (phase === "game_over") sfx.play("win");
    }
  }, [match.version, phase]);

  if (!pub) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-2xl font-black">
        {t("games.yougotit.name")} — {t("games.yougotit.ui.loading")}
      </div>
    );
  }

  const isReveal = phase === "reveal" || phase === "game_over";
  const isGameOver = match.over || phase === "game_over";
  const oracleSeat = room.seats.find((s) => s.seatIndex === pub.oracleSeat);

  return (
    <div className="flex flex-col h-full w-full max-w-[1800px] mx-auto p-4 md:p-6 gap-4 select-none">
      <div className="sr-only" aria-live="polite">
        {phaseAnnouncement(t, phase)}
      </div>

      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--mb-surface-2)] px-4 py-3 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] -rotate-[0.3deg]">
        <Pill tone="accent" className="text-sm px-3 py-1.5 border-2 border-black shadow-[2px_2px_0_0_#000]">
          {t("games.yougotit.ui.turn_number", { number: pub.turnNumber })}
        </Pill>
        <div className="flex items-center gap-2 text-sm font-black uppercase text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
          <TargetIcon className="w-4 h-4 text-[var(--mb-gold)]" />
          {t("games.yougotit.ui.points_to_win", { target: pub.targetScore })}
        </div>
      </div>

      {/* Hero grid: Bass rail | dial stage | Treble rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 flex-1 items-center min-h-0">
        <TeamRail team="bass" pub={pub} room={room} t={t} />

        <div className="flex flex-col items-center gap-3 min-h-0 w-full">
          <div className="min-h-[64px] flex items-center justify-center w-full">
            {phase === "clue" ? (
              <div className="flex items-center gap-2 text-lg md:text-2xl font-black uppercase text-[var(--mb-violet)] [font-family:var(--mb-font-display)] italic mb-wobble text-center">
                <SparkleIcon className="w-6 h-6 shrink-0" />
                {t("games.yougotit.ui.oracle_thinking", { name: oracleSeat?.displayName ?? "?" })}
              </div>
            ) : pub.clue ? (
              <div
                key={pub.turnNumber}
                className="mb-wobble text-2xl md:text-4xl font-black uppercase italic text-center text-[var(--mb-text)] [font-family:var(--mb-font-display)]"
              >
                &ldquo;{pub.clue}&rdquo;
                {pub.clueWasAuto && (
                  <span className="block text-xs not-italic font-bold text-[var(--mb-warn)] mt-1 normal-case tracking-normal">
                    {t("games.yougotit.ui.auto_clue_notice")}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {phase === "steal" && <UndercutBanner pub={pub} t={t} />}

          <Dial
            pointerAngle={pub.pointerAngle}
            targetAngle={pub.targetAngle}
            revealed={isReveal}
            size={620}
            leftLabel={pub.prompt.left}
            rightLabel={pub.prompt.right}
            interactive={false}
            labels={{
              slider: t("games.yougotit.ui.dial_aria", { left: pub.prompt.left, right: pub.prompt.right }),
            }}
          />

          {phase === "guess" && (
            <ReadyRow pub={pub} room={room} t={t} />
          )}

          {phase === "reveal" && pub.lastTurn && <RevealStrip turn={pub.lastTurn} t={t} />}
        </div>

        <TeamRail team="treble" pub={pub} room={room} t={t} />
      </div>

      {isGameOver && pub.winnerTeam && <GameOverOverlay pub={pub} winnerTeam={pub.winnerTeam} t={t} />}
    </div>
  );
}

function TeamRail({
  team,
  pub,
  room,
  t,
}: {
  team: TeamId;
  pub: YougotitPublicState;
  room: RoomView;
  t: Translate;
}) {
  const tone = TEAM_TONE[team];
  const Icon = team === "bass" ? BassIcon : TrebleIcon;
  const seats = pub.teams[team];
  const isActive = pub.activeTeam === team;
  const score = pub.teamScores[team];
  const segments = Math.max(pub.targetScore, 1);

  return (
    <Card
      raised={isActive}
      className={cn(
        "flex flex-col gap-3 p-4 transition-all",
        isActive ? cn("border-4", tone.border) : "border-[3px] border-black opacity-90"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-black uppercase [font-family:var(--mb-font-display)]",
            tone.text
          )}
        >
          <Icon className="w-5 h-5" />
          {teamLabel(t, team)}
        </span>
        <span className="text-3xl font-black [font-family:var(--mb-font-display)] text-white tabular-nums">
          <CountUp value={score} />
        </span>
      </div>

      <div className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className={cn("h-2.5 flex-1 rounded-sm border border-black", i < score ? tone.bg : "bg-[var(--mb-surface-3)]")}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {seats.map((seatIndex) => {
          const seat = room.seats.find((s) => s.seatIndex === seatIndex);
          if (!seat) return null;
          const isOracle = pub.oracleSeat === seatIndex;
          const isReady = pub.readySeats.includes(seatIndex);
          return (
            <PlayerChip
              key={seatIndex}
              displayName={seat.displayName}
              avatarId={seat.avatarId}
              isHost={seat.isHost}
              connected={seat.connected}
              abandoned={seat.abandoned}
              highlight={isOracle}
              trailing={
                isOracle ? (
                  <Pill tone="gold" className="px-1.5 py-0.5 text-[0.6rem] gap-1">
                    <OracleIcon className="w-3 h-3" />
                    {t("games.yougotit.oracle")}
                  </Pill>
                ) : isActive && isReady ? (
                  <span
                    className="text-[var(--mb-accent-2)] text-base font-black"
                    role="img"
                    aria-label={t("games.yougotit.ui.locked_in")}
                  >
                    ✓
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </Card>
  );
}

function ReadyRow({ pub, room, t }: { pub: YougotitPublicState; room: RoomView; t: Translate }) {
  const total = pub.teams[pub.activeTeam].filter((seatIndex) => {
    if (seatIndex === pub.oracleSeat) return false;
    const seat = room.seats.find((s) => s.seatIndex === seatIndex);
    return seat && !seat.abandoned;
  }).length;
  return (
    <div className="text-sm font-black uppercase tracking-wide text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
      {t("games.yougotit.ui.teammates_ready", { ready: pub.readySeats.length, total })}
    </div>
  );
}

function UndercutBanner({ pub, t }: { pub: YougotitPublicState; t: Translate }) {
  return (
    <Panel className="flex items-center gap-3 px-4 py-2 border-2 border-black bg-[var(--mb-danger)] text-[var(--mb-on-danger)] mb-pop -rotate-1">
      <UndercutIcon className="w-6 h-6" />
      <span className="font-black uppercase text-lg [font-family:var(--mb-font-display)]">
        {t("games.yougotit.ui.undercut_title")}
      </span>
      <span className="font-black text-xl tabular-nums ml-2">
        {t("games.yougotit.ui.undercut_votes", { left: pub.stealVotes.left, right: pub.stealVotes.right })}
      </span>
    </Panel>
  );
}

function RevealStrip({ turn, t }: { turn: LastTurnSummary; t: Translate }) {
  const bullseye = turn.points === 4;
  const nextTeam = turn.catchUp ? turn.activeTeam : otherTeam(turn.activeTeam);
  return (
    <div className="flex flex-col items-center gap-2 mb-rise">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Pill tone={turn.points > 0 ? "gold" : "danger"} className="text-lg px-4 py-1.5">
          {turn.points > 0
            ? t("games.yougotit.ui.reveal_points", { points: turn.points })
            : t("games.yougotit.ui.reveal_miss")}
        </Pill>
        {bullseye && (
          <Pill tone="accent" className="mb-wobble">
            {t("games.yougotit.ui.reveal_bullseye")}
          </Pill>
        )}
        {turn.undercut && (
          <Pill tone={turn.undercut.awarded ? "danger" : "neutral"}>
            {turn.undercut.awarded && turn.undercut.toTeam
              ? t("games.yougotit.ui.reveal_undercut_won", { team: teamLabel(t, turn.undercut.toTeam) })
              : t("games.yougotit.ui.reveal_undercut_whiffed")}
          </Pill>
        )}
        {turn.catchUp && (
          <Pill tone="warn" className="mb-wobble">
            {t("games.yougotit.ui.catch_up_banner", { team: teamLabel(t, turn.activeTeam) })}
          </Pill>
        )}
      </div>
      <span className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
        {t("games.yougotit.ui.next_up", { team: teamLabel(t, nextTeam) })}
      </span>
    </div>
  );
}

function GameOverOverlay({
  pub,
  winnerTeam,
  t,
}: {
  pub: YougotitPublicState;
  winnerTeam: TeamId;
  t: Translate;
}) {
  const tone = TEAM_TONE[winnerTeam];
  const Icon = winnerTeam === "bass" ? BassIcon : TrebleIcon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85">
      <ConfettiBurst />
      <Card
        raised
        className="max-w-md w-full p-8 text-center flex flex-col items-center gap-4 border-4 border-black bg-[var(--mb-surface)] shadow-[var(--mb-shadow-lg)] mb-pop"
      >
        <Icon className={cn("w-20 h-20", tone.text)} />
        <h2 className={cn("text-4xl font-black uppercase italic [font-family:var(--mb-font-display)]", tone.text)}>
          {t("games.yougotit.ui.winner_banner", { team: teamLabel(t, winnerTeam) })}
        </h2>
        <p className="text-lg font-black text-white uppercase [font-family:var(--mb-font-display)] tabular-nums">
          {pub.teamScores.bass} — {pub.teamScores.treble}
        </p>
      </Card>
    </div>
  );
}
