import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { getQueueStatus } from "@/server/daily/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.DAILY_PIPELINE_SECRET;
  if (!secret) return true;
  const headerVal = req.headers.get("x-mb-pipeline-secret");
  const authHeader = req.headers.get("authorization");
  return headerVal === secret || authHeader === `Bearer ${secret}`;
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId") ?? undefined;
    const data = await getQueueStatus(gameId);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
