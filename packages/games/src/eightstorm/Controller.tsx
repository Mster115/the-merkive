"use client";

import * as React from "react";
import type { ControllerProps } from "@merky/game-sdk";
import { Button, buzz, Card, Modal, Pill, cn } from "@merky/ui";
import type { EightstormPrivateState, EightstormPublicState } from "./types";
import type { Card as CardType, DeclareSuit, Suit } from "./cards";
import { isLegalPlay, isWildCard, SUITS } from "./cards";
import { CardView, getCardDisplayRank, SuitSVG, SUIT_NAMES } from "./CardView";
import { FanIcon, GridIcon, LightningIcon, ReverseIcon } from "./icons";

export function EightstormController({ room, match, seat, privateState, act, t }: ControllerProps) {
  const pub = match.publicState as EightstormPublicState | null;
  const priv = privateState as EightstormPrivateState | null;
  const hand = priv?.hand ?? [];

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [selectedWildId, setSelectedWildId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"fan" | "grid">("fan");

  if (!pub) {
    return (
      <div className="p-6 text-center font-bold">
        {t("games.eightstorm.name")} — {t("games.eightstorm.ui.loading")}
      </div>
    );
  }

  const isMyTurn = match.phase === "turn" && pub.activeSeat === seat;
  const activeSeatObj = room.seats.find((s) => s.seatIndex === pub.activeSeat);
  const activeName = activeSeatObj?.displayName ?? `Seat ${pub.activeSeat}`;
  const settings = {
    drawTwoOnTwo: Boolean(match.settings.drawTwoOnTwo ?? true),
  };

  const suitOrder: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3, X: 4 };
  const sortedHand = [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return a.id.localeCompare(b.id);
  });

  const playableCards = sortedHand.filter((c) =>
    isLegalPlay(c, pub.topCard, pub.declaredSuit, pub.pendingDraw, settings.drawTwoOnTwo)
  );

  const handleCardClick = (card: CardType) => {
    setErrorMsg(null);
    buzz(10);
    if (isWildCard(card)) {
      setSelectedWildId(card.id);
    } else {
      executePlay(card.id);
    }
  };

  const executePlay = async (cardId: string, declareSuit?: DeclareSuit) => {
    setErrorMsg(null);
    setSelectedWildId(null);
    const res = await act("play", { cardId, declareSuit });
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    } else {
      buzz(18);
    }
  };

  const handleDraw = async () => {
    setErrorMsg(null);
    const res = await act("draw");
    if (!res.ok) {
      setErrorMsg(res.error);
      buzz([30, 40, 30]);
    }
  };

  const handlePass = async () => {
    setErrorMsg(null);
    const res = await act("pass");
    if (!res.ok) {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full max-w-md mx-auto p-3 gap-3 select-none">
      {/* Live accessibility region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isMyTurn ? t("games.eightstorm.ui.your_turn") : t("games.eightstorm.ui.waiting_for", { name: activeName })}
        {`. Direction is ${pub.direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}`}
        {pub.pendingDraw > 0 ? `. Pending draw penalty: ${pub.pendingDraw}` : ''}
      </div>

      {/* Top Header Card Info */}
      <Card className="flex items-center justify-between p-3 rounded-xl bg-[var(--mb-surface)] border-2 border-black shadow-[var(--mb-shadow)]">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-black text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
            {t("games.eightstorm.ui.top_card")}:
          </span>
          <span
            className={cn(
              "font-black text-sm px-3 py-1 rounded-lg border-2 border-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] uppercase",
              pub.topCard.suit === "H" || pub.topCard.suit === "D"
                ? "bg-[var(--mb-pink)] text-[var(--mb-on-pink)]"
                : isWildCard(pub.topCard)
                ? "bg-[var(--mb-gold)] text-[var(--mb-on-gold)]"
                : "bg-[var(--mb-paper)] text-[var(--mb-ink)]"
            )}
          >
            {getCardDisplayRank(pub.topCard.rank)}
            <SuitSVG suit={pub.topCard.suit} className="w-4 h-4" />
          </span>
        </div>

        {pub.declaredSuit ? (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-black text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)]">
              {t("games.eightstorm.ui.active_suit")}:
            </span>
            <span className="font-black text-sm text-[var(--mb-on-gold)] bg-[var(--mb-gold)] px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000] flex items-center gap-1">
              <SuitSVG suit={pub.declaredSuit} className="w-4 h-4 text-[var(--mb-on-gold)]" />
              {t(`games.eightstorm.suits.${pub.declaredSuit}`)}
            </span>
          </div>
        ) : (
          <span className="text-xs font-bold text-[var(--mb-text-dim)] flex items-center gap-1">
            <ReverseIcon className="w-3.5 h-3.5 text-[var(--mb-violet)]" />
            {pub.direction === 1 ? "Clockwise" : "Reverse"}
          </span>
        )}
      </Card>

      {/* Turn Banner & Status */}
      <div className="text-center">
        {isMyTurn ? (
          <div className="flex items-center justify-center gap-2">
            <Pill tone="accent" className="text-sm px-5 py-1.5 font-black border-2 border-black shadow-[var(--mb-shadow)] flex items-center gap-1.5 mb-pop">
              <LightningIcon className="w-4 h-4 text-[var(--mb-on-accent)]" />
              {t("games.eightstorm.ui.your_turn")}
            </Pill>
            {playableCards.length > 0 && (
              <span className="text-xs font-black px-3 py-1 rounded-lg bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black shadow-[2px_2px_0_0_#000]">
                {playableCards.length} Playable
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm font-extrabold text-[var(--mb-text-dim)] flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--mb-gold)] mb-blink" />
            {t("games.eightstorm.ui.waiting_for", { name: activeName })}
          </span>
        )}
      </div>

      {/* Inline Error Message */}
      {errorMsg && (
        <div role="alert" className="p-3 text-sm font-black bg-[var(--mb-danger)] border-2 border-black text-[var(--mb-on-danger)] rounded-xl text-center shadow-[var(--mb-shadow)] mb-shake">
          {errorMsg}
        </div>
      )}

      {/* Action Buttons (Draw / Pass) */}
      {isMyTurn && (
        <div className="flex gap-2">
          <Button
            variant={pub.pendingDraw > 0 ? "danger" : "secondary"}
            size="lg"
            block
            onClick={handleDraw}
            disabled={pub.drewThisTurn && pub.pendingDraw === 0}
            className="flex-1 min-h-14 font-black tracking-wide"
          >
            {pub.pendingDraw > 0
              ? t("games.eightstorm.ui.draw_pending", { count: pub.pendingDraw })
              : t("games.eightstorm.ui.draw")}
          </Button>

          {pub.drewThisTurn && pub.pendingDraw === 0 && (
            <Button
              variant="primary"
              size="lg"
              onClick={handlePass}
              className="px-6 min-h-14 font-black"
            >
              {t("games.eightstorm.ui.pass")}
            </Button>
          )}
        </div>
      )}

      {/* Hand Cards Fan / Grid Showcase */}
      <div className="flex-1 my-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--mb-text-dim)] [font-family:var(--mb-font-display)] flex items-center gap-2">
            <span>{t("games.eightstorm.ui.your_hand", { count: hand.length })}</span>
            {pub.pendingDraw > 0 && isMyTurn && (
              <span className="text-[var(--mb-danger)] font-black mb-blink">
                {t("games.eightstorm.ui.must_stack_or_draw")}
              </span>
            )}
          </h3>

          <div className="flex items-center gap-1 bg-[var(--mb-surface)] p-1 rounded-xl border-2 border-black shadow-[2px_2px_0_0_#000]">
            <button
              type="button"
              aria-pressed={viewMode === "fan"}
              onClick={() => setViewMode("fan")}
              className={cn(
                "px-3 py-2 min-h-[44px] rounded-lg text-xs font-black transition-all flex items-center gap-1 focus-visible:outline-none mb-press",
                viewMode === "fan"
                  ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black shadow-[2px_2px_0_0_#000]"
                  : "text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              <FanIcon className="w-4 h-4" /> Fan
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-3 py-2 min-h-[44px] rounded-lg text-xs font-black transition-all flex items-center gap-1 focus-visible:outline-none mb-press",
                viewMode === "grid"
                  ? "bg-[var(--mb-accent-2)] text-[var(--mb-on-accent-2)] border-2 border-black shadow-[2px_2px_0_0_#000]"
                  : "text-[var(--mb-text-dim)] hover:text-white"
              )}
            >
              <GridIcon className="w-4 h-4" /> Grid
            </button>
          </div>
        </div>

        {/* FAN VIEW */}
        {viewMode === "fan" && (
          <div className="w-full overflow-x-auto pb-6 pt-4 px-2 no-scrollbar">
            <div className="flex items-center justify-start min-w-max px-4">
              {sortedHand.map((card, idx) => {
                const playable = isMyTurn && isLegalPlay(card, pub.topCard, pub.declaredSuit, pub.pendingDraw, settings.drawTwoOnTwo);
                return (
                  <div
                    key={card.id}
                    className={cn(
                      "mb-deal transition-all duration-200 ease-out",
                      idx > 0 && "-ml-10"
                    )}
                    style={{
                      zIndex: playable ? 20 + idx : idx,
                      animationDelay: `${Math.min(idx, 10) * 45}ms`,
                    }}
                  >
                    <CardView
                      card={card}
                      disabled={!playable}
                      onClick={() => handleCardClick(card)}
                      size="md"
                      className={cn(
                        playable && "-translate-y-3"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto max-h-[340px] p-1">
            {sortedHand.map((card) => {
              const playable = isMyTurn && isLegalPlay(card, pub.topCard, pub.declaredSuit, pub.pendingDraw, settings.drawTwoOnTwo);
              return (
                <CardView
                  key={card.id}
                  card={card}
                  disabled={!playable}
                  onClick={() => handleCardClick(card)}
                  size="md"
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Suit Selector Modal for Wilds */}
      <Modal
        open={selectedWildId !== null}
        title={t("games.eightstorm.ui.choose_suit_title")}
      >
        <div className="grid grid-cols-2 gap-3 p-2">
          {SUITS.map((suit) => {
            const isRed = suit === "H" || suit === "D";
            return (
              <Button
                key={suit}
                variant="ghost"
                size="lg"
                onClick={() => {
                  if (selectedWildId) {
                    executePlay(selectedWildId, suit);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center py-6 min-h-[96px] gap-2 border-2 border-black text-xl font-black rounded-xl transition-all shadow-[var(--mb-shadow)] mb-press",
                  isRed
                    ? "bg-[var(--mb-pink)] text-[var(--mb-on-pink)] hover:bg-[var(--mb-pink)]"
                    : "bg-[var(--mb-paper)] text-[var(--mb-ink)] hover:bg-[var(--mb-paper)]"
                )}
              >
                <SuitSVG suit={suit} className="w-12 h-12" />
                <span className="capitalize text-sm font-black tracking-wider [font-family:var(--mb-font-display)] uppercase">
                  {SUIT_NAMES[suit]}
                </span>
              </Button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
