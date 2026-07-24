import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { resolveDeviceId, DAILY_DEVICE_COOKIE, dailyCookieOptions } from "@/server/daily/identity";
import { resolveTimezone } from "@/server/daily/timezone";
import { applyAction } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  props: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await props.params;
    const body = await readJson(req);
    const puzzleDate = typeof body.puzzleDate === "string" ? body.puzzleDate : null;
    const actionType = typeof body.type === "string" ? body.type : null;

    if (!puzzleDate) {
      throw new ServiceError("invalid_request", "puzzleDate is required", 400);
    }
    if (!actionType) {
      throw new ServiceError("invalid_request", "action type is required", 400);
    }

    const { deviceId, isNew } = await resolveDeviceId();
    const timezone = resolveTimezone(req);

    const action = { type: actionType, payload: body.payload };
    const data = await applyAction(gameId, puzzleDate, deviceId, timezone, action);

    const res = NextResponse.json(data);
    if (isNew) {
      res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
    }
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
