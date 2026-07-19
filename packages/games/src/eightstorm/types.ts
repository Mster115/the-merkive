import type { SeatIndex } from "@merky/game-sdk";
import type { Card, DeclareSuit } from "./cards";

export interface LastPlaySummary {
  seat: SeatIndex;
  action: "play" | "draw" | "pass";
  cardId?: string;
}

export interface EightstormPublicState {
  activeSeat: SeatIndex;
  direction: 1 | -1;
  topCard: Card;
  declaredSuit: DeclareSuit | null;
  pendingDraw: number;
  drewThisTurn: boolean;
  handCounts: Record<number, number>;
  drawPileCount: number;
  lastPlay: LastPlaySummary | null;
  outSeat: SeatIndex | null;
  _drawPile: Card[];
  _discardPile: Card[];
}

export interface EightstormPrivateState {
  hand: Card[];
}

export interface EightstormSettings {
  drawTwoOnTwo: boolean;
  skipOnJack: boolean;
  reverseOnAce: boolean;
  jokers: boolean;
  turnSeconds: number;
}
