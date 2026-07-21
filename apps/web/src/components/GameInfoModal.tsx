"use client";
import { Modal, Button, Pill, GameIcon } from "@merky/ui";
import { gameRegistry } from "@merky/games";
import { useT } from "@/i18n";

/** Full title, description, and how-to-play for a game — triggered from a lobby game card. */
export function GameInfoModal({ gameId, onClose }: { gameId: string | null; onClose: () => void }) {
  const t = useT();
  const game = gameId ? gameRegistry[gameId] : undefined;

  return (
    <Modal open={Boolean(game)} onClose={onClose} title={game ? t(game.meta.nameKey) : ""} closeLabel={t("common.close")}>
      {game && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border-2 border-black bg-[var(--mb-surface-2)] shadow-[2px_2px_0_0_#000]">
              <GameIcon gameId={game.meta.id} className="h-7 w-7 text-[var(--mb-violet)]" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
              {game.meta.taglineKey && (
                <p className="text-sm font-extrabold italic text-[var(--mb-violet)]">{t(game.meta.taglineKey)}</p>
              )}
              <Pill tone="ok" className="self-start">
                {t("lobby.players.range", { min: game.meta.minPlayers, max: game.meta.maxPlayers })}
              </Pill>
            </div>
          </div>

          <p className="text-sm font-semibold leading-relaxed text-[var(--mb-text)]">
            {t(game.meta.descriptionKey)}
          </p>

          <div className="flex flex-col gap-1.5 rounded-lg border-2 border-black bg-[var(--mb-surface-2)] p-3.5 shadow-[3px_3px_0_0_#000]">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
              {t("home.games.how_to_play")}
            </span>
            <p className="text-sm font-medium leading-relaxed text-[var(--mb-text-dim)]">
              {t(`games.${game.meta.id}.lobby.rules_summary`)}
            </p>
          </div>

          <Button variant="secondary" block onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
