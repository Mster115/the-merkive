import { defineGame } from "@merky/game-sdk";
import { MerkadeStage } from "./Stage";
import { MerkadeController } from "./Controller";
import { MerkadeLobbyOptions } from "./LobbyOptions";
import { corePack } from "./packs";
import {
  initMerkadeGame,
  reduceMerkade,
  onTickMerkade,
  onSeatAbandonedMerkade,
  awaitedSeatsMerkade,
  suggestBotActionMerkade,
} from "./logic";

export const merkade = defineGame({
  meta: {
    id: "merkade",
    nameKey: "games.merkade.name",
    descriptionKey: "games.merkade.description",
    taglineKey: "games.merkade.tagline",
    minPlayers: 3,
    maxPlayers: 8,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["party", "variety", "bluffing", "drawing", "trivia"],
    defaultSettings: {
      roundCount: 6,
      answerSeconds: 30,
      voteSeconds: 20,
      drawSeconds: 60,
      guessSeconds: 25,
      pack: "core",
    },
    settingFields: [
      {
        key: "roundCount",
        labelKey: "games.merkade.settings.roundCount",
        type: "number",
        default: 6,
        min: 3,
        max: 9,
        step: 3,
      },
      {
        key: "answerSeconds",
        labelKey: "games.merkade.settings.answerSeconds",
        type: "number",
        default: 30,
        min: 15,
        max: 60,
        step: 5,
      },
      {
        key: "voteSeconds",
        labelKey: "games.merkade.settings.voteSeconds",
        type: "number",
        default: 20,
        min: 10,
        max: 45,
        step: 5,
      },
      {
        key: "drawSeconds",
        labelKey: "games.merkade.settings.drawSeconds",
        type: "number",
        default: 60,
        min: 30,
        max: 120,
        step: 15,
      },
      {
        key: "guessSeconds",
        labelKey: "games.merkade.settings.guessSeconds",
        type: "number",
        default: 25,
        min: 10,
        max: 45,
        step: 5,
      },
      {
        key: "pack",
        labelKey: "games.merkade.settings.pack",
        type: "pack",
        default: "core",
      },
    ],
  },
  packs: [corePack],
  i18n: {
    en: {
      "games.merkade.name": "Merkade",
      "games.merkade.description":
        "A rotating arcade of party games — bluff, doodle, and predict your way through every track.",
      "games.merkade.tagline": "One arcade. A different game every round.",
      "games.merkade.pack.core": "Core Merkade Pack",

      "games.merkade.settings.roundCount": "Total Tracks (Rounds)",
      "games.merkade.settings.answerSeconds": "Answer Time (sec)",
      "games.merkade.settings.voteSeconds": "Vote Time (sec)",
      "games.merkade.settings.drawSeconds": "Draw Time (sec)",
      "games.merkade.settings.guessSeconds": "Guess Time (sec)",
      "games.merkade.settings.pack": "Content Pack",

      "games.merkade.format.fib": "Fib or Fact",
      "games.merkade.format.doodle": "Pixel Doodle",
      "games.merkade.format.majority": "Majority Rules",

      "games.merkade.format_desc.fib": "Write a believable lie to trick your friends into voting for it!",
      "games.merkade.format_desc.doodle": "Draw your prompt in pixel art, then guess what others drew!",
      "games.merkade.format_desc.majority": "Pick your choice and predict what the group will vote!",

      "games.merkade.phase.track_intro": "Track Intro",
      "games.merkade.phase.fib_answer": "Write a Fake Answer",
      "games.merkade.phase.fib_vote": "Spot the Truth",
      "games.merkade.phase.fib_reveal": "Fib Reveal",
      "games.merkade.phase.doodle_draw": "Draw Your Prompt",
      "games.merkade.phase.doodle_guess": "Guess the Drawing",
      "games.merkade.phase.doodle_vote": "Vote on the Best Guess",
      "games.merkade.phase.doodle_reveal_one": "Doodle Reveal",
      "games.merkade.phase.majority_answer": "Pick & Predict",
      "games.merkade.phase.majority_reveal": "Majority Reveal",
      "games.merkade.phase.game_over": "Game Over",

      "games.merkade.ui.loading": "Loading...",
      "games.merkade.ui.track_header": "Track {current} of {total}",
      "games.merkade.ui.upcoming_track": "UPCOMING TRACK",
      "games.merkade.ui.submitted_count": "{count} / {total} submitted",
      "games.merkade.ui.the_truth": "THE TRUTH",
      "games.merkade.ui.drawing_in_progress": "Drawings in Progress...",
      "games.merkade.ui.artist_spotlight": "{name}'s Masterpiece",
      "games.merkade.ui.real_prompt": "REAL PROMPT",
      "games.merkade.ui.majority_winner": "MAJORITY WINNER",
      "games.merkade.ui.final_standings": "FINAL STANDINGS",

      "games.merkade.ui.lie_submitted": "Lie Submitted! Waiting on others...",
      "games.merkade.ui.write_fake_answer": "Write a fake answer",
      "games.merkade.ui.fib_placeholder": "Type a sneaky lie...",
      "games.merkade.ui.submit_lie": "Submit Lie",
      "games.merkade.ui.spot_truth_prompt": "Which answer is the real truth?",
      "games.merkade.ui.vote_locked_in": "Vote Locked In!",
      "games.merkade.ui.your_doodle_prompt": "Your Secret Doodle Prompt",
      "games.merkade.ui.drawing_submitted": "Drawing Submitted! Waiting on others...",
      "games.merkade.ui.submit_drawing": "Submit Drawing",
      "games.merkade.ui.you_are_artist": "You are the artist! Sit back and enjoy the guesses.",
      "games.merkade.ui.guess_submitted": "Guess Submitted! Waiting on others...",
      "games.merkade.ui.guess_the_drawing": "What is this a drawing of?",
      "games.merkade.ui.guess_placeholder": "Type your guess...",
      "games.merkade.ui.submit_guess": "Submit Guess",
      "games.merkade.ui.artist_waiting_vote": "Your masterpiece is on display! Waiting on votes...",
      "games.merkade.ui.choice_submitted": "Choice & Prediction Submitted!",
      "games.merkade.ui.submit_majority": "Lock In Choice & Prediction",

      "games.merkade.ui.truth_badge": "Truth",
      "games.merkade.ui.fooled_by": "Fooler: {name}",
      "games.merkade.ui.authored_by": "By {name}",
      "games.merkade.ui.vote_singular": "{count} vote",
      "games.merkade.ui.votes_plural": "{count} votes",
      "games.merkade.ui.track_ready": "Get Ready!",
      "games.merkade.ui.next_track_starting": "Next track starting in a moment...",
      "games.merkade.ui.clear": "Clear",
      "games.merkade.ui.majority_step1": "Step 1: Your Choice",
      "games.merkade.ui.majority_step2": "Step 2: Which will win the majority vote?",
      "games.merkade.ui.look_at_tv": "Look at the TV!",
      "games.merkade.ui.results_revealing": "Results and scores are being revealed on the main screen.",
      "games.merkade.ui.artist_drawing_label": "{name}'s Drawing",
      "games.merkade.ui.tracks_unit": "{count} Tracks",
      "games.merkade.ui.seconds_unit": "{sec}s",
      "games.merkade.ui.track_tooltip": "Track {num}: {format}",

      "games.merkade.color.eraser": "Eraser",
      "games.merkade.color.cyan": "Cyan",
      "games.merkade.color.gold": "Gold",
      "games.merkade.color.pink": "Pink",
    },
  },
  init(ctx) {
    return initMerkadeGame(ctx);
  },
  reduce(ctx, state, action) {
    return reduceMerkade(ctx, state, action);
  },
  onTick(ctx, state) {
    return onTickMerkade(ctx, state);
  },
  onSeatAbandoned(ctx, state, seat) {
    return onSeatAbandonedMerkade(ctx, state, seat);
  },
  awaitedSeats(ctx, state) {
    return awaitedSeatsMerkade(ctx, state);
  },
  suggestBotAction(ctx, state, seat) {
    return suggestBotActionMerkade(ctx, state, seat);
  },
  ui: {
    Stage: MerkadeStage,
    Controller: MerkadeController,
    LobbyOptions: MerkadeLobbyOptions,
  },
});
