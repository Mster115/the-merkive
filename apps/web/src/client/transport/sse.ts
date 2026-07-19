import type { RoomTransport } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Memory-mode transport: fetch-streamed SSE (fetch instead of EventSource so
 * the per-tab seat token can travel in a header, never in the URL).
 */
export const sseTransport: RoomTransport = ({ code, token, onMessage, onStatus }) => {
  let stopped = false;
  let controller: AbortController | null = null;

  async function run(): Promise<void> {
    let attempt = 0;
    while (!stopped) {
      controller = new AbortController();
      try {
        onStatus("connecting");
        const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/events`, {
          headers: token ? { "x-mb-token": token } : {},
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`sse http ${res.status}`);
        onStatus("open");
        attempt = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split;
          while ((split = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const data = frame
              .split("\n")
              .filter((l) => l.startsWith("data: "))
              .map((l) => l.slice(6))
              .join("");
            if (!data) continue;
            try {
              onMessage(JSON.parse(data));
            } catch {
              // malformed frame — ignore
            }
          }
        }
        throw new Error("stream ended");
      } catch {
        if (stopped) return;
        onStatus("closed");
        const backoff = Math.min(5_000, 400 * 2 ** attempt) + Math.random() * 300;
        attempt = Math.min(attempt + 1, 5);
        await sleep(backoff);
      }
    }
  }

  void run();
  return () => {
    stopped = true;
    controller?.abort();
  };
};
