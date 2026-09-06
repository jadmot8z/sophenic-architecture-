import type { DesignIntentArchetype, DesignIntentSummary } from "./types";

/**
 * SOPHENIC DESIGN V8.1 — Archétypes d'intent.
 *
 * V7/V8 utilisaient deux layouts codés en dur dans `fastDesignCommand`
 * (palais 3 niveaux / villa 2 niveaux) : plusieurs prompts produisaient
 * presque la même maison. V8.1 remplace ces templates par des **profils
 * paramétriques** consommés par le Program Synthesis Engine
 * (`architect-program.ts`) et par le pipeline d'assets
 * (`asset-requirements.ts`). Tout est modulé par le Design Intent
 * (monumentalité, finition, matériaux détectés, références visuelles),
 * donc deux intents différents produisent deux architectures
 * structurellement différentes — sans nouveau cerveau IA.
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
  levels: Array<{ name: string; rooms: Array<{ name: string; usage: string; width: number; depth: number }> }>;
  /** Pièces de circulation qui reçoivent une colonnade monumentale. */
  colonnadeRooms: string[];
  /** Écart minimal entre les colonnes et les murs (m). */
  colonnadeOffset: number;
  openings: Array<{ room: string; kind: "door" | "window"; side: "north" | "south" | "east" | "west"; width: number; height: number; sill: number }>;
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
    levels: [
      { name: "Rez-de-jardin", rooms: [
        { name: "Hall d’honneur", usage: "hall", width: 7.4, depth: 4.8 },
        { name: "Grand Salon", usage: "living", width: 8.4, depth: 6.6 },
        { name: "Salon de réception", usage: "living", width: 6.2, depth: 5.2 },
        { name: "Salle à manger d’apparat", usage: "dining", width: 6.6, depth: 5.4 },
        { name: "Cuisine", usage: "kitchen", width: 4.2, depth: 3.8 },
        { name: "Galerie", usage: "gallery", width: 6.2, depth: 3.2 },
        { name: "Salle d’eau", usage: "bathroom", width: 2.4, depth: 2.2 }
      ] },
      { name: "Étage noble", rooms: [
        { name: "Suite royale", usage: "bedroom", width: 6.4, depth: 5.6 },
        { name: "Chambre 2", usage: "bedroom", width: 4.4, depth: 4.0 },
        { name: "Chambre 3", usage: "bedroom", width: 4.4, depth: 4.0 },
        { name: "Salon privé", usage: "living", width: 5.2, depth: 4.4 },
        { name: "Bureau royal", usage: "office", width: 4.2, depth: 3.6 },
        { name: "Salle de bain", usage: "bathroom", width: 3.2, depth: 2.6 },
        { name: "Salle d’eau", usage: "bathroom", width: 2.2, depth: 2.0 }
      ] },
      { name: "Étage invités", rooms: [
        { name: "Suite invités", usage: "bedroom", width: 5.6, depth: 4.8 },
        { name: "Chambre d’apparat", usage: "bedroom", width: 4.6, depth: 4.2 },
        { name: "Bibliothèque", usage: "office", width: 4.4, depth: 3.8 },
        { name: "Galerie supérieure", usage: "gallery", width: 5.8, depth: 2.8 },
        { name: "Salle de bain", usage: "bathroom", width: 2.8, depth: 2.4 }
      ] }
    ],
    colonnadeRooms: ["Hall d’honneur", "Galerie"],
    colonnadeOffset: 0.62,
    openings: [
      { room: "Grand Salon", kind: "window", side: "south", width: 3.4, height: 3.1, sill: 0.8 },
      { room: "Hall d’honneur", kind: "window", side: "south", width: 2.8, height: 2.7, sill: 0.9 },
      { room: "Salle à manger d’apparat", kind: "window", side: "south", width: 3.0, height: 2.7, sill: 0.9 },
      { room: "Salon de réception", kind: "window", side: "east", width: 2.6, height: 2.5, sill: 0.95 }
    ],
    assetVocabulary: PALACE_VOCABULARY,
    traits: ["volumes monumentaux", "trois niveaux", "colonnades", "marbre", "dorures", "mobilier classique royal"]
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
    levels: [
      { name: "Rez-de-chaussée", rooms: [
        { name: "Salon", usage: "living", width: 6.4, depth: 5.0 },
        { name: "Cuisine ouverte", usage: "kitchen", width: 4.4, depth: 4.0 },
        { name: "Salle à manger", usage: "dining", width: 4.6, depth: 4.0 },
        { name: "Hall", usage: "hall", width: 3.0, depth: 2.8 },
        { name: "Salle d’eau", usage: "bathroom", width: 2.4, depth: 2.2 }
      ] },
      { name: "Étage 1", rooms: [
        { name: "Suite parentale", usage: "bedroom", width: 5.2, depth: 4.4 },
        { name: "Chambre 2", usage: "bedroom", width: 3.8, depth: 3.5 },
        { name: "Chambre 3", usage: "bedroom", width: 3.8, depth: 3.5 },
        { name: "Salle de bain", usage: "bathroom", width: 3.0, depth: 2.5 },
        { name: "Bureau", usage: "office", width: 3.4, depth: 3.0 }
      ] }
    ],
    colonnadeRooms: [],
    colonnadeOffset: 0.5,
    openings: [
      { room: "Salon", kind: "window", side: "south", width: 3.6, height: 2.25, sill: 0.16 },
      { room: "Salle à manger", kind: "window", side: "south", width: 2.6, height: 1.7, sill: 0.62 },
      { room: "Suite parentale", kind: "window", side: "south", width: 2.4, height: 1.65, sill: 0.68 }
    ],
    assetVocabulary: VILLA_VOCABULARY,
    traits: ["architecture contemporaine", "grandes baies vitrées", "bois/pierre/verre", "mobilier minimaliste premium", "plan ouvert"]
  },
  house: {
    archetype: "house",
    styleLabel: "maison contemporaine chaleureuse",
    furnitureStyle: "contemporain chaleureux",
    lighting: "éclairage chaleureux indirect, fenêtres généreuses",
    structuralLanguage: "volumes compacts à un niveau, ouvertures généreuses, bois et enduit clair",
    basePalette: ["#F3EEE6", "#D3C4B0", "#9A7A5D", "#5F4C3A", "#2A2C29"],
    baseMaterials: ["Chêne naturel", "Pierre calcaire", "Enduit minéral ivoire", "Métal noir satiné"],
    floorMaterial: "Chêne naturel",
    wallColor: "#F3EEE6",
    monumentality: 26,
    wallHeight: 2.7,
    levels: [
      { name: "Rez-de-chaussée", rooms: [
        { name: "Salon", usage: "living", width: 5.4, depth: 4.4 },
        { name: "Cuisine", usage: "kitchen", width: 3.8, depth: 3.6 },
        { name: "Chambre 1", usage: "bedroom", width: 3.6, depth: 3.4 },
        { name: "Salle de bain", usage: "bathroom", width: 2.4, depth: 2.2 }
      ] }
    ],
    colonnadeRooms: [],
    colonnadeOffset: 0.5,
    openings: [
      { room: "Salon", kind: "window", side: "south", width: 2.6, height: 1.55, sill: 0.62 }
    ],
    assetVocabulary: HOUSE_VOCABULARY,
    traits: ["maison compacte", "un niveau", "bois clair", "mobilier contemporain"]
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
