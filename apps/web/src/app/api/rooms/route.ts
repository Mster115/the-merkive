import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { cookieName, cookieOptions, mintUid, sanitizeName } from "@/server/identity";
import { createRoom, createStageOnlyRoom } from "@/server/service";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await readJson(req);

    if (body.asStage === true) {
      // No seat, no identity — nothing to attach a cookie to.
      const result = await createStageOnlyRoom();
      return NextResponse.json(result);
    }

    const uid = mintUid();
    const result = await createRoom(
      uid,
      sanitizeName(body.name),
      typeof body.avatarId === "string" ? body.avatarId : "fox"
    );
    const res = NextResponse.json(result);
    res.cookies.set(cookieName(result.code), uid, cookieOptions());
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
