"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft, BadgeCheck, Boxes, Check, Code2, Download, Layers3, Loader2, Monitor,
  MousePointerClick, Palette, Send, Smartphone, Sparkles, Tablet, Wand2, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArchitectureThinkingTimeline, type ArchitectureWorkStep } from "./architecture-thinking-timeline";
import { resolveWebDesignBrief } from "@/design/web-design/creative-brief";
import { runCreativeAgency } from "@/design/web-design/creative-agents";
import { customizeTemplate, } from "@/design/web-design/template-mode";
import { rankTemplatesForBrief, templateById } from "@/design/web-design/templates";
import { designUntilQuality } from "@/design/web-design/quality";
import { recommendDesignAssets } from "@/design/web-design/asset-plan";
import { buildDesignPreviewHtml } from "@/design/web-design/preview";
import { downloadWebDesignProjectZip } from "@/design/web-design/export";
import { buildCodeHandoff, saveCodeHandoff, codeSelectionPrompt } from "@/design/web-design/code-handoff";
import type { DesignProject } from "@/design/types";
import type { WebDesignBlueprint, WebDesignMode } from "@/design/web-design/types";

/**
 * SOPHENIC WEB DESIGN ENGINE — atelier de design de sites.
 * Deux modes : Template Intelligence (rapide, économique) et Original
 * Creative Design (agence créative complète). Le livrable est un WEBSITE
 * DESIGN BLUEPRINT — aucun code applicatif n'est généré ici.
 */

type Props = { project: DesignProject; onMutate: (recipe: (project: DesignProject) => void, summary: string) => void; onBack: () => void; effortMode?: "quick" | "auto" | "deep" };

const SUGGESTIONS = [
  "Crée un site de marque de joaillerie de luxe",
  "Crée un site de villa de luxe à Marrakech",
  "Crée un site pour une startup IA de gaming",
  "Crée un site pour un restaurant gastronomique"
];

const SCORE_LABELS: Array<{ key: keyof NonNullable<WebDesignBlueprint["quality"]>["scores"]; label: string }> = [
  { key: "visual", label: "Visuel" }, { key: "ux", label: "UX" }, { key: "conversion", label: "Conversion" },
  { key: "brand", label: "Marque" }, { key: "mobile", label: "Mobile" }
];

export function WebDesignWorkspace({ project, onMutate, onBack, effortMode = "auto" }: Props) {
  const [mode, setMode] = useState<WebDesignMode>(project.webDesign?.mode || "original");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [steps, setSteps] = useState<ArchitectureWorkStep[]>([]);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [handoffNotice, setHandoffNotice] = useState("");

  const state = project.webDesign;
  const blueprint = state?.blueprint;
  const candidates = state?.templateCandidates || [];
  const awaitingTemplateChoice = mode === "template" && candidates.length > 0 && !blueprint;

  const updateStep = useCallback((id: string, status: ArchitectureWorkStep["status"], detail?: string) => {
    setSteps((rows) => rows.map((step) => step.id === id ? { ...step, status, ...(detail !== undefined ? { detail } : {}) } : step));
  }, []);

  const baseSteps = (designMode: WebDesignMode, referenceCount = 0): ArchitectureWorkStep[] => [
    { id: "brief", label: "Analyse créative (Brain)", detail: "Le SOPHENIC Brain analyse industrie, audience, positionnement, émotions et conversion.", status: "running" },
    ...(designMode === "template"
      ? [{ id: "templates", label: "Templates compatibles", detail: "Classement de la bibliothèque interne (top 3).", status: "queued" } as ArchitectureWorkStep]
      : [{ id: "agency", label: "Agence créative", detail: "Creative Director → UX → Brand → Visual → Motion → 3D → Conversion.", status: "queued" } as ArchitectureWorkStep]),
    { id: "blueprint", label: "Website Design Blueprint", detail: "Pages, sections, identité visuelle, composants, responsive.", status: "queued" },
    { id: "quality", label: "Contrôle qualité design", detail: "Visual / UX / Conversion / Brand / Mobile — évaluation puis auto-amélioration.", status: "queued" },
    { id: "assets", label: "Asset Intelligence", detail: "Images, icônes, illustrations, 3D, animations recommandées.", status: "queued" },
    { id: "final", label: "Design finalisé", status: "queued" }
  ];

  /** Pipeline complet : brief → (templates | agence) → blueprint → qualité → assets. */
  const generate = async (designMode: WebDesignMode, rawInstruction?: string, templateId?: string) => {
    const request = (rawInstruction || instruction || "").trim();
    if (!request && !state?.brief) { setError("Décris le site à designer (marque, secteur, ambiance…)."); return; }
    setBusy(true); setError(""); setProgress("Analyse créative via SOPHENIC Brain…");
    setSteps(baseSteps(designMode));
    try {
      const brief = request ? await resolveWebDesignBrief({ instruction: request, effortMode }) : state!.brief!;
      updateStep("brief", "done", `${brief.brand ? `« ${brief.brand} » · ` : ""}${brief.industry} · ${brief.premiumLevel} · conversion : ${brief.conversionGoal}${brief.origin === "brain" ? " · via SOPHENIC Brain" : " · analyse locale déterministe"}`);
      onMutate((draft) => { draft.webDesign = { ...(draft.webDesign || {}), mode: designMode, brief, blueprint: undefined, selectedTemplateId: templateId }; }, "Brief créatif analysé");

      let nextBlueprint: WebDesignBlueprint;
      if (designMode === "template" && !templateId) {
        const ranked = rankTemplatesForBrief(brief);
        updateStep("templates", "done", ranked.map((candidate) => `${candidate.name} ${candidate.compatibility}%`).join(" · "));
        onMutate((draft) => { draft.webDesign = { ...(draft.webDesign || {}), mode: designMode, brief, templateCandidates: ranked, blueprint: undefined }; }, `${ranked.length} templates compatibles`);
        setBusy(false); setProgress(""); setSteps([]);
        return; // attente du choix utilisateur
      }
      if (designMode === "template" && templateId) {
        const template = templateById(templateId);
        if (!template) throw new Error("Template introuvable.");
        setProgress(`Personnalisation du template « ${template.name} »…`);
        updateStep("templates", "done", `sélection : ${template.name}`);
        const customized = customizeTemplate(template, brief);
        updateStep("templates", "done", `${template.name} re-personnalisé : ${Math.round(customized.structureKeptRatio * 100)}% de structure conservée, identité visuelle remplacée.`);
        nextBlueprint = customized.blueprint;
      } else {
        setProgress("L'agence créative compose le design…");
        updateStep("agency", "running", "Creative Director : direction artistique…");
        const agency = runCreativeAgency(brief);
        nextBlueprint = agency.blueprint;
        updateStep("agency", "done", `${agency.log.length} agents ont collaboré : ${agency.log.map((step) => step.agent).join(" → ")}.`);
      }

      updateStep("blueprint", "done", `${nextBlueprint.pages.length} pages · ${nextBlueprint.pages.reduce((sum, page) => sum + page.sections.length, 0)} sections · ${nextBlueprint.visualStyle.typography}`);
      updateStep("quality", "running", "Évaluation Visual/UX/Conversion/Brand/Mobile…");
      setProgress("Contrôle qualité et auto-amélioration…");
      const qualified = designUntilQuality({ blueprint: nextBlueprint, brief });
      updateStep("quality", "done", `${qualified.report.scores.overall}/100${qualified.fixes.length ? ` · ${qualified.fixes.length} correction(s) automatique(s)` : ""}${qualified.report.issues.filter((issue) => !qualified.fixes.length).length ? ` · ${qualified.report.issues.length} point(s) d'attention` : ""}`);
      updateStep("assets", "running", "Recommandation des assets…");
      const withAssets = qualified.blueprint;
      withAssets.assets = recommendDesignAssets(withAssets, brief);
      updateStep("assets", "done", `${withAssets.assets.length} recommandation(s) : ${[...new Set(withAssets.assets.map((asset) => asset.kind))].join(", ")}`);
      updateStep("final", "done", "Design prêt : exportable, envoyable vers SOPHENIC Code.");
      onMutate((draft) => { draft.webDesign = { mode: designMode, brief, blueprint: withAssets, templateCandidates: designMode === "template" ? candidates : undefined, selectedTemplateId: templateId }; }, `Design généré : ${brief.brand || brief.industry} (${qualified.report.scores.overall}/100)`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Génération du design impossible.");
    } finally {
      setBusy(false); setProgress("");
    }
  };

  const sendToCode = async () => {
    if (!blueprint) return;
    try {
      const handoff = buildCodeHandoff(project);
      saveCodeHandoff(handoff);
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(handoff.implementationBrief).catch(() => undefined);
      setHandoffNotice(`Design envoyé vers SOPHENIC Code (${handoff.stacks.join(", ")}). Le brief d'implémentation est copié : ouvre l'agent en mode Code et colle-le, ou utilise le bouton « Design » du compositeur Code. ${codeSelectionPrompt().split("\n")[0]}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi vers SOPHENIC Code impossible.");
    }
  };

  const previewHtml = useMemo(() => blueprint ? buildDesignPreviewHtml(blueprint) : "", [blueprint]);
  const quality = blueprint?.quality;

  return <div className="flex h-full min-h-[650px] flex-col overflow-hidden bg-[#f5f2eb] text-zinc-800 dark:bg-[#101010] dark:text-zinc-100">
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-black/[.07] bg-[#fbf9f5]/95 px-2.5 backdrop-blur dark:border-white/[.07] dark:bg-[#141414]/95">
      <button type="button" onClick={onBack} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10" title="Retour aux projets"><ArrowLeft className="size-4" /></button>
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-[12px] font-semibold">{project.name}</span><span className="hidden rounded-full bg-[#eee4d5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.14em] text-[#795b36] sm:inline dark:bg-white/10 dark:text-zinc-300">Web Design</span></div><div className="text-[8px] uppercase tracking-[.14em] text-zinc-400">{blueprint ? `Blueprint ${blueprint.mode === "template" ? `template « ${blueprint.templateName} »` : "original"} · ${blueprint.pages.length} pages${quality ? ` · ${quality.scores.overall}/100` : ""}` : "Aucun design généré"}</div></div>
      <div className="flex-1" />
      {blueprint && <>
        <button type="button" onClick={() => downloadWebDesignProjectZip(project)} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><Download className="size-3.5" />Exporter SOPHENIC_WEB_DESIGN_PROJECT.zip</button>
        <button type="button" onClick={() => void sendToCode()} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7f5d36] px-3 text-[10px] font-semibold text-white hover:bg-[#6d4e2c]"><Code2 className="size-3.5" />Envoyer vers SOPHENIC Code</button>
      </>}
    </header>

    <div className="flex min-h-0 flex-1">
      {/* Colonne gauche : modes, demande, pipeline */}
      <aside className="flex w-[340px] max-w-[40vw] shrink-0 flex-col border-r border-black/[.07] bg-[#fbf9f5] dark:border-white/[.07] dark:bg-[#141414]">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("template")} disabled={busy} className={cn("rounded-xl border p-2.5 text-left transition", mode === "template" ? "border-[#b58a55] bg-[#f6ecdc] dark:bg-white/10" : "border-black/10 bg-white/60 hover:border-[#c6a477] dark:border-white/10 dark:bg-white/[.03]")}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold"><Layers3 className="size-3.5 text-[#8a6539]" />Template Intelligence</div>
              <p className="mt-1 text-[9px] leading-4 text-zinc-500">Rapide et économique : la bibliothèque interne fournit 3 structures, SOPHENIC re-personnalise tout (identité, couleurs, typo, animations). Le résultat ne ressemble pas au template.</p>
            </button>
            <button type="button" onClick={() => setMode("original")} disabled={busy} className={cn("rounded-xl border p-2.5 text-left transition", mode === "original" ? "border-[#b58a55] bg-[#f6ecdc] dark:bg-white/10" : "border-black/10 bg-white/60 hover:border-[#c6a477] dark:border-white/10 dark:bg-white/[.03]")}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold"><Wand2 className="size-3.5 text-[#8a6539]" />Création Originale</div>
              <p className="mt-1 text-[9px] leading-4 text-zinc-500">Mode premium : agence créative complète (direction de création, UX, branding, motion, 3D, conversion) — design unique, sans template.</p>
            </button>
          </div>

          {awaitingTemplateChoice ? <div className="mb-3">
            <div className="mb-2 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]">Templates compatibles — choisis une structure de départ</div>
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button key={candidate.templateId} type="button" disabled={busy} onClick={() => void generate("template", undefined, candidate.templateId)} className="w-full rounded-xl border border-black/10 bg-white p-2.5 text-left hover:border-[#c6a477] dark:border-white/10 dark:bg-white/[.03]">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-semibold">{candidate.name}</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Compatibilité {candidate.compatibility}%</span></div>
                  <div className="mt-1 text-[9px] leading-4 text-zinc-500">{candidate.reasons.join(" · ")}</div>
                </button>
              ))}
            </div>
          </div> : <div className="mb-3">
            <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} disabled={busy} placeholder={mode === "template" ? "Ex. Crée un site pour une marque de café de spécialité…" : "Ex. Crée un site de villa de luxe à Marrakech…"} className="w-full resize-none rounded-xl border border-black/10 bg-white p-2.5 text-[11px] leading-5 outline-none focus:border-[#c19a68] dark:border-white/10 dark:bg-white/[.04]" />
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" disabled={busy || !instruction.trim()} onClick={() => void generate(mode)} className="flex h-8 items-center gap-1.5 rounded-xl bg-[#7f5d36] px-3 text-[10px] font-semibold text-white disabled:opacity-35">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}{mode === "template" ? "Trouver mes templates" : "Créer le design"}</button>
              {state?.brief && !busy && <span className="text-[8px] text-zinc-400">Brief actuel : {state.brief.industry}</span>}
            </div>
            {!state?.brief && <div className="mt-2 space-y-1.5">{SUGGESTIONS.map((text) => <button key={text} type="button" onClick={() => setInstruction(text)} className="w-full rounded-xl border border-black/[.06] bg-white/55 p-2 text-left text-[9px] leading-4 text-zinc-500 hover:border-[#c6a477] dark:border-white/[.07] dark:bg-white/[.025]">{text}</button>)}</div>}
          </div>}

          {(steps.length > 0 || busy) && <ArchitectureThinkingTimeline steps={steps} />}
          {progress && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#f5ecdf] px-2.5 py-1.5 text-[9px] text-[#76572f] dark:bg-white/[.05] dark:text-zinc-300"><Loader2 className="size-3 animate-spin" />{progress}</div>}
          {error && <div className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[9px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
          {handoffNotice && <div className="mb-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[9px] leading-4 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><BadgeCheck className="mr-1 inline size-3" />{handoffNotice}</div>}

          {/* Blueprint résumé */}
          {blueprint && <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
              <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Palette className="size-3" />Identité visuelle</div>
              <div className="mb-2 flex gap-1">{blueprint.visualStyle.colors.map((color, index) => <span key={`${color}-${index}`} className="h-6 flex-1 rounded-md border border-black/10 dark:border-white/15" style={{ background: color }} title={color} />)}</div>
              <div className="space-y-1 text-[9.5px] leading-4">
                <div><span className="font-semibold text-zinc-500">Typographie</span> {blueprint.visualStyle.typography}</div>
                <div><span className="font-semibold text-zinc-500">Spacing</span> {blueprint.visualStyle.spacing}</div>
                <div><span className="font-semibold text-zinc-500">Imagerie</span> {blueprint.visualStyle.imagery}</div>
                <div><span className="font-semibold text-zinc-500">Direction</span> {blueprint.designDirection}</div>
              </div>
            </div>

            {quality && <div className="rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
              <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><BadgeCheck className="size-3" />Qualité design : {quality.scores.overall}/100</div>
              <div className="space-y-1.5">{SCORE_LABELS.map(({ key, label }) => <div key={key} className="flex items-center gap-2 text-[9px]"><span className="w-16 shrink-0 text-zinc-500">{label}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><span className="block h-full rounded-full" style={{ width: `${quality.scores[key]}%`, background: quality.scores[key] >= 85 ? "#2f8f6b" : quality.scores[key] >= 70 ? "#c9a961" : "#c0392b" }} /></span><span className="w-7 text-right font-mono text-zinc-400">{quality.scores[key]}</span></div>)}</div>
              {quality.issues.length > 0 && <div className="mt-2 text-[8.5px] leading-4 text-zinc-500"><span className="font-bold uppercase tracking-[.12em]">Points d’attention</span>{quality.issues.slice(0, 4).map((issue, index) => <div key={index}>• {issue.message}</div>)}</div>}
            </div>}

            <div className="rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
              <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Layers3 className="size-3" />Structure — {blueprint.pages.length} pages</div>
              <div className="space-y-2">{blueprint.pages.map((page) => <div key={page.name}><div className="text-[10px] font-semibold">{page.name}</div><div className="text-[8.5px] leading-4 text-zinc-500">{page.sections.map((section) => section.name).join(" → ")}</div></div>)}</div>
            </div>

            {blueprint.agencyLog.length > 0 && <div className="rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
              <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Sparkles className="size-3" />Pipeline créatif</div>
              <div className="space-y-1.5">{blueprint.agencyLog.map((step, index) => <div key={index}><div className="text-[9.5px] font-semibold">{step.agent} <span className="font-normal text-zinc-400">— {step.role}</span></div><div className="text-[8.5px] leading-4 text-zinc-500">{step.decisions.slice(0, 2).join(" · ")}</div></div>)}</div>
            </div>}

            {blueprint.threeDElements.length > 0 && <div className="rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
              <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Boxes className="size-3" />Expérience 3D</div>
              {blueprint.threeDElements.map((element, index) => <div key={index} className="mb-1.5 text-[9px] leading-4"><span className="font-semibold">{element.concept}</span><br /><span className="text-zinc-500">{element.library} · {element.placement} — {element.rationale}</span></div>)}
            </div>}

            {blueprint.assets.length > 0 && <div className="rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
              <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Boxes className="size-3" />Assets recommandés ({blueprint.assets.length})</div>
              <div className="space-y-1">{blueprint.assets.slice(0, 8).map((asset, index) => <div key={index} className="text-[8.5px] leading-4"><span className="rounded bg-black/5 px-1 font-mono text-[7.5px] uppercase dark:bg-white/10">{asset.kind}</span> <span className="font-semibold">{asset.name}</span> — <span className="text-zinc-500">{asset.directive.slice(0, 90)}…</span></div>)}</div>
            </div>}
          </div>}
        </div>
      </aside>

      {/* Aperçu du design */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-black/[.06] px-3 dark:border-white/[.06]">
          <span className="text-[8px] font-bold uppercase tracking-[.12em] text-zinc-400">Aperçu du design</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-xl bg-black/[.03] p-1 dark:bg-white/[.045]">
            {([["desktop", Monitor, "Desktop"], ["tablet", Tablet, "Tablette"], ["mobile", Smartphone, "Mobile"]] as const).map(([id, Icon, label]) => <button key={id} type="button" onClick={() => setViewport(id)} title={label} className={cn("flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold", viewport === id ? "bg-white text-[#805b32] shadow-sm dark:bg-white/10" : "text-zinc-400")}><Icon className="size-3" />{label}</button>)}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#ece7dd] p-3 dark:bg-black/30">
          {previewHtml ? <div className="mx-auto h-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg transition-all dark:border-white/10" style={{ width: viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "390px", maxWidth: "100%" }}><iframe title="Aperçu design" srcDoc={previewHtml} className="h-full min-h-[600px] w-full" sandbox="allow-same-origin" /></div>
            : <div className="grid h-full place-items-center text-center"><div><MousePointerClick className="mx-auto mb-3 size-8 text-zinc-300" /><p className="max-w-sm text-[11px] leading-5 text-zinc-400">Décris le site à designer puis lance la génération.<br />Le design (blueprint) sera prévisualisé ici — le code viendra ensuite, dans SOPHENIC Code.</p></div></div>}
        </div>
      </div>
    </div>
  </div>;
}
