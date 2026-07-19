"use client";

import * as React from "react";
import type { StageProps } from "@merky/game-sdk";
import { Card, Panel, Pill, cn, sfx, WhimsicalAvatarFace, WhimsicalPlayerChip } from "@merky/ui";
import type { EightstormPublicState } from "./types";
import { CardView, getCardActionLabel, SuitSVG, SUIT_NAMES } from "./CardView";
import { DeckIcon, LightningIcon, ReverseIcon, TrophyIcon } from "./icons";

export function EightstormStage({ room, match, t }: StageProps) {
  const pub = match.publicState as EightstormPublicState | null;

  // Card-table foley: a soft snap whenever a play/draw lands.
  const lastVersionRef = React.useRef(match.version);
  React.useEffect(() => {
    if (match.version !== lastVersionRef.current) {
      lastVersionRef.current = match.version;
      const action = (match.publicState as EightstormPublicState | null)?.lastPlay?.action;
      if (action === "play") sfx.play("deal");
      else if (action === "draw") sfx.play("whoosh");
    }
  }, [match.version, match.publicState]);

  if (!pub) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-2xl font-black">
        {t("games.eightstorm.name")} — {t("games.eightstorm.ui.loading")}
      </div>
    );
  }

  const activeSeat = room.seats.find((s) => s.seatIndex === pub.activeSeat);
  const activeName = activeSeat?.displayName ?? `Seat ${pub.activeSeat}`;
  const isGameOver = match.over || match.phase === "game_over";
  const winnerSeat = isGameOver && pub.outSeat !== null ? room.seats.find((s) => s.seatIndex === pub.outSeat) : null;

  return (
    <div className="flex flex-col h-full w-full max-w-[1800px] mx-auto p-4 md:p-8 justify-between select-none">
      {/* Live accessibility region */}
      <div className="sr-only" aria-live="polite">
        {isGameOver
          ? t("games.eightstorm.phase.game_over")
          : `${t("games.eightstorm.phase.turn", { name: activeName })}. Direction is ${pub.direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}${pub.pendingDraw > 0 ? `. Pending draw penalty of ${pub.pendingDraw}` : ''}.`}
      </div>

      {/* Top Header Status Bar */}
      <div className="flex items-center justify-between gap-4 bg-[var(--mb-surface-2)] p-4 rounded-xl border-[3px] border-black shadow-[var(--mb-shadow)] -rotate-[0.5deg]">
        <div className="flex items-center gap-3">
          <Pill tone="accent" className="text-base px-4 py-1.5 font-black uppercase tracking-wider [font-family:var(--mb-font-display)] border-2 border-black shadow-[2px_2px_0_0_#000] -rotate-1">
            ⚡ {t("games.eightstorm.name")}
          </Pill>
          <span className="font-black text-xl text-[var(--mb-gold)] uppercase tracking-wider [font-family:var(--mb-font-display)] flex items-center gap-2">
            <ReverseIcon
              className={cn(
                "w-5 h-5 text-[var(--mb-gold)] transition-transform duration-500",
                pub.direction === -1 && "-scale-x-100"
              )}
            />
            {pub.direction === 1 ? "Clockwise" : "Counter-Clockwise"}
          </span>
        </div>

        {pub.pendingDraw > 0 && (
          <Pill tone="danger" className="mb-blink text-base px-5 py-1.5 font-black border-2 border-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 uppercase [font-family:var(--mb-font-display)]">
            <LightningIcon className="w-5 h-5 text-white" />
            {t("games.eightstorm.ui.pending_draw", { count: pub.pendingDraw })}
          </Pill>
        )}

        {pub.declaredSuit && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
              {t("games.eightstorm.ui.active_suit")}:
            </span>
            <span className="px-4 py-1.5 rounded-xl border-2 border-black bg-[var(--mb-gold)] text-black font-black text-xl flex items-center gap-2 shadow-[2px_2px_0_0_#000] uppercase [font-family:var(--mb-font-display)]">
              <SuitSVG suit={pub.declaredSuit} className="w-5 h-5 text-black" />
              {SUIT_NAMES[pub.declaredSuit]}
            </span>
          </div>
        )}
      </div>

      {/* Center Table Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center my-auto">
        {/* 3D Stacked Draw Pile */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative group cursor-pointer">
            {/* Background stacked card layers */}
            <div className="absolute top-2 left-2 w-36 h-52 rounded-2xl bg-[var(--mb-surface-3)] border-[3px] border-black shadow-[var(--mb-shadow)] transform -rotate-6" />
            <div className="absolute top-1 left-1 w-36 h-52 rounded-2xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] transform rotate-3" />

            {/* Top Deck Card */}
            <Panel className="w-36 h-52 rounded-2xl flex flex-col items-center justify-center border-4 border-black bg-[var(--mb-surface)] shadow-[var(--mb-shadow-lg)] relative z-10">
              <div className="w-28 h-44 rounded-xl border-2 border-dashed border-[var(--mb-line-dim)] bg-[var(--mb-surface-2)] flex flex-col items-center justify-center p-2">
                <DeckIcon className="w-12 h-12 text-[var(--mb-violet)] mb-1" />
                <span className="font-black text-4xl text-white tracking-wider [font-family:var(--mb-font-display)]">
                  {pub.drawPileCount}
                </span>
                <span className="text-[0.65rem] uppercase font-black text-[var(--mb-gold)] tracking-widest mt-1 [font-family:var(--mb-font-display)]">
                  REMAINING
                </span>
              </div>
            </Panel>
          </div>
        </div>

        {/* Discard Pile Showcase */}
        <div className="flex flex-col items-center justify-center relative">
          <div className="relative flex flex-col items-center">
            {/* Card stack shadow underneath */}
            <div className="absolute top-1 left-2 w-32 h-48 rounded-2xl bg-[var(--mb-surface-3)] border-[3px] border-black shadow-[var(--mb-shadow)] transform rotate-6" />
            <div className="absolute -top-1 -left-1 w-32 h-48 rounded-2xl bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow)] transform -rotate-3" />

            <div className="relative z-10">
              <span key={pub.topCard.id} className="inline-block mb-pop">
                <CardView card={pub.topCard} size="lg" />
              </span>
            </div>

            {pub.declaredSuit && (
              <div className="absolute -top-4 -right-4 px-4 py-1.5 rounded-xl bg-[var(--mb-gold)] text-black font-black text-lg shadow-[3px_3px_0_0_#000] border-2 border-black z-20 flex items-center gap-1.5 rotate-3 uppercase [font-family:var(--mb-font-display)]">
                <SuitSVG suit={pub.declaredSuit} className="w-5 h-5 text-black" />
                {SUIT_NAMES[pub.declaredSuit]}
              </div>
            )}
          </div>
          <span className="mt-4 font-black text-sm uppercase tracking-widest text-[var(--mb-gold)] [font-family:var(--mb-font-display)]">
            {t("games.eightstorm.ui.top_card")}
          </span>
        </div>

        {/* Action Ticker / Turn Focus Panel */}
        <div className="flex flex-col items-center justify-center">
          <Panel className="w-full max-w-xs p-6 rounded-2xl flex flex-col items-center text-center gap-4 bg-[var(--mb-surface-2)] border-[3px] border-black shadow-[var(--mb-shadow-lg)] relative overflow-hidden rotate-[0.5deg]">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--mb-violet)] [font-family:var(--mb-font-display)]">
              ⚡ {t("games.eightstorm.ui.turn_label")}
            </span>

            <div className="flex items-center gap-3">
              <div className="relative">
                <WhimsicalAvatarFace avatarId={activeSeat?.avatarId ?? "fox"} size={56} />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--mb-accent-2)] border-2 border-black mb-breathe" />
              </div>
              <span className="text-2xl font-black text-white [font-family:var(--mb-font-display)]">{activeName}</span>
            </div>

            {pub.lastPlay ? (
              <div className="p-3.5 rounded-xl bg-[var(--mb-surface)] border-2 border-black shadow-[2px_2px_0_0_#000] w-full">
                <p className="text-sm font-black text-[var(--mb-accent-2)] [font-family:var(--mb-font-display)] uppercase">
                  {pub.lastPlay.action === "play"
                    ? t("games.eightstorm.action.played", {
                        name: room.seats.find((s) => s.seatIndex === pub.lastPlay?.seat)?.displayName ?? `Seat ${pub.lastPlay.seat}`,
                        card: getCardActionLabel(pub.topCard.rank, pub.topCard.suit),
                      })
                    : pub.lastPlay.action === "draw"
                    ? t("games.eightstorm.action.drew", { name: room.seats.find((s) => s.seatIndex === pub.lastPlay?.seat)?.displayName ?? `Seat ${pub.lastPlay.seat}` })
                    : t("games.eightstorm.action.passed", { name: room.seats.find((s) => s.seatIndex === pub.lastPlay?.seat)?.displayName ?? `Seat ${pub.lastPlay.seat}` })}
                </p>
              </div>
            ) : (
              <p className="text-xs font-black text-[var(--mb-text-dim)] uppercase tracking-wider [font-family:var(--mb-font-display)]">
                GAME UNDERWAY!
              </p>
            )}
          </Panel>
        </div>
      </div>

      {/* Seats Grid with Visual Mini Card Fans */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {room.seats.map((seat) => {
          const isTurn = !isGameOver && seat.seatIndex === pub.activeSeat;
          const count = pub.handCounts[seat.seatIndex] ?? 0;
          return (
            <div
              key={seat.seatIndex}
              className={cn(
                "transition-all duration-300 transform",
                isTurn && "scale-105 mb-breathe"
              )}
            >
              <WhimsicalPlayerChip
                displayName={seat.displayName}
                avatarId={seat.avatarId}
                isHost={seat.isHost}
                connected={seat.connected}
                abandoned={seat.abandoned}
                highlight={isTurn}
                trailing={
                  <div className="flex items-center gap-1 font-black text-sm px-2 py-0.5 rounded-md bg-[var(--mb-surface-3)] text-[var(--mb-gold)] border border-black [font-family:var(--mb-font-display)]">
                    <span>{count}</span>
                    <DeckIcon className="w-3.5 h-3.5 text-[var(--mb-gold)]" />
                  </div>
                }
              />
            </div>
          );
        })}
      </div>

      {/* Game Over Victory Modal */}
      {isGameOver && winnerSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85">
          <Card raised className="max-w-md w-full p-8 text-center flex flex-col items-center gap-5 border-4 border-black bg-[var(--mb-surface)] shadow-[var(--mb-shadow-lg)] mb-pop">
            <TrophyIcon className="w-24 h-24 text-[var(--mb-gold)] mb-tada drop-shadow-[4px_4px_0_#000]" />
            <h2 className="text-4xl font-black text-[var(--mb-gold)] tracking-tight mb-neon-gold [font-family:var(--mb-font-display)] uppercase italic">
              {t("games.eightstorm.ui.winner_storms", { name: winnerSeat.displayName })}
            </h2>
            <WhimsicalAvatarFace avatarId={winnerSeat.avatarId} size={96} />
            <p className="text-2xl font-black text-white uppercase tracking-wider [font-family:var(--mb-font-display)]">
              {t("games.eightstorm.phase.game_over")}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
