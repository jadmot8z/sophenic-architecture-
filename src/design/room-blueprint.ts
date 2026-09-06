import { canonicalMaterialText } from "./material-canon";
import type { DesignInteriorFinishLevel, DesignReferenceAnalysis, DesignRoomBlueprint } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — ROOM UNDERSTANDING ENGINE.
 *
 * Une image d'inspiration devient la SOURCE DE VÉRITÉ de la reconstruction :
 * le moteur Vision (providers existants) retourne un ROOM_BLUEPRINT JSON
 * (architecture, layout, style, matériaux, palette, mobilier, ambiance),
 * parsé ici. Représentation heuristique si la réponse n'est pas du JSON.
 */

const uid = (prefix = "blueprint") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function firstJsonBlock(text: string): Record<string, unknown> | null {
  if (!text.includes("{")) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced?.[1]?.includes("{")) candidates.push(fenced[1]);
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim()) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* candidat suivant */ }
  }
  return null;
}

function asStringArray(value: unknown, limit = 10): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 90)))].slice(0, limit);
}

function parseLuxury(value: unknown, fallback: DesignInteriorFinishLevel = "balanced"): DesignInteriorFinishLevel {
  const raw = norm(typeof value === "string" ? value : "");
  if (/luxur|palai|royal|ultra/.test(raw)) return "luxury";
  if (/rich|premium|haut de gamme|raffin/.test(raw)) return "rich";
  if (/light|minimal|sobre|simple/.test(raw)) return "light";
  return fallback;
}

/** Parse la réponse JSON du moteur Vision en ROOM_BLUEPRINT (null si inexploitable). */
export function parseRoomBlueprint(analysis: string, sourceImageIds: string[] = []): DesignRoomBlueprint | null {
  const payload = firstJsonBlock(analysis);
  if (!payload) return null;
  const layoutRow = payload.layout && typeof payload.layout === "object" && !Array.isArray(payload.layout) ? payload.layout as Record<string, unknown> : {};
  const archRow = payload.architecture && typeof payload.architecture === "object" && !Array.isArray(payload.architecture) ? payload.architecture as Record<string, unknown> : {};
  const style = typeof payload.style === "string" ? payload.style.trim().slice(0, 140) : "";
  const materials = asStringArray(payload.materials, 8).map(canonicalMaterialText).filter((value): value is string => Boolean(value));
  const palette = asStringArray(payload.palette ?? payload.colors, 6);
  const furniture = (Array.isArray(payload.furniture) ? payload.furniture : []).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((item) => ({
    name: typeof item.name === "string" ? item.name.trim().slice(0, 90) : "",
    type: typeof item.type === "string" ? item.type.trim().slice(0, 60) : undefined,
    count: Number.isFinite(Number(item.count)) && Number(item.count) > 0 ? Math.min(8, Math.round(Number(item.count))) : undefined,
    notes: typeof item.notes === "string" ? item.notes.trim().slice(0, 140) : undefined
  })).filter((item) => item.name.length > 0).slice(0, 16);
  if (!style && !materials.length && !furniture.length) return null;
  const openings = (Array.isArray(archRow.openings) ? archRow.openings : []).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map((item) => ({
    kind: norm(String(item.kind ?? "window")).includes("door") ? "door" as const : "window" as const,
    side: typeof item.side === "string" ? item.side.trim().slice(0, 10) : undefined,
    width: Number(item.width) > 0 ? Math.min(8, Number(item.width)) : undefined,
    height: Number(item.height) > 0 ? Math.min(6, Number(item.height)) : undefined
  })).slice(0, 10);
  const numOr = (value: unknown) => Number(value) > 0 ? Number(value) : undefined;
  const summary = typeof payload.summary === "string" ? payload.summary.trim().slice(0, 300) : [style, materials.slice(0, 3).join(", "), furniture.slice(0, 3).map((item) => item.name).join(", ")].filter(Boolean).join(" · ");
  return {
    id: uid(),
    room: typeof payload.room === "string" && payload.room.trim() ? payload.room.trim().slice(0, 60) : "living_room",
    style: style || "contemporary",
    layout: {
      sofa: typeof layoutRow.sofa === "string" ? layoutRow.sofa.trim().slice(0, 120) : undefined,
      coffeeTable: typeof layoutRow.coffeeTable === "string" ? layoutRow.coffeeTable.trim().slice(0, 120) : undefined,
      chairs: typeof layoutRow.chairs === "string" ? layoutRow.chairs.trim().slice(0, 120) : undefined,
      tvZone: typeof layoutRow.tvZone === "string" ? layoutRow.tvZone.trim().slice(0, 120) : undefined,
      circulation: typeof layoutRow.circulation === "string" ? layoutRow.circulation.trim().slice(0, 120) : undefined,
      freeZones: asStringArray(layoutRow.freeZones, 5)
    },
    architecture: {
      estimatedWidth: numOr(archRow.estimatedWidth) ?? numOr(archRow.width),
      estimatedDepth: numOr(archRow.estimatedDepth) ?? numOr(archRow.depth),
      ceilingHeight: numOr(archRow.ceilingHeight) ?? numOr(archRow.height),
      openings
    },
    materials,
    palette,
    furniture,
    lighting: typeof payload.lighting === "string" ? payload.lighting.trim().slice(0, 160) : undefined,
    luxuryLevel: parseLuxury(payload.luxuryLevel),
    sourceImageIds,
    origin: "vision-ai",
    summary: summary || "Pièce analysée par le moteur Vision.",
    createdAt: new Date().toISOString()
  };
}

/** Blueprint heuristique dérivé des références analysées (sans JSON Vision exploitable). */
export function deriveRoomBlueprint(references: DesignReferenceAnalysis[], sourceImageIds: string[] = []): DesignRoomBlueprint | null {
  if (!references.length) return null;
  const interior = references.find((reference) => reference.kind === "interior" || reference.kind === "inspiration") || references[0];
  const style = interior.styleHints[0] || "contemporary";
  const materials = [...new Set(references.flatMap((reference) => reference.materialHints))].slice(0, 8);
  const palette = [...new Set(references.flatMap((reference) => reference.paletteHints))].slice(0, 6);
  const furnitureNames = [...new Set(references.flatMap((reference) => reference.furnitureHints))].slice(0, 12);
  return {
    id: uid(),
    room: interior.roomHints[0] ? norm(interior.roomHints[0]).replace(/\s+/g, "_") : "living_room",
    style,
    layout: {},
    architecture: {},
    materials,
    palette,
    furniture: furnitureNames.map((name) => ({ name })),
    lighting: references.find((reference) => reference.lighting)?.lighting,
    luxuryLevel: references.find((reference) => reference.luxuryLevel)?.luxuryLevel || "balanced",
    sourceImageIds: sourceImageIds.length ? sourceImageIds : references.map((reference) => reference.assetId),
    origin: "derived",
    summary: `Style ${style}${materials.length ? ` · ${materials.slice(0, 3).join(", ")}` : ""}${furnitureNames.length ? ` · ${furnitureNames.slice(0, 3).join(", ")}` : ""}.`,
    createdAt: new Date().toISOString()
  };
}

/** Extrait le meilleur blueprint disponible : JSON Vision parsé, sinon dérivation. */
export function roomBlueprintFromAnalyses(references: DesignReferenceAnalysis[]): DesignRoomBlueprint | null {
  for (const reference of references) {
    const parsed = parseRoomBlueprint(reference.summary && reference.extraction === "vision-ai" ? reference.summary : "", [reference.assetId]);
    if (parsed) return parsed;
  }
  // Le texte complet de l'analyse est conservé dans les assets ; les hints
  // structurés suffisent à une dérivation honnête.
  return deriveRoomBlueprint(references);
}

/** Résumé humain pour la carte « IMAGE ANALYSÉE » de l'UI. */
export function blueprintSummaryLines(blueprint: DesignRoomBlueprint): { style: string; materials: string; layout: string; furniture: string } {
  const layoutParts = [blueprint.layout.sofa, blueprint.layout.coffeeTable, blueprint.layout.chairs, blueprint.layout.tvZone].filter((value): value is string => Boolean(value));
  return {
    style: blueprint.style,
    materials: blueprint.materials.slice(0, 4).join(", ") || "—",
    layout: layoutParts.length ? layoutParts.slice(0, 3).join(" · ") : /open|ouvert/.test(norm(blueprint.summary)) ? "Open living room" : "—",
    furniture: blueprint.furniture.slice(0, 4).map((item) => item.name).join(", ") || "—"
  };
}
