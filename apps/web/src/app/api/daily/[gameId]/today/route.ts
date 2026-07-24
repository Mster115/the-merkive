import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { resolveDeviceId, DAILY_DEVICE_COOKIE, dailyCookieOptions } from "@/server/daily/identity";
import { resolveTimezone } from "@/server/daily/timezone";
import { getTodayOrCreateAttempt } from "@/server/daily/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  props: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await props.params;
    const { deviceId, isNew } = await resolveDeviceId();
    const timezone = resolveTimezone(req);

    const data = await getTodayOrCreateAttempt(gameId, deviceId, timezone);
    const res = NextResponse.json(data);
    if (isNew) {
      res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
    }
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
