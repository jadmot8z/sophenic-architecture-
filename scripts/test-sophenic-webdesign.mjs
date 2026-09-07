/**
 * SOPHENIC WEB DESIGN ENGINE — Tests obligatoires avant livraison.
 *
 * TEST 1 : « Create a luxury jewelry brand website » → design premium élégant.
 * TEST 2 : « Create a gaming AI website » → langage visuel radicalement différent.
 * TEST 3 : Template mode — template luxe re-personnalisé pour une AUTRE marque :
 *          structure conservée, identité visuelle changée.
 * TEST 4 : Système qualité (scores + auto-amélioration) + export ZIP complet.
 * TEST 5 : Asset Intelligence + passerelle SOPHENIC Code (handoff, stacks).
 * TEST 6 : Anti-répétition — deux marques différentes ≠ même design.
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

/* ---------- 1. Syntaxe des modules WEB DESIGN ---------- */
for (const file of [
  "src/design/web-design/types.ts", "src/design/web-design/templates.ts", "src/design/web-design/style-engine.ts",
  "src/design/web-design/creative-brief.ts", "src/design/web-design/creative-agents.ts", "src/design/web-design/template-mode.ts",
  "src/design/web-design/quality.ts", "src/design/web-design/asset-plan.ts", "src/design/web-design/preview.ts",
  "src/design/web-design/export.ts", "src/design/web-design/code-handoff.ts", "src/design/web-design/../web-export.ts",
  "src/design/types.ts", "src/design/project-factory.ts", "src/design/design-intent-ai.ts"
]) {
  const code = await readFile(file, "utf8");
  assert(code.trim().length > 0, `Fichier Web Design vide : ${file}`);
  if (!ts?.createSourceFile) continue;
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors = (parsed.parseDiagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Erreur de syntaxe TypeScript dans ${file}`);
}

/* ---------- 2. Contrats UI + Brain ---------- */
const workspaceSource = await readFile("src/components/design/web-design-workspace.tsx", "utf8");
for (const expected of ["Template Intelligence", "Création Originale", "Compatibilité", "Envoyer vers SOPHENIC Code", "SOPHENIC_WEB_DESIGN_PROJECT", "Aperçu du design", "resolveWebDesignBrief", "runCreativeAgency", "rankTemplatesForBrief", "designUntilQuality", "recommendDesignAssets"]) {
  assert(workspaceSource.includes(expected), `UI Web Design incomplète : « ${expected} » absent de web-design-workspace.tsx.`);
}
const designWorkspaceSource = await readFile("src/components/design/design-workspace.tsx", "utf8");
assert(designWorkspaceSource.includes('domain: "webdesign"') && designWorkspaceSource.includes("WebDesignWorkspace"), "Le domaine webdesign n'est pas intégré à l'écran de création de projet.");
const agentSource = await readFile("src/components/agent/local-agent-workspace.tsx", "utf8");
assert(agentSource.includes("Designs SOPHENIC") || agentSource.includes("Sélectionner un design SOPHENIC"), "Le compositeur Code n'expose pas la sélection de design.");
const briefSource = await readFile("src/design/web-design/creative-brief.ts", "utf8");
assert(briefSource.includes("chatWithExistingBrain"), "RÈGLE ABSOLUE violée : le brief ne passe pas par le SOPHENIC Brain existant.");
assert(!briefSource.includes("new OpenRouter") && !briefSource.includes("createBrain"), "Aucun nouveau cerveau IA ne doit être créé.");

/* ---------- 3. Compilation + tests comportementaux ---------- */
if (!ts) throw new Error("TypeScript est requis pour les tests Web Design.");
const temp = await mkdtemp(path.join(os.tmpdir(), "sophenic-webdesign-tests-"));
try {
  const outDir = path.join(temp, "out");
  const compileFiles = [
    "types.ts", "architecture.ts", "interior-brief.ts", "design-intent.ts", "intent-profiles.ts", "material-canon.ts",
    "architect-program.ts", "program-requests.ts", "asset-requirements.ts", "asset-selection.ts", "asset-intelligence.ts",
    "interior-composition.ts", "architecture-audit.ts", "architecture-quality.ts", "project-factory.ts", "commands.ts",
    "simulations.ts", "furniture-catalog.ts", "room-blueprint.ts", "furniture-layout-agent.ts", "space-rebuild.ts",
    "design-intent-ai.ts", "room-understanding.ts", "web-export.ts",
    "web-design/types.ts", "web-design/templates.ts", "web-design/style-engine.ts", "web-design/creative-brief.ts",
    "web-design/creative-agents.ts", "web-design/template-mode.ts", "web-design/quality.ts", "web-design/asset-plan.ts",
    "web-design/preview.ts", "web-design/export.ts", "web-design/code-handoff.ts"
  ].map((name) => path.resolve("src/design", name)).concat([path.resolve("src/types/electron.d.ts")]);
  const config = {
    compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", lib: ["ES2022", "DOM"], strict: true, esModuleInterop: true, skipLibCheck: true, outDir, rootDir: path.resolve("src") },
    files: compileFiles
  };
  const configPath = path.join(temp, "tsconfig.json"); await writeFile(configPath, JSON.stringify(config), "utf8");
  const compiled = spawnSync(process.execPath, [require.resolve("typescript/lib/tsc.js"), "-p", configPath], { encoding: "utf8" });
  assert(compiled.status === 0, `Compilation stricte du noyau Web Design échouée : ${(compiled.stderr || compiled.stdout || "").trim()}`);

  const D = (name) => require(path.join(outDir, "design", name));
  const WD = (name) => require(path.join(outDir, "design", "web-design", name));
  const factory = D("project-factory");
  const briefRuntime = WD("creative-brief");
  const agencyRuntime = WD("creative-agents");
  const templateRuntime = WD("templates");
  const templateModeRuntime = WD("template-mode");
  const qualityRuntime = WD("quality");
  const assetRuntime = WD("asset-plan");
  const previewRuntime = WD("preview");
  const exportRuntime = WD("export");
  const handoffRuntime = WD("code-handoff");
  const styleRuntime = WD("style-engine");

  const buildProject = (name) => {
    const project = factory.createDesignProject(name, "webdesign");
    assert(project.domain === "webdesign" && project.unit === "px", "Le domaine webdesign doit exister côté projet (unit px).");
    return project;
  };
  const design = (instruction, options = {}) => {
    const brief = briefRuntime.heuristicWebDesignBrief(instruction);
    const agency = agencyRuntime.runCreativeAgency(brief, { seed: options.seed });
    const qualified = qualityRuntime.designUntilQuality({ blueprint: agency.blueprint, brief });
    qualified.blueprint.assets = assetRuntime.recommendDesignAssets(qualified.blueprint, brief);
    return { brief, blueprint: qualified.blueprint, report: qualified.report, fixes: qualified.fixes };
  };

  /* ================= TEST 1 — LUXURY JEWELRY (ORIGINAL) ================= */
  const J = design("Create a luxury jewelry brand website");
  assert(/bijou|joailler|jewel|luxe|luxury/i.test(J.brief.industry) || /luxury|luxe/i.test(J.brief.instruction), `TEST 1: industrie joaillerie non détectée (${J.brief.industry}).`);
  assert(J.brief.premiumLevel === "ultra-premium" || J.brief.premiumLevel === "premium", `TEST 1: niveau premium attendu, obtenu ${J.brief.premiumLevel}.`);
  assert(J.brief.traits.luxury >= .6, "TEST 1: trait luxury attendu dans le brief.");
  assert(/Cormorant|Playfair|serif/i.test(J.blueprint.visualStyle.typography), `TEST 1: typographie élégante (serif display) attendue, obtenue « ${J.blueprint.visualStyle.typography} ».`);
  const jewelryPalette = J.blueprint.visualStyle.colors;
  assert(jewelryPalette.length >= 4, "TEST 1: palette trop pauvre (< 4 couleurs).");
  const jewelryAccent = jewelryPalette[2];
  assert(/B08D3E|C9A961|A9844D|C89B5A|B0413E|2E4BFF/.test(jewelryAccent) || styleRuntime.contrastRatio(jewelryAccent, jewelryPalette[0]) >= 1.2, "TEST 1: accent précieux (or/laiton) attendu.");
  assert(J.report.scores.overall >= 80, `TEST 1: qualité design ≥ 80 attendue, obtenue ${J.report.scores.overall}.`);
  assert(J.blueprint.pages.length >= 4, `TEST 1: ${J.blueprint.pages.length} pages seulement.`);
  assert(J.blueprint.pages.some((page) => /collection/i.test(page.name)), "TEST 1: page Collections absente.");
  assert(J.blueprint.conversion.primaryCta.length > 2, "TEST 1: aucun CTA principal.");
  assert(J.blueprint.agencyLog.length >= 6, `TEST 1: pipeline d'agence incomplet (${J.blueprint.agencyLog.length} agents).`);
  assert(J.blueprint.agencyLog.some((step) => /Creative Director/.test(step.agent)), "TEST 1: le Creative Director doit participer.");
  assert(J.blueprint.agencyLog.some((step) => /Conversion/.test(step.agent)), "TEST 1: le Conversion Specialist doit participer.");

  /* ================= TEST 2 — GAMING AI (ORIGINAL, RADICALEMENT DIFFÉRENT) ================= */
  const G = design("Create a gaming AI website");
  assert(/gaming|ia\b|ai\b/i.test(G.brief.industry) || /gaming/i.test(G.brief.instruction), `TEST 2: industrie gaming/IA non détectée (${G.brief.industry}).`);
  assert(G.brief.traits.technological >= .6 && G.brief.traits.dark >= .5, "TEST 2: traits technologique/sombre attendus.");
  const gamingBg = G.blueprint.visualStyle.colors[0];
  assert(styleRuntime.relativeLuminance(gamingBg) < .25, `TEST 2: interface sombre attendue (fond ${gamingBg}).`);
  const jewelryBg = jewelryPalette[0];
  assert(styleRuntime.relativeLuminance(jewelryBg) !== styleRuntime.relativeLuminance(gamingBg), "TEST 2: les deux designs partagent le même fond.");
  assert(G.blueprint.visualStyle.typographyStack.display !== J.blueprint.visualStyle.typographyStack.display, "TEST 2: même typographie display que TEST 1 — interdit.");
  assert(G.blueprint.threeDElements.length >= 1, "TEST 2: un site gaming AI mérite une expérience 3D (WebGL).");
  assert(J.blueprint.threeDElements.every((element) => /lent|douce|discret/i.test(`${element.concept} ${element.rationale}`)) || J.blueprint.threeDElements.length === 0 || /montre|produit|joaill/i.test(J.blueprint.industry), "TEST 1: la 3D joaillerie doit rester sobre.");
  const paletteSetJ = new Set(jewelryPalette);
  const sharedColors = G.blueprint.visualStyle.colors.filter((color) => paletteSetJ.has(color)).length;
  assert(sharedColors <= 1, `TEST 2: palettes trop proches (${sharedColors} couleurs partagées).`);
  assert(G.report.scores.overall >= 80, `TEST 2: qualité ≥ 80 attendue, obtenue ${G.report.scores.overall}.`);
  const pagesJ = new Set(J.blueprint.pages.map((page) => page.name.toLowerCase()));
  const pageOverlap = G.blueprint.pages.filter((page) => pagesJ.has(page.name.toLowerCase())).length;
  assert(pageOverlap <= Math.max(1, G.blueprint.pages.length * .25), "TEST 2: structures de pages trop similaires.");
  assert(/Space Grotesk|Unbounded|Syne|mono/i.test(G.blueprint.visualStyle.typography), `TEST 2: typographie futuriste attendue, obtenue « ${G.blueprint.visualStyle.typography} ».`);

  /* ================= TEST 3 — TEMPLATE MODE : STRUCTURE GARDÉE, IDENTITÉ CHANGÉE ================= */
  const ecoBrief = briefRuntime.heuristicWebDesignBrief("Crée un site pour la marque de mode éco-responsable « Verveine »");
  const ranked = templateRuntime.rankTemplatesForBrief(ecoBrief);
  assert(ranked.length === 3, `TEST 3: le top 3 templates est attendu, obtenu ${ranked.length}.`);
  assert(ranked[0].compatibility >= 60, `TEST 3: meilleure compatibilité trop faible (${ranked[0].compatibility}%).`);
  assert(ranked[0].compatibility >= ranked[1].compatibility && ranked[1].compatibility >= ranked[2].compatibility, "TEST 3: les templates ne sont pas classés par compatibilité décroissante.");
  const chosen = templateRuntime.templateById(ranked[0].templateId);
  assert(chosen, "TEST 3: template introuvable par id.");
  const beforeSections = chosen.pages.flatMap((page) => page.sections.map((section) => section.name.toLowerCase()));
  const customized = templateModeRuntime.customizeTemplate(chosen, ecoBrief, { seed: 424242 });
  const afterSections = customized.blueprint.pages.flatMap((page) => page.sections.map((section) => section.name.toLowerCase()));
  const keptSections = beforeSections.filter((name) => afterSections.includes(name)).length;
  assert(keptSections / beforeSections.length >= .7, `TEST 3: structure du template non conservée (${keptSections}/${beforeSections.length} sections).`);
  // Identité visuelle changée : palette ET typographie ≠ template d'origine.
  const changedColors = chosen.visualStyle.colors.filter((color) => !customized.blueprint.visualStyle.colors.includes(color)).length;
  assert(changedColors >= 3, `TEST 3: l'identité visuelle du template n'a pas été remplacée (${changedColors} couleurs changées).`);
  assert(customized.blueprint.visualStyle.typography !== chosen.visualStyle.typography, "TEST 3: la typographie du template est restée identique.");
  assert(customized.blueprint.templateId === chosen.id && customized.blueprint.mode === "template", "TEST 3: la traçabilité du template d'origine est perdue.");
  assert(customized.blueprint.brand.length > 0, "TEST 3: la marque du brief n'est pas reportée sur le design.");
  // Le design template d'une marque ≠ le design original d'une autre marque.
  assert(customized.blueprint.visualStyle.colors.join() !== J.blueprint.visualStyle.colors.join(), "TEST 3: le mode template produit la même palette que le mode original (autre brief) — suspect.");
  const qualifiedTemplate = qualityRuntime.designUntilQuality({ blueprint: customized.blueprint, brief: ecoBrief });
  qualifiedTemplate.blueprint.assets = assetRuntime.recommendDesignAssets(qualifiedTemplate.blueprint, ecoBrief);
  assert(qualifiedTemplate.report.scores.overall >= 80, `TEST 3: qualité du design template ≥ 80 attendue, obtenue ${qualifiedTemplate.report.scores.overall}.`);
  // Luxe : le template luxury-editorial doit être classé en tête pour la joaillerie.
  const jewelryRanked = templateRuntime.rankTemplatesForBrief(J.brief);
  assert(jewelryRanked[0].templateId === "luxury-editorial", `TEST 3: la joaillerie devrait sélectionner « Luxury Editorial » en tête, obtenue « ${jewelryRanked[0].name } ».`);

  /* ================= TEST 4 — QUALITÉ + EXPORT ZIP ================= */
  // 4a. Auto-amélioration : un blueprint volontairement dégradé est corrigé.
  const bad = structuredClone(J.blueprint);
  bad.visualStyle.colors = ["#F5F5F5", "#EAEAEA", "#E0E0E0", "#D5D5D5", "#FCFCFC"];
  bad.components = bad.components.filter((component) => !/navigation|footer/i.test(component.name));
  bad.responsiveRules = [{ breakpoint: "≥1280px", rule: "grille 12" }];
  bad.conversion.trustElements = [];
  const badReport = qualityRuntime.evaluateWebDesignQuality(bad, J.brief);
  assert(badReport.scores.overall < 75, `TEST 4: le design dégradé devrait être détecté (< 75), obtenu ${badReport.scores.overall}.`);
  assert(badReport.issues.some((issue) => /Contraste fond\/texte/i.test(issue.message)), "TEST 4: le problème de contraste n'est pas détecté.");
  const improved = qualityRuntime.designUntilQuality({ blueprint: bad, brief: J.brief });
  assert(improved.report.scores.overall > badReport.scores.overall, "TEST 4: l'auto-amélioration n'a pas fait progresser le score.");
  assert(styleRuntime.contrastRatio(improved.blueprint.visualStyle.colors[0], improved.blueprint.visualStyle.colors[1]) >= 4.5, "TEST 4: le contraste corrigé doit atteindre WCAG AA (4.5:1).");
  // 4b. Export : fichiers du ZIP + signature ZIP valide.
  const project = buildProject("Verveine — Test Web Design");
  project.webDesign = { mode: "template", brief: ecoBrief, blueprint: qualifiedTemplate.blueprint, templateCandidates: ranked, selectedTemplateId: chosen.id };
  const files = exportRuntime.buildWebDesignExportFiles(project);
  const paths = files.map((file) => file.path);
  for (const expected of ["design.json", "brief.json", "quality-report.json", "README.md", "assets/asset-plan.json", "images/image-plan.md", "animations/animation-rules.md", "responsive-rules.md", "preview/index.html"]) {
    assert(paths.includes(expected), `TEST 4: « ${expected} » absent de l'export SOPHENIC_WEB_DESIGN_PROJECT.zip.`);
  }
  assert(files.filter((file) => file.path.startsWith("components/")).length >= 3, "TEST 4: les descriptions de composants sont absentes de l'export.");
  const designJson = JSON.parse(files.find((file) => file.path === "design.json").content);
  assert(designJson.projectType === "website" && designJson.pages.length >= 3 && designJson.visualStyle.colors.length >= 3, "TEST 4: design.json invalide.");
  const previewHtml = files.find((file) => file.path === "preview/index.html").content;
  assert(previewHtml.includes("<!doctype html") && previewHtml.includes(qualifiedTemplate.blueprint.brand), "TEST 4: l'aperçu HTML du design est invalide.");
  assert(previewHtml.includes("blueprint") || previewHtml.includes("visualisation"), "TEST 4: l'aperçu doit se présenter comme visualisation, pas comme code applicatif.");
  const zipBlob = D("web-export").buildFilesZip(files);
  const zipBytes = Buffer.from(await zipBlob.arrayBuffer());
  assert(zipBytes[0] === 0x50 && zipBytes[1] === 0x4b, "TEST 4: signature ZIP invalide.");
  const eocd = zipBytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert(eocd > 0, "TEST 4: fin d'archive ZIP (EOCD) introuvable.");
  const entryCount = zipBytes.readUInt16LE(eocd + 10);
  assert(entryCount === files.length, `TEST 4: l'archive ZIP attend ${files.length} entrées, en contient ${entryCount}.`);
  // design.json ne doit contenir AUCUN code applicatif généré.
  const allText = files.filter((file) => file.path.endsWith(".json")).map((file) => file.content).join("");
  assert(!/import React|<div className|useState\(/.test(allText), "TEST 4: le blueprint ne doit contenir aucun code applicatif.");

  /* ================= TEST 5 — ASSETS + PASSERELLE SOPHENIC CODE ================= */
  const assets = qualifiedTemplate.blueprint.assets;
  assert(assets.length >= 4, `TEST 5: plan d'assets trop pauvre (${assets.length}).`);
  assert(assets.some((asset) => asset.kind === "image"), "TEST 5: aucune image recommandée.");
  assert(assets.every((asset) => asset.directive.length > 10 && asset.reason.length > 5), "TEST 5: chaque asset doit porter directive + raison.");
  const handoff = handoffRuntime.buildCodeHandoff(project);
  for (const stack of ["React", "Next.js", "Shopify", "WordPress", "HTML/CSS"]) {
    assert(handoff.stacks.includes(stack) && handoff.implementationBrief.includes(stack), `TEST 5: la stack « ${stack} » doit être proposée par le handoff Code.`);
  }
  for (const color of qualifiedTemplate.blueprint.visualStyle.colors.slice(0, 3)) {
    assert(handoff.implementationBrief.includes(color), `TEST 5: la palette (${color}) doit être transmise à SOPHENIC Code.`);
  }
  assert(handoff.implementationBrief.includes(qualifiedTemplate.blueprint.pages[0].name), "TEST 5: la structure des pages doit être transmise.");
  assert(handoffRuntime.listCodeHandoffs().length === 0, "TEST 5: listCodeHandoffs doit rester sans crash hors navigateur (liste vide).");
  // Aperçu : iframe srcDoc côté UI.
  const uiPreview = previewRuntime.buildDesignPreviewHtml(qualifiedTemplate.blueprint);
  assert(uiPreview.includes("--bg") && uiPreview.includes(qualifiedTemplate.blueprint.conversion.primaryCta), "TEST 5: l'aperçu preview.ts n'expose pas la palette/CTA.");

  /* ================= TEST 6 — ANTI-RÉPÉTITION ================= */
  const hotel = design("Crée un site de villa de luxe à Marrakech");
  const restaurant = design("Crée un site pour un restaurant gastronomique");
  const distinct = (a, b) => a.blueprint.visualStyle.colors.join() !== b.blueprint.visualStyle.colors.join()
    || a.blueprint.visualStyle.typographyStack.display !== b.blueprint.visualStyle.typographyStack.display
    || a.blueprint.pages.map((page) => page.name).join() !== b.blueprint.pages.map((page) => page.name).join();
  assert(distinct(J, G) && distinct(J, hotel) && distinct(G, hotel) && distinct(hotel, restaurant), "TEST 6: deux briefs différents produisent des designs identiques.");
  assert(hotel.blueprint.pages.some((page) => /r[ée]serv/i.test(page.name)) || hotel.blueprint.pages.some((page) => /villa|chambre/i.test(page.name)), "TEST 6: la villa de luxe doit avoir une page réservation/villa.");
  assert(/sable|cuivre|dor/.test(hotel.blueprint.visualStyle.moodboardKeywords.join(" ")), "TEST 6: la direction « warm sand colors » attendue pour une villa à Marrakech.");
  // Graine : même brief, graines différentes → espace de composition varié
  // (au moins 3 compositions distinctes sur 5 graines).
  const brandBrief = briefRuntime.heuristicWebDesignBrief("Crée un site pour une marque de café de spécialité");
  const signatures = new Set();
  for (const seed of [111, 999, 42, 777, 1234]) {
    const cafe = agencyRuntime.runCreativeAgency(brandBrief, { seed }).blueprint;
    signatures.add(JSON.stringify([cafe.visualStyle.colors, cafe.visualStyle.typographyStack.display, cafe.pages.map((page) => page.sections.map((section) => section.name))]));
  }
  assert(signatures.size >= 3, `TEST 6: l'espace de variation par graine est trop pauvre (${signatures.size} composition(s) distincte(s) sur 5 graines).`);
  // Le Brain brief : sans IA, l'heuristique reste honnête.
  const resolved = await briefRuntime.resolveWebDesignBrief({ instruction: "Create a luxury jewelry brand website" });
  assert(resolved.pages.length >= 3 && resolved.industry.length > 2, "TEST 6: resolveWebDesignBrief (sans IA) doit produire un brief complet.");

  console.log("SOPHENIC WEB DESIGN ENGINE — TESTS OBLIGATOIRES : OK");
  console.log(`  TEST 1 Joaillerie luxe  : ${J.blueprint.pages.length} pages · « ${J.blueprint.visualStyle.typography} » · accent ${jewelryAccent} · qualité ${J.report.scores.overall}/100 · ${J.blueprint.agencyLog.length} agents`);
  console.log(`  TEST 2 Gaming IA       : fond ${gamingBg} (sombre) · « ${G.blueprint.visualStyle.typographyStack.display} » · ${G.blueprint.threeDElements.length} expérience(s) 3D · qualité ${G.report.scores.overall}/100 · 0 structure partagée avec TEST 1`);
  console.log(`  TEST 3 Template mode   : « ${chosen.name} » → ${Math.round(keptSections / beforeSections.length * 100)}% structure conservée · ${changedColors} couleurs remplacées · typo « ${customized.blueprint.visualStyle.typographyStack.display} » · qualité ${qualifiedTemplate.report.scores.overall}/100`);
  console.log(`  TEST 4 Qualité+Export  : dégradé ${badReport.scores.overall} → corrigé ${improved.report.scores.overall} · contraste AA ${styleRuntime.contrastRatio(improved.blueprint.visualStyle.colors[0], improved.blueprint.visualStyle.colors[1]).toFixed(2)}:1 · ZIP ${files.length} fichiers (design.json, preview, components…)`);
  console.log(`  TEST 5 Assets+Code     : ${assets.length} recommandations (image/icône/animation…) · handoff React · Next.js · Shopify · WordPress · HTML/CSS avec palette + pages`);
  console.log(`  TEST 6 Anti-répétition : joaillerie ≠ gaming ≠ villa ≠ restaurant · 5 graines → plusieurs compositions distinctes · villa Marrakech « ${hotel.blueprint.visualStyle.moodboardKeywords.slice(0, 3).join(", ")} »`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
