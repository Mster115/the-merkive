import { NextResponse } from "next/server";
import { jsonError, readJson, type RouteParams } from "@/server/api";
import { cookieName, cookieOptions, readIdentity, sanitizeName } from "@/server/identity";
import { joinRoom } from "@/server/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const body = await readJson(req);
    const uid = await readIdentity(code);
    const result = await joinRoom(code, {
      uid,
      fresh: body.fresh === true,
      name: sanitizeName(body.name),
      avatarId: typeof body.avatarId === "string" ? body.avatarId : "fox",
      role: body.role === "spectator" ? "spectator" : "player",
    });
    const res = NextResponse.json(result);
    res.cookies.set(cookieName(code), result.token, cookieOptions());
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
