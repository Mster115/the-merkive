import { NextResponse } from "next/server";
import { jsonError, readJson, type RouteParams } from "@/server/api";
import { normalizeCode } from "@/server/codes";
import { readIdentity } from "@/server/identity";
import { withRoomLock } from "@/server/lock";
import { getStore } from "@/server/store";
import { roomView } from "@/server/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code: rawCode } = await params;
    const code = normalizeCode(rawCode);
    if (!code) {
      return NextResponse.json({ error: "Room not found.", code: "room_not_found" }, { status: 404 });
    }

    const uid = await readIdentity(code);
    if (!uid) {
      return NextResponse.json({ error: "Not seated.", code: "not_seated" }, { status: 401 });
    }

    const store = getStore();
    const body = await readJson(req);
    const isBye = Boolean(body.bye);

    await withRoomLock(code, async () => {
      const room = await store.getRoomByCode(code);
      if (!room || room.status === "expired") return;

      const seats = await store.listSeats(room.id);
      const seat = seats.find((s) => s.playerUid === uid);
      const now = Date.now();

      if (seat) {
        if (isBye) {
          await store.updateSeat(room.id, seat.seatIndex, {
            connected: false,
            disconnectedAt: now,
          });
        } else {
          await store.updateSeat(room.id, seat.seatIndex, {
            connected: true,
            lastSeenAt: now,
            disconnectedAt: null,
          });
          if (room.pausedAt) {
            await store.updateRoom(room.id, { pausedAt: null });
            room.pausedAt = null;
          }
        }
      } else {
        const spectators = await store.listSpectators(room.id);
        const spec = spectators.find((s) => s.uid === uid);
        if (spec) {
          await store.upsertSpectator({
            ...spec,
            connected: !isBye,
            lastSeenAt: now,
          });
        }
      }

      const [freshSeats, freshSpectators] = await Promise.all([
        store.listSeats(room.id),
        store.listSpectators(room.id),
      ]);

      await store.publish(room.code, {
        kind: "room",
        room: roomView(room, freshSeats, freshSpectators.filter((s) => s.connected).length),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
