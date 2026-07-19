/**
 * Per-tab seat identity (sessionStorage) so one browser can hold several
 * seats across tabs — required for pass-and-play and local testing. The
 * server additionally sets a per-room httpOnly cookie as a same-device
 * resume fallback.
 */
const tokenKey = (code: string) => `mb_token_${code.toUpperCase()}`;

export function getToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

export function setToken(code: string, token: string): void {
  try {
    window.sessionStorage.setItem(tokenKey(code), token);
  } catch {
    // storage unavailable (private mode) — cookie fallback still works
  }
}

export function clearToken(code: string): void {
  try {
    window.sessionStorage.removeItem(tokenKey(code));
  } catch {
    // ignore
  }
}

/** Sticky player prefs across rooms (localStorage). */
export function getPrefs(): { name: string; avatarId: string } {
  if (typeof window === "undefined") return { name: "", avatarId: "fox" };
  try {
    return {
      name: window.localStorage.getItem("mb_name") ?? "",
      avatarId: window.localStorage.getItem("mb_avatar") ?? "fox",
    };
  } catch {
    return { name: "", avatarId: "fox" };
  }
}

export function setPrefs(name: string, avatarId: string): void {
  try {
    window.localStorage.setItem("mb_name", name);
    window.localStorage.setItem("mb_avatar", avatarId);
  } catch {
    // ignore
  }
}
