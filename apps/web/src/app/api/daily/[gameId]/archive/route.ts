import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { resolveDeviceId, DAILY_DEVICE_COOKIE, dailyCookieOptions } from "@/server/daily/identity";
import { resolveTimezone } from "@/server/daily/timezone";
import { getArchive } from "@/server/daily/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  props: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await props.params;
    const url = new URL(req.url);
    const before = url.searchParams.get("before") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 30;

    const { deviceId, isNew } = await resolveDeviceId();
    const timezone = resolveTimezone(req);

    const data = await getArchive(gameId, deviceId, timezone, before, limit);
    const res = NextResponse.json(data);
    if (isNew) {
      res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
    }
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
