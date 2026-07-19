import type {
  RoomMessage
} from "@/shared/messages";
import type {
  CustomPackRecord,
  MatchRecord,
  MatchUpdate,
  PlayerSeatRecord,
  RoomRecord,
  RoomStore,
  SpectatorRecord,
} from "./types";
import type { SeatIndex } from "@merky/game-sdk";
import type { GameEvent } from "@merky/game-sdk";

export class PartyKitStore implements RoomStore {
  readonly kind = "partykit" as const;

  private get partyUrl() {
    const host = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
    const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
    return `${protocol}://${host}`;
  }

  private async fetchStore(endpoint: string, options?: RequestInit) {
    const url = `${this.partyUrl}/parties/room/store${endpoint}`;
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`PartyKitStore error on ${endpoint}: ${res.statusText}`);
    }
    return res.json();
  }

  async createRoom(room: RoomRecord): Promise<void> {
    await this.fetchStore("/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(room),
    });
  }

  async getRoomByCode(code: string): Promise<RoomRecord | null> {
    return this.fetchStore(`/get-room?code=${encodeURIComponent(code)}`).catch(() => null);
  }

  async getRoomById(roomId: string): Promise<RoomRecord | null> {
    return this.fetchStore(`/get-room?id=${encodeURIComponent(roomId)}`).catch(() => null);
  }

  async updateRoom(roomId: string, patch: Partial<RoomRecord>): Promise<void> {
    await this.fetchStore("/update-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, patch }),
    });
  }

  async listActiveRooms(): Promise<RoomRecord[]> {
    return this.fetchStore("/list-rooms?active=true").catch(() => []);
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.fetchStore(`/delete-room?roomId=${encodeURIComponent(roomId)}`, { method: "DELETE" });
  }

  async listSeats(roomId: string): Promise<PlayerSeatRecord[]> {
    return this.fetchStore(`/seats?roomId=${encodeURIComponent(roomId)}`).catch(() => []);
  }

  async upsertSeat(seat: PlayerSeatRecord): Promise<void> {
    await this.fetchStore("/upsert-seat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seat),
    });
  }

  async updateSeat(roomId: string, seatIndex: SeatIndex, patch: Partial<PlayerSeatRecord>): Promise<void> {
    await this.fetchStore("/update-seat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, seatIndex, patch }),
    });
  }

  async removeSeat(roomId: string, seatIndex: SeatIndex): Promise<void> {
    await this.fetchStore(`/remove-seat?roomId=${encodeURIComponent(roomId)}&seatIndex=${seatIndex}`, {
      method: "DELETE",
    });
  }

  async listSpectators(roomId: string): Promise<SpectatorRecord[]> {
    return this.fetchStore(`/spectators?roomId=${encodeURIComponent(roomId)}`).catch(() => []);
  }

  async upsertSpectator(spectator: SpectatorRecord): Promise<void> {
    await this.fetchStore("/upsert-spectator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spectator),
    });
  }

  async removeSpectator(roomId: string, uid: string): Promise<void> {
    await this.fetchStore(`/remove-spectator?roomId=${encodeURIComponent(roomId)}&uid=${encodeURIComponent(uid)}`, {
      method: "DELETE",
    });
  }

  async createMatch(match: MatchRecord, initialEvents: GameEvent[]): Promise<void> {
    await this.fetchStore("/create-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match, initialEvents }),
    });
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    return this.fetchStore(`/get-match?id=${encodeURIComponent(matchId)}`).catch(() => null);
  }

  async getActiveMatch(roomId: string): Promise<MatchRecord | null> {
    return this.fetchStore(`/get-match?roomId=${encodeURIComponent(roomId)}&active=true`).catch(() => null);
  }

  async applyMatchUpdate(matchId: string, expectedVersion: number, update: MatchUpdate): Promise<"ok" | "conflict"> {
    const res = await fetch(`${this.partyUrl}/parties/room/store/apply-match-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, expectedVersion, update }),
    });
    if (!res.ok) return "conflict";
    const data = await res.json();
    return data.status as "ok" | "conflict";
  }

  async listCustomPacks(gameId: string): Promise<CustomPackRecord[]> {
    return this.fetchStore(`/list-packs?gameId=${encodeURIComponent(gameId)}`).catch(() => []);
  }

  async createCustomPack(pack: CustomPackRecord): Promise<void> {
    await this.fetchStore("/create-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack),
    });
  }

  async publish(code: string, msg: RoomMessage): Promise<void> {
    const url = `${this.partyUrl}/parties/room/${code}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg }),
    }).catch((err) => {
      console.error("PartyKit relay error:", err);
    });
  }
}
