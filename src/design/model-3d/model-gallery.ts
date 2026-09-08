/**
 * SOPHENIC MODEL 3D ENGINE — galerie & classement (V8.5).
 *
 * Recherche multi-requêtes (jamais le nom exact seul) → dédoublonnage →
 * scoring intent-aware → TOP 5 proposé à l'utilisateur. Aucun asset n'est
 * jamais inventé : les requêtes qui échouent ou ne renvoient rien sont
 * enregistrées comme gaps avec un message honnête.
 */

import type { Model3DAsset, Model3DBrief, Model3DCandidate, Model3DGap } from "./types";

export type Model3DSearchFunction = (query: string, limit?: number) => Promise<Model3DAsset[]>;
export type Model3DGalleryResult = { candidates: Model3DCandidate[]; gaps: Model3DGap[]; searchedQueries: string[] };

const NEGATIVE_TOKENS = ["placeholder", "blockout", "prototype", "test model"];

function normalized(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function scoreModelAsset(asset: Model3DAsset, brief: Model3DBrief): { score: number; reasons: string[] } {
  const haystack = normalized(`${asset.name} ${asset.tags.join(" ")}`);
  const reasons: string[] = [];
  let score = 0;

  // Correspondance objet : le terme doit apparaître dans le nom ou les tags.
  const objectMatches = brief.objectTerms.filter((term) => haystack.includes(normalized(term)));
  if (objectMatches.length) {
    score += 9 + objectMatches.length * 3;
    reasons.push(`objet correspondant (${objectMatches.join(", ")})`);
  }

  // Style et matériaux : indices forts de correspondance d'intention.
  const styleMatches = brief.styleHints.filter((hint) => haystack.includes(normalized(hint)));
  const materialMatches = brief.materialHints.filter((hint) => haystack.includes(normalized(hint)));
  if (styleMatches.length) { score += styleMatches.length * 5; reasons.push(`style ${styleMatches.join(", ")}`); }
  if (materialMatches.length) { score += materialMatches.length * 5; reasons.push(`matériaux ${materialMatches.join(", ")}`); }

  for (const token of NEGATIVE_TOKENS) {
    if (haystack.includes(token)) { score -= 10; reasons.push(`pénalité : ${token}`); }
  }

  if (asset.staffPicked) { score += 12; reasons.push("Staff Pick Sketchfab"); }
  if ((asset.likeCount || 0) > 0) { score += Math.min(9, Math.log10((asset.likeCount || 0) + 1) * 3.6); reasons.push(`${asset.likeCount} j'aime`); }
  if ((asset.viewCount || 0) > 0) score += Math.min(6, Math.log10((asset.viewCount || 0) + 1) * 1.5);
  if (asset.thumbnailUrl) score += 1.5;
  if (asset.author) score += 1;

  // Complexité 3D crédible (ni vide, ni monstrueusement lourd).
  const faces = asset.faceCount || 0;
  const complexity = Math.max(faces, (asset.vertexCount || 0) / 2);
  if (complexity > 5_000 && complexity < 800_000) { score += 4; reasons.push("géométrie détaillée"); }
  else if (complexity > 1_600_000) { score -= 4; reasons.push("asset très lourd"); }
  else if (complexity > 0 && complexity < 700) { score -= 8; reasons.push("géométrie très simple"); }

  if (asset.license?.trim()) score += 2;
  return { score, reasons: reasons.slice(0, 6) };
}

function compatibilityFromScore(score: number, bestScore: number): number {
  if (bestScore <= 0) return Math.max(5, Math.min(60, score));
  const ratio = Math.max(0, score) / bestScore;
  return Math.max(5, Math.min(99, Math.round(30 + ratio * 69)));
}

/**
 * Dédoublonne (par sourceId, en gardant la meilleure requête), filtre les
 * résultats sans licence/téléchargeable, score, trie et renvoie le TOP 5.
 */
export function rankModelCandidates(assets: Array<{ asset: Model3DAsset; query: string }>, brief: Model3DBrief): Model3DCandidate[] {
  const bySource = new Map<string, { asset: Model3DAsset; query: string; score: number; reasons: string[] }>();
  for (const row of assets) {
    if (!row.asset.downloadable || !row.asset.license?.trim()) continue;
    const scored = scoreModelAsset(row.asset, brief);
    const previous = bySource.get(row.asset.sourceId);
    if (!previous || scored.score > previous.score) bySource.set(row.asset.sourceId, { ...row, score: scored.score, reasons: scored.reasons });
  }
  const ranked = [...bySource.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  const bestScore = ranked[0]?.score || 0;
  return ranked.map((row) => ({
    asset: row.asset,
    compatibility: compatibilityFromScore(row.score, bestScore),
    reasons: row.reasons.length ? row.reasons : ["modèle téléchargeable sous licence"],
    query: row.query
  }));
}

/**
 * Pipeline galerie complet : exécute TOUTES les requêtes expandées du brief,
 * fusionne les résultats, classe le TOP 5 et enregistre honnêtement les gaps.
 * `search` est injecté (testabilité) — en production c'est le moteur
 * Sketchfab via le bridge desktop (`desktop.design.searchAssets`).
 */
export async function searchModelGallery(brief: Model3DBrief, search: Model3DSearchFunction): Promise<Model3DGalleryResult> {
  const gaps: Model3DGap[] = [];
  const collected: Array<{ asset: Model3DAsset; query: string }> = [];
  const searchedQueries: string[] = [];
  for (const query of brief.queries.slice(0, 6)) {
    try {
      const results = await search(query, 12);
      searchedQueries.push(query);
      for (const asset of results) collected.push({ asset, query });
    } catch (cause) {
      searchedQueries.push(query);
      gaps.push({ query, reason: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  const candidates = rankModelCandidates(collected, brief);
  if (!candidates.length) {
    gaps.push({
      query: "toutes les requêtes",
      reason: gaps.length
        ? "Aucun modèle téléchargeable sous licence n'a été trouvé, et certaines requêtes ont échoué. SOPHENIC refuse d'inventer un asset : reformule la demande (objet, style, matériau) ou réessaie plus tard."
        : "Aucun modèle téléchargeable sous licence compatible n'a été trouvé pour cette demande. SOPHENIC refuse d'inventer un asset : reformule avec plus de style/matériau (ex. « canapé scandinave en chêne ») ou précise l'objet exact."
    });
  }
  return { candidates, gaps, searchedQueries };
}
