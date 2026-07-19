"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { ControllerProps, GameModule, SeatIndex } from "@merky/game-sdk";
import { getGame } from "@merky/games";
import { Button, Card, Modal, PlayerChip, Pill, ScoreBoard, TimerBar } from "@merky/ui";
import { useT } from "@/i18n";
import { useRoom, type UseRoomResult } from "@/client/useRoom";
import { api } from "@/client/api";
import { getPrefs, setPrefs } from "@/client/session";
import { AvatarPicker } from "./AvatarPicker";
import { LobbyControls } from "./LobbyControls";
import { PodiumCard } from "./Podium";
import {
  ByeScreen,
  CenterScreen,
  ErrorScreen,
  ReconnectOverlay,
  Spinner,
} from "./StatusScreens";

export function ControllerApp({
  code,
  forceNewSeat = false,
}: {
  code: string;
  forceNewSeat?: boolean;
}) {
  const room = useRoom(code, "controller");
  const t = useT();
  const [wantNewSeat, setWantNewSeat] = React.useState(forceNewSeat);

  // One-shot: forget ?new=1 so reloads of this tab behave normally.
  React.useEffect(() => {
    if (!forceNewSeat) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.toString());
  }, [forceNewSeat]);

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
  const seated = snap.you.seatIndex !== null;
  const joined = seated || room.token !== null;

  if (!joined || wantNewSeat) {
    return (
      <JoinGate
        room={room}
        fresh={wantNewSeat}
        onJoined={() => setWantNewSeat(false)}
        onResume={joined ? () => setWantNewSeat(false) : undefined}
      />
    );
  }

  if (snap.room.status === "in_game" && snap.match && !snap.match.over) {
    return seated ? <SeatedGame room={room} /> : <SpectatorGame room={room} />;
  }
  return <ControllerLobby room={room} />;
}

/* ------------------------------------------------------------------ */

function JoinGate({
  room,
  fresh = false,
  onJoined,
  onResume,
}: {
  room: UseRoomResult;
  fresh?: boolean;
  onJoined?: () => void;
  onResume?: () => void;
}) {
  const t = useT();
  const [name, setName] = React.useState("");
  const [avatarId, setAvatarId] = React.useState("fox");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (fresh) return; // a new local player picks their own name
    const prefs = getPrefs();
    if (prefs.name) setName(prefs.name);
    setAvatarId(prefs.avatarId);
  }, [fresh]);

  const ready = name.trim().length > 0;
  const code = room.snapshot?.room.code ?? "";

  async function handleJoin(role: "player" | "spectator") {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setPrefs(name.trim(), avatarId);
    const res = await room.join({ name: name.trim(), avatarId, role, fresh });
    if (res.ok) {
      onJoined?.();
    } else {
      setError(`error.${res.code}`);
      setBusy(false);
    }
  }

  return (
    <CenterScreen className="mb-scanlines">
      <Card raised className="w-full flex flex-col gap-4 -rotate-[0.4deg]">
        <div className="text-center">
          <p className="inline-block bg-[var(--mb-pink-deep)] text-[var(--mb-pink)] border-2 border-black shadow-[2px_2px_0_0_#000] px-3 py-1 text-xs font-black uppercase tracking-[0.2em] -rotate-1">
            {t("home.code.label")}
          </p>
          <p className="mt-2 text-5xl [font-family:var(--mb-font-display)] font-black italic uppercase tracking-[0.2em] text-[var(--mb-violet)] leading-none">
            {code}
          </p>
        </div>
        <label className="flex flex-col gap-1.5 text-left">
          <span className="text-xs font-black uppercase tracking-widest text-[var(--mb-violet)]">
            {t("home.name.label")}
          </span>
          <span className="relative">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("home.name.placeholder")}
              maxLength={16}
              autoComplete="nickname"
              className="w-full min-h-13 rounded-md bg-white text-black border-[3px] border-black px-4 text-lg font-extrabold placeholder:text-neutral-400 outline-none focus:border-[var(--mb-accent-2)] shadow-[var(--mb-shadow)]"
            />
            {!ready && (
              <span
                aria-hidden
                className="absolute -top-2.5 -right-2 rotate-6 bg-[var(--mb-danger)] text-[var(--mb-on-danger)] border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              >
                {t("home.name.required")}
              </span>
            )}
          </span>
        </label>
        <AvatarPicker value={avatarId} onChange={setAvatarId} label={t("home.avatar.label")} />
        <Button variant="secondary" size="lg" block disabled={!ready || busy} onClick={() => void handleJoin("player")}>
          {t("home.join.cta")}
        </Button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => void handleJoin("spectator")}
          className="text-sm font-bold text-[var(--mb-text-dim)] underline underline-offset-4 min-h-11 disabled:opacity-40"
        >
          {t("home.join.watch")}
        </button>
        {onResume && (
          <button
            type="button"
            onClick={onResume}
            className="text-sm font-bold text-[var(--mb-accent-2)] underline underline-offset-4 min-h-11"
          >
            {t("join.resume")}
          </button>
        )}
        {error && (
          <p role="alert" className="text-center font-bold text-[var(--mb-danger)]">
            {t(error)}
          </p>
        )}
      </Card>
    </CenterScreen>
  );
}

/* ------------------------------------------------------------------ */

function ControllerLobby({ room }: { room: UseRoomResult }) {
  const t = useT();
  const router = useRouter();
  const snap = room.snapshot!;
  const you = snap.you.seatIndex;
  const isHost = you !== null && snap.room.hostSeat === you;
  const [copied, setCopied] = React.useState(false);

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${snap.room.code}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <main className="mx-auto max-w-md flex flex-col gap-4 p-4 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              void room.leave().then(() => router.push("/"));
            }}
            className="px-2.5 py-1 bg-[var(--mb-surface-2)] text-[var(--mb-text-dim)] hover:text-white border-2 border-black shadow-[2px_2px_0_0_#000] rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all mb-press"
            title="Back to Home"
          >
            ← Home
          </a>
          <h1 className="text-2xl font-black">{t("lobby.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          {snap.room.spectatorCount > 0 && (
            <Pill>{t("lobby.spectators", { count: snap.room.spectatorCount })}</Pill>
          )}
          <Pill tone="accent" className="tracking-[0.2em] text-sm">
            {snap.room.code}
          </Pill>
        </div>
      </header>

      {snap.room.lastMatch && <PodiumCard lastMatch={snap.room.lastMatch} />}

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-black">
            {t("lobby.players")}{" "}
            <span className="text-[var(--mb-text-dim)]">
              {snap.room.seats.length}/{snap.room.maxPlayers}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="text-sm font-bold text-[var(--mb-accent-2)] underline underline-offset-4 min-h-11"
          >
            {copied ? t("common.copied") : t("lobby.invite")}
          </button>
        </div>
        <ul className="flex flex-col gap-1.5 mb-stagger">
          {snap.room.seats.map((s, i) => (
            <li key={s.seatIndex} className="mb-pop" style={{ "--mb-i": i } as React.CSSProperties}>
              <PlayerChip
                displayName={s.seatIndex === you ? `${s.displayName} ✦` : s.displayName}
                avatarId={s.avatarId}
                isHost={s.isHost}
                connected={s.connected}
                abandoned={s.abandoned}
                statusLabels={{
                  offline: t("seat.offline"),
                  abandoned: t("seat.left"),
                  host: t("lobby.host"),
                }}
                trailing={
                  isHost && s.seatIndex !== you ? (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`${t("lobby.makeHost")}: ${s.displayName}`}
                        onClick={() =>
                          void api.transferHost(snap.room.code, room.token, s.seatIndex).catch(() => undefined)
                        }
                        className="w-9 h-9 rounded-lg bg-[var(--mb-surface)] hover:bg-[var(--mb-line)]"
                        title={t("lobby.makeHost")}
                      >
                        👑
                      </button>
                      <button
                        type="button"
                        aria-label={`${t("lobby.kick")}: ${s.displayName}`}
                        onClick={() =>
                          void api.kick(snap.room.code, room.token, s.seatIndex).catch(() => undefined)
                        }
                        className="w-9 h-9 rounded-lg bg-[var(--mb-surface)] hover:bg-[var(--mb-danger)]"
                        title={t("lobby.kick")}
                      >
                        ✕
                      </button>
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
        <p className="text-xs font-bold text-[var(--mb-text-dim)]">
          {t("lobby.stage.hint")}{" "}
          <a
            href={`/stage/${snap.room.code}`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--mb-accent-2)] underline underline-offset-4"
          >
            {t("lobby.stage.open")}
          </a>
        </p>
        <a
          href={`/play/${snap.room.code}?new=1`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold text-[var(--mb-text-dim)] underline underline-offset-4"
        >
          {t("lobby.addLocal")}
        </a>
      </Card>

      <LobbyControls room={snap.room} token={room.token} isHost={isHost} />

      <button
        type="button"
        onClick={() => {
          void room.leave().then(() => router.push("/"));
        }}
        className="min-h-11 text-sm font-bold text-[var(--mb-text-dim)] underline underline-offset-4"
      >
        {t("lobby.leave")}
      </button>
      <ReconnectOverlay connection={room.connection} />
    </main>
  );
}

/* ------------------------------------------------------------------ */

function GameChrome({
  room,
  children,
  game,
}: {
  room: UseRoomResult;
  game: GameModule;
  children: React.ReactNode;
}) {
  const t = useT();
  const snap = room.snapshot!;
  const you = snap.you.seatIndex;
  const isHost = you !== null && snap.room.hostSeat === you;
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const match = snap.match!;
  const paused = snap.room.seats.length > 0 && snap.room.seats.every((s) => !s.connected || s.abandoned);

  return (
    <div className="mx-auto max-w-md min-h-dvh flex flex-col">
      <header className="mb-glass sticky top-0 z-30 bg-[var(--mb-bg)]/80 px-4 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-black">{t(game.meta.nameKey)}</span>
          <span className="flex items-center gap-2">
            <Pill tone="accent" className="tracking-[0.2em]">
              {snap.room.code}
            </Pill>
            {isHost && (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="text-xs font-bold text-[var(--mb-text-dim)] underline underline-offset-4 min-h-9"
              >
                {t("game.endMatch")}
              </button>
            )}
          </span>
        </div>
        {match.timer && (
          <TimerBar
            endsAt={match.timer.endsAt}
            durationMs={match.timer.durationMs}
            now={room.now}
            label={match.timer.kind}
          />
        )}
        {paused && (
          <p role="status" className="text-xs font-bold text-[var(--mb-warn)]">
            {t("game.paused")}
          </p>
        )}
      </header>
      <div key={`${match.id}:${match.phase}`} className="flex-1 flex flex-col mb-rise">
        {children}
      </div>
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title={t("game.endMatch")}>
        <p className="font-bold mb-4">{t("game.endMatch.confirm")}</p>
        <div className="flex gap-2">
          <Button variant="ghost" block onClick={() => setConfirmEnd(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            block
            onClick={() => {
              setConfirmEnd(false);
              void api.endMatch(snap.room.code, room.token).catch(() => undefined);
            }}
          >
            {t("common.confirm")}
          </Button>
        </div>
      </Modal>
      <ReconnectOverlay connection={room.connection} />
    </div>
  );
}

function SeatedGame({ room }: { room: UseRoomResult }) {
  const snap = room.snapshot!;
  const match = snap.match!;
  const game = getGame(match.gameId);
  const t = useT();
  if (!game) return <ErrorScreen code="game_unknown" />;
  const Controller = game.ui.Controller;
  const props: ControllerProps = {
    room: snap.room,
    match,
    seat: snap.you.seatIndex as SeatIndex,
    privateState: snap.you.privateState,
    act: room.act,
    t,
    now: room.now,
  };
  return (
    <GameChrome room={room} game={game}>
      <Controller {...props} />
    </GameChrome>
  );
}

function SpectatorGame({ room }: { room: UseRoomResult }) {
  const snap = room.snapshot!;
  const match = snap.match!;
  const game = getGame(match.gameId);
  const t = useT();
  if (!game) return <ErrorScreen code="game_unknown" />;
  const Stage = game.ui.Stage;
  return (
    <GameChrome room={room} game={game}>
      <Stage room={snap.room} match={match} t={t} now={room.now} />
      <div className="p-4">
        <ScoreBoard
          compact
          pointsLabel={t("common.pts")}
          rows={snap.room.seats.map((s) => ({
            seatIndex: s.seatIndex,
            displayName: s.displayName,
            avatarId: s.avatarId,
            points: match.scores[s.seatIndex] ?? 0,
            abandoned: s.abandoned,
          }))}
        />
      </div>
    </GameChrome>
  );
}
