import { chatWithExistingBrain, parseBrainJson, type DesignIntentEffortMode } from "./design-intent-ai";
import { blueprintSummaryLines, deriveRoomBlueprint, parseRoomBlueprint, roomBlueprintFromAnalyses } from "./room-blueprint";
import type { DesignProject, DesignReferenceAnalysis, DesignRoomBlueprint } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — ROOM UNDERSTANDING ENGINE (compétence du Brain existant).
 *
 * 1. Le moteur Vision (providers existants) analyse l'image avec le prompt
 *    ci-dessous et retourne un ROOM_BLUEPRINT JSON.
 * 2. `resolveRoomBlueprint` fait valider/enrichir la compréhension par le
 *    SOPHENIC Brain (même pont IPC / même route que le Design Intent).
 * 3. Sans IA joignable : dérivation honnête des hints structurés.
 */

export const ROOM_UNDERSTANDING_VISION_PROMPT = `Analyse cette image d'intérieur pour SOPHENIC Design. Tu es un architecte d'intérieur senior. Réponds UNIQUEMENT en JSON valide (aucun markdown) décrivant la pièce réellement visible :
{
  "room": "living_room",
  "style": "ex. warm contemporary luxury",
  "layout": { "sofa": "ex. L shape facing TV", "coffeeTable": "ex. center", "chairs": "ex. symmetrical", "tvZone": "ex. wall opposite sofa", "circulation": "ex. open path along window", "freeZones": ["ex. reading corner"] },
  "architecture": { "estimatedWidth": 5.5, "estimatedDepth": 4.2, "ceilingHeight": 2.8, "openings": [{ "kind": "window", "side": "south", "width": 2.4, "height": 1.5 }] },
  "materials": ["travertine", "walnut", "linen"],
  "palette": ["warm beige", "brown", "black metal"],
  "furniture": [{ "name": "large sofa", "type": "sofa", "count": 1 }, { "name": "stone coffee table", "type": "coffee table", "count": 1 }],
  "lighting": "ex. warm indirect, floor lamps",
  "luxuryLevel": "light|balanced|rich|luxury",
  "summary": "une phrase"
}
RÈGLES : dimensions en mètres, estimées et plausibles uniquement si lisibles ; décris uniquement le visible ; note les zones de circulation ; sois précis sur le style, les matériaux et le mobilier.`;

export function buildRoomUnderstandingMessages(instruction: string, references: DesignReferenceAnalysis[], blueprintHint?: DesignRoomBlueprint | null): Array<{ role: "user" | "assistant"; content: string }> {
  const context = [
    instruction ? `DEMANDE UTILISATEUR :\n${instruction.slice(0, 3_000)}` : "",
    references.length ? `ANALYSES VISUELLES DISPONIBLES :\n${references.slice(0, 6).map((reference, index) => `${index + 1}. ${reference.name} · style: ${reference.styleHints.join("/") || "?"} · matériaux: ${reference.materialHints.join(", ") || "?"} · mobilier: ${reference.furnitureHints.slice(0, 5).join(", ") || "?"} · luxe: ${reference.luxuryLevel || "?"}`).join("\n")}` : "",
    blueprintHint ? `BLUEPRINT DÉJÀ PARSÉ (à valider/affiner) :\n${JSON.stringify({ room: blueprintHint.room, style: blueprintHint.style, layout: blueprintHint.layout, architecture: blueprintHint.architecture, materials: blueprintHint.materials, furniture: blueprintHint.furniture.slice(0, 10) })}` : ""
  ].filter(Boolean).join("\n\n");
  return [{ role: "user", content: `${ROOM_UNDERSTANDING_VISION_PROMPT.replace(/^Analyse cette image d'intérieur pour SOPHENIC Design\. /, "Contexte SOPHENIC Design — complète/valide ce ROOM_BLUEPRINT : ")}\n\n====================\n\n${context || "Aucun contexte supplémentaire."}\n\nRenvoie maintenant le JSON ROOM_BLUEPRINT complet.` }];
}

function mergeBlueprint(base: DesignRoomBlueprint, brain: Record<string, unknown>): DesignRoomBlueprint {
  const merged: DesignRoomBlueprint = { ...base, origin: "brain" };
  if (typeof brain.room === "string" && brain.room.trim()) merged.room = brain.room.trim().slice(0, 60);
  if (typeof brain.style === "string" && brain.style.trim().length >= 3) merged.style = brain.style.trim().slice(0, 140);
  if (Array.isArray(brain.materials) && brain.materials.length) {
    const materials = brain.materials.filter((item): item is string => typeof item === "string").slice(0, 8);
    if (materials.length) merged.materials = materials;
  }
  if (Array.isArray(brain.furniture) && brain.furniture.length) {
    const furniture = brain.furniture.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map((item) => ({ name: typeof item.name === "string" ? item.name.trim().slice(0, 90) : "", count: Number(item.count) > 0 ? Math.min(8, Math.round(Number(item.count))) : undefined, type: typeof item.type === "string" ? item.type.slice(0, 60) : undefined })).filter((item) => item.name);
    if (furniture.length) merged.furniture = furniture.slice(0, 16);
  }
  if (brain.layout && typeof brain.layout === "object" && !Array.isArray(brain.layout)) {
    const layout = brain.layout as Record<string, unknown>;
    for (const key of ["sofa", "coffeeTable", "chairs", "tvZone", "circulation"] as const) {
      if (typeof layout[key] === "string" && (layout[key] as string).trim()) merged.layout[key] = (layout[key] as string).trim().slice(0, 120);
    }
  }
  if (typeof brain.summary === "string" && brain.summary.trim()) merged.summary = brain.summary.trim().slice(0, 300);
  return merged;
}

export type RoomUnderstandingResolution = { blueprint: DesignRoomBlueprint | null; origin: "vision-ai" | "derived" | "brain" | "none"; notice: string };

/**
 * Résout le ROOM_BLUEPRINT : JSON Vision déjà parsé → validation par le Brain
 * existant → sinon dérivation des hints. Ne retourne jamais un blueprint inventé.
 */
export async function resolveRoomBlueprint(input: { instruction: string; references: DesignReferenceAnalysis[]; existing?: DesignRoomBlueprint | null; effortMode?: DesignIntentEffortMode }): Promise<RoomUnderstandingResolution> {
  const base = input.existing || roomBlueprintFromAnalyses(input.references);
  if (!base) return { blueprint: null, origin: "none", notice: "Aucune image d'inspiration analysée pour l'instant." };
  try {
    const { content, failures } = await chatWithExistingBrain(buildRoomUnderstandingMessages(input.instruction, input.references, base), input.effortMode || "auto");
    const parsed = content ? parseBrainJson(content) : null;
    if (parsed && typeof parsed.style === "string") return { blueprint: mergeBlueprint(base, parsed), origin: "brain", notice: "Room Understanding validé via SOPHENIC Brain." };
    return { blueprint: base, origin: base.origin, notice: failures.length ? `Room Understanding local (Brain indisponible : ${failures[0]}).` : "Room Understanding local." };
  } catch (error) {
    return { blueprint: base, origin: base.origin, notice: `Room Understanding local (${error instanceof Error ? error.message : "erreur Brain"}).` };
  }
}

/** Prompt Vision utilisé à l'import d'une inspiration (bouton « Analyser une inspiration »). */
export function inspirationVisionPrompt(instruction?: string): string {
  return instruction ? `${ROOM_UNDERSTANDING_VISION_PROMPT}\n\nAttention particulière : ${instruction.slice(0, 400)}` : ROOM_UNDERSTANDING_VISION_PROMPT;
}

export { parseRoomBlueprint, deriveRoomBlueprint, roomBlueprintFromAnalyses, blueprintSummaryLines };
export type { DesignRoomBlueprint, DesignProject };
