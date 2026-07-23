export type Suit = "S" | "H" | "D" | "C" | "X";
export type DeclareSuit = "S" | "H" | "D" | "C";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "JOKER";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export const SUITS: readonly DeclareSuit[] = ["S", "H", "D", "C"];
export const RANKS: readonly Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(includeJokers: boolean, deckIndex = 0): Card[] {
  const prefix = deckIndex === 0 ? "" : `d${deckIndex}-`;
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${prefix}${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }
  if (includeJokers) {
    deck.push({ id: `${prefix}X-1`, suit: "X", rank: "JOKER" });
    deck.push({ id: `${prefix}X-2`, suit: "X", rank: "JOKER" });
  }
  return deck;
}

export function isWildCard(card: Card): boolean {
  return card.rank === "8" || card.rank === "JOKER";
}

export function cardPointValue(card: Card): number {
  if (card.rank === "8" || card.rank === "JOKER") return 50;
  if (card.rank === "K" || card.rank === "Q" || card.rank === "J") return 10;
  if (card.rank === "A") return 1;
  const n = parseInt(card.rank, 10);
  return Number.isNaN(n) ? 5 : n;
}

export function isLegalPlay(
  card: Card,
  topCard: Card,
  declaredSuit: DeclareSuit | null,
  pendingDraw: number,
  drawTwoOnTwo: boolean
): boolean {
  if (pendingDraw > 0) {
    return drawTwoOnTwo && card.rank === "2";
  }

  if (isWildCard(card)) {
    return true;
  }

  if (card.rank === topCard.rank) {
    return true;
  }

  const effectiveSuit = isWildCard(topCard) ? declaredSuit : topCard.suit;
  return card.suit === effectiveSuit;
}
