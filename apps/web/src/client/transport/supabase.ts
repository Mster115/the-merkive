import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RoomMessage } from "@/shared/messages";
import type { RoomTransport, TransportStatus } from "./types";

let browserClient: SupabaseClient | null = null;

function getBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }
  browserClient = createClient(url, key);
  return browserClient;
}

const HEARTBEAT_INTERVAL_MS = 20_000;

export const supabaseTransport: RoomTransport = ({ code, token, onMessage, onStatus }) => {
  let stopped = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const supabase = getBrowserClient();
  const upperCode = code.toUpperCase();
  const publicChannelName = `room:${upperCode}:public`;
  const seatChannelName = token ? `room:${upperCode}:seat:${token}` : null;

  let publicSubscribed = false;
  let seatSubscribed = !seatChannelName;

  function updateStatus() {
    if (stopped) return;
    if (publicSubscribed && seatSubscribed) {
      onStatus("open");
    } else {
      onStatus("connecting");
    }
  }

  onStatus("connecting");

  // Presence heartbeat logic
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

  // Immediate initial presence heartbeat & interval setup
  postPresence(false);
  heartbeatTimer = setInterval(() => {
    if (!stopped) postPresence(false);
  }, HEARTBEAT_INTERVAL_MS);

  const publicChan: RealtimeChannel = supabase.channel(publicChannelName);
  publicChan
    .on("broadcast", { event: "msg" }, (res) => {
      if (res?.payload) {
        onMessage(res.payload as RoomMessage);
      }
    })
    .subscribe((status) => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        publicSubscribed = true;
        updateStatus();
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        publicSubscribed = false;
        onStatus("closed");
        setTimeout(() => {
          if (!stopped && !publicSubscribed) {
            void publicChan.subscribe();
          }
        }, 2000);
      }
    });

  let seatChan: RealtimeChannel | null = null;
  if (seatChannelName) {
    seatChan = supabase.channel(seatChannelName);
    seatChan
      .on("broadcast", { event: "msg" }, (res) => {
        if (res?.payload) {
          onMessage(res.payload as RoomMessage);
        }
      })
      .subscribe((status) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          seatSubscribed = true;
          updateStatus();
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          seatSubscribed = false;
          onStatus("closed");
          setTimeout(() => {
            if (!stopped && !seatSubscribed) {
              void seatChan?.subscribe();
            }
          }, 2000);
        }
      });
  }

  return () => {
    stopped = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    postPresence(true);
    if (publicChan) void supabase.removeChannel(publicChan);
    if (seatChan) void supabase.removeChannel(seatChan);
  };
};
