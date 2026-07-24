import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { decideDraft } from "@/server/daily/service";
import { isPipelineAuthorized } from "@/server/daily/pipelineAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isPipelineAuthorized(req)) {
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
