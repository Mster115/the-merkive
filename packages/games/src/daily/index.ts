import type { DailyGameModule } from "./types";
import { merkGrid } from "./merk-grid";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "merk-grid": merkGrid,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}
