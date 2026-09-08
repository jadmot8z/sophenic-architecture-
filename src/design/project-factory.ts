import type { DesignDomain, DesignMaterial, DesignProject } from "./types";
import { createDefaultArchitecture } from "./architecture";

const uid = (prefix = "d") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const materials = (): DesignMaterial[] => [
  { id: "mat-oak", name: "Chêne naturel", category: "floor", color: "#b88655", roughness: 0.66, reflectivity: 0.12, thermalFactor: 0.66, texture: "wood", textureScale: 2.8, normalStrength: 0.24 },
  { id: "mat-marble", name: "Marbre Calacatta clair", category: "surface", color: "#e7e2d9", roughness: 0.2, reflectivity: 0.7, thermalFactor: 0.42, texture: "marble", textureScale: 1.15, normalStrength: 0.08 },
  { id: "mat-wall", name: "Enduit minéral ivoire", category: "wall", color: "#f1eee7", roughness: 0.88, thermalFactor: 0.74, texture: "plaster", textureScale: 3.4, normalStrength: 0.18 },
  { id: "mat-glass", name: "Verre extra-clair", category: "glass", color: "#d6edf0", roughness: 0.06, reflectivity: 0.86, thermalFactor: 0.28, texture: "glass" },
  { id: "mat-black", name: "Métal noir satiné", category: "metal", color: "#252522", roughness: 0.3, reflectivity: 0.62, thermalFactor: 0.24, texture: "metal" },
  { id: "mat-fabric", name: "Bouclé sable", category: "fabric", color: "#cbbca8", roughness: 0.96, thermalFactor: 0.8, texture: "fabric", textureScale: 8, normalStrength: 0.34 },
  { id: "mat-walnut", name: "Noyer fumé", category: "surface", color: "#66452f", roughness: 0.6, reflectivity: 0.18, thermalFactor: 0.64, texture: "wood", textureScale: 2.4, normalStrength: 0.28 },
  { id: "mat-travertine", name: "Travertin ivoire", category: "surface", color: "#d7c4a2", roughness: 0.55, reflectivity: 0.26, thermalFactor: 0.48, texture: "travertine", textureScale: 1.8, normalStrength: 0.3 },
  { id: "mat-concrete", name: "Béton ciré chaud", category: "floor", color: "#aaa298", roughness: 0.78, reflectivity: 0.14, thermalFactor: 0.42, texture: "concrete", textureScale: 2.2, normalStrength: 0.2 },
  { id: "mat-brass", name: "Laiton brossé", category: "metal", color: "#a9844d", roughness: 0.28, reflectivity: 0.76, thermalFactor: 0.2, texture: "metal" },
  { id: "mat-olive", name: "Vert olive profond", category: "wall", color: "#4b5447", roughness: 0.86, thermalFactor: 0.72, texture: "plaster", textureScale: 3.2, normalStrength: 0.16 },
  { id: "mat-ceramic", name: "Céramique blanche mate", category: "surface", color: "#f2f0ea", roughness: 0.34, reflectivity: 0.36, thermalFactor: 0.38, texture: "ceramic", textureScale: 1.2, normalStrength: 0.06 },
  { id: "mat-rug", name: "Laine crème", category: "fabric", color: "#d8cdbf", roughness: 1, thermalFactor: 0.9, texture: "rug", textureScale: 10, normalStrength: 0.42 },
  { id: "mat-leather", name: "Cuir cognac", category: "fabric", color: "#8c5735", roughness: 0.5, reflectivity: 0.24, thermalFactor: 0.7, texture: "leather", textureScale: 4.5, normalStrength: 0.15 },
  { id: "mat-stone", name: "Pierre calcaire", category: "surface", color: "#c8bca9", roughness: 0.82, reflectivity: 0.12, thermalFactor: 0.45, texture: "stone", textureScale: 1.7, normalStrength: 0.34 },
  { id: "mat-linen", name: "Lin ivoire", category: "fabric", color: "#ded5c8", roughness: 0.98, thermalFactor: 0.86, texture: "fabric", textureScale: 11, normalStrength: 0.28 },
  { id: "mat-velvet", name: "Velours taupe", category: "fabric", color: "#8d8178", roughness: 0.86, reflectivity: 0.08, thermalFactor: 0.78, texture: "fabric", textureScale: 7.5, normalStrength: 0.22 },
  { id: "mat-smoked-glass", name: "Verre fumé bronze", category: "glass", color: "#756b62", roughness: 0.12, reflectivity: 0.8, thermalFactor: 0.26, texture: "glass" },
  { id: "mat-bronze", name: "Bronze patiné", category: "metal", color: "#77624a", roughness: 0.36, reflectivity: 0.68, thermalFactor: 0.2, texture: "metal" },
  { id: "mat-dark-stone", name: "Pierre brune veinée", category: "surface", color: "#665e55", roughness: 0.52, reflectivity: 0.28, thermalFactor: 0.44, texture: "stone", textureScale: 1.45, normalStrength: 0.28 }
];

function baseRooms() {
  return [
    { id: uid("room"), name: "Salon", usage: "living", x: 0.7, y: 0.7, width: 5.6, height: 4.2, floorMaterialId: "mat-oak", ceilingHeight: 2.7, color: "#f5efe4" },
    { id: uid("room"), name: "Cuisine", usage: "kitchen", x: 6.3, y: 0.7, width: 3.0, height: 4.2, floorMaterialId: "mat-marble", ceilingHeight: 2.7, color: "#eee9df" },
    { id: uid("room"), name: "Chambre", usage: "bedroom", x: 0.7, y: 4.9, width: 4.5, height: 3.7, floorMaterialId: "mat-oak", ceilingHeight: 2.7, color: "#eee7dc" },
    { id: uid("room"), name: "Bureau", usage: "office", x: 5.2, y: 4.9, width: 4.1, height: 3.7, floorMaterialId: "mat-oak", ceilingHeight: 2.7, color: "#ebe6dc" }
  ];
}

function wallsFromRooms(rooms: ReturnType<typeof baseRooms>, height: number) {
  const key = (a: number, b: number, c: number, d: number) => [a, b, c, d].map((n) => n.toFixed(2)).join(":");
  const seen = new Set<string>();
  const result: DesignProject["plan"]["walls"] = [];
  for (const room of rooms) {
    const candidates = [
      [room.x, room.y, room.x + room.width, room.y],
      [room.x + room.width, room.y, room.x + room.width, room.y + room.height],
      [room.x + room.width, room.y + room.height, room.x, room.y + room.height],
      [room.x, room.y + room.height, room.x, room.y]
    ];
    for (const [x1, y1, x2, y2] of candidates) {
      const forward = key(x1, y1, x2, y2);
      const reverse = key(x2, y2, x1, y1);
      if (seen.has(forward) || seen.has(reverse)) continue;
      seen.add(forward);
      result.push({ id: uid("wall"), start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.16, height, materialId: "mat-wall" });
    }
  }
  return result;
}

export function createDesignProject(name = "Nouveau projet", domain: DesignDomain = "architecture"): DesignProject {
  const now = new Date().toISOString();
  const rooms = baseRooms();
  const wallHeight = 2.7;
  const project: DesignProject = {
    schemaVersion: 1,
    id: uid("project"),
    name,
    domain,
    description: domain === "webdesign" ? "Design de site généré par SOPHENIC Web Design Engine (blueprint créatif avant code)." : domain === "web" || domain === "uiux" ? "Concept d’interface assisté par SOPHENIC Design." : domain === "product" ? "Concept produit paramétrique assisté par SOPHENIC Design." : "Projet spatial assisté par SOPHENIC Design.",
    unit: domain === "web" || domain === "uiux" || domain === "webdesign" ? "px" : "m",
    stage: "analysis",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    site: { width: 10, depth: 9.3, orientation: 180, climate: "tempéré" },
    plan: {
      width: 10,
      height: 9.3,
      gridSize: 0.5,
      wallHeight,
      walls: wallsFromRooms(rooms, wallHeight),
      openings: [
        { id: uid("open"), kind: "window", position: { x: 2.7, y: 0.7 }, width: 1.8, height: 1.35, sill: 0.9 },
        { id: uid("open"), kind: "window", position: { x: 7.5, y: 0.7 }, width: 1.4, height: 1.25, sill: 0.95 },
        { id: uid("open"), kind: "door", position: { x: 5.2, y: 6.6 }, width: 0.9, height: 2.1 }
      ],
      rooms,
      objects: [],
      annotations: []
    },
    materials: materials(),
    assets: [],
    digital: {
      breakpoint: "desktop",
      canvasWidth: 1440,
      canvasHeight: 980,
      designSystem: { primary: "#7c5c36", surface: "#fbf7ef", text: "#30281f", radius: 20, spacing: 16, font: "Inter / System" },
      nodes: [
        { id: uid("ui"), kind: "navbar", label: "Navigation", x: 40, y: 32, width: 1360, height: 72, text: "SOPHENIC · Produit · Solutions · Contact", background: "#ffffff", foreground: "#30281f", radius: 18, animation: "none" },
        { id: uid("ui"), kind: "hero", label: "Hero", x: 40, y: 124, width: 1360, height: 390, text: "Concevoir mieux. Plus vite. Avec l’IA.", background: "#efe4d2", foreground: "#30281f", radius: 28, animation: "fade" },
        { id: uid("ui"), kind: "card", label: "Feature 1", x: 40, y: 536, width: 430, height: 230, text: "Analyse intelligente", background: "#ffffff", foreground: "#30281f", radius: 22, animation: "slide" },
        { id: uid("ui"), kind: "card", label: "Feature 2", x: 505, y: 536, width: 430, height: 230, text: "Simulation", background: "#ffffff", foreground: "#30281f", radius: 22, animation: "slide" },
        { id: uid("ui"), kind: "card", label: "Feature 3", x: 970, y: 536, width: 430, height: 230, text: "Optimisation", background: "#ffffff", foreground: "#30281f", radius: 22, animation: "slide" }
      ]
    },
    webWorkspace: {
      files: [],
      entryPath: "",
      selectedPath: "",
      viewport: "desktop",
      changes: []
    },
    product: { category: "furniture", width: 1.8, depth: 0.78, height: 0.82, materialId: "mat-fabric", ergonomicsNotes: ["Rayons d’arêtes à vérifier", "Tester stabilité et assemblages", "Valider les dimensions avec un prototype physique"] },
    model3d: domain === "product" ? { library: [] } : undefined,
    variants: [],
    simulations: [],
    aiMessages: [],
    versions: [],
    preferences: { style: "contemporain", constraints: [], accessibility: true, sustainability: true }
  };
  if (domain === "architecture") {
    const architecture = createDefaultArchitecture(project);
    architecture.revision = 1;
    architecture.createdAt = now;
    architecture.updatedAt = now;
    return architecture;
  }
  return project;
}

export function resizeDesignSite(project: DesignProject, width: number, depth: number): DesignProject {
  const next = structuredClone(project);
  const targetWidth = Math.max(2, Math.min(500, Number.isFinite(width) ? width : next.plan.width));
  const targetDepth = Math.max(2, Math.min(500, Number.isFinite(depth) ? depth : next.plan.height));
  const scaleX = targetWidth / Math.max(.01, next.plan.width);
  const scaleY = targetDepth / Math.max(.01, next.plan.height);
  const linearScale = Math.max(.25, Math.min(4, Math.sqrt(scaleX * scaleY)));
  for (const room of next.plan.rooms) { room.x *= scaleX; room.y *= scaleY; room.width *= scaleX; room.height *= scaleY; for (const node of room.navigationNodes || []) { node.x *= scaleX; node.y *= scaleY; } }
  for (const wall of next.plan.walls) { wall.start.x *= scaleX; wall.start.y *= scaleY; wall.end.x *= scaleX; wall.end.y *= scaleY; wall.thickness = Math.max(.08, Math.min(.5, wall.thickness * linearScale)); }
  for (const opening of next.plan.openings) { opening.position.x *= scaleX; opening.position.y *= scaleY; opening.width = Math.max(.55, opening.width * linearScale); }
  for (const object of next.plan.objects) { object.x *= scaleX; object.y *= scaleY; object.width = Math.max(.15, object.width * scaleX); object.depth = Math.max(.15, object.depth * scaleY); }
  for (const annotation of next.plan.annotations) { annotation.x *= scaleX; annotation.y *= scaleY; if (annotation.x2 !== undefined) annotation.x2 *= scaleX; if (annotation.y2 !== undefined) annotation.y2 *= scaleY; }
  next.site.width = targetWidth; next.site.depth = targetDepth; next.plan.width = targetWidth; next.plan.height = targetDepth;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function cloneDesignProject(project: DesignProject, name = `${project.name} — variante`): DesignProject {
  const cloned = structuredClone(project);
  const now = new Date().toISOString();
  cloned.id = uid("project");
  cloned.name = name;
  cloned.createdAt = now;
  cloned.updatedAt = now;
  cloned.revision = 1;
  cloned.versions = [];
  return cloned;
}
