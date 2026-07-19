import { NextResponse } from "next/server";
import { jsonError, readJson, type RouteParams } from "@/server/api";
import { readIdentity } from "@/server/identity";
import { applyAction } from "@/server/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const uid = await readIdentity(code);
    if (!uid) {
      return NextResponse.json({ error: "No identity.", code: "not_seated" }, { status: 403 });
    }
    const body = await readJson(req);
    if (typeof body.type !== "string" || body.type.length === 0 || body.type.length > 64) {
      return NextResponse.json({ error: "Bad action.", code: "bad_action" }, { status: 400 });
    }
    const result = await applyAction(code, uid, {
      type: body.type,
      payload: body.payload,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return jsonError(err);
  }
}
