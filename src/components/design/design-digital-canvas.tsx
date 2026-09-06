"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Monitor, Smartphone, Tablet, Plus } from "lucide-react";
import type { DesignDigitalNode, DesignProject } from "@/design/types";
import { cn } from "@/lib/utils";

type Props = { project: DesignProject; selectedId: string; onSelectedId: (id: string) => void; onChange: (project: DesignProject, summary?: string) => void };
const uid = () => `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const previewAnimation = (animation: DesignDigitalNode["animation"]) => animation === "fade" ? "sophenic-design-fade .5s ease both" : animation === "slide" ? "sophenic-design-slide .55s cubic-bezier(.2,.8,.2,1) both" : animation === "scale" ? "sophenic-design-scale .45s ease both" : undefined;

export function DesignDigitalCanvas({ project, selectedId, onSelectedId, onChange }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; startX: number; startY: number } | null>(null);
  const spec = project.digital;
  const viewport = useMemo(() => spec.breakpoint === "desktop" ? { width: 1440, label: "Desktop", Icon: Monitor } : spec.breakpoint === "tablet" ? { width: 820, label: "Tablet", Icon: Tablet } : { width: 390, label: "Mobile", Icon: Smartphone }, [spec.breakpoint]);
  const scale = viewport.width === 1440 ? 0.58 : viewport.width === 820 ? 0.78 : 1;

  const setBreakpoint = (breakpoint: DesignProject["digital"]["breakpoint"]) => { const next = structuredClone(project); next.digital.breakpoint = breakpoint; onChange(next, `Breakpoint ${breakpoint}`); };
  const addNode = (kind: DesignDigitalNode["kind"]) => {
    const next = structuredClone(project); const index = next.digital.nodes.length;
    next.digital.nodes.push({ id: uid(), kind, label: kind === "card" ? "Nouvelle carte" : kind === "button" ? "CTA" : kind === "form" ? "Formulaire" : kind, x: 48 + (index % 2) * 480, y: 160 + Math.floor(index / 2) * 190, width: kind === "hero" ? 1100 : kind === "navbar" ? 1320 : 420, height: kind === "navbar" ? 72 : kind === "button" ? 56 : kind === "hero" ? 300 : 150, text: kind === "button" ? "Commencer" : `Nouveau ${kind}`, background: kind === "button" ? next.digital.designSystem.primary : "#ffffff", foreground: kind === "button" ? "#ffffff" : next.digital.designSystem.text, radius: next.digital.designSystem.radius, animation: kind === "navbar" ? "none" : "fade" });
    onSelectedId(next.digital.nodes[next.digital.nodes.length - 1].id); onChange(next, "Composant UI ajouté");
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return; const dx = (event.clientX - drag.startX) / scale, dy = (event.clientY - drag.startY) / scale;
    const next = structuredClone(project); const node = next.digital.nodes.find((item) => item.id === drag.id); if (!node) return;
    node.x = Math.max(0, drag.x + dx); node.y = Math.max(0, drag.y + dy); onChange(next);
  };

  return <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#ecebe8] dark:border-white/10 dark:bg-[#111214]">
    <style>{`@keyframes sophenic-design-fade{from{opacity:0}to{opacity:1}}@keyframes sophenic-design-slide{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes sophenic-design-scale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
    <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-white/80 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-zinc-900/80">
      <div className="flex rounded-lg bg-black/[0.04] p-1 dark:bg-white/[0.06]">{(["desktop", "tablet", "mobile"] as const).map((item) => { const Icon = item === "desktop" ? Monitor : item === "tablet" ? Tablet : Smartphone; return <button key={item} onClick={() => setBreakpoint(item)} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold", spec.breakpoint === item ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500")}><Icon className="size-3.5" />{item}</button>; })}</div>
      <div className="h-5 w-px bg-black/10 dark:bg-white/10" />
      {(["navbar", "hero", "card", "button", "form", "chart"] as DesignDigitalNode["kind"][]).map((kind) => <button key={kind} onClick={() => addNode(kind)} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10"><Plus className="size-3" />{kind}</button>)}
      <div className="ml-auto text-[10px] text-zinc-400">{viewport.label} · {viewport.width}px</div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mx-auto origin-top rounded-[28px] border border-black/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.12)]" style={{ width: viewport.width * scale, minHeight: spec.canvasHeight * scale }}>
        <div ref={canvasRef} className="relative overflow-hidden rounded-[28px]" style={{ width: viewport.width, minHeight: spec.canvasHeight, transform: `scale(${scale})`, transformOrigin: "top left", background: spec.designSystem.surface }} onPointerMove={move} onPointerUp={() => setDrag(null)}>
          {spec.nodes.map((node) => <div key={node.id} onPointerDown={(event) => { event.stopPropagation(); onSelectedId(node.id); setDrag({ id: node.id, x: node.x, y: node.y, startX: event.clientX, startY: event.clientY }); event.currentTarget.setPointerCapture(event.pointerId); }} className={cn("absolute flex select-none overflow-hidden border text-left shadow-sm transition-shadow", selectedId === node.id ? "ring-4 ring-[#a67332]/30" : "hover:shadow-md")} style={{ left: node.x, top: node.y, width: node.width, height: node.height, background: node.background || "#fff", color: node.foreground || spec.designSystem.text, borderColor: selectedId === node.id ? spec.designSystem.primary : "rgba(0,0,0,.08)", borderRadius: node.radius ?? spec.designSystem.radius, padding: Math.max(12, spec.designSystem.spacing), animation: previewAnimation(node.animation) }}>
            {node.kind === "navbar" ? <div className="flex w-full items-center gap-8"><strong>{project.name}</strong><span className="ml-auto text-sm opacity-60">Produit</span><span className="text-sm opacity-60">Solutions</span><span className="text-sm opacity-60">Contact</span></div> : node.kind === "hero" ? <div className="m-auto max-w-[80%] text-center"><div className="text-6xl font-semibold leading-[1.02] tracking-[-.05em]">{node.text}</div><div className="mx-auto mt-7 h-12 w-40 rounded-full" style={{ background: spec.designSystem.primary }} /></div> : node.kind === "chart" ? <div className="flex w-full flex-col"><strong>{node.label}</strong><div className="mt-auto flex h-20 items-end gap-3">{[42, 65, 52, 84, 72, 91].map((value, i) => <span key={i} className="flex-1 rounded-t" style={{ height: `${value}%`, background: spec.designSystem.primary, opacity: .35 + i * .08 }} />)}</div></div> : node.kind === "form" ? <div className="w-full"><strong>{node.label}</strong><div className="mt-5 h-12 rounded-xl border border-black/10 bg-black/[.025]" /><div className="mt-3 h-12 rounded-xl border border-black/10 bg-black/[.025]" /></div> : <div><div className={node.kind === "button" ? "font-semibold" : "text-xl font-semibold"}>{node.text || node.label}</div>{node.kind === "card" && <p className="mt-3 max-w-sm text-sm opacity-55">Composant réutilisable du design system SOPHENIC.</p>}</div>}
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}
