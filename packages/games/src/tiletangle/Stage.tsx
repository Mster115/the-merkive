import * as React from "react";
import type { StageProps } from "@merky/game-sdk";
import { AvatarFace, Card, CardsIcon, LightningIcon, Pill, PuzzleIcon, ScoreBoard, cn, type ScoreRow } from "@merky/ui";
import type { TileTanglePublicState } from "./logic";
import { TileComponent } from "./TileComponent";

export const Stage: React.FC<StageProps> = ({ room, match, t }) => {
  const pub = match.publicState as TileTanglePublicState | null;

  if (!pub) {
    return <div className="p-8 text-2xl font-black text-center">{t("games.tiletangle.name")}</div>;
  }

  const activeSeat = pub.activeSeat;
  const activePlayer = room.seats.find((s) => s.seatIndex === activeSeat);
  const activePlayerName = activePlayer?.displayName ?? `Player ${activeSeat}`;

  const winnerSeat = pub.winner;
  const winnerPlayer = winnerSeat !== null ? room.seats.find((s) => s.seatIndex === winnerSeat) : null;

  // Prepare scoreboard rows if over
  const scoreRows: ScoreRow[] = room.seats.map((s) => ({
    seatIndex: s.seatIndex,
    displayName: s.displayName,
    avatarId: s.avatarId,
    points: match.scores[s.seatIndex] ?? 0,
    abandoned: s.abandoned,
  }));

  return (
    <div className="w-full min-h-full p-6 text-[var(--mb-text)] flex flex-col justify-between space-y-6">
      {/* Live turn announcement for screen readers & 10ft viewing */}
      <div className="sr-only" aria-live="polite">
        {match.over
          ? winnerPlayer
            ? t("games.tiletangle.winnerAnnouncement", { name: winnerPlayer.displayName })
            : t("games.tiletangle.gameOver")
          : t("games.tiletangle.turnNotice", { name: activePlayerName })}
      </div>

      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-6xl font-black tracking-tight text-white uppercase italic [font-family:var(--mb-font-display)] mb-neon-gold mb-wobble-fast">
              {t("games.tiletangle.name")}
            </h1>
            <Pill tone="accent" className="-rotate-2">
              TILE TANGLE ACTIVE
            </Pill>
          </div>
          {!match.over && (
            <p className="flex items-center gap-2 text-2xl font-black text-[var(--mb-gold)] uppercase tracking-wide [font-family:var(--mb-font-display)]">
              <LightningIcon className="w-6 h-6 shrink-0" /> {t("games.tiletangle.turnNotice", { name: activePlayerName })}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Draw Pile Badge */}
          <Card className="px-6 py-3 bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] flex items-center space-x-3 -rotate-1">
            <CardsIcon className="w-8 h-8" />
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
                {t("games.tiletangle.drawPile")}
              </div>
              <div className="text-3xl font-black text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
                {pub.drawPileCount} TILES
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Players Row (The Squad around table) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {room.seats.map((seat, i) => {
          const isTurn = seat.seatIndex === activeSeat && !match.over;
          const count = pub.rackCounts[seat.seatIndex] ?? 0;
          const hasMelded = pub.hasMelded[seat.seatIndex] ?? false;

          return (
            <div
              key={seat.seatIndex}
              className={cn(
                "p-4 rounded-xl border-[3px] border-black flex items-center space-x-4 transition-all shadow-[var(--mb-shadow)]",
                i % 2 === 0 ? "-rotate-1" : "rotate-1",
                isTurn
                  ? "bg-[var(--mb-surface-2)] border-4 border-[var(--mb-accent-2)] shadow-[var(--mb-shadow-lg)] scale-102 mb-breathe"
                  : "bg-[var(--mb-surface)]"
              )}
            >
              <div className="relative">
                <AvatarFace avatarId={seat.avatarId} size={44} />
                {isTurn && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--mb-accent-2)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-[var(--mb-accent-2)] border-2 border-black"></span>
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-xl truncate text-white [font-family:var(--mb-font-display)]">
                  {seat.displayName}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <Pill tone={hasMelded ? "accent" : "neutral"}>
                    {hasMelded ? t("games.tiletangle.hasMelded") : t("games.tiletangle.notMeldedYet")}
                  </Pill>
                  <span className="flex items-center gap-1 text-sm font-black text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
                    {count} <CardsIcon className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table View */}
      <div className="flex-1 bg-[var(--mb-surface)] border-4 border-black shadow-[var(--mb-shadow-lg)] rounded-2xl p-6 min-h-[380px] flex flex-col justify-start">
        <div className="flex items-center justify-between border-b-2 border-black/40 pb-3 mb-4">
          <h2 className="text-xl font-black text-[var(--mb-violet)] uppercase tracking-widest [font-family:var(--mb-font-display)] flex items-center gap-2">
<PuzzleIcon className="w-5 h-5" /> {t("games.tiletangle.tableMelds")}
          </h2>
          <span className="text-xs font-black uppercase text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
            {pub.table.length} SETS ON TABLE
          </span>
        </div>

        {pub.table.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--mb-text-dim)] text-center border-3 border-dashed border-[var(--mb-line-dim)] rounded-xl p-8 gap-3">
<PuzzleIcon className="w-14 h-14" />
            <p className="text-2xl font-black uppercase tracking-wide text-white [font-family:var(--mb-font-display)]">
              {t("games.tiletangle.emptyTable")}
            </p>
            <p className="text-sm font-bold text-[var(--mb-text-dim)]">
              WAITING FOR PLAYERS TO LAY DOWN SETS & RUNS
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-start content-start">
            {pub.table.map((meld, mIdx) => (
              <div
                key={meld.id || `m-${mIdx}`}
                className={cn(
                  "bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] p-3.5 rounded-xl flex flex-wrap gap-2 items-center",
                  mIdx % 2 === 0 ? "rotate-1" : "-rotate-1"
                )}
              >
                {meld.tiles.map((tile, tIdx) => (
                  <TileComponent key={`${tile.id}-${tIdx}`} tile={tile} size="lg" disabled />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Game Over Screen */}
      {match.over && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-6 z-50">
          <Card className="max-w-md w-full p-8 bg-[var(--mb-surface)] border-4 border-black shadow-[var(--mb-shadow-lg)] mb-pop text-center space-y-6">
            <h2 className="text-5xl font-black uppercase tracking-tight italic [font-family:var(--mb-font-display)] mb-neon-gold mb-wobble">
              {t("games.tiletangle.gameOver")}
            </h2>

            {winnerPlayer && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <AvatarFace avatarId={winnerPlayer.avatarId} size={72} />
                </div>
                <div className="text-3xl font-black text-white [font-family:var(--mb-font-display)] uppercase">
                  {t("games.tiletangle.winnerAnnouncement", { name: winnerPlayer.displayName })}
                </div>
              </div>
            )}

            <ScoreBoard rows={scoreRows} />
          </Card>
        </div>
      )}
    </div>
  );
};
