import { buildFilesZip } from "../web-export";
import type { DesignProject } from "../types";
import { buildDesignPreviewHtml } from "./preview";
import type { WebDesignBlueprint, WebDesignBrief } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — EXPORT.
 *
 * SOPHENIC_WEB_DESIGN_PROJECT.zip :
 *   design.json · brief.json · quality-report.json · README.md
 *   components/*.md · assets/asset-plan.json · images/image-plan.md
 *   animations/animation-rules.md · responsive-rules.md · preview/index.html
 */

export function buildWebDesignExportFiles(project: DesignProject): Array<{ path: string; content: string }> {
  const state = project.webDesign;
  const blueprint = state?.blueprint;
  if (!blueprint) throw new Error("Aucun blueprint à exporter — génère d'abord un design.");
  const brief = state?.brief;
  const files: Array<{ path: string; content: string }> = [];
  const stamp = new Date().toISOString();

  files.push({ path: "design.json", content: JSON.stringify(blueprint, null, 2) });
  if (brief) files.push({ path: "brief.json", content: JSON.stringify({ ...brief, exportedAt: stamp }, null, 2) });
  if (blueprint.quality) files.push({ path: "quality-report.json", content: JSON.stringify({ ...blueprint.quality, exportedAt: stamp }, null, 2) });

  files.push({ path: "README.md", content: buildReadme(project.name, blueprint, brief) });

  // Descriptions de composants (un fichier par composant).
  for (const component of blueprint.components) {
    files.push({ path: `components/${slug(component.name)}.md`, content: [
      `# ${component.name}`,
      "",
      `- **Variante** : ${component.variant}`,
      `- **Pages** : ${component.pages.join(", ")}`,
      `- **Palette** : ${blueprint.visualStyle.colors.join(" · ")}`,
      `- **Typographie** : ${blueprint.visualStyle.typography}`,
      "",
      component.description,
      ""
    ].join("\n") });
  }

  // Plan d'assets + images + animations + responsive.
  files.push({ path: "assets/asset-plan.json", content: JSON.stringify({ generatedAt: stamp, assets: blueprint.assets }, null, 2) });
  files.push({ path: "images/image-plan.md", content: [
    "# Plan d'images",
    "",
    `Direction imagerie : ${blueprint.visualStyle.imagery}`,
    "",
    ...blueprint.assets.filter((asset) => asset.kind === "image").map((asset) => `## ${asset.name}\n- **Usage** : ${asset.usage}\n- **Directive** : ${asset.directive}\n- **Raison** : ${asset.reason}\n`),
    "> Ces directives sont prêtes pour une banque d'images, un shooting ou une génération d'images IA."
  ].join("\n") });
  files.push({ path: "animations/animation-rules.md", content: [
    "# Règles d'animation",
    "",
    ...blueprint.visualStyle.animations.map((animation) => `- ${animation}`),
    "",
    blueprint.assets.filter((asset) => asset.kind === "animation").map((asset) => `**Librairies** : ${asset.directive}`).join("\n"),
    "",
    "- Respecter `prefers-reduced-motion` : désactiver les animations non essentielles.",
    "- Jamais plus de 2 animations simultanées visibles à l'écran."
  ].join("\n") });
  files.push({ path: "responsive-rules.md", content: [
    "# Règles responsive",
    "",
    ...blueprint.responsiveRules.map((rule) => `- **${rule.breakpoint}** — ${rule.rule}`)
  ].join("\n") });

  if (blueprint.threeDElements.length) {
    files.push({ path: "3d/3d-experience.md", content: [
      "# Expérience 3D",
      "",
      ...blueprint.threeDElements.map((element) => `## ${element.concept}\n- **Librairie** : ${element.library}\n- **Placement** : ${element.placement}\n- **Justification** : ${element.rationale}\n`)
    ].join("\n") });
  }

  // Aperçu visuel du design (visualisation du blueprint, pas le code du site).
  files.push({ path: "preview/index.html", content: buildDesignPreviewHtml(blueprint) });

  return files;
}

/** Construit et télécharge SOPHENIC_WEB_DESIGN_PROJECT.zip (navigateur). */
export function downloadWebDesignProjectZip(project: DesignProject): void {
  const files = buildWebDesignExportFiles(project);
  const blob = buildFilesZip(files);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(project.name || "SOPHENIC_WEB_DESIGN_PROJECT").replace(/[^a-z0-9-_]+/gi, "-").toUpperCase() || "SOPHENIC_WEB_DESIGN_PROJECT"}.zip`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function buildReadme(projectName: string, blueprint: WebDesignBlueprint, brief?: WebDesignBrief): string {
  const scores = blueprint.quality?.scores;
  return [
    `# ${projectName} — Website Design Blueprint`,
    "",
    `Projet généré par **SOPHENIC Web Design Engine** (${blueprint.mode === "template" ? `mode Template Intelligence — base « ${blueprint.templateName} » entièrement re-personnalisée` : "mode Original Creative Design — agence créative complète"}).`,
    "",
    `- **Marque** : ${blueprint.brand}`,
    `- **Industrie** : ${blueprint.industry}`,
    `- **Direction artistique** : ${blueprint.designDirection}`,
    `- **Concept** : ${blueprint.concept}`,
    `- **Pages** : ${blueprint.pages.map((page) => `${page.name} (${page.sections.length} sections)`).join(", ")}`,
    `- **Typographie** : ${blueprint.visualStyle.typography}`,
    `- **Palette** : ${blueprint.visualStyle.colors.join(" · ")}`,
    `- **CTA** : ${blueprint.conversion.primaryCta} / ${blueprint.conversion.secondaryCta}`,
    scores ? `- **Qualité** : ${scores.overall}/100 (visuel ${scores.visual} · UX ${scores.ux} · conversion ${scores.conversion} · marque ${scores.brand} · mobile ${scores.mobile})` : "",
    brief ? `- **Brief** : ${brief.industry} · ${brief.audience} · conversion « ${brief.conversionGoal} »` : "",
    "",
    "## Contenu de l'archive",
    "",
    "- `design.json` — le blueprint complet (source de vérité du design)",
    "- `brief.json` — le brief créatif analysé par le SOPHENIC Brain",
    "- `quality-report.json` — l'évaluation qualité automatique",
    "- `components/` — la description de chaque composant",
    "- `assets/` + `images/` — le plan d'assets recommandés",
    "- `animations/` + `responsive-rules.md` — motion et responsive",
    "- `preview/index.html` — l'aperçu visuel du design",
    "",
    "> Ce projet est un **design blueprint** : aucun code applicatif n'est généré ici.",
    "> Utilise « Envoyer vers SOPHENIC Code » pour générer l'implémentation (React, Next.js, Shopify, WordPress, HTML/CSS) à partir de ce design."
  ].filter(Boolean).join("\n");
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "composant";
}
