import type { RouteParams } from "@/server/api";
import type { RoomMessage } from "@/shared/messages";
import { normalizeCode } from "@/server/codes";
import { readIdentity } from "@/server/identity";
import { presenceClose, presenceOpen } from "@/server/service";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel kills the invocation at the plan cap regardless; naming it keeps the
// cutoff predictable. The client reconnects and resyncs on close, so a cut
// stream costs one /sync, not a stale screen.
export const maxDuration = 60;

const HEARTBEAT_MS = 15_000;
/** Log poll cadence while the room is producing messages. */
const POLL_ACTIVE_MS = 1_000;
/** Backed-off cadence for an idle room, to stay cheap on metered Redis. */
const POLL_IDLE_MS = 5_000;
/** Consecutive empty polls before backing off to the idle cadence. */
const IDLE_AFTER_EMPTY = 5;

/**
 * SSE realtime: one stream per client, filtered server-side so a connection
 * only ever sees its own seat's private state. PartyKit mode uses WebSockets
 * directly instead.
 *
 * Delivery rides the store's durable message log (`readSince`) rather than an
 * in-process subscriber list, because this stream and the mutation that feeds
 * it almost never share a serverless instance.
 */
export async function GET(req: Request, { params }: RouteParams): Promise<Response> {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);
  const store = getStore();
  if (!code || (!store.subscribe && !store.readSince)) {
    return Response.json({ error: "No stream.", code: "no_stream" }, { status: 404 });
  }
  const room = await store.getRoomByCode(code);
  if (!room || room.status === "expired") {
    return Response.json({ error: "Room not found.", code: "room_not_found" }, { status: 404 });
  }

  const isStageViewer = new URL(req.url).searchParams.get("viewer") === "stage";
  const uid = await readIdentity(code, { allowCookie: !isStageViewer });
  const seats = await store.listSeats(room.id);
  const mySeat = uid ? seats.find((s) => s.playerUid === uid)?.seatIndex : undefined;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send({ kind: "hello", serverNow: Date.now() });

      /** Never let one connection see another seat's private state. */
      const sendForThisSeat = (msg: RoomMessage) => {
        if (msg.kind === "private" && msg.seat !== mySeat) return;
        if (msg.kind === "bye" && msg.seat !== undefined && msg.seat !== mySeat) return;
        send(msg);
      };

      // Cross-instance delivery via the durable log, when the store has one.
      // Falls back to same-process fanout only for stores that don't.
      let unsubscribe = () => {};
      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      if (store.readSince) {
        const readSince = store.readSince.bind(store);
        let cursor: number | null = null;
        let emptyPolls = 0;

        const poll = async () => {
          if (closed) return;
          try {
            const slice = await readSince(code, cursor);
            cursor = slice.cursor;
            if (slice.messages.length > 0) {
              emptyPolls = 0;
              for (const msg of slice.messages) sendForThisSeat(msg);
            } else {
              emptyPolls += 1;
            }
          } catch {
            // A transient store error must not kill the stream; the next
            // tick retries from the same cursor.
          }
          if (closed) return;
          const delay = emptyPolls >= IDLE_AFTER_EMPTY ? POLL_IDLE_MS : POLL_ACTIVE_MS;
          pollTimer = setTimeout(() => void poll(), delay);
        };
        void poll();
      } else {
        unsubscribe = store.subscribe!(code, sendForThisSeat);
      }

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`:hb\n\n`));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      if (uid) void presenceOpen(code, uid).catch(() => undefined);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        if (pollTimer) clearTimeout(pollTimer);
        unsubscribe();
        if (uid) void presenceClose(code, uid).catch(() => undefined);
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };
      req.signal.addEventListener("abort", () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
