import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { partykitTransport } from "../transport/partykit";

/**
 * The seat query parameter is what lets the PartyKit relay target a private
 * message at the right connection. It matters because production runs Upstash
 * as the store, so `PartyKitStore` is never constructed and the party server's
 * store Durable Object is never populated — a token-only lookup there resolves
 * to nothing and the private message is dropped. The client knows its own seat,
 * so it announces it on connect.
 */

const sockets: FakeSocket[] = [];

class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    sockets.push(this);
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  sockets.length = 0;
  vi.stubGlobal("WebSocket", FakeSocket as unknown as typeof WebSocket);
  // The transport posts presence on connect; keep it inert.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function connect(opts: Partial<Parameters<typeof partykitTransport>[0]> = {}) {
  return partykitTransport({
    code: "ABCD",
    token: "tok-1",
    onMessage: () => {},
    onStatus: () => {},
    ...opts,
  });
}

describe("partykitTransport connection URL", () => {
  it("announces the seat once it is known, so private messages can be targeted", () => {
    const disconnect = connect({ seatIndex: 3 });
    const url = new URL(sockets[0]!.url.replace(/^ws/, "http"));
    expect(url.searchParams.get("seat")).toBe("3");
    expect(url.searchParams.get("token")).toBe("tok-1");
    disconnect();
  });

  it("claims seat 0 rather than dropping it as falsy", () => {
    const disconnect = connect({ seatIndex: 0 });
    const url = new URL(sockets[0]!.url.replace(/^ws/, "http"));
    expect(url.searchParams.get("seat")).toBe("0");
    disconnect();
  });

  it("omits the seat while still a spectator", () => {
    const disconnect = connect({ seatIndex: null });
    const url = new URL(sockets[0]!.url.replace(/^ws/, "http"));
    expect(url.searchParams.has("seat")).toBe(false);
    disconnect();
  });

  it("never lets a Stage claim a seat, even if one is passed in", () => {
    // A Stage shares the browser with whatever seat token is sitting in it;
    // claiming that seat would feed another player's private state to the TV.
    const disconnect = connect({ seatIndex: 2, viewerOnly: true });
    const url = new URL(sockets[0]!.url.replace(/^ws/, "http"));
    expect(url.searchParams.has("seat")).toBe(false);
    disconnect();
  });

  it("encodes the room code and survives having no token at all", () => {
    const disconnect = connect({ token: null, seatIndex: null });
    const url = new URL(sockets[0]!.url.replace(/^ws/, "http"));
    expect(url.pathname).toBe("/parties/room/ABCD");
    expect(url.searchParams.has("token")).toBe(false);
    disconnect();
  });
});
