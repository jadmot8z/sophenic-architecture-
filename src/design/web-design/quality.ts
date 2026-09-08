import { contrastRatio, shiftColorForContrast } from "./style-engine";
import type { WebDesignBlueprint, WebDesignBrief, WebDesignQualityIssue, WebDesignQualityReport, WebDesignQualityScores } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — AI DESIGN QUALITY SYSTEM.
 *
 * Évaluation automatique avant finalisation : Visual / UX / Conversion /
 * Brand / Mobile (0-100), liste d'issues actionnables, puis boucle
 * d'auto-amélioration (le design est corrigé puis réévalué).
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Évalue la qualité du blueprint. Aucune mutation. */
export function evaluateWebDesignQuality(blueprint: WebDesignBlueprint, brief: WebDesignBrief): WebDesignQualityReport {
  const issues: WebDesignQualityIssue[] = [];
  const colors = blueprint.visualStyle.colors;
  const background = colors[0] || "#FFFFFF";
  const foreground = colors[1] || "#111111";
  const accent = colors[2] || foreground;

  /* ---- Visual ---- */
  let visual = 58;
  const bgFgContrast = contrastRatio(background, foreground);
  if (bgFgContrast >= 4.5) visual += 14;
  else if (bgFgContrast >= 3) visual += 5;
  else issues.push({ area: "visual", severity: bgFgContrast < 2.4 ? "high" : "medium", message: `Contraste fond/texte insuffisant (${bgFgContrast.toFixed(2)}:1, WCAG AA attendu 4.5:1) — hero et corps de texte peu lisibles.`, autoFixable: true });
  const accentContrast = contrastRatio(accent, background);
  if (accentContrast >= 3) visual += 8;
  else issues.push({ area: "visual", severity: "medium", message: `Accent peu discernable du fond (${accentContrast.toFixed(2)}:1) — CTA et liens perdent en visibilité.`, autoFixable: true });
  if (colors.length >= 3 && colors.length <= 6) visual += 8;
  else if (colors.length > 6) issues.push({ area: "visual", severity: "low", message: "Palette trop large (plus de 6 couleurs) — hiérarchie visuelle diluée.", autoFixable: true });
  if (blueprint.visualStyle.typographyStack.display && blueprint.visualStyle.typographyStack.body) visual += 10;
  else issues.push({ area: "visual", severity: "high", message: "Typographie incomplète (display/corps) — hiérarchie illisible.", autoFixable: true });
  if (blueprint.visualStyle.animations.length >= 2 && blueprint.visualStyle.animations.length <= 6) visual += 4;
  else if (blueprint.visualStyle.animations.length > 6) issues.push({ area: "visual", severity: "low", message: "Trop d'animations déclarées — risque de fouillis perceptuel.", autoFixable: true });

  /* ---- UX ---- */
  let ux = 56;
  const pageCount = blueprint.pages.length;
  if (pageCount >= 3 && pageCount <= 8) ux += 16;
  else if (pageCount < 3) issues.push({ area: "ux", severity: "medium", message: "Moins de 3 pages : parcours trop court pour raconter et convertir.", autoFixable: false });
  else issues.push({ area: "ux", severity: "low", message: "Plus de 8 pages : navigation à clarifier (regrouper).", autoFixable: false });
  const sectionsPerPage = blueprint.pages.map((page) => page.sections.length);
  const avgSections = sectionsPerPage.length ? sectionsPerPage.reduce((sum, count) => sum + count, 0) / sectionsPerPage.length : 0;
  if (avgSections >= 3 && avgSections <= 8) ux += 12;
  else if (avgSections < 3) issues.push({ area: "ux", severity: "medium", message: "Pages trop peu structurées (moins de 3 sections en moyenne).", autoFixable: false });
  const hasNav = blueprint.components.some((component) => /navigation/i.test(component.name));
  const hasFooter = blueprint.components.some((component) => /footer/i.test(component.name));
  if (hasNav) ux += 8; else issues.push({ area: "ux", severity: "high", message: "Aucun composant Navigation — parcours impossible.", autoFixable: true });
  if (hasFooter) ux += 6; else issues.push({ area: "ux", severity: "medium", message: "Aucun Footer — confiance et informations de contact manquantes.", autoFixable: true });
  if (blueprint.responsiveRules.length >= 3) ux += 4;

  /* ---- Conversion ---- */
  let conversion = 54;
  if (blueprint.conversion.primaryCta) conversion += 12;
  else issues.push({ area: "conversion", severity: "high", message: "Aucun CTA principal défini.", autoFixable: true });
  const homeSections = blueprint.pages[0]?.sections || [];
  const ctaInHome = homeSections.some((section) => /cta|conversion|r[ée]servation|rendez|booking/i.test(section.name)) || Boolean(homeSections.length);
  if (ctaInHome) conversion += 10;
  const ctaCoverage = blueprint.pages.filter((page) => page.sections.some((section) => /cta|conversion|contact|r[ée]servation|rendez|booking/i.test(section.name))).length;
  if (ctaCoverage >= 2) conversion += 10;
  else issues.push({ area: "conversion", severity: "medium", message: "Le CTA n'apparaît que sur une page — répété le hero et la fin du parcours.", autoFixable: true });
  if (blueprint.conversion.trustElements.length >= 2) conversion += 10;
  else issues.push({ area: "conversion", severity: "medium", message: "Moins de 2 preuves de confiance (avis, labels, garanties).", autoFixable: true });
  if (blueprint.pages.some((page) => /contact|r[ée]servation|rendez|booking|tarif|pricing|boutique/i.test(page.name))) conversion += 6;

  /* ---- Brand ---- */
  let brand = 55;
  if (blueprint.visualStyle.moodboardKeywords.length >= 4) brand += 12;
  else issues.push({ area: "brand", severity: "low", message: "Moodboard trop pauvre (moins de 4 mots-clés) — direction floue.", autoFixable: true });
  const briefText = norm(`${brief.industry} ${brief.positioning} ${brief.emotions.join(" ")} ${brief.instruction}`);
  const directionText = norm(`${blueprint.designDirection} ${blueprint.concept} ${blueprint.visualStyle.imagery}`);
  const sharedWords = briefText.split(/\W+/).filter((word) => word.length > 3 && directionText.includes(word)).length;
  if (sharedWords >= 2) brand += 16;
  else issues.push({ area: "brand", severity: "medium", message: "Direction artistique peu alignée avec le brief (mots-clés de marque absents).", autoFixable: false });
  // Cohérence traits sombre/luxe.
  const backgroundIsDark = contrastRatio(background, "#FFFFFF") < 3.2;
  if (brief.traits.dark >= .6 && !backgroundIsDark) issues.push({ area: "brand", severity: "medium", message: "Brief sombre mais fond clair — incohérence d'ambiance.", autoFixable: false });
  else brand += 9;
  if (brief.premiumLevel === "ultra-premium" && /serif|Cormorant|Playfair|Didot|Fraunces|DM Serif|Lora/i.test(blueprint.visualStyle.typography)) brand += 10;
  else if (brief.premiumLevel === "ultra-premium") issues.push({ area: "brand", severity: "low", message: "Ultra-premium sans typographie display serif — premiumité typographique affaiblie.", autoFixable: false });
  else brand += 6;

  /* ---- Mobile ---- */
  let mobile = 52;
  const rulesText = norm(blueprint.responsiveRules.map((rule) => `${rule.breakpoint} ${rule.rule}`).join(" "));
  if (blueprint.responsiveRules.length >= 3) mobile += 14;
  else issues.push({ area: "mobile", severity: "high", message: "Moins de 3 règles responsive — mobile non cadré.", autoFixable: true });
  if (/480|mobile|tactile|touch/.test(rulesText)) mobile += 10;
  else issues.push({ area: "mobile", severity: "medium", message: "Aucune règle mobile tactile (≤480px, cibles ≥44px).", autoFixable: true });
  if (/burger|hamburger|navigation condens/.test(rulesText)) mobile += 8;
  else issues.push({ area: "mobile", severity: "low", message: "Navigation mobile (burger) non spécifiée.", autoFixable: true });
  if (/sticky/.test(rulesText)) mobile += 8;
  if (/avif|webp|optimis|lazy/.test(rulesText)) mobile += 8;
  else issues.push({ area: "mobile", severity: "low", message: "Optimisation images mobile (AVIF/WebP, lazy) non spécifiée.", autoFixable: true });

  const scores: WebDesignQualityScores = {
    visual: clampScore(visual),
    ux: clampScore(ux),
    conversion: clampScore(conversion),
    brand: clampScore(brand),
    mobile: clampScore(mobile),
    overall: 0
  };
  // La note globale ne doit jamais masquer des défauts graves : chaque issue
  // pénalise le score (grave -7, moyenne -3, légère -1).
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === "high" ? 7 : issue.severity === "medium" ? 3 : 1), 0);
  scores.overall = clampScore(scores.visual * .26 + scores.ux * .2 + scores.conversion * .24 + scores.brand * .15 + scores.mobile * .15 - penalty);
  return { scores, issues, iterations: 0, evaluatedAt: new Date().toISOString() };
}

/**
 * Corrige automatiquement les issues corrigeables : contraste, palette,
 * CTA manquants, preuves de confiance, navigation/footer, règles mobile,
 * animations excédentaires.
 */
export function improveWebDesignQuality(blueprint: WebDesignBlueprint, report: WebDesignQualityReport): { blueprint: WebDesignBlueprint; fixes: string[] } {
  const next: WebDesignBlueprint = structuredClone(blueprint);
  const fixes: string[] = [];
  const colors = next.visualStyle.colors;

  for (const issue of report.issues) {
    if (!issue.autoFixable) continue;
    if (issue.area === "visual") {
      if (issue.message.includes("Contraste fond/texte") && colors.length >= 2) {
        colors[1] = shiftColorForContrast(colors[1], colors[0], 4.5);
        fixes.push(`Texte principal recalibré pour un contraste WCAG AA (→ ${colors[1]}).`);
      }
      if (issue.message.includes("Accent peu discernable") && colors.length >= 3) {
        colors[2] = shiftColorForContrast(colors[2], colors[0], 3);
        fixes.push(`Accent renforcé pour ressortir du fond (→ ${colors[2]}).`);
      }
      if (issue.message.includes("Palette trop large")) {
        next.visualStyle.colors = colors.slice(0, 6);
        fixes.push("Palette recentrée à 6 couleurs maximum.");
      }
      if (issue.message.includes("Typographie incomplète")) {
        next.visualStyle.typographyStack = { display: next.visualStyle.typographyStack?.display || "Inter", body: next.visualStyle.typographyStack?.body || "Inter" };
        next.visualStyle.typography = `${next.visualStyle.typographyStack.display} (titres) + ${next.visualStyle.typographyStack.body} (texte)`;
        fixes.push("Pairing typographique display + corps complété.");
      }
      if (issue.message.includes("Trop d'animations")) {
        next.visualStyle.animations = next.visualStyle.animations.slice(0, 5);
        fixes.push("Animations recentrées sur les 5 plus utiles.");
      }
    }
    if (issue.area === "ux") {
      if (issue.message.includes("composant Navigation")) {
        next.components.unshift({ name: "Navigation", variant: "sticky sobre", description: "Logo, liens principaux, CTA accent — ajouté par le contrôle qualité.", pages: ["*"] });
        fixes.push("Composant Navigation ajouté.");
      }
      if (issue.message.includes("Footer")) {
        next.components.push({ name: "Footer", variant: "complet", description: "Navigation secondaire, coordonnées, réseaux — ajouté par le contrôle qualité.", pages: ["*"] });
        fixes.push("Composant Footer ajouté.");
      }
    }
    if (issue.area === "conversion") {
      if (issue.message.includes("CTA principal")) {
        next.conversion.primaryCta = "Découvrir";
        fixes.push("CTA principal défini (« Découvrir »).");
      }
      if (issue.message.includes("Le CTA n'apparaît que sur une page") && next.pages.length >= 2) {
        const last = next.pages[next.pages.length - 1];
        if (!last.sections.some((section) => /cta|conversion/i.test(section.name))) {
          last.sections.push({ name: `CTA final « ${next.conversion.primaryCta || "Découvrir"} »`, purpose: "conversion de sortie (ajoutée par le contrôle qualité)" });
        }
        fixes.push("CTA ajouté en fin de parcours (dernière page).");
      }
      if (issue.message.includes("preuves de confiance")) {
        next.conversion.trustElements = [...new Set([...next.conversion.trustElements, "Témoignages clients vérifiés", "Garantie / politique claire"])].slice(0, 4);
        fixes.push("Preuves de confiance complétées (avis + garanties).");
      }
    }
    if (issue.area === "mobile") {
      if (issue.message.includes("Moins de 3 règles responsive")) {
        next.responsiveRules = [
          ...next.responsiveRules,
          { breakpoint: "≤1024px", rule: "grille 8 colonnes, typographie display -15%" },
          { breakpoint: "≤768px", rule: "navigation burger, sections empilées" },
          { breakpoint: "≤480px", rule: "cibles tactiles ≥44px, images plein bord à bord" }
        ].slice(0, 5);
        fixes.push("Règles responsive complétées (1024/768/480).");
      }
      if (issue.message.includes("règle mobile tactile")) {
        next.responsiveRules.push({ breakpoint: "≤480px", rule: "cibles tactiles ≥44px, CTA sticky bas d'écran" });
        fixes.push("Règle tactile ≤480px ajoutée.");
      }
      if (issue.message.includes("Navigation mobile")) {
        next.responsiveRules.push({ breakpoint: "≤768px", rule: "navigation burger avec panneau plein écran" });
        fixes.push("Navigation burger spécifiée.");
      }
      if (issue.message.includes("Optimisation images mobile")) {
        next.responsiveRules.push({ breakpoint: "Toutes", rule: "images AVIF/WebP, lazy loading, srcset responsive" });
        fixes.push("Optimisation images (AVIF/WebP, lazy, srcset) spécifiée.");
      }
    }
  }
  next.updatedAt = new Date().toISOString();
  return { blueprint: next, fixes };
}

/**
 * Boucle qualité : évalue → corrige → réévalue (max 2 itérations) jusqu'à un
 * seuil cohérent. Le rapport final embarque scores + issues restantes.
 */
export function designUntilQuality(input: { blueprint: WebDesignBlueprint; brief: WebDesignBrief; minOverall?: number; maxIterations?: number }): { blueprint: WebDesignBlueprint; report: WebDesignQualityReport; fixes: string[] } {
  const minOverall = input.minOverall ?? 82;
  const maxIterations = input.maxIterations ?? 2;
  let blueprint = structuredClone(input.blueprint);
  let report = evaluateWebDesignQuality(blueprint, input.brief);
  const fixes: string[] = [];
  let iteration = 0;
  while (report.scores.overall < minOverall && iteration < maxIterations) {
    iteration += 1;
    const improved = improveWebDesignQuality(blueprint, report);
    blueprint = improved.blueprint;
    fixes.push(...improved.fixes);
    report = evaluateWebDesignQuality(blueprint, input.brief);
    report.iterations = iteration;
    if (!improved.fixes.length) break; // plus rien de corrigeable automatiquement
  }
  blueprint.quality = { ...report, iterations: iteration };
  blueprint.updatedAt = new Date().toISOString();
  return { blueprint, report, fixes };
}
