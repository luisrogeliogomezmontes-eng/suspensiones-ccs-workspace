import { NextResponse } from "next/server";
import { getBoardState } from "@/lib/data";

export const dynamic = "force-dynamic";

// Cache en memoria del server: todos los browsers de la oficina leen de aquí,
// así un solo server→Notion sirve a todos y no se revienta el rate-limit.
let cache: { at: number; data: unknown } | null = null;
const TTL_MS = 8000;

export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.has("fresh");
  try {
    if (!fresh && cache && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json(cache.data);
    }
    const data = await getBoardState();
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
