import { NextResponse } from "next/server";
import { jsonError, readJson, type RouteParams } from "@/server/api";
import { readIdentity } from "@/server/identity";
import { transferHost } from "@/server/service";
import type { SeatIndex } from "@merky/game-sdk";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const uid = await readIdentity(code);
    if (!uid) {
      return NextResponse.json({ error: "No identity.", code: "not_seated" }, { status: 403 });
    }
    const body = await readJson(req);
    const seatIndex = Number(body.seatIndex);
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex > 11) {
      return NextResponse.json({ error: "Bad seat.", code: "bad_seat" }, { status: 400 });
    }
    await transferHost(code, uid, seatIndex as SeatIndex);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
