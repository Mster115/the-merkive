import { NextResponse } from "next/server";
import { jsonError, type RouteParams } from "@/server/api";
import { readIdentity } from "@/server/identity";
import { snapshotFor } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { code } = await params;
    const uid = await readIdentity(code);
    const snapshot = await snapshotFor(code, uid);
    return NextResponse.json(snapshot);
  } catch (err) {
    return jsonError(err);
  }
}
