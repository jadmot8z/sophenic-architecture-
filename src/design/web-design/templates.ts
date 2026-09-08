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
  },
  {
    id: "dark-mansion",
    name: "Mansion Sombre",
    tagline: "Immobilier d'exception, cinématique sombre, or discret",
    industries: ["immobilier", "villa", "propriete", "propriété", "mansion", "estate", "residence", "résidence", "location de luxe"],
    traits: { luxury: .9, dark: .8, editorial: .7, storytelling: .8, minimal: .4 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero vidéo sombre plein écran", purpose: "immersion patrimoniale" },
        { name: "Propriétés phares", purpose: "3 biens signature" },
        { name: "Services de conciergerie", purpose: "offre premium" },
        { name: "Témoignages de propriétaires", purpose: "confiance" },
        { name: "CTA visite privée", purpose: "conversion" }
      ] },
      { name: "Propriétés", sections: [
        { name: "Grille de propriétés", purpose: "parcours des biens" },
        { name: "Filtres (lieu, surface, budget)", purpose: "navigation" },
        { name: "Bien vedette", purpose: "coup de cœur" }
      ] },
      { name: "Services", sections: [{ name: "Gestion & conciergerie", purpose: "service continu" }] },
      { name: "Visite privée", sections: [{ name: "Formulaire discret", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#12100D", "#F2EAD9", "#C89B5A", "#8A7B66", "#1E1A15"], typography: "Cormorant Garamond (titres) + Karla (texte)", typographyStack: { display: "Cormorant Garamond", body: "Karla" }, spacing: "Système 8pt somptueux, marges 110px, images plein bord", animations: ["parallaxe cinématique", "fondu noir entre sections", "hover image → zoom lent 1.06", "compteurs de surfaces"], imagery: "Villas au crépuscule, droneshots, intérieurs éclairés à la bougie", moodboardKeywords: ["nuit", "cuivre", "pierre", "prestige"] },
    components: [
      { name: "Navigation", variant: "transparente sur hero", description: "Fine, blanche, devient sombre au scroll", pages: ["*"] },
      { name: "Carte propriété", variant: "image + prix discret", description: "Photo large, prix en petit, hover → galerie", pages: ["Propriétés"] },
      { name: "Bandeau chiffres", variant: "compteurs", description: "Surfaces, biens, pays", pages: ["Accueil"] },
      { name: "Footer", variant: "or sur noir", description: "Contact, réseaux, mentions", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "grille 12 col, hero vidéo muted" },
      { breakpoint: "≤768px", rule: "filtres en tiroir, cartes empilées" },
      { breakpoint: "≤480px", rule: "CTA visite sticky" }
    ],
    animations: ["parallaxe cinématique", "fondu noir", "zoom lent hover", "compteurs"]
  },
  {
    id: "fashion-lookbook",
    name: "Fashion Lookbook",
    tagline: "Mode plein cadre, défilement horizontal, audace éditoriale",
    industries: ["mode", "fashion", "lookbook", "streetwear", "collection", "defile", "défilé", "pret-a-porter", "prêt-à-porter"],
    traits: { editorial: .9, colorful: .4, dark: .4, luxury: .5, playful: .4 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Lookbook hero plein écran", purpose: "identité de saison" },
        { name: "Nouvelle collection", purpose: "nouveautés" },
        { name: "Éditorial de marque", purpose: "univers" },
        { name: "Feed Instagram", purpose: "preuve sociale" },
        { name: "Newsletter drop", purpose: "rétention" }
      ] },
      { name: "Collection", sections: [{ name: "Grille produits éditoriale", purpose: "parcours shopping" }, { name: "Pièces iconiques", purpose: "désir" }] },
      { name: "Lookbook", sections: [{ name: "Défilement horizontal", purpose: "immersion saison" }] },
      { name: "Marque", sections: [{ name: "Manifeste", purpose: "posture" }] }
    ],
    visualStyle: { colors: ["#F4F2EE", "#141414", "#B0413E", "#8C8C86", "#E9E5DE"], typography: "Archivo Expanded (titres) + Karla (texte)", typographyStack: { display: "Archivo Expanded", body: "Karla" }, spacing: "Système 8pt éditorial, typographie 9vw", animations: ["défilement horizontal du lookbook", "hover produit → second visuel", "texte marquee", "transitions blanc/noir"], imagery: "Lookbook studio, plein pied, éclairage graphique", moodboardKeywords: ["studio", "rouge signal", "plein pied", "tissu"] },
    components: [
      { name: "Navigation", variant: "centre minimalist", description: "Logo centré, liens fins", pages: ["*"] },
      { name: "Carte produit", variant: "double visuel", description: "Deux images, swap au hover, taille rapide", pages: ["Collection"] },
      { name: "Lookbook scroller", variant: "horizontal", description: "Série plein écran, drag/scroll", pages: ["Lookbook"] },
      { name: "Footer", variant: "marquee", description: "Email géant + réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "lookbook horizontal au drag" },
      { breakpoint: "≤768px", rule: "lookbook vertical, grille 2 col" },
      { breakpoint: "≤480px", rule: "tailles en sticky bottom" }
    ],
    animations: ["scroll horizontal", "swap visuel hover", "marquee", "transitions contrastées"]
  },
  {
    id: "saas-product",
    name: "SaaS Product",
    tagline: "Clarté produit, captures animées, conversion par l'essai",
    industries: ["saas", "logiciel", "application", "startup", "dashboard", "abonnement", "outil", "plateforme", "produit"],
    traits: { minimal: .7, corporate: .4, technological: .6, colorful: .3 },
    pages: [
      { name: "Home", sections: [
        { name: "Hero produit + démo", purpose: "promesse en 5 secondes" },
        { name: "Fonctionnalités clés", purpose: "valeur" },
        { name: "Captures & workflow", purpose: "preuve visuelle" },
        { name: "Tarifs", purpose: "décision" },
        { name: "FAQ", purpose: "objections" },
        { name: "CTA essai gratuit", purpose: "conversion" }
      ] },
      { name: "Fonctionnalités", sections: [{ name: "Détail par module", purpose: "profondeur" }] },
      { name: "Tarifs", sections: [{ name: "3 plans + comparatif", purpose: "conversion" }] },
      { name: "Docs", sections: [{ name: "Démarrage rapide", purpose: "activation" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#0F172A", "#4F46E5", "#64748B", "#F1F5F9"], typography: "Sora (titres) + Inter (texte)", typographyStack: { display: "Sora", body: "Inter" }, spacing: "Système 8pt, cartes ombrées légères, radius 14px", animations: ["démo produit animée", "apparition au scroll", "hover lift des cartes", "toggle pricing mensuel/annuel"], imagery: "Captures d'interface nettes, schémas de workflow, avatars clients", moodboardKeywords: ["indigo", "interface", "grille", "efficacité"] },
    components: [
      { name: "Navigation", variant: "sticky + CTA", description: "Liens produit, pricing, essai gratuit", pages: ["*"] },
      { name: "Hero démo", variant: "capture animée", description: "Titre + capture qui défile seule", pages: ["Home"] },
      { name: "Tableau tarifs", variant: "toggle", description: "Mensuel/annuel animé, plan mis en avant", pages: ["Tarifs", "Home"] },
      { name: "Footer", variant: "colonnes", description: "Produit, société, légal, status", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1180px" },
      { breakpoint: "≤768px", rule: "tarifs en cartes empilées" },
      { breakpoint: "≤480px", rule: "CTA essai sticky" }
    ],
    animations: ["démo animée", "reveal scroll", "hover lift", "toggle pricing"]
  },
  {
    id: "crypto-web3",
    name: "Crypto Web3",
    tagline: "Orbe 3D, néons, tokenomics et communaut",
    industries: ["crypto", "web3", "nft", "blockchain", "token", "defi", "metaverse", "métaverse", "wallet"],
    traits: { immersive3d: .85, technological: .9, dark: .95, colorful: .5, playful: .4 },
    pages: [
      { name: "Home", sections: [
        { name: "Hero orbe 3D", purpose: "wow technologique" },
        { name: "Écosystème", purpose: "composabilité" },
        { name: "Tokenomics", purpose: "modèle économique" },
        { name: "Roadmap", purpose: "vision" },
        { name: "Communauté", purpose: "appartenance" },
        { name: "CTA join", purpose: "conversion" }
      ] },
      { name: "Écosystème", sections: [{ name: "Protocoles liés", purpose: "cartographie" }] },
      { name: "Tokenomics", sections: [{ name: "Répartition animée", purpose: "transparence" }] },
      { name: "Docs", sections: [{ name: "Whitepaper & guides", purpose: "crédibilité" }] }
    ],
    visualStyle: { colors: ["#07080F", "#EAF0FF", "#7C5CFF", "#00D1FF", "#12131F"], typography: "Unbounded (titres) + IBM Plex Mono (données)", typographyStack: { display: "Unbounded", body: "IBM Plex Mono" }, spacing: "Système 8pt néon, cartes glass sur fond profond", animations: ["orbe 3D en rotation", "compteurs de supply", "glitch du titre", "gradient animé des accents"], imagery: "Rendus 3D de tokens, graphes lumineux, captures d'onchain", moodboardKeywords: ["violet", "cyan", "orbite", "onchain"] },
    components: [
      { name: "Navigation", variant: "pill glassmorphism", description: "Flottante, blur, bouton Launch App", pages: ["*"] },
      { name: "Hero 3D", variant: "canvas WebGL", description: "Orbe réactif, ticker live", pages: ["Home"] },
      { name: "Donut tokenomics", variant: "animé", description: "Répartition par tranche, légende mono", pages: ["Tokenomics"] },
      { name: "Footer", variant: "liens + status", description: "Écosystème, docs, réseaux", pages: ["*"] }
    ],
    threeDElements: [{ concept: "Orbe/token 3D signature réactif à la souris", library: "Three.js / React Three Fiber", placement: "Hero Home", rationale: "incarnation visuelle du protocole" }],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "canvas plein écran, DPR ≤ 2" },
      { breakpoint: "≤768px", rule: "orbe simplifié, ticker réduit" },
      { breakpoint: "≤480px", rule: "CTA join sticky" }
    ],
    animations: ["orbe 3D", "compteurs", "glitch", "gradient animé"]
  },
  {
    id: "fine-dining",
    name: "Fine Dining",
    tagline: "Gastronomie étoilée, noir & or, menu dégustation",
    industries: ["gastronomique", "étoile", "etoile", "restaurant gastronomique", "chef", "gastronomie", "degustation", "dégustation"],
    traits: { luxury: .8, dark: .7, editorial: .7, storytelling: .8 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero plat signature", purpose: "excellence immédiate" },
        { name: "Le chef", purpose: "auteur" },
        { name: "Menu dégustation", purpose: "offre" },
        { name: "Distinctions", purpose: "preuve" },
        { name: "Réservation", purpose: "conversion" }
      ] },
      { name: "Menu", sections: [{ name: "Dégustation & cartes", purpose: "décision" }] },
      { name: "Le chef", sections: [{ name: "Parcours", purpose: "récit" }] },
      { name: "Réserver", sections: [{ name: "Module réservation", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#14100C", "#F5EFE4", "#C9A961", "#8A7B66", "#201A13"], typography: "Playfair Display (titres) + Source Sans 3 (texte)", typographyStack: { display: "Playfair Display", body: "Source Sans 3" }, spacing: "Système 8pt cérémonieux, marges profondes, filets or", animations: ["reveal lent (1.1s)", "zoom plat signature (10s)", "accordéon de menu élégant", "survol or discret"], imagery: "Plats en lumière rasante, mains du chef, noir profond", moodboardKeywords: ["or", "nuit", "fur et plume", "étoile"] },
    components: [
      { name: "Navigation", variant: "centrée fine", description: "Liens espacés, filet or", pages: ["*"] },
      { name: "Menu accordéon", variant: "dégustation", description: "Temps par temps, prix alignés", pages: ["Menu"] },
      { name: "Module réservation", variant: "service & couverts", description: "Service, couverts, occasion", pages: ["Réserver", "Accueil"] },
      { name: "Footer", variant: "or sur noir", description: "Adresse, horaires, press", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "hero image 21:9" },
      { breakpoint: "≤768px", rule: "menu en accordéon natif" },
      { breakpoint: "≤480px", rule: "réserver sticky" }
    ],
    animations: ["reveal lent", "zoom signature", "accordéon élégant", "survol or"]
  },
  {
    id: "artisan-cafe",
    name: "Café Artisan",
    tagline: "Torréfaction chaleureuse, origines, abonnement grains",
    industries: ["café", "cafe", "coffee", "torréfacteur", "torrefacteur", "boulangerie", "brunch", "pâtisserie", "patisserie"],
    traits: { storytelling: .8, colorful: .5, playful: .4, dark: .25, minimal: .3 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero chaleureux", purpose: "odeur du café" },
        { name: "Nos cafés du moment", purpose: "offre" },
        { name: "Méthode de torréfaction", purpose: "savoir-faire" },
        { name: "Avis de clients", purpose: "confiance" },
        { name: "Venir nous voir", purpose: "conversion" }
      ] },
      { name: "Carte", sections: [{ name: "Boissons & pâtisseries", purpose: "décision" }] },
      { name: "Origines", sections: [{ name: "Fermes & profils", purpose: "traçabilité" }] },
      { name: "Abonnement", sections: [{ name: "Grains chaque mois", purpose: "récurrence" }] }
    ],
    visualStyle: { colors: ["#FBF6EE", "#2E2118", "#B4632A", "#7A6A55", "#F0E6D6"], typography: "Fraunces (titres) + Nunito Sans (texte)", typographyStack: { display: "Fraunces", body: "Nunito Sans" }, spacing: "Système 8pt chaleureux, arrondis 18px, textures papier", animations: ["reveal doux", "hover carte → lift", "marquee des origines", "carrousel des grains"], imagery: "Grains, vapeur, mains du barista, lumière de matin", moodboardKeywords: ["brun", "creme", "crème", "vapeur", "craft"] },
    components: [
      { name: "Navigation", variant: "sticky crème", description: "Logo + carte + abonnement", pages: ["*"] },
      { name: "Carte café", variant: "profil de goût", description: "Notes, origine, intensité", pages: ["Accueil", "Origines"] },
      { name: "Abonnement", variant: "3 formules", description: "Fréquence + mouture", pages: ["Abonnement"] },
      { name: "Footer", variant: "horaires + plan", description: "Adresse, horaires, réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "hero image 16:9" },
      { breakpoint: "≤768px", rule: "carte en accordéon" },
      { breakpoint: "≤480px", rule: "abonnement sticky" }
    ],
    animations: ["reveal doux", "lift hover", "marquee origines", "carrousel grains"]
  },
  {
    id: "bold-agency",
    name: "Bold Agency",
    tagline: "Agence audacieuse, typo XXL, études de cas percutantes",
    industries: ["agence", "branding", "marketing", "publicite", "publicité", "studio créatif", "studio creatif", "agence digitale", "communication"],
    traits: { playful: .8, colorful: .7, editorial: .7, dark: .5 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero typographique XXL", purpose: "posture" },
        { name: "Services", purpose: "offre" },
        { name: "Études de cas", purpose: "preuve" },
        { name: "Chiffres d'impact", purpose: "crédibilité" },
        { name: "CTA projet", purpose: "conversion" }
      ] },
      { name: "Services", sections: [{ name: "Brand / Digital / Content", purpose: "détail" }] },
      { name: "Projets", sections: [{ name: "Grille expérimentale", purpose: "portfolio" }] },
      { name: "Studio", sections: [{ name: "Équipe & culture", purpose: "proximité" }] }
    ],
    visualStyle: { colors: ["#0E0E0E", "#F5F5F0", "#2E4BFF", "#FF5C28", "#1A1A1A"], typography: "Syne (titres) + Space Grotesk (texte)", typographyStack: { display: "Syne", body: "Space Grotesk" }, spacing: "Système libre, asymétries, typographie 12vw", animations: ["curseur personnalisé", "texte marquee", "transitions de page", "survol déformation"], imagery: "Visuels de campagnes, collages, textures brutales", moodboardKeywords: ["bleu électrique", "orange signal", "grain", "audace"] },
    components: [
      { name: "Navigation", variant: "index latéral", description: "Liens + horloge locale", pages: ["*"] },
      { name: "Étude de cas", variant: "plein cadre", description: "Image XXL, résultat chiffré", pages: ["Projets", "Accueil"] },
      { name: "Marquee services", variant: "défilé", description: "Compétences en boucle", pages: ["Accueil"] },
      { name: "Footer", variant: "email géant", description: "Contact XXL, réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "typo display 12vw" },
      { breakpoint: "≤768px", rule: "grille projets 1 col" },
      { breakpoint: "≤480px", rule: "curseur custom off" }
    ],
    animations: ["curseur custom", "marquee", "transitions", "déformation hover"]
  },
  {
    id: "fullscreen-photography",
    name: "Fullscreen Photography",
    tagline: "Photographie plein cadre, diaporamas lents, séries",
    industries: ["photographe", "photographie", "photo", "shooting", "mariage", "portrait", "reportage"],
    traits: { minimal: .8, editorial: .8, dark: .6, luxury: .4 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero diaporama plein écran", purpose: "oeuvre immédiate" },
        { name: "Séries remarquables", purpose: "corpus" },
        { name: "À propos", purpose: "regard" },
        { name: "Contact", purpose: "conversion" }
      ] },
      { name: "Séries", sections: [{ name: "Galeries par projet", purpose: "exploration" }] },
      { name: "Expositions", sections: [{ name: "Passé & à venir", purpose: "notoriété" }] },
      { name: "Print shop", sections: [{ name: "Tirages en vente", purpose: "revenu" }] }
    ],
    visualStyle: { colors: ["#0B0B0B", "#F5F5F2", "#D9C9A3", "#9A9A90", "#161616"], typography: "Playfair Display (titres) + Inter (texte)", typographyStack: { display: "Playfair Display", body: "Inter" }, spacing: "Système 8pt galerie, images bord à bord, légendes discrètes", animations: ["diaporama lent (6s)", "fondu plein écran", "hover → infos photo", "scroll horizontal des galeries"], imagery: "Photographies d'auteur, noir profond, lumière naturelle", moodboardKeywords: ["noir", "argentique", "silence", "cadrage"] },
    components: [
      { name: "Navigation", variant: "minimale", description: "Prénom + menu, disparaît au scroll", pages: ["*"] },
      { name: "Diaporama", variant: "plein écran", description: "Crossfade, légendes serif", pages: ["Accueil"] },
      { name: "Galerie", variant: "masonry", description: "Grille asymétrique, lightbox", pages: ["Séries"] },
      { name: "Footer", variant: "discret", description: "Contact, droits, Instagram", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "diaporama plein écran" },
      { breakpoint: "≤768px", rule: "masonry 2 col, swipe" },
      { breakpoint: "≤480px", rule: "légendes sous image" }
    ],
    animations: ["crossfade", "diaporama lent", "hover infos", "scroll horizontal"]
  },
  {
    id: "swiss-architecture",
    name: "Swiss Architecture",
    tagline: "Grille suisse, projets rigoureux, plans et surfaces",
    industries: ["architecte", "architecture", "urbanisme", "agence d'architecture", "paysagiste", "construction", "maitrise d'oeuvre", "maîtrise d'œuvre"],
    traits: { minimal: .9, corporate: .5, dark: .2, editorial: .5 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero projet phare", purpose: "exactitude" },
        { name: "Projets sélectionnés", purpose: "corpus" },
        { name: "Approche", purpose: "méthode" },
        { name: "Équipe", purpose: "humain" },
        { name: "CTA contact", purpose: "conversion" }
      ] },
      { name: "Projets", sections: [{ name: "Index par année", purpose: "archive" }, { name: "Fiches projets", purpose: "détail" }] },
      { name: "Approche", sections: [{ name: "Processus", purpose: "méthode" }] },
      { name: "Publications", sections: [{ name: "Presse & prix", purpose: "notoriété" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#111111", "#E4572E", "#757575", "#F2F2F2"], typography: "Libre Franklin (titres) + Inter (texte)", typographyStack: { display: "Libre Franklin", body: "Inter" }, spacing: "Grille suisse stricte, 12 col, interlignage ouvert", animations: ["grille qui se révèle", "hover → plan technique", "compteurs de surfaces", "scroll snap projets"], imagery: "Photographie d'architecture, plans, maquettes blanches", moodboardKeywords: ["blanc", "plan", "béton", "grille"] },
    components: [
      { name: "Navigation", variant: "grille", description: "Liens monospace, index numéroté", pages: ["*"] },
      { name: "Fiche projet", variant: "plan + photos", description: "Surface, année, lieu, programme", pages: ["Projets"] },
      { name: "Index", variant: "liste", description: "Années, programme, lieu", pages: ["Projets"] },
      { name: "Footer", variant: "minimal", description: "Adresse, CV, contact", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "grille 12 col stricte" },
      { breakpoint: "≤768px", rule: "index en accordéon" },
      { breakpoint: "≤480px", rule: "fiches empilées" }
    ],
    animations: ["reveal grille", "hover plan", "compteurs", "scroll snap"]
  },
  {
    id: "prestige-law",
    name: "Prestige Law",
    tagline: "Cabinet d'avocats, sérénité institutionnelle, expertise",
    industries: ["avocat", "droit", "juridique", "notaire", "cabinet", "conseil juridique", "barreau"],
    traits: { corporate: .9, luxury: .5, minimal: .6, dark: .3 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero institutionnel", purpose: "autorité" },
        { name: "Domaines d'expertise", purpose: "offre" },
        { name: "Notoriété & résultats", purpose: "preuve" },
        { name: "Équipe", purpose: "talents" },
        { name: "CTA rendez-vous", purpose: "conversion" }
      ] },
      { name: "Domaines", sections: [{ name: "Droit des affaires, famille…", purpose: "profondeur" }] },
      { name: "Équipe", sections: [{ name: "Associés & collaborateurs", purpose: "confiance" }] },
      { name: "Insights", sections: [{ name: "Analyses juridiques", purpose: "autorité" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#0B1B2B", "#9A7B4F", "#42586E", "#F4F1EA"], typography: "Source Serif 4 (titres) + Inter (texte)", typographyStack: { display: "Source Serif 4", body: "Inter" }, spacing: "Système 8pt institutionnel, sections délimitées, filets fins", animations: ["apparition sobre (250ms)", "compteurs d'affaires", "méga-menu animé", "hover filet doré"], imagery: "Portraits en costume, palais de justice, bibliothèques", moodboardKeywords: ["bleu nuit", "or discret", "marbre", "érudition"] },
    components: [
      { name: "Navigation", variant: "méga-menu", description: "Domaines déroulants, CTA rendez-vous", pages: ["*"] },
      { name: "Fiche avocat", variant: "portrait + titres", description: "Photo, barreaux, spécialités", pages: ["Équipe"] },
      { name: "Bandeau résultats", variant: "compteurs", description: "Affaires, années, distinctions", pages: ["Accueil"] },
      { name: "Footer", variant: "institutionnel", description: "Mentions, barreau, contact", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1120px" },
      { breakpoint: "≤768px", rule: "méga-menu → accordéon" },
      { breakpoint: "≤480px", rule: "CTA rendez-vous sticky" }
    ],
    animations: ["apparition sobre", "compteurs", "méga-menu", "hover filet"]
  },
  {
    id: "medical-care",
    name: "Medical Care",
    tagline: "Clinique rassurante, parcours patient clair, rendez-vous simple",
    industries: ["clinique", "medecin", "médecin", "dentiste", "hopital", "hôpital", "cabinet medical", "cabinet médical", "soins", "sante", "santé"],
    traits: { minimal: .8, corporate: .4, colorful: .2, dark: .05 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero rassurant", purpose: "confiance immédiate" },
        { name: "Spécialités", purpose: "offre de soins" },
        { name: "Équipe médicale", purpose: "réassurance" },
        { name: "Parcours patient", purpose: "simplicité" },
        { name: "CTA rendez-vous", purpose: "conversion" }
      ] },
      { name: "Spécialités", sections: [{ name: "Par pratique", purpose: "navigation" }] },
      { name: "Médecins", sections: [{ name: "Praticiens & créneaux", purpose: "choix" }] },
      { name: "Rendez-vous", sections: [{ name: "Module RDV en ligne", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#FFFFFF", "#12324F", "#1F7A8C", "#6B7B8C", "#EFF6F8"], typography: "Libre Franklin (titres) + Karla (texte)", typographyStack: { display: "Libre Franklin", body: "Karla" }, spacing: "Système 8pt aéré, arrondis 20px, blancs apaisants", animations: ["apparition douce", "module RDV en 2 étapes", "badges de confiance", "hover carte spécialité"], imagery: "Praticiens souriants, salles lumineuses, schémas anatomiques doux", moodboardKeywords: ["bleu ciel", "blanc", "calme", "soin"] },
    components: [
      { name: "Navigation", variant: "sticky claire", description: "Spécialités, médecins, RDV", pages: ["*"] },
      { name: "Module RDV", variant: "2 étapes", description: "Spécialité puis créneau", pages: ["Rendez-vous", "Accueil"] },
      { name: "Carte spécialité", variant: "icône + lien", description: "Icône linéaire, titre, flèche", pages: ["Spécialités"] },
      { name: "Footer", variant: "infos pratiques", description: "Accès, horaires, urgences", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1100px" },
      { breakpoint: "≤768px", rule: "spécialités en carrousel" },
      { breakpoint: "≤480px", rule: "bouton RDV sticky, appel 1-tap" }
    ],
    animations: ["apparition douce", "RDV 2 étapes", "badges", "hover spécialité"]
  },
  {
    id: "academy-learning",
    name: "Academy Learning",
    tagline: "Formation engageante, catalogue clair, progression visible",
    industries: ["formation", "cours", "academie", "académie", "e-learning", "ecole", "école", "coaching", "certification", "apprentissage"],
    traits: { colorful: .6, playful: .5, minimal: .5, storytelling: .4 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero apprenants", purpose: "projection" },
        { name: "Catalogue de cours", purpose: "offre" },
        { name: "Formateurs", purpose: "crédibilité" },
        { name: "Témoignages de réussite", purpose: "preuve" },
        { name: "CTA inscription", purpose: "conversion" }
      ] },
      { name: "Catalogue", sections: [{ name: "Cours par domaine", purpose: "navigation" }, { name: "Parcours certifiants", purpose: "valeur" }] },
      { name: "Formateurs", sections: [{ name: "Enseignants", purpose: "confiance" }] },
      { name: "Tarifs", sections: [{ name: "Formules & financement", purpose: "décision" }] }
    ],
    visualStyle: { colors: ["#FFFBF2", "#1F2937", "#F59E0B", "#6B7280", "#FDF3E3"], typography: "Sora (titres) + Karla (texte)", typographyStack: { display: "Sora", body: "Karla" }, spacing: "Système 8pt énergique, cartes arrondies 16px", animations: ["barres de progression animées", "hover carte cours", "compteur d'apprenants", "badges certification"], imagery: "Apprenants en action, captures de cours, badges", moodboardKeywords: ["ambre", "papier", "progression", "énergie"] },
    components: [
      { name: "Navigation", variant: "sticky + recherche", description: "Catalogue, tarifs, connexion", pages: ["*"] },
      { name: "Carte cours", variant: "progression", description: "Durée, niveau, progression", pages: ["Catalogue", "Accueil"] },
      { name: "Témoignage", variant: "avant/après", description: "Rôle avant → après la formation", pages: ["Accueil"] },
      { name: "Footer", variant: "colonnes", description: "Catalogue, aide, légal", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "grille cours 3 col" },
      { breakpoint: "≤768px", rule: "catalogue en carrousel" },
      { breakpoint: "≤480px", rule: "CTA inscription sticky" }
    ],
    animations: ["progression", "hover cours", "compteurs", "badges"]
  },
  {
    id: "impact-nonprofit",
    name: "Impact Nonprofit",
    tagline: "ONG humaine, impact chiffré, don fluide",
    industries: ["ong", "association", "humanitaire", "caritatif", "don", "donation", "environnement", "solidarite", "solidarité"],
    traits: { storytelling: .9, colorful: .6, editorial: .6, playful: .3 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero mission", purpose: "émotion" },
        { name: "Impact chiffré", purpose: "preuve" },
        { name: "Programmes", purpose: "action" },
        { name: "Témoignages de terrain", purpose: "proximité" },
        { name: "Faire un don", purpose: "conversion" }
      ] },
      { name: "Programmes", sections: [{ name: "Par mission", purpose: "détail" }] },
      { name: "Impact", sections: [{ name: "Rapports & transparence", purpose: "confiance" }] },
      { name: "Devenir bénévole", sections: [{ name: "Rejoindre", purpose: "engagement" }] }
    ],
    visualStyle: { colors: ["#FAF7F0", "#20301F", "#3E7C4F", "#7A8B6F", "#EDF2E6"], typography: "Lora (titres) + Karla (texte)", typographyStack: { display: "Lora", body: "Karla" }, spacing: "Système 8pt humain, arrondis 18px, photos bord à bord", animations: ["compteurs d'impact", "reveal photo/récit", "barre de dons animée", "hover programme"], imagery: "Portraits de terrain, mains, paysages vivants", moodboardKeywords: ["vert", "terre", "main", "espoir"] },
    components: [
      { name: "Navigation", variant: "mission", description: "Programmes, impact, don", pages: ["*"] },
      { name: "Module don", variant: "montants suggérés", description: "3 montants + libre, mensuel", pages: ["Accueil"] },
      { name: "Compteur d'impact", variant: "animé", description: "Bénéficiaires, programmes, pays", pages: ["Accueil", "Impact"] },
      { name: "Footer", variant: "transparence", description: "Rapports, contacts, réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "conteneur 1140px" },
      { breakpoint: "≤768px", rule: "programmes en carrousel" },
      { breakpoint: "≤480px", rule: "bouton don sticky" }
    ],
    animations: ["compteurs", "reveal récit", "barre dons", "hover programme"]
  },
  {
    id: "festival-energy",
    name: "Festival Energy",
    tagline: "Line-up électrique, billetterie nerveuse, couleurs néon",
    industries: ["festival", "evenement", "événement", "concert", "billetterie", "billet", "expo", "soiree", "soirée", "culture"],
    traits: { playful: .9, colorful: .9, dark: .5, immersive3d: .3 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero line-up animé", purpose: "excitation" },
        { name: "Programme", purpose: "line-up complet" },
        { name: "Artistes à venir", purpose: "teasing" },
        { name: "Billeterie", purpose: "conversion" },
        { name: "Infos pratiques", purpose: "logistique" }
      ] },
      { name: "Programme", sections: [{ name: "Par jour & scène", purpose: "navigation" }] },
      { name: "Artistes", sections: [{ name: "Grille d'artistes", purpose: "découverte" }] },
      { name: "Billeterie", sections: [{ name: "Formules & pass", purpose: "conversion" }] }
    ],
    visualStyle: { colors: ["#12081F", "#FFF8E7", "#FF2E88", "#7C5CFF", "#1D0F33"], typography: "Unbounded (titres) + Space Grotesk (texte)", typographyStack: { display: "Unbounded", body: "Space Grotesk" }, spacing: "Système 8pt électrique, diagonales, néon", animations: ["line-up animé lettre par lettre", "billets en tilt 3D", "marquee des dates", "confettis au clic billetterie"], imagery: "Foules éclairées, scènes néon, portraits d'artistes", moodboardKeywords: ["néon rose", "violet", "stroboscope", "été"] },
    components: [
      { name: "Navigation", variant: "compteur jours", description: "J-XX avant l'ouverture, billets", pages: ["*"] },
      { name: "Carte artiste", variant: "néon", description: "Photo, scène, heure, hover glow", pages: ["Artistes", "Programme"] },
      { name: "Billet", variant: "tilt 3D", description: "Pass holographique, prix, ajouter", pages: ["Billeterie"] },
      { name: "Footer", variant: "partenaires", description: "Sponsors, contact, réseaux", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "programme en grille horaire" },
      { breakpoint: "≤768px", rule: "programme par jour, swipe" },
      { breakpoint: "≤480px", rule: "billeterie sticky" }
    ],
    animations: ["line-up animé", "tilt 3D billet", "marquee", "confettis"]
  },
  {
    id: "podcast-studio",
    name: "Podcast Studio",
    tagline: "Épisodes en avant, lecteur intégré, abonnement simple",
    industries: ["podcast", "emission", "émission", "radio", "media", "média", "magazine", "newsletter", "blog", "edition", "édition"],
    traits: { storytelling: .7, editorial: .8, colorful: .4, dark: .5 },
    pages: [
      { name: "Accueil", sections: [
        { name: "Hero dernier épisode", purpose: "écoute immédiate" },
        { name: "Derniers épisodes", purpose: "catalogue" },
        { name: "Hôtes & invités", purpose: "proximité" },
        { name: "S'abonner", purpose: "conversion" }
      ] },
      { name: "Épisodes", sections: [{ name: "Liste + lecteur", purpose: "écoute" }, { name: "Par thème", purpose: "navigation" }] },
      { name: "Hôtes", sections: [{ name: "Présentateurs", purpose: "visibilité" }] },
      { name: "Articles", sections: [{ name: "Notes & transcriptions", purpose: "profondeur" }] }
    ],
    visualStyle: { colors: ["#17110E", "#F7EFE6", "#E0533D", "#9C8B7A", "#241B15"], typography: "Fraunces (titres) + Work Sans (texte)", typographyStack: { display: "Fraunces", body: "Work Sans" }, spacing: "Système 8pt studio, grandes jaquettes, interlignage aéré", animations: ["waveform animée du lecteur", "lecteur sticky", "hover épisode → play", "apparition douce"], imagery: "Jaquettes d'épisodes, micros, portraits d'hôtes", moodboardKeywords: ["terracotta", "son", "studio", "voix"] },
    components: [
      { name: "Navigation", variant: "studio", description: "Épisodes, hôtes, abonnement", pages: ["*"] },
      { name: "Lecteur", variant: "sticky", description: "Waveform, vitesse, partage", pages: ["*"] },
      { name: "Carte épisode", variant: "jaquette + play", description: "Durée, date, invité", pages: ["Accueil", "Épisodes"] },
      { name: "Footer", variant: "plateformes", description: "Apple, Spotify, YouTube, RSS", pages: ["*"] }
    ],
    threeDElements: [],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "liste épisodes 2 col" },
      { breakpoint: "≤768px", rule: "lecteur sticky bas" },
      { breakpoint: "≤480px", rule: "jaquettes 1 col" }
    ],
    animations: ["waveform", "lecteur sticky", "hover play", "apparition douce"]
  },
  {
    id: "app-showcase",
    name: "App Showcase",
    tagline: "Vitrine app mobile, mockups 3D, téléchargement évident",
    industries: ["application mobile", "app", "ios", "android", "mobile", "launch", "produit mobile"],
    traits: { technological: .7, minimal: .6, playful: .5, colorful: .5, immersive3d: .5 },
    pages: [
      { name: "Home", sections: [
        { name: "Hero mockup téléphone", purpose: "produit en main" },
        { name: "Fonctionnalités", purpose: "valeur" },
        { name: "Carrousel de captures", purpose: "preuve" },
        { name: "Avis stores", purpose: "confiance" },
        { name: "Télécharger", purpose: "conversion" }
      ] },
      { name: "Fonctionnalités", sections: [{ name: "Par usage", purpose: "détail" }] },
      { name: "Captures", sections: [{ name: "Galerie d'écrans", purpose: "exploration" }] },
      { name: "Tarifs", sections: [{ name: "Freemium & pro", purpose: "monétisation" }] }
    ],
    visualStyle: { colors: ["#0B0F14", "#F2F6FA", "#00C2A8", "#7C8FA3", "#141B24"], typography: "Space Grotesk (titres) + Inter (texte)", typographyStack: { display: "Space Grotesk", body: "Inter" }, spacing: "Système 8pt produit, mockups flottants, radius 20px", animations: ["tilt 3D du téléphone", "captures pilotées au scroll", "badges stores pulsés", "apparition au scroll"], imagery: "Mockups d'app, captures d'écran, mains tenant le téléphone", moodboardKeywords: ["turquoise", "nuit", "glass", "mobile"] },
    components: [
      { name: "Navigation", variant: "sticky glass", description: "Fonctions, captures, télécharger", pages: ["*"] },
      { name: "Mockup 3D", variant: "tilt interactif", description: "Téléphone qui suit la souris", pages: ["Home"] },
      { name: "Carrousel captures", variant: "scroll", description: "Écrans alignés, drag horizontal", pages: ["Captures", "Home"] },
      { name: "Badges stores", variant: "App Store / Play", description: "Boutons de téléchargement officiels", pages: ["Home"] }
    ],
    threeDElements: [{ concept: "Mockup téléphone 3D inclinable au pointeur", library: "React Three Fiber + drei", placement: "Hero Home", rationale: "le produit devient tangible dès la première seconde" }],
    responsiveRules: [
      { breakpoint: "≥1280px", rule: "mockup central 420px" },
      { breakpoint: "≤768px", rule: "tilt désactivé, swipe captures" },
      { breakpoint: "≤480px", rule: "badges stores sticky" }
    ],
    animations: ["tilt 3D", "captures scroll", "badges pulse", "reveal"]
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
    const matchedIndustries = template.industries.map((industry) => norm(industry)).filter((industry) => industry.length >= 3 && industryText.includes(industry));
    const industryStrength = matchedIndustries.reduce((max, keyword) => Math.max(max, keyword.length), 0);
    if (matchedIndustries.length) {
      // Bonus pondéré par la spécificité du mot-clé industrie : « hôtellerie » (10)
      // pèse plus qu'un mot-clé générique (« luxe », 4) — départage les égalités
      // entre templates de luxe au profit du secteur réellement demandé.
      score += 22 + Math.min(12, industryStrength);
      reasons.push(`industrie « ${brief.industry} » couverte`);
    }
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
  return scored.sort((a, b) => b.compatibility - a.compatibility).slice(0, 5);
}

export function templateById(id: string): WebDesignTemplate | undefined {
  return WEB_DESIGN_TEMPLATES.find((template) => template.id === id);
}
