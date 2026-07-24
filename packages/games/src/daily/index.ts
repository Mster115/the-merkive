import type { DailyGameModule } from "./types";
import { merkMini } from "./merk-mini";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "merk-mini": merkMini,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}
