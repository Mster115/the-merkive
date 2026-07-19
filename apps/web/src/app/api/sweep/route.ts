import { NextResponse } from "next/server";
import { sweepAll } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * External sweep trigger for serverless deployments (Vercel cron), where the
 * in-process interval sweeper of memory mode doesn't exist. Guarded by
 * MB_SWEEP_SECRET when set.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.MB_SWEEP_SECRET;
  if (secret && req.headers.get("x-mb-sweep-secret") !== secret) {
    return NextResponse.json({ error: "nope", code: "forbidden" }, { status: 403 });
  }
  await sweepAll();
  return NextResponse.json({ ok: true });
}
