"use client";

/**
 * SOPHENIC MODEL 3D ENGINE — atelier Design 3D (V8.5).
 *
 * Remplace l'ancien objet paramétrique par le même système que le Web Design :
 * 1. l'utilisateur fait sa demande (texte + références images optionnelles) ;
 * 2. le SOPHENIC Brain expande l'intention en plusieurs requêtes style/matériau
 *    (jamais le nom exact seul) ;
 * 3. SOPHENIC cherche les 5 MEILLEURS modèles Sketchfab et les propose ;
 * 4. l'utilisateur les VOIT en 3D interactive (caméra libre façon Blender)
 *    AVANT tout engagement ;
 * 5. il télécharge ceux qu'il veut — bibliothèque persistée sur le projet.
 *
 * Honnêteté : aucun asset inventé — les requêtes vides/échouées sont des gaps
 * explicites ; Sketchfab doit être configuré (token) sinon message clair.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, Check, Download, ExternalLink, FileText, Loader2, Paperclip, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArchitectureThinkingTimeline, type ArchitectureWorkStep } from "./architecture-thinking-timeline";
import { Model3DViewer, type Model3DViewerInfo } from "./model-3d-viewer";
import { resolveModel3DBrief } from "@/design/model-3d/model-brief";
import { searchModelGallery, type Model3DSearchFunction } from "@/design/model-3d/model-gallery";
import type { DesignProject } from "@/design/types";
import type { Model3DAsset, Model3DAttachment, Model3DCandidate, Model3DLibraryEntry } from "@/design/model-3d/types";

type Props = { project: DesignProject; onMutate: (mutator: (draft: DesignProject) => void, label: string) => void; onBack: () => void; effortMode?: "quick" | "auto" | "deep" };

const SUGGESTIONS = [
  "Un canapé scandinave en chêne clair",
  "Une lampe design en laiton brossé",
  "Un fauteuil en velours vert émeraude",
  "Une table basse sculpturale en marbre"
];

const baseSteps = (): ArchitectureWorkStep[] => [
  { id: "brief", label: "Analyse de la demande (Brain)", detail: "Le SOPHENIC Brain extrait l'objet, le style et les matériaux, puis expande en plusieurs requêtes de recherche.", status: "running" },
  { id: "search", label: "Recherche Sketchfab", detail: "Chaque requête expandue est exécutée (jamais le nom exact seul).", status: "queued" },
  { id: "gallery", label: "Galerie des 5 meilleurs", detail: "Classement intent-aware : objet, style, matériaux, qualité, licence.", status: "queued" },
  { id: "view", label: "Exploration 3D", detail: "Caméra libre façon Blender : orbite, déplacement, zoom vers le curseur.", status: "queued" },
  { id: "download", label: "Téléchargement", detail: "Les modèles choisis rejoignent la bibliothèque du projet.", status: "queued" }
];

function assetToViewerInfo(asset: Model3DAsset, cacheId: string): Model3DViewerInfo {
  return { cacheId, name: asset.name, author: asset.author, license: asset.license, faceCount: asset.faceCount, sourceUrl: asset.sourceUrl };
}
function entryToViewerInfo(entry: Model3DLibraryEntry): Model3DViewerInfo {
  return { cacheId: entry.cacheId, name: entry.name, author: entry.author, license: entry.license, sourceUrl: entry.sourceUrl };
}

export function Model3DWorkspace({ project, onMutate, onBack, effortMode = "auto" }: Props) {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  const [request, setRequest] = useState("");
  const [attachments, setAttachments] = useState<Model3DAttachment[]>([]);
  const attachmentInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [steps, setSteps] = useState<ArchitectureWorkStep[]>([]);
  const [viewing, setViewing] = useState<Model3DViewerInfo | null>(null);
  const [busyModelId, setBusyModelId] = useState("");
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [sketchfabReady, setSketchfabReady] = useState<boolean | null>(null);

  const state = project.model3d;
  const candidates: Model3DCandidate[] = state?.candidates || [];
  const library: Model3DLibraryEntry[] = state?.library || [];
  const gaps = state?.gaps || [];

  useEffect(() => {
    if (!desktop?.design?.assetStatus) return;
    void desktop.design.assetStatus(false)
      .then((result) => setSketchfabReady(Boolean(result.sketchfab.configured)))
      .catch(() => setSketchfabReady(false));
  }, [desktop]);

  useEffect(() => {
    setDownloadedIds(library.map((entry) => entry.sourceId));
  }, [library.length, project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStep = (id: string, status: ArchitectureWorkStep["status"], detail?: string) => {
    setSteps((rows) => rows.map((step) => step.id === id ? { ...step, status, ...(detail !== undefined ? { detail } : {}) } : step));
  };

  const readAttachmentFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: Model3DAttachment[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      if (file.size > 5 * 1024 * 1024) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      if (dataUrl) accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, mime: file.type || "", size: file.size, dataUrl });
    }
    setAttachments((current) => [...current, ...accepted].slice(0, 6));
  };

  const search = async () => {
    if (!desktop?.design?.searchAssets) { setError("La recherche Sketchfab nécessite l'application SOPHENIC (desktop)."); return; }
    const clean = request.trim();
    if (!clean) { setError("Décris le modèle 3D que tu cherches (objet, style, matériau…)."); return; }
    setBusy(true); setError(""); setProgress("Analyse de la demande via SOPHENIC Brain…");
    setSteps(baseSteps());
    setViewing(null);
    try {
      const brief = await resolveModel3DBrief({ request: clean, effortMode, attachments });
      updateStep("brief", "done", `${brief.objectTerms.slice(0, 3).join(", ") || "intention générale"} · ${brief.queries.length} requête(s) expandée(s)${brief.styleHints.length ? ` · style : ${brief.styleHints.slice(0, 3).join(", ")}` : ""}${brief.materialHints.length ? ` · matériaux : ${brief.materialHints.slice(0, 3).join(", ")}` : ""}${brief.origin === "brain" ? " · via SOPHENIC Brain" : " · analyse locale déterministe"}`);
      setProgress("Recherche Sketchfab multi-requêtes…");
      updateStep("search", "running");
      const searchFn: Model3DSearchFunction = (query, limit) => desktop.design!.searchAssets(query, limit) as Promise<Model3DAsset[]>;
      const gallery = await searchModelGallery(brief, searchFn);
      updateStep("search", "done", `${gallery.searchedQueries.length} requête(s) exécutée(s)${gallery.gaps.length ? ` · ${gallery.gaps.length} écart(s) enregistré(s)` : ""}`);
      if (gallery.candidates.length) {
        updateStep("gallery", "done", `top ${gallery.candidates.length} : ${gallery.candidates.map((candidate) => `${candidate.asset.name.slice(0, 24)} (${candidate.compatibility}%)`).join(" · ")}`);
        updateStep("view", "queued", "Explore chaque modèle en 3D avant de télécharger.");
        updateStep("download", "queued");
      } else {
        updateStep("gallery", "error", gallery.gaps[0]?.reason || "Aucun modèle compatible trouvé.");
      }
      onMutate((draft) => {
        draft.model3d = { ...(draft.model3d || { library: [] }), brief, candidates: gallery.candidates, gaps: gallery.gaps, searchedAt: new Date().toISOString() };
      }, `Recherche 3D : ${gallery.candidates.length} modèle(s) proposé(s)`);
      setProgress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recherche Sketchfab impossible.");
      updateStep("search", "error", cause instanceof Error ? cause.message : "Recherche impossible.");
    } finally {
      setBusy(false); setProgress("");
    }
  };

  /** Met le modèle en cache (idempotent) puis l'ouvre dans la visionneuse. */
  const viewIn3D = async (candidate: Model3DCandidate) => {
    if (!desktop?.design?.cacheAsset || busyModelId) return;
    setBusyModelId(candidate.asset.sourceId);
    setError("");
    try {
      const cached = await desktop.design.cacheAsset(candidate.asset) as { cacheId: string };
      setViewing(assetToViewerInfo(candidate.asset, cached.cacheId));
      updateStep("view", "running", `« ${candidate.asset.name} » en exploration — caméra libre.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modèle impossible à préparer.");
    } finally {
      setBusyModelId("");
    }
  };

  const viewLibraryEntry = (entry: Model3DLibraryEntry) => {
    setError("");
    setViewing(entryToViewerInfo(entry));
    updateStep("view", "running", `« ${entry.name} » (bibliothèque) en exploration.`);
  };

  /** Télécharge : cache + ajout à la bibliothèque persistée du projet. */
  const download = async (candidate: Model3DCandidate) => {
    if (!desktop?.design?.cacheAsset || busyModelId) return;
    setBusyModelId(candidate.asset.sourceId);
    setError("");
    try {
      const cached = await desktop.design.cacheAsset(candidate.asset) as { cacheId: string; format: "gltf" | "glb"; entryPath: string; license?: string };
      const entry: Model3DLibraryEntry = {
        sourceId: candidate.asset.sourceId,
        cacheId: cached.cacheId,
        name: candidate.asset.name,
        author: candidate.asset.author,
        license: cached.license || candidate.asset.license,
        sourceUrl: candidate.asset.sourceUrl,
        thumbnailUrl: candidate.asset.thumbnailUrl,
        format: cached.format,
        entryPath: cached.entryPath,
        addedAt: new Date().toISOString()
      };
      onMutate((draft) => {
        const current = draft.model3d || { library: [] };
        const library = current.library.some((row) => row.sourceId === entry.sourceId) ? current.library : [...current.library, entry];
        draft.model3d = { ...current, library };
      }, `Modèle 3D téléchargé : ${entry.name}`);
      setDownloadedIds((rows) => rows.includes(entry.sourceId) ? rows : [...rows, entry.sourceId]);
      updateStep("download", "done", `« ${entry.name} » ajouté à la bibliothèque (${library.length + 1} modèle(s)).`);
      setViewing(assetToViewerInfo(candidate.asset, entry.cacheId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Téléchargement impossible.");
    } finally {
      setBusyModelId("");
    }
  };

  const searchDisabled = busy || sketchfabReady === false;

  const header = useMemo(() => <div className="flex items-center gap-2">
    <button type="button" onClick={onBack} className="grid size-8 shrink-0 place-items-center rounded-xl border border-black/10 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:hover:text-zinc-200" title="Retour"><ArrowLeft className="size-3.5" /></button>
    <div className="min-w-0">
      <div className="flex items-center gap-2"><span className="truncate text-[12px] font-semibold">{project.name}</span><span className="hidden rounded-full bg-[#eee4d5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.14em] text-[#795b36] sm:inline dark:bg-white/10 dark:text-zinc-300">Design 3D</span></div>
      <div className="text-[8px] uppercase tracking-[.14em] text-zinc-400">✦ SOPHENIC AI · Model 3D Engine{library.length ? ` · bibliothèque : ${library.length} modèle(s)` : ""}{state?.searchedAt ? ` · dernière recherche : ${new Date(state.searchedAt).toLocaleDateString("fr-FR")}` : ""}</div>
    </div>
  </div>, [onBack, project.name, library.length, state?.searchedAt]);

  return <div className="flex h-full min-h-0 flex-col bg-[#fbf9f5] dark:bg-[#101010]">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[.07] px-3 py-2 dark:border-white/[.07]">{header}
      {sketchfabReady === false ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Sketchfab non configuré — Paramètres → 3D Assets</span> : null}
    </div>
    <div className="flex min-h-0 flex-1">
      {/* Colonne gauche : demande, pipeline, galerie, bibliothèque */}
      <aside className="flex w-[360px] max-w-[42vw] shrink-0 flex-col border-r border-black/[.07] bg-[#fbf9f5] dark:border-white/[.07] dark:bg-[#141414]">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="rounded-xl border border-[#b58a55] bg-[#f6ecdc] p-2.5 dark:border-white/10 dark:bg-white/10">
            <div className="flex items-center gap-1.5 text-[10px] font-bold"><Box className="size-3.5 text-[#8a6539]" />Sketchfab Model Intelligence</div>
            <p className="mt-1 text-[9px] leading-4 text-zinc-500">Décris l’objet que tu veux : SOPHENIC expande ton intention en plusieurs recherches style/matériau, trouve les <b>5 meilleurs modèles Sketchfab</b>, tu les explores en 3D (caméra libre façon Blender) puis tu télécharges ceux que tu veux.</p>
          </div>

          <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={3} disabled={busy} placeholder="Ex. Un canapé scandinave en chêne clair pour mon salon…" className="mt-3 w-full resize-none rounded-xl border border-black/10 bg-white p-2.5 text-[11px] leading-5 outline-none focus:border-[#c19a68] dark:border-white/10 dark:bg-white/[.04]" />
          {attachments.length ? <div className="mt-1.5 flex flex-wrap gap-1.5">{attachments.map((attachment) => <span key={attachment.id} className="group relative">{attachment.mime.startsWith("image/")
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <span className="relative block"><img src={attachment.dataUrl} alt={attachment.name} className="size-12 rounded-lg border border-black/10 object-cover" /><span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-black/45 px-1 text-[7px] text-white">{attachment.name}</span></span> : <span className="flex h-12 max-w-40 items-center gap-1 rounded-lg border border-black/10 bg-white/70 px-2 text-[9px] font-medium text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300"><FileText className="size-3 shrink-0" /><span className="truncate">{attachment.name}</span></span>}<button type="button" onClick={() => setAttachments((current) => current.filter((row) => row.id !== attachment.id))} className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-[#5f4a2e] text-white opacity-0 transition group-hover:opacity-100" title="Retirer"><X className="size-2.5" /></button></span>)}</div> : null}
          <div className="mt-1.5 flex items-center gap-2">
            <input ref={attachmentInput} type="file" multiple accept="image/*,.pdf,.txt,.md,.json" className="hidden" onChange={(event) => { void readAttachmentFiles(event.target.files); }} />
            <button type="button" onClick={() => attachmentInput.current?.click()} disabled={busy || attachments.length >= 6} className="flex h-8 items-center gap-1 rounded-xl border border-black/10 px-2.5 text-[10px] font-medium text-zinc-600 hover:border-[#c6a477] disabled:opacity-35 dark:border-white/10 dark:text-zinc-300" title="Joindre des images de référence de l'objet (analysées par le Brain)"><Paperclip className="size-3.5" />Références</button>
            <button type="button" disabled={searchDisabled || !request.trim()} onClick={() => void search()} className="flex h-8 items-center gap-1.5 rounded-xl bg-[#7f5d36] px-3 text-[10px] font-semibold text-white disabled:opacity-35">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}Trouver mes modèles</button>
            {state?.brief && !busy && <span className="text-[8px] text-zinc-400">{state.brief.objectTerms.slice(0, 2).join(" · ") || "intention générale"}</span>}
          </div>
          {!state?.brief && !busy ? <div className="mt-2 space-y-1.5">{SUGGESTIONS.map((text) => <button key={text} type="button" onClick={() => setRequest(text)} className="w-full rounded-xl border border-black/[.06] bg-white/55 p-2 text-left text-[9px] leading-4 text-zinc-500 hover:border-[#c6a477] dark:border-white/[.07] dark:bg-white/[.025]">{text}</button>)}</div> : null}

          {(steps.length > 0 || progress) && <div className="mt-3"><ArchitectureThinkingTimeline steps={steps} />{progress ? <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#8a6539]"><Loader2 className="size-3 animate-spin" />{progress}</div> : null}</div>}
          {error ? <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[9px] leading-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"><span className="flex-1">{error}</span><button type="button" onClick={() => setError("")}><X className="size-3" /></button></div> : null}

          {/* Galerie : les 5 meilleurs modèles */}
          {candidates.length ? <div className="mt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Sparkles className="size-3" />Les 5 meilleurs modèles Sketchfab</div>
            <div className="space-y-2">
              {candidates.map((candidate) => {
                const isViewing = viewing?.cacheId === candidate.asset.sourceId;
                const isDownloaded = downloadedIds.includes(candidate.asset.sourceId);
                const isBusy = busyModelId === candidate.asset.sourceId;
                return <div key={candidate.asset.sourceId} className={cn("rounded-xl border p-2.5", isViewing ? "border-[#b58a55] bg-[#f6ecdc] dark:bg-white/10" : "border-black/10 bg-white dark:border-white/10 dark:bg-white/[.03]")}>
                  <div className="flex gap-2">
                    {candidate.asset.thumbnailUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={candidate.asset.thumbnailUrl} alt={candidate.asset.name} className="size-14 shrink-0 rounded-lg border border-black/10 object-cover" /> : <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-black/5 dark:bg-white/10"><Box className="size-5 text-zinc-400" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="line-clamp-2 text-[10.5px] font-semibold leading-4">{candidate.asset.name}</span>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{candidate.compatibility}%</span>
                      </div>
                      <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[.14em] text-[#8a6539] dark:text-zinc-400">✦ SOPHENIC AI · {candidate.asset.license || "licence à vérifier"}</div>
                      <div className="mt-0.5 truncate text-[8.5px] text-zinc-500">{candidate.asset.author || "Auteur inconnu"}{candidate.asset.faceCount ? ` · ${candidate.asset.faceCount.toLocaleString("fr-FR")} faces` : ""}{candidate.asset.staffPicked ? " · Staff Pick" : ""}</div>
                      <div className="mt-0.5 line-clamp-2 text-[8.5px] leading-4 text-zinc-400">{candidate.reasons.join(" · ")}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button type="button" disabled={busy || isBusy || !candidate.asset.downloadable} onClick={() => void viewIn3D(candidate)} className={cn("flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] font-bold", isViewing ? "bg-[#7f5d36] text-white" : "bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300")}>{isBusy ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}{isViewing ? "En exploration" : "Voir en 3D"}</button>
                    <button type="button" disabled={busy || isBusy || isDownloaded || !candidate.asset.downloadable} onClick={() => void download(candidate)} className="flex h-7 items-center gap-1 rounded-lg bg-[#7f5d36] px-2.5 text-[9px] font-bold text-white hover:bg-[#6d4e2c] disabled:opacity-35">{isBusy ? <Loader2 className="size-3 animate-spin" /> : isDownloaded ? <Check className="size-3" /> : <Download className="size-3" />}{isDownloaded ? "Dans ma bibliothèque" : "Télécharger"}</button>
                    <a href={candidate.asset.sourceUrl} target="_blank" rel="noreferrer" className="grid size-7 place-items-center rounded-lg bg-black/5 text-zinc-500 hover:text-zinc-800 dark:bg-white/10" title="Voir la source Sketchfab"><ExternalLink className="size-3" /></a>
                  </div>
                </div>;
              })}
            </div>
          </div> : null}

          {/* Écarts honnêtes (aucun asset inventé) */}
          {gaps.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="text-[8px] font-bold uppercase tracking-[.14em] text-amber-700 dark:text-amber-300">Écarts enregistrés — honnêteté SOPHENIC</div>
            <ul className="mt-1 space-y-1">{gaps.slice(0, 4).map((gap, index) => <li key={index} className="text-[8.5px] leading-4 text-amber-800 dark:text-amber-200"><b>{gap.query}</b> — {gap.reason}</li>)}</ul>
          </div> : null}

          {/* Bibliothèque : modèles téléchargés */}
          {library.length ? <div className="mt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539]"><Download className="size-3" />Ma bibliothèque ({library.length})</div>
            <div className="space-y-1.5">
              {library.map((entry) => <div key={entry.sourceId} className="flex items-center gap-2 rounded-xl border border-black/[.07] bg-white/70 p-2 dark:border-white/[.07] dark:bg-white/[.03]">
                {entry.thumbnailUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={entry.thumbnailUrl} alt={entry.name} className="size-9 shrink-0 rounded-lg border border-black/10 object-cover" /> : <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-black/5 dark:bg-white/10"><Box className="size-3.5 text-zinc-400" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[9.5px] font-semibold">{entry.name}</div>
                  <div className="truncate text-[8px] text-zinc-500">{entry.author || "Auteur inconnu"} · {entry.license || "licence ?"} · {entry.format.toUpperCase()}</div>
                </div>
                <button type="button" onClick={() => viewLibraryEntry(entry)} className="grid size-7 place-items-center rounded-lg bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300" title="Explorer en 3D"><RotateCcw className="size-3" /></button>
              </div>)}
            </div>
          </div> : null}
        </div>
      </aside>

      {/* Colonne droite : visionneuse 3D interactive */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2.5">
        <Model3DViewer model={viewing} />
      </div>
    </div>
  </div>;
}
