import { NextResponse } from "next/server";
import { ServiceError } from "./errors";

export function jsonError(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[merky] unhandled api error:", err);
  return NextResponse.json(
    { error: "Something went sideways. Try again.", code: "internal" },
    { status: 500 }
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await req.json()) as unknown;
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type RouteParams = { params: Promise<{ code: string }> };
