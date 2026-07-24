import type { DailyGameModule } from "./types";
import { relay } from "./relay";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "relay": relay,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}

