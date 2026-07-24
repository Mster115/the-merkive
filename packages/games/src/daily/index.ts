import type { DailyGameModule } from "./types";
import { merkChain } from "./merk-chain";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "merk-chain": merkChain,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}

