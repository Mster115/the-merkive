import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { resolveDeviceId, DAILY_DEVICE_COOKIE, dailyCookieOptions } from "@/server/daily/identity";
import { resolveTimezone } from "@/server/daily/timezone";
import { getOrCreateRecoveryCode, redeemRecoveryCode } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reveals (creating on first ask) this device's own recovery code. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { deviceId, isNew } = await resolveDeviceId();
    const timezone = resolveTimezone(req);

    const data = await getOrCreateRecoveryCode(deviceId, timezone);
    const res = NextResponse.json(data);
    if (isNew) {
      res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
    }
    return res;
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Redeems a code: this browser adopts the owning device's id, so it picks up
 * that history. Nothing is merged — any history built up under the current
 * cookie is simply left behind, which is why the client confirms first.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await readJson(req);
    const code = typeof body.code === "string" ? body.code : null;
    if (!code) {
      throw new ServiceError("invalid_code", "Enter a recovery code.", 400);
    }

    const { deviceId } = await redeemRecoveryCode(code);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
