import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/server/api";
import { createPack, listPacks } from "@/server/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const gameId = new URL(req.url).searchParams.get("gameId") ?? "";
    const packs = await listPacks(gameId);
    // Payload stays server-side; the lobby only needs ids/titles.
    return NextResponse.json(
      packs.map((p) => ({ id: p.id, gameId: p.gameId, title: p.title, titleKey: p.titleKey, locale: p.locale, nsfw: p.nsfw ?? false }))
    );
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await readJson(req);
    if (typeof body.gameId !== "string" || typeof body.title !== "string") {
      return NextResponse.json({ error: "Bad pack.", code: "bad_pack" }, { status: 400 });
    }
    const pack = await createPack(
      body.gameId,
      body.title,
      typeof body.locale === "string" ? body.locale : "en",
      body.payload
    );
    return NextResponse.json({ id: pack.id, title: pack.title });
  } catch (err) {
    return jsonError(err);
  }
}
