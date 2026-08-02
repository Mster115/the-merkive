import { defineDailyGame } from "../types";
import type { DailyGameMeta } from "../types";
import { generatePrompt, validatePack } from "./pack";
import { init, reduce, summarize } from "./logic";
import { DetourPlay } from "./ui";
import { HowToPlay } from "./HowToPlay";

export const detourMeta: DailyGameMeta = {
  id: "detour",
  nameKey: "daily.detour.name",
  descriptionKey: "daily.detour.description",
  taglineKey: "daily.detour.tagline",
  estimatedMinutes: 3,
  tags: ["geography", "map", "navigation", "solo"],
};

export const en: Record<string, string> = {
  "daily.detour.name": "Detour",
  "daily.detour.description":
    "Navigate between city POIs using stranger directions, landmark clues, and transit hops.",
  "daily.detour.tagline": "Daily City Wayfinding Puzzle",
  "daily.detour.destinationSummary": "Heading for somewhere in {district}",
  "daily.detour.strangerClueHeading": "Stranger's Directions",
  "daily.detour.clueTier": "Hint {tier} of 4",
  "daily.detour.requestHintButton": "Hint",
  "daily.detour.selectPrompt": "Select Next Hop Landmark",
  "daily.detour.inputPlaceholder": "Search landmark or district…",
  "daily.detour.noMatchingLocations": "No matching city locations found",
  "daily.detour.guessButton": "Hop to Landmark",
  "daily.detour.guessNamed": "Hop to {name}",
  "daily.detour.giveUpButton": "Give Up",
  "daily.detour.giveUpConfirm": "Tap again to give up",
  "daily.detour.historyHeading": "Hop History",
  "daily.detour.hopCounter": "Hop {used} / {total}",
  "daily.detour.detourCount": "{count} detours",
  "daily.detour.hopCorrectNamed": "Correct — {name}.",
  "daily.detour.detourDistance": "+{distance} km",
  "daily.detour.detourAnnouncement":
    "Wrong turn. {name} is {distance} kilometres off your route.",
  "daily.detour.solvedAnnouncement": "Congratulations! You reached the destination!",
  "daily.detour.failedAnnouncementFull": "Game over. The destination was {name}.",
  "daily.detour.victoryTitle": "Destination Reached!",
  "daily.detour.failedTitle": "Lost in the City",
  "daily.detour.destinationRevealed": "Target Destination: {name}",
  "daily.detour.statWrongTurns": "Wrong turns",
  "daily.detour.statCluesUsed": "Hints used",
  "daily.detour.districtsHeading": "Districts opened",
  // Map
  "daily.detour.map.heading": "{city}",
  "daily.detour.map.canvasLabel":
    "Map of {city} showing your start point and the hops you have committed",
  "daily.detour.map.caption":
    "Your trail so far. Only places you have already been appear here — the landmarks you have yet to visit are in the list below.",
  // HowToPlay keys
  "daily.detour.howto.goal":
    "Navigate from the Start POI to today's Destination POI in as few hops and clue reveals as possible.",
  "daily.detour.howto.diagramAlt":
    "A route diagram showing Start POI connected by dotted line to Hop 1 City Hall, leading to Target Stadium",
  "daily.detour.howto.diagramCaption": "Hop step by step to the destination",
  "daily.detour.howto.diagramStart": "Start",
  "daily.detour.howto.diagramHop": "Hop 1",
  "daily.detour.howto.diagramTarget": "Target",
  "daily.detour.howto.step1":
    "Read the stranger's directions for where you are now. Stuck? Ask for a hint — the first reveals distance and direction, and the last opens up the district on your map.",
  "daily.detour.howto.step2":
    "Pick the landmark you think they are describing from the list, then commit it.",
  "daily.detour.howto.step3":
    "A correct pick moves you on to the next leg. A wrong one is a detour, and you are told how far off it took you.",
  "daily.detour.howto.note":
    "The map shows only where you have already been — the landmarks you have yet to reach are in the list, without their locations.",
};

export const detour = defineDailyGame({
  meta: detourMeta,
  i18n: { en },
  generatePrompt,
  validatePack,
  init,
  reduce,
  summarize,
  ui: {
    Play: DetourPlay,
    HowToPlay,
  },
});

export * from "./types";
export * from "./logic";
export * from "./pack";
