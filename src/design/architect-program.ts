import { buildArchitectureLayout, buildVillaProgram, findPlacementInRoom, objectFitsRoom } from "./architecture";
import { effectiveAssetVocabulary, profileForArchetype, roomDisplayName, type IntentArchetypeProfile } from "./intent-profiles";
import { parseRoomRequests } from "./program-requests";
import type { DesignAiAction, DesignArchitectureProgramSpec, DesignIntentSummary, DesignObject, DesignProject, DesignRoom } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — Program Synthesis Engine (génératif).
 *
 * RÈGLE ABSOLUE V8.2 : AUCUN template fixe. Plus aucun « if palace: create X ».
 * Les niveaux, les pièces, leurs dimensions, les ouvertures et les colonnades
 * sont SYNTHÉTISÉS depuis : le Design Intent (monumentalité, finition,
 * matériaux), le prompt (pièces demandées, styles), et une GRAINE de variation
 * — deux demandes identiques ne produisent donc pas forcément la même scène.
 */

const uid = (prefix = "program") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const round = (value: number, step = 0.1) => Math.round(value / step) * step;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export { parseRoomRequests } from "./program-requests";

/* ---------------------- Générateur pseudo-aléatoire seedé ---------------------- */

function hashText(text: string): number {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------- Synthèse générative des niveaux ---------------------- */

type DraftRoom = { usage: string; width: number; depth: number; level: number; variant: number };

const BASE_SIZE_BY_USAGE: Record<string, { width: number; depth: number }> = {
  living: { width: 6.2, depth: 4.8 },
  hall: { width: 3.4, depth: 3.0 },
  dining: { width: 4.6, depth: 4.0 },
  kitchen: { width: 3.9, depth: 3.6 },
  bedroom: { width: 4.0, depth: 3.7 },
  bathroom: { width: 2.5, depth: 2.2 },
  office: { width: 3.4, depth: 3.1 },
  gallery: { width: 5.4, depth: 2.9 },
  garage: { width: 5.4, depth: 3.4 },
  terrace: { width: 4.4, depth: 2.8 }
};

const FINISH_SCALE: Record<DesignIntentSummary["finishLevel"], number> = { light: 0.92, balanced: 1, rich: 1.06, luxury: 1.12 };

function jitter(rng: () => number, value: number, spread = 0.07): number {
  return value * (1 + (rng() * 2 - 1) * spread);
}

/** Compose les niveaux/pièces par règles architecturales + variation seedée. */
function generateProgramLevels(intent: DesignIntentSummary, instruction: string, seed: number): { levels: DesignArchitectureProgramSpec["levels"]; colonnadeUsages: string[] } {
  const rng = mulberry32(seed);
  const profile = profileForArchetype(intent.archetype === "interior" ? "house" : intent.archetype);
  const archetype = profile.archetype;
  const mon = clamp(intent.monumentality ?? profile.monumentality, 0, 100);
  const scale = clamp(0.86 + (mon / 100) * 0.4, 0.8, 1.5) * (FINISH_SCALE[intent.finishLevel] || 1);
  const requests = intent.requestedRooms?.length ? intent.requestedRooms : parseRoomRequests(instruction);
  const colonnadeUsages: string[] = [];

  // Niveaux : dérivés de la monumentalité (intime 1 → palais 3-4).
  let levelCount: number;
  let requestedHandled = false;
  if (requests.length && archetype !== "palace") {
    const hasBedroom = requests.some((room) => room.usage === "bedroom");
    levelCount = archetype === "villa" && hasBedroom ? 2 : 1;
  } else {
    levelCount = clamp(1 + Math.floor(mon / 40), 1, 4);
  }

  const levels: Array<{ name?: string; rooms: Array<{ name: string; usage?: string; width?: number; depth?: number }> }> = [];
  const usageCount: Record<string, number> = {};
  const pushRoom = (levelIndex: number, usage: string, widthScale = 1) => {
    const base = BASE_SIZE_BY_USAGE[usage] || { width: 3.4, depth: 3.2 };
    const width = clamp(jitter(rng, base.width * scale * widthScale), 2.1, 26);
    const depth = clamp(jitter(rng, base.depth * scale), 2.1, 26);
    usageCount[usage] = (usageCount[usage] || 0) + 1;
    const area = width * depth;
    const name = roomDisplayName(usage, area, archetype, usageCount[usage]);
    if (!levels[levelIndex]) levels[levelIndex] = { name: levelIndex === 0 ? "Rez-de-chaussée" : `Étage ${levelIndex}`, rooms: [] };
    levels[levelIndex].rooms.push({ name, usage, width: round(width, .05), depth: round(depth, .05) });
    if (mon >= 70 && (usage === "hall" || usage === "gallery")) colonnadeUsages.push(name);
  };

  if (requests.length && archetype !== "palace") {
    // Pièces explicitement demandées par l'utilisateur : elles font foi.
    requestedHandled = true;
    for (const request of requests) {
      const usage = request.usage || guessUsage(request.name);
      const base = BASE_SIZE_BY_USAGE[usage] || { width: 3.6, depth: 3.2 };
      usageCount[usage] = (usageCount[usage] || 0) + 1;
      const mult = archetype === "villa" ? 1.15 : 1;
      const width = clamp(jitter(rng, base.width * mult), 2.1, 26);
      const depth = clamp(jitter(rng, base.depth * mult), 2.1, 26);
      const targetLevel = usage === "bedroom" && levelCount > 1 ? 1 : 0;
      if (!levels[targetLevel]) levels[targetLevel] = { name: targetLevel === 0 ? "Rez-de-chaussée" : "Étage 1", rooms: [] };
      const isBathroom = usage === "bathroom";
      const name = isBathroom && !/salle/i.test(request.name) ? roomDisplayName(usage, width * depth, archetype, usageCount[usage]) : request.name;
      levels[targetLevel].rooms.push({ name, usage, width: round(width, .05), depth: round(depth, .05) });
    }
    if (levelCount > 1 && !levels[1].rooms.some((room) => room.usage === "bathroom")) levels[1].rooms.push({ name: "Salle de bain", usage: "bathroom", width: 3.0, depth: 2.5 });
  }

  if (!requestedHandled) {
    for (let level = 0; level < levelCount; level += 1) {
      if (level === 0) {
        // Rez : hall → séjours → réception → cuisine → services (+ variantes seedées).
        pushRoom(0, "hall", mon >= 70 ? 1.7 : 1);
        pushRoom(0, "living", mon >= 70 ? 1.5 : 1);
        if (mon >= 60 || rng() > .4) pushRoom(0, "living", 1.05); // second séjour (Salon de réception…)
        if (mon >= 45 || rng() > .25) pushRoom(0, "dining");
        pushRoom(0, "kitchen");
        if (mon >= 70 && rng() > .35) pushRoom(0, "gallery");
        pushRoom(0, "bathroom");
      } else if (level === levelCount - 1 || level === 1) {
        // Étages : chambres (nombre lié à la monumentalité) + services + variantes.
        const bedrooms = clamp(Math.round(2 + mon / 45), 2, 5);
        for (let index = 0; index < bedrooms; index += 1) pushRoom(level, "bedroom", index === 0 ? 1.15 : 1);
        pushRoom(level, "bathroom");
        if (mon >= 45 || rng() > .5) pushRoom(level, "office");
        if (mon >= 70 && rng() > .4) pushRoom(level, "living", .8); // salon privé
        if (mon >= 70 && rng() > .45) pushRoom(level, "gallery", .8);
      } else {
        // Niveaux supplérieaires (très monumental) : ailes invités / détente.
        pushRoom(level, "bedroom", 1.1);
        pushRoom(level, "bedroom");
        pushRoom(level, "office");
        pushRoom(level, "bathroom");
        if (rng() > .5) pushRoom(level, "gallery", .7);
      }
    }
  }
  return { levels: levels.filter((level) => level.rooms.length), colonnadeUsages };
}

function guessUsage(name: string): string {
  const value = norm(name);
  if (/salon|sejour|séjour|living/.test(value)) return "living";
  if (/cuisine/.test(value)) return "kitchen";
  if (/salle a manger|salle à manger|dining/.test(value)) return "dining";
  if (/chambre|bedroom|suite/.test(value)) return "bedroom";
  if (/salle de bain|salle d.eau|bath|douch|wc/.test(value)) return "bathroom";
  if (/bureau|office/.test(value)) return "office";
  if (/garage/.test(value)) return "garage";
  if (/terrasse/.test(value)) return "terrace";
  if (/hall|entree|entrée/.test(value)) return "hall";
  if (/galerie/.test(value)) return "gallery";
  return "multi-purpose";
}

/* ---------------------- Ouvertures générées par règles d'usage ---------------------- */

function synthesizeOpenings(intent: DesignIntentSummary, profile: IntentArchetypeProfile, levels: DesignArchitectureProgramSpec["levels"]): DesignArchitectureProgramSpec["openings"] {
  const mon = clamp(intent.monumentality ?? profile.monumentality, 0, 100);
  const openings: DesignArchitectureProgramSpec["openings"] = [];
  let budget = 6;
  for (const level of levels) {
    for (const room of level.rooms) {
      if (budget <= 0) break;
      const usage = room.usage || "";
      if (!/living|dining|hall|bedroom|office/.test(usage)) continue;
      const span = Math.max(room.width || 4, room.depth || 4);
      if (mon >= 70) {
        // Monumental : fenêtres hautes et larges (≥ 2,2 m), allège haute.
        openings.push({ room: room.name, kind: "window", side: "south", width: round(clamp(span * .5, 2.2, 4.6), .05), height: round(clamp(2.2 + mon / 90, 2.4, 4), .05), sill: round(clamp(.85 - mon / 400, .6, .95), .05) });
      } else if (mon < 60 && (usage === "living" || usage === "dining")) {
        // Contemporain : baie vitrée large à allège basse.
        openings.push({ room: room.name, kind: "window", side: "south", width: round(clamp(span * .62, 3.0, 4.6), .05), height: round(clamp(2.1 + mon / 100, 2.15, 2.4), .05), sill: round(clamp(.16 + mon / 500, .16, .3), .05) });
      } else {
        openings.push({ room: room.name, kind: "window", side: "south", width: round(clamp(span * .45, 1.6, 3), .05), height: round(clamp(1.4 + mon / 100, 1.45, 1.9), .05), sill: round(clamp(.95 - mon / 300, .6, .95), .05) });
      }
      budget -= 1;
    }
  }
  return openings;
}

/* ---------------------- Programme complet ---------------------- */

export function synthesizeArchitectureProgram(project: DesignProject, intent: DesignIntentSummary, instruction: string, seed?: number): DesignArchitectureProgramSpec {
  const profile = profileForArchetype(intent.archetype === "interior" ? "house" : intent.archetype);
  const effectiveSeed = seed ?? hashText(`${instruction}|${intent.archetype}|${intent.finishLevel}|${intent.style}`);
  const { levels, colonnadeUsages } = generateProgramLevels(intent, instruction, effectiveSeed);
  const wallHeight = round(clamp(intent.wallHeight || profile.wallHeight, 2.4, 8));
  const palette = intent.palette.length ? intent.palette : profile.basePalette;
  const materials = intent.materials.length ? intent.materials : profile.baseMaterials;
  const style = intent.style || profile.styleLabel;
  const colonnadeRooms = (intent.monumentality ?? profile.monumentality) >= 70 ? colonnadeUsages : [];
  const stairs: DesignArchitectureProgramSpec["stairs"] = [];
  for (let index = 1; index < levels.length; index += 1) {
    const hall = levels[index - 1].rooms.find((room) => /hall|gallery/.test(room.usage || "")) || levels[index - 1].rooms.find((room) => room.usage === "living") || levels[index - 1].rooms[0];
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
    openings: synthesizeOpenings(intent, profile, levels),
    furnishing,
    summary: profile.archetype === "palace"
      ? `Programme monumental « ${style} » : ${levels.length} niveaux, hauteur libre ${wallHeight.toFixed(1)} m${colonnadeRooms.length ? `, colonnades (${colonnadeRooms.slice(0, 2).join(", ")})` : ""}, ${materials.slice(0, 3).join(", ")}, ameublement ${density}.`
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
  for (const colonnadeName of spec.colonnadeRooms) {
    for (const room of project.plan.rooms) {
      if (norm(room.name).includes(norm(colonnadeName)) || norm(colonnadeName).includes(norm(room.name))) placeColumns(project, room, 0.62);
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
export function intentToDesignActions(project: DesignProject, intent: DesignIntentSummary, instruction: string, seed?: number): DesignAiPlanLike {
  const spec = synthesizeArchitectureProgram(project, intent, instruction, seed);
  const actions: DesignAiAction[] = [];
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
    summary: `Programme ${archetypeLabel} synthétisé depuis le Design Intent : ${spec.summary}`,
    actions,
    recommendations: [
      `Vocabulaire d'assets Sketchfab aligné : ${Object.values(vocabulary).flat().slice(0, 6).join(", ")}…`,
      "Aucun asset n'est inventé : si Sketchfab ne renvoie rien de compatible (licence, PBR, style), un placeholder premium temporaire est généré et le manque est enregistré."
    ],
    spec
  };
}

export type DesignAiPlanLike = { summary: string; actions: DesignAiAction[]; recommendations: string[]; spec: DesignArchitectureProgramSpec };
