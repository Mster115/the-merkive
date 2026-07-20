import { defineGame } from "@merky/game-sdk";
import {
  initSecretMerk,
  reduceSecretMerk,
  onTickSecretMerk,
  onSeatAbandonedSecretMerk,
  awaitedSeatsSecretMerk,
  suggestBotActionSecretMerk,
} from "./logic";
import { Stage } from "./Stage";
import { Controller } from "./Controller";
import { SecretMerkLobbyOptions } from "./LobbyOptions";

export const secretmerk = defineGame({
  meta: {
    id: "secretmerk",
    nameKey: "games.secretmerk.name",
    descriptionKey: "games.secretmerk.description",
    minPlayers: 5,
    maxPlayers: 8,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["social-deduction", "bluffing", "teams"],
    defaultSettings: { turnSeconds: 45, hardcoreParanoia: false, vetoPower: true },
    settingFields: [],
  },
  i18n: {
    en: {
      "games.secretmerk.name": "Secret Merk",
      "games.secretmerk.description": "Undercover social deduction. Elect governments, pass decrees, and unmask the Secret Merk.",
      "games.secretmerk.setting.turnSeconds": "Turn & Vote Duration",
      "games.secretmerk.yourRole": "Secret Role",
      "games.secretmerk.nominate": "Nominate Chancellor",
      "games.secretmerk.vote": "Vote on Government",
      "games.secretmerk.enact": "Enact Decree",
      "games.secretmerk.loyalists": "Loyalists",
      "games.secretmerk.merkers": "Merker Underground",
      "games.secretmerk.secretMerk": "Secret Merk",
    },
  },
  init: initSecretMerk,
  reduce: reduceSecretMerk,
  onTick: onTickSecretMerk,
  onSeatAbandoned: onSeatAbandonedSecretMerk,
  awaitedSeats: awaitedSeatsSecretMerk,
  suggestBotAction: suggestBotActionSecretMerk,
  ui: {
    Stage,
    Controller,
    LobbyOptions: SecretMerkLobbyOptions,
  },
});
