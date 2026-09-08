/**
 * SOPHENIC DESIGN V8.2 — REAL AI DESIGN AGENT. Tests obligatoires avant livraison.
 *
 * Pipeline testé de bout en bout :
 *   IMAGE (JSON Vision simulé) → ROOM UNDERSTANDING → SPACE REBUILD →
 *   FURNITURE LAYOUT AGENT → ASSET INTELLIGENCE → QUALITY CHECK.
 *
 * TEST 1 : image salon beige classique + « Transforme ce salon en style japandi »
 *          → NOUVEAU canapé/mobilier japandi, bois clair, composition nouvelle
 *          (pas un tweak de couleur ni un déplacement de 20 cm).
 * TEST 2 : LA MÊME image + « Transforme ce salon en palace royal »
 *          → mobilier classique royal, marbre, lustre : scène RADICALEMENT
 *          différente de TEST 1.
 * TEST 3 : « Crée une villa moderne » ≠ « Crée un palais majestueux »
 *          (programmes structurellement différents) + graines différentes →
 *          compositions différentes (aucun template figé).
 * TEST 4 : Asset Intelligence — jamais le nom exact, expansion d'intention
 *          multi-requêtes, manque d'asset enregistré + message honnête.
 * TEST 5 : Room Understanding — parse Vision JSON + dérivation honnête sans IA.
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

/* ---------- 1. Syntaxe des modules V8.2 ---------- */
for (const file of [
  "src/design/furniture-catalog.ts", "src/design/material-canon.ts", "src/design/room-blueprint.ts",
  "src/design/room-understanding.ts", "src/design/furniture-layout-agent.ts", "src/design/space-rebuild.ts",
  "src/design/asset-intelligence.ts", "src/design/program-requests.ts", "src/design/intent-profiles.ts",
  "src/design/architect-program.ts", "src/design/commands.ts", "src/design/ai.ts", "src/design/types.ts"
]) {
  const code = await readFile(file, "utf8");
  assert(code.trim().length > 0, `Fichier V8.2 vide : ${file}`);
  if (!ts?.createSourceFile) continue;
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors = (parsed.parseDiagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Erreur de syntaxe TypeScript dans ${file}`);
}

/* ---------- 2. Contrat UI + interdits ---------- */
const workspaceSource = await readFile("src/components/design/design-workspace.tsx", "utf8");
for (const expected of ["Analyser une inspiration", "Image analysée", "IMAGE ANALYSÉE", "Room Understanding", "InspirationBlueprintCard", "expandAssetQueries", "recordAssetGap", "resolveRoomBlueprint", "variationSeed", "Space Rebuild"]) {
  assert(workspaceSource.includes(expected), `UI V8.2 incomplète : « ${expected} » absent du workspace.`);
}
const aiSource = await readFile("src/design/ai.ts", "utf8");
assert(aiSource.includes("rebuild_room"), "Le prompt Brain ne documente pas l'action rebuild_room.");
assert(aiSource.includes("JAMAIS de micro-modifications") || aiSource.includes("micro-modifications"), "La règle anti-micro-modifications absente du prompt.");
const assetIntelSource = await readFile("src/design/asset-intelligence.ts", "utf8");
assert(assetIntelSource.includes("placeholder premium temporaire"), "Le message honnête de manque d'asset est absent.");
/* Aucun template fixe « if palace: create X » dans le moteur de reconstruction. */
const rebuildSource = await readFile("src/design/space-rebuild.ts", "utf8");
assert(!/if\s*\(.*palace.*\)\s*\{[^}]*add_object/.test(rebuildSource), "Template fixe interdit détecté dans space-rebuild.ts.");
assert(!rebuildSource.includes("style === \"palais\" ? ["), "Liste de mobilier figée par style détectée (interdit).");

/* ---------- 3. Compilation + tests comportementaux ---------- */
if (!ts) throw new Error("TypeScript est requis pour les tests V8.2.");
const temp = await mkdtemp(path.join(os.tmpdir(), "sophenic-v82-tests-"));
try {
  const outDir = path.join(temp, "out");
  const files = [
    "types.ts", "architecture.ts", "interior-brief.ts", "design-intent.ts", "intent-profiles.ts", "material-canon.ts",
    "architect-program.ts", "program-requests.ts", "asset-requirements.ts", "asset-selection.ts", "asset-intelligence.ts",
    "interior-composition.ts", "architecture-audit.ts", "architecture-quality.ts", "project-factory.ts", "commands.ts",
    "simulations.ts", "furniture-catalog.ts", "room-blueprint.ts", "furniture-layout-agent.ts", "space-rebuild.ts",
    "design-intent-ai.ts", "room-understanding.ts"
  ].map((name) => path.resolve("src/design", name)).concat([path.resolve("src/types/electron.d.ts")]);
  const config = {
    compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", lib: ["ES2022", "DOM"], strict: true, esModuleInterop: true, skipLibCheck: true, outDir, rootDir: path.resolve("src") },
    files
  };
  const configPath = path.join(temp, "tsconfig.json"); await writeFile(configPath, JSON.stringify(config), "utf8");
  const compiled = spawnSync(process.execPath, [require.resolve("typescript/lib/tsc.js"), "-p", configPath], { encoding: "utf8" });
  assert(compiled.status === 0, `Compilation stricte du noyau V8.2 échouée : ${(compiled.stderr || compiled.stdout || "").trim()}`);

  const D = (name) => require(path.join(outDir, "design", name));
  const factory = D("project-factory");
  const intentRuntime = D("design-intent");
  const commandRuntime = D("commands");
  const rebuildRuntime = D("space-rebuild");
  const blueprintRuntime = D("room-blueprint");
  const understanding = D("room-understanding");
  const assetIntel = D("asset-intelligence");
  const programRuntime = D("architect-program");

  /* Image salon beige classique — JSON exact du ROOM_UNDERSTANDING_VISION_PROMPT. */
  const beigeSalonVision = JSON.stringify({
    room: "salon",
    style: "classique beige cossu",
    layout: { sofa: "contre le mur nord, face à la fenêtre sud", coffeeTable: "devant le canapé", chairs: "deux fauteuils symétriques", tvZone: "angle nord-ouest", circulation: "passage central est-ouest", freeZones: ["coin lecture"] },
    architecture: { estimatedWidth: 5.2, estimatedDepth: 4.1, ceilingHeight: 2.7, openings: [{ kind: "window", side: "south", width: 1.8, height: 1.2 }, { kind: "door", side: "north", width: 0.9 }] },
    materials: ["Lin beige", "Bois vernis", "Laiton"],
    palette: ["#D9CBB2", "#8C6F4E", "#F2EDE4"],
    furniture: [
      { name: "Canapé droit 3 places en lin beige", type: "sofa", count: 1 },
      { name: "Table basse ovale bois vernis", type: "coffee table", count: 1 },
      { name: "Fauteuil classique à médaillon", type: "armchair", count: 2 },
      { name: "Console laiton", type: "console", count: 1 }
    ],
    lighting: "lumière naturelle sud, abat-jour laiton",
    luxuryLevel: "balanced",
    summary: "Salon classique beige cossu, canapé en lin face à la fenêtre sud."
  });

  /* ================= TEST 1 — SALON → JAPANDI ================= */
  const blueprint1 = blueprintRuntime.parseRoomBlueprint(beigeSalonVision, ["asset-vision-1"]);
  assert(blueprint1, "TEST 1: le JSON Vision n'a pas produit de ROOM_BLUEPRINT.");
  assert(blueprint1.origin === "vision-ai", "TEST 1: origine du blueprint attendue vision-ai.");
  assert(blueprint1.architecture.estimatedWidth === 5.2 && blueprint1.architecture.estimatedDepth === 4.1, "TEST 1: dimensions du blueprint non extraites.");
  assert(blueprint1.furniture.length === 4, "TEST 1: les 4 meubles de l'image ne sont pas dans le blueprint.");
  assert((blueprint1.architecture.openings || []).length === 2, "TEST 1: les ouvertures de l'image ne sont pas extraites.");

  const project1 = factory.createDesignProject("Test V8.2 — Japandi", "architecture");
  const furnishPlan = commandRuntime.fastDesignCommand(project1, "Aménage le Salon avec un style classique cossu");
  const start = commandRuntime.applyDesignActions(project1, furnishPlan.actions);
  const salon = start.plan.rooms.find((room) => /salon/i.test(room.name)) || start.plan.rooms[0];
  const beforeIds = start.plan.objects.filter((object) => object.roomId === salon.id).map((object) => object.id);
  const beforeNames = start.plan.objects.filter((object) => object.roomId === salon.id).map((object) => object.name);
  assert(beforeIds.length >= 4, `TEST 1: mise en place initiale insuffisante (${beforeIds.length} objets).`);

  const intent1 = intentRuntime.buildArchitectureIntent(start, "Transforme ce salon en style japandi", []);
  start.architecture = { ...start.architecture, designIntent: intent1, roomBlueprint: blueprint1, variationSeed: 20260906 };
  const plan1 = commandRuntime.fastDesignCommand(start, "Transforme ce salon en style japandi");
  assert(plan1, "TEST 1: aucun plan généré.");
  const rebuildAction = plan1.actions.find((action) => action.type === "rebuild_room");
  assert(rebuildAction, "TEST 1: l'action rebuild_room est absente — micro-modifications au lieu d'une reconstruction.");
  const after1 = commandRuntime.applyDesignActions(start, plan1.actions);
  const room1 = after1.plan.rooms.find((room) => room.id === salon.id);
  const objects1 = after1.plan.objects.filter((object) => object.roomId === salon.id);
  assert(objects1.length >= 6, `TEST 1: composition japandi trop pauvre (${objects1.length} objets).`);
  assert(objects1.some((object) => /canap/i.test(object.name) && /japandi/i.test(object.name)), "TEST 1: aucun NOUVEAU canapé japandi.");
  assert(objects1.filter((object) => object.metadata?.layoutAgent === "v8.2").length >= 5, "TEST 1: le Furniture Layout Agent n'a pas placé le mobilier.");
  const survivors = objects1.filter((object) => beforeIds.includes(object.id));
  assert(survivors.length === 0, `TEST 1: ${survivors.length} ancien(s) objet(s) ont survécu à la suppression.`);
  const sharedNames = objects1.map((object) => object.name).filter((name) => beforeNames.includes(name));
  assert(sharedNames.length === 0, `TEST 1: l'ancienne composition a été conservée (${sharedNames.join(", ")}).`);
  const floor1 = after1.materials.find((material) => material.id === room1.floorMaterialId)?.name || "";
  assert(/ch[eê]ne|bois|noyer|parquet/i.test(floor1), `TEST 1: sol bois clair japandi attendu, obtenu « ${floor1} ».`);
  assert(objects1.some((object) => /table basse/i.test(object.name)), "TEST 1: table basse absente de la nouvelle composition.");
  assert(objects1.some((object) => /fauteuil/i.test(object.name)), "TEST 1: fauteuils absents de la nouvelle composition.");
  const report1 = rebuildRuntime.rebuildRoomFromBlueprint(start, salon.name, { blueprint: blueprint1, intent: intent1, seed: 20260906 }).report;
  assert(report1.skipped.length <= 2, `TEST 1: trop de meubles non placés : ${report1.skipped.map((item) => `${item.name} (${item.reason})`).join(", ")}`);

  /* ================= TEST 2 — MÊME IMAGE → PALACE ROYAL ================= */
  const blueprint2 = blueprintRuntime.parseRoomBlueprint(beigeSalonVision, ["asset-vision-1"]);
  const intent2 = intentRuntime.buildArchitectureIntent(start, "Transforme ce salon en palace royal", []);
  assert(intent2.archetype === "palace", `TEST 2: archetype palace attendu, obtenu ${intent2.archetype}.`);
  start.architecture = { ...start.architecture, designIntent: intent2, roomBlueprint: blueprint2, variationSeed: 20260907 };
  const plan2 = commandRuntime.fastDesignCommand(start, "Transforme ce salon en palace royal");
  assert(plan2.actions.some((action) => action.type === "rebuild_room"), "TEST 2: rebuild_room absent — le style palace a déclenché une génération globale au lieu de transformer la pièce.");
  const after2 = commandRuntime.applyDesignActions(start, plan2.actions);
  const room2 = after2.plan.rooms.find((room) => room.id === salon.id);
  const objects2 = after2.plan.objects.filter((object) => object.roomId === salon.id);
  assert(objects2.length >= 7, `TEST 2: composition palace trop pauvre (${objects2.length} objets).`);
  assert(objects2.some((object) => /classique royal/i.test(object.name)), "TEST 2: mobilier classique royal absent.");
  assert(objects2.some((object) => /lustre/i.test(object.name)), "TEST 2: lustre/cristal absent du palace.");
  assert(objects2.some((object) => /tapis/i.test(object.name)), "TEST 2: tapis d'apparat absent.");
  const floor2 = after2.materials.find((material) => material.id === room2.floorMaterialId)?.name || "";
  assert(/marbre|travertin|pierre/i.test(floor2), `TEST 2: sol marbre attendu pour un palace, obtenu « ${floor2} ».`);
  assert(floor2 !== floor1, "TEST 2: les deux styles produisent le même sol — scènes identiques interdit.");
  const names1 = new Set(objects1.map((object) => object.name));
  const names2 = new Set(objects2.map((object) => object.name));
  const intersection = [...names1].filter((name) => names2.has(name)).length;
  const union = new Set([...names1, ...names2]).size;
  const jaccard = intersection / union;
  assert(jaccard <= .2, `TEST 2: scènes trop similaires (Jaccard ${jaccard.toFixed(2)}) — deux styles doivent donner deux univers radicalement différents.`);
  const positionsDiffer = objects1.filter((object) => names2.has(object.name)).every((object) => {
    const twin = objects2.find((other) => other.name === object.name);
    return Math.abs(twin.x - object.x) > .01 || Math.abs(twin.y - object.y) > .01;
  });
  assert(positionsDiffer, "TEST 2: des meubles homonymes occupent exactement la même place (template figé suspect).");

  /* ================= TEST 3 — VILLA ≠ PALAIS + VARIATION ================= */
  const buildProgram = (instruction, seed) => {
    const base = factory.createDesignProject(`Programme ${instruction}`, "architecture");
    const intent = intentRuntime.buildArchitectureIntent(base, instruction, []);
    base.architecture = { ...base.architecture, designIntent: intent, variationSeed: seed };
    const plan = commandRuntime.fastDesignCommand(base, instruction, seed);
    const action = plan.actions.find((item) => item.type === "apply_architecture_program");
    assert(action, `TEST 3: apply_architecture_program absent pour « ${instruction} ».`);
    return action.program;
  };
  const villaProgram = buildProgram("Crée une villa moderne et lumineuse", 101);
  const palaceProgram = buildProgram("Crée un palais majestueux et luxueux", 102);
  assert(palaceProgram.levels.length > villaProgram.levels.length || palaceProgram.wallHeight - villaProgram.wallHeight >= 1, "TEST 3: palais pas plus monumental que la villa.");
  assert(palaceProgram.wallHeight >= 4, `TEST 3: murs monumentaux ≥ 4 m attendus pour le palais (${palaceProgram.wallHeight}).`);
  assert(villaProgram.wallHeight <= 3.4, `TEST 3: murs villa ≤ 3,4 m attendus (${villaProgram.wallHeight}).`);
  const villaRoomNames = new Set(villaProgram.levels.flatMap((level) => level.rooms.map((room) => room.name)));
  const palaceRoomNames = new Set(palaceProgram.levels.flatMap((level) => level.rooms.map((room) => room.name)));
  const roomIntersection = [...villaRoomNames].filter((name) => palaceRoomNames.has(name)).length;
  const roomJaccard = roomIntersection / new Set([...villaRoomNames, ...palaceRoomNames]).size;
  assert(roomJaccard < .5, `TEST 3: programmes trop similaires (Jaccard pièces ${roomJaccard.toFixed(2)}).`);
  /* Deux graines différentes → deux compositions différentes (aucun template figé). */
  const villaA = buildProgram("Crée une villa moderne et lumineuse", 111);
  const villaB = buildProgram("Crée une villa moderne et lumineuse", 999);
  const dimsA = villaA.levels.flatMap((level) => level.rooms.map((room) => `${room.name}:${(room.width || 0).toFixed(1)}x${(room.depth || 0).toFixed(1)}`)).join("|");
  const dimsB = villaB.levels.flatMap((level) => level.rooms.map((room) => `${room.name}:${(room.width || 0).toFixed(1)}x${(room.depth || 0).toFixed(1)}`)).join("|");
  assert(dimsA !== dimsB, "TEST 3: deux graines différentes produisent exactement les mêmes dimensions (template figé).");
  const layoutA = rebuildRuntime.rebuildRoomFromBlueprint(commandRuntime.applyDesignActions(factory.createDesignProject("Graine A", "architecture"), commandRuntime.fastDesignCommand(factory.createDesignProject("Graine A", "architecture"), "Crée une villa moderne et lumineuse", 111).actions), "Salon", { blueprint: blueprint1, intent: intent1, seed: 111 });
  const layoutB = rebuildRuntime.rebuildRoomFromBlueprint(commandRuntime.applyDesignActions(factory.createDesignProject("Graine B", "architecture"), commandRuntime.fastDesignCommand(factory.createDesignProject("Graine B", "architecture"), "Crée une villa moderne et lumineuse", 999).actions), "Salon", { blueprint: blueprint1, intent: intent1, seed: 999 });
  assert(layoutA.project.plan.objects.some((object) => Math.abs((layoutB.project.plan.objects.find((other) => other.name === object.name)?.x ?? -99) - object.x) > .05), "TEST 3: le layout ne varie pas avec la graine.");

  /* ================= TEST 4 — ASSET INTELLIGENCE ================= */
  const palaceProject = factory.createDesignProject("Assets Palace", "architecture");
  const palaceIntent = intentRuntime.buildArchitectureIntent(palaceProject, "Transforme ce salon en palace royal", []);
  palaceProject.architecture = { ...palaceProject.architecture, designIntent: palaceIntent };
  const sculpturalPlan = assetIntel.expandAssetQueries("Table basse sculpturale en marbre", palaceProject);
  assert(sculpturalPlan.queries.length >= 3, `TEST 4: expansion trop pauvre (${sculpturalPlan.queries.length} requêtes).`);
  assert(!sculpturalPlan.queries.some((query) => /sculpturale/i.test(query)), "TEST 4: INTERDIT — une requête recherche le nom exact « table basse sculpturale ».");
  assert(sculpturalPlan.queries.every((query) => /coffee table/i.test(query)), "TEST 4: les requêtes doivent rester ancrées sur le type de meuble (coffee table).");
  assert(sculpturalPlan.queries.some((query) => /marble|stone|luxury|organic/i.test(query)), "TEST 4: l'intention (marbre/luxe/organique) n'est pas expandée.");
  const japandiPlan = assetIntel.expandAssetQueries("Canapé en lin beige", (() => { const p = factory.createDesignProject("Assets Japandi", "architecture"); const i = intentRuntime.buildArchitectureIntent(p, "Transforme ce salon en style japandi", []); p.architecture = { ...p.architecture, designIntent: i }; return p; })());
  assert(!japandiPlan.queries.some((query) => /lin beige/i.test(query)), "TEST 4: INTERDIT — recherche par nom exact (« lin beige »).");
  const gapProject = factory.createDesignProject("Gaps", "architecture");
  const gap = assetIntel.recordAssetGap(gapProject, "Fauteuil classique à médaillon", sculpturalPlan);
  assert(gap.message.includes("Je n'ai pas trouvé un asset Sketchfab compatible"), "TEST 4: message honnête de manque absent.");
  assert(gap.message.includes("placeholder premium temporaire"), "TEST 4: le placeholder temporaire n'est pas annoncé.");
  assert((gapProject.architecture?.assetGaps || []).length === 1, "TEST 4: le manque n'est pas enregistré dans architecture.assetGaps.");
  assert(gap.proposal.length > 10, "TEST 4: aucune alternative proposée pour le manque.");
  const summary = blueprintRuntime.blueprintSummaryLines(blueprint1);
  assert(summary.style && summary.materials && summary.layout && summary.furniture, "TEST 4: blueprintSummaryLines incomplet pour la carte IMAGE ANALYSÉE.");

  /* ================= TEST 5 — ROOM UNDERSTANDING ================= */
  const parsed = understanding.parseRoomBlueprint(beigeSalonVision, ["a"]);
  assert(parsed?.room === "salon" && parsed?.style === "classique beige cossu", "TEST 5: parseRoomBlueprint n'extrait pas room/style.");
  const invalid = understanding.parseRoomBlueprint("Cette image montre un joli salon mais aucun JSON.", ["a"]);
  assert(invalid === null, "TEST 5: un texte sans JSON doit retourner null (pas de blueprint inventé).");
  const resolution = await understanding.resolveRoomBlueprint({ instruction: "Transforme ce salon", references: [] });
  assert(resolution && typeof resolution.notice === "string", "TEST 5: resolveRoomBlueprint doit répondre honnêtement sans IA.");
  assert(resolution.blueprint === null || ["derived", "brain", "vision-ai"].includes(resolution.origin), "TEST 5: origine de blueprint invalide.");
  assert(typeof understanding.ROOM_UNDERSTANDING_VISION_PROMPT === "string" && understanding.ROOM_UNDERSTANDING_VISION_PROMPT.includes("estimatedWidth"), "TEST 5: le prompt Vision n'expose pas le schéma ROOM_BLUEPRINT.");

  console.log("SOPHENIC DESIGN V8.2 REAL AI DESIGN AGENT — TESTS OBLIGATOIRES : OK");
  console.log("  TEST 1 Salon→Japandi  : " + `${objects1.length} objets reconstruits · canapé/table/fauteuils japandi · sol « ${floor1} » · 0 ancien objet conservé · layout agent v8.2`);
  console.log("  TEST 2 Même image→Palace : " + `${objects2.length} objets · mobilier « classique royal » · lustre + tapis · sol « ${floor2} » · Jaccard TEST1/TEST2 ${jaccard.toFixed(2)}`);
  console.log("  TEST 3 Villa≠Palais    : " + `niveaux ${villaProgram.levels.length} vs ${palaceProgram.levels.length} · murs ${villaProgram.wallHeight} vs ${palaceProgram.wallHeight} m · Jaccard pièces ${roomJaccard.toFixed(2)} · graines 111/999 → compositions différentes`);
  console.log("  TEST 4 Asset Intel     : " + `« Table basse sculpturale en marbre » → ${sculpturalPlan.queries.length} requêtes (${sculpturalPlan.queries.slice(0, 3).join(" / ")}) · jamais le nom exact · gap enregistré + message honnête`);
  console.log("  TEST 5 Room Understand : " + `JSON Vision → blueprint (room/architecture/furniture/openings) · texte invalide → null · sans IA → notice honnête`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
