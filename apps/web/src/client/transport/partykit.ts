import type { RoomTransport } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HEARTBEAT_INTERVAL_MS = 20_000;

export const partykitTransport: RoomTransport = ({ code, token, viewerOnly, onMessage, onStatus }) => {
  let stopped = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let ws: WebSocket | null = null;
  let attempt = 0;

  const partyHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";
  const protocol = partyHost.startsWith("localhost") || partyHost.startsWith("127.0.0.1") ? "ws" : "wss";
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const wsUrl = `${protocol}://${partyHost}/parties/room/${encodeURIComponent(code)}${query}`;

  const postPresence = (bye = false) => {
    const url = `/api/rooms/${encodeURIComponent(code)}/presence`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["x-mb-token"] = token;
    const body = JSON.stringify(bye ? { bye: true } : {});

    if (bye) {
      try {
        void fetch(url, {
          method: "POST",
          headers,
          body,
          keepalive: true,
        }).catch(() => {
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
          }
        });
      } catch {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        }
      }
    } else {
      void fetch(url, {
        method: "POST",
        headers,
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  };

  // A Stage display has no seat: skip presence entirely so it can never be
  // mistaken for (or flip the connected status of) whichever seat's cookie
  // happens to be sitting in this browser.
  if (!viewerOnly) {
    postPresence(false);
    heartbeatTimer = setInterval(() => {
      if (!stopped) postPresence(false);
    }, HEARTBEAT_INTERVAL_MS);
  }

  async function connect() {
    if (stopped) return;
    onStatus("connecting");
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (stopped) {
        ws?.close();
        return;
      }
      onStatus("open");
      attempt = 0;
    };

    ws.onmessage = (event) => {
      if (stopped) return;
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      ws = null;
      if (stopped) return;
      onStatus("closed");
      const backoff = Math.min(5_000, 400 * 2 ** attempt) + Math.random() * 300;
      attempt = Math.min(attempt + 1, 5);
      void sleep(backoff).then(connect);
    };

    ws.onerror = () => {
      // onerror is usually followed by onclose
    };
  }

  void connect();

  return () => {
    stopped = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (!viewerOnly) postPresence(true);
    if (ws) {
      ws.close();
      ws = null;
    }
  };
};
