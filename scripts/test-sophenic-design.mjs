import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const tsModule = await import("typescript").catch(() => null);
const ts = tsModule?.default || tsModule;
const source = (file) => readFile(file, "utf8");
const assert = (value, message) => { if (!value) throw new Error(message); };

const designFiles = [
  "src/design/types.ts", "src/design/architecture.ts", "src/design/interior-brief.ts", "src/design/design-intent.ts", "src/design/intent-profiles.ts", "src/design/architect-program.ts", "src/design/asset-requirements.ts", "src/design/design-intent-ai.ts", "src/design/interior-composition.ts", "src/design/architecture-audit.ts", "src/design/architecture-quality.ts", "src/design/asset-selection.ts", "src/design/project-factory.ts", "src/design/simulations.ts", "src/design/commands.ts", "src/design/export.ts", "src/design/storage.ts", "src/design/ai.ts", "src/design/web-workspace.ts", "src/design/web-import.ts", "src/design/web-export.ts",
  "src/components/design/design-canvas-2d.tsx", "src/components/design/design-viewport-3d.tsx", "src/components/design/architecture-viewport-3d.tsx", "src/components/design/architecture-thinking-timeline.tsx", "src/components/design/design-web-preview.tsx", "src/components/design/design-workspace.tsx",
  "src/app/api/design/ai/route.ts", "src/app/api/design/site/route.ts", "src/app/api/design/vision/route.ts", "src/app/api/design/v8-intent/route.ts", "src/app/api/design/intent/route.ts", "src/app/(app)/design/page.tsx", "src/lib/public-web-page.ts",
  "electron/runtime/design-vision.ts", "electron/runtime/design-assets.ts", "electron/runtime/design-asset-engine.ts", "electron/runtime/code-engine/web-research.ts", "electron/runtime/workspace-data.ts", "electron/main.ts", "electron/preload.ts", "src/types/electron.d.ts",
  "src/components/agent/local-agent-workspace.tsx", "src/components/agent/workspace-pages.tsx", "src/components/app-shell.tsx"
];

// Parse only: unlike transpileModule(), this also works for type-only files on Node 24/TS 5.x.
for (const file of designFiles) {
  const code = await source(file);
  assert(code.trim().length > 0, `Fichier Design vide: ${file}`);
  if (!ts?.createSourceFile) continue;
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
  const errors = (parsed.parseDiagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Erreur de syntaxe TypeScript dans ${file}: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join(" | ")}`);
}

const types = await source("src/design/types.ts");
const architecture = await source("src/design/architecture.ts");
const interiorBrief = await source("src/design/interior-brief.ts");
const designIntent = await source("src/design/design-intent.ts");
const interiorComposition = await source("src/design/interior-composition.ts");
const architectureAudit = await source("src/design/architecture-audit.ts");
const architectureQuality = await source("src/design/architecture-quality.ts");
const architectureTimeline = await source("src/components/design/architecture-thinking-timeline.tsx");
const factory = await source("src/design/project-factory.ts");
const commands = await source("src/design/commands.ts");
const simulations = await source("src/design/simulations.ts");
const workspace = await source("src/components/design/design-workspace.tsx");
const architectureViewport = await source("src/components/design/architecture-viewport-3d.tsx");
const canvas2d = await source("src/components/design/design-canvas-2d.tsx");
const webPreview = await source("src/components/design/design-web-preview.tsx");
const webWorkspace = await source("src/design/web-workspace.ts");
const webImport = await source("src/design/web-import.ts");
const webExport = await source("src/design/web-export.ts");
const ai = await source("src/design/ai.ts");
const main = await source("electron/main.ts");
const preload = await source("electron/preload.ts");
const assetRuntime = await source("electron/runtime/design-assets.ts");
const assetEngine = await source("electron/runtime/design-asset-engine.ts");
const settings = await source("src/components/agent/workspace-pages.tsx");
const workspaceData = await source("electron/runtime/workspace-data.ts");
const desktopShell = await source("src/components/agent/local-agent-workspace.tsx");
const webShell = await source("src/components/app-shell.tsx");

for (const expected of ["architecture", "web", "product", "analysis", "generation", "simulation", "optimization", "final"]) assert(types.includes(`"${expected}"`), `Type/étape Design manquant: ${expected}`);
for (const expected of ["wall", "door", "window", "stairs", "dimension", "annotation"]) assert(types.includes(`"${expected}"`), `Outil plan 2D manquant: ${expected}`);
assert(types.includes("DesignNavigationNode") && types.includes("DesignArchitectureState") && types.includes("roomOrder") && types.includes("DesignArchitectureLevel") && types.includes("activeLevel"), "Types Architecture V7 incomplets.");
assert(types.includes('type: "furnish_room"') && types.includes('type: "optimize_room_layout"'), "Actions de composition intérieure V7 absentes.");
assert(types.includes("DesignArchitectureBrief") && types.includes("DesignInteriorFinishLevel") && types.includes('"luxury"'), "Types de brief/finitions V7 absents.");
assert(types.includes("DesignReferenceAnalysis") && types.includes("DesignIntentSummary") && types.includes("referenceAnalyses") && types.includes("designIntent"), "Types Intent V8 / références visuelles absents.");
assert(interiorBrief.includes("parseArchitectureBrief") && interiorBrief.includes("applyArchitectureBrief") && interiorBrief.includes("architectureBriefSummary"), "Intent Design Parser V7 absent.");
assert(designIntent.includes("buildArchitectureIntent") && designIntent.includes("analyzeReferenceText") && designIntent.includes("designIntentSummary"), "Moteur Intent V8 absent.");
assert(interiorBrief.includes("finishLevel") && interiorBrief.includes("materials") && interiorBrief.includes("constraints"), "Extraction du brief utilisateur V7 incomplète.");
assert(types.includes('provider: "sketchfab"') && types.includes("sourceId") && types.includes("license"), "Métadonnées Asset Engine absentes du modèle Design.");
assert(factory.includes("createDefaultArchitecture") && factory.includes("objects: []"), "La factory Architecture ne démarre pas explicitement sans mobilier.");
assert(architecture.includes("navigationNodesForRoom") && architecture.includes("rebuildArchitectureStructure") && architecture.includes("findSmartPlacementInRoom") && architecture.includes("buildVillaProgram") && architecture.includes("roomElevation"), "Noyau géométrique/navigation Architecture V4 incomplet.");
assert(commands.includes('action.type === "set_architecture_layout"') && commands.includes('action.type === "set_villa_program"') && commands.includes('action.type === "add_stairs_connection"') && commands.includes('action.type === "set_architecture_style"') && commands.includes("rebuildArchitectureStructure"), "Actions structurelles Architecture V4 absentes.");
assert(commands.includes('action.type === "clear_room"') && commands.includes('action.type === "move_object"') && commands.includes('action.type === "add_opening"'), "Actions architecte avancées absentes.");
assert(architectureAudit.includes("analyzeArchitecture") && architectureAudit.includes("furnitureCoverage") && architectureAudit.includes("blockedOpeningCount") && architectureAudit.includes("priorities"), "Audit architectural contextuel V4 absent.");
assert(architectureQuality.includes("runArchitectureQualityPass") && architectureQuality.includes("Escalier ajouté") && architectureQuality.includes("openingClearanceOk"), "Passe de vérification/auto-correction Architecture V7 absente.");
assert(interiorComposition.includes("composeInteriorRoom") && interiorComposition.includes("validateRoomClearances") && interiorComposition.includes("pairGap") && interiorComposition.includes('compositionEngine: "v7"') && interiorComposition.includes('"luxury"'), "Interior Composition Engine V7 absent ou incomplet.");
assert(commands.includes('[/escalier|marches?/, "Escalier", "stairs"]'), "Commande IA directe pour escalier absente.");
assert(canvas2d.includes('tool === "stairs"') && canvas2d.includes('object.category === "stairs"'), "Édition/visualisation 2D des escaliers absente.");

// Runtime architectural viewer: exterior orbit + interior constrained by room navigation nodes.
assert(architectureViewport.includes("OrbitControls") && architectureViewport.includes('mode === "exterior"') && architectureViewport.includes("enablePan = false"), "Mode extérieur orbital contraint absent.");
assert(architectureViewport.includes('mode === "interior"') && architectureViewport.includes("navigationNodes") && architectureViewport.includes("moveNode") && architectureViewport.includes("switchRoom"), "Navigation intérieure contrôlée/pièce par pièce absente.");
assert(architectureViewport.includes("ArrowUp") && architectureViewport.includes("ArrowDown") && architectureViewport.includes("ArrowLeft") && architectureViewport.includes("ArrowRight"), "Flèches de navigation intérieure absentes.");
assert(architectureViewport.includes("setPointerCapture") && architectureViewport.includes("pointermove") && architectureViewport.includes("goToRoom") && architectureViewport.includes("Changer de pièce"), "Rotation caméra par clic-glisser ou sélecteur de pièce permanent absent.");
assert(architectureViewport.includes("camera.rotation.set(Math.max(-1.08") && architectureViewport.includes("roomElevation") && architectureViewport.includes("ÉTAGE"), "Caméra intérieure horizontale/multi-étage V7 absente.");
assert(architectureViewport.includes("materialMaps") && architectureViewport.includes("canapé") && architectureViewport.includes("PointLight"), "Rendu matériaux/mobilier procédural détaillé V7 absent.");
assert(architectureViewport.includes("RoomEnvironment") && architectureViewport.includes("EffectComposer") && architectureViewport.includes("SSAOPass") && architectureViewport.includes("MeshPhysicalMaterial"), "Pipeline de rendu PBR/post-traitement Architecture V7 absent.");
assert(architectureViewport.includes("RoundedBoxGeometry") && architectureViewport.includes("createRoomStyling") && architectureViewport.includes("sophenicCeilingRoomId") && architectureViewport.includes("camera.fov = 62"), "Qualité visuelle/caméra intérieure V7 incomplète.");
assert(types.includes("DesignMaterialTexture") && types.includes('renderQuality?: "balanced" | "high"') && types.includes('ambience?: "day" | "evening" | "soft"'), "Types de rendu Architecture V7 absents.");
assert(factory.includes('texture: "wood"') && factory.includes('texture: "marble"') && factory.includes('texture: "fabric"') && factory.includes('texture: "travertine"') && factory.includes("Lin ivoire") && factory.includes("Verre fumé bronze"), "Bibliothèque matériaux PBR V7 incomplète.");
assert(workspace.includes('ambienceModes') && workspace.includes('Ambiance') && workspace.includes('onAmbience'), "Contrôle Jour/Doux/Soir Architecture V7 absent.");
assert(architectureViewport.includes("GLTFLoader") && architectureViewport.includes("DRACOLoader") && architectureViewport.includes("MeshoptDecoder") && architectureViewport.includes("assetBundle"), "Chargement réel GLTF/GLB/Draco/Meshopt absent.");
assert(!workspace.includes("icon: Stairs") && !workspace.includes(" Stairs,"), "Régression lucide-react: Stairs est encore utilisé.");
assert(workspace.includes("Footprints") && workspace.includes("ArchitectureObjectControls"), "Contrôles Architecture/escaliers corrigés absents.");
assert(workspace.includes("selectBestDesignAsset") && workspace.includes("Recherche Sketchfab") && workspace.includes("Licence"), "Workflow mobilier Sketchfab/licence incomplet.");
assert(architectureViewport.includes("mat-velvet") && architectureViewport.includes("mat-linen") && architectureViewport.includes("bout de canapé") && architectureViewport.includes("suspension"), "Décoration/material fallback V7 incomplète.");
assert(workspace.includes("setArchitectureRoom") && workspace.includes("CONTEXTE VISUEL") && workspace.includes("Références") && workspace.includes("designIntentSummary"), "Pièce active / références visuelles non transmises au contexte Sophenic.");
assert(workspace.includes("ArchitectureThinkingTimeline") && workspace.includes("Comprendre la demande utilisateur") && workspace.includes("Construire le brief de design") && workspace.includes("Vérifier et optimiser le résultat"), "Timeline de réflexion/exécution Architecture V7 absente.");
assert(architectureTimeline.includes("animate-spin") && architectureTimeline.includes("bg-emerald-500") && architectureTimeline.includes("RÉFLÉCHIT · PLAN D’ACTION"), "États visuels ronds/liaisons/spinner de la timeline absents.");

// Secure provider abstraction.
assert(assetEngine.includes("class DesignAssetEngine") && assetEngine.includes("providers") && assetEngine.includes("SketchfabProvider"), "SOPHENIC Asset Engine/provider abstraction absente.");
for (const method of ["searchAssets", "getAssetDetails", "resolveDownloadableAsset", "downloadAsset", "cacheAsset"]) assert(assetRuntime.includes(method), `SketchfabProvider incomplet: ${method}`);
assert(assetRuntime.includes("readConnectorSecret") && assetRuntime.includes("writeConnectorSecret") && assetRuntime.includes("Licence Sketchfab indisponible"), "Stockage secret/licence Sketchfab insuffisant.");
assert(!preload.includes("readSketchfabToken") && !types.includes("sketchfabToken"), "Le token Sketchfab ne doit jamais être relu par le renderer/projet.");
assert(settings.includes("3D Assets · Sketchfab") && settings.includes('type="password"') && settings.includes("Enregistrer & tester"), "Paramètres Sketchfab absents.");
assert(main.includes("sophenic:design:asset-search") && main.includes("sophenic:design:asset-cache") && main.includes("assertTrustedFrame"), "IPC Asset Engine sécurisé incomplet.");
assert(preload.includes("searchAssets") && preload.includes("cacheAsset") && preload.includes("assetBundle"), "Bridge preload Asset Engine incomplet.");

for (const sim of ["daylight", "shadows", "interior-lighting", "circulation", "occupancy", "visibility", "energy"]) assert(simulations.includes(`"${sim}"`), `Simulation manquante: ${sim}`);
assert(simulations.includes("ne remplace pas") && simulations.includes("professionnel qualifié"), "Avertissement professionnel des simulations absent.");
assert(ai.includes('provider: "sophenic"') && ai.includes('model: "auto"') && ai.includes("set_villa_program") && ai.includes("add_stairs_connection") && ai.includes("set_architecture_style") && ai.includes("assetQuery") && ai.includes("architectureAudit") && ai.includes("designIntent"), "SOPHENIC Brain Architecture V8 incomplet.");

// Keep the approved three-project UX and Web/Product modules.
assert(workspace.includes("function DesignHome") && workspace.includes("Créer un projet"), "Page d’entrée Design minimaliste absente.");
for (const label of ["Design Web", "Architecture", "Design 3D"]) assert(workspace.includes(label), `Choix de projet manquant: ${label}`);
assert(workspace.includes("<DesignWebPreview") && workspace.includes("<DesignCanvas2D") && workspace.includes("<DesignViewport3D") && workspace.includes("<ArchitectureViewport3D") && workspace.includes("<SophenicPanel"), "Canvas principaux/chat Design non reliés.");
assert(webPreview.includes("<iframe") && webPreview.includes("srcDoc") && webPreview.includes("sandbox="), "Preview Web live/sandbox absente.");
assert(webWorkspace.includes("buildWebPreview") && webWorkspace.includes("sophenic-design-preview"), "Reconstruction réelle du site Web incomplète.");
assert(webImport.includes("extractWebZip") && webImport.includes("DecompressionStream"), "Import ZIP/dossier Web incomplet.");
assert(webExport.includes("buildWebProjectZip") && webExport.includes("0x04034b50"), "Export ZIP Web absent.");
assert(workspace.includes("createVersion") && workspace.includes("undoStack") && workspace.includes("saveDesignProject"), "Autosave/versioning/undo Design incomplets.");
assert(workspaceData.includes("design-projects.json") && workspaceData.includes("saveDesignProject"), "Persistence projets Design absente.");
assert(desktopShell.includes('"design"') && desktopShell.includes("<DesignWorkspace"), "SOPHENIC Design n'est pas intégré au shell Desktop.");
assert(webShell.includes("/design") && webShell.includes("SOPHENIC Design"), "Navigation Web vers SOPHENIC Design absente.");

// Compile the pure Design core with tsc, then execute behavioral tests. This replaces
// transpileModule() which triggered a TypeScript internal Debug Failure on Node 24.
if (ts) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sophenic-design-tests-"));
  try {
    const outDir = path.join(temp, "out");
    const files = ["types.ts", "architecture.ts", "interior-brief.ts", "design-intent.ts", "intent-profiles.ts", "architect-program.ts", "asset-requirements.ts", "interior-composition.ts", "architecture-audit.ts", "architecture-quality.ts", "asset-selection.ts", "project-factory.ts", "web-workspace.ts", "commands.ts", "simulations.ts"].map((name) => path.resolve("src/design", name));
    const config = {
      compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", lib: ["ES2022", "DOM"], strict: true, esModuleInterop: true, skipLibCheck: true, outDir, rootDir: path.resolve("src/design") },
      files
    };
    const configPath = path.join(temp, "tsconfig.json"); await writeFile(configPath, JSON.stringify(config), "utf8");
    const tscPath = require.resolve("typescript/lib/tsc.js");
    const compiled = spawnSync(process.execPath, [tscPath, "-p", configPath], { encoding: "utf8" });
    assert(compiled.status === 0, `Compilation stricte du noyau Design échouée: ${(compiled.stderr || compiled.stdout || "").trim()}`);

    const factoryRuntime = require(path.join(outDir, "project-factory.js"));
    const intentRuntime = require(path.join(outDir, "design-intent.js"));
    const commandRuntime = require(path.join(outDir, "commands.js"));
    const simulationRuntime = require(path.join(outDir, "simulations.js"));
    const selectionRuntime = require(path.join(outDir, "asset-selection.js"));
    const briefRuntime = require(path.join(outDir, "interior-brief.js"));
    const interiorRuntime = require(path.join(outDir, "interior-composition.js"));
    const auditRuntime = require(path.join(outDir, "architecture-audit.js"));
    const qualityRuntime = require(path.join(outDir, "architecture-quality.js"));

    let project = factoryRuntime.createDesignProject("Test Architecture V2", "architecture");
    assert(project.plan.objects.length === 0, "TEST 1: une maison neuve doit contenir exactement 0 meuble.");
    assert(project.plan.rooms.length >= 4 && project.plan.rooms.every((room) => room.name && !/^pi[eè]ce\s+\d+$/i.test(room.name)), "TEST 2: les pièces doivent avoir des noms métier.");
    assert(project.architecture?.roomOrder.length === project.plan.rooms.length, "TEST 3: ordre de navigation des pièces absent.");
    assert(project.plan.rooms.every((room) => room.navigationNodes?.length >= 1 && room.navigationNodes.every((node) => node.x >= room.x && node.x <= room.x + room.width && node.y >= room.y && node.y <= room.y + room.height)), "TEST 4/5: points caméra invalides.");

    const housePlan = commandRuntime.fastDesignCommand(project, "Crée une maison moderne avec un salon, une cuisine, trois chambres et deux salles de bain.");
    assert(housePlan?.actions.some((action) => action.type === "set_architecture_layout" || action.type === "apply_architecture_program"), "TEST 6: la création de maison n'est pas routée vers un layout structurel.");
    project = commandRuntime.applyDesignActions(project, housePlan.actions);
    assert(project.plan.objects.length === 0, "Une génération de maison ne doit pas ajouter de mobilier.");
    assert(project.plan.rooms.filter((room) => /chambre/i.test(room.name)).length === 3, "Trois chambres attendues.");
    assert(project.plan.rooms.filter((room) => /salle de bain/i.test(room.name)).length === 2, "Deux salles de bain attendues.");
    const orderNames = project.architecture.roomOrder.map((id) => project.plan.rooms.find((room) => room.id === id)?.name).filter(Boolean);
    assert(orderNames[0] === "Salon" && orderNames.includes("Cuisine") && orderNames.includes("Chambre 1"), "Navigation Salon → Cuisine → Chambre non structurée.");

    // Mock Sketchfab search ranking: an unknown-license hit must never win.
    const mockAssets = [
      { provider: "sketchfab", sourceId: "bad", name: "Modern sofa premium", sourceUrl: "https://sketchfab.com/models/bad", downloadable: true, tags: ["sofa"], license: "" },
      { provider: "sketchfab", sourceId: "lowpoly", name: "Low poly cartoon sofa", sourceUrl: "https://sketchfab.com/models/lowpoly", downloadable: true, tags: ["low poly", "cartoon", "sofa"], license: "CC Attribution", author: "Low Poly Artist", likeCount: 800 },
      { provider: "sketchfab", sourceId: "good", name: "Photorealistic PBR luxury modern sofa", sourceUrl: "https://sketchfab.com/models/good", downloadable: true, tags: ["photorealistic", "pbr", "modern", "sofa", "interior"], license: "CC Attribution", author: "Test Artist", likeCount: 140, viewCount: 4200, staffPicked: true }
    ];
    assert(selectionRuntime.selectBestDesignAsset(mockAssets, "photorealistic PBR modern sofa")?.sourceId === "good", "TEST 9/V7: sélection Sketchfab réaliste/licence incorrecte.");

    const salon = project.plan.rooms.find((room) => room.name === "Salon");
    project = commandRuntime.applyDesignActions(project, [{ type: "add_object", name: "Canapé", category: "furniture", room: "Salon", width: 1.8, depth: .8, height: .85, asset: { provider: "sketchfab", sourceId: "good", cacheId: "good", entryPath: "scene.gltf", sourceUrl: "https://sketchfab.com/models/good", author: "Test Artist", license: "CC Attribution", status: "ready" } }]);
    const sofa = project.plan.objects.find((object) => object.name === "Canapé");
    assert(sofa && sofa.roomId === salon?.id && sofa.asset?.license === "CC Attribution", "TEST 12: placement/metadata d'asset dans la pièce invalide.");
    assert(sofa.x >= salon.x && sofa.x + sofa.width <= salon.x + salon.width && sofa.y >= salon.y && sofa.y + sofa.depth <= salon.y + salon.height, "TEST 12: l'objet dépasse de la pièce.");

    project = commandRuntime.applyDesignActions(project, [{ type: "add_opening", room: "Salon", kind: "window", side: "south", width: 2.2, height: 1.4, sill: .7 }]);
    assert(project.plan.openings.some((opening) => opening.kind === "window" && opening.width >= 2), "Ajout de baie/fenêtre architecte invalide.");
    project = commandRuntime.applyDesignActions(project, [{ type: "move_object", object: "Canapé", room: "Salon", position: "west", rotationDegrees: 90 }]);
    assert(Math.abs((project.plan.objects.find((object) => object.name === "Canapé")?.rotation || 0) - Math.PI / 2) < .001, "Déplacement/rotation mobilier IA invalide.");
    const audit = auditRuntime.analyzeArchitecture(project);
    assert(audit.roomCount === project.plan.rooms.length && audit.score >= 0 && audit.score <= 100, "Audit architectural invalide.");

    const resized = commandRuntime.applyDesignActions(project, [{ type: "resize_room", room: "Salon", scale: 1.08 }]);
    const resizedSalon = resized.plan.rooms.find((room) => room.name === "Salon");
    assert(resizedSalon?.navigationNodes.every((node) => node.x >= resizedSalon.x && node.x <= resizedSalon.x + resizedSalon.width), "Navigation non recalculée après modification géométrique.");
    assert(resized.plan.walls.length > 0 && resized.plan.openings.every((opening) => !opening.wallId || resized.plan.walls.some((wall) => wall.id === opening.wallId)), "Murs/ouvertures non reconstruits après modification.");

    const v7Prompt = "Transforme cette maison actuelle en une villa contemporaine très haut de gamme, chaleureuse et réaliste. Je veux beaucoup plus de décoration, de meilleurs meubles PBR, des textures riches, du noyer, du travertin, du verre et du laiton. Vérifie la circulation et ne colle pas les meubles.";
    const moodRef = intentRuntime.analyzeReferenceText({ name: "palace-living-room.jpg", analysis: "Majestic palace living room with ivory marble, brushed brass, walnut, velvet seating, grand chandelier and soft evening ambience." });
    const palaceIntent = intentRuntime.buildArchitectureIntent(resized, "Crée un palais majestueux", [moodRef]);
    assert(palaceIntent.projectType === "palace" && palaceIntent.finishLevel === "luxury", "TEST V8: intent palais non détecté.");
    assert(palaceIntent.materials.some((value) => /Marbre|Laiton/i.test(value)), "TEST V8: matériaux des références non fusionnés.");
    const palacePlan = commandRuntime.fastDesignCommand({ ...resized, architecture: { ...(resized.architecture || {}), designIntent: palaceIntent } }, "Crée un palais majestueux avec un rendu réaliste");
    assert(palacePlan?.summary.toLowerCase().includes("palais") && palacePlan?.actions.some((action) => action.type === "set_villa_program" || action.type === "apply_architecture_program"), "TEST V8: génération palais distincte absente.");

    const brief = briefRuntime.parseArchitectureBrief(v7Prompt, resized);
    assert(brief.finishLevel === "luxury", "TEST V7: niveau de finition luxury non compris.");
    assert(brief.materials.some((value) => /noyer/i.test(value)) && brief.materials.some((value) => /travertin/i.test(value)), "TEST V7: matériaux demandés non extraits.");
    assert(brief.priorities.some((value) => /décor|decor/i.test(value)), "TEST V7: priorité décoration absente.");
    const briefed = briefRuntime.applyArchitectureBrief(resized, brief);
    assert(briefed.architecture?.brief?.style && briefed.architecture?.finishLevel === "luxury", "TEST V7: brief non appliqué au projet.");

    const villaPlan = commandRuntime.fastDesignCommand(briefed, v7Prompt);
    assert(villaPlan?.actions.some((action) => action.type === "set_villa_program" || action.type === "apply_architecture_program"), "TEST V7: transformation villa autonome absente.");
    assert(villaPlan?.actions.some((action) => action.type === "furnish_room" && action.density === "luxury"), "TEST V7: composition luxury non générée.");
    let villa = commandRuntime.applyDesignActions(briefed, villaPlan.actions);
    assert(villa.architecture?.levels?.length === 2, "TEST V7: villa attendue sur deux niveaux.");
    assert(new Set(villa.plan.rooms.map((room) => room.level || 0)).size === 2, "TEST V7: pièces non distribuées sur deux niveaux.");
    assert(villa.plan.objects.some((object) => object.category === "stairs"), "TEST V7: escalier inter-étage absent.");
    assert(villa.plan.objects.filter((object) => object.category !== "stairs").length >= 8, "TEST V7: ameublement autonome insuffisant.");
    assert(villa.architecture?.ambience === "soft" && villa.architecture?.renderQuality === "high", "TEST V7: ambiance/rendu premium non activés par la transformation globale.");
    assert(villa.materials.some((material) => material.texture === "wood") && villa.materials.some((material) => material.texture === "marble") && villa.materials.some((material) => material.texture === "fabric"), "TEST V7: bibliothèque de textures PBR non disponible.");
    assert(villa.plan.rooms.every((room) => room.navigationNodes?.[0]?.label === "Vue principale" && Math.abs((room.navigationNodes?.[0]?.eyeHeight || 0) - 1.62) < .01), "TEST V7: points caméra premium non migrés sur toutes les pièces.");
    const salonV6 = villa.plan.rooms.find((room) => room.name === "Salon");
    assert(salonV6, "TEST V7: Salon absent après transformation villa.");
    const salonObjects = villa.plan.objects.filter((object) => object.roomId === salonV6.id && object.category !== "stairs");
    assert(salonObjects.length >= 4, "TEST V7: composition complète du salon insuffisante.");
    assert(salonObjects.some((object) => object.metadata?.compositionEngine === "v7"), "TEST V7: objets non issus du moteur de composition.");
    assert(salonObjects.some((object) => object.metadata?.finishLevel === "luxury"), "TEST V7: finition luxury non propagée aux objets.");
    const auditV7 = auditRuntime.analyzeArchitecture(villa);
    const salonAuditV7 = auditV7.rooms.find((room) => room.roomName === "Salon");
    assert(typeof salonAuditV7?.finishScore === "number" && salonAuditV7.finishScore >= 0 && salonAuditV7.finishScore <= 100, "TEST V7: score de finition de pièce absent.");
    const clearanceIssuesBeforeQuality = interiorRuntime.validateRoomClearances(villa, salonV6);
    assert(clearanceIssuesBeforeQuality.length === 0, `TEST V7: composition initiale avec collisions/dégagements invalides: ${clearanceIssuesBeforeQuality.join(" | ")}`);
    const quality = qualityRuntime.runArchitectureQualityPass(villa);
    villa = quality.project;
    assert(quality.report.afterScore >= 0 && quality.report.afterScore <= 100, "TEST V7: vérification finale invalide.");
    assert(villa.plan.objects.every((object) => object.category === "stairs" || villa.plan.rooms.some((room) => room.id === object.roomId && (room.level || 0) === (object.level || 0))), "TEST V7: meuble placé sur un niveau incohérent.");

    const results = simulationRuntime.runAllDesignSimulations(resized);
    assert(results.length === 7 && results.every((result) => result.score >= 0 && result.score <= 100 && /professionnel/i.test(result.disclaimer)), "Suite de simulations invalide.");
  } finally { await rm(temp, { recursive: true, force: true }); }
}

console.log("SOPHENIC DESIGN tests: OK — Architecture V7 brief fidèle + sélection assets réalistes + décoration luxury + composition anti-collision + villa multi-étages + timeline IA.");
