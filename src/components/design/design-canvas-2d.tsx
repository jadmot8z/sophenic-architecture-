"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { DesignAnnotation, DesignObject, DesignOpening, DesignProject, DesignRoom, DesignTool, DesignWall } from "@/design/types";
import { rebuildArchitectureStructure } from "@/design/architecture";

export type DesignSelection = { kind: "wall" | "room" | "opening" | "object" | "annotation"; id: string } | null;

type Props = {
  project: DesignProject;
  tool: DesignTool;
  selection: DesignSelection;
  onSelection: (selection: DesignSelection) => void;
  onChange: (project: DesignProject, summary?: string) => void;
};

type Draft = { start: { x: number; y: number }; current: { x: number; y: number } } | null;
type Drag = { selection: Exclude<DesignSelection, null>; startPointer: { x: number; y: number }; startValue: { x: number; y: number } } | null;

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const snap = (value: number, grid: number) => Math.round(value / grid) * grid;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function snappedOpening(project: DesignProject, point: { x: number; y: number }, kind: "door" | "window"): DesignOpening | null {
  let best: { wall: DesignWall; x: number; y: number; distance: number; angle: number } | null = null;
  for (const wall of project.plan.walls) {
    const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y; const length2 = dx * dx + dy * dy; if (length2 < 1e-6) continue;
    const t = clamp(((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / length2, 0, 1);
    const x = wall.start.x + dx * t, y = wall.start.y + dy * t; const distance = Math.hypot(point.x - x, point.y - y);
    if (!best || distance < best.distance) best = { wall, x, y, distance, angle: Math.atan2(dy, dx) };
  }
  if (!best) return null;
  return { id: uid("opening"), kind, wallId: best.wall.id, position: { x: best.x, y: best.y }, width: kind === "door" ? .9 : 1.5, height: kind === "door" ? 2.1 : 1.25, sill: kind === "window" ? .9 : 0, rotation: best.angle };
}


export function DesignCanvas2D({ project, tool, selection, onSelection, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const width = project.plan.width;
  const height = project.plan.height;
  const grid = Math.max(0.1, project.plan.gridSize);
  const materialMap = useMemo(() => new Map(project.materials.map((material) => [material.id, material])), [project.materials]);

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement | SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width) * width, 0, width),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height) * height, 0, height)
    };
  };

  const commitDraft = (endPoint: { x: number; y: number }) => {
    if (!draft) return;
    const start = { x: snap(draft.start.x, grid), y: snap(draft.start.y, grid) };
    const end = { x: snap(endPoint.x, grid), y: snap(endPoint.y, grid) };
    const next = structuredClone(project);
    if (tool === "wall" && Math.hypot(end.x - start.x, end.y - start.y) >= grid) {
      const wall: DesignWall = { id: uid("wall"), start, end, thickness: 0.16, height: project.plan.wallHeight, materialId: "mat-wall" };
      next.plan.walls.push(wall); onSelection({ kind: "wall", id: wall.id }); onChange(next, "Mur ajouté");
    } else if (tool === "room" && Math.abs(end.x - start.x) >= 1 && Math.abs(end.y - start.y) >= 1) {
      const room: DesignRoom = { id: uid("room"), name: `Pièce ${next.plan.rooms.length + 1}`, usage: "multi-purpose", x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y), floorMaterialId: "mat-oak", ceilingHeight: next.plan.wallHeight, color: "#f1ece3" };
      next.plan.rooms.push(room); const structural = project.domain === "architecture" ? rebuildArchitectureStructure(next) : next; onSelection({ kind: "room", id: room.id }); onChange(structural, "Pièce ajoutée");
    } else if (tool === "dimension" && Math.hypot(end.x - start.x, end.y - start.y) >= grid) {
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const annotation: DesignAnnotation = { id: uid("dim"), kind: "dimension", text: `${length.toFixed(2)} m`, x: start.x, y: start.y, x2: end.x, y2: end.y };
      next.plan.annotations.push(annotation); onSelection({ kind: "annotation", id: annotation.id }); onChange(next, "Cote ajoutée");
    }
    setDraft(null);
  };

  const addPointElement = (point: { x: number; y: number }) => {
    const next = structuredClone(project);
    if (tool === "door" || tool === "window") {
      const opening = snappedOpening(next, { x: snap(point.x, grid), y: snap(point.y, grid) }, tool);
      if (!opening) return; next.plan.openings.push(opening); onSelection({ kind: "opening", id: opening.id }); onChange(next, `${tool === "door" ? "Porte" : "Fenêtre"} ajoutée`);
    } else if (tool === "furniture" || tool === "stairs") {
      const stairs = tool === "stairs";
      const object: DesignObject = { id: uid("obj"), name: stairs ? "Escalier" : "Mobilier", category: stairs ? "stairs" : "furniture", x: snap(point.x, grid), y: snap(point.y, grid), width: stairs ? 2.8 : 1.2, depth: stairs ? 1.1 : 0.7, height: stairs ? project.plan.wallHeight : 0.78, rotation: 0, materialId: stairs ? "mat-oak" : "mat-fabric", color: stairs ? "#c8b18f" : "#bda989" };
      next.plan.objects.push(object); onSelection({ kind: "object", id: object.id }); onChange(next, stairs ? "Escalier ajouté" : "Mobilier ajouté");
    } else if (tool === "annotation") {
      const annotation: DesignAnnotation = { id: uid("note"), kind: "note", text: "Annotation", x: snap(point.x, grid), y: snap(point.y, grid) };
      next.plan.annotations.push(annotation); onSelection({ kind: "annotation", id: annotation.id }); onChange(next, "Annotation ajoutée");
    }
  };

  const beginCanvas = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if (tool === "select") { onSelection(null); return; }
    const point = pointFromEvent(event);
    if (tool === "wall" || tool === "room" || tool === "dimension") { setDraft({ start: point, current: point }); event.currentTarget.setPointerCapture(event.pointerId); }
    else if (tool !== "pan") addPointElement(point);
  };

  const startDrag = (event: ReactPointerEvent<SVGElement>, target: Exclude<DesignSelection, null>, startValue: { x: number; y: number }) => {
    event.stopPropagation(); onSelection(target);
    if (tool !== "select") return;
    setDrag({ selection: target, startPointer: pointFromEvent(event), startValue });
    (event.currentTarget as SVGElement).setPointerCapture?.(event.pointerId);
  };

  const applyDrag = (point: { x: number; y: number }) => {
    if (!drag) return;
    const dx = point.x - drag.startPointer.x; const dy = point.y - drag.startPointer.y;
    const next = structuredClone(project);
    const value = { x: snap(drag.startValue.x + dx, grid), y: snap(drag.startValue.y + dy, grid) };
    if (drag.selection.kind === "room") { const item = next.plan.rooms.find((row) => row.id === drag.selection.id); if (item) { item.x = clamp(value.x, 0, width - item.width); item.y = clamp(value.y, 0, height - item.height); } }
    if (drag.selection.kind === "object") { const item = next.plan.objects.find((row) => row.id === drag.selection.id); if (item) { item.x = clamp(value.x, 0, width - item.width); item.y = clamp(value.y, 0, height - item.depth); } }
    if (drag.selection.kind === "opening") { const item = next.plan.openings.find((row) => row.id === drag.selection.id); if (item) { const snapped = snappedOpening(next, value, item.kind); if (snapped) { item.position = snapped.position; item.wallId = snapped.wallId; item.rotation = snapped.rotation; } } }
    if (drag.selection.kind === "annotation") { const item = next.plan.annotations.find((row) => row.id === drag.selection.id); if (item) { const offsetX = value.x - item.x; const offsetY = value.y - item.y; item.x = value.x; item.y = value.y; if (typeof item.x2 === "number") item.x2 += offsetX; if (typeof item.y2 === "number") item.y2 += offsetY; } }
    const changed = project.domain === "architecture" && drag.selection.kind === "room" ? rebuildArchitectureStructure(next) : next;
    onChange(changed);
  };

  return <div className="relative h-full min-h-[480px] overflow-hidden rounded-2xl border border-black/10 bg-[#f8f7f3] shadow-inner dark:border-white/10 dark:bg-[#151515]">
    <div className="absolute left-3 top-3 z-10 rounded-lg border border-black/10 bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/90">Plan {width.toFixed(1)} × {height.toFixed(1)} m · grille {grid.toFixed(2)} m</div>
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className={cn("h-full w-full touch-none", tool === "select" ? "cursor-default" : tool === "pan" ? "cursor-grab" : "cursor-crosshair")} onPointerDown={beginCanvas} onPointerMove={(event) => { const point = pointFromEvent(event); if (draft) setDraft({ ...draft, current: point }); if (drag) applyDrag(point); }} onPointerUp={(event) => { if (draft) commitDraft(pointFromEvent(event)); if (drag) setDrag(null); }}>
      <defs>
        <pattern id="design-small-grid" width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="currentColor" strokeWidth="0.012" opacity="0.11" /></pattern>
        <pattern id="design-grid" width={grid * 10} height={grid * 10} patternUnits="userSpaceOnUse"><rect width={grid * 10} height={grid * 10} fill="url(#design-small-grid)" /><path d={`M ${grid * 10} 0 L 0 0 0 ${grid * 10}`} fill="none" stroke="currentColor" strokeWidth="0.025" opacity="0.13" /></pattern>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="url(#design-grid)" className="text-zinc-500" />
      {project.plan.rooms.map((room) => {
        const material = materialMap.get(room.floorMaterialId || ""); const active = selection?.kind === "room" && selection.id === room.id;
        return <g key={room.id} onPointerDown={(event) => startDrag(event, { kind: "room", id: room.id }, { x: room.x, y: room.y })}>
          <rect x={room.x} y={room.y} width={room.width} height={room.height} rx="0.06" fill={room.color || material?.color || "#eee9df"} fillOpacity={active ? 0.9 : 0.64} stroke={active ? "#a56f26" : "#ad9f8a"} strokeWidth={active ? 0.07 : 0.025} strokeDasharray={active ? "0.15 0.08" : undefined} />
          <text x={room.x + 0.15} y={room.y + 0.34} fontSize="0.22" fill="#4a4237" fontWeight="600">{room.name}</text>
          <text x={room.x + 0.15} y={room.y + 0.62} fontSize="0.16" fill="#7b7164">{(room.width * room.height).toFixed(1)} m²</text>
        </g>;
      })}
      {project.plan.walls.map((wall) => {
        const active = selection?.kind === "wall" && selection.id === wall.id;
        return <line key={wall.id} x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} stroke={active ? "#a56f26" : "#4e4a44"} strokeWidth={Math.max(0.09, wall.thickness)} strokeLinecap="square" onPointerDown={(event) => { event.stopPropagation(); onSelection({ kind: "wall", id: wall.id }); }} />;
      })}
      {project.plan.openings.map((opening) => {
        const active = selection?.kind === "opening" && selection.id === opening.id;
        if (opening.kind === "window") return <g key={opening.id} transform={`translate(${opening.position.x} ${opening.position.y}) rotate(${(opening.rotation || 0) * 180 / Math.PI})`} onPointerDown={(event) => startDrag(event, { kind: "opening", id: opening.id }, opening.position)}><line x1={-opening.width / 2} y1="0" x2={opening.width / 2} y2="0" stroke={active ? "#a56f26" : "#4b9eb1"} strokeWidth="0.12" /><line x1={-opening.width / 2} y1="0.08" x2={opening.width / 2} y2="0.08" stroke="#9cd0db" strokeWidth="0.035" /></g>;
        return <g key={opening.id} transform={`translate(${opening.position.x} ${opening.position.y}) rotate(${(opening.rotation || 0) * 180 / Math.PI})`} onPointerDown={(event) => startDrag(event, { kind: "opening", id: opening.id }, opening.position)}><line x1="0" y1="0" x2={opening.width} y2="0" stroke={active ? "#a56f26" : "#72583b"} strokeWidth="0.07" /><path d={`M 0 0 A ${opening.width} ${opening.width} 0 0 1 ${opening.width} ${-opening.width}`} fill="none" stroke="#9a866c" strokeWidth="0.025" strokeDasharray="0.08 0.04" /></g>;
      })}
      {project.plan.objects.map((object) => {
        const active = selection?.kind === "object" && selection.id === object.id;
        return <g key={object.id} transform={`translate(${object.x} ${object.y}) rotate(${object.rotation} ${object.width / 2} ${object.depth / 2})`} onPointerDown={(event) => startDrag(event, { kind: "object", id: object.id }, { x: object.x, y: object.y })}>
          <rect x="0" y="0" width={object.width} height={object.depth} rx="0.08" fill={object.color || materialMap.get(object.materialId || "")?.color || "#baa789"} stroke={active ? "#a56f26" : "#776b5a"} strokeWidth={active ? 0.06 : 0.025} />
          {object.category === "stairs" && Array.from({ length: 8 }, (_, index) => <line key={index} x1={object.width * (index + 1) / 9} y1="0" x2={object.width * (index + 1) / 9} y2={object.depth} stroke="#665746" strokeWidth="0.025" opacity="0.6" />)}
          <text x={object.width / 2} y={object.depth / 2 + 0.07} textAnchor="middle" fontSize="0.16" fill="#4f473c">{object.name}</text>
        </g>;
      })}
      {project.plan.annotations.map((annotation) => {
        const active = selection?.kind === "annotation" && selection.id === annotation.id;
        if (annotation.kind === "dimension" && typeof annotation.x2 === "number" && typeof annotation.y2 === "number") return <g key={annotation.id} onPointerDown={(event) => startDrag(event, { kind: "annotation", id: annotation.id }, { x: annotation.x, y: annotation.y })}><line x1={annotation.x} y1={annotation.y} x2={annotation.x2} y2={annotation.y2} stroke={active ? "#a56f26" : "#6c8191"} strokeWidth="0.035" strokeDasharray="0.12 0.05" /><text x={(annotation.x + annotation.x2) / 2} y={(annotation.y + annotation.y2) / 2 - 0.12} textAnchor="middle" fontSize="0.17" fill="#536473">{annotation.text}</text></g>;
        return <g key={annotation.id} onPointerDown={(event) => startDrag(event, { kind: "annotation", id: annotation.id }, { x: annotation.x, y: annotation.y })}><circle cx={annotation.x} cy={annotation.y} r="0.13" fill={active ? "#a56f26" : "#715d45"} /><text x={annotation.x + 0.18} y={annotation.y + 0.06} fontSize="0.17" fill="#594b3b">{annotation.text}</text></g>;
      })}
      {draft && <>{tool === "room" ? <rect x={Math.min(draft.start.x, draft.current.x)} y={Math.min(draft.start.y, draft.current.y)} width={Math.abs(draft.current.x - draft.start.x)} height={Math.abs(draft.current.y - draft.start.y)} fill="#d5b785" fillOpacity="0.18" stroke="#a56f26" strokeWidth="0.04" strokeDasharray="0.14 0.07" /> : <line x1={draft.start.x} y1={draft.start.y} x2={draft.current.x} y2={draft.current.y} stroke="#a56f26" strokeWidth={tool === "wall" ? 0.12 : 0.035} strokeDasharray={tool === "dimension" ? "0.12 0.06" : undefined} />}</>}
    </svg>
  </div>;
}
