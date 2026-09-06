import { z } from "zod";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { openRouterHeaders } from "@/lib/openrouter";

export const runtime = "nodejs";

/**
 * SOPHENIC DESIGN V8.1 — Design Intent via le routage IA existant.
 * Aucun nouveau cerveau : cette route réutilise la clé OpenRouter de
 * l'application (mêmes env/headers que /api/design/ai) pour structurer
 * l'intent. Le client peut aussi utiliser le Brain Desktop ; cette route
 * n'est que le fallback web.
 */
const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(60_000) })).min(1).max(6)
});

export async function POST(request: Request) {
  const { user } = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); } catch { return NextResponse.json({ error: "Requête Design Intent invalide." }, { status: 400 }); }
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({ model: "openrouter/auto", messages: body.messages, stream: false, temperature: 0.2, max_tokens: 1600, response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(90_000)
    });
    const payload = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null;
    if (!upstream.ok) return NextResponse.json({ error: payload?.error?.message || `OpenRouter ${upstream.status}` }, { status: 502 });
    return NextResponse.json({ content: payload?.choices?.[0]?.message?.content || "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SOPHENIC Design Intent IA indisponible." }, { status: 502 });
  }
}
