"use client";

import * as React from "react";
import type { RoomView, SeatPublic, StageProps, Translate } from "@merky/game-sdk";
import { Card, ConfettiBurst, Pill, PlayerChip, cn, sfx } from "@merky/ui";
import { DecreeTrack, GridlockMeter } from "./BoardTrack";
import {
  AnarchyIcon,
  BallotIcon,
  BanishIcon,
  BossIcon,
  ChairGavelIcon,
  CommissionerBadgeIcon,
  DecreeScrollIcon,
  MerkiteIcon,
  MerkizenIcon,
  SilhouetteIcon,
  VetoIcon,
} from "./icons";
import type {
  LastBanishSummary,
  LastEnactedSummary,
  LastVoteSummary,
  MerkissionerPublicState,
  Role,
} from "./types";

function seatName(room: RoomView, seat: number | null): string {
  if (seat === null) return "?";
  return room.seats.find((s) => s.seatIndex === seat)?.displayName ?? `Seat ${seat}`;
}

function seatOf(room: RoomView, seat: number | null): SeatPublic | undefined {
  if (seat === null) return undefined;
  return room.seats.find((s) => s.seatIndex === seat);
}

function phaseAnnouncement(t: Translate, phase: string): string {
  const key = `games.merkissioner.phase.${phase}`;
  const val = t(key);
  return val === key ? "" : val;
}

type FlashMoment =
  | { kind: "vote"; data: LastVoteSummary }
  | { kind: "enacted"; data: LastEnactedSummary }
  | { kind: "anarchy"; data: LastEnactedSummary | null }
  | { kind: "banish"; data: LastBanishSummary };

/** Detects a genuinely NEW dramatic moment (never fires on mount/reconnect) and holds it briefly for a full-screen flash. */
function useFlashMoment(pub: MerkissionerPublicState | null): FlashMoment | null {
  const [flash, setFlash] = React.useState<FlashMoment | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = React.useRef<{ vote: unknown; enacted: unknown; anarchy: number; banish: unknown } | null>(null);

  React.useEffect(() => {
    if (!pub) return;
    const cur = { vote: pub.lastVote, enacted: pub.lastEnacted, anarchy: pub.anarchyCount, banish: pub.lastBanish };
    const prev = prevRef.current;
    if (prev) {
      let next: FlashMoment | null = null;
      let ms = 2400;
      if (cur.anarchy !== prev.anarchy) {
        next = { kind: "anarchy", data: pub.lastEnacted };
        ms = 3000;
      } else if (cur.banish !== prev.banish && pub.lastBanish) {
        next = { kind: "banish", data: pub.lastBanish };
        ms = 2800;
      } else if (cur.enacted !== prev.enacted && pub.lastEnacted && !pub.lastEnacted.viaAnarchy) {
        next = { kind: "enacted", data: pub.lastEnacted };
        ms = 2200;
      } else if (cur.vote !== prev.vote && pub.lastVote) {
        next = { kind: "vote", data: pub.lastVote };
        ms = 2600;
      }
      if (next) {
        setFlash(next);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setFlash(null), ms);
      }
    }
    prevRef.current = cur;
  }, [pub, pub?.lastVote, pub?.lastEnacted, pub?.anarchyCount, pub?.lastBanish]);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );
  return flash;
}

export function MerkissionerStage({ room, match, t }: StageProps) {
  const pub = match.publicState as MerkissionerPublicState | null;
  const phase = match.phase;
  const flash = useFlashMoment(pub);

  const lastVersionRef = React.useRef(match.version);
  React.useEffect(() => {
    if (match.version === lastVersionRef.current) return;
    lastVersionRef.current = match.version;
    if (match.over || phase === "game_over") {
      sfx.play("win");
    } else if (flash?.kind === "anarchy" || flash?.kind === "banish") {
      sfx.play("zap");
    } else if (flash?.kind === "enacted") {
      sfx.play("deal");
    } else if (flash?.kind === "vote") {
      sfx.play(flash.data.passed ? "pop" : "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.version]);

  if (!pub) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-2xl font-black">
        {t("games.merkissioner.name")} — {t("games.merkissioner.ui.loading")}
      </div>
    );
  }

  const isGameOver = match.over || phase === "game_over";

  return (
    <div className="relative flex flex-col h-full w-full max-w-[1800px] mx-auto p-3 md:p-6 gap-3 md:gap-4 select-none overflow-hidden">
      <div className="sr-only" aria-live="polite">
        {phaseAnnouncement(t, phase)}
      </div>

      {isGameOver ? (
        <GameOverTakeover pub={pub} room={room} t={t} />
      ) : phase === "huddle" ? (
        <HuddleView pub={pub} room={room} t={t} />
      ) : (
        <>
          <PersistentBoard pub={pub} t={t} />
          <GovernmentBanner pub={pub} room={room} t={t} />
          <PhaseHero phase={phase} pub={pub} room={room} t={t} />
          {pub.banishedSeats.length > 0 && <BanishedRow pub={pub} room={room} t={t} />}
        </>
      )}

      {flash && !isGameOver && <FlashOverlay flash={flash} room={room} t={t} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Huddle                                                               */
/* ------------------------------------------------------------------ */

function HuddleView({ pub, room, t }: { pub: MerkissionerPublicState; room: RoomView; t: Translate }) {
  const nonSpectatorSeats = room.seats;
  const readyCount = pub.readySeats.length;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-4xl md:text-7xl font-black uppercase italic text-[var(--mb-violet)] [font-family:var(--mb-font-display)] mb-neon-gold mb-wobble">
        {t("games.merkissioner.ui.huddle_title")}
      </h1>
      <p className="text-base md:text-2xl font-bold text-[var(--mb-text)] max-w-xl">
        {t("games.merkissioner.ui.huddle_instruction")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-stagger">
        {nonSpectatorSeats.map((seat, i) => (
          <span
            key={seat.seatIndex}
            className={cn(
              "mb-pop flex flex-col items-center gap-1",
              pub.readySeats.includes(seat.seatIndex) ? "text-[var(--mb-accent-2)]" : "text-[var(--mb-text-dim)]"
            )}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <SilhouetteIcon className="w-10 h-10 md:w-14 md:h-14" />
            <span className="text-xs font-black uppercase truncate max-w-20">{seat.displayName}</span>
          </span>
        ))}
      </div>
      <Pill tone="accent" className="text-sm md:text-lg px-4 py-2">
        {t("games.merkissioner.ui.ready_count", { ready: readyCount, total: nonSpectatorSeats.length })}
      </Pill>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Persistent board                                                    */
/* ------------------------------------------------------------------ */

function PersistentBoard({ pub, t }: { pub: MerkissionerPublicState; t: Translate }) {
  return (
    <Card className="flex flex-col gap-3 p-3 md:p-4 border-[3px] border-black shadow-[var(--mb-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs md:text-sm font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.ui.round_number", { number: pub.roundNumber })}
        </span>
        <div className="flex items-center gap-2">
          <Pill tone="neutral" className="gap-1 text-[0.65rem] md:text-xs">
            <DecreeScrollIcon className="w-3.5 h-3.5" />
            {t("games.merkissioner.ui.draw_pile")} {pub.drawCount}
          </Pill>
          <Pill tone="neutral" className="gap-1 text-[0.65rem] md:text-xs">
            <DecreeScrollIcon className="w-3.5 h-3.5" />
            {t("games.merkissioner.ui.discard_pile")} {pub.discardCount}
          </Pill>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-center">
        <DecreeTrack team="merkizen" enacted={pub.merkizenEnacted} board={pub.board} t={t} />
        <GridlockMeter gridlock={pub.gridlock} t={t} />
        <DecreeTrack team="merkite" enacted={pub.merkiteEnacted} board={pub.board} t={t} />
      </div>
    </Card>
  );
}

function BanishedRow({ pub, room, t }: { pub: MerkissionerPublicState; room: RoomView; t: Translate }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.65rem] font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
        {t("games.merkissioner.ui.banished_list")}:
      </span>
      {pub.banishedSeats.map((seat) => {
        const s = seatOf(room, seat);
        if (!s) return null;
        return (
          <Pill key={seat} tone="danger" className="gap-1 text-[0.65rem] opacity-80">
            <BanishIcon className="w-3 h-3" />
            {s.displayName}
          </Pill>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Government banner                                                    */
/* ------------------------------------------------------------------ */

function GovernmentBanner({ pub, room, t }: { pub: MerkissionerPublicState; room: RoomView; t: Translate }) {
  const chair = seatOf(room, pub.chairSeat);
  const nomineeOrCommissioner = pub.commissionerSeat ?? pub.nomineeSeat;
  const other = seatOf(room, nomineeOrCommissioner);
  const otherIsCommissioner = pub.commissionerSeat !== null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
      {chair && (
        <PlayerChip
          displayName={chair.displayName}
          avatarId={chair.avatarId}
          isHost={chair.isHost}
          connected={chair.connected}
          abandoned={chair.abandoned}
          highlight
          trailing={
            <Pill tone="gold" className="gap-1 text-[0.6rem]">
              <ChairGavelIcon className="w-3 h-3" />
              {t("games.merkissioner.ui.chair_label")}
            </Pill>
          }
        />
      )}
      {other && (
        <>
          <span className="text-[var(--mb-text-dim)] text-xl font-black">→</span>
          <PlayerChip
            displayName={other.displayName}
            avatarId={other.avatarId}
            isHost={other.isHost}
            connected={other.connected}
            abandoned={other.abandoned}
            highlight
            trailing={
              <Pill tone="accent" className="gap-1 text-[0.6rem]">
                <CommissionerBadgeIcon className="w-3 h-3" />
                {t(
                  otherIsCommissioner
                    ? "games.merkissioner.ui.commissioner_label"
                    : "games.merkissioner.ui.nominee_label"
                )}
              </Pill>
            }
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase-specific hero content                                         */
/* ------------------------------------------------------------------ */

function PhaseHero({
  phase,
  pub,
  room,
  t,
}: {
  phase: string;
  pub: MerkissionerPublicState;
  room: RoomView;
  t: Translate;
}) {
  if (phase === "nominate") {
    return (
      <div className="flex-1 flex items-center justify-center text-center">
        <p className="text-lg md:text-3xl font-black uppercase italic text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.ui.chair_choosing", { name: seatName(room, pub.chairSeat) })}
        </p>
      </div>
    );
  }

  if (phase === "vote") {
    const total = room.seats.filter((s) => !s.abandoned && !pub.banishedSeats.includes(s.seatIndex)).length;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <BallotIcon className="w-10 h-10 md:w-14 md:h-14 text-[var(--mb-violet)]" />
        <p className="text-lg md:text-2xl font-black uppercase text-[var(--mb-text)] [font-family:var(--mb-font-display)]">
          {t("games.merkissioner.ui.vote_prompt")}
        </p>
        <Pill tone="accent" className="text-base md:text-xl px-4 py-2 tabular-nums">
          {t("games.merkissioner.ui.ballots_in", { cast: pub.votedSeats.length, total })}
        </Pill>
      </div>
    );
  }

  if (phase === "legislative_chair" || phase === "legislative_commissioner") {
    const key =
      phase === "legislative_chair"
        ? "games.merkissioner.ui.chair_deciding_stage"
        : "games.merkissioner.ui.commissioner_deciding_stage";
    return (
      <div className="flex-1 flex items-center justify-center text-center">
        <p className="text-lg md:text-3xl font-black uppercase italic text-[var(--mb-text)] [font-family:var(--mb-font-display)] mb-wobble">
          <DecreeScrollIcon className="inline-block w-6 h-6 md:w-8 md:h-8 mr-2 -mt-1" />
          {t(key)}
        </p>
      </div>
    );
  }

  if (phase === "veto_pending") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
        <VetoIcon className="w-10 h-10 md:w-14 md:h-14 text-[var(--mb-warn)]" />
        <p className="text-xl md:text-4xl font-black uppercase italic text-[var(--mb-warn)] [font-family:var(--mb-font-display)] mb-neon-gold">
          {t("games.merkissioner.ui.veto_pending_title")}
        </p>
      </div>
    );
  }

  if (phase.startsWith("power_")) {
    const power = phase.replace("power_", "") as "audit" | "snap" | "peek" | "banish";
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
        <Pill tone="danger" className="text-base md:text-xl px-4 py-2 mb-pop">
          {t(`games.merkissioner.ui.power_banner_${power}`)}
        </Pill>
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Flash overlays — one-shot dramatic moments, self-dismissing         */
/* ------------------------------------------------------------------ */

function FlashOverlay({ flash, room, t }: { flash: FlashMoment; room: RoomView; t: Translate }) {
  if (flash.kind === "vote") {
    const v = flash.data;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/55 mb-pop">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <h2
            className={cn(
              "text-5xl md:text-8xl font-black uppercase italic [font-family:var(--mb-font-display)] mb-wobble",
              v.passed ? "text-[var(--mb-accent-2)] mb-neon-gold" : "text-[var(--mb-danger)]"
            )}
          >
            {t(v.passed ? "games.merkissioner.ui.vote_passed" : "games.merkissioner.ui.vote_failed")}
          </h2>
          <p className="text-xl md:text-3xl font-black text-white tabular-nums">
            {t("games.merkissioner.ui.vote_tally", { yeah: v.tally.yeah, nah: v.tally.nah })}
          </p>
          {v.votes && (
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mb-stagger">
              {Object.entries(v.votes).map(([seat, vote], i) => {
                const s = seatOf(room, Number(seat));
                if (!s) return null;
                return (
                  <span
                    key={seat}
                    className="mb-pop flex flex-col items-center gap-1"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <PlayerChip
                      displayName={s.displayName}
                      avatarId={s.avatarId}
                      trailing={
                        <Pill tone={vote === "yeah" ? "ok" : "danger"} className="text-[0.6rem]">
                          {t(vote === "yeah" ? "games.merkissioner.ui.vote_yeah" : "games.merkissioner.ui.vote_nah")}
                        </Pill>
                      }
                    />
                  </span>
                );
              })}
            </div>
          )}
          {v.auto && (
            <p className="text-xs md:text-sm font-bold text-[var(--mb-warn)] uppercase">
              {t("games.merkissioner.ui.vote_auto_notice")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (flash.kind === "enacted") {
    const e = flash.data;
    const isMerkite = e.type === "merkite";
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/55">
        <div
          className={cn(
            "mb-drop flex flex-col items-center gap-3 px-10 py-8 rounded-2xl border-4 border-black shadow-[var(--mb-shadow-lg)]",
            isMerkite ? "bg-[var(--mb-danger)] text-[var(--mb-on-danger)]" : "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)]"
          )}
        >
          {isMerkite ? <MerkiteIcon className="w-14 h-14" /> : <MerkizenIcon className="w-14 h-14" />}
          <p className="text-2xl md:text-5xl font-black uppercase italic [font-family:var(--mb-font-display)] text-center">
            {t(isMerkite ? "games.merkissioner.ui.decree_merkite" : "games.merkissioner.ui.decree_merkizen")}
          </p>
        </div>
      </div>
    );
  }

  if (flash.kind === "anarchy") {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none bg-[var(--mb-danger)]/90">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <AnarchyIcon className="w-16 h-16 md:w-24 md:h-24 text-black mb-blink" />
          <h2 className="text-4xl md:text-7xl font-black uppercase italic text-black [font-family:var(--mb-font-display)] -skew-x-6 mb-blink">
            {t("games.merkissioner.ui.anarchy_title")}
          </h2>
          <p className="text-base md:text-2xl font-black text-black max-w-xl">
            {t("games.merkissioner.ui.anarchy_body")}
          </p>
        </div>
      </div>
    );
  }

  // banish
  const b = flash.data;
  const target = seatOf(room, b.target);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/80">
      <div className="flex flex-col items-center gap-4 text-center px-6 mb-pop">
        <BanishIcon className="w-14 h-14 md:w-20 md:h-20 text-[var(--mb-danger)]" />
        <h2 className="text-3xl md:text-6xl font-black uppercase italic text-[var(--mb-danger)] [font-family:var(--mb-font-display)] mb-neon-pink">
          {t("games.merkissioner.ui.banished_title")}
        </h2>
        {target && (
          <span className="mb-rise">
            <PlayerChip displayName={target.displayName} avatarId={target.avatarId} size="lg" />
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Game over                                                            */
/* ------------------------------------------------------------------ */

function GameOverTakeover({ pub, room, t }: { pub: MerkissionerPublicState; room: RoomView; t: Translate }) {
  const winnerTeam = pub.winnerTeam ?? "merkizen";
  const isMerkite = winnerTeam === "merkite";
  const roles = pub.revealedRoles ?? {};
  const bossSeat = Object.entries(roles).find(([, role]) => role === "merkissioner")?.[0];
  const bossSeatObj = bossSeat !== undefined ? seatOf(room, Number(bossSeat)) : undefined;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center overflow-y-auto py-6">
      <ConfettiBurst />
      <Pill tone={isMerkite ? "danger" : "ok"} className="text-sm md:text-lg px-4 py-2 mb-pop">
        {pub.winReason ? t(`games.merkissioner.ui.win_reason.${pub.winReason}`) : ""}
      </Pill>
      <h1
        className={cn(
          "text-4xl md:text-8xl font-black uppercase italic [font-family:var(--mb-font-display)] mb-wobble",
          isMerkite ? "text-[var(--mb-danger)]" : "text-[var(--mb-accent-2)]",
          "mb-neon-gold"
        )}
      >
        {t("games.merkissioner.ui.winner_banner", {
          team: t(isMerkite ? "games.merkissioner.team.merkite" : "games.merkissioner.team.merkizen"),
        })}
      </h1>
      {bossSeatObj && (
        <p className="text-base md:text-2xl font-black text-white [font-family:var(--mb-font-display)] uppercase mb-rise">
          {t("games.merkissioner.ui.boss_reveal", { name: bossSeatObj.displayName })}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl mb-stagger">
        {room.seats.map((seat, i) => {
          const role = roles[seat.seatIndex] as Role | undefined;
          if (!role) return null;
          const tone: "accent" | "danger" | "gold" =
            role === "merkissioner" ? "gold" : role === "merkite" ? "danger" : "accent";
          const Icon = role === "merkizen" ? MerkizenIcon : role === "merkite" ? MerkiteIcon : BossIcon;
          return (
            <span
              key={seat.seatIndex}
              className="mb-flip-in"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <PlayerChip
                displayName={seat.displayName}
                avatarId={seat.avatarId}
                trailing={
                  <Pill tone={tone} className="gap-1 text-[0.6rem]">
                    <Icon className="w-3 h-3" />
                    {t(`games.merkissioner.role.${role}`)}
                  </Pill>
                }
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
