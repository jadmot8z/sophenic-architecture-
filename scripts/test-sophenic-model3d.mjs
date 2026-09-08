/**
 * SOPHENIC MODEL 3D ENGINE — Tests obligatoires avant livraison. (V8.5)
 *
 * Le Design 3D devient un moteur de sélection Sketchfab : demande → brief
 * (Brain, expansion multi-requêtes JAMAIS le nom exact seul) → 5 meilleurs
 * modèles proposés → exploration 3D interactive (caméra libre façon Blender)
 * → téléchargement en bibliothèque. Aucun asset inventé (gaps honnêtes).
 */
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(path.resolve("package.json"));
const tsModule = await import("typescript").catch(() => null);
const ts = tsModule?.default || tsModule;
const assert = (value, message) => { if (!value) throw new Error(message); };

/* ---------- 1. Syntaxe des modules MODEL 3D ---------- */
for (const file of [
  "src/design/model-3d/types.ts", "src/design/model-3d/model-brief.ts", "src/design/model-3d/model-gallery.ts",
  "src/components/design/model-3d-workspace.tsx", "src/components/design/model-3d-viewer.tsx"
]) {
  const code = await readFile(file, "utf8");
  assert(code.trim().length > 0, `Fichier Model 3D vide : ${file}`);
  if (!ts?.createSourceFile) continue;
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
  const errors = (parsed.parseDiagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Erreur de syntaxe TypeScript dans ${file}`);
}

/* ---------- 2. Contrats UI + Brain ---------- */
const workspaceSource = await readFile("src/components/design/model-3d-workspace.tsx", "utf8");
for (const expected of ["Sketchfab Model Intelligence", "✦ SOPHENIC AI", "Voir en 3D", "Télécharger", "Ma bibliothèque", "Caméra libre", "resolveModel3DBrief", "searchModelGallery", "Écarts enregistrés"]) {
  assert(workspaceSource.includes(expected), `UI Model 3D incomplète : « ${expected} » absent de model-3d-workspace.tsx.`);
}
const viewerSource = await readFile("src/components/design/model-3d-viewer.tsx", "utf8");
for (const expected of ["OrbitControls", "enablePan", "zoomToCursor", "enableDamping", "GLTFLoader", "DRACOLoader", "SOPHENIC AI", "orbiter"]) {
  assert(viewerSource.includes(expected), `Visionneuse 3D incomplète : « ${expected} » absent de model-3d-viewer.tsx.`);
}
const designWorkspaceSource = await readFile("src/components/design/design-workspace.tsx", "utf8");
assert(designWorkspaceSource.includes("Model3DWorkspace"), "L'atelier Model 3D n'est pas câblé dans design-workspace.tsx.");
assert(designWorkspaceSource.includes("5 meilleurs modèles Sketchfab"), "La carte Design 3D doit annoncer la recherche des 5 meilleurs modèles Sketchfab.");
assert(designWorkspaceSource.includes("caméra libre façon Blender"), "La carte Design 3D doit annoncer l'exploration caméra libre.");
const briefSource = await readFile("src/design/model-3d/model-brief.ts", "utf8");
assert(briefSource.includes("chatWithExistingBrain"), "RÈGLE ABSOLUE violée : le brief Model 3D ne passe pas par le SOPHENIC Brain existant.");
assert(!briefSource.includes("new OpenRouter") && !briefSource.includes("createBrain"), "Aucun nouveau cerveau IA ne doit être créé.");
const gallerySource = await readFile("src/design/model-3d/model-gallery.ts", "utf8");
assert(gallerySource.includes("refuse d'inventer"), "L'honnêteté anti-invention d'assets doit être explicite dans la galerie.");
const typesSource = await readFile("src/design/types.ts", "utf8");
assert(typesSource.includes("model-3d/types"), "DesignProject doit exposer l'état model3d.");
const factorySource = await readFile("src/design/project-factory.ts", "utf8");
assert(factorySource.includes('model3d: domain === "product" ? { library: [] } : undefined'), "Les nouveaux projets Design 3D doivent initialiser l'état model3d.");

/* ---------- 3. Compilation + tests comportementaux ---------- */
if (!ts) throw new Error("TypeScript est requis pour les tests Model 3D.");
const temp = await mkdtemp(path.join(os.tmpdir(), "sophenic-model3d-tests-"));
try {
  const outDir = path.join(temp, "out");
  const compileFiles = [
    "types.ts", "architecture.ts", "interior-brief.ts", "design-intent.ts", "intent-profiles.ts", "material-canon.ts",
    "architect-program.ts", "program-requests.ts", "asset-requirements.ts", "asset-selection.ts", "asset-intelligence.ts",
    "interior-composition.ts", "architecture-audit.ts", "architecture-quality.ts", "project-factory.ts", "commands.ts",
    "simulations.ts", "furniture-catalog.ts", "room-blueprint.ts", "furniture-layout-agent.ts", "space-rebuild.ts",
    "design-intent-ai.ts", "room-understanding.ts", "web-export.ts",
    "web-design/types.ts", "web-design/templates.ts", "web-design/style-engine.ts", "web-design/creative-brief.ts",
    "web-design/template-mode.ts", "web-design/quality.ts", "web-design/asset-plan.ts",
    "web-design/preview.ts", "web-design/export.ts", "web-design/code-handoff.ts",
    "model-3d/types.ts", "model-3d/model-brief.ts", "model-3d/model-gallery.ts"
  ].map((name) => path.resolve("src/design", name)).concat([path.resolve("src/types/electron.d.ts")]);
  const config = {
    compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", lib: ["ES2022", "DOM"], strict: true, esModuleInterop: true, skipLibCheck: true, outDir, rootDir: path.resolve("src") },
    files: compileFiles
  };
  const configPath = path.join(temp, "tsconfig.json"); await writeFile(configPath, JSON.stringify(config), "utf8");
  const compiled = spawnSync(process.execPath, [require.resolve("typescript/lib/tsc.js"), "-p", configPath], { encoding: "utf8" });
  assert(compiled.status === 0, `Compilation stricte du noyau Model 3D échouée : ${(compiled.stderr || compiled.stdout || "").trim()}`);

  const M3D = (name) => require(path.join(outDir, "design", "model-3d", name));
  const briefRuntime = M3D("model-brief");
  const galleryRuntime = M3D("model-gallery");

  /* ================= TEST 1 — EXPANSION MULTI-REQUÊTES (ANTI NOM EXACT) ================= */
  const sofaBrief = briefRuntime.heuristicModel3DBrief("Un canapé scandinave en chêne clair pour mon salon");
  assert(sofaBrief.objectTerms.includes("sofa"), `TEST 1: terme objet « sofa » attendu, obtenu ${JSON.stringify(sofaBrief.objectTerms)}.`);
  assert(sofaBrief.styleHints.includes("scandinavian"), "TEST 1: style « scandinavian » attendu.");
  assert(sofaBrief.materialHints.includes("oak"), "TEST 1: matériau « oak » attendu.");
  assert(sofaBrief.queries.length >= 3, `TEST 1: au moins 3 requêtes expandues attendues, obtenu ${sofaBrief.queries.length}.`);
  const objectWords = new Set(sofaBrief.objectTerms.map((term) => term.toLowerCase()));
  for (const query of sofaBrief.queries) {
    const words = query.toLowerCase().split(/\s+/);
    const hasModifier = words.some((word) => !objectWords.has(word));
    assert(hasModifier, `TEST 1: la requête « ${query} » se résume au nom objet — interdit (règle anti-recherche-exacte).`);
    assert(query !== "un canapé scandinave en chêne clair pour mon salon", "TEST 1: la demande brute ne doit jamais être une requête.");
  }
  assert(sofaBrief.queries.some((query) => /scandinavian/.test(query)) && sofaBrief.queries.some((query) => /oak/.test(query)), `TEST 1: les requêtes doivent combiner style et matériau, obtenu ${JSON.stringify(sofaBrief.queries)}.`);
  assert(sofaBrief.premium, "TEST 1: un canapé scandinave en chêne est une demande premium (réaliste).");

  /* ================= TEST 2 — DEMANDES VAGUES ET STYLISÉES ================= */
  const vagueBrief = briefRuntime.heuristicModel3DBrief("quelque chose de joli");
  assert(vagueBrief.queries.length >= 3, `TEST 2: une demande vague doit quand même produire ≥ 3 requêtes de qualité générique, obtenu ${vagueBrief.queries.length}.`);
  const stylizedBrief = briefRuntime.heuristicModel3DBrief("un dragon low-poly style minecraft");
  assert(!stylizedBrief.premium, "TEST 2: une demande low-poly explicite n'est pas premium.");
  assert(stylizedBrief.queries.some((query) => /low poly|stylized/.test(query)), "TEST 2: les requêtes low-poly doivent rester stylisées.");
  const resolved = await briefRuntime.resolveModel3DBrief({ request: "Un canapé scandinave en chêne clair" });
  assert(resolved.origin === "heuristic" && (resolved.notice || "").length > 0, "TEST 2: sans IA joignable, le brief heuristique doit porter une notice honnête.");
  assert(resolved.queries.length >= 3, "TEST 2: le brief résolu (sans IA) doit rester complet.");

  /* ================= TEST 3 — MERGE BRAIN (REQUÊTES NON EXPANDÉES REJETÉES) ================= */
  const base = briefRuntime.heuristicModel3DBrief("Une lampe design en laiton brossé");
  const merged = briefRuntime.mergeBrainModelBrief(base, {
    objectTerms: ["lamp"],
    styleHints: ["modern"],
    materialHints: ["brass"],
    queries: ["lamp", "modern brass lamp pbr", "brass lamp detailed", "industrial lamp metal"],
    premium: true
  });
  assert(!merged.queries.includes("lamp"), "TEST 3: une requête réduite au nom objet doit être rejetée du merge Brain.");
  assert(merged.queries.length >= 3 && merged.queries.includes("modern brass lamp pbr"), "TEST 3: les requêtes expandues du Brain doivent être conservées.");
  assert(merged.origin === "brain" && merged.materialHints.includes("brass"), "TEST 3: le merge doit marquer l'origine brain et intégrer les matériaux.");

  /* ================= TEST 4 — CLASSEMENT : TOP 5, DÉDOUBLONNAGE, LICENCE ================= */
  const rankBrief = { request: "canapé scandinave", objectTerms: ["sofa"], styleHints: ["scandinavian"], materialHints: ["oak"], queries: ["scandinavian oak sofa", "oak sofa pbr"], premium: true, origin: "heuristic" };
  const asset = (sourceId, name, tags, extra = {}) => ({
    provider: "sketchfab", sourceId, name, sourceUrl: `https://sketchfab.com/models/${sourceId}`, downloadable: true,
    license: "CC Attribution", tags, ...(extra.license === null ? { license: undefined } : {}), ...extra
  });
  const ranked = galleryRuntime.rankModelCandidates([
    { asset: asset("a1", "Scandinavian Oak Sofa", ["scandinavian", "oak", "sofa"], { staffPicked: true, likeCount: 900, faceCount: 120000 }), query: "scandinavian oak sofa" },
    { asset: asset("a1", "Scandinavian Oak Sofa", ["scandinavian", "oak", "sofa"], { staffPicked: true, likeCount: 900, faceCount: 120000 }), query: "oak sofa pbr" },
    { asset: asset("a2", "Plastic Sofa", ["sofa"], { likeCount: 3 }), query: "scandinavian oak sofa" },
    { asset: asset("a3", "Oak Couch", ["oak", "couch"], { likeCount: 120, faceCount: 90000 }), query: "oak sofa pbr" },
    { asset: asset("a4", "No License Sofa", ["sofa"], { license: null }), query: "scandinavian oak sofa" },
    { asset: asset("a5", "Locked Sofa", ["sofa"], { downloadable: false }), query: "scandinavian oak sofa" },
    { asset: asset("a6", "Placeholder sofa", ["placeholder"], {}), query: "scandinavian oak sofa" },
    { asset: asset("a7", "Medieval Sofa", ["medieval"], {}), query: "scandinavian oak sofa" }
  ], rankBrief);
  assert(ranked.length === 5, `TEST 4: le top 5 est attendu, obtenu ${ranked.length}.`);
  assert(ranked[0].asset.sourceId === "a1", `TEST 4: le meilleur modèle doit être en tête, obtenu ${ranked[0].asset.sourceId}.`);
  assert(new Set(ranked.map((row) => row.asset.sourceId)).size === ranked.length, "TEST 4: doublons non dédoublonnés par sourceId.");
  assert(!ranked.some((row) => row.asset.sourceId === "a4"), "TEST 4: un asset sans licence doit être rejeté.");
  assert(!ranked.some((row) => row.asset.sourceId === "a5"), "TEST 4: un asset non téléchargeable doit être rejeté.");
  for (let index = 1; index < ranked.length; index += 1) {
    assert(ranked[index - 1].compatibility >= ranked[index].compatibility, "TEST 4: compatibilités non triées par ordre décroissant.");
  }
  assert(ranked.every((row) => row.compatibility >= 5 && row.compatibility <= 99), "TEST 4: compatibilité hors bornes 5-99.");
  assert(ranked[0].reasons.length > 0 && ranked[0].query.length > 0, "TEST 4: chaque candidat doit porter raisons + requête d'origine.");

  /* ================= TEST 5 — GALERIE : MULTI-REQUÊTES + HONNÊTETÉ ================= */
  const calls = [];
  const okSearch = async (query, limit) => {
    calls.push(query);
    assert(limit === 12, "TEST 5: la recherche Sketchfab doit demander 12 résultats par requête.");
    if (/scandinavian/.test(query)) return [asset("b1", "Scandinavian Oak Sofa", ["scandinavian", "oak"], { staffPicked: true, likeCount: 500, faceCount: 80000 }), asset("b2", "Nordic Sofa", ["nordic"], { likeCount: 40 })];
    if (/oak/.test(query)) return [asset("b3", "Oak Wood Couch", ["oak", "wood"], { likeCount: 90, faceCount: 60000 })];
    return [];
  };
  const gallery = await galleryRuntime.searchModelGallery(rankBrief, okSearch);
  assert(gallery.candidates.length >= 2 && gallery.candidates.length <= 5, `TEST 5: 2 à 5 candidats attendus, obtenu ${gallery.candidates.length}.`);
  assert(gallery.gaps.length === 0, "TEST 5: aucune gap ne doit être enregistrée quand des modèles sont trouvés.");
  assert(calls.length === rankBrief.queries.length, `TEST 5: TOUTES les requêtes expandues doivent être exécutées (${calls.length}/${rankBrief.queries.length}).`);
  assert(calls.every((query) => query !== rankBrief.request), "TEST 5: la demande brute ne doit jamais être envoyée telle quelle à Sketchfab.");
  const emptyGallery = await galleryRuntime.searchModelGallery(rankBrief, async () => []);
  assert(emptyGallery.candidates.length === 0 && emptyGallery.gaps.length === 1, "TEST 5: zéro résultat doit produire exactement une gap honnête.");
  assert(/refuse d'inventer/.test(emptyGallery.gaps[0].reason), "TEST 5: le message de gap doit expliciter le refus d'inventer un asset.");
  const failingGallery = await galleryRuntime.searchModelGallery(rankBrief, async (query) => { if (/scandinavian/.test(query)) return [asset("c1", "Scandinavian Sofa", ["scandinavian"], { likeCount: 10 })]; throw new Error("HTTP 429"); });
  assert(failingGallery.candidates.length === 1, "TEST 5: les requêtes réussies doivent être conservées même si d'autres échouent.");
  assert(failingGallery.gaps.some((gap) => /429/.test(gap.reason)), "TEST 5: l'échec d'une requête doit être enregistré comme gap avec sa raison.");

  console.log("SOPHENIC MODEL 3D ENGINE — TESTS OBLIGATOIRES : OK");
  console.log(`  TEST 1 Expansion      : « canapé scandinave en chêne » → ${sofaBrief.queries.length} requêtes (${sofaBrief.queries.slice(0, 3).join(" · ")}) — jamais le nom exact seul`);
  console.log(`  TEST 2 Robustesse     : demande vague → ${vagueBrief.queries.length} requêtes · low-poly → premium=${stylizedBrief.premium} · sans IA → notice honnête`);
  console.log(`  TEST 3 Merge Brain    : requête « lamp » (nom exact) rejetée · ${merged.queries.length} requêtes expandues conservées · origine ${merged.origin}`);
  console.log(`  TEST 4 Classement     : top ${ranked.length} dédoublonné · sans-licence et non-téléchargeable rejetés · tête « ${ranked[0].asset.name} » (${ranked[0].compatibility}%)`);
  console.log(`  TEST 5 Galerie+honnêteté : ${calls.length} requêtes exécutées · ${gallery.candidates.length} candidats · zéro résultat → gap « refuse d'inventer » · échec 429 enregistré`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
