import type { DesignProject } from "../types";
import type { CodeDesignHandoff, WebDesignBlueprint } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — CODE CONNECTION.
 *
 * « Envoyer vers SOPHENIC Code » : le design blueprint devient un handoff
 * (brief d'implémentation complet) que SOPHENIC Code consomme pour générer
 * React / Next.js / Shopify / WordPress / HTML-CSS à partir du design —
 * jamais l'inverse : le design précède le code.
 */

const HANDOFF_KEY = "sophenic.webdesign.handoffs.v1";
export const CODE_STACKS = ["React", "Next.js", "Shopify", "WordPress", "HTML/CSS"] as const;

/** Construit le brief d'implémentation prêt pour SOPHENIC Code. */
export function buildImplementationBrief(projectName: string, blueprint: WebDesignBlueprint): string {
  const pages = blueprint.pages.map((page) => `- **${page.name}** : ${page.sections.map((section) => section.name).join(" → ")}`).join("\n");
  const components = blueprint.components.map((component) => `- **${component.name}** (${component.variant}) — ${component.description}`).join("\n");
  const animations = blueprint.visualStyle.animations.map((animation) => `- ${animation}`).join("\n");
  const responsive = blueprint.responsiveRules.map((rule) => `- **${rule.breakpoint}** : ${rule.rule}`).join("\n");
  const threeD = blueprint.threeDElements.length ? blueprint.threeDElements.map((element) => `- ${element.concept} — ${element.library} (${element.placement})`).join("\n") : "- Aucune (design 2D assumé)";
  const assets = blueprint.assets.slice(0, 12).map((asset) => `- ${asset.kind} · ${asset.name} — ${asset.directive}`).join("\n");
  return `IMPLÉMENTATION DU DESIGN « ${projectName} » — SOPHENIC WEB DESIGN ENGINE

Tu es SOPHENIC Code. Implémente CE design (blueprint ci-dessous) dans la stack demandée par l'utilisateur : React, Next.js, Shopify, WordPress ou HTML/CSS. Le design est la source de vérité : respecte la palette, la typographie, la structure des pages, les animations et les règles responsive. Ne redessine rien.

IDENTITÉ
- Marque : ${blueprint.brand}
- Industrie : ${blueprint.industry}
- Direction : ${blueprint.designDirection}
- Concept : ${blueprint.concept}
- Palette (fond → texte → accent → support → surface) : ${blueprint.visualStyle.colors.join(" · ")}
- Typographie : ${blueprint.visualStyle.typography} (polices Google ou équivalent système)
- Spacing : ${blueprint.visualStyle.spacing}
- Imagerie : ${blueprint.visualStyle.imagery}

CONVERSION
- CTA principal : « ${blueprint.conversion.primaryCta} » · secondaire : « ${blueprint.conversion.secondaryCta} »
- Objectif : ${blueprint.conversion.primaryCta}
- Preuves de confiance : ${blueprint.conversion.trustElements.join(" · ")}

PAGES & SECTIONS
${pages}

COMPOSANTS À CONSTRUIRE
${components}

ANIMATIONS
${animations}

RÈGLES RESPONSIVE
${responsive}

EXPÉRIENCE 3D
${threeD}

ASSETS PRÉVUS
${assets}

QUALITÉ VISÉE
${blueprint.quality ? `Score design ${blueprint.quality.scores.overall}/100 (visuel ${blueprint.quality.scores.visual}, UX ${blueprint.quality.scores.ux}, conversion ${blueprint.quality.scores.conversion}, marque ${blueprint.quality.scores.brand}, mobile ${blueprint.quality.scores.mobile}) — ne pas dégrader ces scores.` : "Respecter les contrastes WCAG AA et les cibles tactiles ≥44px."}

CONTRAINTES
- Respecter prefers-reduced-motion.
- Images optimisées (AVIF/WebP, lazy loading, srcset).
- Aucune dépendance trackée tierce inutile.
- Le rendu doit matcher l'aperçu design (preview/index.html du projet exporté).`;
}

/** Construit le handoff complet (design → Code). */
export function buildCodeHandoff(project: DesignProject): CodeDesignHandoff {
  const blueprint = project.webDesign?.blueprint;
  if (!blueprint) throw new Error("Aucun design à envoyer — génère d'abord un blueprint.");
  return {
    id: `handoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: project.name,
    createdAt: new Date().toISOString(),
    stacks: [...CODE_STACKS],
    blueprint: structuredClone(blueprint),
    implementationBrief: buildImplementationBrief(project.name, blueprint)
  };
}

/* ---------- Stockage (navigateur ; aucun crash en Node/SSR) ---------- */

export function saveCodeHandoff(handoff: CodeDesignHandoff): CodeDesignHandoff[] {
  const rows = listCodeHandoffs();
  const next = [handoff, ...rows.filter((row) => row.id !== handoff.id)].slice(0, 30);
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(HANDOFF_KEY, JSON.stringify(next));
  } catch { /* quota : garder en mémoire de session */ }
  return next;
}

export function listCodeHandoffs(): CodeDesignHandoff[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(HANDOFF_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.id === "string" && row.blueprint) : [];
  } catch { return []; }
}

/** Prompt prêt à coller dans SOPHENIC Code (avec sélection de design). */
export function codeSelectionPrompt(): string {
  const rows = listCodeHandoffs();
  if (!rows.length) return "Aucun design SOPHENIC disponible. Crée un design dans SOPHENIC Web Design puis utilise « Envoyer vers SOPHENIC Code ».";
  const list = rows.slice(0, 10).map((row, index) => `${index + 1}. ${row.name} — ${row.blueprint.brand} (${row.blueprint.industry}, design ${row.blueprint.mode}${row.blueprint.templateName ? ` base ${row.blueprint.templateName}` : ""}, ${row.blueprint.quality?.scores.overall || "?"}/100)`).join("\n");
  return `DESIGNS SOPHENIC DISPONIBLES (sélectionne le design à implémenter, puis demande la stack : React, Next.js, Shopify, WordPress ou HTML/CSS) :\n\n${list}`;
}
