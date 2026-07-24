import type { DailyGameModule } from "./types";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  // game plugins append one line here, e.g.: "nutshell": nutshell,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}
