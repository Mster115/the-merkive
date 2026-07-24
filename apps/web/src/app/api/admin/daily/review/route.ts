import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { listDrafts } from "@/server/daily/service";
import { isPipelineAuthorized } from "@/server/daily/pipelineAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  if (!isPipelineAuthorized(req)) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId") ?? undefined;
    const drafts = await listDrafts(gameId);
    return NextResponse.json(drafts);
  } catch (err) {
    return jsonError(err);
  }
}
