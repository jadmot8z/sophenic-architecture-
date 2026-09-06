import { z } from "zod";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { openRouterHeaders } from "@/lib/openrouter";

export const runtime = "nodejs";
const schema = z.object({ project: z.record(z.string(), z.unknown()), instruction: z.string().trim().min(1).max(20_000) });

export async function POST(request: Request) {
  const { user } = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); } catch { return NextResponse.json({ error: "Requête Design invalide." }, { status: 400 }); }
  const system = `Tu es SOPHENIC Design, copilote de conception qui modifie le projet courant. Réponds uniquement en JSON {"summary":"...","actions":[],"recommendations":[]}.
Actions autorisées: resize_room, add_room, set_architecture_layout, set_villa_program, apply_architecture_program, add_stairs_connection, set_architecture_style, furnish_room, optimize_room_layout, add_object, move_object, remove_object, clear_room, add_opening, set_material, set_room_color, set_orientation, add_variant, set_product_dimensions, write_web_file, note.
Pour un projet Web contenant webWorkspace.files, une demande de redesign doit produire des actions {"type":"write_web_file","path":"...","content":"CONTENU COMPLET DU FICHIER"}. Analyse réellement les fichiers fournis, préserve le framework et les fonctionnalités sauf demande contraire, et utilise selectedElement comme contexte quand il existe. N'ajoute ni tracking, ni secret, ni dépendance distante inutile.
Pour Architecture, une maison complète doit utiliser set_architecture_layout ou set_villa_program avec des pièces nommées. La maison démarre sans meuble. Pour aménager une pièce entière, utilise furnish_room afin que le moteur de composition impose distances minimales, dégagement des ouvertures et cohérence entre les meubles. Utilise add_object seulement pour un objet unitaire. Utilise optimize_room_layout si des meubles sont trop proches ou gênent la circulation. Pour Architecture/3D, produis des actions géométriques ou matérielles applicables plutôt qu'un simple tutoriel. N'affirme jamais qu'une simulation constitue une validation professionnelle, structurelle, énergétique ou réglementaire.`;
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({ model: "openrouter/free", messages: [{ role: "system", content: system }, { role: "user", content: `PROJET:\n${JSON.stringify(body.project)}\n\nINSTRUCTION:\n${body.instruction}` }], stream: false, temperature: 0.25 })
    });
    const payload = await upstream.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!upstream.ok) return NextResponse.json({ error: payload.error?.message || `OpenRouter ${upstream.status}` }, { status: 502 });
    return NextResponse.json({ content: payload.choices?.[0]?.message?.content || "" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "SOPHENIC Design AI indisponible." }, { status: 502 }); }
}
