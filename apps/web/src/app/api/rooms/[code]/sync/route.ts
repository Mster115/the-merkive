import { NextResponse } from "next/server";
import { jsonError, type RouteParams } from "@/server/api";
import { readIdentity } from "@/server/identity";
import { snapshotFor } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const isStageViewer = new URL(req.url).searchParams.get("viewer") === "stage";
    const uid = await readIdentity(code, { allowCookie: !isStageViewer });
    const snapshot = await snapshotFor(code, uid);
    return NextResponse.json(snapshot);
  } catch (err) {
    return jsonError(err);
  }
}
