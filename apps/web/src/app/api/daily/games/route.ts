import { NextResponse } from "next/server";
import { jsonError } from "@/server/api";
import { listGames } from "@/server/daily/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const games = listGames();
    return NextResponse.json(games);
  } catch (err) {
    return jsonError(err);
  }
}
