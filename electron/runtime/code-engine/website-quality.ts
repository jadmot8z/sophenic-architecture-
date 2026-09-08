import fs from "node:fs";
import path from "node:path";

export type WebsiteQualityAudit = {
  passed: boolean;
  score: number;
  threshold: number;
  filesScanned: number;
  sourceCharacters: number;
  signals: Record<string, number | boolean | string>;
  issues: string[];
  strengths: string[];
};

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "dist-electron", "coverage", ".cache", ".turbo", ".sophenic", "build"]);
const WEB_EXTENSIONS = new Set([".html", ".htm", ".css", ".scss", ".sass", ".less", ".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".astro"]);

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > 8 || files.length >= 320) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= 320) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name.toLowerCase())) visit(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (WEB_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
    }
  };
  visit(root, 0);
  return files;
}

function count(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function isWebsiteTaskPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  const webNoun = /\b(site(?: web)?|website|landing(?: page)?|page web|frontend|front-end|webapp|web app|portfolio|boutique en ligne|e-?commerce|dashboard|homepage|home page)\b/i.test(normalized);
  const createVerb = /\b(cr[eé]e|cr[eé]er|construis|construire|fais|faire|g[eé]n[eè]re|g[eé]n[eé]rer|design|d[eé]veloppe|d[eé]velopper|refais|recr[eé]e|am[eé]liore|modernise|transforme|mets|d[eé]ploie|deploie)\b/i.test(normalized);
  const framework = /\b(react|next(?:\.js)?|vite|vue|angular|astro|svelte|html|css|tailwind)\b/i.test(normalized);
  return (webNoun && createVerb) || (framework && createVerb) || /\b(site de voyage|travel website|site vitrine|site professionnel|site premium)\b/i.test(normalized);
}

export function auditWebsiteProject(workspace: string, options: { strict?: boolean } = {}): WebsiteQualityAudit {
  const files = sourceFiles(workspace);
  const chunks: string[] = [];
  let chars = 0;
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const clipped = raw.slice(0, 100_000);
      chunks.push(`\n/* FILE:${path.relative(workspace, file).replace(/\\/g, "/")} */\n${clipped}`);
      chars += clipped.length;
      if (chars >= 900_000) break;
    } catch { /* ignore unreadable source */ }
  }
  const text = chunks.join("\n");
  const lower = text.toLowerCase();

  const htmlLike = count(text, /<(?:section|article|aside|main|header|footer|nav)\b/gi);
  const sectionLabels = count(text, /\b(?:hero|features?|destinations?|tours?|testimonials?|reviews?|pricing|faq|gallery|newsletter|cta|contact|about|services?|experiences?|benefits?|why[-_ ]?choose|footer)\b/gi);
  const sections = Math.max(htmlLike, Math.min(12, Math.floor(sectionLabels / 2)));
  const classNames = count(text, /\bclass(?:Name)?\s*=|\bclassName\s*:/g);
  const cssRules = count(text, /(?:^|\})\s*[^@{}][^{]{0,120}\{/gm);
  const utilityClasses = count(text, /\b(?:sm:|md:|lg:|xl:|grid|flex|gap-|px-|py-|p-|m-|rounded|shadow|bg-|text-|border-|max-w-|min-h-|items-|justify-)/g);
  const mediaRules = count(text, /@media\b|\b(?:sm:|md:|lg:|xl:|2xl:)|clamp\(|minmax\(|grid-template-columns/gi);
  const images = count(text, /<(?:img|Image)\b|\bbackground(?:-image)?\s*:|url\(|image\.generate|\/images?\//gi);
  const interactions = count(text, /<(?:button|form|input|select|textarea)\b|onClick=|onSubmit=|hover:|focus:|transition|animate-/gi);
  const accessibility = count(text, /\b(?:alt=|aria-[a-z-]+=|role=|<label\b|focus-visible|sr-only|skip-link)/gi);
  const seo = count(text, /<title\b|meta\s+name=["']description|export\s+const\s+metadata|generateMetadata|og:|openGraph/gi);
  const components = files.filter((file) => /(?:components?|sections?)[\\/]/i.test(file) || /\.(tsx|jsx|vue|svelte|astro)$/i.test(file)).length;
  const headings = count(text, /<h[1-3]\b/gi);
  const links = count(text, /<a\b|<Link\b/gi);
  const paragraphs = count(text, /<p\b/gi);
  const gradientsOrSurfaces = count(text, /gradient|backdrop|shadow|border-radius|rounded|box-shadow|background-color|bg-/gi);
  const responsive = mediaRules > 0;
  const styled = cssRules >= 8 || utilityClasses >= 18 || classNames >= 22;
  const structured = sections >= 4 || (headings >= 5 && paragraphs >= 5);
  const visual = images >= 2 || gradientsOrSurfaces >= 10;
  const interactive = interactions >= 3 || links >= 5;
  const componentized = components >= 4 || files.length >= 7;
  const hasNav = /<nav\b|\bnavbar\b|\bnavigation\b/i.test(text);
  const hasFooter = /<footer\b|\bfooter\b/i.test(text);
  const hasHero = /\bhero\b|<h1\b/i.test(text);
  const hasViewport = /name=["']viewport|export\s+const\s+viewport/i.test(text);
  const hasDefaultBrowserLook = files.length <= 2 && !styled && !responsive && images === 0 && interactions < 2;
  const placeholderHeavy = count(lower, /\b(lorem ipsum|todo|coming soon|placeholder|sample text|votre texte ici|à venir)\b/g);

  let score = 0;
  const strengths: string[] = [];
  const issues: string[] = [];

  if (hasNav) { score += 7; strengths.push("Navigation structurée détectée."); } else issues.push("Ajouter une navigation/header cohérent avec le site.");
  if (hasHero) { score += 7; strengths.push("Hero/titre principal détecté."); } else issues.push("Créer un hero fort avec proposition de valeur et CTA.");
  if (hasFooter) { score += 5; strengths.push("Footer détecté."); } else issues.push("Ajouter un footer complet.");

  const sectionScore = Math.min(16, sections * 2.5);
  score += sectionScore;
  if (sections >= 6) strengths.push(`${sections} blocs/sections de contenu détectés.`);
  else issues.push(`Le site est trop pauvre en contenu (${sections} section(s) significative(s) détectée(s)); viser au moins 6 blocs utiles pour une page marketing complète.`);

  if (styled) { score += 16; strengths.push("Système de styles substantiel détecté."); } else issues.push("Le rendu ressemble encore à du HTML brut : ajouter un vrai système visuel (typographie, couleurs, espacements, cartes, surfaces, états hover/focus).");
  if (responsive) { score += 13; strengths.push("Responsive CSS/Tailwind détecté."); } else issues.push("Aucune stratégie responsive crédible détectée; prévoir mobile/tablette/desktop.");
  if (visual) { score += 10; strengths.push("Traitement visuel/images/surfaces détecté."); } else issues.push("Ajouter une vraie direction visuelle : images pertinentes, illustrations ou composition graphique, pas une page uniquement textuelle.");
  if (interactive) { score += 7; strengths.push("Interactions/CTA détectés."); } else issues.push("Ajouter des CTA et interactions utiles avec états hover/focus.");
  if (accessibility >= 3) { score += 6; strengths.push("Signaux d’accessibilité détectés."); } else issues.push("Renforcer l’accessibilité de base (alt, labels, focus, aria si nécessaire).");
  if (seo >= 1) { score += 4; strengths.push("Métadonnées SEO détectées."); } else issues.push("Ajouter au minimum title + description/metadata SEO.");
  if (componentized) { score += 6; strengths.push("Architecture multi-fichiers/composants détectée."); } else issues.push("Pour un site substantiel, structurer le code en composants/fichiers plutôt qu’un seul fichier monolithique.");
  if (hasViewport || /next\/|vite|react|astro|vue|svelte/i.test(text)) score += 3;
  if (chars >= 8_000) score += 3;

  if (placeholderHeavy >= 2) {
    score -= Math.min(12, placeholderHeavy * 3);
    issues.push("Remplacer les placeholders/TODO par du contenu réaliste et finalisé.");
  }
  if (hasDefaultBrowserLook) {
    score = Math.min(score, 28);
    issues.unshift("ÉCHEC CRITIQUE : page quasi brute détectée (style navigateur par défaut / contenu minimal). Ce résultat ne doit pas être déployé.");
  }
  if (chars < 1_500) {
    score = Math.min(score, 22);
    issues.unshift("ÉCHEC CRITIQUE : quantité de code/contenu insuffisante pour un vrai site.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const threshold = options.strict === false ? 70 : 80;
  const hardFailure = hasDefaultBrowserLook || chars < 1_500 || (!styled && sections < 4);
  const passed = !hardFailure && score >= threshold;

  return {
    passed,
    score,
    threshold,
    filesScanned: files.length,
    sourceCharacters: chars,
    signals: {
      sections,
      classNames,
      cssRules,
      utilityClasses,
      mediaRules,
      images,
      interactions,
      accessibility,
      seo,
      components,
      headings,
      paragraphs,
      responsive,
      styled,
      visual,
      componentized,
      hasDefaultBrowserLook
    },
    issues: issues.slice(0, 12),
    strengths: strengths.slice(0, 10)
  };
}
