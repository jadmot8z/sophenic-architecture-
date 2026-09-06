import { effectiveAssetVocabulary, profileForArchetype } from "./intent-profiles";
import { parseArchitectureBrief } from "./interior-brief";
import type { DesignArchitectureBrief, DesignIntentArchetype, DesignInteriorFinishLevel, DesignIntentSummary, DesignProject, DesignReferenceAnalysis, DesignReferenceKind } from "./types";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const uid = (prefix = "design-ref") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const unique = <T,>(values: T[]) => [...new Set(values.filter((value): value is T => Boolean(value)))];

type HintRule = { pattern: RegExp; value: string };

const STYLE_RULES: HintRule[] = [
  { pattern: /palai|palace|royal|majest/, value: "palatial majestueux" },
  { pattern: /villa/, value: "villa contemporaine" },
  { pattern: /japandi/, value: "japandi" },
  { pattern: /minimal/, value: "minimaliste chaleureux" },
  { pattern: /mediterr|m[ée]diterran/, value: "méditerranéen contemporain" },
  { pattern: /classique|haussmann|traditional/, value: "classique raffiné" },
  { pattern: /moderne|contemporain/, value: "contemporain" }
];

const MATERIAL_RULES: HintRule[] = [
  { pattern: /travertin|travertine/, value: "Travertin ivoire" },
  { pattern: /marbre|marble/, value: "Marbre Calacatta clair" },
  { pattern: /noyer|walnut/, value: "Noyer fumé" },
  { pattern: /ch[eê]ne|oak/, value: "Chêne naturel" },
  { pattern: /laiton|brass/, value: "Laiton brossé" },
  { pattern: /verre|glass/, value: "Verre extra-clair" },
  { pattern: /velours|velvet/, value: "Velours ivoire" },
  { pattern: /boucl[eé]/, value: "Bouclé sable" },
  { pattern: /pierre|stone/, value: "Pierre calcaire" },
  { pattern: /lin|linen/, value: "Lin ivoire" }
];

const PALETTE_RULES: HintRule[] = [
  { pattern: /ivoire|ivory|cr[eè]me|cream/, value: "#F3EEE6" },
  { pattern: /beige|sable|sand|taupe/, value: "#D7C8B4" },
  { pattern: /bois|noisette|caramel|brun chaud/, value: "#B69C7C" },
  { pattern: /noyer|cognac|terre cuite|terracotta/, value: "#73523C" },
  { pattern: /vert sauge|sage|olive/, value: "#6D7A68" },
  { pattern: /noir|anthracite|charcoal/, value: "#272925" },
  { pattern: /or|gold|laiton/, value: "#B08A52" }
];

const FURNITURE_RULES: HintRule[] = [
  { pattern: /canap|sofa/, value: "canapé premium" },
  { pattern: /fauteuil|armchair/, value: "fauteuil d’accent" },
  { pattern: /table basse|coffee table/, value: "table basse" },
  { pattern: /table a manger|table à manger|dining/, value: "table à manger" },
  { pattern: /lit|bed/, value: "lit haut de gamme" },
  { pattern: /suspension|luminaire|lamp|lustre|chandelier/, value: "luminaire décoratif" },
  { pattern: /rideau|curtain/, value: "rideaux pleine hauteur" },
  { pattern: /tapis|rug/, value: "tapis de zone" },
  { pattern: /plante|plant/, value: "plantes d’intérieur" }
];

const ROOM_RULES: HintRule[] = [
  { pattern: /salon|living/, value: "Salon" },
  { pattern: /cuisine|kitchen/, value: "Cuisine" },
  { pattern: /salle a manger|salle à manger|dining/, value: "Salle à manger" },
  { pattern: /suite|master bedroom|bedroom|chambre/, value: "Suite parentale" },
  { pattern: /bureau|office/, value: "Bureau" },
  { pattern: /bath|salle de bain|salle d’eau/, value: "Salle de bain" },
  { pattern: /hall|entry|foyer/, value: "Hall" }
];

function collect(text: string, rules: HintRule[], limit = 8): string[] {
  const hits: string[] = [];
  for (const rule of rules) if (rule.pattern.test(text)) hits.push(rule.value);
  return unique(hits).slice(0, limit);
}

function inferAmbience(text: string): "day" | "evening" | "soft" {
  if (/soir|evening|night|nuit|tamis/.test(text)) return "evening";
  if (/jour|daylight|morning|sunlit|lumineux/.test(text)) return "day";
  return "soft";
}

function inferLuxury(text: string): DesignReferenceAnalysis["luxuryLevel"] {
  if (/palai|palace|ultra luxe|tr[eè]s haut de gamme|luxury|majest/.test(text)) return "luxury";
  if (/premium|haut de gamme|raffin|riche|d[eé]taill/.test(text)) return "rich";
  if (/minimal|sobre|simple/.test(text)) return "light";
  return "balanced";
}

function inferReferenceKind(name: string, text: string): DesignReferenceKind {
  const haystack = `${normalize(name)} ${text}`;
  if (/plan|floor plan|blueprint/.test(haystack)) return "plan";
  if (/facade|fa[cç]ade|exterieur|extérieur/.test(haystack)) return "facade";
  if (/material|mati[eè]re|marble|travertin|wood|texture/.test(haystack)) return "material";
  if (/interior|salon|bedroom|cuisine|living/.test(haystack)) return "interior";
  return "inspiration";
}

function inferProjectType(text: string): DesignIntentSummary["projectType"] {
  if (/palai|palace|royal|majest/.test(text)) return "palace";
  if (/villa/.test(text)) return "villa";
  if (/salon|cuisine|chambre|bathroom|interior|int[eé]rieur/.test(text)) return "interior";
  return "house";
}

const MATERIAL_CANON: Array<[RegExp, string]> = [
  [/travertin|travertine/, "Travertin ivoire"],
  [/marbre|marble|calacatta|carrara/, "Marbre Calacatta clair"],
  [/noyer|walnut/, "Noyer fumé"],
  [/ch[eê]ne|oak/, "Chêne naturel"],
  [/laiton|brass|gold|dor/, "Laiton brossé"],
  [/velours|velvet/, "Velours ivoire"],
  [/boucl/, "Bouclé sable"],
  [/verre|glass/, "Verre extra-clair"],
  [/pierre calcaire|limestone/, "Pierre calcaire"],
  [/lin|linen/, "Lin ivoire"],
  [/cuir|leather/, "Cuir cognac"],
  [/b[eé]ton|concrete/, "Béton ciré chaud"],
  [/bronze/, "Bronze patiné"],
  [/m[eé]tal noir|black metal/, "Métal noir satiné"]
];

/** Normalise un matériau libre (« walnut clair » → « Noyer fumé ») issu d'une référence IA. */
function canonicalMaterial(value: string): string | null {
  const clean = normalize(value).replace(/[.;]/g, "").trim();
  if (!clean || clean.length > 60) return null;
  for (const [pattern, name] of MATERIAL_CANON) if (pattern.test(clean)) return name;
  const pretty = value.trim().replace(/\s+/g, " ");
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : null;
}

function asStringArray(value: unknown, limit = 10): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 80))).slice(0, limit);
}

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
    } catch { /* essaie le candidat suivant */ }
  }
  return null;
}

/**
 * V8.1 — parse la réponse JSON structurée du modèle Vision (via SOPHENIC Brain/
 * providers existants) en `DesignReferenceAnalysis` riche. Retourne null si la
 * réponse n'est pas du JSON exploitable (fallback heuristique ensuite).
 */
export function parseVisionReferenceAnalysis(input: { assetId?: string; name: string; analysis: string }): DesignReferenceAnalysis | null {
  const payload = firstJsonBlock(input.analysis);
  if (!payload) return null;
  const style = typeof payload.style === "string" ? payload.style.trim().slice(0, 120) : "";
  const materials = asStringArray(payload.materials, 8).map(canonicalMaterial).filter((value): value is string => Boolean(value));
  const colors = asStringArray(payload.colors ?? payload.palette, 6).filter((value) => /^#[0-9a-f]{6}$/i.test(value) || /\b(?:ivoire|beige|noir|blanc|gris|bois|or|brun|vert|taupe|cr[eè]me|sable|marbre)\b/i.test(value));
  const furniture = asStringArray(payload.furniture ?? payload.mobilier, 10);
  const rooms = asStringArray(payload.rooms, 8);
  const luxuryRaw = typeof payload.luxuryLevel === "string" ? normalize(payload.luxuryLevel) : "";
  const ambienceRaw = typeof payload.ambiance === "string" ? normalize(payload.ambiance) : "";
  const luxuryLevel: DesignInteriorFinishLevel = /luxur|palai|royal|ultra/.test(luxuryRaw) ? "luxury" : /rich|premium|haut de gamme|raffin/.test(luxuryRaw) ? "rich" : /light|minimal|sobre|simple/.test(luxuryRaw) ? "light" : /palai|royal/.test(style) ? "luxury" : "balanced";
  const ambience = /soir|evening|nuit|warm chaud|tamis/.test(ambienceRaw) ? "evening" : /jour|day|lumineux|naturel/.test(ambienceRaw) ? "day" : "soft";
  const summary = typeof payload.summary === "string" ? payload.summary.trim().slice(0, 360) : [style, materials.slice(0, 3).join(", "), furniture.slice(0, 3).join(", ")].filter(Boolean).join(" · ").slice(0, 360);
  if (!style && !materials.length && !furniture.length) return null;
  return {
    id: uid("ref"),
    assetId: input.assetId || uid("asset"),
    name: input.name.trim().slice(0, 200) || "Référence",
    kind: inferReferenceKind(input.name, `${style} ${summary} ${rooms.join(" ")}`),
    summary: summary || "Référence visuelle analysée par le modèle Vision.",
    styleHints: style ? [style] : [],
    paletteHints: colors,
    materialHints: materials,
    furnitureHints: furniture,
    roomHints: rooms.map((room) => room.charAt(0).toUpperCase() + room.slice(1)),
    ambience,
    luxuryLevel,
    lighting: typeof payload.lighting === "string" ? payload.lighting.trim().slice(0, 160) : undefined,
    furnitureStyle: typeof payload.furnitureStyle === "string" ? payload.furnitureStyle.trim().slice(0, 160) : undefined,
    proportions: typeof payload.proportions === "string" ? payload.proportions.trim().slice(0, 160) : undefined,
    extraction: "vision-ai",
    createdAt: new Date().toISOString()
  };
}

export function analyzeReferenceText(input: { assetId?: string; name: string; analysis: string }): DesignReferenceAnalysis {
  // V8.1 : le prompt Vision demande un JSON structuré ; on le parse d'abord.
  const structured = parseVisionReferenceAnalysis(input);
  if (structured) return structured;
  const source = normalize(`${input.name} ${input.analysis}`);
  const styleHints = collect(source, STYLE_RULES);
  const materialHints = collect(source, MATERIAL_RULES);
  const paletteHints = collect(source, PALETTE_RULES, 6);
  const furnitureHints = collect(source, FURNITURE_RULES, 10);
  const roomHints = collect(source, ROOM_RULES, 8);
  return {
    id: uid("ref"),
    assetId: input.assetId || uid("asset"),
    name: input.name.trim().slice(0, 200) || "Référence",
    kind: inferReferenceKind(input.name, source),
    summary: input.analysis.trim().replace(/\s+/g, " ").slice(0, 360),
    styleHints,
    paletteHints,
    materialHints,
    furnitureHints,
    roomHints,
    ambience: inferAmbience(source),
    luxuryLevel: inferLuxury(source),
    extraction: "heuristic",
    createdAt: new Date().toISOString()
  };
}

function referenceDrivenGoals(references: DesignReferenceAnalysis[]): string[] {
  return unique(references.flatMap((reference) => [
    ...reference.furnitureHints.slice(0, 2).map((value) => `intégrer ${value}`),
    ...reference.styleHints.slice(0, 1).map((value) => `respecter l’esprit ${value}`)
  ])).slice(0, 10);
}

function archetypeFor(projectType: DesignIntentSummary["projectType"], text: string): DesignIntentArchetype {
  if (projectType === "palace") return "palace";
  if (projectType === "villa") return "villa";
  if (projectType === "interior") return "interior";
  if (projectType === "web" || projectType === "product") return projectType;
  if (/(?:plusieurs|deux|trois|2|3)\s+(?:etage|étages|niveaux?)|etage|étage/.test(text)) return "villa";
  return "house";
}

/**
 * V8.1 — fusionne une réponse JSON du Brain dans l'intent heuristique.
 * Champs validés/un par un : une réponse IA partielle ou invalide ne casse jamais
 * la génération (règle : jamais de nouveau cerveau, jamais de plan corrompu).
 */
export function mergeBrainIntent(base: DesignIntentSummary, brain: Record<string, unknown>): DesignIntentSummary {
  const merged: DesignIntentSummary = { ...base, intentVersion: "8.1", origin: "brain" };
  const strings = (value: unknown, limit: number) => asStringArray(value, limit);
  if (typeof brain.style === "string" && brain.style.trim().length >= 3) merged.style = brain.style.trim().slice(0, 160);
  const projectType = typeof brain.projectType === "string" ? brain.projectType.trim().toLowerCase() : "";
  if (["house", "villa", "palace", "interior", "web", "product"].includes(projectType)) {
    merged.projectType = projectType as DesignIntentSummary["projectType"];
    merged.archetype = archetypeFor(merged.projectType, `${merged.style} ${projectType}`);
  }
  const finish = typeof brain.finishLevel === "string" ? brain.finishLevel.trim().toLowerCase() : "";
  if (["light", "balanced", "rich", "luxury"].includes(finish)) merged.finishLevel = finish as DesignIntentSummary["finishLevel"];
  const ambience = typeof brain.ambience === "string" ? normalize(brain.ambience) : "";
  if (ambience.includes("day") || ambience.includes("jour")) merged.ambience = "day";
  else if (ambience.includes("evening") || ambience.includes("soir")) merged.ambience = "evening";
  else if (ambience.includes("soft")) merged.ambience = "soft";
  const palette = strings(brain.palette, 6).filter((value) => /^#[0-9a-f]{6}$/i.test(value));
  if (palette.length >= 2) merged.palette = palette;
  const materials = strings(brain.materials, 8).map(canonicalMaterial).filter((value): value is string => Boolean(value));
  if (materials.length) merged.materials = materials;
  if (typeof brain.furnitureStyle === "string" && brain.furnitureStyle.trim()) merged.furnitureStyle = brain.furnitureStyle.trim().slice(0, 160);
  if (typeof brain.lighting === "string" && brain.lighting.trim()) merged.lighting = brain.lighting.trim().slice(0, 160);
  if (typeof brain.structuralLanguage === "string" && brain.structuralLanguage.trim()) merged.structuralLanguage = brain.structuralLanguage.trim().slice(0, 200);
  const monumentality = Number(brain.monumentality);
  if (Number.isFinite(monumentality)) merged.monumentality = Math.max(0, Math.min(100, Math.round(monumentality)));
  const wallHeight = Number(brain.wallHeight);
  if (Number.isFinite(wallHeight) && wallHeight >= 2.2 && wallHeight <= 9) merged.wallHeight = Math.round(wallHeight * 10) / 10;
  const goals = strings(brain.goals, 12);
  if (goals.length) merged.goals = unique([...goals, ...base.goals]).slice(0, 12);
  const constraints = strings(brain.constraints, 10);
  if (constraints.length) merged.constraints = unique([...base.constraints, ...constraints]).slice(0, 14);
  const rooms = strings(brain.roomTargets, 10);
  if (rooms.length) merged.roomTargets = rooms;
  const requested = Array.isArray(brain.requestedRooms) ? brain.requestedRooms.filter((item): item is { name: string; usage?: string } => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof (item as { name?: unknown }).name === "string")).map((item) => ({ name: String(item.name).slice(0, 80), ...(typeof item.usage === "string" && item.usage.trim() ? { usage: item.usage.trim().slice(0, 40) } : {}) })).slice(0, 20) : [];
  if (requested.length) merged.requestedRooms = requested;
  return merged;
}

export function buildArchitectureIntent(project: DesignProject, instruction: string, references: DesignReferenceAnalysis[] = []): DesignIntentSummary {
  const brief: DesignArchitectureBrief = parseArchitectureBrief(instruction, project);
  const source = normalize(`${instruction} ${references.map((item) => `${item.name} ${item.summary} ${item.styleHints.join(" ")} ${item.materialHints.join(" ")} ${item.furnitureStyle || ""}`).join(" ")}`);
  const projectType = inferProjectType(source);
  const archetype = archetypeFor(projectType, source);
  const profile = profileForArchetype(archetype === "interior" ? "house" : archetype);
  const palette = unique([...(archetype === "palace" ? profile.basePalette : []), ...brief.palette, ...references.flatMap((item) => item.paletteHints)]).slice(0, 6);
  const referenceMaterials = references.flatMap((item) => item.materialHints);
  // V8.1 : les matériaux détectés dans les images de référence PRIMENT sur les
  // presets par défaut du brief (l'inverse pour un palais, dont le programme
  // impose marbre/dorures sauf demande contraire explicite).
  const materials = unique([...(archetype === "palace" ? profile.baseMaterials : []), ...(archetype === "palace" ? brief.materials : referenceMaterials.length ? [...referenceMaterials, ...brief.materials] : brief.materials)]).slice(0, 8);
  const styles = unique([...references.flatMap((item) => item.styleHints), brief.style]);
  const referenceStyle = references.find((item) => item.styleHints.length)?.styleHints[0];
  const inferredStyle = archetype === "palace"
    ? `${styles[0] || profile.styleLabel} — monumental très haut de gamme`
    : archetype === "villa"
      ? `${styles[0] || profile.styleLabel} — contemporain chaleureux`
      : styles[0] || profile.styleLabel;
  // V8.1 : le niveau de finition perçu dans les références élève celui du brief
  // (une image « rich » ne doit jamais réduire une demande « luxury »).
  const FINISH_RANK: Record<DesignIntentSummary["finishLevel"], number> = { light: 0, balanced: 1, rich: 2, luxury: 3 };
  const referenceFinish = references.reduce((rank, item) => Math.max(rank, FINISH_RANK[item.luxuryLevel || "balanced"] ?? 1), 0);
  const finishLevel: DesignIntentSummary["finishLevel"] = archetype === "palace"
    ? "luxury"
    : (["light", "balanced", "rich", "luxury"] as const).find((level) => FINISH_RANK[level] === Math.max(FINISH_RANK[brief.finishLevel], referenceFinish)) || brief.finishLevel;
  const ambience = references.find((item) => item.ambience)?.ambience || brief.ambience;
  const roomTargets = unique([...(brief.targetRooms || []), ...references.flatMap((item) => item.roomHints)]).slice(0, 10);
  const referenceSummary = references.slice(0, 6).map((item) => `${item.name} · ${item.kind}${item.styleHints[0] ? ` · ${item.styleHints[0]}` : ""}${item.materialHints.length ? ` · ${item.materialHints.slice(0, 2).join(", ")}` : ""}`);
  const referenceFurnitureStyle = references.find((item) => item.furnitureStyle)?.furnitureStyle;
  const referenceLighting = references.find((item) => item.lighting)?.lighting;
  const detectedStyleLabel = referenceStyle || styles[0] || profile.styleLabel;
  const monumentality = Math.max(0, Math.min(100, Math.round(profile.monumentality + (finishLevel === "luxury" ? 6 : finishLevel === "light" ? -8 : 0) + (references.some((item) => /palai|royal|majest|monumental/.test(normalize(`${item.styleHints.join(" ")} ${item.summary}`))) ? 8 : 0))));
  const wallHeight = Math.round((profile.wallHeight + (finishLevel === "luxury" ? 0.25 : finishLevel === "light" ? -0.15 : 0)) * 10) / 10;
  return {
    projectType,
    style: inferredStyle,
    finishLevel,
    palette: palette.length ? palette : profile.basePalette,
    materials: materials.length ? materials : profile.baseMaterials,
    ambience,
    goals: unique([...brief.priorities, ...referenceDrivenGoals(references)]).slice(0, 12),
    constraints: brief.constraints,
    roomTargets,
    referenceSummary,
    sketchfabStrategy: "strict",
    generatedAt: new Date().toISOString(),
    intentVersion: "8.1",
    origin: "heuristic",
    archetype,
    furnitureStyle: referenceFurnitureStyle || (archetype === "palace" ? profile.furnitureStyle : brief ? profile.furnitureStyle : undefined),
    lighting: referenceLighting || profile.lighting,
    structuralLanguage: profile.structuralLanguage,
    monumentality,
    wallHeight,
    assetVocabulary: effectiveAssetVocabulary({ archetype, assetVocabulary: undefined }),
    detectedStyleLabel
  };
}

export function designIntentSummary(intent: DesignIntentSummary): string {
  return `${intent.detectedStyleLabel || intent.style} · ${intent.projectType} · finition ${intent.finishLevel} · ${intent.materials.slice(0, 4).join(", ")}`;
}
