import { NextResponse } from "next/server";
import { resolveDeviceId, DAILY_DEVICE_COOKIE, dailyCookieOptions } from "@/server/daily/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Idempotent device-identity bootstrap. Every client-side daily fetch (today,
 * history, archive, action) funnels through this once per page load via
 * ensureDailyDevice() before firing — otherwise several components mounting
 * in parallel on a visitor's very first request (no mb_device cookie yet)
 * would each independently mint their own device id, fragmenting one
 * visitor's history across multiple orphaned device rows.
 */
export async function POST(): Promise<NextResponse> {
  const { deviceId, isNew } = await resolveDeviceId();
  const res = NextResponse.json({ deviceId });
  if (isNew) {
    res.cookies.set(DAILY_DEVICE_COOKIE, deviceId, dailyCookieOptions());
  }
  return res;
}
