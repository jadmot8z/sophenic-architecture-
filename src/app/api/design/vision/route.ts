import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth";
import { openRouterHeaders } from "@/lib/openrouter";

export const runtime = "nodejs";
const schema = z.object({
  dataUrl: z.string().max(9_000_000).refine((value) => /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value), "Image invalide."),
  name: z.string().trim().max(300).optional(),
  prompt: z.string().trim().max(6_000).optional()
});

function extractText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value.map((item) => item && typeof item === "object" && !Array.isArray(item) && typeof (item as { text?: unknown }).text === "string" ? (item as { text: string }).text : "").filter(Boolean).join("\n").trim();
}

export async function POST(request: Request) {
  const { user } = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); } catch { return NextResponse.json({ error: "Source visuelle invalide." }, { status: 400 }); }
  const prompt = body.prompt || `Analyse cette source visuelle${body.name ? ` nommée « ${body.name} »` : ""} pour SOPHENIC Design. Décris les éléments réellement visibles et utiles à une reconstruction ou un redesign. Pour un plan, relève les espaces, relations, ouvertures, proportions lisibles et ambiguïtés. N'invente aucune dimension non lisible.`;
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: "openrouter/auto",
        temperature: 0.15,
        max_tokens: 2200,
        messages: [
          { role: "system", content: "Tu es SOPHENIC Design Vision. Analyse uniquement ce qui est réellement visible. Signale toute incertitude et ne prétends jamais à une validation technique ou réglementaire." },
          { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: body.dataUrl } }] }
        ]
      })
    });
    const payload = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string }; model?: string } | null;
    if (!upstream.ok) return NextResponse.json({ error: payload?.error?.message || `OpenRouter ${upstream.status}` }, { status: 502 });
    const analysis = extractText(payload?.choices?.[0]?.message?.content);
    if (!analysis) return NextResponse.json({ error: "Le modèle Vision n’a retourné aucune analyse exploitable." }, { status: 502 });
    return NextResponse.json({ provider: "openrouter", model: payload?.model || "openrouter/auto", analysis });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse Vision indisponible." }, { status: 502 }); }
}
