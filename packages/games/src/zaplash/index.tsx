import { defineGame } from "@merky/game-sdk";
import { ZaplashStage } from "./Stage";
import { ZaplashController } from "./Controller";
import { ZaplashLobbyOptions } from "./LobbyOptions";
import { zaplashPacks } from "./packs";
import {
  initZaplash,
  reduceZaplash,
  onTickZaplash,
  awaitedSeatsZaplash,
  onSeatAbandonedZaplash,
} from "./logic";

export const zaplash = defineGame({
  meta: {
    id: "zaplash",
    nameKey: "games.zaplash.name",
    descriptionKey: "games.zaplash.description",
    minPlayers: 3,
    maxPlayers: 12,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["party", "writing", "voting"],
    defaultSettings: {
      rounds: 2,
      writeSeconds: 90,
      voteSeconds: 25,
      zapBonus: true,
      lightningRound: true,
      packId: "zaplash-core",
    },
    settingFields: [
      {
        key: "rounds",
        labelKey: "games.zaplash.settings.rounds",
        type: "number",
        default: 2,
        min: 1,
        max: 3,
        step: 1,
      },
      {
        key: "writeSeconds",
        labelKey: "games.zaplash.settings.writeSeconds",
        type: "number",
        default: 90,
        min: 30,
        max: 180,
        step: 15,
      },
      {
        key: "voteSeconds",
        labelKey: "games.zaplash.settings.voteSeconds",
        type: "number",
        default: 25,
        min: 10,
        max: 60,
        step: 5,
      },
      {
        key: "zapBonus",
        labelKey: "games.zaplash.settings.zapBonus",
        type: "boolean",
        default: true,
      },
      {
        key: "lightningRound",
        labelKey: "games.zaplash.settings.lightningRound",
        type: "boolean",
        default: true,
      },
      {
        key: "packId",
        labelKey: "games.zaplash.settings.packId",
        type: "pack",
        default: "zaplash-core",
      },
    ],
  },
  packs: zaplashPacks,
  i18n: {
    en: {
      "games.zaplash.name": "Banterbolt",
      "games.zaplash.description": "Write outrageous answers, vote for the best, and steal the show in the Lightning Round.",
      "games.zaplash.lobby.rules_summary":
        "Everyone writes a witty answer to two secret prompts, then votes blind for the funniest response — you can't vote for your own. Land a unanimous ZAP! for a bonus, then duke it out in the fast, high-stakes Lightning Round finale.",
      "games.zaplash.packs.core": "Banterbolt Core (Family Friendly)",
      "games.zaplash.packs.office": "Office Chaos (Family Friendly)",
      "games.zaplash.packs.popculture": "Screen Time (Family Friendly)",
      "games.zaplash.packs.fantasy": "Multiverse Mayhem (Family Friendly)",
      "games.zaplash.packs.afterdark": "Banterbolt After Dark (Mildly Spicy)",
      "games.zaplash.settings.rounds": "Number of Rounds",
      "games.zaplash.settings.writeSeconds": "Writing Time (seconds)",
      "games.zaplash.settings.voteSeconds": "Voting Time (seconds)",
      "games.zaplash.settings.zapBonus": "ZAP! Clean Sweep Bonus (+50)",
      "games.zaplash.settings.lightningRound": "Lightning Round Finale",
      "games.zaplash.settings.packId": "Content Pack",
      "games.zaplash.phase.write": "Writing Phase",
      "games.zaplash.phase.vote": "Voting Phase",
      "games.zaplash.phase.reveal": "Reveal Phase",
      "games.zaplash.phase.scoreboard": "Scoreboard",
      "games.zaplash.phase.finale_write": "Lightning Round — Writing",
      "games.zaplash.phase.finale_vote": "Lightning Round — Voting",
      "games.zaplash.phase.finale_reveal": "Lightning Round — Results",
      "games.zaplash.phase.game_over": "Game Over",
      "games.zaplash.ui.loading": "Loading...",
      "games.zaplash.ui.round_info": "Round {round} of {total}",
      "games.zaplash.ui.matchup_progress": "Matchup {current} of {total}",
      "games.zaplash.ui.players_writing": "Players are writing...",
      "games.zaplash.ui.writing": "Writing",
      "games.zaplash.ui.done": "Done",
      "games.zaplash.ui.voted_status": "Voters",
      "games.zaplash.ui.votes_count": "{count} votes",
      "games.zaplash.ui.scoreboard_title": "Current Standings",
      "games.zaplash.ui.wrap_title": "That's a Wrap!",
      "games.zaplash.ui.wrap_subtitle": "Check out the main screen podium for final results!",
      "games.zaplash.ui.write_prompts_title": "Answer your two prompts!",
      "games.zaplash.ui.prompt_num": "Prompt #{num}",
      "games.zaplash.ui.submitted": "Submitted",
      "games.zaplash.ui.type_answer_ph": "Type your witty response...",
      "games.zaplash.ui.chars_left": "chars left",
      "games.zaplash.ui.submit_btn": "Submit",
      "games.zaplash.ui.safety_quip_btn": "Safety Quip",
      "games.zaplash.ui.waiting_for_others": "Answers locked! Waiting for other players...",
      "games.zaplash.ui.you_wrote_one": "You wrote one of these answers! Sit tight while others vote.",
      "games.zaplash.ui.vote_locked": "Vote locked in!",
      "games.zaplash.ui.look_at_tv": "Look at the TV screen!",
      "games.zaplash.ui.game_over": "Match Finished!",
      "games.zaplash.ui.jinx_title": "JINX!",
      "games.zaplash.ui.jinx_subtitle": "Great minds. Zero points.",
      "games.zaplash.ui.finale_title": "Lightning Round",
      "games.zaplash.ui.finale_write_title": "Everyone answers the SAME prompt!",
      "games.zaplash.ui.finale_vote_title": "Vote for your favorite!",
      "games.zaplash.ui.finale_reveal_title": "Lightning Round Results",
      "games.zaplash.ui.finale_waiting": "Locked in! Waiting for the lightning to strike...",
      "games.zaplash.ui.finale_vote_locked": "Vote locked in!",
      "games.zaplash.ui.finale_your_answer": "This one's yours! Sit tight while others vote.",
      "games.zaplash.ui.finale_not_enough": "Not enough answers this time — no votes cast.",
    },
  },
  init(ctx) {
    return initZaplash(ctx);
  },
  reduce(ctx, state, action) {
    return reduceZaplash(ctx, state, action);
  },
  onTick(ctx, state) {
    return onTickZaplash(ctx, state);
  },
  awaitedSeats(ctx, state) {
    return awaitedSeatsZaplash(ctx, state);
  },
  suggestBotAction() {
    return null;
  },
  onSeatAbandoned(ctx, state, seat) {
    return onSeatAbandonedZaplash(ctx, state, seat);
  },
  ui: {
    Stage: ZaplashStage,
    Controller: ZaplashController,
    LobbyOptions: ZaplashLobbyOptions,
  },
});
