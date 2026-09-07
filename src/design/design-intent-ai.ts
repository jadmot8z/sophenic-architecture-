import { buildArchitectureIntent, mergeBrainIntent } from "./design-intent";
import type { DesignIntentSummary, DesignProject, DesignReferenceAnalysis } from "./types";

/**
 * SOPHENIC DESIGN V8.1 — Design Intent via SOPHENIC Brain EXISTANT.
 *
 * RÈGLE ABSOLUE respectée : aucun nouveau cerveau IA n'est créé ici.
 * - Desktop : pont IPC existant `window.sophenicDesktop.openrouter.chat`
 *   (provider "sophenic" → sophenic-brain.ts : routage, providers, clés du coffre).
 * - Web : route existante `/api/design/*` (clés/env OpenRouter déjà en place).
 * Le Brain ne fait que structurer l'intent ; si aucune IA n'est joignable,
 * l'intent heuristique déterministe prend le relais — la génération ne casse jamais.
 */

export type DesignIntentEffortMode = "quick" | "auto" | "deep";
export type BrainChatMessage = { role: "user" | "assistant"; content: string };
export type DesignIntentResolution = { intent: DesignIntentSummary; origin: "brain" | "heuristic"; notice?: string };

const INTENT_JSON_SCHEMA_PROMPT = `Tu es SOPHENIC Design Intent Engine, l'architecte-concepteur senior du module Design. Tu transformes une demande utilisateur + des analyses d'images de référence en un DESIGN INTENT JSON strict. Tu ne crées aucun plan d'action : uniquement l'intention de conception.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, selon ce schéma :
{
  "projectType": "palace" | "villa" | "house" | "interior",
  "style": "libellé du style (max 160 caractères)",
  "finishLevel": "light" | "balanced" | "rich" | "luxury",
  "ambience": "day" | "evening" | "soft",
  "palette": ["#RRGGBB", "..."] (3 à 6 couleurs cohérentes),
  "materials": ["Travertin ivoire", "Noyer fumé", "Verre extra-clair", "..."] (matériaux français, 2 à 8),
  "furnitureStyle": "ex. classique royal très haut de gamme | minimaliste premium contemporain",
  "lighting": "ex. lustres cristal lumière dorée indirecte | lumière naturelle généreuse éclairage linéaire chaud",
  "structuralLanguage": "ex. colonnades monumentales marbre dorures très grandes hauteurs | grandes baies vitrées plan ouvert bois/pierre/verre",
  "monumentality": 0-100 (0 = intime, 100 = palais monumental ; palais≥85, villa moderne≈35-50),
  "wallHeight": hauteur libre moyenne en mètres (palais 4.2-6, villa 2.7-3.2, maison 2.6-2.9),
  "goals": ["..."] (max 8 objectifs de conception concrets),
  "constraints": ["..."] (max 8 contraintes, notamment celles de l'utilisateur),
  "roomTargets": ["..."] (pièces nommées visées, max 10),
  "requestedRooms": [{"name":"Salon","usage":"living"}] (uniquement si l'utilisateur a listé des pièces)
}

RÈGLES :
- « palais majestueux » → projectType "palace", monumentality≥85, wallHeight≥4.2, marbre/dorures, furnitureStyle classique royal, colonnades dans structuralLanguage.
- « villa moderne » → projectType "villa", monumentality 35-50, wallHeight 2.7-3.2, bois/pierre/verre, baies vitrées, furnitureStyle minimaliste premium.
- Les références d'images analysées PRIMENT sur le texte : si elles montrent un style/matériaux précis, aligne style/palette/materials/furnitureStyle dessus.
- Deux intents différents doivent donner des architectures structurellement différentes (hauteurs, volumes, langage structurel, vocabulaire mobilier).
- Ne invente jamais de dimensions non déduisibles ; reste dans les fourchettes données.`;


function parseJsonLoose(text: string): Record<string, unknown> | null {
  const trimmed = (text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* extraction ci-dessous */ }
  const start = trimmed.indexOf("{"); const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { return null; }
  }
  return null;
}

function compactIntentContext(project: DesignProject, instruction: string, references: DesignReferenceAnalysis[]): string {
  return [
    `DEMANDE UTILISATEUR :\n${instruction.slice(0, 4_000)}`,
    `PROJET ACTUEL : ${project.plan.rooms.length} pièce(s) [${project.plan.rooms.slice(0, 10).map((room) => room.name).join(", ")}] · domaine ${project.domain}.`,
    references.length
      ? `RÉFÉRENCES VISUELLES ANALYSÉES (${references.length}) :\n${references.slice(0, 8).map((reference, index) => `${index + 1}. ${reference.name} [${reference.kind}] · style: ${reference.styleHints.join("/") || "n/a"} · matériaux: ${reference.materialHints.join(", ") || "n/a"} · mobilier: ${reference.furnitureHints.slice(0, 4).join(", ") || "n/a"} · lumière: ${reference.lighting || reference.ambience || "n/a"} · proportions: ${reference.proportions || "n/a"} · luxe: ${reference.luxuryLevel || "n/a"} · résumé: ${reference.summary.slice(0, 220)}`).join("\n")}`
      : "RÉFÉRENCES VISUELLES : aucune.",
    "Renvoie maintenant le JSON Design Intent conforme au schéma."
  ].join("\n\n");
}

export function buildIntentMessages(project: DesignProject, instruction: string, references: DesignReferenceAnalysis[]): BrainChatMessage[] {
  return [
    { role: "user", content: `${INTENT_JSON_SCHEMA_PROMPT}\n\n====================\n\n${compactIntentContext(project, instruction, references)}` }
  ];
}

async function brainChatViaDesktop(messages: BrainChatMessage[], effortMode: DesignIntentEffortMode): Promise<string | null> {
  if (typeof window === "undefined" || !window.sophenicDesktop?.openrouter) return null;
  const result = await window.sophenicDesktop.openrouter.chat({
    requestId: `design-intent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    provider: "sophenic",
    model: "auto",
    effortMode,
    messages
  });
  return result.content || null;
}

async function brainChatViaWeb(messages: BrainChatMessage[]): Promise<string | null> {
  const response = await fetch("/api/design/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const payload = await response.json().catch(() => null) as { content?: string; error?: string } | null;
  if (!response.ok || !payload) throw new Error(payload?.error || `Intent IA indisponible (HTTP ${response.status}).`);
  return payload.content || null;
}

/**
 * V8.2 — pont générique vers le SOPHENIC Brain EXISTANT (desktop IPC puis
 * route web). Réutilisé par le Design Intent Engine et le Room Understanding
 * Engine : Design reste une compétence du Brain, pas un cerveau séparé.
 */
export async function chatWithExistingBrain(messages: BrainChatMessage[], effortMode: DesignIntentEffortMode = "auto"): Promise<{ content: string | null; failures: string[] }> {
  const failures: string[] = [];
  try {
    const desktopContent = await brainChatViaDesktop(messages, effortMode);
    if (desktopContent) return { content: desktopContent, failures };
    failures.push("Brain desktop indisponible");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  if (typeof window !== "undefined") {
    try {
      const webContent = await brainChatViaWeb(messages);
      if (webContent) return { content: webContent, failures };
      failures.push("réponse web vide");
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { content: null, failures };
}

/**
 * Résout le Design Intent V8.1 :
 * 1. intent heuristique déterministe (toujours construit, sert de garde-fou) ;
 * 2. si le Brain existant répond, l'intent est enrichi/validé champ par champ
 *    via `mergeBrainIntent` (origin "brain").
 */
export async function resolveDesignIntent(input: { project: DesignProject; instruction: string; references?: DesignReferenceAnalysis[]; effortMode?: DesignIntentEffortMode }): Promise<DesignIntentResolution> {
  const references = input.references || [];
  const base = buildArchitectureIntent(input.project, input.instruction, references);
  const messages = buildIntentMessages(input.project, input.instruction, references);
  const failures: string[] = [];
  try {
    const desktopContent = await brainChatViaDesktop(messages, input.effortMode || "auto");
    if (desktopContent) {
      const parsed = parseJsonLoose(desktopContent);
      if (parsed && typeof parsed.style === "string") return { intent: mergeBrainIntent(base, parsed), origin: "brain", notice: "Design Intent construit via SOPHENIC Brain (desktop)." };
      failures.push("réponse Brain non exploitable");
    } else {
      failures.push("Brain desktop indisponible");
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  if (typeof window !== "undefined") {
    try {
      const webContent = await brainChatViaWeb(messages);
      if (webContent) {
        const parsed = parseJsonLoose(webContent);
        if (parsed && typeof parsed.style === "string") return { intent: mergeBrainIntent(base, parsed), origin: "brain", notice: "Design Intent construit via SOPHENIC Brain (web)." };
        failures.push("réponse web non exploitable");
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { intent: base, origin: "heuristic", notice: failures.length ? `Design Intent déterministe (IA indisponible : ${failures[0]}).` : "Design Intent déterministe." };
}

/** V8.2 — parse JSON tolérant réutilisé par les compétences du Brain. */
export { parseJsonLoose as parseBrainJson };
