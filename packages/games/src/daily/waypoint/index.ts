import { defineDailyGame } from "../types";
import type { DailyGameMeta } from "../types";
import { generatePrompt, validatePack } from "./pack";
import { init, reduce, summarize } from "./logic";
import { WaypointPlay } from "./ui";
import { HowToPlay } from "./HowToPlay";

export const waypointMeta: DailyGameMeta = {
  id: "waypoint",
  nameKey: "daily.waypoint.name",
  descriptionKey: "daily.waypoint.description",
  taglineKey: "daily.waypoint.tagline",
  estimatedMinutes: 3,
  tags: ["geography", "map", "landmarks", "solo"],
};

export const en: Record<string, string> = {
  "daily.waypoint.name": "Waypoint",
  "daily.waypoint.description":
    "Find the hidden landmark. Every guess tells you how far away it is and which way it lies.",
  "daily.waypoint.tagline": "Daily Landmark Hunt",
  "daily.waypoint.guessesLeft": "{count} guesses remaining",
  "daily.waypoint.selectPrompt": "Select Landmark Location",
  "daily.waypoint.failedTitle": "Puzzle Failed",
  "daily.waypoint.bearingCorrect": "Target reached",
  "daily.waypoint.solvedAnnouncement": "Congratulations! You solved Waypoint!",
  "daily.waypoint.failedAnnouncement": "Game over.",
  "daily.waypoint.failedAnnouncementFull":
    "Out of guesses. The target was {target}.",
  "daily.waypoint.inputPlaceholder": "Choose a location…",
  "daily.waypoint.guessButton": "Guess",
  "daily.waypoint.guessNamed": "Guess {name}",
  "daily.waypoint.giveUpButton": "Give Up",
  "daily.waypoint.giveUpConfirm": "Tap again to give up",
  "daily.waypoint.victoryTitle": "Target Triangulated!",
  "daily.waypoint.revealTarget": "Target: {target}",
  "daily.waypoint.goal":
    "Find today's hidden landmark in {count} guesses. Each guess reports how far the target is and which way it lies.",
  "daily.waypoint.guessCounter": "{used} / {max}",
  "daily.waypoint.historyHeading": "Your guesses",
  "daily.waypoint.guessResult":
    "{name}: {distance} kilometres away, target lies {direction}.",
  "daily.waypoint.mapHeading": "Map",
  "daily.waypoint.mapCaption":
    "Each ring shows every place that distance from your guess. The target sits where the rings cross.",
  "daily.waypoint.mapCaptionRevealed":
    "Your guesses and where the target actually was.",
  "daily.waypoint.statGuesses": "Guesses",
  "daily.waypoint.statClosest": "Closest",
  "daily.waypoint.dir.n": "North",
  "daily.waypoint.dir.ne": "North-East",
  "daily.waypoint.dir.e": "East",
  "daily.waypoint.dir.se": "South-East",
  "daily.waypoint.dir.s": "South",
  "daily.waypoint.dir.sw": "South-West",
  "daily.waypoint.dir.w": "West",
  "daily.waypoint.dir.nw": "North-West",
  // HowToPlay keys:
  "daily.waypoint.howto.goal":
    "Find today's hidden landmark in 5 guesses, using how far away it is and which way it lies.",
  "daily.waypoint.howto.diagramAlt":
    "Two guessed places on a map, each ringed by everywhere the same distance away; the rings cross at the target",
  "daily.waypoint.howto.diagramCaption": "What each guess tells you",
  "daily.waypoint.howto.vectorHint": "Target lies North-East",
  "daily.waypoint.howto.step1":
    "Tap a landmark from the bank, then press Guess to commit it.",
  "daily.waypoint.howto.step2":
    "Read the distance in km and the arrow beside it — the arrow gives the compass sector the target lies in, to the nearest of eight directions. A bullseye means you found it.",
  "daily.waypoint.howto.step3":
    "Each guess draws a ring on the map showing everywhere that far away. Where your rings cross is where the target is.",
  "daily.waypoint.howto.note":
    "Geodesic distances use spherical math (R = 6,371 km). Target coordinates are kept secret until completion.",
};

export const waypoint = defineDailyGame({
  meta: waypointMeta,
  i18n: { en },
  generatePrompt,
  validatePack,
  init,
  reduce,
  summarize,
  ui: {
    Play: WaypointPlay,
    HowToPlay,
  },
});

export * from "./types";
export * from "./logic";
export * from "./pack";
