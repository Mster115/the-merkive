"use client";
import * as React from "react";
import type { RoomView } from "@merky/game-sdk";
import { gameList, getGame } from "@merky/games";
import { Button, Card, cn, Pill, GameIcon } from "@merky/ui";
import { useT } from "@/i18n";
import { api, ApiCallError } from "@/client/api";
import { SettingsFields } from "./SettingsFields";

/** Host-only: pick a game, tune house rules, start the match. */
export function LobbyControls({
  room,
  token,
  isHost,
}: {
  room: RoomView;
  token: string | null;
  isHost: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const game = room.gameId ? getGame(room.gameId) : undefined;
  const playerCount = room.seats.length;

  async function call(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiCallError ? `error.${err.code}` : "error.internal");
    } finally {
      setBusy(false);
    }
  }

  if (!isHost) {
    return (
      <Card className="flex flex-col gap-2">
        {game ? (
          <>
            <h3 className="text-lg font-black">{t(game.meta.nameKey)}</h3>
            <p className="text-sm text-[var(--mb-text-dim)] font-bold">{t(game.meta.descriptionKey)}</p>
            <Pill className="self-start">
              {t("lobby.players.range", { min: game.meta.minPlayers, max: game.meta.maxPlayers })}
            </Pill>
          </>
        ) : (
          <p className="font-bold text-[var(--mb-text-dim)]">{t("lobby.game.none")}</p>
        )}
        <p className="text-sm font-bold text-[var(--mb-accent-2)]">{t("lobby.start.waiting")}</p>
      </Card>
    );
  }

  const missing = game ? Math.max(0, game.meta.minPlayers - playerCount) : 0;
  const canStart = Boolean(game) && missing === 0 && playerCount <= (game?.meta.maxPlayers ?? 8);
  const LobbyOptions = game?.ui.LobbyOptions;

  return (
    <Card raised className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-[var(--mb-text-dim)] uppercase tracking-wider mb-2">
          {t("lobby.game.pick")}
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {gameList.map((g) => {
            const selected = room.gameId === g.meta.id;
            return (
              <button
                key={g.meta.id}
                type="button"
                aria-pressed={selected}
                disabled={busy}
                onClick={() => void call(() => api.settings(room.code, token, { gameId: g.meta.id }))}
                className={cn(
                  "text-left rounded-2xl border-2 p-3 transition-colors min-h-12",
                  selected
                    ? "border-[var(--mb-accent)] bg-[var(--mb-surface-2)]"
                    : "border-[var(--mb-line)] hover:border-[var(--mb-text-dim)]"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-black">
                    <GameIcon gameId={g.meta.id} className="w-5 h-5 text-[var(--mb-violet)] shrink-0" />
                    {t(g.meta.nameKey)}
                  </span>
                  <Pill tone={selected ? "accent" : "neutral"}>
                    {t("lobby.players.range", { min: g.meta.minPlayers, max: g.meta.maxPlayers })}
                  </Pill>
                </span>
                <span className="block text-xs font-bold text-[var(--mb-text-dim)] mt-1">
                  {t(g.meta.descriptionKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {game && LobbyOptions ? (
        <LobbyOptions
          settings={{ ...game.meta.defaultSettings, ...room.settings }}
          disabled={busy}
          t={t}
          onChange={(patch) => void call(() => api.settings(room.code, token, { settings: patch }))}
        />
      ) : game && game.meta.settingFields.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-[var(--mb-text-dim)] uppercase tracking-wider mb-2">
            {t("lobby.settings.title")}
          </h3>
          <SettingsFields
            game={game}
            settings={room.settings}
            disabled={busy}
            onChange={(patch) => void call(() => api.settings(room.code, token, { settings: patch }))}
          />
        </div>
      ) : null}

      <Button
        size="lg"
        block
        disabled={!canStart || busy}
        onClick={() => void call(() => api.start(room.code, token))}
      >
        {missing > 0 ? t("lobby.need.players", { count: missing }) : t("lobby.start")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-bold text-[var(--mb-danger)]">
          {t(error)}
        </p>
      )}
    </Card>
  );
}
