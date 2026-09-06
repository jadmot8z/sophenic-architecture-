import { buildArchitectureLayout, buildVillaProgram, findPlacementInRoom, objectFitsRoom } from "./architecture";
import { effectiveAssetVocabulary, profileForArchetype, type IntentArchetypeProfile } from "./intent-profiles";
import type { DesignAiAction, DesignArchitectureProgramSpec, DesignIntentSummary, DesignObject, DesignProject, DesignRoom } from "./types";

/**
 * SOPHENIC DESIGN V8.1 — Program Synthesis Engine.
 *
 * Remplace la logique de templates fixes : aucun layout n'est codé en dur dans
 * les commandes. Le programme architectural (niveaux, pièces, hauteurs,
 * colonnades, ouvertures, matériaux, mobilier, vocabulaire d'assets) est DÉRIVÉ
 * du Design Intent (voir design-intent.ts / design-intent-ai.ts). Deux intents
 * différents (palais vs villa) produisent deux architectures structurellement
 * différentes.
 */

const uid = (prefix = "program") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const round = (value: number, step = 0.1) => Math.round(value / step) * step;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Parse les pièces demandées explicitement (« trois chambres », « deux salles de bain »…). */
export function parseRoomRequests(instruction: string): Array<{ name: string; usage: string }> {
  const text = norm(instruction);
  const word: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7 };
  const count = (singular: string, plural: string) => {
    const match = text.match(new RegExp(`(?:\\b(\\d+)\\b|\\b(un|une|deux|trois|quatre|cinq|six|sept)\\b)\\s+${plural}`));
    if (match) return Number(match[1] || word[match[2]] || 0);
    return new RegExp(`\\b${singular}\\b`).test(text) ? 1 : 0;
  };
  const rooms: Array<{ name: string; usage: string }> = [];
  if (/salon|sejour|séjour|living/.test(text)) rooms.push({ name: "Salon", usage: "living" });
  if (/cuisine/.test(text)) rooms.push({ name: "Cuisine", usage: "kitchen" });
  if (/salle a manger|salle à manger|dining/.test(text)) rooms.push({ name: "Salle à manger", usage: "dining" });
  const bedrooms = count("chambre", "chambres?");
  for (let index = 1; index <= bedrooms; index += 1) rooms.push({ name: bedrooms === 1 ? "Chambre" : `Chambre ${index}`, usage: "bedroom" });
  const bathrooms = Math.max(count("salle de bain", "salles? de bains?"), count("sdb", "sdb"));
  for (let index = 1; index <= bathrooms; index += 1) rooms.push({ name: bathrooms === 1 ? "Salle de bain" : `Salle de bain ${index}`, usage: "bathroom" });
  if (/bureau|office/.test(text)) rooms.push({ name: "Bureau", usage: "office" });
  if (/garage/.test(text)) rooms.push({ name: "Garage", usage: "garage" });
  if (/terrasse/.test(text)) rooms.push({ name: "Terrasse", usage: "terrace" });
  return rooms.slice(0, 20);
}

const FINISH_SCALE: Record<DesignIntentSummary["finishLevel"], number> = { light: 0.92, balanced: 1, rich: 1.06, luxury: 1.12 };

function scaleRooms(profile: IntentArchetypeProfile, intent: DesignIntentSummary, instruction: string): DesignArchitectureProgramSpec["levels"] {
  const scale = clamp(0.86 + ((intent.monumentality ?? profile.monumentality) / 100) * 0.4, 0.8, 1.5) * (FINISH_SCALE[intent.finishLevel] || 1);
  const requests = intent.requestedRooms?.length ? intent.requestedRooms : parseRoomRequests(instruction);
  const levels = profile.levels.map((level) => ({
    name: level.name,
    rooms: level.rooms.map((room) => ({ name: room.name, usage: room.usage, width: round(room.width * scale), depth: round(room.depth * scale) }))
  }));
  // L'utilisateur a listé des pièces (villa/maison) : on remplace le programme
  // par défaut du niveau 1 par sa liste, dimensionnée par le profil d'archetype.
  if (requests.length && profile.archetype !== "palace") {
    const base = profile.levels[0]?.rooms || [];
    const requested = requests.map((request) => {
      const reference = base.find((room) => norm(room.name).includes(norm(request.name.split(" ")[0])) || room.usage === request.usage);
      const size = reference || { width: 3.6, depth: 3.2 };
      return { name: request.name, usage: request.usage || "multi-purpose", width: round(size.width * (profile.archetype === "villa" ? 1.15 : 1)), depth: round(size.depth * (profile.archetype === "villa" ? 1.15 : 1)) };
    });
    levels[0] = { name: profile.levels[0]?.name || "Rez-de-chaussée", rooms: requested };
    // Les chambres demandées migrent à l'étage pour une villa multi-niveaux.
    if (profile.archetype === "villa" && levels.length > 1 && requested.some((room) => room.usage === "bedroom")) {
      const bedrooms = requested.filter((room) => room.usage === "bedroom");
      levels[0] = { name: levels[0].name, rooms: requested.filter((room) => room.usage !== "bedroom") };
      levels[1] = { name: levels[1].name, rooms: [...bedrooms, { name: "Salle de bain", usage: "bathroom", width: 3.0, depth: 2.5 }, ...(levels[1].rooms.some((room) => /bureau/.test(norm(room.name))) ? [{ name: "Bureau", usage: "office", width: 3.4, depth: 3.0 }] : [])] };
    }
  }
  return levels;
}

function synthesizeOpenings(profile: IntentArchetypeProfile, intent: DesignIntentSummary, levels: DesignArchitectureProgramSpec["levels"]): DesignArchitectureProgramSpec["openings"] {
  const monumentality = intent.monumentality ?? profile.monumentality;
  const factor = clamp(0.9 + monumentality / 100 * 0.35, 0.9, 1.35);
  return profile.openings
    .filter((opening) => levels.some((level) => level.rooms.some((room) => norm(room.name).includes(norm(opening.room.replace(/\s(d’apparat|d'honneur)$/i, ""))) || norm(opening.room).includes(norm(room.name)))))
    .map((opening) => ({ ...opening, width: round(opening.width * factor, 0.05), height: round(opening.height * factor, 0.05), sill: round(clamp(opening.sill - (monumentality > 70 ? 0.15 : 0), 0.1, 1.4), 0.05) }));
}

/** Construit le programme architectural complet depuis le Design Intent. */
export function synthesizeArchitectureProgram(project: DesignProject, intent: DesignIntentSummary, instruction: string): DesignArchitectureProgramSpec {
  const profile = profileForArchetype(intent.archetype === "interior" ? "house" : intent.archetype);
  const levels = scaleRooms(profile, intent, instruction);
  const wallHeight = round(clamp(intent.wallHeight || profile.wallHeight, 2.4, 8));
  const palette = intent.palette.length ? intent.palette : profile.basePalette;
  const materials = intent.materials.length ? intent.materials : profile.baseMaterials;
  const style = intent.style || profile.styleLabel;
  const colonnadeRooms = (intent.monumentality ?? profile.monumentality) >= 70 ? profile.colonnadeRooms.filter((room) => levels.some((level) => level.rooms.some((entry) => norm(entry.name).includes(norm(room.replace(/\s(d’honneur|supérieure)$/i, ""))) || norm(room).includes(norm(entry.name))))) : [];
  const stairs: DesignArchitectureProgramSpec["stairs"] = [];
  for (let index = 1; index < levels.length; index += 1) {
    const hall = levels[index - 1].rooms.find((room) => /hall|galerie|salon/i.test(`${room.usage} ${room.name}`)) || levels[index - 1].rooms.find((room) => room.usage === "living") || levels[index - 1].rooms[0];
    stairs.push({ fromLevel: index - 1, toLevel: index, room: hall?.name, width: round(1.0 + (intent.monumentality ?? profile.monumentality) / 100 * 0.35, 0.05) });
  }
  const density: DesignArchitectureProgramSpec["furnishing"][number]["density"] = intent.finishLevel === "luxury" ? "luxury" : intent.finishLevel === "rich" ? "complete" : intent.finishLevel === "light" ? "essential" : profile.archetype === "palace" ? "complete" : "balanced";
  const furnishing = levels.flatMap((level) => level.rooms)
    .filter((room) => !/garage|terrace|terrasse/.test(room.usage || ""))
    .map((room) => ({ room: room.name, density: room.usage === "gallery" ? "essential" as const : density }));
  const floorMaterialByUsage: Record<string, string> = {};
  const woodish = materials.find((name) => /ch[eê]ne|noyer|bois|parquet/i.test(name));
  const stonish = materials.find((name) => /travertin|marbre|pierre|calcaire|c[eé]ramique/i.test(name));
  if (profile.archetype === "palace") {
    const marble = stonish && /marbre/i.test(stonish) ? stonish : "Marbre Calacatta clair";
    floorMaterialByUsage.living = marble;
    floorMaterialByUsage.hall = marble;
    floorMaterialByUsage.gallery = marble;
    floorMaterialByUsage.dining = marble;
    floorMaterialByUsage.bedroom = woodish && /noyer|bois/i.test(woodish) ? woodish : "Noyer fumé";
    floorMaterialByUsage.kitchen = marble;
    floorMaterialByUsage.bathroom = marble;
    floorMaterialByUsage.office = woodish || "Noyer fumé";
  } else {
    floorMaterialByUsage.living = woodish || "Chêne naturel";
    floorMaterialByUsage.hall = floorMaterialByUsage.living;
    floorMaterialByUsage.dining = floorMaterialByUsage.living;
    floorMaterialByUsage.bedroom = floorMaterialByUsage.living;
    floorMaterialByUsage.kitchen = stonish || "Travertin ivoire";
    floorMaterialByUsage.bathroom = stonish || "Travertin ivoire";
    floorMaterialByUsage.office = floorMaterialByUsage.living;
  }
  return {
    archetype: profile.archetype,
    style,
    palette,
    materials,
    wallHeight,
    floorMaterialByUsage,
    wallColor: palette[0] || profile.wallColor,
    levels,
    stairs,
    colonnadeRooms,
    openings: synthesizeOpenings(profile, intent, levels),
    furnishing,
    summary: profile.archetype === "palace"
      ? `Programme monumental « ${style} » : ${levels.length} niveaux, hauteur libre ${wallHeight.toFixed(1)} m${colonnadeRooms.length ? `, colonnades (${colonnadeRooms.join(", ")})` : ""}, ${materials.slice(0, 3).join(", ")}, ameublement ${density}.`
      : profile.archetype === "villa"
        ? `Programme villa « ${style} » : ${levels.length} niveau(x), hauteur libre ${wallHeight.toFixed(1)} m, baies vitrées généreuses, ${materials.slice(0, 3).join(", ")}, ameublement ${density}.`
        : `Programme maison « ${style} » : ${levels.length} niveau(x), hauteur libre ${wallHeight.toFixed(1)} m, ${materials.slice(0, 3).join(", ")}.`
  };
}

function floorMaterialFor(project: DesignProject, name: string): string {
  const known = project.materials.find((material) => norm(material.name).includes(norm(name)) || norm(name).includes(norm(material.name)));
  if (known) return known.id;
  const textureHint = /marbre/.test(norm(name)) ? "marble" : /travertin/.test(norm(name)) ? "travertine" : /noyer|chene|chêne|bois/.test(norm(name)) ? "wood" : /pierre/.test(norm(name)) ? "stone" : "";
  const byTexture = textureHint ? project.materials.find((material) => material.texture === textureHint && (material.category === "floor" || material.category === "surface")) : undefined;
  return byTexture?.id || "mat-oak";
}

function placeColumns(project: DesignProject, room: DesignRoom, offset: number): void {
  const longSide = room.width >= room.height;
  const span = longSide ? room.width : room.height;
  const thickness = 0.44;
  const height = Math.max(2.4, project.plan.wallHeight * 0.94);
  const usable = span - 2 * offset - thickness;
  const target = Math.max(2, Math.min(6, Math.floor(usable / 1.9)));
  const gap = usable / (target - 1);
  const materialId = floorMaterialFor(project, "Marbre");
  for (let index = 0; index < target; index += 1) {
    const along = offset + thickness / 2 + gap * index;
    for (const side of [-1, 1]) {
      const column: DesignObject = longSide
        ? { id: uid("column"), name: `Colonne monumentale ${index + 1}${side > 0 ? "B" : "A"}`, category: "furniture", x: room.x + along - thickness / 2, y: side > 0 ? room.y + room.height - offset - thickness : room.y + offset, width: thickness, depth: thickness, height, rotation: 0, materialId, roomId: room.id, level: room.level || 0, metadata: { structural: "column", archetype: "palace" } }
        : { id: uid("column"), name: `Colonne monumentale ${index + 1}${side > 0 ? "B" : "A"}`, category: "furniture", x: side > 0 ? room.x + room.width - offset - thickness : room.x + offset, y: room.y + along - thickness / 2, width: thickness, depth: thickness, height, rotation: 0, materialId, roomId: room.id, level: room.level || 0, metadata: { structural: "column", archetype: "palace" } };
      if (objectFitsRoom(project, room, column, 0.05)) project.plan.objects.push(column);
    }
  }
}

/** Applique atomiquement un programme architectural (structure, hauteurs, colonnes, matériaux). */
export function applyArchitectureProgram(source: DesignProject, spec: DesignArchitectureProgramSpec): DesignProject {
  let project = structuredClone(source);
  project.plan.wallHeight = clamp(spec.wallHeight, 2.4, 8);
  const levels = spec.levels.filter((level) => level.rooms.some((room) => room.name.trim())).slice(0, 4);
  const requests = levels.map((level) => ({ name: level.name, rooms: level.rooms.map((room) => ({ name: room.name, usage: room.usage, width: room.width, depth: room.depth })) }));
  project = levels.length > 1 ? buildVillaProgram(project, requests) : buildArchitectureLayout(project, requests[0]?.rooms || []);
  for (const room of project.plan.rooms) {
    const usage = room.usage || "";
    room.ceilingHeight = project.plan.wallHeight + (/living|hall|gallery/.test(usage) ? 0.4 : 0);
    const floorName = spec.floorMaterialByUsage?.[usage] || spec.floorMaterialByUsage?.living || spec.materials[0];
    if (floorName) room.floorMaterialId = floorMaterialFor(project, floorName);
    room.color = spec.palette[Math.min(1, spec.palette.length - 1)] || spec.wallColor;
  }
  const wallMaterial = project.materials.find((material) => material.id === "mat-wall");
  if (wallMaterial) wallMaterial.color = spec.wallColor;
  // Escaliers inter-niveaux (mêmes règles que l'action add_stairs_connection).
  for (const stair of spec.stairs) {
    const stairRoomName = typeof stair.room === "string" ? stair.room.trim() : "";
    const sourceRoom = (stairRoomName ? project.plan.rooms.find((room) => norm(room.name).includes(norm(stairRoomName)) || norm(stairRoomName).includes(norm(room.name))) : undefined) || project.plan.rooms.find((room) => (room.level || 0) === stair.fromLevel);
    if (!sourceRoom) continue;
    const width = clamp(stair.width || 1.05, 0.85, 1.6);
    const depth = Math.min(sourceRoom.height - 0.5, 3.4);
    const height = Math.max(2.4, (stair.toLevel - stair.fromLevel) * (project.plan.wallHeight + 0.28));
    const placement = findPlacementInRoom(project, sourceRoom, width, depth) || { x: sourceRoom.x + 0.28, y: sourceRoom.y + 0.28 };
    project.plan.objects.push({ id: uid("stairs"), name: `Escalier ${stair.fromLevel + 1}→${stair.toLevel + 1}`, category: "stairs", x: placement.x, y: placement.y, width, depth, height, rotation: 0, materialId: "mat-oak", roomId: sourceRoom.id, level: stair.fromLevel, metadata: { fromLevel: stair.fromLevel, toLevel: stair.toLevel } });
  }
  // Colonnades monumentales (archetype palais) dans les pièces de circulation.
  for (const colonnadeName of spec.colonnadeRooms) {
    for (const room of project.plan.rooms) {
      if (norm(room.name).includes(norm(colonnadeName.replace(/\s(d’honneur|supérieure)$/i, ""))) || norm(colonnadeName).includes(norm(room.name))) placeColumns(project, room, 0.62);
    }
  }
  project.preferences.style = spec.style;
  project.architecture = {
    ...(project.architecture || { cameraMode: "exterior", roomOrder: [] }),
    cameraMode: "exterior",
    roomOrder: project.architecture?.roomOrder || [],
    autonomy: "high",
    style: spec.style,
    palette: spec.palette,
    renderQuality: "high",
    finishLevel: spec.furnishing.some((furnish) => furnish.density === "luxury") ? "luxury" : spec.furnishing.some((furnish) => furnish.density === "complete") ? "rich" : project.architecture?.finishLevel || "balanced",
    sketchfabStrategy: project.architecture?.sketchfabStrategy || "strict",
    ...(project.architecture?.designIntent ? { designIntent: project.architecture.designIntent } : {})
  };
  project.updatedAt = new Date().toISOString();
  project.revision += 1;
  return project;
}

/**
 * Convertit un Design Intent en plan d'actions Design consommable par le
 * pipeline existant (timeline, application pas à pas, composition intérieure).
 */
export function intentToDesignActions(project: DesignProject, intent: DesignIntentSummary, instruction: string): DesignAiPlanLike {
  const spec = synthesizeArchitectureProgram(project, intent, instruction);
  const actions: DesignAiAction[] = [];
  // V8.1 : tout passe par le programme atomique (niveaux, hauteurs, sols par
  // usage, murs, colonnades, escaliers) — y compris les maisons simples.
  actions.push({ type: "apply_architecture_program", program: spec });
  for (const opening of spec.openings) actions.push({ type: "add_opening", room: opening.room, kind: opening.kind, side: opening.side, width: opening.width, height: opening.height, sill: opening.sill });
  actions.push({ type: "set_architecture_ambience", ambience: intent.ambience });
  const vocabulary = effectiveAssetVocabulary(intent);
  // Une « maison » simple reste livrée structure seule (philosophie V7) ; un
  // palais, une villa ou une demande d'aménagement déclenchent la composition.
  const wantsInterior = spec.archetype !== "house" || /meubl|amenage|am[eé]nage|decor|d[eé]cor|int[eé]rieur|complet|complete|compose|compose/.test(norm(instruction));
  if (wantsInterior) {
    for (const furnish of spec.furnishing) actions.push({ type: "furnish_room", room: furnish.room, style: `${spec.style} · mobilier ${intent.furnitureStyle || ""}`.trim(), density: furnish.density, replaceExisting: true, preferAssets: true });
  }
  const archetypeLabel = spec.archetype === "palace" ? "palais" : spec.archetype === "villa" ? "villa" : "maison";
  return {
    summary: `Programme ${archetypeLabel} dérivé du Design Intent : ${spec.summary}`,
    actions,
    recommendations: [
      `Vocabulaire d'assets Sketchfab aligné : ${Object.values(vocabulary).flat().slice(0, 6).join(", ")}…`,
      "Aucun asset n'est inventé : si Sketchfab ne renvoie rien de compatible (licence, PBR, style), le fallback procédural premium est conservé et signalé."
    ],
    spec
  };
}

export type DesignAiPlanLike = { summary: string; actions: DesignAiAction[]; recommendations: string[]; spec: DesignArchitectureProgramSpec };
