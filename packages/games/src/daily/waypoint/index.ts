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
  tags: ["geography", "map", "vector", "solo"],
};

export const en: Record<string, string> = {
  "daily.waypoint.name": "Waypoint",
  "daily.waypoint.description":
    "Triangulate the secret landmark location using distance and compass bearing vectors.",
  "daily.waypoint.tagline": "Daily Vector Geography Puzzle",
  "daily.waypoint.guessesLeft": "{count} guesses remaining",
  "daily.waypoint.selectPrompt": "Select Landmark Location",
  "daily.waypoint.failedTitle": "Puzzle Failed",
  "daily.waypoint.bearingLabel": "Bearing {bearing} degrees",
  "daily.waypoint.bearingCorrect": "Target reached",
  "daily.waypoint.solvedAnnouncement": "Congratulations! You solved Waypoint!",
  "daily.waypoint.failedAnnouncement": "Game over.",
  "daily.waypoint.inputPlaceholder": "Choose a location…",
  "daily.waypoint.guessButton": "Guess",
  "daily.waypoint.giveUpButton": "Give Up",
  "daily.waypoint.victoryTitle": "Target Triangulated!",
  "daily.waypoint.revealTarget": "Target: {target}",
  // HowToPlay keys:
  "daily.waypoint.howto.goal":
    "Triangulate the secret landmark location within 5 guesses using distance and bearing vectors.",
  "daily.waypoint.howto.diagramAlt":
    "Radar diagram showing a target's distance in kilometres beside a needle pointing toward it",
  "daily.waypoint.howto.diagramCaption": "Distance & Bearing Vector",
  "daily.waypoint.howto.vectorHint": "Target lies North-East",
  "daily.waypoint.howto.step1":
    "Pick a landmark from the dropdown and submit your guess.",
  "daily.waypoint.howto.step2":
    "Read the geodesic distance in km and the needle beside it — it points from your guess straight toward the target. A bullseye means you found it.",
  "daily.waypoint.howto.step3":
    "Use the vector feedback to narrow down the target before you run out of guesses.",
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
