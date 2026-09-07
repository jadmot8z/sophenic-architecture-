import type { WebDesignBrief, WebDesignTemplate, WebDesignTemplateCandidate } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — TEMPLATE INTELLIGENCE MODE.
 *
 * Bibliothèque interne de structures de départ. Un template n'est JAMAIS le
 * résultat final : c'est un squelette (pages/sections) que le moteur
 * re-personnalise entièrement (couleurs, typographie, animations, composants,
 * imagerie) à partir du brief de marque — le rendu final ne doit pas
 * ressembler au template d'origine.
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const WEB_DESIGN_TEMPLATES: WebDesignTemplate[] = [
  {
    id: "luxury-editorial",
    name: "Luxury Editorial",
    tagline: "Éditorial premium, grands espaces, storytelling photographique",
    industries: ["bijouterie", "joaillerie", "hôtel", "hotel", "villa", "spa", "mode", "immobilier", "mariage"],
    traits: { luxury: .95, editorial: .85, minimal: .6, storytelling: .85, dark: .2 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero éditorial plein écran", purpose: "immersion de marque, une image signature + tagline" },
        { name: "Manifeste de marque", purpose: "positionnement en 3 phrases" },
        { name: "Sélection signature", purpose: "3 pièces/lieux phares" },
        { name: "Storytelling savoir-faire", purpose: "preuve d'excellence" },
        { name: "Témoignages clients", purpose: "confiance" },
        { name: "CTA prise de rendez-vous", purpose: "conversion" }
      ] },
      { name: "Collections", sections: [
        { name: "Grille éditoriale", purpose: "parcours visuel" },
        { name: "Pièce du mois", purpose: "mise en avant" }
      ] },
      { name: "Maison / À propos", sections: [{ name: "Histoire", purpose: "héritage" }, { name: "Valeurs", purpose: "différenciation" }] },
      { name: "Contact", sections: [{ name: "Coordonnées + formulaire", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#FAF7F1", "#1C1A16", "#B08D3E", "#6E5E3F", "#EDE6D8"], typography: "Cormorant Garamond (titres) + Jost (texte)", typographyStack: { display: "Cormorant Garamond", body: "Jost" }, spacing: "Système 8pt, marges généreuses (120px+ desktop)", animations: ["reveal au scroll lent (1.2s ease-out)", "fondu cinématographique du hero (2s)", "parallaxe douce sur l'imagerie", "survol discret or (400ms)"], imagery: "Photographie cinématographique, lumière sculptée, gros plans matière", moodboardKeywords: ["or", "marbre", "soie", "obscurité lumineuse"] },
    components: [
      { name: "Navigation", variant: "minimal fade", description: "Nav fine, logo centré, App Store-like fade au scroll", pages: ["*"] },
      { name: "Hero plein écran", variant: "image + tagline", description: "Image signature, titre serif, CTA fantôme or", pages: ["Accueil"] },
      { name: "Grille produits", variant: "éditoriale 2 colonnes", description: "Images grand format, légendes serif italiques", pages: ["Collections"] },
      { name: "Footer", variant: "colonne centrée", description: "Coordonnées, réseaux, mention légale or", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "grille 12 colonnes, marges 120px" },
      { breakpoint: "≤768px", rule: "typographie display réduite de 30%, images plein bord à bord" },
      { breakpoint: "≤480px", rule: "nav burger, CTA plein écran sticky" }
    ],
    animations: ["reveal au scroll lent", "fondu cinématographique du hero", "parallaxe douce", "survol or discret"]
  },
  {
    id: "immersive-3d",
    name: "Immersive 3D Experience",
    tagline: "Hero WebGL, sections interactives, esthétique futuriste",
    industries: ["gaming", "ia", "ai", "crypto", "web3", "tech", "cybersécurité", "robotique", "spatial"],
    traits: { immersive3d: .95, technological: .9, dark: .9, playful: .5, colorful: .5 },
    pages: [
      { name: "Home", sections: [
        { name: "Hero WebGL interactif", purpose: "wow immédiat + promesse" },
        { name: "Capacités en 3 cartes", purpose: "clarté de l'offre" },
        { name: "Playground interactif", purpose: "démonstration live" },
        { name: "Benchmarks / chiffres", purpose: "preuve" },
        { name: "Communauté", purpose: "appartenance" },
        { name: "CTA Try now", purpose: "conversion" }
      ] },
      { name: "Product", sections: [{ name: "Vue 3D produit", purpose: "exploration" }, { name: "Specs techniques", purpose: "détail" }] },
      { name: "Docs", sections: [{ name: "Démarrage rapide", purpose: "activation" }] },
      { name: "Pricing", sections: [{ name: "3 plans", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#0A0E14", "#EAF2FF", "#00E5A0", "#7C5CFF", "#141A26"], typography: "Space Grotesk (titres) + IBM Plex Mono (données)", typographyStack: { display: "Space Grotesk", body: "IBM Plex Mono" }, spacing: "Système 8pt dense, cartes glassmorphism", animations: ["particules WebGL en fond", "boutons magnétiques", "tilt 3D au scroll", "typing/glitch du hero", "gradient animé sur les accents"], imagery: "Rendus 3D temps réel, captures dark UI, néons", moodboardKeywords: ["néon", "verre", "réseau", "constellation"] },
    components: [
      { name: "Navigation", variant: "flottante glassmorphism", description: "Pill flottante, blur, badge version", pages: ["*"] },
      { name: "Hero WebGL", variant: "canvas interactif", description: "Canvas Three.js, titre géant, CTA magnétique", pages: ["Home"] },
      { name: "Code Playground", variant: "éditeur embarqué", description: "Démo live avec onglets", pages: ["Home", "Docs"] },
      { name: "Footer", variant: "grille liens + status", description: "Liens produit + status page", pages: ["*"] }
    ],
    threeDElements: [{ concept: "Hero WebGL : objet 3D signature réactif à la souris", library: "Three.js / React Three Fiber", placement: "Hero Home", rationale: "Immersion technologique cohérente avec la promesse produit" }],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "hero canvas plein écran, DPR limité à 2" },
      { breakpoint: "≤768px", rule: "WebGL simplifié (moins de particules), CTA sticky" },
      { breakpoint: "≤480px", rule: "tilt 3D désactivé, slides horizontales" }
    ],
    animations: ["particules WebGL", "boutons magnétiques", "tilt 3D scroll", "typing hero", "gradient animé"]
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    tagline: "Clarté, respiration, hiérarchie typographique",
    industries: ["agence", "studio", "portfolio", "architecture", "conseil", "saas", "app"],
    traits: { minimal: .9, editorial: .5, corporate: .3, dark: .15 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero typographique", purpose: "promesse nette" },
        { name: "Services en 3 blocs", purpose: "offre lisible" },
        { name: "Études de cas", purpose: "preuve" },
        { name: "Équipe", purpose: "proximité" },
        { name: "CTA contact", purpose: "conversion" }
      ] },
      { name: "Travaux", sections: [{ name: "Grille projets", purpose: "portfolio" }] },
      { name: "Studio", sections: [{ name: "Approche", purpose: "méthode" }] },
      { name: "Contact", sections: [{ name: "Formulaire épuré", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#101828", "#4F46E5", "#667085", "#F3F4F6"], typography: "Inter (tout), graisses contrastées", typographyStack: { display: "Inter", body: "Inter" }, spacing: "Système 8pt, respiration maximale", animations: ["apparition au scroll (300ms)", "survol translate 4px", "changement de couleur 200ms"], imagery: "Maquettes nettes, photos aérées, ombres douces", moodboardKeywords: ["blanc", "encre", "indigo", "grille"] },
    components: [
      { name: "Navigation", variant: "sticky minimal", description: "Logo gauche, liens droits, CTA pill", pages: ["*"] },
      { name: "Hero", variant: "typographique", description: "Titre XL, sous-titre, 2 CTA", pages: ["Accueil"] },
      { name: "Cartes projet", variant: "image + tag", description: "Ratio 4:3, tag catégorie, hover lift", pages: ["Travaux"] },
      { name: "Footer", variant: "3 colonnes", description: "Nav, contact, crédits", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1200px, grille 12 col" },
      { breakpoint: "≤768px", rule: "grille 2 col, typographie -20%" },
      { breakpoint: "≤480px", rule: "nav burger, cartes empilées" }
    ],
    animations: ["apparition scroll", "hover lift", "transitions couleur"]
  },
  {
    id: "bold-ecommerce",
    name: "Bold E-commerce",
    tagline: "Vitrine de conversion, paniers rapides, visuels produits",
    industries: ["e-commerce", "boutique", "mode", "cosmétique", "food", "retail"],
    traits: { ecommerce: .95, colorful: .7, playful: .5, minimal: .3 },
    pages: [
      { name: "Boutique", sections: [
        { name: "Hero promotionnel", purpose: "offre claire" },
        { name: "Best-sellers", purpose: "conversion immédiate" },
        { name: "Catégories", purpose: "navigation produit" },
        { name: "Avis clients", purpose: "réassurance" },
        { name: "Garanties", purpose: "leviers d'achat" }
      ] },
      { name: "Produit", sections: [{ name: "Galerie + prix + CTA", purpose: "fiche produit" }, { name: "Avis + FAQ", purpose: "réassurance" }] },
      { name: "Panier", sections: [{ name: "Récap + livraison", purpose: "checkout" }] },
      { name: "À propos", sections: [{ name: "Marque", purpose: "attachement" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#17161A", "#E0475B", "#5B5470", "#F5F2F7"], typography: "Montserrat (titres) + Open Sans (texte)", typographyStack: { display: "Montserrat", body: "Open Sans" }, spacing: "Système 8pt compact, densité commerciale", animations: ["add-to-cart animé", "badge promo pulse", "carrousel auto 4s", "sticky CTA mobile"], imagery: "Photos produits sur fond propre, lifestyle en tête de catégorie", moodboardKeywords: ["corail", "packaging", "smile", "réduction"] },
    components: [
      { name: "Navigation", variant: "recherche + panier", description: "Recherche prominente, panier animé", pages: ["*"] },
      { name: "Cartes produit", variant: "quick add", description: "Prix, note, ajout rapide au panier", pages: ["Boutique"] },
      { name: "Bandeau avis", variant: "carrousel", description: "Notes étoiles + photos clients", pages: ["Boutique", "Produit"] },
      { name: "Footer", variant: "newsletter", description: "Liens, newsletter -10%, paiements", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "grille produit 4 col" },
      { breakpoint: "≤768px", rule: "grille 2 col, barre de recherche sticky" },
      { breakpoint: "≤480px", rule: "CTA add-to-cart sticky bas" }
    ],
    animations: ["add-to-cart", "badge pulse", "carrousel auto", "sticky CTA"]
  },
  {
    id: "corporate-trust",
    name: "Corporate Trust",
    tagline: "Crédibilité, données, rigueur institutionnelle",
    industries: ["finance", "assurance", "b2b", "conseil", "droit", "santé"],
    traits: { corporate: .9, minimal: .5, dark: .2, storytelling: .3 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero institutionnel", purpose: "credibilité" },
        { name: "Chiffres clés", purpose: "preuve" },
        { name: "Expertises", purpose: "offre" },
        { name: "Références", purpose: "confiance" },
        { name: "CTA rendez-vous", purpose: "conversion" }
      ] },
      { name: "Expertises", sections: [{ name: "Détail par pratique", purpose: "profondeur" }] },
      { name: "Insights", sections: [{ name: "Publications", purpose: "autorité" }] },
      { name: "Contact", sections: [{ name: "Formulaire pro", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#0F172A", "#1D4ED8", "#475569", "#F1F5F9"], typography: "Libre Franklin (titres) + Inter (texte)", typographyStack: { display: "Libre Franklin", body: "Inter" }, spacing: "Système 8pt structuré, sections délimitées", animations: ["compteurs animés", "apparition sobre au scroll"], imagery: "Portraits corporate, immeubles, graphiques", moodboardKeywords: ["bleu", "marbre", "ville", "poignée de main"] },
    components: [
      { name: "Navigation", variant: "méga-menu", description: "Méga-menu expertises + CTA", pages: ["*"] },
      { name: "Bandeau chiffres", variant: "compteurs", description: "KPI animés au scroll", pages: ["Accueil"] },
      { name: "Logos références", variant: "marquee discret", description: "Clients, défilement lent", pages: ["Accueil"] },
      { name: "Footer", variant: "institutionnel", description: "Mentions, conformité, contacts", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1140px" },
      { breakpoint: "≤768px", rule: "méga-menu → accordéon" },
      { breakpoint: "≤480px", rule: "chiffres clés en carrousel" }
    ],
    animations: ["compteurs", "apparition sobre"]
  },
  {
    id: "warm-hospitality",
    name: "Warm Hospitality",
    tagline: "Chaleur sensorielle, réservation fluide, storytelling local",
    industries: ["restaurant", "café", "hôtel", "hotel", "villa", "bien-être", "spa", "voyage"],
    traits: { storytelling: .85, luxury: .5, colorful: .4, dark: .35 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero sensoriel", purpose: "envie immédiate" },
        { name: "La table / le lieu", purpose: "promesse" },
        { name: "Menu / expériences", purpose: "offre" },
        { name: "Galerie", purpose: "immersion" },
        { name: "Avis", purpose: "confiance" },
        { name: "Réservation", purpose: "conversion" }
      ] },
      { name: "Menu", sections: [{ name: "Carte détaillée", purpose: "décision" }] },
      { name: "Galerie", sections: [{ name: "Masonry photos", purpose: "ambiance" }] },
      { name: "Réserver", sections: [{ name: "Module réservation", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#1C1712", "#F5EBDD", "#C05621", "#8C6D4F", "#2A231B"], typography: "Fraunces (titres) + Nunito Sans (texte)", typographyStack: { display: "Fraunces", body: "Nunito Sans" }, spacing: "Système 8pt organique, arrondis 16px", animations: ["reveal fondu chaleureux", "zoom lent imagerie (8s)", "hover carte menu"], imagery: "Photographie nourriture/lieux en lumière chaude, textures artisanales", moodboardKeywords: ["terracotta", "bois", "cumin", "fin de journée"] },
    components: [
      { name: "Navigation", variant: "centrée discrète", description: "Liens centre, réservation à droite", pages: ["*"] },
      { name: "Module réservation", variant: "formulaire 3 champs", description: "Date, couverts, occasion", pages: ["Accueil", "Réserver"] },
      { name: "Cartes menu", variant: "liste éditoriale", description: "Plat, sources, prix aligné", pages: ["Menu"] },
      { name: "Footer", variant: "horaires + plan", description: "Horaires, adresse, réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "hero vidéo muted autoplay" },
      { breakpoint: "≤768px", rule: "menu en accordéon, galerie 2 col" },
      { breakpoint: "≤480px", rule: "bouton réserver sticky, appel 1-tap" }
    ],
    animations: ["reveal fondu", "zoom lent imagerie", "hover menu"]
  },
  {
    id: "creative-portfolio",
    name: "Creative Portfolio",
    tagline: "Expression brute, projets plein cadre, navigation non conventionnelle",
    industries: ["portfolio", "studio", "designer", "photographe", "art", "musique", "mode"],
    traits: { playful: .8, colorful: .6, editorial: .7, dark: .5, immersive3d: .4 },
    pages: [
      { name: "Index", sections: [
        { name: "Hero typographique massif", purpose: "identité" },
        { name: "Projets plein cadre", purpose: "corpus" },
        { name: "Manifeste", purpose: "posture" },
        { name: "CTA collaborer", purpose: "conversion" }
      ] },
      { name: "Projets", sections: [{ name: "Liste expérimentale", purpose: "exploration" }] },
      { name: "À propos", sections: [{ name: "Portrait + parcours", purpose: "humaniser" }] },
      { name: "Contact", sections: [{ name: "Contact direct", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#101010", "#F5F5F0", "#FF5C28", "#9A9A90", "#1C1C1C"], typography: "Syne (titres) + Space Grotesk (texte)", typographyStack: { display: "Syne", body: "Space Grotesk" }, spacing: "Système libre, asymétries assumées", animations: ["curseur personnalisé", "transitions de page WebGL", "texte marquee", "survol déformation"], imagery: "Œuvres plein cadre, collages, textures", moodboardKeywords: ["orange signal", "grain", "risographie", "brut"] },
    components: [
      { name: "Navigation", variant: "index flottant", description: "Index projet + horloge locale", pages: ["*"] },
      { name: "Projets", variant: "hover reveal", description: "Aperçu image au survol du titre", pages: ["Index", "Projets"] },
      { name: "Marquee", variant: "défilé texte", description: "Compétences en boucle", pages: ["Index"] },
      { name: "Footer", variant: "brut", description: "Email géant, réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "typographie display 12vw" },
      { breakpoint: "≤768px", rule: "hover reveal → tap reveal" },
      { breakpoint: "≤480px", rule: "curseur custom désactivé" }
    ],
    animations: ["curseur custom", "transitions WebGL", "marquee", "hover déformation"]
  },
  {
    id: "serene-wellness",
    name: "Serene Wellness",
    tagline: "Respiration, nature, parcours d'inscription apaisé",
    industries: ["santé", "bien-être", "yoga", "thérapie", "beauté", "spa"],
    traits: { minimal: .8, storytelling: .5, colorful: .3, dark: .1 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero respirant", purpose: "calme immédiat" },
        { name: "Approche", purpose: "méthode" },
        { name: "Séances / soins", purpose: "offre" },
        { name: "Témoignages", purpose: "confiance" },
        { name: "Prendre rendez-vous", purpose: "conversion" }
      ] },
      { name: "Séances", sections: [{ name: "Détail des soins", purpose: "choix" }] },
      { name: "Praticiens", sections: [{ name: "Équipe", purpose: "confiance" }] },
      { name: "Rendez-vous", sections: [{ name: "Prise de RDV", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#F8FAF9", "#15332B", "#2F8F6B", "#6B8F80", "#E7F0EC"], typography: "Lora (titres) + Karla (texte)", typographyStack: { display: "Lora", body: "Karla" }, spacing: "Système 8pt aéré, arrondis 24px", animations: ["respiration (scale lente 6s)", "reveal doux", "transition couleur nature"], imagery: "Matières naturelles, lumière du matin, gros plans plantes", moodboardKeywords: ["sauge", "lin", "matin", "souffle"] },
    components: [
      { name: "Navigation", variant: "aérienne", description: "Fine, translucide, CTA feuille", pages: ["*"] },
      { name: "Module RDV", variant: "2 étapes", description: "Praticien puis créneau", pages: ["Rendez-vous", "Accueil"] },
      { name: "Cartes soins", variant: "image ronde", description: "Visuel circulaire, durée, prix", pages: ["Séances"] },
      { name: "Footer", variant: "doux", description: "Adresse, horaires, mention bien-être", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1080px, images 4:5" },
      { breakpoint: "≤768px", rule: "cartes soins en carrousel" },
      { breakpoint: "≤480px", rule: "CTA RDV sticky" }
    ],
    animations: ["respiration", "reveal doux", "transition nature"]
  }
];

/**
 * Classe les templates pour un brief : compatibilité 0-100 fondée sur
 * l'industrie, les traits et les pages attendues. Retourne le TOP 3.
 */
export function rankTemplatesForBrief(brief: WebDesignBrief): WebDesignTemplateCandidate[] {
  const scored = WEB_DESIGN_TEMPLATES.map((template) => {
    const reasons: string[] = [];
    let score = 34;
    const industryText = norm(`${brief.industry} ${brief.instruction}`);
    const industryMatch = template.industries.some((industry) => industryText.includes(norm(industry)));
    if (industryMatch) { score += 34; reasons.push(`industrie « ${brief.industry} » couverte`); }
    let traitMatch = 0;
    let traitTotal = 0;
    for (const [trait, value] of Object.entries(template.traits)) {
      if (typeof value !== "number") continue;
      const briefValue = brief.traits[trait as keyof WebDesignBrief["traits"]] ?? 0;
      traitTotal += 1;
      traitMatch += 1 - Math.min(1, Math.abs(briefValue - value));
      if (briefValue >= .55 && value >= .55) reasons.push(`trait « ${trait} » aligné`);
    }
    if (traitTotal) score += Math.round((traitMatch / traitTotal) * 26);
    const briefPageCount = brief.pages.length;
    const templatePageCount = template.pages.length;
    if (briefPageCount && Math.abs(briefPageCount - templatePageCount) <= 2) { score += 6; reasons.push(`structure ${templatePageCount} pages proche du besoin`); }
    if (brief.traits.ecommerce >= .6 && template.id === "bold-ecommerce") { score += 8; reasons.push("objectif e-commerce"); }
    if (brief.traits.immersive3d >= .6 && template.threeDElements.length) { score += 8; reasons.push("expérience 3D demandée"); }
    if (brief.premiumLevel === "ultra-premium" && template.traits.luxury && template.traits.luxury >= .8) { score += 6; reasons.push("niveau ultra-premium"); }
    return {
      templateId: template.id,
      name: template.name,
      compatibility: Math.max(5, Math.min(99, score)),
      reasons: [...new Set(reasons)].slice(0, 4)
    };
  });
  return scored.sort((a, b) => b.compatibility - a.compatibility).slice(0, 3);
}

export function templateById(id: string): WebDesignTemplate | undefined {
  return WEB_DESIGN_TEMPLATES.find((template) => template.id === id);
}
