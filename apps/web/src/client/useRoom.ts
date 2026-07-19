"use client";
import * as React from "react";
import type { ActFn } from "@merky/game-sdk";
import { TICK_ACTION, type ClientSnapshot, type RoomMessage } from "@/shared/messages";
import { api, ApiCallError } from "./api";
import { clearToken, getToken, setToken } from "./session";
import { getTransport, type TransportStatus } from "./transport";

type Phase = "loading" | "ready" | "gone" | "error";
type ByeReason = "kicked" | "expired" | "room_closed";

interface State {
  phase: Phase;
  errorCode: string | null;
  byeReason: ByeReason | null;
  snapshot: ClientSnapshot | null;
  privateVersion: number;
  connection: TransportStatus;
  serverOffset: number;
  resyncNeeded: boolean;
}

type Msg =
  | { t: "snapshot"; snapshot: ClientSnapshot }
  | { t: "message"; msg: RoomMessage | { kind: "hello"; serverNow: number } }
  | { t: "status"; status: TransportStatus }
  | { t: "error"; code: string }
  | { t: "resynced" };

const initial: State = {
  phase: "loading",
  errorCode: null,
  byeReason: null,
  snapshot: null,
  privateVersion: 0,
  connection: "connecting",
  serverOffset: 0,
  resyncNeeded: false,
};

function reduce(state: State, action: Msg): State {
  switch (action.t) {
    case "snapshot": {
      return {
        ...state,
        phase: "ready",
        errorCode: null,
        snapshot: action.snapshot,
        privateVersion: action.snapshot.match?.version ?? 0,
        serverOffset: action.snapshot.serverNow - Date.now(),
        resyncNeeded: false,
      };
    }
    case "status":
      return { ...state, connection: action.status };
    case "error":
      return state.phase === "ready" ? state : { ...state, phase: "error", errorCode: action.code };
    case "resynced":
      return { ...state, resyncNeeded: false };
    case "message": {
      const msg = action.msg;
      if (msg.kind === "hello") {
        return { ...state, serverOffset: msg.serverNow - Date.now() };
      }
      const snap = state.snapshot;
      if (msg.kind === "bye") {
        if (msg.seat === undefined || msg.seat === snap?.you.seatIndex) {
          return { ...state, phase: "gone", byeReason: msg.reason };
        }
        return state;
      }
      if (!snap) return state;
      if (msg.kind === "room") {
        let you = snap.you;
        if (
          you.seatIndex !== null &&
          !msg.room.seats.some((s) => s.seatIndex === you.seatIndex)
        ) {
          // our seat vanished (lobby grace removal) — back to spectator
          you = { seatIndex: null, role: "spectator", privateState: null };
        }
        return { ...state, snapshot: { ...snap, room: msg.room, you } };
      }
      if (msg.kind === "match") {
        const sameMatch = snap.match !== null && msg.match.id === snap.match.id;
        const current = snap.match?.version ?? 0;
        if (sameMatch && msg.match.version <= current) {
          return state;
        }
        const gap = sameMatch && msg.match.version > current + 1 && snap.you.seatIndex !== null;
        return {
          ...state,
          // A new match invalidates the old private state and its version gate.
          privateVersion: sameMatch ? state.privateVersion : 0,
          snapshot: {
            ...snap,
            match: msg.match,
            you: sameMatch ? snap.you : { ...snap.you, privateState: null },
          },
          resyncNeeded: state.resyncNeeded || gap,
        };
      }
      if (msg.kind === "private") {
        if (msg.seat !== snap.you.seatIndex || msg.version < state.privateVersion) return state;
        return {
          ...state,
          privateVersion: msg.version,
          snapshot: { ...snap, you: { ...snap.you, privateState: msg.privateState } },
        };
      }
      return state;
    }
  }
}

export interface UseRoomResult {
  phase: Phase;
  errorCode: string | null;
  byeReason: ByeReason | null;
  snapshot: ClientSnapshot | null;
  connection: TransportStatus;
  /** Server-adjusted ticking clock (~2Hz). */
  now: number;
  token: string | null;
  act: ActFn;
  join: (opts: {
    name: string;
    avatarId: string;
    role: "player" | "spectator";
    fresh?: boolean;
  }) => Promise<{ ok: true } | { ok: false; code: string }>;
  leave: () => Promise<void>;
  resync: () => void;
}

export function useRoom(code: string, mode: "controller" | "stage"): UseRoomResult {
  const [state, dispatch] = React.useReducer(reduce, initial);
  const [token, setTokenState] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const offsetRef = React.useRef(0);
  const nudgedRef = React.useRef(0);
  const tokenRef = React.useRef<string | null>(null);
  offsetRef.current = state.serverOffset;

  const upperCode = code.toUpperCase();

  // Initial identity + snapshot.
  React.useEffect(() => {
    let cancelled = false;
    const existing = mode === "controller" ? getToken(upperCode) : null;
    tokenRef.current = existing;
    setTokenState(existing);
    api
      .sync(upperCode, existing, mode === "stage")
      .then((snapshot) => {
        if (!cancelled) dispatch({ t: "snapshot", snapshot });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({ t: "error", code: err instanceof ApiCallError ? err.code : "internal" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [upperCode, mode]);

  // Realtime transport (reconnects internally; re-created when token changes
  // so the stream picks up seat-level private messages).
  React.useEffect(() => {
    if (state.phase === "gone" || state.phase === "error") return;
    const disconnect = getTransport()({
      code: upperCode,
      token,
      viewerOnly: mode === "stage",
      onMessage: (msg) => dispatch({ t: "message", msg }),
      onStatus: (status) => dispatch({ t: "status", status }),
    });
    return disconnect;
  }, [upperCode, token, state.phase, mode]);

  // Resync when a version gap or conflict was detected, and when the tab
  // wakes from sleep.
  const doResync = React.useCallback(() => {
    api
      .sync(upperCode, tokenRef.current, mode === "stage")
      .then((snapshot) => dispatch({ t: "snapshot", snapshot }))
      .catch(() => undefined);
  }, [upperCode, mode]);

  React.useEffect(() => {
    if (state.resyncNeeded) {
      dispatch({ t: "resynced" });
      doResync();
    }
  }, [state.resyncNeeded, doResync]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") doResync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [doResync]);

  // A reopened transport replays nothing — always refetch missed state.
  const wasClosedRef = React.useRef(false);
  React.useEffect(() => {
    if (state.connection === "closed") wasClosedRef.current = true;
    if (state.connection === "open" && wasClosedRef.current) {
      wasClosedRef.current = false;
      doResync();
    }
  }, [state.connection, doResync]);

  // Ticking clock + lazy timer nudge (any seated client pokes the server
  // when a deadline passes — serverless-safe, idempotent server-side).
  const snapRef = React.useRef(state.snapshot);
  snapRef.current = state.snapshot;
  React.useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now() + offsetRef.current;
      setNow(nowMs);
      const snap = snapRef.current;
      const timer = snap?.match?.timer;
      if (
        timer &&
        snap?.match &&
        !snap.match.over &&
        tokenRef.current &&
        nowMs > timer.endsAt + 800 &&
        nudgedRef.current !== timer.endsAt
      ) {
        nudgedRef.current = timer.endsAt;
        void api.action(upperCode, tokenRef.current, { type: TICK_ACTION }).catch(() => undefined);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [upperCode]);

  const act = React.useCallback<ActFn>(
    async (type, payload) => {
      try {
        const result = await api.action(upperCode, tokenRef.current, {
          type,
          payload,
          idempotencyKey: crypto.randomUUID(),
        });
        if (!result.ok && result.code === "version_conflict") doResync();
        return result.ok ? { ok: true } : result;
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.code === "version_conflict") doResync();
          return { ok: false, code: err.code, error: err.message };
        }
        return { ok: false, code: "offline", error: "Network error" };
      }
    },
    [upperCode, doResync]
  );

  const join = React.useCallback(
    async (opts: { name: string; avatarId: string; role: "player" | "spectator"; fresh?: boolean }) => {
      try {
        const res = await api.join(upperCode, opts, tokenRef.current);
        setToken(upperCode, res.token);
        tokenRef.current = res.token;
        setTokenState(res.token);
        dispatch({ t: "snapshot", snapshot: res.snapshot });
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, code: err instanceof ApiCallError ? err.code : "internal" };
      }
    },
    [upperCode]
  );

  const leave = React.useCallback(async () => {
    try {
      await api.leave(upperCode, tokenRef.current);
    } finally {
      clearToken(upperCode);
      tokenRef.current = null;
      setTokenState(null);
    }
  }, [upperCode]);

  return {
    phase: state.phase,
    errorCode: state.errorCode,
    byeReason: state.byeReason,
    snapshot: state.snapshot,
    connection: state.connection,
    now,
    token,
    act,
    join,
    leave,
    resync: doResync,
  };
}
