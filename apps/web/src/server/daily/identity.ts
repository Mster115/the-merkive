import { cookies } from "next/headers";

export const DAILY_DEVICE_COOKIE = "mb_device";

export function mintDeviceId(): string {
  return crypto.randomUUID();
}

export function dailyCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function resolveDeviceId(): Promise<{ deviceId: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(DAILY_DEVICE_COOKIE)?.value;
  if (existing) {
    return { deviceId: existing, isNew: false };
  }
  const deviceId = mintDeviceId();
  return { deviceId, isNew: true };
}
