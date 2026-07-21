import { defineGame } from "@merky/game-sdk";
import { EightstormStage } from "./Stage";
import { EightstormController } from "./Controller";
import { EightstormLobbyOptions } from "./LobbyOptions";
import {
  initEightstorm,
  reduceEightstorm,
  onTickEightstorm,
  awaitedSeatsEightstorm,
  suggestBotActionEightstorm,
  onSeatAbandonedEightstorm,
} from "./logic";

export const eightstorm = defineGame({
  meta: {
    id: "eightstorm",
    nameKey: "games.eightstorm.name",
    descriptionKey: "games.eightstorm.description",
    minPlayers: 2,
    maxPlayers: 8,
    supportsSpectators: true,
    supportsMidGameJoin: true,
    tags: ["cards", "turn-based"],
    defaultSettings: {
      drawTwoOnTwo: true,
      skipOnJack: true,
      reverseOnAce: true,
      jokers: false,
      turnSeconds: 45,
    },
    settingFields: [
      {
        key: "drawTwoOnTwo",
        labelKey: "games.eightstorm.settings.drawTwoOnTwo",
        type: "boolean",
        default: true,
      },
      {
        key: "skipOnJack",
        labelKey: "games.eightstorm.settings.skipOnJack",
        type: "boolean",
        default: true,
      },
      {
        key: "reverseOnAce",
        labelKey: "games.eightstorm.settings.reverseOnAce",
        type: "boolean",
        default: true,
      },
      {
        key: "jokers",
        labelKey: "games.eightstorm.settings.jokers",
        type: "boolean",
        default: false,
      },
      {
        key: "turnSeconds",
        labelKey: "games.eightstorm.settings.turnSeconds",
        type: "number",
        default: 45,
        min: 15,
        max: 120,
        step: 15,
      },
    ],
  },
  i18n: {
    en: {
      "games.eightstorm.name": "Eightstorm",
      "games.eightstorm.description": "Shed your cards, ride the eights, storm the discard pile.",
      "games.eightstorm.lobby.rules_summary":
        "Match the top card by suit or rank, or drop an eight to storm in a new suit. House rules can stack 2s onto the next player, skip with a Jack, or reverse with an Ace. First to empty their hand wins, scored on everyone else's leftover cards.",
      "games.eightstorm.settings.drawTwoOnTwo": "2s stack a draw penalty",
      "games.eightstorm.settings.skipOnJack": "Jacks skip the next player",
      "games.eightstorm.settings.reverseOnAce": "Aces reverse direction",
      "games.eightstorm.settings.jokers": "Include jokers (extra wilds)",
      "games.eightstorm.settings.jokersHint": "Adds 2 jokers that play like eights",
      "games.eightstorm.settings.turnSeconds": "Turn Timer (seconds)",
      "games.eightstorm.phase.turn": "{name}'s Turn",
      "games.eightstorm.phase.game_over": "Game Over!",
      "games.eightstorm.suits.S": "♠ Suit",
      "games.eightstorm.suits.H": "♥ Suit",
      "games.eightstorm.suits.D": "♦ Suit",
      "games.eightstorm.suits.C": "♣ Suit",
      "games.eightstorm.suits.X": "Joker",
      "games.eightstorm.action.played": "{name} played a card",
      "games.eightstorm.action.drew": "{name} drew a card",
      "games.eightstorm.action.passed": "{name} passed their turn",
      "games.eightstorm.ui.loading": "Loading...",
      "games.eightstorm.ui.direction": "Direction",
      "games.eightstorm.ui.draw": "Draw Card",
      "games.eightstorm.ui.draw_pending": "Draw {count} Cards",
      "games.eightstorm.ui.pass": "Pass Turn",
      "games.eightstorm.ui.choose_suit_title": "Choose Next Suit",
      "games.eightstorm.ui.your_turn": "Your Turn!",
      "games.eightstorm.ui.waiting_for": "Waiting for {name}...",
      "games.eightstorm.ui.cards_left": "{count} cards left",
      "games.eightstorm.ui.pending_draw": "+{count} Draw Penalty",
      "games.eightstorm.ui.top_card": "Top Discard Card",
      "games.eightstorm.ui.active_suit": "Active Suit",
      "games.eightstorm.ui.turn_label": "Active Turn",
      "games.eightstorm.ui.your_hand": "Your Hand ({count})",
      "games.eightstorm.ui.must_stack_or_draw": "Must play a +2 or draw penalty!",
      "games.eightstorm.ui.winner_storms": "{name} storms it!",
    },
  },
  init(ctx) {
    return initEightstorm(ctx);
  },
  reduce(ctx, state, action) {
    return reduceEightstorm(ctx, state, action);
  },
  onTick(ctx, state) {
    return onTickEightstorm(ctx, state);
  },
  awaitedSeats(ctx, state) {
    return awaitedSeatsEightstorm(ctx, state);
  },
  suggestBotAction(ctx, state, seat) {
    return suggestBotActionEightstorm(ctx, state, seat);
  },
  onSeatAbandoned(ctx, state, seat) {
    return onSeatAbandonedEightstorm(ctx, state, seat);
  },
  ui: {
    Stage: EightstormStage,
    Controller: EightstormController,
    LobbyOptions: EightstormLobbyOptions,
  },
});
