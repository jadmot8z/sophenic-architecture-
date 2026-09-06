import { openingClearanceOk, syncArchitectureNavigation } from "./architecture";
import type { DesignObject, DesignProject, DesignRoom } from "./types";

export type FurnishDensity = "essential" | "balanced" | "complete" | "luxury";
export type InteriorCompositionReport = {
  roomId: string;
  roomName: string;
  added: string[];
  skipped: string[];
  clearanceViolations: string[];
  circulationScore: number;
};

type ItemSpec = {
  name: string;
  category: DesignObject["category"];
  width: number;
  depth: number;
  height: number;
  role: string;
  assetQuery: string;
  materialId?: string;
  color?: string;
  priority: number;
  clearance?: number;
  finishLevel?: "light" | "balanced" | "rich" | "luxury";
};

type Placement = { x: number; y: number; rotation: number };
type Side = "north" | "south" | "east" | "west";

const uid = (prefix = "interior") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function findRoom(project: DesignProject, name: string): DesignRoom | undefined {
  const target = norm(name);
  return project.plan.rooms.find((room) => norm(room.name).includes(target) || target.includes(norm(room.name)));
}

function sideOpenings(project: DesignProject, room: DesignRoom, side: Side): number {
  const epsilon = .1;
  return project.plan.openings.filter((opening) => {
    if ((opening.level || 0) !== (room.level || 0)) return false;
    if (side === "north") return Math.abs(opening.position.y - room.y) <= epsilon && opening.position.x >= room.x && opening.position.x <= room.x + room.width;
    if (side === "south") return Math.abs(opening.position.y - (room.y + room.height)) <= epsilon && opening.position.x >= room.x && opening.position.x <= room.x + room.width;
    if (side === "west") return Math.abs(opening.position.x - room.x) <= epsilon && opening.position.y >= room.y && opening.position.y <= room.y + room.height;
    return Math.abs(opening.position.x - (room.x + room.width)) <= epsilon && opening.position.y >= room.y && opening.position.y <= room.y + room.height;
  }).length;
}

function sideLength(room: DesignRoom, side: Side): number {
  return side === "north" || side === "south" ? room.width : room.height;
}

function bestAnchorSide(project: DesignProject, room: DesignRoom, minimumLength: number): Side {
  const sides: Side[] = ["north", "south", "west", "east"];
  return [...sides].sort((a, b) => {
    const score = (side: Side) => (sideLength(room, side) >= minimumLength ? 8 : -10) + sideLength(room, side) - sideOpenings(project, room, side) * 6;
    return score(b) - score(a);
  })[0];
}

function oppositeSide(side: Side): Side {
  return side === "north" ? "south" : side === "south" ? "north" : side === "west" ? "east" : "west";
}

function placedOnSide(room: DesignRoom, item: ItemSpec, side: Side, gap = .32, alongOffset = 0): Placement {
  const centerX = room.x + room.width / 2;
  const centerY = room.y + room.height / 2;
  if (side === "north") return { x: centerX - item.width / 2 + alongOffset, y: room.y + gap, rotation: Math.PI };
  if (side === "south") return { x: centerX - item.width / 2 + alongOffset, y: room.y + room.height - item.depth - gap, rotation: 0 };
  if (side === "west") return { x: room.x + gap, y: centerY - item.depth / 2 + alongOffset, rotation: -Math.PI / 2 };
  return { x: room.x + room.width - item.width - gap, y: centerY - item.depth / 2 + alongOffset, rotation: Math.PI / 2 };
}

function bounds(object: Pick<DesignObject, "x" | "y" | "width" | "depth">, gap = 0) {
  return { left: object.x - gap, right: object.x + object.width + gap, top: object.y - gap, bottom: object.y + object.depth + gap };
}

function overlapWithGap(a: Pick<DesignObject, "x" | "y" | "width" | "depth">, b: Pick<DesignObject, "x" | "y" | "width" | "depth">, gap: number): boolean {
  const A = bounds(a, gap / 2), B = bounds(b, gap / 2);
  return !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top);
}

function pairGap(a: DesignObject, b: DesignObject): number {
  const ar = String(a.metadata?.layoutRole || "");
  const br = String(b.metadata?.layoutRole || "");
  const explicit = Math.max(Number(a.metadata?.clearance || 0), Number(b.metadata?.clearance || 0));
  const pair = `${ar}:${br}`;
  if (/rug/.test(ar) || /rug/.test(br)) return 0;
  if (/bed:nightstand|nightstand:bed/.test(pair)) return .14;
  if (/dining-table:dining-chair|dining-chair:dining-table/.test(pair)) return .18;
  if (/sofa:coffee-table|coffee-table:sofa/.test(pair)) return .48;
  if (/coffee-table:armchair|armchair:coffee-table/.test(pair)) return .42;
  if (/desk:desk-chair|desk-chair:desk/.test(pair)) return .45;
  if (/pendant/.test(ar) || /pendant/.test(br)) return 0;
  if (/lamp|plant/.test(ar) || /lamp|plant/.test(br)) return Math.max(.3, explicit);
  return Math.max(.38, explicit);
}

function inside(room: DesignRoom, object: Pick<DesignObject, "x" | "y" | "width" | "depth">, margin = .18): boolean {
  return object.x >= room.x + margin && object.y >= room.y + margin && object.x + object.width <= room.x + room.width - margin && object.y + object.depth <= room.y + room.height - margin;
}

function canPlace(project: DesignProject, room: DesignRoom, object: DesignObject, others: DesignObject[]): boolean {
  if (!inside(room, object, .16)) return false;
  if (!openingClearanceOk(project, room, object, object.category === "lighting" || object.category === "plant" ? .34 : .66)) return false;
  if (object.metadata?.layoutRole === "rug" || object.metadata?.layoutRole === "pendant") return true;
  return !others.some((other) => !["rug", "pendant"].includes(String(other.metadata?.layoutRole || "")) && overlapWithGap(object, other, pairGap(object, other)));
}

function scoreCandidate(room: DesignRoom, object: DesignObject, x: number, y: number, role: string): number {
  const cx = x + object.width / 2, cy = y + object.depth / 2;
  const roomCx = room.x + room.width / 2, roomCy = room.y + room.height / 2;
  const centerDistance = Math.hypot(cx - roomCx, cy - roomCy);
  const wallDistance = Math.min(cx - room.x, room.x + room.width - cx, cy - room.y, room.y + room.height - cy);
  if (/sofa|bed|console|wardrobe|desk|vanity/.test(role)) return -wallDistance * 2.4 - centerDistance * .08;
  if (/coffee-table|dining-table|island|rug/.test(role)) return -centerDistance * 2.5;
  if (/plant|lamp/.test(role)) return -wallDistance * 1.8 - centerDistance * .12;
  return -centerDistance;
}

function fallbackPlacement(project: DesignProject, room: DesignRoom, object: DesignObject, others: DesignObject[]): Placement | null {
  const step = .16;
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = room.y + .18; y <= room.y + room.height - object.depth - .18; y += step) {
    for (let x = room.x + .18; x <= room.x + room.width - object.width - .18; x += step) {
      const candidate = { ...object, x, y };
      if (!canPlace(project, room, candidate, others)) continue;
      const score = scoreCandidate(room, candidate, x, y, String(object.metadata?.layoutRole || ""));
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best ? { x: best.x, y: best.y, rotation: object.rotation } : null;
}

function objectFromSpec(room: DesignRoom, spec: ItemSpec, placement: Placement): DesignObject {
  const defaultMaterial = spec.category === "plant" ? undefined
    : spec.category === "lighting" ? "mat-brass"
    : spec.category === "sanitary" ? "mat-ceramic"
    : spec.role === "rug" ? "mat-rug"
    : spec.role === "console" || spec.role === "wardrobe" || spec.role === "shelf" || spec.role === "desk" || spec.role === "nightstand" ? "mat-walnut"
    : "mat-fabric";
  return {
    id: uid("obj"), name: spec.name, category: spec.category,
    x: placement.x, y: placement.y, width: spec.width, depth: spec.depth, height: spec.height, rotation: placement.rotation,
    materialId: spec.materialId || defaultMaterial, color: spec.color,
    roomId: room.id, level: room.level || 0,
    metadata: {
      layoutRole: spec.role,
      layoutPriority: spec.priority,
      assetQuery: spec.assetQuery,
      clearance: spec.clearance ?? (spec.priority >= 90 ? .52 : spec.priority >= 70 ? .44 : .34),
      compositionEngine: "v7",
      visualQuality: spec.finishLevel === "luxury" ? "luxury" : "premium",
      finishLevel: spec.finishLevel || "balanced"
    }
  };
}

function paletteColor(project: DesignProject, index: number, fallback: string): string {
  const palette = project.architecture?.palette || [];
  return palette[index % Math.max(1, palette.length)] || fallback;
}

function livingSpecs(project: DesignProject, density: FurnishDensity): ItemSpec[] {
  const finish = density === "luxury" ? "luxury" : density === "complete" ? "rich" : density === "essential" ? "light" : "balanced";
  const specs: ItemSpec[] = [
    { name: "Canapé principal", category: "furniture", width: 2.45, depth: .96, height: .86, role: "sofa", assetQuery: "photorealistic PBR luxury contemporary sofa warm neutral premium interior", color: paletteColor(project, 1, "#cdbda9"), priority: 100, clearance: .58, finishLevel: finish },
    { name: "Table basse sculpturale", category: "furniture", width: 1.15, depth: .68, height: .4, role: "coffee-table", assetQuery: "photorealistic PBR travertine organic coffee table luxury interior", materialId: "mat-travertine", priority: 96, clearance: .52, finishLevel: finish },
    { name: "Meuble TV bas", category: "furniture", width: 1.9, depth: .42, height: .52, role: "console", assetQuery: "photorealistic PBR minimal walnut tv console luxury modern interior", materialId: "mat-walnut", priority: 91, clearance: .48, finishLevel: finish },
    { name: "Fauteuil gauche", category: "furniture", width: .84, depth: .86, height: .86, role: "armchair", assetQuery: "photorealistic PBR boucle lounge chair luxury contemporary beige", color: paletteColor(project, 2, "#a88c71"), priority: 84, clearance: .5, finishLevel: finish },
    { name: "Fauteuil droit", category: "furniture", width: .84, depth: .86, height: .86, role: "armchair", assetQuery: "photorealistic PBR boucle lounge chair luxury contemporary beige", color: paletteColor(project, 2, "#a88c71"), priority: 84, clearance: .5, finishLevel: finish }
  ];
  if (density !== "essential") specs.push(
    { name: "Lampadaire design", category: "lighting", width: .42, depth: .42, height: 1.68, role: "lamp", assetQuery: "photorealistic PBR designer floor lamp warm modern luxury", materialId: "mat-brass", priority: 67, clearance: .34, finishLevel: finish },
    { name: "Ficus sculptural", category: "plant", width: .6, depth: .6, height: 1.58, role: "plant", assetQuery: "photorealistic indoor ficus plant ceramic pot interior", priority: 58, clearance: .32, finishLevel: finish }
  );
  if (density === "complete" || density === "luxury") specs.push(
    { name: "Tapis salon grand format", category: "furniture", width: 2.85, depth: 2.0, height: .025, role: "rug", assetQuery: "photorealistic large wool rug neutral contemporary luxury", materialId: "mat-rug", color: "#d7cabc", priority: 42, finishLevel: finish },
    { name: "Bout de canapé", category: "furniture", width: .44, depth: .44, height: .52, role: "side-table", assetQuery: "photorealistic luxury side table travertine brass modern", materialId: "mat-travertine", priority: 52, clearance: .28, finishLevel: finish }
  );
  if (density === "luxury") specs.push(
    { name: "Console décorative", category: "furniture", width: 1.25, depth: .34, height: .76, role: "decor-console", assetQuery: "photorealistic luxury slim console table walnut brass interior", materialId: "mat-walnut", priority: 48, clearance: .34, finishLevel: finish },
    { name: "Plante d’accent", category: "plant", width: .46, depth: .46, height: 1.18, role: "plant", assetQuery: "photorealistic premium indoor plant designer pot", priority: 38, clearance: .28, finishLevel: finish }
  );
  return specs;
}
function diningSpecs(project: DesignProject, density: FurnishDensity): ItemSpec[] {
  const finish = density === "luxury" ? "luxury" : density === "complete" ? "rich" : density === "essential" ? "light" : "balanced";
  const specs: ItemSpec[] = [
    { name: "Table repas", category: "furniture", width: 1.95, depth: .92, height: .76, role: "dining-table", assetQuery: "photorealistic PBR walnut dining table contemporary luxury interior", materialId: "mat-walnut", priority: 100, clearance: .62, finishLevel: finish },
    { name: "Suspension repas", category: "lighting", width: .72, depth: .72, height: .5, role: "pendant", assetQuery: "photorealistic PBR sculptural pendant light dining luxury", materialId: "mat-brass", priority: 76, finishLevel: finish }
  ];
  const count = density === "essential" ? 4 : 6;
  for (let index = 0; index < count; index += 1) specs.push({ name: `Chaise repas ${index + 1}`, category: "furniture", width: .5, depth: .54, height: .86, role: "dining-chair", assetQuery: "photorealistic PBR upholstered dining chair modern neutral premium", color: paletteColor(project, 1, "#c4b29d"), priority: 82, clearance: .2, finishLevel: finish });
  if (density === "complete" || density === "luxury") specs.push(
    { name: "Buffet bas", category: "furniture", width: 1.65, depth: .42, height: .74, role: "decor-console", assetQuery: "photorealistic PBR walnut sideboard luxury dining room", materialId: "mat-walnut", priority: 62, clearance: .4, finishLevel: finish },
    { name: "Tapis salle à manger", category: "furniture", width: 2.7, depth: 1.9, height: .025, role: "rug", assetQuery: "photorealistic wool dining rug neutral luxury", materialId: "mat-rug", priority: 38, finishLevel: finish }
  );
  if (density === "luxury") specs.push({ name: "Plante salle à manger", category: "plant", width: .48, depth: .48, height: 1.25, role: "plant", assetQuery: "photorealistic indoor plant premium pot dining room", priority: 34, clearance: .28, finishLevel: finish });
  return specs;
}
function bedroomSpecs(project: DesignProject, density: FurnishDensity): ItemSpec[] {
  const finish = density === "luxury" ? "luxury" : density === "complete" ? "rich" : density === "essential" ? "light" : "balanced";
  const specs: ItemSpec[] = [
    { name: "Lit tapissé", category: "furniture", width: 1.8, depth: 2.1, height: 1.08, role: "bed", assetQuery: "photorealistic PBR luxury upholstered bed warm neutral premium bedroom", color: paletteColor(project, 1, "#c8b8a2"), priority: 100, clearance: .62, finishLevel: finish },
    { name: "Chevet gauche", category: "furniture", width: .48, depth: .42, height: .48, role: "nightstand", assetQuery: "photorealistic walnut bedside table modern luxury", materialId: "mat-walnut", priority: 84, clearance: .18, finishLevel: finish },
    { name: "Chevet droit", category: "furniture", width: .48, depth: .42, height: .48, role: "nightstand", assetQuery: "photorealistic walnut bedside table modern luxury", materialId: "mat-walnut", priority: 84, clearance: .18, finishLevel: finish },
    { name: "Penderie", category: "furniture", width: 1.7, depth: .58, height: 2.18, role: "wardrobe", assetQuery: "photorealistic PBR modern wardrobe walnut premium bedroom", materialId: "mat-walnut", priority: 79, clearance: .46, finishLevel: finish }
  ];
  if (density !== "essential") specs.push({ name: "Banquette de lit", category: "furniture", width: 1.32, depth: .48, height: .46, role: "bench", assetQuery: "photorealistic boucle bedroom bench luxury", color: paletteColor(project, 2, "#a8957b"), priority: 57, clearance: .34, finishLevel: finish });
  if (density === "complete" || density === "luxury") specs.push(
    { name: "Tapis chambre", category: "furniture", width: 2.35, depth: 1.65, height: .025, role: "rug", assetQuery: "photorealistic wool bedroom rug soft neutral luxury", materialId: "mat-rug", priority: 41, finishLevel: finish },
    { name: "Fauteuil chambre", category: "furniture", width: .78, depth: .82, height: .84, role: "armchair", assetQuery: "photorealistic lounge chair bedroom luxury neutral", color: paletteColor(project, 2, "#b09b82"), priority: 48, clearance: .42, finishLevel: finish }
  );
  if (density === "luxury") specs.push({ name: "Lampadaire chambre", category: "lighting", width: .38, depth: .38, height: 1.52, role: "lamp", assetQuery: "photorealistic designer floor lamp bedroom warm luxury", materialId: "mat-brass", priority: 36, clearance: .28, finishLevel: finish });
  return specs;
}
function kitchenSpecs(project: DesignProject, density: FurnishDensity): ItemSpec[] {
  const finish = density === "luxury" ? "luxury" : density === "complete" ? "rich" : density === "essential" ? "light" : "balanced";
  const specs: ItemSpec[] = [
    { name: "Îlot central", category: "kitchen", width: 2.05, depth: .92, height: .92, role: "island", assetQuery: "photorealistic PBR stone walnut kitchen island premium contemporary", materialId: "mat-travertine", priority: 100, clearance: .7, finishLevel: finish },
    { name: "Suspension cuisine", category: "lighting", width: .62, depth: .62, height: .5, role: "pendant", assetQuery: "photorealistic sculptural kitchen pendant light luxury", materialId: "mat-brass", priority: 74, finishLevel: finish }
  ];
  if (density !== "essential") {
    for (let index = 0; index < 3; index += 1) specs.push({ name: `Tabouret ${index + 1}`, category: "furniture", width: .46, depth: .5, height: .82, role: "bar-stool", assetQuery: "photorealistic PBR upholstered bar stool neutral luxury kitchen", color: paletteColor(project, 1, "#c8b8a2"), priority: 72, clearance: .2, finishLevel: finish });
  }
  if (density === "luxury") specs.push({ name: "Plante aromatique", category: "plant", width: .34, depth: .34, height: .55, role: "plant", assetQuery: "photorealistic indoor herb plant ceramic pot kitchen", priority: 28, clearance: .22, finishLevel: finish });
  return specs;
}
function officeSpecs(project: DesignProject, density: FurnishDensity): ItemSpec[] {
  const finish = density === "luxury" ? "luxury" : density === "complete" ? "rich" : "balanced";
  const specs: ItemSpec[] = [
    { name: "Bureau", category: "furniture", width: 1.55, depth: .7, height: .76, role: "desk", assetQuery: "minimal walnut executive desk modern", materialId: "mat-walnut", priority: 100 },
    { name: "Fauteuil de bureau", category: "furniture", width: .65, depth: .68, height: 1.05, role: "desk-chair", assetQuery: "premium office chair modern neutral", color: paletteColor(project, 1, "#b7aa98"), priority: 88 },
    { name: "Bibliothèque", category: "furniture", width: 1.4, depth: .36, height: 2.1, role: "shelf", assetQuery: "photorealistic modern walnut bookshelf premium", materialId: "mat-walnut", priority: 68, clearance: .4, finishLevel: finish }
  ];
  if (density === "complete" || density === "luxury") specs.push(
    { name: "Tapis bureau", category: "furniture", width: 1.9, depth: 1.35, height: .025, role: "rug", assetQuery: "photorealistic wool office rug neutral premium", materialId: "mat-rug", priority: 36, finishLevel: finish },
    { name: "Lampe de lecture", category: "lighting", width: .36, depth: .36, height: 1.35, role: "lamp", assetQuery: "photorealistic designer reading floor lamp office luxury", materialId: "mat-brass", priority: 34, clearance: .28, finishLevel: finish }
  );
  return specs;
}

function bathroomSpecs(project: DesignProject, density: FurnishDensity): ItemSpec[] {
  const finish = density === "luxury" ? "luxury" : density === "complete" ? "rich" : density === "essential" ? "light" : "balanced";
  const specs: ItemSpec[] = [
    { name: "Meuble vasque", category: "sanitary", width: 1.1, depth: .52, height: .86, role: "vanity", assetQuery: "photorealistic PBR modern bathroom vanity stone wood luxury", materialId: "mat-walnut", priority: 100, clearance: .5, finishLevel: finish },
    { name: "Douche", category: "sanitary", width: 1.0, depth: 1.0, height: 2.05, role: "shower", assetQuery: "photorealistic PBR walk in shower glass luxury bathroom", materialId: "mat-glass", priority: 90, clearance: .5, finishLevel: finish }
  ];
  if (density !== "essential") specs.push({ name: "WC", category: "sanitary", width: .42, depth: .68, height: .78, role: "toilet", assetQuery: "photorealistic modern wall hung toilet bathroom", materialId: "mat-ceramic", color: "#f2f0eb", priority: 85, clearance: .42, finishLevel: finish });
  if (density === "complete" || density === "luxury") specs.push({ name: "Banc salle de bain", category: "furniture", width: .82, depth: .34, height: .42, role: "bench", assetQuery: "photorealistic teak bathroom bench luxury spa", materialId: "mat-oak", priority: 36, clearance: .26, finishLevel: finish });
  if (density === "luxury") specs.push({ name: "Plante salle de bain", category: "plant", width: .4, depth: .4, height: .8, role: "plant", assetQuery: "photorealistic indoor plant bathroom ceramic pot", priority: 28, clearance: .22, finishLevel: finish });
  return specs;
}

function specsForRoom(project: DesignProject, room: DesignRoom, density: FurnishDensity): ItemSpec[] {
  const value = norm(`${room.usage} ${room.name}`);
  if (/living|salon|sejour/.test(value)) return livingSpecs(project, density);
  if (/dining|salle a manger/.test(value)) return diningSpecs(project, density);
  if (/bedroom|chambre|suite/.test(value)) return bedroomSpecs(project, density);
  if (/kitchen|cuisine/.test(value)) return kitchenSpecs(project, density);
  if (/office|bureau/.test(value)) return officeSpecs(project, density);
  if (/bath|salle de bain|salle d eau|wc/.test(value)) return bathroomSpecs(project, density);
  if (/hall|entree/.test(value)) return [
    { name: "Console d’entrée", category: "furniture", width: 1.2, depth: .36, height: .78, role: "decor-console", assetQuery: "photorealistic slim entry console walnut luxury modern", materialId: "mat-walnut", priority: 75, clearance: .34, finishLevel: density === "luxury" ? "luxury" : "balanced" },
    { name: "Plante d’entrée", category: "plant", width: .5, depth: .5, height: 1.25, role: "plant", assetQuery: "photorealistic indoor plant ceramic pot premium", priority: 50, clearance: .28, finishLevel: density === "luxury" ? "luxury" : "balanced" }
  ];
  return [];
}

function preferredPlacement(project: DesignProject, room: DesignRoom, spec: ItemSpec, placed: DesignObject[]): Placement | null {
  const role = spec.role;
  if (role === "sofa" || role === "bed" || role === "desk" || role === "vanity" || role === "wardrobe" || role === "shelf" || role === "console") {
    const side = bestAnchorSide(project, room, role === "sofa" ? spec.width + .8 : spec.width + .35);
    const candidate = objectFromSpec(room, spec, placedOnSide(room, spec, side, role === "sofa" ? .34 : .26));
    return canPlace(project, room, candidate, placed) ? { x: candidate.x, y: candidate.y, rotation: candidate.rotation } : null;
  }
  if (role === "coffee-table") {
    const sofa = placed.find((item) => item.metadata?.layoutRole === "sofa");
    if (sofa) {
      const x = sofa.x + sofa.width / 2 - spec.width / 2;
      const direction = Math.abs(sofa.rotation) < .1 ? -1 : Math.abs(Math.abs(sofa.rotation) - Math.PI) < .1 ? 1 : 0;
      const y = direction > 0 ? sofa.y + sofa.depth + .52 : direction < 0 ? sofa.y - spec.depth - .52 : room.y + room.height / 2 - spec.depth / 2;
      const candidate = objectFromSpec(room, spec, { x, y, rotation: 0 });
      if (canPlace(project, room, candidate, placed)) return { x, y, rotation: 0 };
    }
  }
  if (role === "dining-table" || role === "island" || role === "rug") {
    const x = room.x + room.width / 2 - spec.width / 2; const y = room.y + room.height / 2 - spec.depth / 2;
    const candidate = objectFromSpec(room, spec, { x, y, rotation: room.width >= room.height ? 0 : Math.PI / 2 });
    if (canPlace(project, room, candidate, placed)) return { x, y, rotation: candidate.rotation };
  }
  if (role === "nightstand") {
    const bed = placed.find((item) => item.metadata?.layoutRole === "bed");
    if (bed) {
      const gap = .18; const leftUsed = placed.some((item) => item.metadata?.layoutRole === "nightstand");
      const x = leftUsed ? bed.x + bed.width + gap : bed.x - spec.width - gap; const y = bed.y + .05;
      const candidate = objectFromSpec(room, spec, { x, y, rotation: bed.rotation });
      if (canPlace(project, room, candidate, placed)) return { x, y, rotation: bed.rotation };
    }
  }
  if (role === "bench") {
    const bed = placed.find((item) => item.metadata?.layoutRole === "bed");
    if (bed) {
      const x = bed.x + bed.width / 2 - spec.width / 2; const y = bed.y + bed.depth + .46;
      const candidate = objectFromSpec(room, spec, { x, y, rotation: bed.rotation });
      if (canPlace(project, room, candidate, placed)) return { x, y, rotation: bed.rotation };
    }
  }
  if (role === "armchair") {
    const table = placed.find((item) => item.metadata?.layoutRole === "coffee-table");
    if (table) {
      const existing = placed.filter((item) => item.metadata?.layoutRole === "armchair").length;
      const x = existing === 0 ? table.x - spec.width - .52 : table.x + table.width + .52; const y = table.y + table.depth / 2 - spec.depth / 2;
      const rotation = existing === 0 ? -Math.PI / 8 : Math.PI / 8;
      const candidate = objectFromSpec(room, spec, { x, y, rotation });
      if (canPlace(project, room, candidate, placed)) return { x, y, rotation };
    }
  }
  if (role === "dining-chair") {
    const table = placed.find((item) => item.metadata?.layoutRole === "dining-table");
    if (table) {
      const chairs = placed.filter((item) => item.metadata?.layoutRole === "dining-chair").length;
      const slots = [
        { x: table.x + .15, y: table.y - spec.depth - .24, r: 0 }, { x: table.x + table.width - spec.width - .15, y: table.y - spec.depth - .24, r: 0 },
        { x: table.x + .15, y: table.y + table.depth + .24, r: Math.PI }, { x: table.x + table.width - spec.width - .15, y: table.y + table.depth + .24, r: Math.PI },
        { x: table.x - spec.width - .24, y: table.y + table.depth / 2 - spec.depth / 2, r: Math.PI / 2 }, { x: table.x + table.width + .24, y: table.y + table.depth / 2 - spec.depth / 2, r: -Math.PI / 2 }
      ];
      const slot = slots[Math.min(chairs, slots.length - 1)]; const candidate = objectFromSpec(room, spec, { x: slot.x, y: slot.y, rotation: slot.r });
      if (canPlace(project, room, candidate, placed)) return { x: slot.x, y: slot.y, rotation: slot.r };
    }
  }
  if (role === "bar-stool") {
    const island = placed.find((item) => item.metadata?.layoutRole === "island");
    if (island) {
      const count = placed.filter((item) => item.metadata?.layoutRole === "bar-stool").length;
      const x = island.x + .18 + count * (spec.width + .18); const y = island.y + island.depth + .42;
      const candidate = objectFromSpec(room, spec, { x, y, rotation: Math.PI });
      if (canPlace(project, room, candidate, placed)) return { x, y, rotation: Math.PI };
    }
  }
  if (role === "side-table") {
    const sofa = placed.find((item) => item.metadata?.layoutRole === "sofa");
    if (sofa) {
      const candidates = [
        { x: sofa.x - spec.width - .28, y: sofa.y + sofa.depth * .42 - spec.depth / 2, rotation: sofa.rotation },
        { x: sofa.x + sofa.width + .28, y: sofa.y + sofa.depth * .42 - spec.depth / 2, rotation: sofa.rotation }
      ];
      for (const point of candidates) {
        const candidate = objectFromSpec(room, spec, point);
        if (canPlace(project, room, candidate, placed)) return point;
      }
    }
  }
  if (role === "pendant") {
    const host = placed.find((item) => ["dining-table", "island"].includes(String(item.metadata?.layoutRole || "")));
    const x = host ? host.x + host.width / 2 - spec.width / 2 : room.x + room.width / 2 - spec.width / 2;
    const y = host ? host.y + host.depth / 2 - spec.depth / 2 : room.y + room.height / 2 - spec.depth / 2;
    return { x, y, rotation: 0 };
  }
  if (role === "decor-console") {
    const side = bestAnchorSide(project, room, spec.width + .3);
    const candidate = objectFromSpec(room, spec, placedOnSide(room, spec, side, .24));
    if (canPlace(project, room, candidate, placed)) return { x: candidate.x, y: candidate.y, rotation: candidate.rotation };
  }
  if (role === "desk-chair") {
    const desk = placed.find((item) => item.metadata?.layoutRole === "desk");
    if (desk) {
      const x = desk.x + desk.width / 2 - spec.width / 2; const y = desk.y + desk.depth + .5;
      const candidate = objectFromSpec(room, spec, { x, y, rotation: Math.PI });
      if (canPlace(project, room, candidate, placed)) return { x, y, rotation: Math.PI };
    }
  }
  return null;
}

export function validateRoomClearances(project: DesignProject, room: DesignRoom): string[] {
  const objects = project.plan.objects.filter((object) => object.roomId === room.id && object.category !== "stairs");
  const issues: string[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (!inside(room, object, .12)) issues.push(`${object.name} dépasse des limites de ${room.name}.`);
    if (!openingClearanceOk(project, room, object, object.category === "plant" || object.category === "lighting" ? .3 : .62)) issues.push(`${object.name} gêne une ouverture.`);
    for (let otherIndex = index + 1; otherIndex < objects.length; otherIndex += 1) {
      const other = objects[otherIndex];
      if (["rug", "pendant"].includes(String(object.metadata?.layoutRole || "")) || ["rug", "pendant"].includes(String(other.metadata?.layoutRole || ""))) continue;
      if (overlapWithGap(object, other, pairGap(object, other))) issues.push(`${object.name} et ${other.name} sont trop proches.`);
    }
  }
  return issues;
}

export function composeInteriorRoom(source: DesignProject, roomName: string, options: { style?: string; density?: FurnishDensity; replaceExisting?: boolean } = {}): { project: DesignProject; report: InteriorCompositionReport } {
  const project = structuredClone(source);
  const room = findRoom(project, roomName);
  if (!room) return { project, report: { roomId: "", roomName, added: [], skipped: ["Pièce introuvable"], clearanceViolations: [], circulationScore: 0 } };
  const density = options.density || (project.architecture?.finishLevel === "luxury" ? "luxury" : project.architecture?.finishLevel === "rich" ? "complete" : "balanced");
  // V8.1 : les éléments structurels (colonnades monumentales) survivent au
  // réaménagement d'une pièce, comme les escaliers.
  if (options.replaceExisting !== false) project.plan.objects = project.plan.objects.filter((object) => object.roomId !== room.id || object.category === "stairs" || object.metadata?.structural === "column");
  const placed = project.plan.objects.filter((object) => object.roomId === room.id && object.category !== "stairs");
  const specs = specsForRoom(project, room, density);
  const added: string[] = []; const skipped: string[] = [];
  for (const spec of specs.sort((a, b) => b.priority - a.priority)) {
    let placement = preferredPlacement(project, room, spec, placed);
    const draft = objectFromSpec(room, spec, placement || { x: room.x + .2, y: room.y + .2, rotation: 0 });
    if (!placement) placement = fallbackPlacement(project, room, draft, placed);
    if (!placement) { skipped.push(`${spec.name} : espace insuffisant sans compromettre les dégagements.`); continue; }
    const object = objectFromSpec(room, spec, placement);
    if (!canPlace(project, room, object, placed)) { skipped.push(`${spec.name} : placement rejeté après contrôle.`); continue; }
    project.plan.objects.push(object); placed.push(object); added.push(spec.name);
  }
  // Give each room a subtle palette variation so a whole villa is not a grey box.
  const value = norm(`${room.usage} ${room.name}`);
  if (/living|salon|dining|salle a manger/.test(value)) room.color = paletteColor(project, 0, "#f2ebe1");
  else if (/bedroom|chambre|suite/.test(value)) room.color = paletteColor(project, 1, "#e9dfd3");
  else if (/kitchen|cuisine/.test(value)) room.color = "#eeeae2";
  else if (/office|bureau/.test(value)) room.color = paletteColor(project, 2, "#d8cabb");
  const clearanceViolations = validateRoomClearances(project, room);
  const area = Math.max(.1, room.width * room.height); const footprint = placed.filter((object) => !["rug", "pendant"].includes(String(object.metadata?.layoutRole || ""))).reduce((sum, object) => sum + object.width * object.depth, 0);
  const densityPenalty = Math.max(0, footprint / area - .34) * 120;
  const circulationScore = Math.max(0, Math.min(100, Math.round(100 - clearanceViolations.length * 12 - densityPenalty)));
  project.preferences.style = options.style || project.preferences.style;
  return { project: syncArchitectureNavigation(project), report: { roomId: room.id, roomName: room.name, added, skipped, clearanceViolations, circulationScore } };
}

export function optimizeInteriorRoomLayout(source: DesignProject, roomName: string): { project: DesignProject; report: InteriorCompositionReport } {
  const room = findRoom(source, roomName);
  if (!room) return { project: structuredClone(source), report: { roomId: "", roomName, added: [], skipped: ["Pièce introuvable"], clearanceViolations: [], circulationScore: 0 } };
  // Re-compose only when clearances are bad; otherwise preserve the user's composition.
  const currentIssues = validateRoomClearances(source, room);
  if (!currentIssues.length) {
    return { project: structuredClone(source), report: { roomId: room.id, roomName: room.name, added: [], skipped: [], clearanceViolations: [], circulationScore: 100 } };
  }
  return composeInteriorRoom(source, room.name, { style: source.preferences.style, density: source.architecture?.finishLevel === "luxury" ? "luxury" : source.architecture?.finishLevel === "rich" ? "complete" : "balanced", replaceExisting: true });
}

export function findClearPlacementForObject(project: DesignProject, room: DesignRoom, object: DesignObject): Placement | null {
  const cleanProject = structuredClone(project);
  cleanProject.plan.objects = cleanProject.plan.objects.filter((item) => item.id !== object.id);
  const others = cleanProject.plan.objects.filter((item) => item.roomId === room.id && item.category !== "stairs");
  return fallbackPlacement(cleanProject, room, object, others);
}

export function objectsTooCloseInRoom(project: DesignProject, room: DesignRoom): Array<[DesignObject, DesignObject]> {
  const objects = project.plan.objects.filter((object) => object.roomId === room.id && object.category !== "stairs" && !["rug", "pendant"].includes(String(object.metadata?.layoutRole || "")));
  const pairs: Array<[DesignObject, DesignObject]> = [];
  for (let i = 0; i < objects.length; i += 1) for (let j = i + 1; j < objects.length; j += 1) if (overlapWithGap(objects[i], objects[j], pairGap(objects[i], objects[j]))) pairs.push([objects[i], objects[j]]);
  return pairs;
}
