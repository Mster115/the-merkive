"use client";
import * as React from "react";
import Image from "next/image";
import { getGame } from "@merky/games";
import { Card, cn, CountUp, PlayerChip, Pill, sfx, SoundToggle, TimerBar } from "@merky/ui";
import { useT } from "@/i18n";
import { useRoom, type UseRoomResult } from "@/client/useRoom";
import logoImg from "@/assets/logo-purple.png";

import { PodiumCard } from "./Podium";
import { QrCode } from "./QrCode";
import { Ticker } from "./Ticker";
import {
  ByeScreen,
  CenterScreen,
  ErrorScreen,
  ReconnectOverlay,
  Spinner,
} from "./StatusScreens";

export function StageApp({ code }: { code: string }) {
  const room = useRoom(code, "stage");

  if (room.phase === "loading") {
    return (
      <CenterScreen>
        <Spinner label={code.toUpperCase()} />
      </CenterScreen>
    );
  }
  if (room.phase === "gone") return <ByeScreen reason={room.byeReason ?? "expired"} />;
  if (room.phase === "error" || !room.snapshot) return <ErrorScreen code={room.errorCode} />;

  const snap = room.snapshot;
  if (snap.room.status === "in_game" && snap.match && !snap.match.over) {
    return <StageGame room={room} />;
  }
  return <StageLobby room={room} />;
}

function StageLobby({ room }: { room: UseRoomResult }) {
  const t = useT();
  const snap = room.snapshot!;
  const game = snap.room.gameId ? getGame(snap.room.gameId) : undefined;
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${snap.room.code}` : "";
  const shortUrl = joinUrl.replace(/^https?:\/\//, "");
  const emptySeats = Math.max(0, snap.room.maxPlayers - snap.room.seats.length);

  return (
    <>
      <main className="min-h-dvh flex flex-col p-4 sm:p-8 gap-6 sm:gap-8 pb-20">
        <header className="flex items-start justify-between gap-4 sm:gap-6 mb-drop flex-wrap">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <a
                href="/"
                className="px-3.5 py-1.5 bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] hover:text-white border-2 border-black shadow-[2px_2px_0_0_#000] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all mb-press"
                title="Back to Home"
              >
                ← Home
              </a>
              <h1 className="text-3xl sm:text-5xl [font-family:var(--mb-font-display)] font-black italic uppercase tracking-tighter text-[var(--mb-violet)] leading-none inline-flex items-center gap-x-[0.45em]">
                <span className="translate-y-[-0.06em]">THE</span>
                <span className="inline-flex items-center">
                  <Image
                    src={logoImg}
                    alt="M"
                    className="inline-block h-[0.85em] w-auto object-contain -skew-x-[12deg] drop-shadow-[2px_2px_0_#000] translate-y-[-0.02em] -mr-[0.08em]"
                  />
                  <span>ERKIVE</span>
                </span>
              </h1>
              <span className="bg-black text-[var(--mb-accent-2)] border-2 border-[var(--mb-accent-2)] px-2.5 py-0.5 sm:px-3 sm:py-1 -rotate-2 text-xs sm:text-sm font-black uppercase tracking-widest">
                {t("stage.live")}
              </span>
            </div>
            {game && (
              <p className="text-base sm:text-xl font-bold text-[var(--mb-text-dim)]">
                {t(game.meta.nameKey)} — {t(game.meta.descriptionKey)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {snap.room.spectatorCount > 0 && (
              <Pill className="text-sm sm:text-base">{t("lobby.spectators", { count: snap.room.spectatorCount })}</Pill>
            )}
            <SoundToggle />
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(260px,380px)_1fr] gap-6 sm:gap-10 items-start">
          <div className="flex flex-col gap-6 items-center">
            <Card
              raised
              className="w-full bg-white text-black -rotate-1 flex flex-col items-center gap-4 p-5 sm:p-7 mb-pop"
            >
              <p className="text-xl sm:text-2xl [font-family:var(--mb-font-display)] font-black uppercase tracking-tight leading-none">
                {t("lobby.scan")}
              </p>
              <QrCode url={joinUrl} size={180} label={t("lobby.scan")} />
              <p className="text-center text-xs sm:text-sm font-bold text-neutral-600">
                {t("lobby.code.hint", { url: shortUrl })}
              </p>
            </Card>
            <div className="text-center">
              <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-[var(--mb-text-dim)] mb-1">
                {t("stage.join.code")}
              </p>
              <p className="mb-wobble text-6xl sm:text-8xl [font-family:var(--mb-font-display)] font-black italic uppercase tracking-tight leading-none text-[var(--mb-accent)] drop-shadow-[8px_8px_0_rgba(0,0,0,1)]">
                {snap.room.code}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {snap.room.lastMatch && <PodiumCard lastMatch={snap.room.lastMatch} big />}
            <section aria-label={t("lobby.players")}>
              <h2 className="text-3xl [font-family:var(--mb-font-display)] font-black italic uppercase -skew-x-6 text-[var(--mb-accent-2)] mb-4">
                {t("lobby.players")}{" "}
                <span className="text-[var(--mb-text-dim)] not-italic">
                  {snap.room.seats.length}/{snap.room.maxPlayers}
                </span>
              </h2>
              {snap.room.seats.length === 0 && (
                <p className="text-xl font-bold text-[var(--mb-text-dim)] mb-blink mb-4">
                  {t("stage.waiting")}
                </p>
              )}
              <ul className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-stagger">
                {snap.room.seats.map((s, i) => (
                  <li
                    key={s.seatIndex}
                    className={cn("mb-pop", i % 3 === 1 ? "rotate-[0.5deg]" : i % 3 === 2 ? "-rotate-[0.5deg]" : "")}
                    style={{ "--mb-i": i } as React.CSSProperties}
                  >
                    <PlayerChip
                      size="lg"
                      displayName={s.displayName}
                      avatarId={s.avatarId}
                      isHost={s.isHost}
                      connected={s.connected}
                      abandoned={s.abandoned}
                      statusLabels={{
                        offline: t("seat.offline"),
                        abandoned: t("seat.left"),
                        host: t("lobby.host"),
                      }}
                    />
                  </li>
                ))}
                {Array.from({ length: emptySeats }, (_, i) => (
                  <li
                    key={`empty-${i}`}
                    aria-hidden
                    className="min-h-16 rounded-md border-4 border-dashed border-[var(--mb-line-dim)] opacity-60 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--mb-outline)]"
                  >
                    <span className="text-lg leading-none">+</span> {t("stage.seat.empty")}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        <ReconnectOverlay connection={room.connection} />
      </main>
      <Ticker
        className="fixed bottom-0 inset-x-0 z-40"
        items={[
          t("ticker.status"),
          t("ticker.room", { code: snap.room.code }),
          t("ticker.join"),
          t("ticker.round"),
          t("ticker.stay"),
        ]}
      />
    </>
  );
}

function StageGame({ room }: { room: UseRoomResult }) {
  const t = useT();
  const snap = room.snapshot!;
  const match = snap.match!;
  const game = getGame(match.gameId);
  const phase = match.phase;

  // A soft "pop" on every phase change keeps the Stage feeling alive.
  const prevPhaseRef = React.useRef(phase);
  React.useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      prevPhaseRef.current = phase;
      sfx.play("pop");
    }
  }, [phase]);

  if (!game) return <ErrorScreen code="game_unknown" />;
  const Stage = game.ui.Stage;
  const paused =
    snap.room.seats.length > 0 && snap.room.seats.every((s) => !s.connected || s.abandoned);

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 px-8 py-4 flex items-center justify-between gap-4 bg-[var(--mb-surface)] border-b-4 border-black shadow-[0_4px_0_0_rgba(0,0,0,0.35)]">
        <span className="text-2xl [font-family:var(--mb-font-display)] font-black italic uppercase tracking-tight">
          {t(game.meta.nameKey)}
        </span>
        <div className="flex items-center gap-4 flex-1 justify-end">
          {match.timer && (
            <TimerBar
              endsAt={match.timer.endsAt}
              durationMs={match.timer.durationMs}
              now={room.now}
              label={match.timer.kind}
              sound
              className="max-w-sm flex-1"
            />
          )}
          <Pill tone="accent" className="text-lg tracking-[0.2em]">
            {snap.room.code}
          </Pill>
          <SoundToggle />
        </div>
      </header>
      {paused && (
        <p
          role="status"
          className="px-8 py-2 font-black uppercase tracking-wider text-[var(--mb-on-gold)] bg-[var(--mb-warn)] border-b-2 border-black mb-blink"
        >
          {t("game.paused")}
        </p>
      )}
      <div key={`${match.id}:${phase}`} className="flex-1 mb-rise">
        <Stage room={snap.room} match={match} t={t} now={room.now} />
      </div>
      <footer className="px-8 py-3 bg-[var(--mb-surface)] border-t-4 border-black">
        <div className="flex items-center gap-4 overflow-x-auto">
          <span className="text-sm font-black uppercase tracking-wider text-[var(--mb-text-dim)] shrink-0">
            {t("stage.scores")}
          </span>
          {[...snap.room.seats]
            .map((s) => ({ seat: s, points: match.scores[s.seatIndex] ?? 0 }))
            .sort((a, b) => b.points - a.points)
            .map(({ seat, points }, i) => (
              <span
                key={seat.seatIndex}
                className={cnFooter(i === 0 && points > 0)}
              >
                <span className="font-bold">{seat.displayName}</span>
                <span className="font-black text-[var(--mb-gold)] tabular-nums [font-family:var(--mb-font-display)]">
                  <CountUp value={points} />
                </span>
              </span>
            ))}
        </div>
      </footer>
      <ReconnectOverlay connection={room.connection} />
    </main>
  );
}

function cnFooter(leader: boolean): string {
  return [
    "flex items-center gap-2 shrink-0 rounded-sm px-3 py-1.5 border-2 bg-[var(--mb-surface-2)] transition-all duration-500",
    leader
      ? "border-[var(--mb-gold)] shadow-[3px_3px_0_0_var(--mb-gold)]"
      : "border-black shadow-[2px_2px_0_0_#000]",
  ].join(" ");
}
