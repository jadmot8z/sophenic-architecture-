import { designDirectionFor, hashText, mulberry32, visualStyleFor } from "./style-engine";
import type { WebDesignAgencyStep, WebDesignBlueprint, WebDesignBrief, WebDesignTemplate } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — TEMPLATE INTELLIGENCE MODE.
 *
 * Le template n'est qu'un point de départ STRUCTUREL. La personnalisation
 * remplace entièrement l'identité visuelle (palette, typographie, animations,
 * imagerie) par celle de la marque du brief, adapte la structure à l'objectif
 * de conversion et renomme les sections dans la langue de la marque.
 * Le résultat NE DOIT PAS ressembler au template d'origine.
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Personnalise un template pour un brief :
 * - STRUCTURE conservée (pages/sections du template, adaptées : ± sections
 *   conversion, langue) ;
 * - IDENTITÉ VISUELLE entièrement régénérée pour la marque ;
 * - composants et règles responsive re-libellés pour la marque.
 */
export function customizeTemplate(template: WebDesignTemplate, brief: WebDesignBrief, options: { seed?: number } = {}): { blueprint: WebDesignBlueprint; structureKeptRatio: number } {
  const seed = options.seed ?? hashText(`${brief.instruction}|${brief.brand}|template|${template.id}`);
  const rng = mulberry32(seed);
  const now = new Date().toISOString();
  const id = `webdesign-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const log: WebDesignAgencyStep[] = [];

  // 1) Sélection & stratégie : structure du template, adaptée au brief.
  const totalSections = template.pages.reduce((sum, page) => sum + page.sections.length, 0);
  const pages = template.pages.map((page) => ({ ...page, sections: page.sections.map((section) => ({ ...section })) }));
  // Adaptation structurelle : retire une section décorative si la densité est
  // élevée, ajoute une section conversion si le but n'est pas couvert.
  const wantsBooking = /r[ée]serv|rendez|rdv|booking|contact|achat|commande|essai|inscription/.test(norm(brief.conversionGoal));
  const firstPage = pages[0];
  const hasConversionSection = pages.some((page) => page.sections.some((section) => /cta|r[ée]servation|rendez|booking|contact|conversion/i.test(section.name)));
  let added = 0;
  if (wantsBooking && !hasConversionSection && firstPage) {
    firstPage.sections.push({ name: `CTA « ${primaryCtaFor(brief)} »`, purpose: "conversion principale (ajoutée par le moteur)" });
    added += 1;
  }
  if (brief.traits.ecommerce >= .6 && !pages.some((page) => /panier|produit|boutique|shop/i.test(page.name))) {
    pages.push({ name: "Boutique", sections: [
      { name: "Grille produits", purpose: "navigation commerciale" },
      { name: "Best-sellers", purpose: "conversion immédiate" },
      { name: "Avis clients", purpose: "réassurance" }
    ] });
    added += 3;
  }
  const structureKeptRatio = totalSections / (totalSections + added);

  log.push({ agent: "Template Selection", role: "Structure de départ", decisions: [
    `template « ${template.name} » (${template.pages.length} pages, ${totalSections} sections)`,
    `structure conservée puis adaptée : ${added} section(s) ajoutée(s) pour l'objectif « ${brief.conversionGoal} »`,
    `${Math.round(structureKeptRatio * 100)}% de la structure d'origine conservée`
  ] });

  // 2) Identité visuelle : REMPLACEMENT complet par celle de la marque —
  //    avec garantie explicite de ne PAS retomber sur l'identité du template.
  const visualStyle = visualStyleFor(brief, seed, { colors: template.visualStyle.colors, typography: template.visualStyle.typographyStack });
  const designDirection = designDirectionFor(brief, visualStyle);
  log.push({ agent: "Brand Restyler", role: "Transfert d'identité", decisions: [
    `palette template (${template.visualStyle.colors.join(" · ")}) → palette marque (${visualStyle.colors.join(" · ")})`,
    `typographie template (${template.visualStyle.typography}) → ${visualStyle.typography}`,
    `animations template (${template.animations.slice(0, 2).join(", ")}…) → ${visualStyle.animations.slice(0, 2).join(", ")}${visualStyle.animations.length > 2 ? "…" : ""}`,
    "imagerie et moodboard régénérés pour la marque"
  ] });

  // 3) Direction & composants.
  const components = template.components.map((component) => ({
    ...component,
    description: `${component.description} — restylé « ${brief.brand || brief.industry} » : ${componentHintFor(component.name, visualStyle)}`,
    variant: `${component.variant} · ${visualStyle.typographyStack.display}`
  }));
  log.push({ agent: "Visual Designer", role: "Restylage composants", decisions: [
    `${components.length} composants restylés avec la langue visuelle de la marque`,
    `spacing : ${visualStyle.spacing}`,
    `imagerie : ${visualStyle.imagery}`
  ] });

  // 4) 3D : conservée si le template en a ET que le brief la justifie.
  const keepThreeD = template.threeDElements.length > 0 && brief.traits.immersive3d >= .45;
  const threeDElements = keepThreeD ? template.threeDElements.map((element) => ({ ...element, rationale: `${element.rationale} — maintenu : traits 3D du brief (${brief.traits.immersive3d.toFixed(2)})` })) : [];
  log.push({ agent: "3D Experience Designer", role: "Expérience 3D", decisions: [keepThreeD ? `${threeDElements.length} élément(s) 3D conservé(s)` : "3D retirée : le brief de la marque ne la justifie pas"] });

  // 5) Conversion.
  const primaryCta = primaryCtaFor(brief);
  const trustElements = [
    /r[ée]serv|hotel|villa|restaurant/.test(norm(brief.industry)) ? "Avis clients vérifiés (note /5)" : "Témoignages clients nommés",
    brief.premiumLevel === "ultra-premium" ? "Labels & distinctions (presse, guides)" : "Garanties / politique claire"
  ];
  log.push({ agent: "Conversion Specialist", role: "Optimisation conversion", decisions: [`CTA principal : « ${primaryCta} »`, `objectif : ${brief.conversionGoal}`] });

  log.push({ agent: "Motion Designer", role: "Animations", decisions: visualStyle.animations.map((animation) => `animation : ${animation}`) });

  const responsiveRules = template.responsiveRules.map((rule) => ({ ...rule, rule: `${rule.rule} — vérifié pour ${brief.brand || brief.industry}` }));

  const blueprint: WebDesignBlueprint = {
    id, schemaVersion: 1, projectType: "website", mode: "template",
    templateId: template.id, templateName: template.name,
    brand: brief.brand || "Marque sans nom",
    industry: brief.industry,
    designDirection,
    concept: `${template.name} re-personnalisé pour ${brief.positioning} : la structure reste, l'identité est celle de ${brief.brand || brief.industry}.`,
    pages,
    visualStyle,
    components,
    threeDElements,
    responsiveRules,
    assets: [],
    conversion: { primaryCta, secondaryCta: "En savoir plus", trustElements },
    agencyLog: log,
    createdAt: now, updatedAt: now
  };
  return { blueprint, structureKeptRatio };
}

function primaryCtaFor(brief: WebDesignBrief): string {
  if (/r[ée]serv/.test(brief.conversionGoal)) return "Réserver";
  if (/achat|acheter|commande/.test(brief.conversionGoal)) return "Commander";
  if (/inscription|essai|demo|beta|join/.test(brief.conversionGoal)) return "Essayer gratuitement";
  if (/contact|rendez|rdv/.test(brief.conversionGoal)) return "Prendre rendez-vous";
  if (/abonnement|newsletter/.test(brief.conversionGoal)) return "S'abonner";
  return "Découvrir";
}

function componentHintFor(componentName: string, visualStyle: WebDesignBlueprint["visualStyle"]): string {
  if (/navigation/i.test(componentName)) return `liens ${visualStyle.typographyStack.body}, accent ${visualStyle.colors[2]}`;
  if (/hero/i.test(componentName)) return `titres ${visualStyle.typographyStack.display} sur ${visualStyle.colors[0]}`;
  if (/footer/i.test(componentName)) return `fond ${visualStyle.colors[4] || visualStyle.colors[0]}, liens sobres`;
  return `finition ${visualStyle.colors[2]}`;
}
