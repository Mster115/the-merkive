import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { resolveDeviceId, DAILY_DEVICE_COOKIE, dailyCookieOptions } from "@/server/daily/identity";
import { markHowToSeen } from "@/server/daily/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Marks this device as having been shown a game's how-to-play modal.
 *
 * Idempotent, so the client can fire it on every close without checking. It
 * carries no puzzle state, so there is nothing here worth failing the player's
 * turn over — the shell ignores the response.
 */
export async function POST(
  _req: Request,
  props: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await props.params;
    const { deviceId, isNew } = await resolveDeviceId();
    const data = await markHowToSeen(deviceId, gameId);

    const res = NextResponse.json(data);
    if (isNew) {
      res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
    }
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
