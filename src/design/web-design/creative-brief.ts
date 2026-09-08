import { chatWithExistingBrain, parseBrainJson, type BrainChatMessage, type DesignIntentEffortMode } from "../design-intent-ai";
import type { WebDesignAttachment } from "./types";
import { hashText } from "./style-engine";
import type { WebDesignBrief } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — CREATIVE BRIEF.
 *
 * Le SOPHENIC Brain EXISTANT analyse la demande (industrie, audience,
 * positionnement, émotions, niveau premium, objectif de conversion, pages).
 * Sans IA joignable, un brief heuristique déterministe prend le relais —
 * le pipeline ne casse jamais.
 */

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type IndustryRecipe = {
  industry: string;
  keys: RegExp;
  audience: string;
  positioning: string;
  emotions: string[];
  premiumLevel: WebDesignBrief["premiumLevel"];
  conversionGoal: string;
  pages: string[];
  traits: Partial<WebDesignBrief["traits"]>;
};

const INDUSTRY_RECIPES: IndustryRecipe[] = [
  {
    industry: "bijouterie & horlogerie", keys: /bijou|joailler|jewel|bague|collier|montre|luxury jewelry|haute joaillerie/,
    audience: "clientèle fortunée, collectionneurs, occasions d'exception", positioning: "artisanat d'exception et héritage",
    emotions: ["désir", "exclusivité", "élégance"], premiumLevel: "ultra-premium", conversionGoal: "prise de rendez-vous privé / demande sur-mesure",
    pages: ["Accueil", "Collections", "Savoir-faire", "Boutiques", "Rendez-vous privé"],
    traits: { luxury: .95, minimal: .55, editorial: .8, storytelling: .7, dark: .4 }
  },
  {
    industry: "hôtellerie & villas de luxe", keys: /hotel|h[oô]tel|villa|riad|marrakech|resort|lodge|palace|hospitality/,
    audience: "voyageurs exigeants, séjours d'exception", positioning: "hospitalité singulière et immersive",
    emotions: ["évasion", "sérénité", "merveilleux"], premiumLevel: "ultra-premium", conversionGoal: "réservation directe",
    pages: ["Accueil", "Villa / Chambres", "Expériences", "Galerie", "Localisation", "Réservation"],
    traits: { luxury: .85, storytelling: .85, editorial: .6, immersive3d: .3, dark: .25 }
  },
  {
    industry: "gaming & IA", keys: /gaming|jeu vid[ée]o|esport|ia\b|ai\b|intelligence artificielle|agent ia|bot|machine learning/,
    audience: "joueurs, créateurs, early adopters tech", positioning: "innovation radicale et performance",
    emotions: ["excitation", "puissance", "futur"], premiumLevel: "premium", conversionGoal: "essai gratuit / join beta",
    pages: ["Home", "Features", "Playground", "Benchmarks", "Pricing", "Community"],
    traits: { immersive3d: .9, technological: .95, dark: .9, playful: .6, colorful: .5 }
  },
  {
    industry: "tech & SaaS", keys: /saas|startup|software|application|plateforme|app\b|outil|dashboard|b2b tech|d[ée]veloppeur/,
    audience: "équipes produit, décideurs tech", positioning: "clarté produit et efficacité",
    emotions: ["confiance", "efficacité", "simplicité"], premiumLevel: "premium", conversionGoal: "inscription / demo",
    pages: ["Accueil", "Fonctionnalités", "Tarifs", "Témoignages", "Docs"],
    traits: { minimal: .7, corporate: .4, technological: .6, dark: .3 }
  },
  {
    industry: "mode & beauté", keys: /mode|fashion|pr[êe]t-[àa]-porter|streetwear|sneaker|beaut[ée]|cosm[ée]tique|parfum|skincare/,
    audience: "audience tendance, acheteuses/acheteurs engagés", positioning: "identité forte et désirabilité",
    emotions: ["désir", "appartenance", "audace"], premiumLevel: "premium", conversionGoal: "achat / newsletter drop",
    pages: ["Accueil", "Nouvelle collection", "Lookbook", "À propos", "Boutique"],
    traits: { ecommerce: .8, editorial: .7, colorful: .5, luxury: .4 }
  },
  {
    industry: "restauration", keys: /restaurant|caf[ée]|bistro|brasserie|p[âa]tiss|gastronom|table|food|traiteur/,
    audience: "gourmets locaux, habitués, événementiel", positioning: "table d'auteur et convivialité",
    emotions: ["gourmandise", "chaleur", "surprise"], premiumLevel: "premium", conversionGoal: "réservation de table",
    pages: ["Accueil", "La carte", "Galerie", "Le lieu", "Réserver"],
    traits: { storytelling: .8, dark: .4, colorful: .35, luxury: .35 }
  },
  {
    industry: "finance & conseil", keys: /finance|assurance|banque|conseil|audit|avocat|notaire|capital|fintech|immobilier/,
    audience: "directions, investisseurs, particuliers fortunés", positioning: "rigueur, résultats, confidentialité",
    emotions: ["confiance", "sécurité", "performance"], premiumLevel: "premium", conversionGoal: "prise de contact qualifiée",
    pages: ["Accueil", "Expertises", "Références", "Insights", "Contact"],
    traits: { corporate: .9, minimal: .5, dark: .2 }
  },
  {
    industry: "santé & bien-être", keys: /sant[ée]|bien-[êe]tre|bienetre|yoga|th[ée]rapie|m[ée]decin|clinique|soins|sport|coach/,
    audience: "personnes en recherche d'équilibre", positioning: "accompagnement bienveillant et expert",
    emotions: ["apaisement", "confiance", "énergie"], premiumLevel: "accessible", conversionGoal: "prise de rendez-vous",
    pages: ["Accueil", "Séances", "Praticiens", "Témoignages", "Rendez-vous"],
    traits: { minimal: .8, storytelling: .4, colorful: .3, dark: .1 }
  },
  {
    industry: "créatif & culture", keys: /portfolio|studio|designer|photographe|artiste|musique|festival|galerie|exposition|[ée]v[ée]nement|agence cr[ée]atif/,
    audience: "clients créatifs, presse, curateurs", positioning: "posture d'auteur",
    emotions: ["curiosité", "admiration", "audace"], premiumLevel: "premium", conversionGoal: "projet / collaboration",
    pages: ["Index", "Projets", "Manifeste", "Contact"],
    traits: { playful: .75, editorial: .75, dark: .5, colorful: .6 }
  },
  {
    industry: "e-commerce", keys: /boutique|shop|store|ecommerce|e-commerce|marketplace|retail|vendre|produits/,
    audience: "acheteurs en ligne, audiences sociales", positioning: "sélection engageante et conversion fluide",
    emotions: ["envie", "réassurance", "rapidité"], premiumLevel: "accessible", conversionGoal: "achat",
    pages: ["Boutique", "Produit", "À propos", "Panier"],
    traits: { ecommerce: .95, colorful: .6, playful: .4 }
  },
  {
    industry: "média & éducation", keys: /magazine|blog|m[ée]dia|journal|formation|cours|[ée]cole|universit[ée]|e-learning|asso|ong/,
    audience: "lecteurs fidèles, apprenants", positioning: "contenus de référence",
    emotions: ["intérêt", "clarté", "progression"], premiumLevel: "accessible", conversionGoal: "abonnement / inscription",
    pages: ["Accueil", "Articles", "Rubriques", "Abonnement"],
    traits: { editorial: .85, minimal: .5, storytelling: .5 }
  }
];

const GENERIC_RECIPE: IndustryRecipe = {
  keys: /.*/,
  industry: "généraliste", audience: "grand public et prospects qualifiés", positioning: "identité claire et différenciée",
  emotions: ["confiance", "envie"], premiumLevel: "premium", conversionGoal: "contact / conversion principale",
  pages: ["Accueil", "Offre", "Réalisations", "Contact"],
  traits: { minimal: .6, storytelling: .4 }
};

const PREMIUM_WORDS = /ultra[- ]premium|luxe|luxury|haute gamme|haut de gamme|premium|exclusif|excellent|exception|majestueux|palace|royal|prestige/;
const ACCESSIBLE_WORDS = /simple|accessible|pas cher|[ée]conomique|rapide|grand public|startup modeste/;

export function heuristicWebDesignBrief(instruction: string): WebDesignBrief {
  const text = instruction.trim();
  const lower = norm(text);
  const recipe = INDUSTRY_RECIPES.find((entry) => entry.keys.test(lower)) || GENERIC_RECIPE;
  // Marque : entre guillemets « "X" », ou après « pour/pour la/for », sinon titre composé.
  let brand = "";
  const quoted = text.match(/["«“']([^"»”']{2,40})["»”']/);
  if (quoted) brand = quoted[1].trim();
  if (!brand) {
    const forBrand = text.match(/(?:pour|for|de la marque)\s+(?:la\s+|le\s+|l')?([A-ZÉÈÀÂ][\wéèàâêïôûÉÈÀÂÊÏÔÛ-]*(?:\s+[A-ZÉÈÀÂ][\wéèàâêïôûÉÈÀÂÊÏÔÛ-]*)?)/);
    if (forBrand) brand = forBrand[1].trim();
  }
  const premiumLevel = ACCESSIBLE_WORDS.test(lower) ? "accessible" : PREMIUM_WORDS.test(lower) || recipe.premiumLevel === "ultra-premium" && /luxe|luxury|royal|palace|exception/.test(lower)
    ? recipe.premiumLevel === "ultra-premium" ? "ultra-premium" : "premium"
    : recipe.premiumLevel;
  const traits: WebDesignBrief["traits"] = {
    luxury: recipe.traits.luxury ?? (/luxe|luxury|royal|palace|premium/.test(lower) ? .8 : .2),
    minimal: recipe.traits.minimal ?? (/minimal|[ée]pur[ée]|simple|sobre/.test(lower) ? .8 : .4),
    immersive3d: recipe.traits.immersive3d ?? (/3d|immersif|webgl|interactif|exp[ée]rience/.test(lower) ? .7 : .15),
    editorial: recipe.traits.editorial ?? .3,
    dark: recipe.traits.dark ?? (/sombre|dark|noir|nuit|futuriste|futuristic/.test(lower) ? .85 : .2),
    colorful: recipe.traits.colorful ?? (/color[ée]|vivant|pop|audacieux|fun/.test(lower) ? .7 : .25),
    corporate: recipe.traits.corporate ?? (/corporate|institutionnel|professionnel/.test(lower) ? .8 : .2),
    playful: recipe.traits.playful ?? (/fun|jeune|pop|cr[ée]atif|audacieux/.test(lower) ? .7 : .25),
    ecommerce: recipe.traits.ecommerce ?? (/acheter|boutique|panier|shop/.test(lower) ? .8 : .1),
    storytelling: recipe.traits.storytelling ?? (/histoire|r[ée]cit|univers|narration/.test(lower) ? .8 : .35),
    technological: recipe.traits.technological ?? (/tech|ia\b|ai\b|num[ée]rique|futuriste/.test(lower) ? .8 : .25)
  };
  const pages = [...recipe.pages];
  if (/galerie|gallery|photos/.test(lower) && !pages.some((page) => /galerie|gallery/i.test(page))) pages.push("Galerie");
  if (/blog|articles|journal/.test(lower) && !pages.some((page) => /article|blog|journal/i.test(page))) pages.push("Blog");
  return {
    instruction: text,
    brand: brand || (recipe.industry === "généraliste" ? "" : `Maison ${recipe.industry.split(" ")[0].replace(/&/g, "").trim()}`),
    industry: recipe.industry,
    audience: recipe.audience,
    positioning: recipe.positioning,
    emotions: [...recipe.emotions],
    premiumLevel,
    conversionGoal: recipe.conversionGoal,
    pages,
    traits,
    language: /[a-zA-Z]/.test(text) && !/[àâçéèêëîïôûùüÿœæ]/.test(text) && /\b(the|website|create|brand)\b/.test(lower) ? "en" : "fr",
    origin: "heuristic",
    notes: `Brief heuristique (industrie « ${recipe.industry} »).`
  };
}

/** Schéma JSON strict exigé du Brain pour le brief créatif. */
export const WEB_BRIEF_BRAIN_PROMPT = `Tu es directeur de création digital senior de SOPHENIC Web Design. Analyse la demande de design de site et réponds UNIQUEMENT en JSON valide (aucun markdown) :
{"brand":"nom de marque ou \"\"","industry":"secteur précis","audience":"cible en une phrase","positioning":"positionnement de marque en une phrase","emotions":["3-5 émotions cibles"],"premiumLevel":"accessible|premium|ultra-premium","conversionGoal":"objectif de conversion principal","pages":["pages du site (4-8)"],"traits":{"luxury":0-1,"minimal":0-1,"immersive3d":0-1,"editorial":0-1,"dark":0-1,"colorful":0-1,"corporate":0-1,"playful":0-1,"ecommerce":0-1,"storytelling":0-1,"technological":0-1}}
RÈGLES : déduis l'industrie du vocabulaire réel (joaillerie, hôtellerie, gaming, IA, mode, restauration, finance, santé, créatif, e-commerce, média…). Sois précis sur les traits (un site de luxe joaillier n'a rien à voir avec un site de gaming IA). N'invente pas de marque si aucune n'est citée.`;

export function buildBriefMessages(instruction: string, attachments?: WebDesignAttachment[]): BrainChatMessage[] {
  const files = attachments || [];
  const images = files.filter((file) => file.mime.startsWith("image/")).map((file) => file.dataUrl);
  const documents = files.filter((file) => !file.mime.startsWith("image/")).map((file) => ({ name: file.name, mime: file.mime, dataUrl: file.dataUrl }));
  const attachmentNote = files.length
    ? `\n\nRÉFÉRENCES JOINTES PAR L'UTILISATEUR (${files.length}) : ${files.map((file) => `${file.name} (${file.mime || "inconnu"})`).join(", ")}. Analyse-les (style visuel, couleurs, ambiance, niveau de gamme) et intègre ce que tu vois dans le brief (emotions, traits, premiumLevel).`
    : "";
  return [{
    role: "user",
    content: `${WEB_BRIEF_BRAIN_PROMPT}\n\n====================\n\nDEMANDE : ${instruction.slice(0, 3000)}${attachmentNote}\n\nRenvoie maintenant le JSON du brief créatif.`,
    ...(images.length ? { images } : {}),
    ...(documents.length ? { files: documents } : {})
  }];
}

function asNumber01(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function mergeBrainBrief(base: WebDesignBrief, brain: Record<string, unknown>): WebDesignBrief {
  const merged: WebDesignBrief = { ...base, origin: "brain" };
  if (typeof brain.brand === "string" && brain.brand.trim()) merged.brand = brain.brand.trim().slice(0, 60);
  if (typeof brain.industry === "string" && brain.industry.trim().length >= 2) merged.industry = brain.industry.trim().slice(0, 60);
  if (typeof brain.audience === "string" && brain.audience.trim()) merged.audience = brain.audience.trim().slice(0, 160);
  if (typeof brain.positioning === "string" && brain.positioning.trim()) merged.positioning = brain.positioning.trim().slice(0, 200);
  if (Array.isArray(brain.emotions)) {
    const emotions = brain.emotions.filter((item): item is string => typeof item === "string" && item.trim().length > 1).slice(0, 5);
    if (emotions.length) merged.emotions = emotions;
  }
  if (brain.premiumLevel === "accessible" || brain.premiumLevel === "premium" || brain.premiumLevel === "ultra-premium") merged.premiumLevel = brain.premiumLevel;
  if (typeof brain.conversionGoal === "string" && brain.conversionGoal.trim()) merged.conversionGoal = brain.conversionGoal.trim().slice(0, 160);
  if (Array.isArray(brain.pages)) {
    const pages = brain.pages.filter((item): item is string => typeof item === "string" && item.trim().length > 1).slice(0, 10);
    if (pages.length >= 3) merged.pages = pages;
  }
  if (brain.traits && typeof brain.traits === "object" && !Array.isArray(brain.traits)) {
    const traits = brain.traits as Record<string, unknown>;
    for (const key of Object.keys(base.traits) as Array<keyof WebDesignBrief["traits"]>) {
      merged.traits[key] = asNumber01(traits[key], base.traits[key]);
    }
  }
  return merged;
}

/**
 * Résout le brief : 1) heuristique déterministe (garde-fou), 2) enrichissement
 * par le SOPHENIC Brain existant (desktop IPC → route web), champ par champ.
 */
export async function resolveWebDesignBrief(input: { instruction: string; effortMode?: DesignIntentEffortMode; attachments?: WebDesignAttachment[] }): Promise<WebDesignBrief> {
  const base = heuristicWebDesignBrief(input.instruction);
  try {
    const response = await chatWithExistingBrain(buildBriefMessages(input.instruction, input.attachments), input.effortMode || "auto");
    if (!response.content) return base;
    const parsed = parseBrainJson(response.content);
    if (!parsed || typeof parsed !== "object") return base;
    return mergeBrainBrief(base, parsed as Record<string, unknown>);
  } catch {
    return base;
  }
}
