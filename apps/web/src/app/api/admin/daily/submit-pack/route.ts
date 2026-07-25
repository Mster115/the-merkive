import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { submitPack } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";
import { isPipelineAuthorized } from "@/server/daily/pipelineAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const payload = body.payload;
    const sourceRefs = Array.isArray(body.sourceRefs)
      ? (body.sourceRefs as Array<{ url: string; title: string }>)
      : [];
    const factCheck = body.factCheck;

    const result = await submitPack(gameId, puzzleDate, payload, sourceRefs, factCheck);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
