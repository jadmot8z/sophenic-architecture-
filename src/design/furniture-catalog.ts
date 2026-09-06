import type { DesignObject } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — Catalogue mobilier partagé.
 * Dimensions ergonomiques réelles (m) + rôle de layout pour le
 * Furniture Layout Agent (assise dorsale, point focal, décor, circulation).
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type FurnitureRole = "backrest" | "focal" | "centerpiece" | "decor" | "pendant" | "plant" | "storage" | "work" | "sanitary" | "structural";

export type FurnitureSpec = {
  name: string;
  category: DesignObject["category"];
  width: number;
  depth: number;
  height: number;
  role: FurnitureRole;
  /** Le meuble doit-il faire face à un point focal (TV/chemée/salon) ? */
  facesFocal?: boolean;
};

/** Dimensions par défaut dérivées du nom (ergonomie domestique réelle). */
export function furnitureDimensions(name: string, category?: DesignObject["category"]): { width: number; depth: number; height: number } {
  const value = norm(name);
  if (/canape d.angle|canapé d'angle|sectional|l-shape|l shape/.test(value)) return { width: 2.65, depth: 1.85, height: .84 };
  if (/canap|sofa|sectional/.test(value)) return { width: 2.2, depth: .95, height: .86 };
  if (/fauteuil|armchair|lounge chair|bergere|bergère/.test(value)) return { width: .86, depth: .9, height: .92 };
  if (/chaise|chair|tabouret|stool/.test(value)) return { width: .54, depth: .56, height: .9 };
  if (/table basse|coffee table|table de salon/.test(value)) return { width: 1.15, depth: .65, height: .42 };
  if (/table a manger|table à manger|dining table|table repas/.test(value)) return { width: 1.9, depth: .95, height: .76 };
  if (/bureau|desk|table de travail/.test(value)) return { width: 1.45, depth: .7, height: .75 };
  if (/lit king|king bed/.test(value)) return { width: 1.95, depth: 2.15, height: .65 };
  if (/lit|bed/.test(value)) return { width: 1.65, depth: 2.05, height: .62 };
  if (/chevet|nightstand/.test(value)) return { width: .5, depth: .42, height: .55 };
  if (/lustre|chandelier/.test(value)) return { width: .95, depth: .95, height: 1.05 };
  if (/suspension|pendant/.test(value)) return { width: .7, depth: .7, height: .55 };
  if (/lampadaire|floor lamp/.test(value)) return { width: .45, depth: .45, height: 1.62 };
  if (/lampe|lamp|luminaire/.test(value) || category === "lighting") return { width: .42, depth: .42, height: 1.35 };
  if (/meuble tv|tv stand|console tv/.test(value)) return { width: 1.9, depth: .42, height: .5 };
  if (/console|buffet|sideboard/.test(value)) return { width: 1.35, depth: .4, height: .8 };
  if (/penderie|wardrobe|armoire/.test(value)) return { width: 1.8, depth: .62, height: 2.15 };
  if (/bibliotheque|bibliothèque|bookshelf|etagere|étagère|shelf/.test(value)) return { width: 1.1, depth: .34, height: 1.85 };
  if (/tapis|rug/.test(value)) return { width: 2.4, depth: 1.7, height: .025 };
  if (/plante|plant|ficus|palmier|olivier/.test(value) || category === "plant") return { width: .62, depth: .62, height: 1.45 };
  if (/ilot|îlot|island/.test(value) || category === "kitchen") return { width: 2.1, depth: .95, height: .92 };
  if (/meuble vasque|vanity|vasque/.test(value)) return { width: 1.15, depth: .52, height: .85 };
  if (/douche|shower/.test(value)) return { width: .95, depth: .95, height: 2.05 };
  if (/bain|bathtub/.test(value)) return { width: 1.75, depth: .8, height: .58 };
  if (/\bwc\b|toilettes?.met|toilet/.test(value)) return { width: .42, depth: .66, height: .8 };
  if (/banquette|bench/.test(value)) return { width: 1.3, depth: .42, height: .48 };
  if (/colonne|column/.test(value)) return { width: .44, depth: .44, height: 2.6 };
  return { width: 1.0, depth: .7, height: .8 };
}

/** Rôle de layout déduit du nom (placement agent) : dorsale au mur, focal, central, décor… */
export function furnitureRole(name: string, category?: DesignObject["category"]): FurnitureRole {
  const value = norm(`${category || ""} ${name}`);
  if (/colonne|column/.test(value)) return "structural";
  if (/lustre|chandelier|suspension|pendant/.test(value)) return "pendant";
  if (/plante|plant|ficus|palmier/.test(value)) return "plant";
  if (/tapis|rug/.test(value)) return "decor";
  if (/canap|sofa|fauteuil|armchair|lit|bed|chaise longue/.test(value)) return "backrest";
  if (/meuble tv|tv stand/.test(value)) return "focal";
  if (/table basse|coffee table/.test(value)) return "centerpiece";
  if (/table a manger|table à manger|dining|ilot|îlot/.test(value)) return "centerpiece";
  if (/bureau|desk/.test(value)) return "work";
  if (/penderie|armoire|bibliotheque|bibliothèque|console|buffet|sideboard|meuble tv/.test(value)) return "storage";
  if (/vasque|douche|bain|wc|toilet/.test(value)) return "sanitary";
  return "decor";
}

/** Construit une spec de mobilier prête pour le Layout Agent. */
export function furnitureSpec(name: string, category?: DesignObject["category"], overrides?: Partial<{ width: number; depth: number; height: number }>): FurnitureSpec {
  const dims = furnitureDimensions(name, category);
  const role = furnitureRole(name, category);
  return {
    name: name.trim().slice(0, 90) || "Meuble",
    category: category || (/lustre|suspension|lampe|luminaire/.test(norm(name)) ? "lighting" : /plante/.test(norm(name)) ? "plant" : "furniture"),
    width: Math.max(.25, overrides?.width ?? dims.width),
    depth: Math.max(.25, overrides?.depth ?? dims.depth),
    height: Math.max(.05, overrides?.height ?? dims.height),
    role,
    facesFocal: role === "backrest" || role === "focal"
  };
}
