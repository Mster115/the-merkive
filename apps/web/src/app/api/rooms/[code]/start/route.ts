import { NextResponse } from "next/server";
import { jsonError, type RouteParams } from "@/server/api";
import { readIdentity } from "@/server/identity";
import { startMatch } from "@/server/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const uid = await readIdentity(code);
    if (!uid) {
      return NextResponse.json({ error: "No identity.", code: "not_seated" }, { status: 403 });
    }
    await startMatch(code, uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
