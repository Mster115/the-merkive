import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { submitPack } from "@/server/daily/service";
import { ServiceError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.DAILY_PIPELINE_SECRET;
  if (!secret) return true;
  const headerVal = req.headers.get("x-mb-pipeline-secret");
  const authHeader = req.headers.get("authorization");
  return headerVal === secret || authHeader === `Bearer ${secret}`;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isAuthorized(req)) {
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
