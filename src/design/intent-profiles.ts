import type { DesignIntentArchetype, DesignIntentSummary } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — Paramètres de style par archétype.
 *
 * RÈGLE V8.2 : AUCUN programme de pièces fixe (« if palace: create X » interdit).
 * Ces profils ne contiennent que des PARAMÈTRES (matériaux, vocabulaire,
 * monumentalité, hauteurs, règles d'ouvertures). Les niveaux, pièces,
 * dimensions et compositions sont SYNTHÉTISÉS par le Program Synthesis
 * Engine (architect-program.ts) à partir de l'intent + du prompt + du
 * blueprint image + d'une graine de variation.
 */

export type IntentArchetypeProfile = {
  archetype: DesignIntentArchetype;
  styleLabel: string;
  furnitureStyle: string;
  lighting: string;
  structuralLanguage: string;
  basePalette: string[];
  baseMaterials: string[];
  floorMaterial: string;
  wallColor: string;
  /** 0-100 : hauteurs, volumes, symétrie, théâtralité. */
  monumentality: number;
  /** Hauteur libre de mur (m) avant modulation par l'intent. */
  wallHeight: number;
  /** Vocabulaire de requêtes Sketchfab par type de mobilier. */
  assetVocabulary: Record<string, string[]>;
  traits: string[];
};

const PALACE_VOCABULARY: Record<string, string[]> = {
  sofa: ["royal sofa velvet classic", "classic carved sofa gilded"],
  armchair: ["classic royal armchair", "louis xvi armchair"],
  coffeeTable: ["marble royal table classic", "classic marble coffee table"],
  diningTable: ["marble dining table classic royal"],
  chair: ["classic chair royal", "classic dining chair carved"],
  bed: ["royal canopy bed classic"],
  nightstand: ["classic nightstand marble brass"],
  wardrobe: ["classic wardrobe carved wood royal"],
  desk: ["classic royal desk wood marquetry"],
  lamp: ["classic brass table lamp"],
  pendant: ["crystal chandelier", "royal chandelier gold classic"],
  floorLamp: ["classic floor lamp brass"],
  plant: ["classical indoor palm tree"],
  console: ["marble console table classic"],
  rug: ["classic persian rug ornate"],
  island: ["classic marble kitchen island"],
  vanity: ["classic marble vanity brass"]
};

const VILLA_VOCABULARY: Record<string, string[]> = {
  sofa: ["modern sofa minimalist", "designer contemporary sofa"],
  armchair: ["designer lounge chair modern"],
  coffeeTable: ["glass coffee table modern", "modern stone coffee table"],
  diningTable: ["modern dining table wood minimalist"],
  chair: ["designer chair modern"],
  bed: ["modern upholstered bed minimalist"],
  nightstand: ["modern nightstand wood"],
  wardrobe: ["modern minimalist wardrobe"],
  desk: ["modern minimalist desk"],
  lamp: ["minimalist lamp modern"],
  pendant: ["minimalist pendant lamp designer", "modern pendant light"],
  floorLamp: ["minimalist arc floor lamp"],
  plant: ["modern indoor plant pot"],
  console: ["modern slim console table"],
  rug: ["modern wool rug minimalist"],
  island: ["modern kitchen island"],
  vanity: ["modern stone vanity"]
};

const HOUSE_VOCABULARY: Record<string, string[]> = {
  sofa: ["modern sofa comfortable"],
  armchair: ["modern armchair fabric"],
  coffeeTable: ["wood coffee table modern"],
  diningTable: ["modern dining table"],
  chair: ["modern chair"],
  bed: ["upholstered bed modern"],
  nightstand: ["wood nightstand modern"],
  wardrobe: ["modern wardrobe"],
  desk: ["modern desk wood"],
  lamp: ["table lamp modern warm"],
  pendant: ["modern pendant light"],
  floorLamp: ["modern floor lamp"],
  plant: ["indoor plant"],
  console: ["console table modern"],
  rug: ["area rug modern"],
  island: ["kitchen island modern"],
  vanity: ["bathroom vanity modern"]
};

export const ARCHETYPE_PROFILES: Record<"palace" | "villa" | "house", IntentArchetypeProfile> = {
  palace: {
    archetype: "palace",
    styleLabel: "palatial majestueux monumental",
    furnitureStyle: "classique royal très haut de gamme",
    lighting: "lustres en cristal, lumière chaude dorée et indirecte",
    structuralLanguage: "colonnades monumentales, symétrie, marbre et dorures, très grandes hauteurs sous plafond",
    basePalette: ["#F5F0E8", "#DCC7A1", "#B08A52", "#73523C", "#272925"],
    baseMaterials: ["Marbre Calacatta clair", "Laiton brossé", "Noyer fumé", "Velours ivoire", "Bronze patiné", "Verre extra-clair"],
    floorMaterial: "Marbre Calacatta clair",
    wallColor: "#F5F0E8",
    monumentality: 92,
    wallHeight: 4.6,
    assetVocabulary: PALACE_VOCABULARY,
    traits: ["volumes monumentaux", "colonnades", "marbre", "dorures", "mobilier classique royal"]
  },
  villa: {
    archetype: "villa",
    styleLabel: "villa contemporaine premium",
    furnitureStyle: "minimaliste premium contemporain",
    lighting: "lumière naturelle généreuse, éclairage linéaire chaud indirect",
    structuralLanguage: "grandes baies vitrées, plan ouvert fluide, bois/pierre/verre, volumes horizontaux",
    basePalette: ["#F3EEE6", "#D7C8B4", "#B69C7C", "#5F4C3A", "#2A2C29"],
    baseMaterials: ["Chêne naturel", "Travertin ivoire", "Verre extra-clair", "Métal noir satiné", "Bouclé sable"],
    floorMaterial: "Chêne naturel",
    wallColor: "#F3EEE6",
    monumentality: 40,
    wallHeight: 2.95,
    assetVocabulary: VILLA_VOCABULARY,
    traits: ["grandes baies vitrées", "bois/pierre/verre", "mobilier minimaliste premium", "plan ouvert"]
  },
  house: {
    archetype: "house",
    styleLabel: "maison contemporaine chaleureuse",
    furnitureStyle: "contemporain chaleureux",
    lighting: "éclairage chaleureux indirect, fenêtres généreuses",
    structuralLanguage: "volumes compacts, ouvertures généreuses, bois et enduit clair",
    basePalette: ["#F3EEE6", "#D3C4B0", "#9A7A5D", "#5F4C3A", "#2A2C29"],
    baseMaterials: ["Chêne naturel", "Pierre calcaire", "Enduit minéral ivoire", "Métal noir satiné"],
    floorMaterial: "Chêne naturel",
    wallColor: "#F3EEE6",
    monumentality: 26,
    wallHeight: 2.7,
    assetVocabulary: HOUSE_VOCABULARY,
    traits: ["maison compacte", "bois clair", "mobilier contemporain"]
  }
};

export function profileForArchetype(archetype: DesignIntentArchetype | undefined): IntentArchetypeProfile {
  if (archetype === "palace") return ARCHETYPE_PROFILES.palace;
  if (archetype === "villa") return ARCHETYPE_PROFILES.villa;
  return ARCHETYPE_PROFILES.house;
}

/** Vocabulaire d'assets effectif : celui de l'intent s'il existe, sinon celui du profil. */
export function effectiveAssetVocabulary(intent: Pick<DesignIntentSummary, "archetype" | "assetVocabulary">): Record<string, string[]> {
  return intent.assetVocabulary && Object.keys(intent.assetVocabulary).length ? intent.assetVocabulary : profileForArchetype(intent.archetype).assetVocabulary;
}

/* ============ RÈGLES DE NOMMAGE (génératives, pas de listes fixes) ============ */

/** Nom d'affichage d'une pièce selon usage, surface et archétype. */
export function roomDisplayName(usage: string, areaM2: number, archetype: DesignIntentArchetype, variant: number): string {
  const value = usage.toLowerCase();
  const suffix = variant > 1 ? ` ${variant}` : "";
  if (/living|salon/.test(value)) {
    if (archetype === "palace") return areaM2 >= 38 ? "Grand Salon" : variant > 1 ? `Salon de réception${suffix}` : "Salon de réception";
    return `Salon${suffix}`;
  }
  if (/hall/.test(value)) return archetype === "palace" && areaM2 >= 16 ? "Hall d’honneur" : "Hall";
  if (/dining/.test(value)) return archetype === "palace" ? "Salle à manger d’apparat" : `Salle à manger${suffix}`;
  if (/kitchen/.test(value)) return "Cuisine";
  if (/bedroom|chambre/.test(value)) {
    if (variant === 1 && archetype !== "house") return archetype === "palace" ? "Suite royale" : "Suite parentale";
    if (archetype === "palace" && variant === 2) return "Chambre d’apparat";
    return `Chambre ${variant}`;
  }
  if (/bath/.test(value)) return areaM2 < 4.6 ? "Salle d’eau" : `Salle de bain${suffix}`;
  if (/office|bureau/.test(value)) return archetype === "palace" ? "Bureau royal" : "Bureau";
  if (/gallery|galerie/.test(value)) return "Galerie";
  if (/garage/.test(value)) return "Garage";
  if (/terrace|terrasse/.test(value)) return "Terrasse";
  return `Espace${suffix}`;
}
