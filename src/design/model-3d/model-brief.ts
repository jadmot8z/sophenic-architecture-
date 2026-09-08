/**
 * SOPHENIC MODEL 3D ENGINE — brief de recherche (V8.5).
 *
 * RÈGLE ABSOLUE respectée : aucun nouveau cerveau IA. Le brief passe par le
 * SOPHENIC Brain existant (`chatWithExistingBrain` : IPC desktop → route web),
 * avec garde-fou heuristique déterministe si aucune IA n'est joignable.
 *
 * RÈGLE ANTI-RECHERCHE-EXACTE : l'intention utilisateur est TOUJOURS expandée
 * en plusieurs requêtes enrichies (style + matériau + qualité) — jamais le nom
 * exact de l'objet seul. Chaque requête porte au moins un modificateur.
 */

import { chatWithExistingBrain, parseBrainJson, type BrainChatMessage, type DesignIntentEffortMode } from "../design-intent-ai";
import type { Model3DAttachment, Model3DBrief } from "./types";

/** Lexique objet FR → terme de recherche EN (expansion, pas logique fixe de génération). */
const OBJECT_LEXICON: Array<[RegExp, string[]]> = [
  [/canap[ée]s?|sofas?|couch/i, ["sofa", "couch"]],
  [/fauteuils?|armchairs?|berg[èe]re/i, ["armchair"]],
  [/chaises?|si[èe]ges?|chairs?/i, ["chair", "seat"]],
  [/tables? basses?|coffee table/i, ["coffee table"]],
  [/tables? [àa] manger|dining table/i, ["dining table"]],
  [/tables?|desks?|bureaux?/i, ["table", "desk"]],
  [/lits?|beds?/i, ["bed"]],
  [/armoires?|wardrobes?|placards?/i, ["wardrobe", "cabinet"]],
  [/étagères?|étagere|shelves?|bibliothèques?/i, ["shelf", "bookshelf"]],
  [/lampes?|luminaire|lamps?|lights?/i, ["lamp", "light fixture"]],
  [/chandeliers?|lustres?|chandlers?/i, ["chandelier"]],
  [/tapis|rugs?|carpets?/i, ["rug"]],
  [/plantes?|plants?|ficus/i, ["plant"]],
  [/arbres?|trees?/i, ["tree"]],
  [/maisons?|houses?|cabanes?/i, ["house"]],
  [/statues?|sculptures?/i, ["statue", "sculpture"]],
  [/vases?/i, ["vase"]],
  [/montres?|watches?/i, ["watch"]],
  [/robots?/i, ["robot"]],
  [/armures?|armors?/i, ["armor"]],
  [/[ée]p[ée]es?|swords?|katanas?/i, ["sword"]],
  [/personnages?|characters?|humains?/i, ["character"]],
  [/voitures?|cars?|automobiles?/i, ["car"]],
  [/v[ée]los?|bicycles?|bikes?/i, ["bicycle"]],
  [/drones?/i, ["drone"]],
  [/avions?|planes?|aircraft/i, ["airplane"]],
  [/fus[ée]es?|rockets?/i, ["rocket"]],
  [/cuisines?|kitchens?/i, ["kitchen"]],
  [/frigos?|r[ée]frig[ée]rateurs?|fridges?/i, ["fridge"]],
  [/fours?|ovens?/i, ["oven"]],
  [/lavabos?|sinks?|bacs [àa] laver/i, ["sink"]],
  [/douche|showers?/i, ["shower"]],
  [/baignoires?|bathtubs?/i, ["bathtub"]],
  [/escaliers?|staircases?|stairs?/i, ["staircase"]],
  [/chemin[ée]es?|fireplaces?/i, ["fireplace"]],
  [/fontaines?|fountains?/i, ["fountain"]],
  [/colonnes?|columns?|pilastres?/i, ["column"]],
  [/miroirs?|mirrors?/i, ["mirror"]],
  [/tableaux?|paintings?|canvases?/i, ["painting"]],
  [/guitares?/i, ["guitar"]],
  [/pianos?/i, ["piano"]],
  [/haut-parleurs?|speakers?|enceintes?/i, ["speaker"]],
  [/casques?|headphones?/i, ["headphones"]],
  [/t[ée]l[ée]phones?|smartphones?/i, ["smartphone"]],
  [/ordinateurs?|computers?|pcs?/i, ["computer"]],
  [/claviers?|keyboards?/i, ["keyboard"]],
  [/armes? [àa] feu|guns?|pistolets?/i, ["gun"]],
  [/meubles?|furnitures?/i, ["furniture"]],
  [/v[eah]ssel?a|vaisseles?|vaisselle/i, ["tableware"]],
];

/** Lexique style FR → EN. */
const STYLE_LEXICON: Array<[RegExp, string[]]> = [
  [/scandinave|nordique|scandinavian|nordic/i, ["scandinavian"]],
  [/moderne|modern/i, ["modern"]],
  [/contemporain|contemporary/i, ["contemporary"]],
  [/industriel|industrial/i, ["industrial"]],
  [/vintage|r[ée]tro|retro/i, ["vintage"]],
  [/baroque|classique|classical|ornement|royal|palais/i, ["classical", "ornate"]],
  [/minimaliste|minimalist|[ée]pur[ée]/i, ["minimalist"]],
  [/futuriste|sci-?fi|futuristic|espace|space/i, ["futuristic", "sci-fi"]],
  [/low.?poly|lowpoly/i, ["low poly"]],
  [/r[ée]aliste|realistic|photor[ée]aliste|photoreal/i, ["photorealistic"]],
  [/cartoon|stylis[ée]|anime|dessin anim[ée]/i, ["stylized", "cartoon"]],
  [/m[ée]di[ée]val|medieval|ch[âa]teau|castle/i, ["medieval"]],
  [/antique|romain|grec|ancient|roman|greek/i, ["ancient"]],
  [/art d[ée]co|art deco/i, ["art deco"]],
  [/japonais|japandi|zen/i, ["japandi"]],
  [/rustique|rustic|ferme|farm/i, ["rustic"]],
  [/luxe|luxury|premium|haut de gamme/i, ["luxury", "premium"]],
];

/** Lexique matériau FR → EN. */
const MATERIAL_LEXICON: Array<[RegExp, string[]]> = [
  [/ch[êe]ne|oak/i, ["oak"]],
  [/noyer|walnut/i, ["walnut"]],
  [/pin|pine/i, ["pine"]],
  [/bois|wood/i, ["wood"]],
  [/marbre|marble/i, ["marble"]],
  [/granit|granite/i, ["granite"]],
  [/laiton|brass/i, ["brass"]],
  [/cuivre|copper/i, ["copper"]],
  [/\bor\b|gold/i, ["gold"]],
  [/argent|silver/i, ["silver"]],
  [/acier|steel/i, ["steel"]],
  [/m[ée]tal|metal/i, ["metal"]],
  [/fer|iron/i, ["iron"]],
  [/cuir|leather/i, ["leather"]],
  [/velours|velvet/i, ["velvet"]],
  [/lin|linen/i, ["linen"]],
  [/coton|cotton/i, ["cotton"]],
  [/rotin|rattan/i, ["rattan"]],
  [/osier|wicker/i, ["wicker"]],
  [/bambou|bamboo/i, ["bamboo"]],
  [/verre|glass/i, ["glass"]],
  [/c[ée]ramique|ceramic/i, ["ceramic"]],
  [/terre cuite|terracotta/i, ["terracotta"]],
  [/b[ée]ton|concrete/i, ["concrete"]],
  [/cristal|crystal/i, ["crystal"]],
  [/pierre|stone/i, ["stone"]],
];

/** Jetons de qualité ajoutés par défaut (sauf demande stylisée explicite). */
const QUALITY_TOKENS = ["pbr", "high detail"];

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractLexicon(text: string, lexicon: Array<[RegExp, string[]]>): string[] {
  const found: string[] = [];
  for (const [pattern, terms] of lexicon) {
    if (pattern.test(text) && !found.some((term) => terms.includes(term))) found.push(...terms.filter((term) => !found.includes(term)));
  }
  return found;
}

/** Mots-clés objets bruts (fallback si le lexique ne reconnaît rien). */
function rawObjectWords(text: string): string[] {
  const stop = new Set(["je", "veux", "veux-tu", "voudrais", "souhaite", "recherche", "cherche", "trouve", "moi", "un", "une", "des", "le", "la", "les", "de", "du", "d", "en", "avec", "pour", "sur", "dans", "style", "matiere", "materiau", "couleur", "modele", "model", "3d", "faire", "creer", "stp", "sil", "te", "plait", "comme", "que", "qui", "petit", "grand", "grande", "beau", "belle", "vrai", "realiste", "s il", "aussi"]);
  return normalize(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !stop.has(word)).slice(0, 6);
}

export function heuristicModel3DBrief(request: string): Model3DBrief {
  const text = normalize(request);
  const stylizedWanted = /low.?poly|lowpoly|cartoon|stylis|anime|minecraft|voxel/i.test(text);
  const objectTerms = extractLexicon(text, OBJECT_LEXICON);
  const rawTerms = objectTerms.length ? objectTerms : rawObjectWords(request).slice(0, 2);
  const styleHints = extractLexicon(text, STYLE_LEXICON);
  const materialHints = extractLexicon(text, MATERIAL_LEXICON);
  const premium = !stylizedWanted && (/luxe|luxury|premium|haut de gamme|qualit|realiste|realistic|detail|pbr|photoreal/i.test(text) || styleHints.length > 0 || materialHints.length > 0);

  // EXPANSION OBLIGATOIRE : chaque requête combine l'objet avec au moins un
  // modificateur style/matériau/qualité — jamais le nom exact seul.
  const queries: string[] = [];
  const push = (...values: string[]) => { for (const value of values) { const clean = value.trim().replace(/\s+/g, " ").toLowerCase(); if (clean && !queries.includes(clean)) queries.push(clean); } };
  for (const object of rawTerms.slice(0, 2)) {
    const style = styleHints[0];
    const material = materialHints[0];
    if (style && material) push(`${style} ${material} ${object}`);
    else if (material) push(`${material} ${object} ${stylizedWanted ? "stylized" : "realistic"}`);
    else if (style) push(`${style} ${object} ${stylizedWanted ? "stylized" : "pbr"}`);
    else push(`${object} ${stylizedWanted ? "low poly stylized" : QUALITY_TOKENS.join(" ")}`);
    if (materialHints[1]) push(`${materialHints[1]} ${object}`);
    if (styleHints[1]) push(`${styleHints[1]} ${object} detailed`);
  }
  // Requêtes de contexte : variété de style/matière pour élargir le champ.
  if (rawTerms[0] && !queries.length) push(`${rawTerms[0]} ${QUALITY_TOKENS.join(" ")}`);
  if (rawTerms[0] && queries.length < 3) {
    push(`${rawTerms[0]} ${stylizedWanted ? "stylized" : "realistic"} 3d model`);
    if (materialHints[0] || styleHints[0]) push(`${[...styleHints.slice(0, 1), ...materialHints.slice(0, 1)].join(" ")} ${rawTerms[0]}`);
  }
  if (queries.length < 3) {
    // Demande trop vague : on élargit honnêtement plutôt que d'inventer.
    push(...(stylizedWanted ? ["stylized 3d model pbr", "low poly model"] : ["realistic pbr 3d model", "high detail 3d scan"]));
  }
  return { request: request.trim(), objectTerms: rawTerms, styleHints, materialHints, queries: queries.slice(0, 6), premium, origin: "heuristic" };
}

/** Schéma JSON strict exigé du Brain pour l'expansion de recherche. */
export const MODEL_3D_BRAIN_PROMPT = `Tu es SOPHENIC Model Search Engine, expert en sourcing de modèles 3D Sketchfab. Analyse la demande utilisateur (et les images de référence jointes s'il y en a) et réponds UNIQUEMENT en JSON valide (aucun markdown) :
{"objectTerms":["terme objet en anglais, ..."],"styleHints":["style en anglais, ..."],"materialHints":["matériau en anglais, ..."],"queries":["requête de recherche Sketchfab en anglais, ..."],"premium":true|false}
RÈGLES :
- queries : 4 à 6 requêtes ANGLAISES pour l'API de recherche Sketchfab, chacune combinant l'objet avec AU MOINS UN modificateur de style, de matériau ou de qualité (ex. « scandinavian oak sofa », « modern fabric armchair pbr », « velvet armchair detailed »). JAMAIS le nom exact de l'objet seul, JAMAIS la demande brute traduite.
- Déduis l'objet du vocabulaire réel ; s'il y a des images jointes, extrais l'objet, le style et les matériaux que tu vois.
- premium : true si l'utilisateur veut du réalisme/du détail (pbr, photoréaliste, scan), false pour du low-poly/stylisé explicite.
- N'invente pas d'objet ambigu : si la demande est trop vague, renvoie les termes les plus probables et des requêtes génériques de qualité.`;

export function buildModelBriefMessages(request: string, attachments?: Model3DAttachment[]): BrainChatMessage[] {
  const files = attachments || [];
  const images = files.filter((file) => file.mime.startsWith("image/")).map((file) => file.dataUrl);
  const documents = files.filter((file) => !file.mime.startsWith("image/")).map((file) => ({ name: file.name, mime: file.mime, dataUrl: file.dataUrl }));
  const attachmentNote = files.length ? `\n\nRÉFÉRENCES JOINTES PAR L'UTILISATEUR (${files.length}) : ${files.map((file) => `${file.name} (${file.mime || "inconnu"})`).join(", ")}. Analyse-les et intègre l'objet, le style et les matériaux observés.` : "";
  return [{
    role: "user",
    content: `${MODEL_3D_BRAIN_PROMPT}\n\n====================\n\nDEMANDE : ${request.slice(0, 2000)}${attachmentNote}\n\nRenvoie maintenant le JSON du brief de recherche.`,
    ...(images.length ? { images } : {}),
    ...(documents.length ? { files: documents } : {})
  }];
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 1).map((item) => item.trim().slice(0, 80)).slice(0, max);
}

export function mergeBrainModelBrief(base: Model3DBrief, brain: Record<string, unknown>): Model3DBrief {
  const merged: Model3DBrief = { ...base, origin: "brain" };
  const objectTerms = asStringArray(brain.objectTerms, 4);
  if (objectTerms.length) merged.objectTerms = objectTerms;
  const styleHints = asStringArray(brain.styleHints, 4);
  if (styleHints.length) merged.styleHints = styleHints;
  const materialHints = asStringArray(brain.materialHints, 4);
  if (materialHints.length) merged.materialHints = materialHints;
  const queries = asStringArray(brain.queries, 6);
  // Les requêtes du Brain doivent rester des requêtes EXPANDÉES : on rejette
  // celles qui se résument au terme objet seul (règle anti-recherche-exacte).
  const objectSet = new Set(merged.objectTerms.map((term) => term.toLowerCase()));
  const expanded = queries.filter((query) => query.split(/\s+/).some((word) => !objectSet.has(word.toLowerCase())));
  if (expanded.length >= 3) merged.queries = expanded;
  if (typeof brain.premium === "boolean") merged.premium = brain.premium;
  return merged;
}

/**
 * Résout le brief : 1) heuristique déterministe (garde-fou, toujours construite),
 * 2) enrichissement par le SOPHENIC Brain existant (desktop IPC → route web).
 * Aucune IA joignable → brief heuristique + notice honnête.
 */
export async function resolveModel3DBrief(input: { request: string; effortMode?: DesignIntentEffortMode; attachments?: Model3DAttachment[] }): Promise<Model3DBrief> {
  const base = heuristicModel3DBrief(input.request);
  try {
    const response = await chatWithExistingBrain(buildModelBriefMessages(input.request, input.attachments), input.effortMode || "auto");
    if (!response.content) return { ...base, notice: "Brain indisponible — expansion heuristique déterministe utilisée." };
    const parsed = parseBrainJson(response.content);
    if (!parsed || typeof parsed !== "object") return { ...base, notice: "Réponse Brain illisible — expansion heuristique déterministe utilisée." };
    return mergeBrainModelBrief(base, parsed as Record<string, unknown>);
  } catch {
    return { ...base, notice: "Brain indisponible — expansion heuristique déterministe utilisée." };
  }
}
