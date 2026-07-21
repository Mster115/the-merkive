import { defineGame } from "@merky/game-sdk";
import { MerkissionerStage } from "./Stage";
import { MerkissionerController } from "./Controller";
import { MerkissionerLobbyOptions } from "./LobbyOptions";
import {
  awaitedSeatsMerkissioner,
  initMerkissionerGame,
  onSeatAbandonedMerkissioner,
  onTickMerkissioner,
  reduceMerkissioner,
  suggestBotActionMerkissioner,
} from "./logic";

export const merkissioner = defineGame({
  meta: {
    id: "merkissioner",
    nameKey: "games.merkissioner.name",
    descriptionKey: "games.merkissioner.description",
    taglineKey: "games.merkissioner.tagline",
    minPlayers: 5,
    maxPlayers: 8,
    supportsSpectators: true,
    supportsMidGameJoin: false,
    tags: ["party", "deduction", "bluffing"],
    defaultSettings: {
      pace: "standard",
      timersEnabled: true,
      revealVotes: true,
    },
    settingFields: [
      {
        key: "pace",
        labelKey: "games.merkissioner.settings.pace",
        type: "select",
        default: "standard",
        options: [
          { value: "relaxed", labelKey: "games.merkissioner.settings.pace.relaxed" },
          { value: "standard", labelKey: "games.merkissioner.settings.pace.standard" },
          { value: "speedy", labelKey: "games.merkissioner.settings.pace.speedy" },
        ],
      },
      {
        key: "timersEnabled",
        labelKey: "games.merkissioner.settings.timersEnabled",
        type: "boolean",
        default: true,
      },
      {
        key: "revealVotes",
        labelKey: "games.merkissioner.settings.revealVotes",
        type: "boolean",
        default: true,
      },
    ],
  },
  i18n: {
    en: {
      "games.merkissioner.name": "Mr Merkissioner, Sir",
      "games.merkissioner.description":
        "Pass decrees, sniff out the Merkites, and never — EVER — hand Mr Merkissioner the Commissioner's seat.",
      "games.merkissioner.tagline": "Trust no one. Merk everyone.",
      "games.merkissioner.credits":
        "Mechanics inspired by Secret Hitler (Goat, Wolf & Cabbage — CC BY-NC-SA 4.0).",

      "games.merkissioner.settings.pace": "Pace",
      "games.merkissioner.settings.pace.relaxed": "Relaxed — 90s",
      "games.merkissioner.settings.pace.standard": "Standard — 60s",
      "games.merkissioner.settings.pace.speedy": "Speedy — 30s",
      "games.merkissioner.settings.timersEnabled": "Timers",
      "games.merkissioner.settings.timersEnabledHint": "Auto-resolve stalled phases with a countdown.",
      "games.merkissioner.settings.revealVotes": "Reveal Votes",
      "games.merkissioner.settings.revealVotesHint": "Show each player's MERK YEAH/NAH after the tally.",

      "games.merkissioner.lobby.subtitle": "Customize pace, timers, and vote transparency",
      "games.merkissioner.lobby.how_it_plays": "How it plays",
      "games.merkissioner.lobby.player_count_label": "{count} players",
      "games.merkissioner.lobby.role_line": "{merkizen} Merkizens · {merkite} Merkite(s) · 1 Mr Merkissioner",
      "games.merkissioner.lobby.rules_summary":
        "Chairs nominate Commissioners. The council votes. Pass enough Merkite decrees or elect the hidden boss, and the Merkites win. Merkizens win by passing 5 Merkizen decrees or banishing the boss first.",

      "games.merkissioner.team.merkizen": "Merkizens",
      "games.merkissioner.team.merkite": "Merkites",
      "games.merkissioner.role.merkizen": "Merkizen",
      "games.merkissioner.role.merkite": "Merkite",
      "games.merkissioner.role.merkissioner": "Mr Merkissioner",
      "games.merkissioner.role.merkizen.desc": "You have no idea who anyone is. Vote your conscience and pass Merkizen Decrees.",
      "games.merkissioner.role.merkite.desc": "Help your fellow Merkites pass Decrees — and if the moment is right, sneak your boss into the Commissioner's seat.",
      "games.merkissioner.role.merkissioner.desc": "You are the boss. Stay quiet, act Merkizen, and get elected Commissioner once 3 Merkite Decrees are down.",
      "games.merkissioner.ui.known_merkites": "Merkites you know",
      "games.merkissioner.ui.known_boss": "Mr Merkissioner is",
      "games.merkissioner.ui.no_knowledge": "You recognize no one yet — trust your gut.",

      "games.merkissioner.phase.huddle": "The Secret Huddle",
      "games.merkissioner.phase.nominate": "Nominating a Commissioner",
      "games.merkissioner.phase.vote": "Voting on the government",
      "games.merkissioner.phase.legislative_chair": "The Chair is reviewing decrees",
      "games.merkissioner.phase.legislative_commissioner": "The Commissioner is deciding",
      "games.merkissioner.phase.veto_pending": "Veto on the table",
      "games.merkissioner.phase.power_audit": "Loyalty Audit",
      "games.merkissioner.phase.power_snap": "Snap Election",
      "games.merkissioner.phase.power_peek": "Docket Peek",
      "games.merkissioner.phase.power_banish": "Banishment",
      "games.merkissioner.phase.game_over": "Game over",

      "games.merkissioner.ui.loading": "Loading...",
      "games.merkissioner.ui.round_number": "Round {number}",

      "games.merkissioner.ui.huddle_title": "THE SECRET HUDDLE",
      "games.merkissioner.ui.huddle_instruction": "Check your phone. Keep your merking mouth shut.",
      "games.merkissioner.ui.huddle_waiting_stage": "Waiting on {count} council member(s)…",
      "games.merkissioner.ui.your_role": "Your role",
      "games.merkissioner.ui.ready_button": "I'm Ready",
      "games.merkissioner.ui.ready_confirmed": "Ready! Waiting on everyone else…",
      "games.merkissioner.ui.ready_count": "{ready}/{total} ready",

      "games.merkissioner.ui.merkizen_track": "Merkizen Decrees",
      "games.merkissioner.ui.merkite_track": "Merkite Decrees",
      "games.merkissioner.ui.gridlock_meter": "Gridlock Meter",
      "games.merkissioner.ui.gridlock_warning": "One more failed vote and it's MERKY ANARCHY!",
      "games.merkissioner.ui.draw_pile": "Draw",
      "games.merkissioner.ui.discard_pile": "Discard",

      "games.merkissioner.ui.chair_label": "CHAIR",
      "games.merkissioner.ui.commissioner_label": "COMMISSIONER",
      "games.merkissioner.ui.nominee_label": "NOMINEE",
      "games.merkissioner.ui.choose_commissioner": "Choose your Commissioner",
      "games.merkissioner.ui.chair_choosing": "{name} is choosing a Commissioner…",
      "games.merkissioner.ui.term_limited_last_commissioner": "Just served as Commissioner",
      "games.merkissioner.ui.term_limited_last_chair": "Just served as Chair",
      "games.merkissioner.ui.nominate_button": "Nominate",
      "games.merkissioner.ui.you_are_chair": "You are the Chair",

      "games.merkissioner.ui.vote_prompt": "Elect this government?",
      "games.merkissioner.ui.vote_yeah": "MERK YEAH!",
      "games.merkissioner.ui.vote_nah": "MERK NAH!",
      "games.merkissioner.ui.vote_change_hint": "You can change your vote until everyone's in",
      "games.merkissioner.ui.vote_locked_in": "Vote locked in — waiting on the rest of the council",
      "games.merkissioner.ui.ballots_in": "Ballots in: {cast}/{total}",
      "games.merkissioner.ui.vote_passed": "MERK YEAH WINS",
      "games.merkissioner.ui.vote_failed": "MERK NAH WINS",
      "games.merkissioner.ui.vote_tally": "{yeah} — {nah}",
      "games.merkissioner.ui.vote_auto_notice": "Time's up — missing ballots were cast at random",
      "games.merkissioner.ui.gridlock_bumped": "Gridlock Meter +1",

      "games.merkissioner.ui.your_hand": "Your decrees",
      "games.merkissioner.ui.discard_this": "Discard This",
      "games.merkissioner.ui.enact_this": "Enact This",
      "games.merkissioner.ui.select_a_card": "Select a decree first",
      "games.merkissioner.ui.chair_deciding_stage": "The Chair is reviewing the docket…",
      "games.merkissioner.ui.commissioner_deciding_stage": "The Commissioner is deciding…",
      "games.merkissioner.ui.chair_deciding_hint": "The Chair is fondling the docket…",
      "games.merkissioner.ui.commissioner_deciding_hint": "The Commissioner is weighing their options…",
      "games.merkissioner.ui.decree_merkizen": "Merkizen Decree",
      "games.merkissioner.ui.decree_merkite": "Merkite Decree",
      "games.merkissioner.ui.decree_enacted_banner": "{name} enacted a {decree}",
      "games.merkissioner.ui.you_are_commissioner": "You are the Commissioner",

      "games.merkissioner.ui.propose_veto": "Propose Veto",
      "games.merkissioner.ui.veto_agree": "Agree to Veto",
      "games.merkissioner.ui.veto_refuse": "Force Enactment",
      "games.merkissioner.ui.veto_pending_title": "VETO ON THE TABLE",
      "games.merkissioner.ui.veto_pending_chair_prompt": "The Commissioner wants to veto both decrees. Agree?",
      "games.merkissioner.ui.veto_pending_wait": "Waiting on the Chair to rule on the veto…",
      "games.merkissioner.ui.veto_agreed_banner": "Veto agreed — both decrees discarded",
      "games.merkissioner.ui.veto_refused_banner": "Veto refused — the Commissioner must enact one",

      "games.merkissioner.power.audit": "Loyalty Audit",
      "games.merkissioner.power.snap": "Snap Election",
      "games.merkissioner.power.peek": "Docket Peek",
      "games.merkissioner.power.banish": "Banish",
      "games.merkissioner.ui.power_banner_audit": "LOYALTY AUDIT — the Chair is checking someone's receipts",
      "games.merkissioner.ui.power_banner_snap": "SNAP ELECTION — the Chair is naming the next candidate",
      "games.merkissioner.ui.power_banner_peek": "DOCKET PEEK — the Chair is scouting ahead",
      "games.merkissioner.ui.power_banner_banish": "BANISH — the Chair must remove someone from the council",
      "games.merkissioner.ui.power_target_prompt_audit": "Audit someone's loyalty",
      "games.merkissioner.ui.power_target_prompt_snap": "Call a Snap Election",
      "games.merkissioner.ui.power_target_prompt_banish": "Banish a council member",
      "games.merkissioner.ui.power_waiting_audit": "{name} is checking someone's receipts…",
      "games.merkissioner.ui.power_waiting_snap": "{name} is calling a snap election…",
      "games.merkissioner.ui.power_waiting_peek": "{name} is peeking at the docket…",
      "games.merkissioner.ui.power_waiting_banish": "{name} is deciding who to banish…",
      "games.merkissioner.ui.already_audited_badge": "Already audited",
      "games.merkissioner.ui.audit_result_title": "Audit Result",
      "games.merkissioner.ui.audit_result_body": "{name} reads as a {party}",
      "games.merkissioner.ui.peek_result_title": "Docket Peek",
      "games.merkissioner.ui.peek_result_body": "The next 3 decrees, in order:",
      "games.merkissioner.ui.snap_confirm": "Name Snap Candidate",
      "games.merkissioner.ui.banish_confirm": "Banish",
      "games.merkissioner.ui.use_power_button": "Use Power",
      "games.merkissioner.ui.peek_fire_button": "Peek the Docket",
      "games.merkissioner.ui.close": "Close",

      "games.merkissioner.ui.banished_title": "BANISHED FROM THE COUNCIL",
      "games.merkissioner.ui.banished_you": "You've been BANISHED",
      "games.merkissioner.ui.banished_no_talking": "No talking. You're out of the council for good.",
      "games.merkissioner.ui.spectate_hint": "Watch the rest of the game play out below.",
      "games.merkissioner.ui.banished_list": "Banished",

      "games.merkissioner.ui.anarchy_title": "MERKY ANARCHY",
      "games.merkissioner.ui.anarchy_body": "Three failed votes! The top decree auto-enacts and term limits reset.",

      "games.merkissioner.ui.game_over_title": "GAME OVER",
      "games.merkissioner.ui.victory": "VICTORY!",
      "games.merkissioner.ui.defeat": "DEFEAT",
      "games.merkissioner.ui.winner_banner": "{team} WIN",
      "games.merkissioner.ui.win_reason.merkizen_decrees": "5 Merkizen Decrees enacted",
      "games.merkissioner.ui.win_reason.boss_banished": "Mr Merkissioner was banished",
      "games.merkissioner.ui.win_reason.merkite_decrees": "6 Merkite Decrees enacted",
      "games.merkissioner.ui.win_reason.boss_elected": "Mr Merkissioner was elected Commissioner",
      "games.merkissioner.ui.boss_reveal": "MR MERKISSIONER WAS {name}",
      "games.merkissioner.ui.role_reveal_title": "Every role, revealed",
      "games.merkissioner.ui.your_result": "Your result",

      "games.merkissioner.ui.on": "ON",
      "games.merkissioner.ui.off": "OFF",
    },
  },
  init(ctx) {
    return initMerkissionerGame(ctx);
  },
  reduce(ctx, state, action) {
    return reduceMerkissioner(ctx, state, action);
  },
  onTick(ctx, state) {
    return onTickMerkissioner(ctx, state);
  },
  onSeatAbandoned(ctx, state, seat) {
    return onSeatAbandonedMerkissioner(ctx, state, seat);
  },
  awaitedSeats(ctx, state) {
    return awaitedSeatsMerkissioner(ctx, state);
  },
  suggestBotAction(ctx, state, seat) {
    return suggestBotActionMerkissioner(ctx, state, seat);
  },
  ui: {
    Stage: MerkissionerStage,
    Controller: MerkissionerController,
    LobbyOptions: MerkissionerLobbyOptions,
  },
});
