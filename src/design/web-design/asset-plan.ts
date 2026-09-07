import type { WebDesignAssetRecommendation, WebDesignBlueprint, WebDesignBrief } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — ASSET INTELLIGENCE.
 *
 * Recommande les assets (images, icônes, illustrations, 3D, animations)
 * à partir de la direction artistique — chaque recommandation porte sa
 * directive créative et sa raison.
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const ICONS_BY_SECTION: Array<{ match: RegExp; icons: string[] }> = [
  { match: /offre|pilier|fonctionnalit|feature|capacit/, icons: ["sparkles", "gauge", "layers"] },
  { match: /t[ée]moignage|avis|client|confiance|preuve/, icons: ["star", "quote", "badge-check"] },
  { match: /r[ée]servation|rendez|booking|contact|cta/, icons: ["calendar", "send", "phone"] },
  { match: /carte|menu|produit|collection/, icons: ["gem", "utensils", "shopping-bag"] },
  { match: /localisation|adresse|acc[èe]s/, icons: ["map-pin", "navigation", "clock"] },
  { match: /[ée]quipe|portrait|praticien|auteur/, icons: ["users", "award", "heart"] },
  { match: /tech|doc|benchmark|playground/, icons: ["terminal", "cpu", "code"] }
];

export function recommendDesignAssets(blueprint: WebDesignBlueprint, brief: WebDesignBrief): WebDesignAssetRecommendation[] {
  const assets: WebDesignAssetRecommendation[] = [];
  const imagery = blueprint.visualStyle.imagery;
  const accent = blueprint.visualStyle.colors[2] || "#4F46E5";
  const heroPage = blueprint.pages[0];
  const heroSection = heroPage?.sections[0]?.name || "Hero";

  // 1) Images clés (hero + sections visuelles majeures).
  assets.push({
    kind: "image", name: "Hero signature",
    directive: `image hero plein écran — ${imagery} — accent chromatique ${accent}, sans texte incrusté, ratio 21:9`,
    usage: `${heroPage?.name || "Accueil"} · ${heroSection}`,
    reason: "premier impact émotionnel, porte la direction artistique"
  });
  const visualSections = blueprint.pages.flatMap((page) => page.sections.filter((section) => /grille|galerie|collection|lookbook|storytelling|exp[ée]rience|masonry/i.test(section.name)));
  for (const section of visualSections.slice(0, 3)) {
    assets.push({
      kind: "image", name: `Série « ${section.name} »`,
      directive: `3-6 images cohérentes — ${imagery} — même étalonnage, ratio 4:5`,
      usage: section.name,
      reason: "cohérence visuelle de la section, même lumière et même grain"
    });
  }

  // 2) Icônes par type de section.
  const sectionNames = blueprint.pages.flatMap((page) => page.sections.map((section) => section.name));
  const iconPack = new Set<string>();
  for (const name of sectionNames) {
    for (const entry of ICONS_BY_SECTION) {
      if (entry.match.test(norm(name))) entry.icons.forEach((icon) => iconPack.add(icon));
    }
  }
  if (iconPack.size) {
    assets.push({
      kind: "icon", name: "Set d'icônes de sections",
      directive: `${[...iconPack].slice(0, 10).join(", ")} — trait 1.5px, style linéaire ${brief.traits.playful >= .6 ? "expressif" : "sobre"}, couleur ${accent}`,
      usage: "sections concernées",
      reason: "lecture rapide des blocs, langage graphique unifié"
    });
  }

  // 3) Illustration si marque accessible/playful.
  if (brief.traits.playful >= .55 || brief.traits.colorful >= .55) {
    assets.push({
      kind: "illustration", name: "Illustrations de marque",
      directive: `illustrations vectorielles ${brief.emotions.slice(0, 2).join(" / ")}, palette ${blueprint.visualStyle.colors.slice(0, 3).join(" · ")}`,
      usage: "sections explicatives, états vides",
      reason: "traits playful/colorful élevés : l'illustration humanise le propos"
    });
  }

  // 4) 3D : suivre les décisions du designer 3D.
  for (const element of blueprint.threeDElements) {
    assets.push({
      kind: "3d", name: element.concept.slice(0, 60),
      directive: `${element.library} — ${element.concept}`,
      usage: element.placement,
      reason: element.rationale
    });
  }

  // 5) Animations : librairies recommandées.
  const animations = blueprint.visualStyle.animations;
  if (animations.length) {
    const libs = new Set<string>();
    if (/parallaxe|parallax|scroll/i.test(animations.join(" "))) libs.add("GSAP ScrollTrigger");
    if (/r[ée]veal|apparition|fondu|zoom/i.test(animations.join(" "))) libs.add("Framer Motion");
    if (/3d|webgl|tilt|magn[ée]tique/i.test(animations.join(" "))) libs.add("Three.js / React Three Fiber");
    if (/typing|glitch|marquee/i.test(animations.join(" "))) libs.add("CSS keyframes custom");
    if (/lottie/i.test(animations.join(" "))) libs.add("Lottie");
    assets.push({
      kind: "animation", name: "Règles d'animation",
      directive: `${[...libs].join(" + ") || "Framer Motion"} — courbes ease-out 300-600ms (${brief.premiumLevel === "ultra-premium" ? "transitions lentes 800-1200ms pour un rendu couture" : "transitions vives"})`,
      usage: "ensemble du site",
      reason: "les animations portent le niveau premium sans nuire à la performance (respect prefers-reduced-motion)"
    });
  }

  return assets;
}
