export type RoomStatusDb = "lobby" | "in_game" | "ended" | "expired";
export type MatchStatusDb = "active" | "completed" | "aborted";
export type FriendshipStatusDb = "pending" | "accepted" | "declined" | "blocked";

export interface ProfilesRow {
  id: string;
  display_name: string;
  avatar_id: string;
  created_at: string;
  updated_at: string;
}

export interface FriendshipsRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatusDb;
  created_at: string;
  updated_at: string;
}

export interface RoomsRow {
  id: string;
  code: string;
  status: RoomStatusDb;
  host_seat: number | null;
  game_id: string | null;
  settings: Record<string, unknown>;
  max_players: number;
  paused_at: string | null;
  last_match: unknown | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface SeatsRow {
  room_id: string;
  seat_index: number;
  player_uid: string;
  display_name: string;
  avatar_id: string;
  connected: boolean;
  joined_at: string;
  last_seen_at: string;
  disconnected_at: string | null;
  abandoned: boolean;
}

export interface SpectatorsRow {
  room_id: string;
  uid: string;
  display_name: string;
  avatar_id: string;
  connected: boolean;
  last_seen_at: string;
}

export interface MatchesRow {
  id: string;
  room_id: string;
  game_id: string;
  status: MatchStatusDb;
  phase: string;
  seed: string;
  version: number;
  settings: Record<string, unknown>;
  public_state: unknown;
  scores: Record<string, number>;
  timer: unknown | null;
  over: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface MatchPrivateStateRow {
  match_id: string;
  seat_index: number;
  state: unknown;
}

export interface MatchEventsRow {
  id: number;
  match_id: string;
  seq: number;
  event: unknown;
  created_at: string;
}

export interface ContentPacksRow {
  id: string;
  game_id: string;
  title: string;
  locale: string;
  payload: unknown;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfilesRow; Insert: Omit<ProfilesRow, "created_at" | "updated_at">; Update: Partial<ProfilesRow> };
      friendships: { Row: FriendshipsRow; Insert: Omit<FriendshipsRow, "id" | "created_at" | "updated_at">; Update: Partial<FriendshipsRow> };
      rooms: { Row: RoomsRow; Insert: Omit<RoomsRow, "created_at" | "updated_at">; Update: Partial<RoomsRow> };
      seats: { Row: SeatsRow; Insert: SeatsRow; Update: Partial<SeatsRow> };
      spectators: { Row: SpectatorsRow; Insert: SpectatorsRow; Update: Partial<SpectatorsRow> };
      matches: { Row: MatchesRow; Insert: MatchesRow; Update: Partial<MatchesRow> };
      match_private_state: { Row: MatchPrivateStateRow; Insert: MatchPrivateStateRow; Update: Partial<MatchPrivateStateRow> };
      match_events: { Row: MatchEventsRow; Insert: Omit<MatchEventsRow, "id" | "created_at">; Update: Partial<MatchEventsRow> };
      content_packs: { Row: ContentPacksRow; Insert: Omit<ContentPacksRow, "created_at">; Update: Partial<ContentPacksRow> };
    };
    Functions: {
      apply_match_update: {
        Args: {
          p_match_id: string;
          p_expected_version: number;
          p_phase: string;
          p_public_state: unknown;
          p_private_patch: unknown;
          p_scores_patch: unknown;
          p_timer: unknown;
          p_timer_set: boolean;
          p_over: boolean;
          p_status: string | null;
          p_ended_at: string | null;
          p_events: unknown;
        };
        Returns: boolean;
      };
    };
  };
}
