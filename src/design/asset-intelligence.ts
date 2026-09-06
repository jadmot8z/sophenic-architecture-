import { effectiveAssetVocabulary, profileForArchetype } from "./intent-profiles";
import { vocabularyKeyForName } from "./asset-requirements";
import type { DesignAssetGap, DesignIntentSummary, DesignProject } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — ASSET INTELLIGENCE ENGINE.
 *
 * INTERDIT de chercher le nom exact (« table basse sculpturale »).
 * L'agent analyse l'INTENTION du meuble (luxury, organic shape, stone/wood,
 * centerpiece…) et synthétise plusieurs requêtes anglaises ciblées, puis
 * laisse le ranking juger style + matériau + qualité + PBR + licence +
 * disponibilité. Si Sketchfab ne trouve rien : message explicite, manque
 * enregistré, alternative proposée — jamais de fallback silencieux.
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const BASE_BY_KEY: Record<string, string> = {
  sofa: "sofa", armchair: "armchair", coffeeTable: "coffee table", diningTable: "dining table", chair: "chair",
  bed: "bed", nightstand: "nightstand", wardrobe: "wardrobe", desk: "desk", lamp: "table lamp",
  pendant: "pendant light", floorLamp: "floor lamp", plant: "indoor plant", console: "console table",
  rug: "rug", island: "kitchen island", vanity: "vanity"
};

export type AssetQueryPlan = { queries: string[]; intention: string[]; base: string };

/** Analyse l'intention d'un meuble (tokens) → modificateurs de recherche. */
function intentionModifiers(objectName: string, intent: Pick<DesignIntentSummary, "archetype" | "style" | "furnitureStyle" | "structuralLanguage"> | null): string[] {
  const value = norm(objectName);
  const modifiers: string[] = [];
  if (/sculptural|organic|fluid|courbe|arrondi/.test(value)) modifiers.push("organic", "sculptural");
  if (/marbre|marble|pierre|stone|travertin/.test(value)) modifiers.push("marble", "stone");
  if (/bois|wood|noyer|walnut|chene|chêne|oak/.test(value)) modifiers.push("wood", "walnut");
  if (/velours|velvet|boucle|bouclé|linen|lin|tissu|fabric/.test(value)) modifiers.push("velvet", "fabric");
  if (/verre|glass/.test(value)) modifiers.push("glass");
  if (/laiton|brass|or|gold|dore|doré|metal/.test(value)) modifiers.push("brass", "metal");
  if (/minimal|epure|épuré|sobre/.test(value)) modifiers.push("minimalist");
  if (/luxe|luxury|premium|haut de gamme|royal|palai|palace/.test(value)) modifiers.push("luxury", "designer");
  const archetype = intent?.archetype;
  if (archetype === "palace") modifiers.push("classic", "royal");
  else if (archetype === "villa") modifiers.push("modern", "minimalist");
  else if (archetype) modifiers.push("modern");
  const styleText = norm(`${intent?.style || ""} ${intent?.furnitureStyle || ""}`);
  if (/japandi|scandinav|nordique/.test(styleText)) modifiers.push("japandi", "scandinavian");
  else if (/industriel/.test(styleText)) modifiers.push("industrial");
  else if (/mediterran/.test(styleText)) modifiers.push("mediterranean");
  return [...new Set(modifiers)].slice(0, 8);
}

/**
 * Expande les requêtes Sketchfab pour un meuble : JAMAIS le nom exact.
 * Ex. « table basse sculpturale » (intent luxe) →
 * ["luxury coffee table", "organic coffee table", "designer coffee table",
 *  "marble coffee table"].
 */
export function expandAssetQueries(objectName: string, project: DesignProject): AssetQueryPlan {
  const intent = project.architecture?.designIntent || null;
  const key = vocabularyKeyForName(objectName);
  const base = (key ? BASE_BY_KEY[key] : "") || baseFromName(objectName);
  const modifiers = intentionModifiers(objectName, intent);
  const intention = modifiers.length ? modifiers : ["modern"];
  const queries: string[] = [];
  const push = (modifier: string) => {
    const query = `${modifier} ${base}`.trim();
    if (!queries.includes(query)) queries.push(query);
  };
  // Priorité : intention du meuble → style de l'intent → qualité générique.
  for (const modifier of intention.slice(0, 4)) push(modifier);
  if (intent && key) {
    const vocabulary = effectiveAssetVocabulary({ archetype: intent.archetype, assetVocabulary: intent.assetVocabulary });
    // Une requête du vocabulaire n'est gardée que si elle reste ancrée sur le
    // type de meuble visé (ex. « coffee table ») — sinon elle dérive du sujet.
    for (const candidate of vocabulary[key] || []) {
      if (queries.length >= 5) break;
      if (!queries.includes(candidate) && norm(candidate).includes(norm(base))) queries.push(candidate);
    }
  }
  if (queries.length < 3) { push("designer"); push("photorealistic"); }
  return { queries: queries.slice(0, 5), intention, base };
}

function baseFromName(objectName: string): string {
  const value = norm(objectName);
  const map: Array<[RegExp, string]> = [
    [/canape d.angle|sectional|l.shape/, "sectional sofa"], [/canap|sofa/, "sofa"], [/fauteuil|armchair/, "armchair"],
    [/table basse|coffee/, "coffee table"], [/table a manger|dining/, "dining table"], [/chaise|chair/, "chair"],
    [/lit|bed/, "bed"], [/chevet|nightstand/, "nightstand"], [/penderie|wardrobe/, "wardrobe"],
    [/bureau|desk/, "desk"], [/lustre|chandelier/, "chandelier"], [/suspension|pendant/, "pendant light"],
    [/lampadaire|floor lamp/, "floor lamp"], [/lampe|lamp/, "table lamp"], [/tapis|rug/, "rug"],
    [/plante|plant/, "indoor plant"], [/console|buffet/, "console table"], [/meuble tv|tv/, "tv stand"],
    [/ilot|îlot|island/, "kitchen island"], [/vasque|vanity/, "vanity"], [/colonne|column/, "column"]
  ];
  for (const [pattern, base] of map) if (pattern.test(value)) return base;
  return "furniture";
}

export const ASSET_GAP_MESSAGE = "Je n'ai pas trouvé un asset Sketchfab compatible. Je génère un placeholder premium temporaire.";

/** Enregistre un manque d'asset (jamais silencieux) + propose une alternative. */
export function recordAssetGap(project: DesignProject, objectName: string, plan: AssetQueryPlan): DesignAssetGap {
  const gap: DesignAssetGap = {
    id: `gap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    item: objectName,
    queries: plan.queries,
    proposal: plan.queries.length > 1 ? `Alternative à essayer : « ${plan.queries.slice(1, 3).join(" » ou « ")} »` : `Élargis la recherche autour de « ${plan.base} »`,
    message: `${objectName} : ${ASSET_GAP_MESSAGE}`,
    createdAt: new Date().toISOString()
  };
  if (!project.architecture) project.architecture = { cameraMode: "exterior", roomOrder: [] };
  project.architecture.assetGaps = [...(project.architecture.assetGaps || []), gap].slice(-40);
  return gap;
}

/** Normalise un score de ranking en qualité 0-100 lisible. */
export function qualityScore(rawScore: number): number {
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/** Raison lisible de la sélection d'un asset (traçabilité UI). */
export function reasonSelected(objectName: string, plan: AssetQueryPlan, topReasons: string[], chosenQuery: string): string {
  const reasons = topReasons.length ? topReasons.slice(0, 3).join(" · ") : "meilleur score global";
  return `${objectName} → « ${chosenQuery} » (intention : ${plan.intention.slice(0, 3).join(", ")}) · ${reasons}`;
}
