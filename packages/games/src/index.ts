import type { GameModule } from "@merky/game-sdk";
import { zaplash } from "./zaplash";
import { tiletangle } from "./tiletangle";
import { eightstorm } from "./eightstorm";

export const gameRegistry: Record<string, GameModule> = {
  [zaplash.meta.id]: zaplash,
  [tiletangle.meta.id]: tiletangle,
  [eightstorm.meta.id]: eightstorm,
};

export const gameList: GameModule[] = Object.values(gameRegistry);

export function getGame(id: string): GameModule | undefined {
  return gameRegistry[id];
}
