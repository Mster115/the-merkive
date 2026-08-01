"use client";
import * as React from "react";
import type { GameEvent } from "@merky/game-sdk";
import { buzz, sfx, type SfxName } from "@merky/ui";

/**
 * Shell-level feedback for `ReduceResult.events`.
 *
 * Event types are game-defined strings, so this maps only the vocabulary the
 * games already share plus the two the platform itself emits from
 * finalizeMatch. Anything unrecognised is silently ignored — a game that wants
 * richer choreography reads `events` in its own Stage/Controller and animates
 * there. Add a name here only once more than one game uses it.
 */
const SFX_BY_EVENT: Record<string, SfxName> = {
  // Win moments (platform-owned first, then the games' own names).
  match_completed: "win",
  game_over: "win",
  player_won: "win",
  // Dealing / drawing.
  draw: "deal",
  cards_drawn: "deal",
  // Committing something to the table.
  commit: "pop",
  play: "pop",
  card_played: "pop",
  // Giving up a turn.
  pass: "whoosh",
  passed: "whoosh",
  // Powers and zaps.
  zap: "zap",
  use_power: "zap",
  power_resolved: "zap",
  // Locking in a choice.
  voted: "click",
  vote_cast: "click",
  guess_locked: "click",
};

/** Events that deserve a celebration, not just a sound. */
const CELEBRATIONS = new Set(["match_completed", "game_over", "player_won"]);

export interface GameEventFx {
  /**
   * Increments each time a celebration fires. Use it as a React `key` on a
   * ConfettiBurst so the burst re-mounts and replays.
   */
  celebrationKey: number;
}

/**
 * @param events the current step's events (stable identity between versions)
 * @param surface the Stage plays audio out loud; a Controller is in someone's
 *   hand, so it buzzes instead and stays quiet.
 */
export function useGameEventFx(
  events: GameEvent[],
  surface: "stage" | "controller"
): GameEventFx {
  const [celebrationKey, setCelebrationKey] = React.useState(0);
  // Events arrive as one array per match version. Guard on identity so a
  // re-render for an unrelated reason never replays a sound.
  const lastRef = React.useRef<GameEvent[] | null>(null);

  React.useEffect(() => {
    if (events.length === 0 || lastRef.current === events) return;
    lastRef.current = events;

    let celebrate = false;
    for (const event of events) {
      if (CELEBRATIONS.has(event.type)) celebrate = true;
      const name = SFX_BY_EVENT[event.type];
      if (!name) continue;
      if (surface === "stage") {
        sfx.play(name);
      } else if (name === "win") {
        buzz([40, 60, 120]);
      } else {
        buzz(12);
      }
    }
    if (celebrate && surface === "stage") setCelebrationKey((k) => k + 1);
  }, [events, surface]);

  return { celebrationKey };
}
