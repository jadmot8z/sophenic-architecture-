import { designDirectionFor, hashText, mulberry32, visualStyleFor } from "./style-engine";
import type { WebDesignAgencyStep, WebDesignBlueprint, WebDesignBrief, WebDesignPage, WebDesignSection } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — CREATIVE AGENCY PIPELINE (MODE ORIGINAL).
 *
 * Aucun template : SOPHENIC agit comme une agence digitale complète.
 * Chaque « agent » est une étape de décision qui transforme le brief en
 * blueprint final : Directeur de Création → Stratège UX → Directeur de
 * Branding → Directeur Artistique → Motion Designer → Designer 3D →
 * Spécialiste Conversion. Le résultat est unique par brief et par graine.
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type SectionRecipe = { name: string; purpose: string };

const PAGE_RECIPES: Array<{ match: RegExp; sections: SectionRecipe[] }> = [
  { match: /accueil|home|h[ée]ros/, sections: [
    { name: "Hero immersif", purpose: "promesse + émotion en 3 secondes" },
    { name: "Preuve immédiate", purpose: "chiffres, logos ou distinctions" },
    { name: "Offre / piliers", purpose: "3 blocs clairs" },
    { name: "Storytelling", purpose: "pourquoi cette marque" },
    { name: "Témoignages", purpose: "confiance sociale" },
    { name: "CTA final", purpose: "conversion" }
  ] },
  { match: /collection|produit|boutique|shop|villa|chambre|s[ée]ance|soin|carte|menu|expertise|fonctionnalit|feature/, sections: [
    { name: "Filtres / catégories", purpose: "navigation" },
    { name: "Grille éditoriale", purpose: "parcours visuel" },
    { name: "Mise en avant signature", purpose: "best-seller ou pièce maîtresse" },
    { name: "Détails & matières", purpose: "profondeur d'information" }
  ] },
  { match: /savoir-faire|fabrication|about|propos|maison|manifeste|histoire|studio|equipe|[ée]quipe/, sections: [
    { name: "Récit fondateur", purpose: "authenticité" },
    { name: "Processus / méthode", purpose: "expertise" },
    { name: "Portraits", purpose: "humaniser" },
    { name: "Engagements", purpose: "valeurs" }
  ] },
  { match: /galerie|gallery|lookbook|photos|r[ée]alisation|projet|travaux/, sections: [
    { name: "Grille masonry", purpose: "immersion visuelle" },
    { name: "Séries thématiques", purpose: "narration" }
  ] },
  { match: /exp[ée]rience|activit|tour|d[ée]couverte/, sections: [
    { name: "Expériences phares", purpose: "envie" },
    { name: "Programme / itinéraire", purpose: "concrétiser" },
    { name: "Conseils locaux", purpose: "proximité" }
  ] },
  { match: /localisation|adresse|contact|rendez-vous|r[ée]servation|booking|r[ée]server|rdv|contact/, sections: [
    { name: "Carte + accès", purpose: "logistique" },
    { name: "Module de conversion", purpose: "réservation / contact" },
    { name: "Horaires & informations", purpose: "réassurance" }
  ] },
  { match: /tarif|pricing|abonnement|plan/, sections: [
    { name: "3 formules", purpose: "choix simple" },
    { name: "Comparatif", purpose: "décision" },
    { name: "FAQ tarifs", purpose: "objections" }
  ] },
  { match: /t[ée]moignage|avis|client|r[ée]f[ée]rence|cas client|benchmark|chiffre/, sections: [
    { name: "Carrousel de témoignages", purpose: "preuve sociale" },
    { name: "Études de cas", purpose: "résultats" }
  ] },
  { match: /blog|article|journal|insight|news|doc/, sections: [
    { name: "Articles à la une", purpose: "autorité" },
    { name: "Rubriques", purpose: "exploration" },
    { name: "Newsletter", purpose: "rétention" }
  ] },
  { match: /communaut|community|joueur|member|membre/, sections: [
    { name: "Mur communautaire", purpose: "appartenance" },
    { name: "Événements à venir", purpose: "engagement" }
  ] },
  { match: /playground|d[ée]mo|essai|try/, sections: [
    { name: "Démonstration interactive", purpose: "activation" },
    { name: "Exemples prêts à l'emploi", purpose: "valeur immédiate" }
  ] }
];

const GENERIC_SECTIONS: SectionRecipe[] = [
  { name: "Introduction", purpose: "contexte et promesse" },
  { name: "Contenu structuré", purpose: "information principale" },
  { name: "Points clés", purpose: "synthèse" },
  { name: "Passage à l'action", purpose: "conversion" }
];

function sectionsForPage(pageName: string): SectionRecipe[] {
  const normalized = norm(pageName);
  const recipe = PAGE_RECIPES.find((entry) => entry.match.test(normalized));
  return recipe ? recipe.sections : GENERIC_SECTIONS;
}

/** L'agent 3D décide : 3D seulement quand c'est pertinent (jamais partout). */
function threeDDecision(brief: WebDesignBrief, rng: () => number): { elements: WebDesignBlueprint["threeDElements"]; rationale: string } {
  const immersive = brief.traits.immersive3d;
  const tech = brief.traits.technological;
  const luxuryShowcase = brief.traits.luxury >= .7 && /bijou|joailler|produit|montre|mode/.test(norm(`${brief.industry} ${brief.instruction}`));
  const spatial = /villa|h[oô]tel|immobilier|architectur|espac/.test(norm(`${brief.industry} ${brief.instruction}`));
  if (immersive >= .55 || tech >= .7) {
    return {
      elements: [
        { concept: "Hero WebGL : scène 3D signature réactive (particules/objet) pilotée par la souris", library: "Three.js / React Three Fiber", placement: "Hero de la page d'accueil", rationale: `immersion cohérente avec le positionnement ${brief.industry} (traits immersive3d ${immersive.toFixed(2)}, technological ${tech.toFixed(2)})` },
        { concept: "Section produit avec modèle 3D orbitable", library: "React Three Fiber + drei", placement: "Page produit / playground", rationale: "démonstration tangible de l'offre" }
      ],
      rationale: "Expérience 3D justifiée : demande explicite ou univers technologique."
    };
  }
  if (luxuryShowcase || spatial) {
    const element = luxuryShowcase
      ? { concept: "Présentation produit 3D : rotation lente + éclairage studio", library: "React Three Fiber + Environment", placement: "Section signature / pièce du mois", rationale: "mise en valeur matière et volume sans alourdir le parcours" }
      : { concept: "Visite immersive : transition 3D douce entre les espaces (parallaxe verticale profonde)", library: "GSAP ScrollTrigger + WebGL discret", placement: "Page espaces / villas", rationale: "sensation de lieu sans navigation 3D lourde" };
    return { elements: [element], rationale: "3D ciblée : valorisation produit/lieu, pas de 3D gratuite." };
  }
  return { elements: [], rationale: `Pas de 3D : le brief (immersive3d ${immersive.toFixed(2)}) ne la justifie pas — sobriété assumée${rng() > .5 ? ", animations 2D soignées à la place" : ""}.` };
}

/**
 * Mode Original : l'agence complète construit le blueprint. Chaque agent
 * journalise ses décisions (transparence UI).
 */
export function runCreativeAgency(brief: WebDesignBrief, options: { seed?: number } = {}): { blueprint: WebDesignBlueprint; log: WebDesignAgencyStep[] } {
  const seed = options.seed ?? hashText(`${brief.instruction}|${brief.brand}|original`);
  const rng = mulberry32(seed);
  const log: WebDesignAgencyStep[] = [];
  const now = new Date().toISOString();
  const id = `webdesign-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // 1) Directeur de Création — direction artistique.
  const visualStyle = visualStyleFor(brief, seed);
  const designDirection = designDirectionFor(brief, visualStyle);
  log.push({ agent: "Creative Director", role: "Direction artistique", decisions: [
    `direction : ${designDirection}`,
    `mots-clés moodboard : ${visualStyle.moodboardKeywords.slice(0, 4).join(", ")}`,
    `niveau premium : ${brief.premiumLevel}`
  ] });

  // 2) Stratège UX — architecture de l'information.
  const pages: WebDesignPage[] = brief.pages.slice(0, 8).map((name) => {
    const sections: WebDesignSection[] = sectionsForPage(name).map((section) => ({ ...section }));
    // Variation seedée : réordonne légèrement les sections secondaires.
    if (sections.length > 3) {
      const rotate = 1 + (seed % (sections.length - 2));
      const moved = sections.splice(1, rotate);
      sections.push(...moved.reverse());
    }
    return { name, sections };
  });
  log.push({ agent: "UX Strategist", role: "Architecture de l'information", decisions: [
    `${pages.length} pages : ${pages.map((page) => page.name).join(", ")}`,
    `${pages.reduce((sum, page) => sum + page.sections.length, 0)} sections au total`,
    `objectif de conversion : ${brief.conversionGoal}`
  ] });

  // 3) Directeur de Branding — palette, typographie, voix.
  log.push({ agent: "Brand Designer", role: "Identité de marque", decisions: [
    `palette : ${visualStyle.colors.join(" · ")}`,
    `typographie : ${visualStyle.typography}`,
    `émotions cibles : ${brief.emotions.join(", ")}`
  ] });

  // 4) Directeur Artistique — composants, spacing, imagerie.
  const components: WebDesignBlueprint["components"] = [
    { name: "Navigation", variant: brief.traits.minimal >= .6 ? "fine et épurée" : "signature avec scroll effect", description: `Navigation ${brief.traits.minimal >= .6 ? "minimale, logo + liens + CTA" : "à identité forte, effet au scroll"}, CTA « ${brief.conversionGoal.split("/")[0].trim()} »`, pages: ["*"] },
    { name: "Hero", variant: visualStyle.colors.length ? "plein écran avec overlay" : "standard", description: `Titre display ${visualStyle.typographyStack.display}, image direction « ${visualStyle.imagery.slice(0, 60)}… », double CTA`, pages: [pages[0]?.name || "Accueil"] },
    { name: "Grille de contenu", variant: brief.traits.editorial >= .6 ? "éditoriale asymétrique" : "régulière 3 colonnes", description: "Cartes image + texte, ratio cohérent", pages: pages.slice(1).map((page) => page.name).slice(0, 3) },
    { name: "Bandeau social proof", variant: "carrousel", description: "Témoignages clients avec note", pages: [pages[0]?.name || "Accueil"] },
    { name: "Footer", variant: "complet", description: "Navigation secondaire, coordonnées, réseaux, mentions", pages: ["*"] }
  ];
  log.push({ agent: "Visual Designer", role: "Design system", decisions: [
    `${components.length} composants définis`,
    `spacing : ${visualStyle.spacing}`,
    `imagerie : ${visualStyle.imagery}`
  ] });

  // 5) Motion Designer.
  log.push({ agent: "Motion Designer", role: "Animations", decisions: visualStyle.animations.map((animation) => `animation : ${animation}`) });

  // 6) Designer d'Expérience 3D (décide, ne décore pas).
  const threeD = threeDDecision(brief, rng);
  log.push({ agent: "3D Experience Designer", role: "Expérience 3D", decisions: threeD.elements.length ? threeD.elements.map((element) => `${element.concept} (${element.library}) — ${element.rationale}`) : [threeD.rationale] });

  // 7) Spécialiste Conversion.
  const primaryCta = /r[ée]serv/.test(brief.conversionGoal) ? "Réserver" : /acheter|achat/.test(brief.conversionGoal) ? "Commander" : /inscription|essai|demo|beta/.test(brief.conversionGoal) ? "Essayer gratuitement" : /contact/.test(brief.conversionGoal) ? "Nous contacter" : "Découvrir";
  const trustElements = [
    /r[ée]serv|hotel|villa|restaurant/.test(norm(brief.industry)) ? "Avis clients vérifiés (note /5)" : "Témoignages clients nommés",
    brief.premiumLevel === "ultra-premium" ? "Labels & distinctions (presse, guides)" : "Garanties / politique claire",
    /ecommerce|e-commerce|boutique/.test(norm(brief.industry)) ? "Paiement sécurisé + retours gratuits" : "Réponse sous 24h / disponibilité"
  ];
  // CTA dans le hero et en fin de parcours.
  const homePage = pages[0];
  if (homePage && !homePage.sections.some((section) => /cta|conversion|r[ée]servation|rendez/i.test(section.name))) {
    homePage.sections.push({ name: `CTA « ${primaryCta} »`, purpose: "conversion principale" });
  }
  log.push({ agent: "Conversion Specialist", role: "Optimisation conversion", decisions: [
    `CTA principal : « ${primaryCta} » (hero + fin de parcours)`,
    `objectif : ${brief.conversionGoal}`,
    `preuves de confiance : ${trustElements.join(" · ")}`
  ] });

  const responsiveRules: WebDesignBlueprint["responsiveRules"] = [
    { breakpoint: "≥1280px", rule: `grille 12 colonnes, ${brief.traits.editorial >= .6 ? "composition asymétrique éditoriale" : "composition régulière"}, images optimisées AVIF/WebP` },
    { breakpoint: "≤1024px", rule: "grille 8 colonnes, navigation condensée, typographie display -15%" },
    { breakpoint: "≤768px", rule: "navigation burger, sections empilées, CTA principal sticky" },
    { breakpoint: "≤480px", rule: "cibles tactiles ≥44px, carrousels horizontaux, images plein bord à bord" }
  ];

  const blueprint: WebDesignBlueprint = {
    id, schemaVersion: 1, projectType: "website", mode: "original",
    brand: brief.brand || "Marque sans nom",
    industry: brief.industry,
    designDirection,
    concept: `${brief.positioning} — ${brief.emotions.slice(0, 2).join(" et ")} pour ${brief.audience}.`,
    pages,
    visualStyle,
    components,
    threeDElements: threeD.elements,
    responsiveRules,
    assets: [],
    conversion: { primaryCta, secondaryCta: "En savoir plus", trustElements },
    agencyLog: log,
    createdAt: now, updatedAt: now
  };
  return { blueprint, log };
}
