import { defineGame } from "@merky/game-sdk";
import { YougotitStage } from "./Stage";
import { YougotitController } from "./Controller";
import { YougotitLobbyOptions } from "./LobbyOptions";
import { yougotitPacks } from "./packs";
import {
  initYougotit,
  reduceYougotit,
  onTickYougotit,
  awaitedSeatsYougotit,
  suggestBotActionYougotit,
  onSeatAbandonedYougotit,
} from "./logic";

export const yougotit = defineGame({
  meta: {
    id: "yougotit",
    nameKey: "games.yougotit.name",
    descriptionKey: "games.yougotit.description",
    taglineKey: "games.yougotit.tagline",
    minPlayers: 4,
    maxPlayers: 12,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["party", "teams", "guessing"],
    defaultSettings: {
      targetScore: "10",
      stealEnabled: true,
      guessSeconds: 90,
      packId: "yougotit-core",
    },
    settingFields: [
      {
        key: "targetScore",
        labelKey: "games.yougotit.settings.targetScore",
        type: "select",
        default: "10",
        options: [
          { value: "7", labelKey: "games.yougotit.settings.targetScore.7" },
          { value: "10", labelKey: "games.yougotit.settings.targetScore.10" },
          { value: "15", labelKey: "games.yougotit.settings.targetScore.15" },
        ],
      },
      {
        key: "stealEnabled",
        labelKey: "games.yougotit.settings.stealEnabled",
        type: "boolean",
        default: true,
      },
      {
        key: "guessSeconds",
        labelKey: "games.yougotit.settings.guessSeconds",
        type: "number",
        default: 90,
        min: 30,
        max: 180,
        step: 15,
      },
      {
        key: "packId",
        labelKey: "games.yougotit.settings.packId",
        type: "pack",
        default: "yougotit-core",
      },
    ],
  },
  packs: yougotitPacks,
  i18n: {
    en: {
      "games.yougotit.name": "You got it? Good.",
      "games.yougotit.description":
        "The Oracle drops one clue. Slide the dial to where their brain lives. You got it? Good.",
      "games.yougotit.tagline": "One clue. One dial. You got it?",
      "games.yougotit.lobby.rules_summary":
        "One player is the Oracle and sees a secret target hidden on the spectrum — they give a single clue to steer their team's dial toward it. Land close for points, nail a Bullseye for the max, and watch out for the other team's Undercut steal.",
      "games.yougotit.credits":
        "Mechanics inspired by Wavelength by Wolfgang Warsch, Alex Hague & Justin Vickers (CMYK).",

      "games.yougotit.packs.core": "You Got It? Core (Family Friendly)",
      "games.yougotit.packs.afterdark": "You Got It? After Dark (Mildly Spicy)",

      "games.yougotit.settings.targetScore": "Points to Win",
      "games.yougotit.settings.targetScore.7": "7 — Quick Round",
      "games.yougotit.settings.targetScore.10": "10 — Standard",
      "games.yougotit.settings.targetScore.15": "15 — Marathon",
      "games.yougotit.settings.stealEnabled": "The Undercut",
      "games.yougotit.settings.stealEnabledHint": "Let the other team steal a point by guessing which way the dial missed.",
      "games.yougotit.settings.guessSeconds": "Guessing Time",
      "games.yougotit.settings.packId": "Content Pack",

      "games.yougotit.lobby.subtitle": "Customize scoring, the Undercut, and prompt packs",

      "games.yougotit.team.bass": "Team Bass",
      "games.yougotit.team.treble": "Team Treble",
      "games.yougotit.oracle": "Oracle",

      "games.yougotit.phase.clue": "The Oracle is tuning in…",
      "games.yougotit.phase.guess": "Guessing phase",
      "games.yougotit.phase.steal": "The Undercut is open",
      "games.yougotit.phase.reveal": "Reveal",
      "games.yougotit.phase.game_over": "Game over",

      "games.yougotit.ui.loading": "Loading...",
      "games.yougotit.ui.turn_number": "Turn {number}",
      "games.yougotit.ui.points_to_win": "First to {target}",
      "games.yougotit.ui.dial_aria": "Guess dial. Slide from {left} to {right}.",
      "games.yougotit.ui.on": "ON",
      "games.yougotit.ui.off": "OFF",

      "games.yougotit.ui.oracle_thinking": "{name} is tuning in…",
      "games.yougotit.ui.you_are_oracle": "You're the Oracle — give them a clue!",
      "games.yougotit.ui.target_secret_hint": "Only you can see the target",
      "games.yougotit.ui.clue_prompt_title": "Give a one-word (or short) clue",
      "games.yougotit.ui.clue_placeholder": "Type your clue...",
      "games.yougotit.ui.clue_chars_left": "{count} left",
      "games.yougotit.ui.submit_clue": "Send Clue",
      "games.yougotit.ui.auto_clue_notice": "Time's up — an auto-clue was used",
      "games.yougotit.ui.opponent_turn_hint": "Watch the other team's dial from the big screen",

      "games.yougotit.ui.tension_view": "Your team is guessing — no peeking hints!",
      "games.yougotit.ui.drag_instructions": "Drag the dial, or use the nudge buttons",
      "games.yougotit.ui.lock_it_in": "Lock It In",
      "games.yougotit.ui.locked_in": "Locked In!",
      "games.yougotit.ui.change_mind_hint": "You can still nudge the dial until everyone locks in",
      "games.yougotit.ui.guess_in_progress": "Guessing is underway…",
      "games.yougotit.ui.pointer_readout": "Needle at {angle}°",
      "games.yougotit.ui.teammates_ready": "{ready}/{total} locked in",
      "games.yougotit.ui.nudge_minus5": "Nudge down 5 degrees",
      "games.yougotit.ui.nudge_minus1": "Nudge down 1 degree",
      "games.yougotit.ui.nudge_plus1": "Nudge up 1 degree",
      "games.yougotit.ui.nudge_plus5": "Nudge up 5 degrees",

      "games.yougotit.ui.undercut_title": "THE UNDERCUT",
      "games.yougotit.ui.undercut_body": "Their needle sits at {angle}°. Which way did they miss?",
      "games.yougotit.ui.undercut_left": "LEFT",
      "games.yougotit.ui.undercut_right": "RIGHT",
      "games.yougotit.ui.undercut_locked": "Vote locked in!",
      "games.yougotit.ui.undercut_waiting": "The other team is voting the Undercut…",
      "games.yougotit.ui.undercut_votes": "{left} – {right}",

      "games.yougotit.ui.reveal_points": "+{points}",
      "games.yougotit.ui.reveal_miss": "MISSED",
      "games.yougotit.ui.reveal_bullseye": "BULLSEYE! +4",
      "games.yougotit.ui.reveal_undercut_won": "UNDERCUT +1 {team}",
      "games.yougotit.ui.reveal_undercut_whiffed": "UNDERCUT WHIFFED",
      "games.yougotit.ui.reveal_target": "Target was {angle}°",
      "games.yougotit.ui.catch_up_banner": "HEATER! {team} rides again",
      "games.yougotit.ui.next_up": "Up next: {team}",

      "games.yougotit.ui.game_over_title": "GAME OVER",
      "games.yougotit.ui.victory": "VICTORY!",
      "games.yougotit.ui.defeat": "DEFEAT",
      "games.yougotit.ui.winner_banner": "{team} WINS!",

      "games.yougotit.ui.role_spectating": "Spectating this turn",
      "games.yougotit.ui.role_oracle": "Oracle",
      "games.yougotit.ui.role_guesser": "Guesser",
      "games.yougotit.ui.role_undercutter": "Undercutter",
    },
  },
  init(ctx) {
    return initYougotit(ctx);
  },
  reduce(ctx, state, action) {
    return reduceYougotit(ctx, state, action);
  },
  onTick(ctx, state) {
    return onTickYougotit(ctx, state);
  },
  awaitedSeats(ctx, state) {
    return awaitedSeatsYougotit(ctx, state);
  },
  suggestBotAction(ctx, state, seat) {
    return suggestBotActionYougotit(ctx, state, seat);
  },
  onSeatAbandoned(ctx, state, seat) {
    return onSeatAbandonedYougotit(ctx, state, seat);
  },
  ui: {
    Stage: YougotitStage,
    Controller: YougotitController,
    LobbyOptions: YougotitLobbyOptions,
  },
});
