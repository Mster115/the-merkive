import type { DailyGameModule } from "./types";
import { detour } from "./detour";
import { nexus } from "./nexus";
import { nutshell } from "./nutshell";
import { relay, relayContentWarnings } from "./relay";
import { waypoint } from "./waypoint";
import { chipshot } from "./chipshot";

export const dailyGameRegistry: Record<string, DailyGameModule> = {
  "detour": detour,
  "nexus": nexus,
  "nutshell": nutshell,
  "relay": relay,
  "waypoint": waypoint,
  "chipshot": chipshot,
};
export const dailyGameList: DailyGameModule[] = Object.values(dailyGameRegistry);
export function getDailyGame(id: string): DailyGameModule | undefined {
  return dailyGameRegistry[id];
}

/** Per-game quality checks, keyed by game id. Each returns advisory strings. */
const contentWarningChecks: Record<string, (payload: unknown) => string[]> = {
  relay: relayContentWarnings,
};

/**
 * Advisory notes about a draft pack, for the human reviewing it.
 *
 * Deliberately separate from `validatePack`: that gate also runs against packs
 * already sitting in the queue, so tightening it can strand content scheduled
 * to go live. These never block anything — they surface in `pnpm daily review`
 * so a reviewer can choose to swap a word before approving.
 */
export function contentWarnings(gameId: string, payload: unknown): string[] {
  return contentWarningChecks[gameId]?.(payload) ?? [];
}
