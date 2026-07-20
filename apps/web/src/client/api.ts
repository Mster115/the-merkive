import type { ClientSnapshot, JoinResponse } from "@/shared/messages";

export class ApiCallError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  url: string,
  opts: { method?: string; token?: string | null; body?: unknown; retries?: number } = {}
): Promise<T> {
  const maxAttempts = opts.retries ?? (url.includes("/sync") || url.includes("/join") || url.includes("/action") ? 3 : 1);
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: opts.method ?? "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.token ? { "x-mb-token": opts.token } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok && !(res.status === 422 && typeof data.ok === "boolean")) {
        const code = typeof data.code === "string" ? data.code : "internal";
        if (code === "room_not_found" && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 250 * attempt));
          continue;
        }
        throw new ApiCallError(
          code,
          typeof data.error === "string" ? data.error : "Request failed",
          res.status
        );
      }
      return data as T;
    } catch (err) {
      if (attempt < maxAttempts && err instanceof ApiCallError && err.code === "room_not_found") {
        await new Promise((r) => setTimeout(r, 250 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new ApiCallError("internal", "Request failed", 500);
}

export const api = {
  createRoom: (name: string, avatarId: string) =>
    request<{ code: string } & JoinResponse>("/api/rooms", { body: { name, avatarId } }),

  createStageRoom: () => request<{ code: string }>("/api/rooms", { body: { asStage: true } }),

  join: (
    code: string,
    body: { name: string; avatarId: string; role: "player" | "spectator"; fresh?: boolean },
    token: string | null
  ) => request<JoinResponse>(`/api/rooms/${code}/join`, { body, token }),

  sync: (code: string, token: string | null, stageViewer?: boolean) =>
    request<ClientSnapshot>(`/api/rooms/${code}/sync${stageViewer ? "?viewer=stage" : ""}`, {
      method: "GET",
      token,
    }),

  action: (
    code: string,
    token: string | null,
    body: { type: string; payload?: unknown; idempotencyKey?: string }
  ) =>
    request<{ ok: true } | { ok: false; code: string; error: string }>(
      `/api/rooms/${code}/action`,
      { body, token }
    ),

  start: (code: string, token: string | null) =>
    request<{ ok: true }>(`/api/rooms/${code}/start`, { token, body: {} }),

  settings: (code: string, token: string | null, body: { gameId?: string; settings?: Record<string, unknown> }) =>
    request<{ ok: true }>(`/api/rooms/${code}/settings`, { token, body }),

  leave: (code: string, token: string | null) =>
    request<{ ok: true }>(`/api/rooms/${code}/leave`, { token, body: {} }),

  kick: (code: string, token: string | null, seatIndex: number) =>
    request<{ ok: true }>(`/api/rooms/${code}/kick`, { token, body: { seatIndex } }),

  transferHost: (code: string, token: string | null, seatIndex: number) =>
    request<{ ok: true }>(`/api/rooms/${code}/transfer-host`, { token, body: { seatIndex } }),

  endMatch: (code: string, token: string | null) =>
    request<{ ok: true }>(`/api/rooms/${code}/end`, { token, body: {} }),

  listPacks: (gameId: string) =>
    request<{ id: string; title?: string; titleKey?: string; nsfw: boolean }[]>(
      `/api/packs?gameId=${encodeURIComponent(gameId)}`,
      { method: "GET" }
    ),
};
