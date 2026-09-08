export type DesignDomain = "architecture" | "interior" | "web" | "uiux" | "product" | "webdesign";
// V8.3 — état du SOPHENIC WEB DESIGN ENGINE (blueprint, brief, templates).
export type { WebDesignState, WebDesignBlueprint, WebDesignBrief, WebDesignMode } from "./web-design/types";
export type DesignProjectKind = "web" | "architecture" | "object3d";
export type DesignUnit = "m" | "cm" | "mm" | "px";
export type DesignStage = "analysis" | "understanding" | "proposals" | "choice" | "generation" | "simulation" | "verification" | "optimization" | "final";
export type DesignTool = "select" | "wall" | "room" | "door" | "window" | "stairs" | "furniture" | "dimension" | "annotation" | "pan";
export type DesignStudio = "overview" | "architecture" | "plan" | "3d" | "interior" | "simulations" | "analysis" | "web" | "uiux" | "product" | "assets" | "versions";

export type DesignPoint = { x: number; y: number };
export type DesignWall = { id: string; start: DesignPoint; end: DesignPoint; thickness: number; height: number; materialId?: string; locked?: boolean; level?: number };
export type DesignOpening = { id: string; kind: "door" | "window"; wallId?: string; position: DesignPoint; width: number; height: number; sill?: number; rotation?: number; level?: number };
export type DesignNavigationNode = { id: string; roomId: string; label: string; x: number; y: number; eyeHeight: number; yaw: number; connections: string[] };
export type DesignRoom = { id: string; name: string; x: number; y: number; width: number; height: number; usage: string; floorMaterialId?: string; ceilingHeight?: number; color?: string; connections?: string[]; navigationNodes?: DesignNavigationNode[]; defaultNavigationNodeId?: string; level?: number };
export type DesignObject = {
  id: string;
  name: string;
  category: "furniture" | "lighting" | "kitchen" | "sanitary" | "plant" | "stairs" | "product" | "ui";
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  materialId?: string;
  color?: string;
  roomId?: string;
  asset?: { provider: "sketchfab" | "local" | "polyhaven"; sourceId: string; cacheId?: string; entryPath?: string; sourceUrl?: string; thumbnailUrl?: string; author?: string; license?: string; status: "ready" | "error" | "pending" };
  level?: number;
  metadata?: Record<string, string | number | boolean>;
};
export type DesignAnnotation = { id: string; kind: "note" | "dimension"; text: string; x: number; y: number; x2?: number; y2?: number };
export type DesignMaterialTexture = "wood" | "marble" | "travertine" | "concrete" | "plaster" | "fabric" | "metal" | "glass" | "stone" | "ceramic" | "rug" | "leather";
export type DesignMaterial = { id: string; name: string; category: "floor" | "wall" | "ceiling" | "surface" | "fabric" | "metal" | "glass"; color: string; roughness?: number; reflectivity?: number; thermalFactor?: number; texture?: DesignMaterialTexture; textureScale?: number; normalStrength?: number };
export type DesignAsset = { id: string; name: string; kind: "image" | "plan" | "document" | "reference" | "website"; mime?: string; size?: number; dataUrl?: string; sourceUrl?: string; extractedText?: string; createdAt: string };
export type DesignAssetSearchResult = { provider: "sketchfab"; sourceId: string; name: string; author?: string; license?: string; sourceUrl: string; thumbnailUrl?: string; downloadable: boolean; tags: string[]; likeCount?: number; viewCount?: number; vertexCount?: number; faceCount?: number; staffPicked?: boolean; publishedAt?: string };
export type DesignArchitectureLevel = { id: string; name: string; index: number; elevation: number; height: number };
export type DesignInteriorFinishLevel = "light" | "balanced" | "rich" | "luxury";
export type DesignReferenceKind = "inspiration" | "plan" | "facade" | "interior" | "material";
export type DesignReferenceAnalysis = {
  id: string;
  assetId: string;
  name: string;
  kind: DesignReferenceKind;
  summary: string;
  styleHints: string[];
  paletteHints: string[];
  materialHints: string[];
  furnitureHints: string[];
  roomHints: string[];
  ambience?: "day" | "evening" | "soft";
  luxuryLevel?: DesignInteriorFinishLevel;
  /** V8.1 — extraits structurés du modèle Vision (JSON) ; undefined si analyse heuristique. */
  lighting?: string;
  furnitureStyle?: string;
  proportions?: string;
  /** "vision-ai" quand le JSON structuré du modèle Vision a été parsé, "heuristic" sinon. */
  extraction?: "vision-ai" | "heuristic";
  createdAt: string;
};
export type DesignIntentArchetype = "palace" | "villa" | "house" | "interior" | "web" | "product";
export type DesignIntentSummary = {
  projectType: "house" | "villa" | "palace" | "interior" | "web" | "product";
  style: string;
  finishLevel: DesignInteriorFinishLevel;
  palette: string[];
  materials: string[];
  ambience: "day" | "evening" | "soft";
  goals: string[];
  constraints: string[];
  roomTargets: string[];
  referenceSummary: string[];
  sketchfabStrategy: "strict" | "hybrid";
  generatedAt: string;
  /* ---- V8.1 REAL AI : couche intermédiaire obligatoire enrichie ---- */
  /** Version du moteur d'intent ("8.1" pour le moteur REAL AI). */
  intentVersion?: "8" | "8.1";
  /** Comment l'intent a été produit : Brain/routing existant ou synthèse heuristique déterministe. */
  origin?: "brain" | "heuristic";
  /** Archétype structurel retenu (dérivé de projectType + signal du prompt/références). */
  archetype?: DesignIntentArchetype;
  /** Vocabulaire de mobilier, ex. "classique royal luxe" vs "minimaliste premium". */
  furnitureStyle?: string;
  /** Ambiance lumineuse cible décrite, ex. "warm indirect". */
  lighting?: string;
  /** Langage structurel, ex. "colonnades monumentales, marbre et dorures" vs "baies vitrées, bois/pierre/verre". */
  structuralLanguage?: string;
  /** 0-100 : monumentalité (hauteurs, volumes, symétrie). Pilier du Program Synthesis Engine. */
  monumentality?: number;
  /** Hauteur libre de mur (m) imposée par l'intent. */
  wallHeight?: number;
  /** Vocabulaire de requêtes d'assets 3D par type de meuble (Sketchfab), dérivé du style. */
  assetVocabulary?: Record<string, string[]>;
  /** Pièces demandées explicitement (parse du prompt), pré-prioritaires sur le programme par défaut. */
  requestedRooms?: Array<{ name: string; usage?: string }>;
  /** Résumé humain des références (affiché dans le panneau UI). */
  detectedStyleLabel?: string;
};
export type DesignArchitectureBrief = {
  sourceInstruction: string;
  style: string;
  ambience: "day" | "evening" | "soft";
  finishLevel: DesignInteriorFinishLevel;
  palette: string[];
  materials: string[];
  priorities: string[];
  constraints: string[];
  targetRooms: string[];
  autonomy: "guided" | "high";
  parsedAt: string;
};
export type DesignArchitectureState = {
  cameraMode: "exterior" | "interior";
  activeRoomId?: string;
  roomOrder: string[];
  activeLevel?: number;
  levels?: DesignArchitectureLevel[];
  autonomy?: "guided" | "high";
  style?: string;
  palette?: string[];
  lastAuditScore?: number;
  lastAuditAt?: string;
  ambience?: "day" | "evening" | "soft";
  renderQuality?: "balanced" | "high";
  finishLevel?: DesignInteriorFinishLevel;
  brief?: DesignArchitectureBrief;
  referenceAnalyses?: DesignReferenceAnalysis[];
  designIntent?: DesignIntentSummary;
  sketchfabStrategy?: "strict" | "hybrid";
  /* ---- V8.2 REAL REBUILD ---- */
  /** Dernier blueprint d'inspiration analysé (source de vérité des reconstructions). */
  roomBlueprint?: DesignRoomBlueprint;
  /** Manques d'assets Sketchfab enregistrés (jamais de fallback silencieux). */
  assetGaps?: DesignAssetGap[];
  /** Graine de variation : deux demandes identiques peuvent produire deux scènes différentes. */
  variationSeed?: number;
};

/** V8.2 — meuble détecté dans une image d'inspiration. */
export type DesignBlueprintFurnitureItem = { name: string; type?: string; count?: number; notes?: string };
/** V8.2 — ROOM_BLUEPRINT : compréhension structurée d'un espace par le moteur Vision. */
export type DesignRoomBlueprint = {
  id: string;
  /** Usage de la pièce, ex. "living_room" / "salon". */
  room: string;
  style: string;
  layout: {
    sofa?: string;
    coffeeTable?: string;
    chairs?: string;
    tvZone?: string;
    circulation?: string;
    freeZones?: string[];
  };
  architecture: {
    estimatedWidth?: number;
    estimatedDepth?: number;
    ceilingHeight?: number;
    openings?: Array<{ kind: "door" | "window"; side?: string; width?: number; height?: number }>;
  };
  materials: string[];
  palette: string[];
  furniture: DesignBlueprintFurnitureItem[];
  lighting?: string;
  luxuryLevel?: DesignInteriorFinishLevel;
  /** Identifiants des images (assets) ayant produit ce blueprint. */
  sourceImageIds: string[];
  /** "vision-ai" si le JSON du modèle Vision a été parsé, "derived" sinon, "brain" si enrichi par le Brain. */
  origin: "vision-ai" | "derived" | "brain";
  summary: string;
  createdAt: string;
};
/** V8.2 — manque d'asset Sketchfab enregistré (traçabilité, jamais silencieux). */
export type DesignAssetGap = {
  id: string;
  item: string;
  queries: string[];
  proposal: string;
  message: string;
  createdAt: string;
};

export type DesignDigitalNode = {
  id: string;
  kind: "navbar" | "hero" | "text" | "button" | "card" | "image" | "form" | "sidebar" | "chart" | "footer";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  background?: string;
  foreground?: string;
  radius?: number;
  animation?: "none" | "fade" | "slide" | "scale";
};
export type DesignDigitalSpec = {
  sourceUrl?: string;
  breakpoint: "desktop" | "tablet" | "mobile";
  canvasWidth: number;
  canvasHeight: number;
  designSystem: { primary: string; surface: string; text: string; radius: number; spacing: number; font: string };
  nodes: DesignDigitalNode[];
};

export type DesignWebFile = {
  path: string;
  kind: "text" | "asset";
  mime: string;
  size: number;
  content?: string;
  dataUrl?: string;
  modifiedAt: string;
};
export type DesignWebChange = {
  id: string;
  createdAt: string;
  prompt: string;
  summary: string;
  status: "applied" | "reverted";
  files: Array<{ path: string; before: string; after: string }>;
};
export type DesignWebWorkspace = {
  files: DesignWebFile[];
  entryPath: string;
  selectedPath: string;
  viewport: "desktop" | "tablet" | "mobile";
  sourceLabel?: string;
  selectedElement?: { selector: string; tag: string; text: string; id?: string; className?: string };
  changes: DesignWebChange[];
};

export type DesignProductSpec = {
  category: "object" | "furniture" | "packaging" | "industrial";
  width: number;
  depth: number;
  height: number;
  materialId?: string;
  ergonomicsNotes: string[];
};

export type DesignSimulationType = "daylight" | "shadows" | "interior-lighting" | "circulation" | "occupancy" | "visibility" | "energy";
export type DesignSimulationResult = {
  id: string;
  type: DesignSimulationType;
  label: string;
  score: number;
  createdAt: string;
  metrics: Array<{ label: string; value: string; status: "good" | "warning" | "risk" }>;
  recommendations: string[];
  disclaimer: string;
};

export type DesignVariant = { id: string; name: string; description: string; style: string; createdAt: string; score?: number };
export type DesignAiMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string; applied?: boolean };
export type DesignVersionSnapshot = {
  id: string;
  label: string;
  summary: string;
  createdAt: string;
  project: Omit<DesignProject, "versions" | "updatedAt">;
};

export type DesignProject = {
  schemaVersion: 1;
  id: string;
  name: string;
  domain: DesignDomain;
  description: string;
  unit: DesignUnit;
  stage: DesignStage;
  createdAt: string;
  updatedAt: string;
  revision: number;
  site: { width: number; depth: number; orientation: number; location?: string; climate?: string };
  architecture?: DesignArchitectureState;
  plan: {
    width: number;
    height: number;
    gridSize: number;
    wallHeight: number;
    walls: DesignWall[];
    openings: DesignOpening[];
    rooms: DesignRoom[];
    objects: DesignObject[];
    annotations: DesignAnnotation[];
  };
  materials: DesignMaterial[];
  assets: DesignAsset[];
  digital: DesignDigitalSpec;
  webWorkspace?: DesignWebWorkspace;
  /** V8.3 — SOPHENIC WEB DESIGN ENGINE : blueprint de design de site (aucun code applicatif). */
  webDesign?: import("./web-design/types").WebDesignState;
  model3d?: import("./model-3d/types").Model3DProjectState;
  product: DesignProductSpec;
  variants: DesignVariant[];
  simulations: DesignSimulationResult[];
  aiMessages: DesignAiMessage[];
  versions: DesignVersionSnapshot[];
  preferences: { style: string; budget?: string; constraints: string[]; accessibility: boolean; sustainability: boolean };
};

export type DesignArchitectureProgramSpec = {
  archetype: DesignIntentArchetype;
  style: string;
  palette: string[];
  materials: string[];
  /** Hauteur libre de mur (m). */
  wallHeight: number;
  /** Matériau de sol par usage de pièce (nom canonique). */
  floorMaterialByUsage?: Record<string, string>;
  wallColor: string;
  levels: Array<{ name?: string; rooms: Array<{ name: string; usage?: string; width?: number; depth?: number }> }>;
  stairs: Array<{ fromLevel: number; toLevel: number; room?: string; width?: number }>;
  /** Pièces de circulation qui reçoivent une colonnade monumentale (archetype palais). */
  colonnadeRooms: string[];
  openings: Array<{ room: string; kind: "door" | "window"; side: "north" | "south" | "east" | "west"; width: number; height: number; sill: number }>;
  furnishing: Array<{ room: string; density: "essential" | "balanced" | "complete" | "luxury" }>;
  summary: string;
};

export type DesignAiAction =
  | { type: "resize_room"; room: string; width?: number; height?: number; scale?: number }
  | { type: "add_room"; name: string; usage?: string; width?: number; height?: number; style?: string }
  | { type: "add_object"; name: string; category?: DesignObject["category"]; room?: string; width?: number; depth?: number; height?: number; color?: string; assetQuery?: string; asset?: DesignObject["asset"] }
  | { type: "set_architecture_layout"; rooms: Array<{ name: string; usage?: string; width?: number; depth?: number }> }
  | { type: "set_villa_program"; levels: Array<{ name?: string; rooms: Array<{ name: string; usage?: string; width?: number; depth?: number }> }>; style?: string; palette?: string[] }
  | { type: "apply_architecture_program"; program: DesignArchitectureProgramSpec }
  | { type: "rebuild_room"; room: string; blueprint?: DesignRoomBlueprint; style?: string; keepExisting?: never }
  | { type: "add_stairs_connection"; fromLevel: number; toLevel: number; room?: string; width?: number }
  | { type: "set_architecture_style"; style: string; palette?: string[]; floorMaterial?: string; wallColor?: string }
  | { type: "set_architecture_ambience"; ambience: "day" | "evening" | "soft" }
  | { type: "furnish_room"; room: string; style?: string; density?: "essential" | "balanced" | "complete" | "luxury"; replaceExisting?: boolean; preferAssets?: boolean }
  | { type: "optimize_room_layout"; room: string }
  | { type: "rename_room"; room: string; name: string }
  | { type: "clear_room"; room: string; keepStructural?: boolean }
  | { type: "remove_object"; object: string }
  | { type: "move_object"; object: string; room?: string; position?: "center" | "north" | "south" | "east" | "west"; rotationDegrees?: number }
  | { type: "add_opening"; room: string; kind: "door" | "window"; side?: "north" | "south" | "east" | "west"; width?: number; height?: number; sill?: number }
  | { type: "set_wall_height"; height: number }
  | { type: "set_ceiling_height"; room: string; height: number }
  | { type: "set_material"; target: "floor" | "walls" | "object" | "product"; material: string; room?: string; object?: string; color?: string }
  | { type: "set_room_color"; room: string; color: string }
  | { type: "set_orientation"; degrees: number }
  | { type: "add_variant"; name: string; description: string; style: string }
  | { type: "add_digital_node"; kind: DesignDigitalNode["kind"]; label: string; text?: string; animation?: DesignDigitalNode["animation"] }
  | { type: "set_design_system"; primary?: string; surface?: string; text?: string; radius?: number; spacing?: number }
  | { type: "set_product_dimensions"; width?: number; depth?: number; height?: number }
  | { type: "write_web_file"; path: string; content: string }
  | { type: "note"; text: string };

export type DesignAiPlan = { summary: string; actions: DesignAiAction[]; recommendations: string[] };
