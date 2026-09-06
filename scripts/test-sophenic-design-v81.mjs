/**
 * SOPHENIC DESIGN V8.1 REAL AI — Tests obligatoires avant livraison.
 *
 * Test A : « Créer un palais majestueux » → architecture monumentale
 *          (3 niveaux, grandes hauteurs, colonnes, marbre/dorures, mobilier classique luxe).
 * Test B : « Créer une villa moderne » → architecture contemporaine
 *          (≤2 niveaux, baies vitrées, bois/pierre/verre, mobilier minimaliste premium).
 *          A et B doivent être STRUCTURELLEMENT différents.
 * Test C : import d'une image de salon moderne (JSON Vision simulé) →
 *          le Design Intent ET la génération changent réellement.
 * Assets  : pipeline Sketchfab réel — requêtes dérivées de l'intent
 *          (royal sofa/chandelier vs modern sofa/designer chair), ranking
 *          style+PBR+licence+downloadable+polycount, aucun asset inventé.
 */
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const tsModule = await import("typescript").catch(() => null);
const ts = tsModule?.default || tsModule;
const assert = (value, message) => { if (!value) throw new Error(message); };

/* ---------- 1. Syntaxe des nouveaux modules V8.1 ---------- */
for (const file of ["src/design/intent-profiles.ts", "src/design/architect-program.ts", "src/design/asset-requirements.ts", "src/design/design-intent-ai.ts", "src/app/api/design/intent/route.ts"]) {
  const code = await readFile(file, "utf8");
  assert(code.trim().length > 0, `Fichier V8.1 vide: ${file}`);
  if (!ts?.createSourceFile) continue;
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
  const errors = (parsed.parseDiagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Erreur de syntaxe TypeScript dans ${file}`);
}

const workspaceSource = await readFile("src/components/design/design-workspace.tsx", "utf8");
for (const expected of ["Ajouter références", "Références analysées", "Style détecté", "Matériaux", "resolveDesignIntent", "Analyse de la demande", "Analyse des images", "Création du Design Intent", "Recherche assets", "Construction de l'architecture", "Aménagement des pièces", "Vérification", "selectBestDesignAssetForIntent"]) {
  assert(workspaceSource.includes(expected), `UI/timeline V8.1 incomplète : ${expected} absent du workspace.`);
}
const commandsSource = await readFile("src/design/commands.ts", "utf8");
assert(!commandsSource.includes('actions.push({ type: "set_villa_program", style: palaceStyle'), "V8.1 : le template fixe palais doit avoir été supprimé de commands.ts.");
assert(!commandsSource.includes('actions.push({ type: "set_villa_program", style: briefStyle'), "V8.1 : le template fixe villa doit avoir été supprimé de commands.ts.");
assert(commandsSource.includes("intentToDesignActions") && commandsSource.includes("apply_architecture_program"), "V8.1 : le Program Synthesis Engine n'est pas branché sur les commandes.");

/* ---------- 2. Compilation + tests comportementaux ---------- */
if (!ts) throw new Error("TypeScript est requis pour les tests V8.1.");
const temp = await mkdtemp(path.join(os.tmpdir(), "sophenic-v81-tests-"));
try {
  const outDir = path.join(temp, "out");
  const files = ["types.ts", "architecture.ts", "interior-brief.ts", "design-intent.ts", "intent-profiles.ts", "architect-program.ts", "asset-requirements.ts", "interior-composition.ts", "architecture-audit.ts", "architecture-quality.ts", "asset-selection.ts", "project-factory.ts", "commands.ts", "simulations.ts"].map((name) => path.resolve("src/design", name));
  const config = {
    compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", lib: ["ES2022", "DOM"], strict: true, esModuleInterop: true, skipLibCheck: true, outDir, rootDir: path.resolve("src/design") },
    files
  };
  const configPath = path.join(temp, "tsconfig.json"); await writeFile(configPath, JSON.stringify(config), "utf8");
  const tscPath = require.resolve("typescript/lib/tsc.js");
  const compiled = spawnSync(process.execPath, [tscPath, "-p", configPath], { encoding: "utf8" });
  assert(compiled.status === 0, `Compilation stricte du noyau V8.1 échouée: ${(compiled.stderr || compiled.stdout || "").trim()}`);

  const factory = require(path.join(outDir, "project-factory.js"));
  const intentRuntime = require(path.join(outDir, "design-intent.js"));
  const programRuntime = require(path.join(outDir, "architect-program.js"));
  const requirementsRuntime = require(path.join(outDir, "asset-requirements.js"));
  const selectionRuntime = require(path.join(outDir, "asset-selection.js"));
  const commandRuntime = require(path.join(outDir, "commands.js"));
  const auditRuntime = require(path.join(outDir, "architecture-audit.js"));
  const qualityRuntime = require(path.join(outDir, "architecture-quality.js"));
  const compositionRuntime = require(path.join(outDir, "interior-composition.js"));

  const build = (instruction, references = []) => {
    const project = factory.createDesignProject("Test V8.1", "architecture");
    const intent = intentRuntime.buildArchitectureIntent(project, instruction, references);
    project.architecture = { ...(project.architecture || {}), designIntent: intent, referenceAnalyses: references, sketchfabStrategy: "strict" };
    return { project, intent };
  };
  const generate = (instruction, references = []) => {
    const { project, intent } = build(instruction, references);
    const plan = commandRuntime.fastDesignCommand(project, instruction);
    assert(plan, `Aucun plan généré pour « ${instruction} ».`);
    return { project, intent, plan, applied: commandRuntime.applyDesignActions(project, plan.actions) };
  };
  const columns = (project) => project.plan.objects.filter((object) => object.metadata?.structural === "column");
  const furniture = (project) => project.plan.objects.filter((object) => object.category !== "stairs" && object.metadata?.structural !== "column");

  /* ================= TEST A — PALAIS MAJESTUEUX ================= */
  const A = generate("Créer un palais majestueux");
  assert(A.intent.intentVersion === "8.1" && A.intent.archetype === "palace" && A.intent.projectType === "palace", "TEST A: archetype palais non détecté dans l'intent.");
  assert(A.intent.monumentality >= 80, `TEST A: monumentalité attendue ≥ 80, obtenue ${A.intent.monumentality}.`);
  assert((A.intent.wallHeight || 0) >= 4, `TEST A: hauteur de murs monumentale attendue ≥ 4 m, obtenue ${A.intent.wallHeight}.`);
  assert(/classique|royal/i.test(A.intent.furnitureStyle || ""), "TEST A: furnitureStyle classique royal absent de l'intent.");
  assert(/colonnade/i.test(A.intent.structuralLanguage || ""), "TEST A: langage structurel (colonnades) absent.");
  const programAction = A.plan.actions.find((action) => action.type === "apply_architecture_program");
  assert(programAction, "TEST A: action apply_architecture_program absente.");
  assert(programAction.program.levels.length === 3, `TEST A: palais attendu sur 3 niveaux, obtenu ${programAction.program.levels.length}.`);
  assert(programAction.program.wallHeight >= 4, "TEST A: programme palais sans hauteurs monumentales.");
  assert(programAction.program.colonnadeRooms.length >= 1, "TEST A: aucune colonnade dans le programme.");
  assert(A.applied.architecture?.levels?.length === 3, "TEST A: le palais appliqué n'a pas 3 niveaux.");
  assert(A.applied.plan.wallHeight >= 4, `TEST A: hauteur appliquée ≥ 4 m attendue, obtenue ${A.applied.plan.wallHeight}.`);
  assert(columns(A.applied).length >= 4, `TEST A: colonnades monumentales absentes (${columns(A.applied).length} colonnes).`);
  assert(A.applied.plan.rooms.some((room) => /Grand Salon|Hall d’honneur/.test(room.name)), "TEST A: pièces monumentales (Grand Salon/Hall d'honneur) absentes.");
  assert(A.applied.materials.some((material) => /Marbre/i.test(material.name)) && A.applied.materials.some((material) => /Laiton|Bronze/i.test(material.name)), "TEST A: marbre et dorures absents des matériaux.");
  const palaceFloors = A.applied.plan.rooms.filter((room) => room.usage === "living").map((room) => A.applied.materials.find((material) => material.id === room.floorMaterialId)?.name || "");
  assert(palaceFloors.some((name) => /Marbre/i.test(name)), "TEST A: les salons du palais ne sont pas en marbre.");
  const palaceWindows = A.applied.plan.openings.filter((opening) => opening.kind === "window");
  assert(palaceWindows.some((opening) => opening.height >= 2.2), "TEST A: fenêtres monumentales (≥ 2,2 m) absentes.");
  assert(A.plan.actions.some((action) => action.type === "furnish_room" && action.density === "luxury"), "TEST A: mobilier classique luxe (density luxury) absent du plan.");
  assert(furniture(A.applied).length >= 8, `TEST A: ameublement palais insuffisant (${furniture(A.applied).length} meubles).`);
  const palaceVocabulary = requirementsRuntime.assetRequirementsForIntent(A.intent);
  const palaceQueries = palaceVocabulary.map((requirement) => requirement.query).join(" | ");
  assert(/royal sofa/i.test(palaceQueries), "TEST A: requête « royal sofa » absente du vocabulaire d'assets.");
  assert(/chandelier/i.test(palaceQueries), "TEST A: requête « chandelier » absente du vocabulaire d'assets.");
  assert(/marble/i.test(palaceQueries), "TEST A: requête « marble table » absente du vocabulaire d'assets.");
  assert(/classic chair/i.test(palaceQueries), "TEST A: requête « classic chair » absente du vocabulaire d'assets.");

  /* ================= TEST B — VILLA MODERNE ================= */
  const B = generate("Créer une villa moderne");
  assert(B.intent.archetype === "villa" && B.intent.projectType === "villa", "TEST B: archetype villa non détecté.");
  assert((B.intent.wallHeight || 9) <= 3.4, `TEST B: hauteur contemporaine ≤ 3,4 m attendue, obtenue ${B.intent.wallHeight}.`);
  assert(/minimaliste|moderne|contemporain/i.test(B.intent.furnitureStyle || ""), "TEST B: furnitureStyle minimaliste premium absent.");
  assert(/baies vitrées/i.test(B.intent.structuralLanguage || ""), "TEST B: langage structurel (baies vitrées) absent.");
  const villaProgram = B.plan.actions.find((action) => action.type === "apply_architecture_program" || action.type === "set_villa_program" || action.type === "set_architecture_layout");
  assert(villaProgram, "TEST B: action structurelle absente.");
  assert(B.applied.architecture?.levels?.length <= 2 && B.applied.architecture?.levels?.length >= 1, `TEST B: villa attendue sur 1-2 niveaux, obtenu ${B.applied.architecture?.levels?.length}.`);
  assert(B.applied.plan.wallHeight <= 3.4, `TEST B: hauteur villa ≤ 3,4 m attendue, obtenue ${B.applied.plan.wallHeight}.`);
  assert(columns(B.applied).length === 0, "TEST B: une villa moderne ne doit pas avoir de colonnades.");
  assert(B.applied.plan.openings.some((opening) => opening.kind === "window" && opening.width >= 3 && opening.sill <= 0.4), "TEST B: grandes baies vitrées (large, basse allège) absentes.");
  const villaMaterials = B.applied.materials.map((material) => material.name).join(", ");
  assert(/Chêne|bois/i.test(villaMaterials) && /Travertin|pierre|Pierre/i.test(villaMaterials) && /Verre/i.test(villaMaterials), `TEST B: bois/pierre/verre absents des matériaux (${villaMaterials}).`);
  const villaFloors = B.applied.plan.rooms.filter((room) => room.usage === "living").map((room) => B.applied.materials.find((material) => material.id === room.floorMaterialId)?.name || "");
  assert(villaFloors.some((name) => /Chêne|bois/i.test(name)), "TEST B: le salon de la villa n'est pas en bois clair.");
  const villaVocabulary = requirementsRuntime.assetRequirementsForIntent(B.intent);
  const villaQueries = villaVocabulary.map((requirement) => requirement.query).join(" | ");
  assert(/modern sofa/i.test(villaQueries), "TEST B: requête « modern sofa » absente.");
  assert(/designer chair/i.test(villaQueries), "TEST B: requête « designer chair » absente.");
  assert(/glass/i.test(villaQueries), "TEST B: requête « glass table » absente.");
  assert(/minimalist (lamp|pendant)/i.test(villaQueries), "TEST B: requête « minimalist lamp » absente.");
  assert(furniture(B.applied).length >= 8, `TEST B: ameublement villa insuffisant (${furniture(B.applied).length} meubles).`);

  /* ============ A vs B : DIFFÉRENCE STRUCTURELLE OBLIGATOIRE ============ */
  const levelCount = (project) => new Set(project.plan.rooms.map((room) => room.level || 0)).size;
  assert(levelCount(A.applied) !== levelCount(B.applied), `TEST A/B: même nombre de niveaux (${levelCount(A.applied)} vs ${levelCount(B.applied)}) — résultats pas assez différents.`);
  assert(Math.abs(A.applied.plan.wallHeight - B.applied.plan.wallHeight) >= 1, "TEST A/B: hauteurs de murs trop similaires.");
  assert(columns(A.applied).length > 0 && columns(B.applied).length === 0, "TEST A/B: langage structurel identique (colonnades).");
  const names = (project) => new Set(project.plan.rooms.map((room) => room.name.toLowerCase()));
  const intersection = [...names(A.applied)].filter((name) => names(B.applied).has(name)).length;
  const union = new Set([...names(A.applied), ...names(B.applied)]).size;
  assert(intersection / union < 0.45, `TEST A/B: programmes de pièces trop similaires (Jaccard ${(intersection / union).toFixed(2)}).`);
  const intentMaterialsOverlap = A.intent.materials.filter((material) => B.intent.materials.includes(material)).length / Math.max(1, A.intent.materials.length);
  assert(intentMaterialsOverlap < 0.6, `TEST A/B: palettes de matériaux de l'intent quasi identiques (${(intentMaterialsOverlap * 100).toFixed(0)} %).`);
  const usedFloors = (project) => new Set(project.plan.rooms.map((room) => project.materials.find((material) => material.id === room.floorMaterialId)?.name || ""));
  const sharedFloors = [...usedFloors(A.applied)].filter((name) => usedFloors(B.applied).has(name)).length;
  assert(sharedFloors <= 2, `TEST A/B: les sols des deux projets sont quasi identiques (${sharedFloors} communs).`);
  const aAssetQueries = requirementsRuntime.assetRequirementsForIntent(A.intent).map((requirement) => requirement.query).join(" ");
  const bAssetQueries = requirementsRuntime.assetRequirementsForIntent(B.intent).map((requirement) => requirement.query).join(" ");
  assert(aAssetQueries !== bAssetQueries, "TEST A/B: vocabulaires d'assets identiques.");
  const avgCeilingA = A.applied.plan.rooms.reduce((sum, room) => sum + (room.ceilingHeight || A.applied.plan.wallHeight), 0) / A.applied.plan.rooms.length;
  const avgCeilingB = B.applied.plan.rooms.reduce((sum, room) => sum + (room.ceilingHeight || B.applied.plan.wallHeight), 0) / B.applied.plan.rooms.length;
  assert(avgCeilingA - avgCeilingB >= 1, `TEST A/B: hauteurs sous plafond trop proches (${avgCeilingA.toFixed(1)} vs ${avgCeilingB.toFixed(1)}).`);

  /* ==== TEST C — IMAGE DE RÉFÉRENCE (SALON MODERNE) CHANGE LE RÉSULTAT ====
     On simule la réponse JSON du modèle Vision (même format que le prompt V8.1). */
  const visionJson = JSON.stringify({
    style: "contemporary luxury",
    materials: ["travertine", "walnut", "glass", "brushed brass"],
    colors: ["#EDE7DC", "#C9B39A", "#3A3A38"],
    furniture: ["minimalist sofa", "stone coffee table", "designer armchair"],
    furnitureStyle: "minimaliste premium contemporain",
    lighting: "warm indirect lighting, large windows",
    proportions: "open plan, generous ceiling",
    ambiance: "soft",
    luxuryLevel: "rich",
    rooms: ["living room"],
    summary: "Modern luxury living room with travertine walls, walnut joinery and brass accents."
  });
  const reference = intentRuntime.analyzeReferenceText({ assetId: "asset-vision-1", name: "salon-moderne.jpg", analysis: visionJson });
  assert(reference.extraction === "vision-ai", "TEST C: le JSON Vision structuré n'a pas été reconnu.");
  assert(reference.styleHints[0] === "contemporary luxury", "TEST C: style de la référence non extrait.");
  assert(reference.materialHints.some((value) => /Travertin/i.test(value)) && reference.materialHints.some((value) => /Laiton/i.test(value)), `TEST C: matériaux de la référence non canonisés (${reference.materialHints.join(", ")}).`);
  assert(reference.furnitureStyle === "minimaliste premium contemporain", "TEST C: furnitureStyle non extrait du JSON Vision.");
  assert(reference.proportions && reference.lighting, "TEST C: proportions/lumière non extraites.");

  const baseNoRef = build("Crée une maison moderne et aménage-la");
  const withRef = build("Crée une maison moderne et aménage-la", [reference]);
  assert(withRef.intent.materials.some((value) => /Travertin/i.test(value)), "TEST C: le travertin détecté dans l'image n'est pas remonté dans l'intent.");
  assert(withRef.intent.materials.some((value) => /Laiton|Noyer/i.test(value)), "TEST C: les matériaux de l'image n'influencent pas l'intent.");
  assert(withRef.intent.detectedStyleLabel === "contemporary luxury", `TEST C: style détecté incorrect (${withRef.intent.detectedStyleLabel}).`);
  assert(withRef.intent.furnitureStyle === "minimaliste premium contemporain", "TEST C: le mobilier détecté dans l'image n'écrase pas le style par défaut.");
  assert(withRef.intent.materials[0] !== baseNoRef.intent.materials[0] || withRef.intent.materials.join("|") !== baseNoRef.intent.materials.join("|"), "TEST C: l'intent avec référence est identique à l'intent sans référence.");
  const planNoRef = commandRuntime.fastDesignCommand(baseNoRef.project, "Crée une maison moderne et aménage-la");
  const planWithRef = commandRuntime.fastDesignCommand(withRef.project, "Crée une maison moderne et aménage-la");
  const appliedNoRef = commandRuntime.applyDesignActions(baseNoRef.project, planNoRef.actions);
  const appliedWithRef = commandRuntime.applyDesignActions(withRef.project, planWithRef.actions);
  const floorName = (project, usage) => {
    const room = project.plan.rooms.find((candidate) => candidate.usage === usage);
    return room ? (project.materials.find((material) => material.id === room.floorMaterialId)?.name || "") : "";
  };
  assert(floorName(appliedWithRef, "living") === "Noyer fumé", `TEST C: le noyer (walnut) détecté dans l'image ne s'applique pas au salon (${floorName(appliedWithRef, "living")}).`);
  assert(floorName(appliedNoRef, "living") === "Chêne naturel", `TEST C: baseline inattendue (${floorName(appliedNoRef, "living")}).`);
  assert(floorName(appliedWithRef, "kitchen") === "Travertin ivoire", `TEST C: le travertin détecté ne s'applique pas à la cuisine (${floorName(appliedWithRef, "kitchen")}).`);
  assert(appliedWithRef.architecture?.designIntent?.referenceSummary?.length >= 1, "TEST C: la référence analysée n'est pas tracée dans l'intent appliqué.");
  // La référence (luxuryLevel "rich") élève la densité d'aménagement.
  const maxDensity = (plan) => plan.actions.filter((action) => action.type === "furnish_room").map((action) => action.density);
  const densitiesNoRef = maxDensity(planNoRef).join(",");
  const densitiesWithRef = maxDensity(planWithRef).join(",");
  assert(densitiesNoRef !== densitiesWithRef, `TEST C: la référence ne change pas l'aménagement (${densitiesNoRef} vs ${densitiesWithRef}).`);
  assert(densitiesWithRef.includes("complete") || densitiesWithRef.includes("luxury"), "TEST C: la référence luxe n'élève pas la densité d'aménagement.");
  assert(appliedWithRef.plan.objects.length > appliedNoRef.plan.objects.length, `TEST C: la référence n'augmente pas la richesse du projet (${appliedWithRef.plan.objects.length} vs ${appliedNoRef.plan.objects.length} objets).`);

  /* ============ PIPELINE SKETCHFAB REAL — RANKING IA ============ */
  const sketchfabResults = [
    { provider: "sketchfab", sourceId: "classic-royal", name: "Royal Classic Velvet Sofa photorealistic PBR", sourceUrl: "https://sketchfab.com/models/classic-royal", downloadable: true, tags: ["classic", "royal", "velvet", "photorealistic", "pbr", "sofa"], license: "CC Attribution", author: "Atelier Royal", likeCount: 320, viewCount: 9800, faceCount: 240_000, staffPicked: true },
    { provider: "sketchfab", sourceId: "modern-minimal", name: "Minimalist Modern Sofa PBR", sourceUrl: "https://sketchfab.com/models/modern-minimal", downloadable: true, tags: ["modern", "minimalist", "sofa", "pbr"], license: "CC Attribution", author: "Studio Nord", likeCount: 300, viewCount: 8000, faceCount: 210_000 },
    { provider: "sketchfab", sourceId: "no-license", name: "Royal Sofa carved gold", sourceUrl: "https://sketchfab.com/models/no-license", downloadable: true, tags: ["royal", "classic", "sofa"], license: "", author: "X", likeCount: 500 },
    { provider: "sketchfab", sourceId: "lowpoly", name: "Low poly royal sofa", sourceUrl: "https://sketchfab.com/models/lowpoly", downloadable: true, tags: ["low poly", "royal", "sofa"], license: "CC Attribution", likeCount: 90, faceCount: 420 }
  ];
  // Palais → le canapé royal classique doit gagner ; le minimaliste moderne pénalisé.
  const palaceSofa = selectionRuntime.selectBestDesignAssetForIntent(sketchfabResults, "royal sofa velvet classic", A.intent);
  assert(palaceSofa?.sourceId === "classic-royal", `TEST Assets: le palais doit sélectionner le sofa royal classique (obtenu ${palaceSofa?.sourceId}).`);
  // Villa moderne → le sofa minimaliste doit gagner pour la même liste de résultats.
  const villaSofa = selectionRuntime.selectBestDesignAssetForIntent(sketchfabResults, "modern sofa minimalist", B.intent);
  assert(villaSofa?.sourceId === "modern-minimal", `TEST Assets: la villa doit sélectionner le sofa moderne minimaliste (obtenu ${villaSofa?.sourceId}).`);
  // Sans licence ou low-poly → jamais sélectionné, et null quand RIEN n'est compatible.
  assert(!["no-license", "lowpoly"].includes(palaceSofa?.sourceId || ""), "TEST Assets: un asset sans licence/low-poly a été sélectionné.");
  assert(selectionRuntime.selectBestDesignAssetForIntent([], "royal sofa", A.intent) === null, "TEST Assets: un asset a été inventé à partir d'une recherche vide.");
  assert(selectionRuntime.selectBestDesignAssetForIntent([{ provider: "sketchfab", sourceId: "bad", name: "toy sofa", sourceUrl: "u", downloadable: true, tags: ["toy"], license: "" }], "royal sofa", A.intent) === null, "TEST Assets: un asset sans licence ne doit jamais passer.");
  const message = requirementsRuntime.noAssetMessage(palaceVocabulary[0], "Canapé royal");
  assert(/aucun modèle 3D Sketchfab compatible/i.test(message) && /fallback procédural/i.test(message), "TEST Assets: le message « aucun asset compatible » est absent ou incorrect.");

  /* ============ QUALITÉ FINALE SUR LE PALAIS COMPLET ============ */
  const grandSalon = A.applied.plan.rooms.find((room) => /Grand Salon/.test(room.name));
  assert(grandSalon, "TEST Qualité: Grand Salon introuvable.");
  const clearanceIssues = compositionRuntime.validateRoomClearances(A.applied, grandSalon);
  assert(clearanceIssues.length === 0, `TEST Qualité: collisions/dégagements invalides dans le Grand Salon: ${clearanceIssues.join(" | ")}`);
  const qualityA = qualityRuntime.runArchitectureQualityPass(A.applied);
  assert(qualityA.report.afterScore >= 0 && qualityA.report.afterScore <= 100, "TEST Qualité: passe de vérification invalide.");
  const auditA = auditRuntime.analyzeArchitecture(A.applied);
  assert(auditA.roomCount === A.applied.plan.rooms.length, "TEST Qualité: audit incohérent avec le plan.");
  // Deux exécutions du même intent → même programme (déterminisme hors IA).
  const A2 = generate("Créer un palais majestueux");
  assert(A2.applied.plan.rooms.length === A.applied.plan.rooms.length && Math.abs(A2.applied.plan.wallHeight - A.applied.plan.wallHeight) < 0.05, "TEST Déterminisme: deux générations du même intent divergent.");

  console.log("SOPHENIC DESIGN V8.1 REAL AI — TESTS OBLIGATOIRES : OK");
  console.log(`  A. Palais majestueux  : ${A.applied.plan.rooms.length} pièces · ${levelCount(A.applied)} niveaux · murs ${A.applied.plan.wallHeight.toFixed(1)} m · ${columns(A.applied).length} colonnes · ${furniture(A.applied).length} meubles · assets « royal sofa / chandelier / marble table / classic chair »`);
  console.log(`  B. Villa moderne      : ${B.applied.plan.rooms.length} pièces · ${levelCount(B.applied)} niveaux · murs ${B.applied.plan.wallHeight.toFixed(1)} m · baies vitrées · ${furniture(B.applied).length} meubles · assets « modern sofa / designer chair / glass table / minimalist lamp »`);
  console.log(`  A≠B                   : niveaux ${levelCount(A.applied)} vs ${levelCount(B.applied)} · Jaccard pièces ${(intersection / union).toFixed(2)} · Δhauteurs ${(avgCeilingA - avgCeilingB).toFixed(1)} m`);
  console.log(`  C. Référence salon moderne : intent « ${withRef.intent.detectedStyleLabel} » · matériaux ${withRef.intent.materials.slice(0, 3).join(", ")} · salon ${floorName(appliedNoRef, "living")}→${floorName(appliedWithRef, "living")} · cuisine ${floorName(appliedNoRef, "kitchen")}→${floorName(appliedWithRef, "kitchen")} · aménagement ${densitiesNoRef}→${densitiesWithRef}`);
  console.log(`  Assets Sketchfab      : ranking intent-aware OK (palais→${palaceSofa?.sourceId}, villa→${villaSofa?.sourceId}) · aucun asset inventé · message honnête fourni`);
} finally { await rm(temp, { recursive: true, force: true }); }
