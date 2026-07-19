import { cookies, headers } from "next/headers";

/**
 * Identity is a per-(player, room) opaque uuid ("token").
 * Precedence: `x-mb-token` header (kept in sessionStorage per tab — this is
 * what makes several controllers in one browser, and pass-and-play, possible)
 * falling back to a per-room httpOnly cookie so a fresh tab on the same
 * device can resume its seat.
 *
 * Pass `allowCookie: false` for passive/shared viewers (the Stage display)
 * that must never resume a seat's identity — the room cookie is shared by
 * every tab in the browser, so a Stage tab opened alongside a controller in
 * the same browser would otherwise silently inherit that seat's identity
 * (leaking its private hand and flipping its presence on tab close).
 */
export async function readIdentity(code: string, opts?: { allowCookie?: boolean }): Promise<string | null> {
  const h = await headers();
  const token = h.get("x-mb-token");
  if (token) return token;
  if (opts?.allowCookie === false) return null;
  const jar = await cookies();
  return jar.get(cookieName(code))?.value ?? null;
}

export function cookieName(code: string): string {
  return `mb_r_${code.toUpperCase()}`;
}

export function mintUid(): string {
  return crypto.randomUUID();
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 6, // matches max room lifetime
  };
}

const MAX_NAME = 16;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "Player";
  const cleaned = raw
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  return cleaned || "Player";
}
