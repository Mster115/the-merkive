import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { unqueuePuzzle } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";
import { isPipelineAuthorized } from "@/server/daily/pipelineAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Removes a future puzzle, freeing its date and its content fingerprint.
 *
 * POST rather than DELETE so it matches the other mutating pipeline endpoints
 * and carries a body. The service refuses anything that is not strictly in the
 * future, and anything with attempts against it.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!isPipelineAuthorized(req)) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJson(req);
    const gameId = typeof body.gameId === "string" ? body.gameId : null;
    const puzzleDate = typeof body.puzzleDate === "string" ? body.puzzleDate : null;

    if (!gameId || !puzzleDate) {
      throw new ServiceError("invalid_request", "gameId and puzzleDate are required", 400);
    }

    return NextResponse.json(await unqueuePuzzle(gameId, puzzleDate));
  } catch (err) {
    return jsonError(err);
  }
}
