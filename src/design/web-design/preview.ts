import type { WebDesignBlueprint } from "./types";

/**
 * SOPHENIC WEB DESIGN ENGINE — PREVIEW.
 *
 * Rendu de VISUALISATION du blueprint (pas du code applicatif) : une page
 * HTML statique déterministe qui met en scène la direction artistique
 * (palette, typographie, structure des pages, CTA, animations suggérées)
 * pour que le design soit validé avant toute génération de code.
 */

const FONT_FALLBACKS: Record<string, string> = {
  "Cormorant Garamond": "Georgia, 'Times New Roman', serif",
  "Playfair Display": "Georgia, serif",
  "DM Serif Display": "Georgia, serif",
  "Source Serif 4": "Georgia, serif",
  "Lora": "Georgia, serif",
  "Fraunces": "Georgia, serif",
  "Space Grotesk": "'Segoe UI', Arial, sans-serif",
  "Unbounded": "'Segoe UI', Arial, sans-serif",
  "Syne": "'Segoe UI', Arial, sans-serif",
  "Clash Display": "'Segoe UI', Arial, sans-serif",
  "IBM Plex Mono": "'Courier New', monospace",
  Inter: "system-ui, 'Segoe UI', sans-serif",
  Jost: "system-ui, sans-serif",
  Karla: "system-ui, sans-serif",
  "Nunito Sans": "system-ui, sans-serif",
  "Source Sans 3": "system-ui, sans-serif",
  "Libre Franklin": "system-ui, sans-serif",
  Montserrat: "system-ui, sans-serif",
  "Open Sans": "system-ui, sans-serif",
  "Work Sans": "system-ui, sans-serif",
  "Archivo Expanded": "Arial, sans-serif",
  "General Sans": "system-ui, sans-serif",
  Sora: "system-ui, sans-serif"
};

function fontStack(name: string): string {
  return FONT_FALLBACKS[name] || "system-ui, sans-serif";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.02))",
  "linear-gradient(45deg, rgba(0,0,0,.10), rgba(0,0,0,.03))",
  "radial-gradient(circle at 30% 20%, rgba(255,255,255,.10), transparent 60%)"
];

/** Construit la page HTML de prévisualisation du design (déterministe). */
export function buildDesignPreviewHtml(blueprint: WebDesignBlueprint): string {
  const [background, foreground, accent, support, surface] = [
    blueprint.visualStyle.colors[0] || "#FFFFFF",
    blueprint.visualStyle.colors[1] || "#111111",
    blueprint.visualStyle.colors[2] || "#4F46E5",
    blueprint.visualStyle.colors[3] || "#666666",
    blueprint.visualStyle.colors[4] || "#F3F4F6"
  ];
  const display = blueprint.visualStyle.typographyStack?.display || "Inter";
  const body = blueprint.visualStyle.typographyStack?.body || "Inter";
  const nav = blueprint.pages.slice(0, 6).map((page) => `<a href="#page-${slug(page.name)}">${escapeHtml(page.name)}</a>`).join("");
  const pagesHtml = blueprint.pages.map((page, pageIndex) => {
    const sections = page.sections.map((section, sectionIndex) => {
      const gradient = PLACEHOLDER_GRADIENTS[(sectionIndex + pageIndex) % PLACEHOLDER_GRADIENTS.length];
      const isCta = /cta|conversion|r[ée]servation|rendez|booking/i.test(section.name);
      if (isCta) {
        return `<section class="cta">
          <h3>${escapeHtml(section.name)}</h3>
          <p class="muted">${escapeHtml(section.purpose)}</p>
          <div class="buttons"><span class="btn primary">${escapeHtml(blueprint.conversion.primaryCta || "Découvrir")}</span><span class="btn ghost">${escapeHtml(blueprint.conversion.secondaryCta || "En savoir plus")}</span></div>
          <p class="muted small">Preuves : ${escapeHtml(blueprint.conversion.trustElements.join(" · "))}</p>
        </section>`;
      }
      const isHero = sectionIndex === 0 && pageIndex === 0;
      if (isHero) {
        return `<section class="hero">
          <p class="eyebrow">${escapeHtml(blueprint.industry)}</p>
          <h1>${escapeHtml(blueprint.brand)}</h1>
          <p class="lead">${escapeHtml(blueprint.concept)}</p>
          <div class="buttons"><span class="btn primary">${escapeHtml(blueprint.conversion.primaryCta || "Découvrir")}</span><span class="btn ghost">${escapeHtml(blueprint.conversion.secondaryCta || "En savoir plus")}</span></div>
          <p class="muted small">Direction : ${escapeHtml(blueprint.designDirection)}</p>
        </section>`;
      }
      return `<section>
        <h3>${escapeHtml(section.name)}</h3>
        <p class="muted">${escapeHtml(section.purpose)}</p>
        <div class="cards">
          <div class="card" style="background:${gradient}"></div>
          <div class="card" style="background:${gradient}"></div>
          <div class="card" style="background:${gradient}"></div>
        </div>
      </section>`;
    }).join("\n");
    return `<div class="page" id="page-${slug(page.name)}">
      <header class="page-head"><span class="page-index">${pageIndex + 1}</span><h2>${escapeHtml(page.name)}</h2><span class="muted small">${page.sections.length} sections</span></header>
      ${sections}
    </div>`;
  }).join("\n");

  const threeDNote = blueprint.threeDElements.length
    ? `<div class="badge3d">3D · ${blueprint.threeDElements.map((element) => escapeHtml(`${element.library} — ${element.placement}`)).join(" · ")}</div>`
    : "";
  const animationsNote = blueprint.visualStyle.animations.length
    ? `<div class="badge3d">Motion · ${blueprint.visualStyle.animations.map(escapeHtml).join(" · ")}</div>`
    : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(blueprint.brand)} — Aperçu design SOPHENIC</title>
<style>
  :root { --bg:${background}; --fg:${foreground}; --accent:${accent}; --support:${support}; --surface:${surface}; --display:${fontStack(display)}; --body:${fontStack(body)}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background:var(--bg); color:var(--fg); font-family:var(--body); line-height:1.55; }
  .bar { position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:16px; padding:14px 24px; background:color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(10px); border-bottom:1px solid color-mix(in srgb, var(--fg) 14%, transparent); }
  .bar .logo { font-family:var(--display); font-size:18px; letter-spacing:.04em; }
  .bar nav { display:flex; gap:14px; margin-left:auto; font-size:12px; }
  .bar nav a { color:var(--support); text-decoration:none; }
  .bar nav a:hover { color:var(--accent); }
  .bar .cta-mini { background:var(--accent); color:var(--bg); border-radius:999px; padding:6px 14px; font-weight:700; font-size:11px; }
  .page { max-width:1080px; margin:0 auto; padding:56px 24px 24px; }
  .page-head { display:flex; align-items:baseline; gap:12px; border-bottom:1px solid color-mix(in srgb, var(--fg) 12%, transparent); padding-bottom:12px; margin-bottom:28px; }
  .page-head h2 { font-family:var(--display); font-size:34px; }
  .page-index { font-family:var(--display); font-size:22px; color:var(--accent); }
  .hero { text-align:center; padding:56px 16px 48px; }
  .eyebrow { text-transform:uppercase; letter-spacing:.28em; font-size:10px; color:var(--accent); margin-bottom:14px; }
  .hero h1 { font-family:var(--display); font-size:clamp(42px, 8vw, 84px); line-height:1.05; margin-bottom:18px; }
  .lead { max-width:640px; margin:0 auto 26px; color:var(--support); font-size:16px; }
  .buttons { display:flex; gap:12px; justify-content:center; margin:22px 0; flex-wrap:wrap; }
  .btn { border-radius:999px; padding:12px 26px; font-weight:700; font-size:13px; }
  .btn.primary { background:var(--accent); color:var(--bg); }
  .btn.ghost { border:1px solid color-mix(in srgb, var(--fg) 30%, transparent); color:var(--fg); }
  section { margin-bottom:44px; }
  section h3 { font-family:var(--display); font-size:26px; margin-bottom:6px; }
  .muted { color:var(--support); font-size:13px; }
  .muted.small, .small { font-size:11px; }
  .cards { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-top:16px; }
  .card { aspect-ratio:4/3; border-radius:14px; border:1px solid color-mix(in srgb, var(--fg) 10%, transparent); animation: rise .8s ease-out both; }
  .cta { text-align:center; background:var(--surface); border-radius:22px; padding:44px 20px; }
  .badge3d { max-width:1080px; margin:8px auto 26px; padding:10px 24px; font-size:11px; color:var(--support); border-left:3px solid var(--accent); }
  footer.apercu { text-align:center; padding:28px; font-size:10px; color:var(--support); letter-spacing:.08em; text-transform:uppercase; }
  @keyframes rise { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
  @media (max-width:768px) { .cards { grid-template-columns:1fr 1fr; } .bar nav { display:none; } }
  @media (max-width:480px) { .cards { grid-template-columns:1fr; } .page-head h2 { font-size:26px; } }
  @media (prefers-reduced-motion: reduce) { .card { animation:none; } }
</style>
</head>
<body>
  <div class="bar"><span class="logo">${escapeHtml(blueprint.brand)}</span><nav>${nav}</nav><span class="cta-mini">${escapeHtml(blueprint.conversion.primaryCta || "Découvrir")}</span></div>
  ${pagesHtml}
  ${threeDNote}
  ${animationsNote}
  <footer class="apercu">Aperçu du design — SOPHENIC Web Design Engine · blueprint ${escapeHtml(blueprint.mode)}${blueprint.templateName ? ` (base ${escapeHtml(blueprint.templateName)})` : ""} · ce document est une visualisation, pas le code du site</footer>
</body>
</html>`;
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
}
