"use client";

import { useEffect, useMemo, useState } from "react";
import { Code2, Crosshair, Monitor, RefreshCw, Smartphone, Tablet, TriangleAlert } from "lucide-react";
import { buildWebPreview, webProjectFramework } from "@/design/web-workspace";
import type { DesignProject } from "@/design/types";
import { cn } from "@/lib/utils";

export type WebPreviewSelection = { selector: string; tag: string; text: string; id?: string; className?: string } | null;

type Props = {
  project: DesignProject;
  inspectMode: boolean;
  onInspectMode: (value: boolean) => void;
  onSelection: (selection: WebPreviewSelection) => void;
  onViewport: (viewport: "desktop" | "tablet" | "mobile") => void;
};

const viewportWidth = { desktop: "100%", tablet: "820px", mobile: "390px" } as const;

export function DesignWebPreview({ project, inspectMode, onInspectMode, onSelection, onViewport }: Props) {
  const [reloadKey, setReloadKey] = useState(0);
  const [runtimeError, setRuntimeError] = useState("");
  const workspace = project.webWorkspace;
  const viewport = workspace?.viewport || "desktop";
  const build = useMemo(() => buildWebPreview(structuredClone(project), inspectMode), [inspectMode, project, reloadKey]);
  const framework = useMemo(() => webProjectFramework(workspace?.files || []), [workspace?.files]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const payload = event.data as { channel?: string; projectId?: string; type?: string; element?: WebPreviewSelection; message?: string };
      if (!payload || payload.channel !== "sophenic-design-preview" || payload.projectId !== project.id) return;
      if (payload.type === "selection" && payload.element) onSelection(payload.element);
      if (payload.type === "runtime-error") setRuntimeError(String(payload.message || "Erreur JavaScript dans la prévisualisation."));
      if (payload.type === "ready") setRuntimeError("");
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onSelection, project.id]);

  if (!workspace?.files.length) {
    return <div className="grid h-full min-h-[520px] place-items-center rounded-2xl border border-dashed border-black/15 bg-white/55 p-10 text-center dark:border-white/15 dark:bg-white/[.02]">
      <div className="max-w-md">
        <Code2 className="mx-auto size-9 text-[#9b7445]" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Importe ton site pour commencer</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">SOPHENIC lit les fichiers du projet. Un site HTML/CSS/JS statique s’affiche directement ici. Les sources React/Next sont analysées par l’IA ; leur exécution live nécessite ensuite leur runtime de build.</p>
      </div>
    </div>;
  }

  if (!build.html) {
    return <div className="grid h-full min-h-[520px] place-items-center rounded-2xl border border-black/10 bg-white/70 p-10 text-center dark:border-white/10 dark:bg-zinc-950">
      <div className="max-w-lg"><TriangleAlert className="mx-auto size-8 text-amber-600" /><h3 className="mt-4 font-semibold">Projet lu · preview statique non disponible</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{framework}. Aucun `index.html` exploitable n’a été trouvé. Les fichiers restent disponibles à Sophenic pour analyse et modification.</p></div>
    </div>;
  }

  return <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#deddd9] shadow-inner dark:border-white/10 dark:bg-[#141414]">
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-black/10 bg-white/92 px-2.5 dark:border-white/10 dark:bg-zinc-900/95">
      <div className="flex items-center gap-1 rounded-lg bg-black/[.035] p-1 dark:bg-white/[.06]">
        {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([id, Icon]) => <button key={id} type="button" onClick={() => onViewport(id)} className={cn("grid size-7 place-items-center rounded-md", viewport === id ? "bg-white text-[#8b6333] shadow-sm dark:bg-white/10" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200")} title={id}><Icon className="size-3.5" /></button>)}
      </div>
      <div className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-zinc-400">{framework} · {build.entryPath}</div>
      <button type="button" onClick={() => onInspectMode(!inspectMode)} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold", inspectMode ? "bg-[#87633a] text-white" : "text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10")}><Crosshair className="size-3.5" />Inspecter</button>
      <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10" title="Recharger"><RefreshCw className="size-3.5" /></button>
    </div>
    <div className="relative flex min-h-0 flex-1 justify-center overflow-auto p-3 sm:p-5">
      <div className="h-full min-h-[470px] overflow-hidden rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,.16)] transition-[width] duration-300" style={{ width: viewportWidth[viewport], maxWidth: "100%" }}>
        <iframe key={`${reloadKey}-${inspectMode}`} title="SOPHENIC Design — aperçu du site" srcDoc={build.html} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="h-full w-full border-0 bg-white" />
      </div>
      {(runtimeError || build.warnings.length > 0) && <div className="absolute bottom-5 left-5 right-5 mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-[10px] leading-5 text-amber-800 shadow-lg backdrop-blur dark:border-amber-400/20 dark:bg-amber-950/90 dark:text-amber-200">{runtimeError || build.warnings[0]}</div>}
    </div>
  </div>;
}
