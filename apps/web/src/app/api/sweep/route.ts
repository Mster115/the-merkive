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

/**
 * Vercel Cron invokes the configured path via HTTP GET. Vercel automatically
 * attaches `Authorization: Bearer $CRON_SECRET` to that request when the
 * reserved `CRON_SECRET` env var is set on the project. Guarded by
 * CRON_SECRET when set (permissive when unset, same as MB_SWEEP_SECRET above).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "nope", code: "unauthorized" }, { status: 401 });
  }
  await sweepAll();
  return NextResponse.json({ ok: true });
}
