"use client";

import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ArchitectureWorkStatus = "queued" | "running" | "done" | "error";
export type ArchitectureWorkStep = { id: string; label: string; detail?: string; status: ArchitectureWorkStatus };

export function ArchitectureThinkingTimeline({ steps }: { steps: ArchitectureWorkStep[] }) {
  if (!steps.length) return null;
  return <div className="mb-4 rounded-2xl border border-[#dfd2bd] bg-[#f8f2e8] p-3 dark:border-white/[.08] dark:bg-white/[.035]">
    <div className="mb-2 text-[8px] font-bold uppercase tracking-[.18em] text-[#8a6539] dark:text-zinc-400">RÉFLÉCHIT · PLAN D’ACTION</div>
    <div className="space-y-0">
      {steps.map((step, index) => <div key={step.id} className="relative flex min-h-11 gap-2.5">
        {index < steps.length - 1 && <span className={cn("absolute left-[9px] top-[21px] h-[calc(100%-4px)] w-px", step.status === "done" ? "bg-emerald-400" : "bg-[#d8c8ae] dark:bg-white/10")} />}
        <span className={cn("relative z-10 mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border",
          step.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : step.status === "running" ? "border-[#a77a42] bg-white text-[#8b6539] dark:bg-zinc-900" : step.status === "error" ? "border-red-500 bg-red-500 text-white" : "border-[#d5c4a8] bg-[#fbf7f1] text-zinc-400 dark:border-white/15 dark:bg-zinc-900") }>
          {step.status === "running" ? <Loader2 className="size-3 animate-spin" /> : step.status === "done" ? <Check className="size-3" /> : step.status === "error" ? <X className="size-3" /> : <span className="size-1.5 rounded-full bg-current opacity-60" />}
        </span>
        <div className="min-w-0 pb-2.5">
          <div className={cn("text-[9.5px] font-semibold", step.status === "running" ? "text-[#6f4f2d] dark:text-zinc-100" : step.status === "done" ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400")}>{step.label}</div>
          {step.detail && <div className="mt-0.5 text-[8px] leading-3.5 text-zinc-400">{step.detail}</div>}
        </div>
      </div>)}
    </div>
  </div>;
}
