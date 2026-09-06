import { effectiveAssetVocabulary, profileForArchetype } from "./intent-profiles";
import type { DesignIntentSummary, DesignObject, DesignProject } from "./types";

/**
 * SOPHENIC DESIGN V8.1 — Asset Requirements.
 *
 * Pont obligatoire Design Intent → Sketchfab : le style détecté décide des
 * requêtes de recherche. Un palais cherchera « royal sofa », « crystal
 * chandelier », « marble table », « classic chair » ; une villa moderne
 * cherchera « modern sofa », « designer chair », « glass table »,
 * « minimalist lamp ». Aucun asset n'est jamais inventé : si la recherche ne
 * renvoie rien de compatible, `selectBestDesignAssetForIntent` retourne null
 * et l'UI signale l'absence (fallback procédural premium).
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type DesignAssetRequirement = {
  key: string;
  /** Requête Sketchfab effective (anglais, style + catégorie). */
  query: string;
  /** Jetons de style attendus dans le nom/tags des résultats (ranking IA). */
  styleTokens: string[];
  category: DesignObject["category"];
  label: string;
};

const CATEGORY_BY_KEY: Record<string, DesignObject["category"]> = {
  sofa: "furniture", armchair: "furniture", coffeeTable: "furniture", diningTable: "furniture", chair: "furniture",
  bed: "furniture", nightstand: "furniture", wardrobe: "furniture", desk: "furniture", lamp: "lighting",
  pendant: "lighting", floorLamp: "lighting", plant: "plant", console: "furniture", rug: "furniture",
  island: "kitchen", vanity: "sanitary"
};

const LABEL_BY_KEY: Record<string, string> = {
  sofa: "Canapé", armchair: "Fauteuil", coffeeTable: "Table basse", diningTable: "Table à manger", chair: "Chaise",
  bed: "Lit", nightstand: "Chevet", wardrobe: "Rangement", desk: "Bureau", lamp: "Lampe",
  pendant: "Suspension / lustre", floorLamp: "Lampadaire", plant: "Plante", console: "Console", rug: "Tapis",
  island: "Îlot cuisine", vanity: "Vasque"
};

/** Clé de vocabulaire correspondant à un nom d'objet (français ou anglais). */
const KEY_BY_NAME: Array<[RegExp, string]> = [
  [/canap|sofa/, "sofa"],
  [/fauteuil|armchair|lounge chair/, "armchair"],
  [/table basse|coffee table/, "coffeeTable"],
  [/table repas|table a manger|table à manger|dining table|^table$/, "diningTable"],
  [/chaise|chair|tabouret|stool/, "chair"],
  [/lit|bed|tete de lit/, "bed"],
  [/chevet|nightstand/, "nightstand"],
  [/penderie|wardrobe|bibliotheque|bibliothèque|shelf|meuble tv/, "wardrobe"],
  [/bureau|desk/, "desk"],
  [/suspension|pendant|lustre|chandelier/, "pendant"],
  [/lampadaire|floor lamp/, "floorLamp"],
  [/lampe|lamp|luminaire/, "lamp"],
  [/plante|plant|ficus|palmier/, "plant"],
  [/console|buffet|sideboard/, "console"],
  [/tapis|rug/, "rug"],
  [/ilot|îlot|island/, "island"],
  [/meuble vasque|vanity|vasque/, "vanity"]
];

export function vocabularyKeyForName(name: string): string | null {
  const value = norm(name);
  for (const [pattern, key] of KEY_BY_NAME) if (pattern.test(value)) return key;
  return null;
}

/** Besoins d'assets prioritaires dérivés de l'intent (affichés dans la timeline). */
export function assetRequirementsForIntent(intent: Pick<DesignIntentSummary, "archetype" | "assetVocabulary" | "style"> | null): DesignAssetRequirement[] {
  if (!intent) return [];
  const vocabulary = effectiveAssetVocabulary(intent);
  const profile = profileForArchetype(intent.archetype === "interior" ? "house" : intent.archetype);
  const priorityKeys = profile.archetype === "palace"
    ? ["sofa", "pendant", "diningTable", "chair", "armchair", "bed", "console"]
    : profile.archetype === "villa"
      ? ["sofa", "chair", "coffeeTable", "pendant", "bed", "armchair", "diningTable"]
      : ["sofa", "coffeeTable", "bed", "chair", "lamp", "plant"];
  const requirements: DesignAssetRequirement[] = [];
  for (const key of priorityKeys) {
    const queries = vocabulary[key];
    if (!queries?.length) continue;
    const query = queries[0];
    const styleTokens = [...new Set(query.split(/\s+/).filter((token) => token.length > 3 && !/^(photo)?realistic$|^pbr$/i.test(token)))].slice(0, 4);
    requirements.push({ key, query, styleTokens, category: CATEGORY_BY_KEY[key] || "furniture", label: LABEL_BY_KEY[key] || key });
  }
  return requirements;
}

/** Requête Sketchfab pour un objet composé, alignée sur le style de l'intent. */
export function assetQueryForObject(object: Pick<DesignObject, "name" | "metadata">, project: DesignProject): string {
  const intent = project.architecture?.designIntent;
  const custom = typeof object.metadata?.assetQuery === "string" ? object.metadata.assetQuery.trim() : "";
  const vocabulary = intent ? effectiveAssetVocabulary(intent) : undefined;
  if (custom) {
    const key = vocabularyKeyForName(object.name);
    const styleToken = key && vocabulary?.[key]?.[0]?.split(/\s+/).slice(0, 2).join(" ");
    return styleToken ? `${custom} ${styleToken}`.trim() : custom;
  }
  const key = vocabularyKeyForName(object.name);
  if (key && vocabulary?.[key]?.length) return vocabulary[key][0];
  // Vocabulaire historique (projets sans intent V8.1).
  const normalized = norm(object.name);
  const english = /canap|sofa/.test(normalized) ? "modern sofa" : /table basse/.test(normalized) ? "modern coffee table" : /fauteuil/.test(normalized) ? "modern lounge chair" : /lit/.test(normalized) ? "upholstered bed modern" : /chaise/.test(normalized) ? "modern chair" : /lampe|luminaire|suspension/.test(normalized) ? "designer lamp" : /plante|ficus/.test(normalized) ? "indoor plant" : object.name;
  return `${english} ${project.preferences.style || "modern"}`.trim();
}

/** Message honnête quand aucun asset compatible n'a été trouvé (jamais d'asset inventé). */
export function noAssetMessage(requirement: DesignAssetRequirement | null, objectName: string): string {
  const target = requirement?.query || objectName;
  return `${objectName} : aucun modèle 3D Sketchfab compatible (licence téléchargeable + qualité + style « ${target} »). Fallback procédural premium conservé.`;
}
