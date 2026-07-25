import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { getPrompt } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";
import { isPipelineAuthorized } from "@/server/daily/pipelineAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  if (!isPipelineAuthorized(req)) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId");
    const puzzleDate = url.searchParams.get("puzzleDate");

    if (!gameId || !puzzleDate) {
      throw new ServiceError("invalid_request", "gameId and puzzleDate are required", 400);
    }

    const data = await getPrompt(gameId, puzzleDate);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
