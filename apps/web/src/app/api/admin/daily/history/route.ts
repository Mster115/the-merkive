import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { getHistoryDigest } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";
import { isPipelineAuthorized } from "@/server/daily/pipelineAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-way content digest of a game's puzzle history.
 *
 * Returns fingerprints and hashed item tokens rather than payloads, so a
 * content generator can prove a puzzle is new without ever being handed an
 * unplayed answer key. Answers from dates already played come back in the clear
 * — every player that day saw them.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!isPipelineAuthorized(req)) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId");
    if (!gameId) {
      throw new ServiceError("invalid_request", "gameId is required", 400);
    }
    const limitParam = Number(url.searchParams.get("limit") ?? "400");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 400;

    return NextResponse.json(await getHistoryDigest(gameId, limit));
  } catch (err) {
    return jsonError(err);
  }
}
