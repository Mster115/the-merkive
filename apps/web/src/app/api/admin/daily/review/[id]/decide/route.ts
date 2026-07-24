import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { decideDraft } from "@/server/daily/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.DAILY_PIPELINE_SECRET;
  if (!secret) return true;
  const headerVal = req.headers.get("x-mb-pipeline-secret");
  const authHeader = req.headers.get("authorization");
  return headerVal === secret || authHeader === `Bearer ${secret}`;
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await props.params;
    const body = await readJson(req);
    const approve = Boolean(body.approve);

    const result = await decideDraft(id, approve);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
