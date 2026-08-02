import { defineDailyGame } from "../types";
import type { DailyGameMeta } from "../types";
import { generatePrompt, validatePack } from "./pack";
import { init, reduce, summarize } from "./logic";
import { ChipShotPlay } from "./ui";
import { ChipShotHowToPlay } from "./HowToPlay";

export const chipShotMeta: DailyGameMeta = {
  id: "chipshot",
  nameKey: "daily.chipshot.name",
  descriptionKey: "daily.chipshot.description",
  estimatedMinutes: 3,
  tags: ["golf", "physics", "casual", "solo"],
};

export const en: Record<string, string> = {
  "daily.chipshot.name": "Chip Shot",
  "daily.chipshot.description":
    "Sink 3 holes on a wild mini-golf course",
  // UI
  "daily.chipshot.shoot": "Shoot!",
  "daily.chipshot.aim": "Aim",
  "daily.chipshot.power": "Power",
  "daily.chipshot.hole_of": "Hole {current} of {total}",
  "daily.chipshot.par": "Par {par}",
  "daily.chipshot.strokes": "Strokes: {n}",
  "daily.chipshot.next_hole": "Next Hole",
  "daily.chipshot.reset": "Reset",
  // Feedback
  "daily.chipshot.nice_shot": "Nice shot!",
  "daily.chipshot.hole_in_one": "HOLE IN ONE!",
  "daily.chipshot.water_hazard": "Water hazard! +1 stroke",
  "daily.chipshot.max_strokes": "Max strokes reached",
  "daily.chipshot.round_complete": "Round complete!",
  // Score
  "daily.chipshot.under_par": "{n} under par",
  "daily.chipshot.over_par": "{n} over par",
  "daily.chipshot.even_par": "Even par",
  // Phases (aria-live)
  "daily.chipshot.phase_aiming": "Line up your shot",
  "daily.chipshot.phase_rolling": "Ball rolling",
  "daily.chipshot.phase_scored": "Ball sunk!",
  "daily.chipshot.phase_penalty": "Water hazard penalty",
  "daily.chipshot.phase_done": "Round complete",
  // HowToPlay
  "daily.chipshot.howto.goal": "Sink the ball in the fewest strokes.",
  "daily.chipshot.howto.step1": "Drag to aim your shot direction.",
  "daily.chipshot.howto.step2": "Slide to set your power.",
  "daily.chipshot.howto.step3": "Tap Shoot to launch the ball!",
};

export const chipshot = defineDailyGame({
  meta: chipShotMeta,
  i18n: { en },
  generatePrompt,
  validatePack,
  init,
  reduce,
  summarize,
  ui: {
    Play: ChipShotPlay,
    HowToPlay: ChipShotHowToPlay,
  },
});

export * from "./types";
export * from "./logic";
export * from "./pack";
