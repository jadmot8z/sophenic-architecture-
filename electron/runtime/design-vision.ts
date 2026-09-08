import { configuredProviderIds, getProviderCredential } from "./provider-secrets";
import { providerProfile, type ProviderModelProfile, type SophenicCloudProviderId } from "./provider-registry";

export type DesignVisionResult = { provider: SophenicCloudProviderId; model: string; analysis: string };

function imageDataUrl(value: string): string {
  const clean = value.trim();
  if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(clean)) throw new Error("Image Design invalide ou format non pris en charge.");
  if (clean.length > 9_000_000) throw new Error("L’image est trop volumineuse pour l’analyse IA (maximum ~6 Mo)." );
  return clean;
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "";
    const row = item as Record<string, unknown>;
    return typeof row.text === "string" ? row.text : typeof row.content === "string" ? row.content : "";
  }).filter(Boolean).join("\n").trim();
}

function visionModels(provider: SophenicCloudProviderId): ProviderModelProfile[] {
  const profile = providerProfile(provider);
  if (!profile || profile.requiresAccountId) return [];
  const models = [...profile.models].filter((model) => (model.skills.vision || 0) >= 85);
  if (provider === "openrouter") models.unshift({ id: "openrouter/auto", name: "OpenRouter Auto", skills: { vision: 99, documents: 95, reasoning: 94 }, context: 200_000, freeBias: 75 });
  return models.sort((a, b) => (b.skills.vision || 0) - (a.skills.vision || 0) || (b.freeBias || 0) - (a.freeBias || 0));
}

function preferredProviders(): SophenicCloudProviderId[] {
  const ready = new Set(configuredProviderIds());
  const priority: SophenicCloudProviderId[] = ["gemini", "openrouter", "xai", "zai", "alibaba"];
  return priority.filter((provider) => ready.has(provider) && visionModels(provider).length > 0);
}

async function attempt(provider: SophenicCloudProviderId, model: string, key: string, baseUrl: string, headers: Record<string, string>, dataUrl: string, prompt: string): Promise<DesignVisionResult> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: 2200,
      messages: [
        { role: "system", content: "Tu es le module Vision de SOPHENIC Design. Analyse uniquement ce qui est réellement visible. Pour un plan, relève espaces, relations, proportions lisibles, ouvertures et ambiguïtés. Pour une photo, relève style, matériaux, objets, couleurs, éclairage et contraintes visibles. N'invente jamais de dimensions non lisibles et signale explicitement les incertitudes. Retourne un compte rendu technique concis exploitable par un moteur de conception." },
        { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }
      ]
    }),
    signal: AbortSignal.timeout(90_000)
  });
  const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string }; model?: string } | null;
  if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  const analysis = contentText(payload?.choices?.[0]?.message?.content);
  if (!analysis) throw new Error("Réponse vision vide.");
  return { provider, model: payload?.model || model, analysis };
}

export async function analyzeDesignImage(input: { dataUrl: string; name?: string; prompt?: string }): Promise<DesignVisionResult> {
  const dataUrl = imageDataUrl(input.dataUrl);
  const prompt = (input.prompt || `Analyse cette source visuelle${input.name ? ` nommée « ${input.name} »` : ""} pour un projet de conception. Décris les éléments réutilisables dans un modèle 2D/3D ou un redesign.`).trim().slice(0, 6_000);
  const failures: string[] = [];
  for (const provider of preferredProviders()) {
    const profile = providerProfile(provider); if (!profile) continue;
    const credential = getProviderCredential(provider);
    const models = visionModels(provider).slice(0, 2);
    for (const entry of credential.entries.slice(0, 3)) {
      const baseUrl = entry.baseUrl || credential.defaultBaseUrl || profile.baseUrl;
      for (const model of models) {
        try { return await attempt(provider, model.id, entry.key, baseUrl, profile.defaultHeaders || {}, dataUrl, prompt); }
        catch (error) { failures.push(`${profile.name}/${model.name}: ${error instanceof Error ? error.message : String(error)}`); }
      }
    }
  }
  throw new Error(failures.length ? `Aucun modèle Vision n’a abouti. ${failures.slice(0, 3).join(" | ")}` : "Aucun fournisseur IA Vision compatible n’est configuré dans SOPHENIC.");
}
