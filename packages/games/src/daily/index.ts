import type { DailyGameModule } from "./types";
import { nutshell } from "./nutshell";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "nutshell": nutshell,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}
