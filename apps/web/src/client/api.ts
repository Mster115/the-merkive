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
  opts: { method?: string; token?: string | null; body?: unknown } = {}
): Promise<T> {
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
    throw new ApiCallError(
      typeof data.code === "string" ? data.code : "internal",
      typeof data.error === "string" ? data.error : "Request failed",
      res.status
    );
  }
  return data as T;
}

export const api = {
  createRoom: (name: string, avatarId: string) =>
    request<{ code: string } & JoinResponse>("/api/rooms", { body: { name, avatarId } }),

  join: (
    code: string,
    body: { name: string; avatarId: string; role: "player" | "spectator"; fresh?: boolean },
    token: string | null
  ) => request<JoinResponse>(`/api/rooms/${code}/join`, { body, token }),

  sync: (code: string, token: string | null) =>
    request<ClientSnapshot>(`/api/rooms/${code}/sync`, { method: "GET", token }),

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
