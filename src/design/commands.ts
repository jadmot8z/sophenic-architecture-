import type { DesignAiAction, DesignAiPlan, DesignMaterial, DesignObject, DesignProject, DesignRoom, DesignWall } from "./types";
import { ensureWebWorkspace, normalizeWebPath, webFileMime } from "./web-workspace";
import { buildArchitectureLayout, buildVillaProgram, findPlacementInRoom, findSmartPlacementInRoom, rebuildArchitectureStructure, syncArchitectureNavigation } from "./architecture";
import { composeInteriorRoom, optimizeInteriorRoomLayout } from "./interior-composition";
import { applyArchitectureProgram, intentToDesignActions } from "./architect-program";
import { rebuildRoomFromBlueprint, rebuildRoomPlan } from "./space-rebuild";
import { buildArchitectureIntent } from "./design-intent";

const uid = (prefix = "d") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const findRoom = (project: DesignProject, name: string) => project.plan.rooms.find((room) => norm(room.name).includes(norm(name)) || norm(name).includes(norm(room.name)));
const findObject = (project: DesignProject, name: string) => project.plan.objects.find((object) => norm(object.name).includes(norm(name)) || norm(name).includes(norm(object.name)));

function materialFor(project: DesignProject, name: string, color?: string): DesignMaterial {
  const existing = project.materials.find((material) => norm(material.name).includes(norm(name)) || norm(name).includes(norm(material.name)));
  if (existing) return existing;
  const value = norm(name);
  const texture: DesignMaterial["texture"] = /marbre/.test(value) ? "marble" : /travertin/.test(value) ? "travertine" : /noyer|chene|bois|parquet/.test(value) ? "wood" : /beton/.test(value) ? "concrete" : /verre/.test(value) ? "glass" : /metal|laiton/.test(value) ? "metal" : /tissu|boucle|laine/.test(value) ? "fabric" : /cuir/.test(value) ? "leather" : /ceramique|carrelage/.test(value) ? "ceramic" : /peinture|enduit|mur/.test(value) ? "plaster" : "stone";
  const category = /peinture|enduit|mur/.test(value) ? "wall" : texture === "glass" ? "glass" : texture === "metal" ? "metal" : texture === "fabric" || texture === "leather" ? "fabric" : /marbre|travertin|bois|parquet|carrelage|sol|beton/.test(value) ? "floor" : "surface";
  const material: DesignMaterial = { id: uid("mat"), name: name.slice(0, 80), category, color: color || "#c8c2b8", roughness: texture === "marble" ? .2 : texture === "glass" ? .06 : texture === "metal" ? .3 : texture === "fabric" ? .94 : .58, reflectivity: texture === "marble" ? .7 : texture === "glass" ? .86 : texture === "metal" ? .62 : .18, texture, textureScale: texture === "fabric" ? 8 : texture === "wood" ? 2.6 : 1.8, normalStrength: texture === "fabric" ? .3 : texture === "stone" || texture === "travertine" ? .28 : .14 };
  project.materials.push(material);
  return material;
}


function defaultObjectDimensions(name: string, category: DesignObject["category"] | undefined): { width: number; depth: number; height: number } {
  const value = norm(name);
  if (/canape|sofa/.test(value)) return { width: 2.15, depth: .92, height: .86 };
  if (/fauteuil|armchair/.test(value)) return { width: .82, depth: .86, height: .9 };
  if (/table basse|coffee table/.test(value)) return { width: 1.05, depth: .62, height: .42 };
  if (/table/.test(value)) return { width: 1.6, depth: .85, height: .76 };
  if (/lit|bed/.test(value)) return { width: 1.6, depth: 2.05, height: .62 };
  if (/chaise|chair/.test(value)) return { width: .52, depth: .55, height: .9 };
  if (/lampe|luminaire|suspension/.test(value) || category === "lighting") return { width: .45, depth: .45, height: 1.2 };
  if (/plante/.test(value) || category === "plant") return { width: .6, depth: .6, height: 1.3 };
  if (category === "stairs") return { width: 1.0, depth: 2.4, height: 2.7 };
  return { width: 1.0, depth: .7, height: .8 };
}


function wallForRoomSide(project: DesignProject, room: DesignRoom, side: "north" | "south" | "east" | "west"): DesignWall | undefined {
  const epsilon = 0.08;
  const candidates = project.plan.walls.filter((wall) => {
    if ((wall.level || 0) !== (room.level || 0)) return false;
    const horizontal = Math.abs(wall.start.y - wall.end.y) < epsilon;
    const vertical = Math.abs(wall.start.x - wall.end.x) < epsilon;
    if (side === "north" || side === "south") {
      const y = side === "north" ? room.y : room.y + room.height;
      if (!horizontal || Math.abs(wall.start.y - y) > epsilon) return false;
      const min = Math.max(Math.min(wall.start.x, wall.end.x), room.x);
      const max = Math.min(Math.max(wall.start.x, wall.end.x), room.x + room.width);
      return max - min > 0.65;
    }
    const x = side === "west" ? room.x : room.x + room.width;
    if (!vertical || Math.abs(wall.start.x - x) > epsilon) return false;
    const min = Math.max(Math.min(wall.start.y, wall.end.y), room.y);
    const max = Math.min(Math.max(wall.start.y, wall.end.y), room.y + room.height);
    return max - min > 0.65;
  });
  return candidates.sort((a, b) => Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y) - Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y))[0];
}

function positionObjectInRoom(project: DesignProject, object: DesignObject, room: DesignRoom, position: "center" | "north" | "south" | "east" | "west" = "center"): void {
  const margin = 0.28;
  const centerX = room.x + room.width / 2 - object.width / 2;
  const centerY = room.y + room.height / 2 - object.depth / 2;
  object.x = position === "west" ? room.x + margin : position === "east" ? room.x + room.width - object.width - margin : centerX;
  object.y = position === "north" ? room.y + margin : position === "south" ? room.y + room.height - object.depth - margin : centerY;
  object.roomId = room.id;
  if (!objectFitsRoomSafe(project, room, object)) {
    const placement = findPlacementInRoom(project, room, object.width, object.depth);
    if (placement) { object.x = placement.x; object.y = placement.y; }
  }
}

function objectFitsRoomSafe(project: DesignProject, room: DesignRoom, object: DesignObject): boolean {
  const within = object.x >= room.x + .06 && object.y >= room.y + .06 && object.x + object.width <= room.x + room.width - .06 && object.y + object.depth <= room.y + room.height - .06;
  if (!within) return false;
  return !project.plan.objects.some((other) => {
    if (other.id === object.id) return false;
    const gap = .08;
    return !(object.x + object.width + gap <= other.x || other.x + other.width + gap <= object.x || object.y + object.depth + gap <= other.y || other.y + other.depth + gap <= object.y);
  });
}

function placeRoom(project: DesignProject, room: DesignRoom): void {
  const gap = 0.35;
  const farRight = project.plan.rooms.reduce((max, item) => Math.max(max, item.x + item.width), 0);
  room.x = Math.min(Math.max(0.4, farRight + gap), Math.max(0.4, project.plan.width - room.width - 0.4));
  room.y = Math.min(0.7, Math.max(0.4, project.plan.height - room.height - 0.4));
  if (room.x + room.width > project.plan.width - 0.2) {
    room.x = 0.7;
    room.y = Math.max(0.7, project.plan.rooms.reduce((max, item) => Math.max(max, item.y + item.height), 0) + gap);
    if (room.y + room.height > project.plan.height) project.plan.height = room.y + room.height + 0.7;
  }
}

export function applyDesignActions(source: DesignProject, actions: DesignAiAction[]): DesignProject {
  let project = structuredClone(source);
  let architectureStructureChanged = false;
  for (const action of actions) {
    if (action.type === "apply_architecture_program") {
      // V8.1 : application atomique du programme dérivé du Design Intent
      // (niveaux, hauteurs, colonnades, matériaux, escaliers, ouvertures recalculées).
      // Le programme reconstruit déjà la structure en interne : pas de rebuild
      // final, sinon les add_opening suivants (fenêtres monumentales, baies
      // vitrées) seraient écrasés par les ouvertures automatiques.
      project = applyArchitectureProgram(project, action.program);
      architectureStructureChanged = false;
    } else if (action.type === "rebuild_room") {
      // V8.2 — SPACE REBUILD ENGINE : suppression totale du mobilier existant
      // puis NOUVELLE composition (layout, meubles, positions, matériaux,
      // ambiance) à partir du ROOM_BLUEPRINT et du Design Intent.
      project = rebuildRoomFromBlueprint(project, action.room, {
        blueprint: action.blueprint || project.architecture?.roomBlueprint || null,
        intent: project.architecture?.designIntent || null,
        seed: project.architecture?.variationSeed
      }).project;
    } else if (action.type === "set_architecture_layout") {
      project = buildArchitectureLayout(project, action.rooms); architectureStructureChanged = true;
    } else if (action.type === "set_villa_program") {
      project = buildVillaProgram(project, action.levels.map((level) => ({ name: level.name, rooms: level.rooms })));
      project.preferences.style = action.style || project.preferences.style;
      project.architecture = { ...(project.architecture || { cameraMode: "exterior", roomOrder: [] }), style: action.style || project.architecture?.style, palette: action.palette || project.architecture?.palette, autonomy: "high", ambience: project.architecture?.brief?.ambience || project.architecture?.ambience || "soft", renderQuality: "high", finishLevel: project.architecture?.finishLevel || project.architecture?.brief?.finishLevel || "balanced", cameraMode: "exterior", roomOrder: project.architecture?.roomOrder || [] };
      architectureStructureChanged = true;
    } else if (action.type === "add_stairs_connection") {
      const fromLevel = Math.max(0, Math.floor(action.fromLevel)); const toLevel = Math.max(fromLevel + 1, Math.floor(action.toLevel));
      const sourceRoom = (action.room ? findRoom(project, action.room) : undefined) || project.plan.rooms.find((room) => (room.level || 0) === fromLevel && /salon|hall|sejour|séjour/i.test(room.name)) || project.plan.rooms.find((room) => (room.level || 0) === fromLevel);
      if (!sourceRoom) continue;
      const width = Math.max(.85, Math.min(1.5, action.width || 1.05)); const depth = Math.min(sourceRoom.height - .5, 3.2); const height = Math.max(2.4, (toLevel - fromLevel) * (project.plan.wallHeight + .28));
      const placement = findPlacementInRoom(project, sourceRoom, width, depth) || { x: sourceRoom.x + .28, y: sourceRoom.y + .28 };
      project.plan.objects.push({ id: uid("stairs"), name: `Escalier ${fromLevel + 1}→${toLevel + 1}`, category: "stairs", x: placement.x, y: placement.y, width, depth, height, rotation: 0, materialId: "mat-oak", roomId: sourceRoom.id, level: fromLevel, metadata: { fromLevel, toLevel } });
    } else if (action.type === "furnish_room") {
      const briefFinish = project.architecture?.finishLevel;
      const requestedDensity = action.density || "balanced";
      const density = briefFinish === "luxury" ? "luxury"
        : briefFinish === "rich" && requestedDensity !== "essential" ? "complete"
        : requestedDensity;
      const composed = composeInteriorRoom(project, action.room, { style: action.style || project.architecture?.brief?.style, density, replaceExisting: action.replaceExisting !== false });
      project = composed.project;
    } else if (action.type === "optimize_room_layout") {
      const optimized = optimizeInteriorRoomLayout(project, action.room);
      project = optimized.project;
    } else if (action.type === "set_architecture_style") {
      project.preferences.style = action.style.slice(0, 120);
      project.architecture = { ...(project.architecture || { cameraMode: "exterior", roomOrder: project.plan.rooms.map((room) => room.id) }), cameraMode: project.architecture?.cameraMode || "exterior", roomOrder: project.architecture?.roomOrder || project.plan.rooms.map((room) => room.id), style: action.style.slice(0, 120), palette: action.palette?.slice(0, 8), autonomy: "high", ambience: project.architecture?.ambience || "soft", renderQuality: "high" };
      const floor = action.floorMaterial ? materialFor(project, action.floorMaterial) : project.materials.find((material) => /noyer|ch[eê]ne|travertin|marbre/i.test(material.name));
      const wetFloor = project.materials.find((material) => /travertin|marbre/i.test(material.name)) || floor;
      if (floor) project.plan.rooms.forEach((room) => { room.floorMaterialId = /bath|salle de bain|salle d.eau|cuisine/i.test(`${room.usage} ${room.name}`) ? wetFloor?.id || floor.id : floor.id; });
      if (action.wallColor) {
        const wallMat = materialFor(project, "Peinture murale", action.wallColor); wallMat.category = "wall"; project.plan.walls.forEach((wall) => { wall.materialId = wallMat.id; });
        const palette = action.palette?.length ? action.palette : [action.wallColor];
        project.plan.rooms.forEach((room, index) => { const usage = norm(`${room.usage} ${room.name}`); room.color = /bath|cuisine/.test(usage) ? "#eeeae2" : /bedroom|chambre|suite/.test(usage) ? palette[Math.min(1, palette.length - 1)] || action.wallColor : /office|bureau/.test(usage) ? palette[Math.min(2, palette.length - 1)] || action.wallColor : palette[0] || action.wallColor; });
      }
    } else if (action.type === "set_architecture_ambience") {
      project.architecture = { ...(project.architecture || { cameraMode: "exterior", roomOrder: project.plan.rooms.map((room) => room.id) }), cameraMode: project.architecture?.cameraMode || "exterior", roomOrder: project.architecture?.roomOrder || project.plan.rooms.map((room) => room.id), ambience: action.ambience, renderQuality: "high" };
    } else if (action.type === "resize_room") {
      const room = findRoom(project, action.room);
      if (!room) continue;
      if (typeof action.scale === "number") { room.width = Math.max(1.2, room.width * action.scale); room.height = Math.max(1.2, room.height * action.scale); }
      if (typeof action.width === "number") room.width = Math.max(1.2, action.width);
      if (typeof action.height === "number") room.height = Math.max(1.2, action.height);
      architectureStructureChanged = project.domain === "architecture" || architectureStructureChanged;
    } else if (action.type === "add_room") {
      const room: DesignRoom = { id: uid("room"), name: action.name || "Nouvelle pièce", usage: action.usage || "multi-purpose", x: 0.7, y: 0.7, width: Math.max(1.8, action.width || 3.2), height: Math.max(1.8, action.height || 3), floorMaterialId: /luxe|marbre/.test(norm(action.style || "")) ? "mat-marble" : "mat-oak", ceilingHeight: project.plan.wallHeight, color: "#f0ebe2" };
      placeRoom(project, room); project.plan.rooms.push(room); architectureStructureChanged = project.domain === "architecture" || architectureStructureChanged;
    } else if (action.type === "rename_room") {
      const room = findRoom(project, action.room); if (room && action.name.trim()) room.name = action.name.trim().slice(0, 80);
    } else if (action.type === "clear_room") {
      const room = findRoom(project, action.room); if (!room) continue;
      project.plan.objects = project.plan.objects.filter((object) => object.roomId !== room.id || (action.keepStructural !== false && object.category === "stairs"));
    } else if (action.type === "remove_object") {
      const object = findObject(project, action.object); if (object) project.plan.objects = project.plan.objects.filter((item) => item.id !== object.id);
    } else if (action.type === "move_object") {
      const object = findObject(project, action.object); if (!object) continue;
      const room = action.room ? findRoom(project, action.room) : project.plan.rooms.find((item) => item.id === object.roomId);
      if (room) positionObjectInRoom(project, object, room, action.position || "center");
      if (typeof action.rotationDegrees === "number") object.rotation = action.rotationDegrees * Math.PI / 180;
    } else if (action.type === "add_opening") {
      const room = findRoom(project, action.room); if (!room) continue;
      const side = action.side || (action.kind === "window" ? "south" : "east");
      const wall = wallForRoomSide(project, room, side); if (!wall) continue;
      const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      const width = Math.max(.55, Math.min(action.width || (action.kind === "window" ? 1.8 : .9), Math.max(.55, length - .2)));
      const height = Math.max(.5, Math.min(action.height || (action.kind === "window" ? 1.35 : 2.1), project.plan.wallHeight - .05));
      const position = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
      const vertical = Math.abs(wall.start.x - wall.end.x) > Math.abs(wall.start.y - wall.end.y);
      const existing = project.plan.openings.find((opening) => opening.wallId === wall.id && opening.kind === action.kind && Math.hypot(opening.position.x - position.x, opening.position.y - position.y) < .5);
      if (existing) {
        existing.width = Math.max(existing.width, width); existing.height = Math.max(existing.height, height);
        if (action.kind === "window") existing.sill = Math.min(existing.sill ?? .85, Math.max(0, Math.min(action.sill ?? .85, project.plan.wallHeight - height)));
      } else {
        project.plan.openings.push({ id: uid("opening"), kind: action.kind, wallId: wall.id, position, width, height, sill: action.kind === "window" ? Math.max(0, Math.min(action.sill ?? .85, project.plan.wallHeight - height)) : 0, rotation: vertical ? Math.PI / 2 : 0, level: room.level || 0 });
      }
    } else if (action.type === "set_wall_height") {
      const previous = project.plan.wallHeight; const height = Math.max(2.1, Math.min(6, action.height)); project.plan.wallHeight = height; project.plan.walls.forEach((wall) => { wall.height = height; }); project.plan.rooms.forEach((room) => { if (!room.ceilingHeight || Math.abs(room.ceilingHeight - previous) < .05) room.ceilingHeight = height; });
    } else if (action.type === "set_ceiling_height") {
      const room = findRoom(project, action.room); if (room) room.ceilingHeight = Math.max(2.1, Math.min(6, action.height));
    } else if (action.type === "add_object") {
      const activeRoom = project.plan.rooms.find((item) => item.id === project.architecture?.activeRoomId);
      const room = action.room ? findRoom(project, action.room) : activeRoom || project.plan.rooms[0];
      if (project.domain === "architecture" && action.room && !room) continue;
      const defaults = defaultObjectDimensions(action.name || "Objet", action.category);
      const width = Math.max(0.2, action.width || defaults.width); const depth = Math.max(0.2, action.depth || defaults.depth); const height = Math.max(0.1, action.height || defaults.height);
      const placement = room ? findSmartPlacementInRoom(project, room, width, depth, action.name || "Objet") : null;
      if (project.domain === "architecture" && room && !placement && action.category !== "stairs") continue;
      const object: DesignObject = {
        id: uid("obj"), name: action.name || "Objet", category: action.category || "furniture",
        x: placement?.x ?? (room?.x || 1) + 0.6, y: placement?.y ?? (room?.y || 1) + 0.6,
        width, depth, height, rotation: 0, color: action.color || "#b69b78", materialId: "mat-fabric",
        roomId: room?.id, level: room?.level || 0, ...(action.asset ? { asset: action.asset } : {})
      };
      project.plan.objects.push(object);
    } else if (action.type === "set_material") {
      const material = materialFor(project, action.material, action.color);
      if (action.target === "floor") {
        const room = action.room ? findRoom(project, action.room) : undefined;
        if (room) room.floorMaterialId = material.id; else project.plan.rooms.forEach((item) => { item.floorMaterialId = material.id; });
      } else if (action.target === "walls") project.plan.walls.forEach((wall) => { wall.materialId = material.id; });
      else if (action.target === "object") { const object = action.object ? findObject(project, action.object) : undefined; if (object) { object.materialId = material.id; if (action.color) object.color = action.color; } }
      else project.product.materialId = material.id;
    } else if (action.type === "set_room_color") {
      const room = findRoom(project, action.room); if (room) room.color = action.color;
    } else if (action.type === "set_orientation") project.site.orientation = ((action.degrees % 360) + 360) % 360;
    else if (action.type === "add_variant") project.variants.unshift({ id: uid("variant"), name: action.name, description: action.description, style: action.style, createdAt: new Date().toISOString() });
    else if (action.type === "add_digital_node") {
      const i = project.digital.nodes.length;
      project.digital.nodes.push({ id: uid("ui"), kind: action.kind, label: action.label, x: 40 + (i % 2) * 520, y: 140 + Math.floor(i / 2) * 220, width: action.kind === "hero" ? 1100 : 480, height: action.kind === "navbar" ? 72 : 180, text: action.text || action.label, background: "#ffffff", foreground: project.digital.designSystem.text, radius: project.digital.designSystem.radius, animation: ["fade", "slide", "scale"].includes(String(action.animation)) ? action.animation : "fade" });
    } else if (action.type === "set_design_system") project.digital.designSystem = { ...project.digital.designSystem, ...(action.primary ? { primary: action.primary } : {}), ...(action.surface ? { surface: action.surface } : {}), ...(action.text ? { text: action.text } : {}), ...(typeof action.radius === "number" ? { radius: Math.max(0, Math.min(64, action.radius)) } : {}), ...(typeof action.spacing === "number" ? { spacing: Math.max(4, Math.min(64, action.spacing)) } : {}) };
    else if (action.type === "set_product_dimensions") {
      if (typeof action.width === "number") project.product.width = Math.max(0.01, action.width);
      if (typeof action.depth === "number") project.product.depth = Math.max(0.01, action.depth);
      if (typeof action.height === "number") project.product.height = Math.max(0.01, action.height);
    } else if (action.type === "write_web_file") {
      const path = normalizeWebPath(action.path);
      if (!path || /(^|\/)node_modules(\/|$)/i.test(path) || action.content.length > 240_000) continue;
      const workspace = ensureWebWorkspace(project);
      const existing = workspace.files.find((file) => file.path === path);
      if (existing) {
        existing.kind = "text"; existing.content = action.content; existing.dataUrl = undefined; existing.mime = webFileMime(path, existing.mime); existing.size = action.content.length; existing.modifiedAt = new Date().toISOString();
      } else {
        workspace.files.push({ path, kind: "text", mime: webFileMime(path), size: action.content.length, content: action.content, modifiedAt: new Date().toISOString() });
      }
      if (!workspace.entryPath && /\.html?$/i.test(path)) workspace.entryPath = path;
      workspace.selectedPath = path;
    } else if (action.type === "note") project.plan.annotations.push({ id: uid("note"), kind: "note", text: action.text, x: 1, y: 1 });
  }
  if (project.domain === "architecture") project = architectureStructureChanged ? rebuildArchitectureStructure(project) : syncArchitectureNavigation(project);
  project.updatedAt = new Date().toISOString();
  project.revision += 1;
  return project;
}

function frenchCount(text: string, singular: string, plural: string): number {
  const wordMap: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6 };
  const match = text.match(new RegExp(`(?:\\b(\\d+)\\b|\\b(un|une|deux|trois|quatre|cinq|six)\\b)\\s+${plural}`));
  if (match) return Number(match[1] || wordMap[match[2]] || 0);
  return new RegExp(`\\b${singular}\\b`).test(text) ? 1 : 0;
}

function requestedHouseRooms(text: string): DesignAiAction | null {
  if (!/(?:cree|creer|concois|construis|fais).{0,35}(?:maison|appartement|logement)/.test(text)) return null;
  const rooms: Array<{ name: string; usage?: string }> = [];
  if (/salon|sejour/.test(text)) rooms.push({ name: "Salon", usage: "living" });
  if (/cuisine/.test(text)) rooms.push({ name: "Cuisine", usage: "kitchen" });
  const bedrooms = frenchCount(text, "chambre", "chambres?");
  for (let index = 1; index <= bedrooms; index += 1) rooms.push({ name: `Chambre ${index}`, usage: "bedroom" });
  const bathrooms = Math.max(frenchCount(text, "salle de bain", "salles? de bains?"), frenchCount(text, "sdb", "sdb"));
  for (let index = 1; index <= bathrooms; index += 1) rooms.push({ name: bathrooms === 1 ? "Salle de bain" : `Salle de bain ${index}`, usage: "bathroom" });
  if (/bureau/.test(text)) rooms.push({ name: "Bureau", usage: "office" });
  if (/garage/.test(text)) rooms.push({ name: "Garage", usage: "garage" });
  if (/terrasse/.test(text)) rooms.push({ name: "Terrasse", usage: "terrace" });
  if (!rooms.length) rooms.push({ name: "Salon", usage: "living" }, { name: "Cuisine", usage: "kitchen" }, { name: "Chambre 1", usage: "bedroom" }, { name: "Salle de bain", usage: "bathroom" });
  return { type: "set_architecture_layout", rooms };
}

/** V8.1 — prompts qui déclenchent une génération globale via le Program Synthesis Engine. */
function isWholeGenerationPrompt(text: string): boolean {
  return /palai|palace/.test(text)
    || /villa/.test(text)
    || /(?:cree|cr[eé]e|creer|concois|construis|fais).{0,40}(?:maison|appartement|logement)/.test(text)
    || /(?:transforme|transformer|refais|reinvente|réinvente|convertis|redessine|ameliore|améliore).{0,60}(?:maison|villa|palais|palace|projet|residence|résidence)/.test(text)
    || /(?:transforme|transformer|refais|reinvente|réinvente).{0,80}(?:palais|palace)/.test(text);
}

export function fastDesignCommand(project: DesignProject, input: string, variationSeed?: number): DesignAiPlan | null {
  if (project.domain === "web" && project.webWorkspace?.files.length) return null;
  const text = norm(input);
  const actions: DesignAiAction[] = [];
  const brief = project.architecture?.brief;
  const intent = project.architecture?.designIntent || (project.domain === "architecture" ? buildArchitectureIntent(project, input, project.architecture?.referenceAnalyses || []) : undefined);
  const briefDensity: Extract<DesignAiAction, { type: "furnish_room" }>["density"] = intent?.finishLevel === "luxury" || brief?.finishLevel === "luxury" ? "luxury" : brief?.finishLevel === "rich" ? "complete" : "balanced";
  /* V8.1 REAL AI — plus AUCUN template fixe : toute génération globale passe par
     le Program Synthesis Engine, dérivé du Design Intent (Brain/références). */
  /* V8.2 — SPACE REBUILD en PRIORITÉ : « Transforme mon salon en palace royal »
     cible la PIÈCE (mot de pièce présent), pas la maison entière — même si le
     style demandé évoque un palais. La reconstruction de pièce prime donc sur
     la génération globale. */
  if (project.domain === "architecture" && /(?:transforme|transformer|refais|reinvente|r[ée]invente|change|remplace|redessine|relooke|m[ée]tamorphose).{0,60}(?:salon|s[ée]jour|chambre|cuisine|salle a manger|salle à manger|suite|bureau|pi[eè]ce|room|living|int[ée]rieur)/.test(text)) {
    const rebuildPlan = rebuildRoomPlan(project, input, project.architecture?.roomBlueprint || null);
    if (rebuildPlan) return rebuildPlan;
  }
  if (project.domain === "architecture" && intent && isWholeGenerationPrompt(text)) {
    const programPlan = intentToDesignActions(project, intent, input, variationSeed ?? project.architecture?.variationSeed);
    if (programPlan.actions.length) return { summary: programPlan.summary, actions: programPlan.actions, recommendations: programPlan.recommendations };
  }
  if (project.domain === "architecture") { const layout = requestedHouseRooms(text); if (layout) actions.push(layout); }
  if (project.domain === "architecture" && /(?:meuble|meubler|amenage|aménage|decore|décore|design interieur|design intérieur|rends.{0,25}(?:beau|elegant|élégant|chaleureux))/.test(text)) {
    const requestedRoom = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name)));
    const activeRoom = project.plan.rooms.find((candidate) => candidate.id === project.architecture?.activeRoomId);
    if (/toute la maison|toutes les pieces|toutes les pièces|maison entiere|maison entière/.test(text)) {
      for (const room of project.plan.rooms.filter((room) => !/garage|terrasse|hall/i.test(`${room.usage} ${room.name}`))) actions.push({ type: "furnish_room", room: room.name, style: project.preferences.style, density: briefDensity, replaceExisting: true, preferAssets: true });
    } else {
      const room = requestedRoom || activeRoom;
      if (room) actions.push({ type: "furnish_room", room: room.name, style: project.preferences.style, density: /luxe|tres haut de gamme|très haut de gamme|beaucoup plus de decoration|plus de decoration/.test(text) ? "luxury" : /complet|haut de gamme|premium|riche|detaille|détaillé/.test(text) ? "complete" : briefDensity, replaceExisting: true, preferAssets: true });
    }
  }
  if (/agrandis|agrandir|plus grand|elargis/.test(text)) {
    const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name)));
    if (room) actions.push({ type: "resize_room", room: room.name, scale: 1.15 });
  }
  if (/ajoute|creer|cree|ajouter/.test(text) && /cuisine/.test(text) && !project.plan.rooms.some((room) => norm(room.name).includes("cuisine"))) actions.push({ type: "add_room", name: "Cuisine", usage: "kitchen", width: 3.4, height: 3.2, style: text.includes("moderne") ? "moderne" : undefined });
  const addObjectPatterns: Array<[RegExp, string, DesignObject["category"]]> = [[/canape/, "Canapé", "furniture"], [/table/, "Table", "furniture"], [/lit\b/, "Lit", "furniture"], [/plante/, "Plante", "plant"], [/luminaire|suspension|lampe/, "Luminaire", "lighting"], [/ilot/, "Îlot", "kitchen"], [/escalier|marches?/, "Escalier", "stairs"]];
  if (!actions.some((action) => action.type === "furnish_room") && /ajoute|ajouter|place|mets/.test(text)) for (const [pattern, name, category] of addObjectPatterns) if (pattern.test(text)) { const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name))); actions.push({ type: "add_object", name, category, room: room?.name }); break; }
  if (project.domain === "architecture" && /(?:vide|vider|enleve tous|retire tous).{0,25}(?:meuble|mobilier|piece|pi[eè]ce|salon|chambre|cuisine)/.test(text)) {
    const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name))) || project.plan.rooms.find((candidate) => candidate.id === project.architecture?.activeRoomId);
    if (room) actions.push({ type: "clear_room", room: room.name, keepStructural: true });
  }
  if (project.domain === "architecture" && /(?:supprime|enleve|retire)/.test(text)) {
    const object = project.plan.objects.find((candidate) => text.includes(norm(candidate.name))); if (object) actions.push({ type: "remove_object", object: object.name });
  }
  if (project.domain === "architecture" && /(?:baie vitree|grande fenetre|fenetre panoramique)/.test(text) && /(?:ajoute|cree|mets|place)/.test(text)) {
    const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name))) || project.plan.rooms.find((candidate) => candidate.id === project.architecture?.activeRoomId);
    if (room) actions.push({ type: "add_opening", room: room.name, kind: "window", side: "south", width: 2.4, height: 1.5, sill: .65 });
  }
  if (/marbre/.test(text) && /parquet|sol|remplace|remplacer/.test(text)) { const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name))); actions.push({ type: "set_material", target: "floor", material: "Marbre clair", room: room?.name }); }
  if (!/marbre/.test(text) && /parquet|chene|bois/.test(text) && /sol|remplace|remplacer/.test(text)) { const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name))); actions.push({ type: "set_material", target: "floor", material: "Chêne naturel", room: room?.name }); }
  const color = input.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (color) { const room = project.plan.rooms.find((candidate) => text.includes(norm(candidate.name))); if (room) actions.push({ type: "set_room_color", room: room.name, color }); }
  if (/mobile/.test(text) && /interface|site|design|ui/.test(text)) actions.push({ type: "set_design_system", spacing: 12, radius: 16 });
  if (!actions.length) return null;
  return { summary: `SOPHENIC Design a interprété ${actions.length} modification(s) directement sur le projet.`, actions, recommendations: ["Vérifie le résultat dans les vues 2D/3D puis lance les simulations concernées."] };
}

export function sanitizeAiPlan(value: unknown): DesignAiPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const rawActions = Array.isArray(row.actions) ? row.actions : [];
  const allowed = new Set(["resize_room", "add_room", "add_object", "set_architecture_layout", "set_villa_program", "apply_architecture_program", "rebuild_room", "add_stairs_connection", "set_architecture_style", "set_architecture_ambience", "furnish_room", "optimize_room_layout", "rename_room", "clear_room", "remove_object", "move_object", "add_opening", "set_wall_height", "set_ceiling_height", "set_material", "set_room_color", "set_orientation", "add_variant", "add_digital_node", "set_design_system", "set_product_dimensions", "write_web_file", "note"]);
  const actions = rawActions.filter((entry): entry is DesignAiAction => Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && allowed.has(String((entry as Record<string, unknown>).type)))).slice(0, 24);
  return { summary: typeof row.summary === "string" ? row.summary.slice(0, 2000) : "Proposition SOPHENIC Design", actions, recommendations: Array.isArray(row.recommendations) ? row.recommendations.filter((item): item is string => typeof item === "string").slice(0, 10) : [] };
}
