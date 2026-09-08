import { composeRoomLayout } from "./furniture-layout-agent";
import { profileForArchetype } from "./intent-profiles";
import { canonicalMaterialText } from "./material-canon";
import type { DesignAiAction, DesignIntentSummary, DesignObject, DesignProject, DesignRoom, DesignRoomBlueprint } from "./types";
import { furnitureSpec } from "./furniture-catalog";

/**
 * SOPHENIC DESIGN V8.2 — SPACE REBUILD ENGINE.
 *
 * « Change mon salon selon cette image » ne doit PLUS produire des petites
 * modifications. Le moteur :
 *   1. SUPPRIME meubles, décoration et placement existants de la pièce
 *      (seuls escaliers et colonnades structurelles survivent) ;
 *   2. RECONSTRUIT un nouveau layout, de nouveaux meubles, de nouvelles
 *      positions, de nouveaux matériaux et une nouvelle ambiance — à partir
 *      du ROOM_BLUEPRINT (source de vérité) et du Design Intent (transfert
 *      de style demandé par le prompt) ;
 *   3. confie le placement au Furniture Layout Agent (jamais codé).
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type SpaceRebuildReport = {
  roomName: string;
  clearedCount: number;
  added: Array<{ name: string; reasons: string[] }>;
  skipped: Array<{ name: string; reason: string }>;
  warnings: string[];
  focalSide: string;
  styleApplied: string;
};

export type SpaceRebuildResult = { project: DesignProject; report: SpaceRebuildReport };

const BASE_BY_TOKEN: Array<[RegExp, string]> = [
  [/sectional|l.?shape|angle/, "Canapé d’angle"],
  [/sofa|canape|canapé/, "Canapé"],
  [/armchair|fauteuil|lounge/, "Fauteuil"],
  [/chair|chaise|dining chair/, "Chaise"],
  [/coffee table|table basse/, "Table basse"],
  [/dining table|table a manger|table à manger/, "Table à manger"],
  [/bed|lit/, "Lit"],
  [/nightstand|chevet/, "Chevet"],
  [/wardrobe|penderie|armoire/, "Penderie"],
  [/bookshelf|biblio|etagère|étagère/, "Bibliothèque"],
  [/desk|bureau/, "Bureau"],
  [/chandelier|lustre/, "Lustre"],
  [/pendant|suspension/, "Suspension"],
  [/floor lamp|lampadaire/, "Lampadaire"],
  [/table lamp|lampe/, "Lampe"],
  [/rug|tapis/, "Tapis"],
  [/plant|plante|ficus|palm/, "Plante"],
  [/console|sideboard|buffet/, "Console"],
  [/tv|television|tele/, "Meuble TV"],
  [/kitchen island|ilot|îlot/, "Îlot central"],
  [/vanity|vasque/, "Meuble vasque"]
];

function baseFrenchName(raw: string): string {
  const value = norm(raw);
  for (const [pattern, name] of BASE_BY_TOKEN) if (pattern.test(value)) return name;
  return raw.trim().slice(0, 60) || "Meuble";
}

/** Adjectif de style appliqué au mobilier (transfert de style du prompt). */
function styleAdjective(intent: DesignIntentSummary): string {
  const haystack = norm(`${intent.style} ${intent.furnitureStyle || ""} ${intent.detectedStyleLabel || ""} ${intent.archetype || ""}`);
  if (/japandi/.test(haystack)) return "japandi";
  if (/palai|palace|royal|classique|classic|majest/.test(haystack)) return "classique royal";
  if (/industriel|industrial/.test(haystack)) return "industriel";
  if (/mediterran|méditerran/.test(haystack)) return "méditerranéen";
  if (/minimal|epure|épuré/.test(haystack)) return "minimaliste";
  if (/luxe|luxury|premium|haut de gamme/.test(haystack)) return "premium";
  if (/moderne|modern|contemporain/.test(haystack)) return "contemporain";
  return "actuel";
}

/** Génère la nouvelle liste de mobilier : blueprint (source de vérité) + transfert de style. */
export function furnitureItemsFromBlueprint(blueprint: DesignRoomBlueprint, intent: DesignIntentSummary): string[] {
  const adjective = styleAdjective(intent);
  const items: string[] = [];
  for (const item of blueprint.furniture) {
    const base = baseFrenchName(item.name || item.type || "");
    const styled = `${base} ${adjective}`.trim();
    const count = Math.max(1, Math.min(4, item.count || 1));
    for (let index = 0; index < count; index += 1) items.push(count > 1 ? `${styled} ${index + 1}` : styled);
  }
  // Compléments typiques du niveau de finition (décoration, lumière, verdure).
  const isLiving = /living|salon|sejour|séjour/.test(norm(blueprint.room));
  const finish = intent.finishLevel;
  if (isLiving || !items.length) {
    if (!items.some((item) => /Meuble TV/.test(item))) items.push(`Meuble TV ${adjective}`);
    if (finish === "luxury" || finish === "rich") { items.push(`Tapis ${adjective}`); items.push(/royal|palai/.test(adjective) ? "Lustre cristal" : `Suspension ${adjective}`); items.push(`Plante ${adjective}`); if (finish === "luxury") items.push(`Plante ${adjective} 2`); }
    else if (finish === "balanced") { items.push(`Suspension ${adjective}`); }
    if (!items.some((item) => /Canap|Fauteuil/.test(item))) items.push(`Canapé ${adjective}`);
    if (!items.some((item) => /Table basse/.test(item))) items.push(`Table basse ${adjective}`);
  }
  return items.slice(0, 18);
}

/** SUPPRIME puis RECONSTRUIT la pièce. Retourne une NOUVELLE composition. */
export function rebuildRoomFromBlueprint(source: DesignProject, roomName: string, options: { blueprint?: DesignRoomBlueprint | null; intent?: DesignIntentSummary | null; seed?: number; styleOverride?: string } = {}): SpaceRebuildResult {
  const project = structuredClone(source);
  const room: DesignRoom | undefined = project.plan.rooms.find((candidate) => norm(candidate.name).includes(norm(roomName)) || norm(roomName).includes(norm(candidate.name)));
  if (!room) return { project, report: { roomName, clearedCount: 0, added: [], skipped: [{ name: roomName, reason: "pièce introuvable" }], warnings: [], focalSide: "-", styleApplied: "" } };
  const intent = options.intent || project.architecture?.designIntent || null;
  const blueprint = options.blueprint || project.architecture?.roomBlueprint || null;
  const profile = profileForArchetype(intent?.archetype === "interior" ? "house" : intent?.archetype);

  // 1) SUPPRESSION : meubles, décoration, placement (structure conservée).
  const before = project.plan.objects.filter((object) => object.roomId === room.id);
  const cleared = before.filter((object) => object.category !== "stairs" && object.metadata?.structural !== "column");
  project.plan.objects = project.plan.objects.filter((object) => object.roomId !== room.id || object.category === "stairs" || object.metadata?.structural === "column");

  // 2) RECONSTRUCTION : nouvelle liste de mobilier (blueprint + transfert de style).
  const items = blueprint
    ? furnitureItemsFromBlueprint(blueprint, intent || { finishLevel: "balanced", style: options.styleOverride || "", archetype: "interior" } as DesignIntentSummary)
    : defaultItemsForStyle(intent, profile.archetype as "palace" | "villa" | "house");
  const specs = items.map((name) => furnitureSpec(name));
  const layout = composeRoomLayout(project, room, specs, { seed: options.seed });
  const finishByRole = { pendant: "lighting" as const };
  for (const object of layout.objects) {
    const spec = specs.find((entry) => entry.name === object.name);
    if (spec?.role === "pendant") object.category = finishByRole.pendant;
    object.metadata = { ...object.metadata, finishLevel: intent?.finishLevel || "balanced", rebuiltBy: "space-rebuild-v8.2", blueprintId: blueprint?.id || "" };
    if (intent?.finishLevel === "luxury" || intent?.finishLevel === "rich") object.metadata.finishLevel = intent.finishLevel;
  }
  project.plan.objects.push(...layout.objects);

  // 3) Matériaux, sol, murs, plafond, ambiance : nouvelle identité.
  const materials = [...new Set([...(blueprint?.materials || []).map((name) => canonicalMaterialText(name) || name), ...(intent?.materials || [])])];
  const woodish = materials.find((name) => /ch[eê]ne|noyer|bois|parquet/i.test(name)) || (profile.archetype === "palace" ? "Noyer fumé" : "Chêne naturel");
  const stonish = materials.find((name) => /travertin|marbre|pierre|calcaire/i.test(name)) || (profile.archetype === "palace" ? "Marbre Calacatta clair" : "Travertin ivoire");
  const livingLike = /salon|living|sejour|séjour|salle a manger|salle à manger|dining/.test(norm(`${room.name} ${room.usage}`));
  const technical = /cuisine|kitchen|sdb|salle de bain|bathroom|sanitary|entree|entrée/.test(norm(`${room.name} ${room.usage}`));
  const monumental = profile.archetype === "palace" || (intent?.monumentality || 0) >= 70;
  // Palais : marbre dans les pièces de réception ; villa/maison : bois chaleureux.
  const floorName = technical ? stonish : livingLike ? (monumental ? stonish : woodish) : /chambre|bedroom|suite/.test(norm(`${room.name} ${room.usage}`)) ? woodish : stonish;
  let floorMaterial = project.materials.find((material) => norm(material.name) === norm(floorName)) || project.materials.find((material) => norm(material.name).includes(norm(floorName.slice(0, 5))));
  if (!floorMaterial) {
    // Le matériau cible peut ne pas exister dans le projet : on le crée.
    floorMaterial = { id: `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name: floorName, category: "floor", color: /marbre|travertin|pierre|calcaire/i.test(floorName) ? "#EDE7DC" : "#C9A97E", texture: /marbre|travertin|pierre|calcaire/i.test(floorName) ? "marble" : "wood", roughness: .55 };
    project.materials.push(floorMaterial);
  }
  room.floorMaterialId = floorMaterial.id;
  // La couleur des murs suit le STYLE demandé (transfert de style) ; la
  // palette de l'image prime quand l'utilisateur ne demande qu'une reconstruction fidèle.
  const palette = intent?.palette?.length ? intent.palette : blueprint?.palette?.length ? blueprint.palette : profile.basePalette;
  const hexColor = palette.find((value) => /^#[0-9a-f]{6}$/i.test(value));
  room.color = hexColor || palette[Math.min(1, palette.length - 1)] || room.color;
  const ceilingHint = blueprint?.architecture.ceilingHeight;
  if (ceilingHint && ceilingHint >= 2.4 && ceilingHint <= 5) room.ceilingHeight = Math.round(ceilingHint * 10) / 10;
  project.architecture = {
    ...(project.architecture || { cameraMode: "interior", roomOrder: project.plan.rooms.map((entry) => entry.id) }),
    finishLevel: intent?.finishLevel || project.architecture?.finishLevel || "balanced",
    ambience: intent?.ambience || project.architecture?.ambience || "soft",
    style: options.styleOverride || intent?.style || project.architecture?.style,
    activeRoomId: room.id,
    cameraMode: "interior",
    ...(blueprint ? { roomBlueprint: blueprint } : {}),
    ...(intent ? { designIntent: intent } : {})
  };
  project.preferences.style = options.styleOverride || intent?.style || project.preferences.style;
  project.updatedAt = new Date().toISOString();
  project.revision += 1;
  return {
    project,
    report: {
      roomName: room.name,
      clearedCount: cleared.length,
      added: layout.decisions.map((decision) => ({ name: decision.name, reasons: decision.reasons })),
      skipped: layout.skipped,
      warnings: layout.warnings,
      focalSide: layout.focalSide,
      styleApplied: options.styleOverride || intent?.style || profile.styleLabel
    }
  };
}

function defaultItemsForStyle(intent: DesignIntentSummary | null, archetype: "palace" | "villa" | "house"): string[] {
  const adjective = intent ? styleAdjective(intent) : archetype === "palace" ? "classique royal" : "contemporain";
  const base = [`Canapé ${adjective}`, `Table basse ${adjective}`, `Meuble TV ${adjective}`];
  const chairs = archetype === "palace" ? [`Fauteuil ${adjective} 1`, `Fauteuil ${adjective} 2`] : [`Fauteuil ${adjective}`];
  const extras = archetype === "palace"
    ? ["Lustre cristal", `Tapis ${adjective}`, `Console ${adjective}`, `Plante ${adjective}`]
    : intent?.finishLevel === "light"
      ? [`Suspension ${adjective}`]
      : [`Tapis ${adjective}`, `Suspension ${adjective}`, `Plante ${adjective}`];
  return [...base, ...chairs, ...extras];
}

/** Détecte la pièce visée par une instruction de transformation. */
export function targetRoomName(project: DesignProject, instruction: string): string | undefined {
  const text = norm(instruction);
  const named = project.plan.rooms.find((room) => text.includes(norm(room.name)) || norm(room.name).includes(text.slice(0, 12)));
  if (named) return named.name;
  if (/salon|sejour|séjour|living/.test(text)) return project.plan.rooms.find((room) => /living|salon/i.test(room.usage + room.name))?.name;
  if (/chambre|bedroom|suite/.test(text)) return project.plan.rooms.find((room) => /bedroom|chambre|suite/i.test(room.usage + room.name))?.name;
  if (/cuisine|kitchen/.test(text)) return project.plan.rooms.find((room) => /kitchen|cuisine/i.test(room.usage + room.name))?.name;
  if (/salle a manger|salle à manger|dining/.test(text)) return project.plan.rooms.find((room) => /dining/i.test(room.usage + room.name))?.name;
  const active = project.plan.rooms.find((room) => room.id === project.architecture?.activeRoomId);
  return active?.name || project.plan.rooms[0]?.name;
}

/** Plan d'actions Design pour une reconstruction de pièce. */
export function rebuildRoomPlan(project: DesignProject, instruction: string, blueprint?: DesignRoomBlueprint | null): { summary: string; actions: DesignAiAction[]; recommendations: string[] } | null {
  const room = targetRoomName(project, instruction);
  if (!room) return null;
  const actions: DesignAiAction[] = [{ type: "rebuild_room", room, ...(blueprint ? { blueprint } : {}) }];
  const existing = project.plan.objects.filter((object) => object.roomId === project.plan.rooms.find((entry) => entry.name === room)?.id).length;
  return {
    summary: `Reconstruction complète de « ${room} » : suppression des ${existing} élément(s) existants puis nouvelle composition (layout, mobilier, matériaux, ambiance) issue de l'image de référence et du Design Intent.`,
    actions,
    recommendations: [
      "Le Furniture Layout Agent décide positions, rotations et distances (canapé–table 0,42–0,68 m, passage ≥ 0,75 m, ouvertures dégagées).",
      "Aucun asset n'est inventé : tout manque Sketchfab est enregistré et un placeholder premium temporaire est annoncé."
    ]
  };
}
