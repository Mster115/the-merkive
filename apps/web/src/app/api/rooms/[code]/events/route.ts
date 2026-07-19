import type { RouteParams } from "@/server/api";
import { normalizeCode } from "@/server/codes";
import { readIdentity } from "@/server/identity";
import { presenceClose, presenceOpen } from "@/server/service";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

/**
 * Memory-mode realtime: one SSE stream per client, filtered server-side so a
 * connection only ever sees its own seat's private state. Supabase mode
 * doesn't use this route — clients subscribe to Supabase Realtime directly.
 */
export async function GET(req: Request, { params }: RouteParams): Promise<Response> {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);
  const store = getStore();
  if (!code || !store.subscribe) {
    return Response.json({ error: "No stream.", code: "no_stream" }, { status: 404 });
  }
  const room = await store.getRoomByCode(code);
  if (!room || room.status === "expired") {
    return Response.json({ error: "Room not found.", code: "room_not_found" }, { status: 404 });
  }

  const uid = await readIdentity(code);
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

      const unsubscribe = store.subscribe!(code, (msg) => {
        if (msg.kind === "private" && msg.seat !== mySeat) return;
        if (msg.kind === "bye" && msg.seat !== undefined && msg.seat !== mySeat) return;
        send(msg);
      });

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
