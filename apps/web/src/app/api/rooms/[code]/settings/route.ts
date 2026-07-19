import { NextResponse } from "next/server";
import { jsonError, readJson, type RouteParams } from "@/server/api";
import { readIdentity } from "@/server/identity";
import { updateRoomSettings } from "@/server/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const uid = await readIdentity(code);
    if (!uid) {
      return NextResponse.json({ error: "No identity.", code: "not_seated" }, { status: 403 });
    }
    const body = await readJson(req);
    await updateRoomSettings(code, uid, {
      gameId: typeof body.gameId === "string" ? body.gameId : undefined,
      settings:
        typeof body.settings === "object" && body.settings !== null
          ? (body.settings as Record<string, unknown>)
          : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
