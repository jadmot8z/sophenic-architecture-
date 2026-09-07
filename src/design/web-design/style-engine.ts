import type { WebDesignBrief, WebDesignVisualStyle } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — STYLE ENGINE.
 *
 * Génère l'identité visuelle (palette, typographie, animations, imagerie)
 * à partir du brief : industrie × positionnement × traits. Deux briefs
 * différents produisent des langages visuels différents — le moteur ne
 * réutilise JAMAIS le même design.
 */

export function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type StyleProfile = {
  keys: RegExp;
  /** Correspondances faibles (mots génériques type « luxe ») : utilisées seulement si aucune clé forte ne matche. */
  weakKeys?: RegExp;
  palettes: string[][]; // variantes [fond, texte, accent, support, surface]
  typography: Array<{ display: string; body: string }>;
  spacing: string;
  animations: string[][];
  imagery: string;
  moodboardKeywords: string[];
};

const PROFILES: StyleProfile[] = [
  {
    keys: /bijou|joailler|jewel|bague|collier|montre|watch|haute couture/,
    weakKeys: /luxury|luxe|palace|royal|haute gamme/,
    palettes: [
      ["#FAF7F1", "#1C1A16", "#B08D3E", "#6E5E3F", "#EDE6D8"],
      ["#0E0D0B", "#F2EBDD", "#C9A961", "#8A7B5C", "#1E1B16"]
    ],
    typography: [{ display: "Cormorant Garamond", body: "Jost" }, { display: "Playfair Display", body: "Source Sans 3" }],
    spacing: "Système 8pt, marges généreuses (120px+ desktop), lettrage +0.04em sur les titres",
    animations: [
      ["reveal au scroll lent (1.2s ease-out)", "fondu cinématographique du hero (2s)", "parallaxe douce sur l'imagerie", "survol or discret (400ms)"],
      ["fondu enchaîné des collections (1.6s)", "zoom très lent du hero (10s)", "curseur joaillerie (halo lumineux)"]
    ],
    imagery: "Photographie macro des matières (or, pierres, soie), lumière sculptée, fonds profonds",
    moodboardKeywords: ["or", "obsidienne", "velours", "héritage"]
  },
  {
    keys: /hotel|h[oô]tel|villa|marrakech|riad|resort|hospitality|s[ée]jour|voyage|tourisme|spa/,
    palettes: [
      ["#F4EDE1", "#2E2A22", "#A9844D", "#5C6B53", "#E5D9C5"],
      ["#221C15", "#F2E8D8", "#C89B5A", "#7A6A4F", "#2E2720"]
    ],
    typography: [{ display: "Cormorant Garamond", body: "Karla" }, { display: "Fraunces", body: "Nunito Sans" }],
    spacing: "Système 8pt sensoriel, marges larges, images plein bord à bord",
    animations: [
      ["parallaxe cinématographique", "fondu lent entre sections (1.4s)", "reveal ascendante douce", "survol image → zoom 1.04"],
      ["défilement horizontal des suites", "vidéo hero muted autoplay", "apparition lettre par lettre du titre"]
    ],
    imagery: "Photographie de voyage cinématographique, heure dorée, matières locales, vues larges",
    moodboardKeywords: ["sable chaud", "cuivre", "fin d'après-midi", "artisanat"]
  },
  {
    keys: /gaming|jeu vid[ée]o|esport|ia\b|ai\b|intelligence artificielle|crypto|web3|futuriste|futuristic|robot|cyber|tech|d[ée]veloppeur|saas|startup/,
    palettes: [
      ["#0A0E14", "#EAF2FF", "#00E5A0", "#7C5CFF", "#141A26"],
      ["#0B0B12", "#F0EFFF", "#6E7BFF", "#00D1FF", "#16162A"]
    ],
    typography: [{ display: "Space Grotesk", body: "IBM Plex Mono" }, { display: "Unbounded", body: "Inter" }],
    spacing: "Système 8pt dense, cartes glassmorphism, rayures néon",
    animations: [
      ["particules WebGL en fond", "boutons magnétiques", "tilt 3D au scroll", "typing/glitch du hero", "gradient animé sur les accents"],
      ["shaders fluides de fond", "compteurs techniques animés", "hover → hologramme", "scroll-jacking maîtrisé sur le storytelling"]
    ],
    imagery: "Rendus 3D temps réel, dark UI, néons, captures de données",
    moodboardKeywords: ["néon", "verre", "constellation", "terminal"]
  },
  {
    keys: /restaurant|caf[ée]|bistro|food|p[âa]tiss|gastronom|cuisine|bar|brasserie/,
    palettes: [
      ["#1C1712", "#F5EBDD", "#C05621", "#8C6D4F", "#2A231B"],
      ["#FAF3E8", "#231A12", "#B4451F", "#5F6F4E", "#EFE2CF"]
    ],
    typography: [{ display: "Fraunces", body: "Nunito Sans" }, { display: "DM Serif Display", body: "Work Sans" }],
    spacing: "Système 8pt organique, arrondis 16px, listes aérées",
    animations: [["reveal fondu chaleureux", "zoom lent imagerie (8s)", "hover carte menu (lift 4px)"], ["menu déroulant animé", "horaires/état ouvert pulsé", "carrousel plats auto 5s"]],
    imagery: "Photographie culinaire lumière naturelle, vapeurs, textures brutes, mains d'artisan",
    moodboardKeywords: ["terracotta", "bois flotté", "cumin", "table dressée"]
  },
  {
    keys: /mode|fashion|pr[êe]t-[àa]-porter|streetwear|sneaker|beaut[ée]|cosm[ée]tique|parfum/,
    palettes: [
      ["#FFFFFF", "#17161A", "#E0475B", "#5B5470", "#F5F2F7"],
      ["#101010", "#F2F2F0", "#E2845E", "#8C8C86", "#1D1D1B"]
    ],
    typography: [{ display: "Montserrat", body: "Open Sans" }, { display: "Archivo Expanded", body: "Karla" }],
    spacing: "Système 8pt éditorial, grilles produits serrées, lookbook respirant",
    animations: [["add-to-cart animé", "carrousel lookbook auto", "hover produit → second visuel", "badge pulse"]], 
    imagery: "Lookbook studio, plein pied, éclairage graphique",
    moodboardKeywords: ["studio", "plein pied", "pop", "tissu en mouvement"]
  },
  {
    keys: /finance|assurance|banque|conseil|audit|avocat|droit|b2b|entreprise|corporate|immobilier/,
    palettes: [
      ["#FFFFFF", "#0F172A", "#1D4ED8", "#475569", "#F1F5F9"],
      ["#0C1524", "#EAF0FA", "#3E7BFA", "#8CA3C7", "#16233A"]
    ],
    typography: [{ display: "Libre Franklin", body: "Inter" }, { display: "Source Serif 4", body: "Inter" }],
    spacing: "Système 8pt structuré, sections délimitées, tableaux soignés",
    animations: [["compteurs de résultats animés", "apparition sobre au scroll (250ms)", "survol carte → bordure accent"]],
    imagery: "Portraits professionnels, architectures urbaines, data-viz sobres",
    moodboardKeywords: ["bleu nuit", "verre trempé", "verticalit[ée]", "confiance"]
  },
  {
    keys: /sant[ée]|bien-[êe]tre|bienetre|yoga|th[ée]rapie|m[ée]decin|clinique|soins/,
    palettes: [["#F8FAF9", "#15332B", "#2F8F6B", "#6B8F80", "#E7F0EC"]],
    typography: [{ display: "Lora", body: "Karla" }],
    spacing: "Système 8pt aéré, arrondis 24px, blancs généreux",
    animations: [["respiration (scale lente 6s)", "reveal doux", "transition couleur nature"]],
    imagery: "Lumière du matin, matières naturelles, gros plans plantes, tons désaturés",
    moodboardKeywords: ["sauge", "lin", "matin", "souffle"]
  },
  {
    keys: /portfolio|studio cr[ée]atif|designer|photographe|artiste|musique|festival|[ée]v[ée]nement|agence/,
    palettes: [
      ["#101010", "#F5F5F0", "#FF5C28", "#9A9A90", "#1C1C1C"],
      ["#F4F1EA", "#141414", "#2E4BFF", "#B0413E", "#E5E0D3"]
    ],
    typography: [{ display: "Syne", body: "Space Grotesk" }, { display: "Clash Display", body: "General Sans" }],
    spacing: "Système libre, asymétries assumées, typographie XXL (10-12vw)",
    animations: [["curseur personnalisé", "transitions de page", "texte marquee", "survol déformation"]], 
    imagery: "Œuvres plein cadre, collages, textures risographie",
    moodboardKeywords: ["orange signal", "grain", "brut", "risographie"]
  },
  {
    keys: /[ée]ducation|formation|cours|[ée]cole|universit[ée]|coach|e-learning|asso|ong|culture|média|magazine|blog/,
    palettes: [["#FBF9F4", "#191817", "#C0392B", "#5D6D5E", "#EFEAE0"]],
    typography: [{ display: "Playfair Display", body: "Source Sans 3" }],
    spacing: "Système 8pt éditorial, colonnes de lecture 68ch",
    animations: [["reveal au scroll", "surlignage progressif des titres", "images lazy avec blur-up"]],
    imagery: "Illustrations éditoriales, archives, documents scannés",
    moodboardKeywords: ["papier", "encre", "archive", "marge"]
  },
  {
    keys: /ecommerce|e-commerce|boutique|shop|store|retail|marketplace/,
    palettes: [["#FFFFFF", "#17161A", "#E0475B", "#5B5470", "#F5F2F7"]],
    typography: [{ display: "Montserrat", body: "Open Sans" }],
    spacing: "Système 8pt compact, densité commerciale",
    animations: [["add-to-cart animé", "badge promo pulse", "carrousel auto 4s", "sticky CTA mobile"]],
    imagery: "Photos produits sur fond propre, lifestyle en tête de catégorie",
    moodboardKeywords: ["conversion", "packaging", "r[ée]assurance"]
  }
];

const FALLBACK_PROFILE: StyleProfile = {
  keys: /.*/,
  palettes: [["#FFFFFF", "#101828", "#4F46E5", "#667085", "#F3F4F6"], ["#0F1115", "#F2F4F8", "#5B8CFF", "#8B93A7", "#191D26"]],
  typography: [{ display: "Inter", body: "Inter" }, { display: "Sora", body: "Inter" }],
  spacing: "Système 8pt, respiration maîtrisée",
  animations: [["apparition au scroll (300ms)", "survol translate 4px", "transition couleur 200ms"]],
  imagery: "Visuels nets, hiérarchie claire, images aérées",
  moodboardKeywords: ["clart[ée]", "grille", "contrast"]
};

function profileFor(brief: WebDesignBrief): StyleProfile {
  const haystack = `${brief.industry} ${brief.instruction} ${brief.positioning}`.toLowerCase();
  // Pass 1 — clés fortes (noms d'industrie précis) : « villa de luxe » doit
  // rester une villa, pas devenir de la joaillerie à cause du mot « luxe ».
  for (const profile of PROFILES) if (profile.keys.test(haystack)) return profile;
  // Pass 2 — clés faibles (positionnement générique : luxe, palace…).
  for (const profile of PROFILES) if (profile.weakKeys?.test(haystack)) return profile;
  return FALLBACK_PROFILE;
}

/**
 * Compose l'identité visuelle : le profil (industrie/positionnement) fixe la
 * famille, la graine choisit la variante (clair/sombre, pairing typographique,
 * sélection d'animations) — deux marques = deux identités.
 */
export function visualStyleFor(brief: WebDesignBrief, seedInput?: number, avoid?: { colors?: string[]; typography?: { display: string; body: string } }): WebDesignVisualStyle {
  const seed = seedInput ?? hashText(`${brief.instruction}|${brief.brand}`);
  // Sélection déterministe par dimension : chaque graine choisit ses variantes
  // (palette, typographie, animations) via des hashs indépendants.
  const pick = (dimension: string, count: number) => hashText(`${seed}|${dimension}`) % Math.max(1, count);
  const profile = profileFor(brief);
  // L'utilisateur peut forcer sombre/clair via les traits du brief.
  const wantsDark = brief.traits.dark >= .6;
  const palettes = profile.palettes;
  let palette = palettes[pick("palette", palettes.length)] || palettes[0];
  if (wantsDark) {
    const dark = palettes.find((candidate) => isDarkHex(candidate[0]));
    if (dark) palette = dark;
  } else if (brief.traits.dark <= .25 && brief.traits.minimal >= .6) {
    const light = palettes.find((candidate) => !isDarkHex(candidate[0]));
    if (light) palette = light;
  }
  // Le résultat NE DOIT PAS ressembler au template d'origine : si la palette
  // de marque est trop proche d'une identité à éviter (celle du template),
  // on choisit une autre variante, sinon on dérive une palette sœur.
  const avoidColors = avoid?.colors;
  if (avoidColors?.length && paletteOverlap(palette, avoidColors) >= 3) {
    const others = palettes.filter((candidate) => paletteOverlap(candidate, avoidColors) < 3);
    palette = others.length ? others[pick("palette-alt", others.length)] : deriveSiblingPalette(palette, avoidColors);
  }
  let pairing = profile.typography[pick("typography", profile.typography.length)] || profile.typography[0];
  if (avoid?.typography && pairing.display === avoid.typography.display && pairing.body === avoid.typography.body) {
    const other = profile.typography.find((candidate) => candidate.display !== avoid.typography!.display || candidate.body !== avoid.typography!.body);
    pairing = other || { display: TYPOGRAPHY_FALLBACKS[pick("typography-alt", TYPOGRAPHY_FALLBACKS.length)], body: "Inter" };
  }
  const animationSet = profile.animations[pick("animations", profile.animations.length)] || profile.animations[0];
  // 3 à 6 animations cohérentes avec le niveau premium.
  const takeCount = brief.premiumLevel === "ultra-premium" ? 3 : 3 + (hashText(`${seed}|take`) % 3);
  const take = animationSet.slice(0, Math.min(5, takeCount));
  return {
    colors: [...palette],
    typography: `${pairing.display} (titres) + ${pairing.body} (texte)`,
    typographyStack: { ...pairing },
    spacing: profile.spacing,
    animations: [...new Set(take)],
    imagery: profile.imagery,
    moodboardKeywords: [...profile.moodboardKeywords, ...brief.emotions.slice(0, 2)]
  };
}

export function isDarkHex(hex: string): boolean {
  return relativeLuminance(hex) < .22;
}

/** Luminance relative WCAG d'une couleur hex. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const channels = [0, 2, 4].map((index) => {
    const raw = parseInt(full.slice(index, index + 2), 16) / 255;
    return raw <= .03928 ? raw / 12.92 : Math.pow((raw + .055) / 1.055, 2.4);
  });
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

/** Ratio de contraste WCAG entre deux couleurs (1-21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + .05) / (darker + .05);
}

/** Éclaircit/assombrit une couleur hex pour atteindre un ratio de contraste. */
export function shiftColorForContrast(color: string, background: string, target = 4.5): string {
  const bgLuminance = relativeLuminance(background);
  const direction = bgLuminance > .35 ? -1 : 1; // fond clair → texte plus sombre
  for (let step = 1; step <= 26; step += 1) {
    const candidate = shiftLightness(color, direction * step * 4);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return direction < 0 ? "#111111" : "#FAFAFA";
}

function shiftLightness(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const channels = [0, 2, 4].map((index) => Math.max(0, Math.min(255, parseInt(full.slice(index, index + 2), 16) + amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Titre de direction artistique en une phrase. */
export function designDirectionFor(brief: WebDesignBrief, style: WebDesignVisualStyle): string {
  const mood = brief.emotions.slice(0, 2).join(" et ") || "singulier et mémorable";
  const tone = brief.premiumLevel === "ultra-premium" ? "ultra-premium" : brief.premiumLevel === "premium" ? "premium" : "accessible et net";
  const light = isDarkHex(style.colors[0]) ? "interface sombre" : "interface claire";
  return `${style.typographyStack.display} sur ${light}, accent ${style.colors[2]}, ${mood} — direction ${tone} pour ${brief.brand || brief.industry}.`;
}


const TYPOGRAPHY_FALLBACKS = ["Sora", "Manrope", "Archivo Expanded", "Space Grotesk", "Fraunces"];

/** Nombre de couleurs partagées entre deux palettes. */
export function paletteOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((color) => setB.has(color)).length;
}

/**
 * Dérive une palette sœur (même famille, autre personnalité) : fond et accent
 * recalibrés, pour garantir qu'un design re-personnalisé ne ressemble pas à
 * son template d'origine même quand le profil n'a qu'une seule variante.
 */
export function deriveSiblingPalette(palette: string[], base: string[]): string[] {
  const rng = mulberry32(hashText(palette.join("") + base.join("")));
  const direction = isDarkHex(palette[0]) ? 1 : -1;
  const shift = (hex: string, amount: number) => {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((index) => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount)));
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  };
  const bg = shift(palette[0], direction * (6 + Math.floor(rng() * 6)));
  const accent = shift(palette[2], -direction * (18 + Math.floor(rng() * 20)));
  const surface = shift(palette[4] || palette[0], direction * 5);
  return [bg, palette[1], accent, palette[3] || palette[1], surface];
}
