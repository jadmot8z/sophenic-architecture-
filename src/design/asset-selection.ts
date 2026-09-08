import type { DesignAssetSearchResult, DesignIntentSummary } from "./types";
import { assetRequirementsForIntent, vocabularyKeyForName, type DesignAssetRequirement } from "./asset-requirements";

export type AssetSelectionScore = { item: DesignAssetSearchResult; score: number; reasons: string[] };

const POSITIVE = ["photorealistic", "realistic", "pbr", "high quality", "interior", "furniture", "design", "modern", "contemporary", "luxury", "premium", "scanned"];
const NEGATIVE = ["low poly", "lowpoly", "voxel", "cartoon", "stylized", "anime", "minecraft", "blockout", "prototype", "placeholder"];

function normalized(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function scoreDesignAsset(item: DesignAssetSearchResult, query: string): AssetSelectionScore {
  const terms = normalized(query).split(/[^a-z0-9]+/i).filter((term) => term.length > 2);
  const haystack = normalized(`${item.name} ${item.tags.join(" ")}`);
  const reasons: string[] = [];
  let score = 0;

  const matched = terms.filter((term) => haystack.includes(term));
  score += matched.length * 4.5;
  if (matched.length) reasons.push(`${matched.length} terme(s) du brief correspondent`);

  for (const token of POSITIVE) {
    if (haystack.includes(normalized(token))) { score += token === "photorealistic" || token === "realistic" ? 7 : 2.5; reasons.push(`signal qualité : ${token}`); }
  }
  for (const token of NEGATIVE) {
    if (haystack.includes(normalized(token))) { score -= token === "low poly" || token === "lowpoly" ? 14 : 9; reasons.push(`pénalité : ${token}`); }
  }

  if (item.staffPicked) { score += 12; reasons.push("Staff Pick Sketchfab"); }
  if (item.thumbnailUrl) score += 1.5;
  if (item.author) score += 1;
  if (item.license?.trim()) score += 2;
  if ((item.likeCount || 0) > 0) score += Math.min(9, Math.log10((item.likeCount || 0) + 1) * 3.5);
  if ((item.viewCount || 0) > 0) score += Math.min(6, Math.log10((item.viewCount || 0) + 1) * 1.4);

  const faces = item.faceCount || 0;
  const vertices = item.vertexCount || 0;
  const complexity = Math.max(faces, vertices / 2);
  if (complexity > 5_000 && complexity < 800_000) { score += 4; reasons.push("complexité 3D crédible"); }
  else if (complexity > 1_600_000) { score -= 4; reasons.push("asset très lourd"); }
  else if (complexity > 0 && complexity < 700) { score -= 8; reasons.push("géométrie très faible"); }

  if (/chair|sofa|bed|table|lamp|plant|wardrobe|cabinet|vanity|toilet|shower|rug/.test(normalized(query))) {
    const core = normalized(query).split(/\s+/).find((term) => /chair|sofa|bed|table|lamp|plant|wardrobe|cabinet|vanity|toilet|shower|rug/.test(term));
    if (core && !haystack.includes(core)) score -= 10;
  }

  return { item, score, reasons: reasons.slice(0, 8) };
}

/**
 * V7 ranking between an Asset Provider and the architecture editor.
 * Results without an explicit license or download permission are rejected.
 * Realistic/PBR/high-quality furniture is preferred while obvious low-poly,
 * cartoon or placeholder assets are strongly penalized.
 */
export function rankDesignAssets(results: DesignAssetSearchResult[], query: string): AssetSelectionScore[] {
  return results
    .filter((item) => item.downloadable && Boolean(item.license?.trim()))
    .map((item) => scoreDesignAsset(item, query))
    .sort((a, b) => b.score - a.score);
}

export function selectBestDesignAsset(results: DesignAssetSearchResult[], query: string): DesignAssetSearchResult | null {
  const ranked = rankDesignAssets(results, query);
  if (!ranked.length) return null;
  // A negative score means the result is a poor semantic/visual match. Prefer
  // SOPHENIC's premium procedural fallback over importing a visibly bad asset.
  return ranked[0].score >= 0 ? ranked[0].item : null;
}

/* ===================== SOPHENIC DESIGN V8.1 — Intent-aware ranking ===================== */

/**
 * Style tokens dérivés de l'intent (palais → classique/royal ; villa moderne →
 * modern/minimalist). Les résultats Sketchfab sont notés sur leur
 * correspondance de style, en plus des critères V7 (PBR, licence,
 * downloadable, polycount).
 */
function intentStyleTokens(intent: Pick<DesignIntentSummary, "archetype" | "style" | "furnitureStyle" | "structuralLanguage" | "assetVocabulary">): { positive: string[]; negative: string[] } {
  const haystack = normalized(`${intent.style} ${intent.furnitureStyle || ""} ${intent.structuralLanguage || ""} ${intent.archetype || ""}`);
  const classic = /palai|palace|royal|classique|classic|majest|monumental|colonnad|baroque|louis/.test(haystack);
  const modern = /moderne|modern|contemporain|contemporary|minimalist|minimal|japandi|industriel|industrial/.test(haystack);
  const positive = classic && !modern
    ? ["classic", "royal", "classical", "baroque", "ornate", "velvet", "marble", "gilded", "carved", "antique", "chandelier", "crystal", "louis", "empire"]
    : modern && !classic
      ? ["modern", "minimalist", "contemporary", "designer", "minimal", "scandinavian", "nordic", "sleek", "linear"]
      : [];
  const negative = classic && !modern
    ? ["modern", "minimalist", "scandinavian", "futuristic", "sci-?fi", "low ?poly"]
    : modern && !classic
      ? ["classic", "royal", "baroque", "rococo", "antique", "medieval", "rustic", "louis", "ornate", "gilded", "carved", "velvet"]
      : [];
  return { positive, negative: [...negative, "low poly", "lowpoly", "voxel", "cartoon", "stylized", "anime", "minecraft", "blockout", "prototype", "placeholder"] };
}

export function scoreDesignAssetForIntent(item: DesignAssetSearchResult, query: string, intent: Pick<DesignIntentSummary, "archetype" | "style" | "furnitureStyle" | "structuralLanguage" | "assetVocabulary"> | null): AssetSelectionScore {
  const base = scoreDesignAsset(item, query);
  if (!intent) return base;
  const { positive, negative } = intentStyleTokens(intent);
  const haystack = normalized(`${item.name} ${item.tags.join(" ")} ${query}`);
  let score = base.score;
  const reasons = [...base.reasons];
  let matched = 0;
  for (const token of positive) {
    const clean = token.replace(/[- ?]/g, "");
    if (clean && (haystack.includes(clean) || haystack.includes(token))) { score += 9; matched += 1; }
  }
  if (matched) reasons.push(`style intent : ${matched} corrélation(s) (${intent.archetype || "style"})`);
  for (const token of negative) {
    const clean = token.replace(/[- ?]/g, "");
    if (clean && (haystack.includes(clean) || haystack.includes(token))) { score -= 16; reasons.push(`hors style intent : ${token}`); }
  }
  // Bonus si le résultat correspond au vocabulaire exact de l'intent.
  const key = vocabularyKeyForName(query);
  if (key) {
    const vocabulary = (intent.assetVocabulary && Object.keys(intent.assetVocabulary).length ? intent.assetVocabulary : null);
    if (vocabulary?.[key]?.some((candidate) => normalized(candidate).split(/\s+/).filter((word) => word.length > 3).some((word) => haystack.includes(word)))) { score += 5; reasons.push("vocabulaire d'asset de l'intent reconnu"); }
  }
  return { item, score, reasons: reasons.slice(0, 8) };
}

/** Ranking V8.1 : filtre licence + downloadable, puis style matching IA. */
export function rankDesignAssetsForIntent(results: DesignAssetSearchResult[], query: string, intent: Pick<DesignIntentSummary, "archetype" | "style" | "furnitureStyle" | "structuralLanguage" | "assetVocabulary"> | null): AssetSelectionScore[] {
  return results
    .filter((item) => item.downloadable && Boolean(item.license?.trim()))
    .map((item) => scoreDesignAssetForIntent(item, query, intent))
    .sort((a, b) => b.score - a.score);
}

/**
 * Sélectionne le meilleur asset réel pour l'intent, ou null si aucun résultat
 * n'est compatible — SOPHENIC n'invente jamais d'asset : le message
 * `noAssetMessage` doit alors être affiché.
 */
export function selectBestDesignAssetForIntent(results: DesignAssetSearchResult[], query: string, intent: Pick<DesignIntentSummary, "archetype" | "style" | "furnitureStyle" | "structuralLanguage" | "assetVocabulary"> | null): DesignAssetSearchResult | null {
  const ranked = rankDesignAssetsForIntent(results, query, intent);
  return ranked.length && ranked[0].score >= 12 ? ranked[0].item : null;
}

/** Exigence d'asset correspondant à une requête/objet (pour messages UI). */
export function requirementForQuery(query: string, intent: Pick<DesignIntentSummary, "archetype" | "assetVocabulary" | "style">): DesignAssetRequirement | null {
  const key = vocabularyKeyForName(query);
  const requirements = assetRequirementsForIntent(intent);
  return requirements.find((requirement) => requirement.key === key) || requirements[0] || null;
}
