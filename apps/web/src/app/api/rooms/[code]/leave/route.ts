import { NextResponse } from "next/server";
import { jsonError, type RouteParams } from "@/server/api";
import { cookieName, readIdentity } from "@/server/identity";
import { leaveRoom } from "@/server/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const uid = await readIdentity(code);
    if (uid) await leaveRoom(code, uid);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(cookieName(code));
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
