export class ServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const errors = {
  roomNotFound: () => new ServiceError("room_not_found", "That room doesn't exist or has expired.", 404),
  roomFull: () => new ServiceError("room_full", "The room is full.", 409),
  roomInGame: () => new ServiceError("room_in_game", "A match is already running — you can watch as a spectator.", 409),
  notHost: () => new ServiceError("not_host", "Only the host can do that.", 403),
  notSeated: () => new ServiceError("not_seated", "You don't have a seat in this room.", 403),
  kicked: () => new ServiceError("kicked", "You were removed from this room.", 403),
  notInLobby: () => new ServiceError("not_in_lobby", "That can only happen in the lobby.", 409),
  noActiveMatch: () => new ServiceError("no_active_match", "There is no active match.", 409),
  versionConflict: () => new ServiceError("version_conflict", "The game state moved on — syncing.", 409),
  gameUnknown: () => new ServiceError("game_unknown", "Unknown game.", 400),
  needPlayers: (min: number) => new ServiceError("need_players", `Need at least ${min} players to start.`, 409),
  spectatorCap: () => new ServiceError("spectator_cap", "Spectator limit reached.", 409),
  rateLimited: () => new ServiceError("rate_limited", "Too many actions — slow down.", 429),
} as const;
