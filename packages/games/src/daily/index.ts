import type { DailyGameModule } from "./types";
import { nexus } from "./nexus";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "nexus": nexus,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}
