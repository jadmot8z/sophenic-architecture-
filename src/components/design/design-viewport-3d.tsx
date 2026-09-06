"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Lightbulb, Rotate3D, Sun, ZoomIn, ZoomOut } from "lucide-react";
import type { DesignMaterial, DesignProject } from "@/design/types";
import { cn } from "@/lib/utils";

export type Design3DSelection = { kind: "object" | "wall" | "room"; id: string } | null;

type Props = {
  project: DesignProject;
  selection: Design3DSelection;
  onSelection: (selection: Design3DSelection) => void;
  onChange: (project: DesignProject, summary?: string) => void;
  initialMode?: "orbit" | "visit";
};

type Vec3 = { x: number; y: number; z: number };
type Face = { points: Vec3[]; color: string; stroke: string; alpha: number; depth?: number; selection?: Exclude<Design3DSelection, null>; texture?: "wood" | "marble" | "fabric" | "glass" | "metal" };

type Camera = { azimuth: number; elevation: number; zoom: number; panX: number; panY: number; mode: "orbit" | "visit"; worldX: number; worldZ: number; yaw: number; pitch: number };

function hexToRgb(color: string): [number, number, number] {
  const clean = color.replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(clean)) return [parseInt(clean[0] + clean[0], 16), parseInt(clean[1] + clean[1], 16), parseInt(clean[2] + clean[2], 16)];
  if (/^[0-9a-f]{6}$/i.test(clean)) return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  return [176, 164, 146];
}
function tone(color: string, factor: number): string {
  const [r, g, b] = hexToRgb(color); const mix = factor >= 0 ? 255 : 0; const amount = Math.abs(factor);
  return `rgb(${Math.round(r + (mix - r) * amount)},${Math.round(g + (mix - g) * amount)},${Math.round(b + (mix - b) * amount)})`;
}
function prismFaces(cx: number, cy: number, cz: number, width: number, height: number, depth: number, color: string, selection?: Face["selection"], rotation = 0, texture?: Face["texture"]): Face[] {
  const hw = width / 2, hd = depth / 2, h = height;
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => {
    const c = Math.cos(rotation), s = Math.sin(rotation); return { x: cx + x * c - z * s, z: cz + x * s + z * c };
  });
  const b = corners.map((p) => ({ x: p.x, y: cy, z: p.z })); const t = corners.map((p) => ({ x: p.x, y: cy + h, z: p.z }));
  return [
    { points: [t[0], t[1], t[2], t[3]], color: tone(color, 0.15), stroke: tone(color, -0.22), alpha: 0.98, selection, texture },
    { points: [b[0], b[1], t[1], t[0]], color: tone(color, -0.02), stroke: tone(color, -0.24), alpha: 0.96, selection, texture },
    { points: [b[1], b[2], t[2], t[1]], color: tone(color, -0.12), stroke: tone(color, -0.28), alpha: 0.96, selection, texture },
    { points: [b[2], b[3], t[3], t[2]], color: tone(color, -0.18), stroke: tone(color, -0.3), alpha: 0.96, selection, texture },
    { points: [b[3], b[0], t[0], t[3]], color: tone(color, 0.02), stroke: tone(color, -0.24), alpha: 0.96, selection, texture }
  ];
}

function wallFaces(project: DesignProject, wall: DesignProject["plan"]["walls"][number], color: string, texture?: Face["texture"]): Face[] {
  const dx = wall.end.x - wall.start.x; const dz = wall.end.y - wall.start.y; const length = Math.hypot(dx, dz); const angle = Math.atan2(dz, dx);
  const cx = (wall.start.x + wall.end.x) / 2 - project.plan.width / 2; const cz = (wall.start.y + wall.end.y) / 2 - project.plan.height / 2;
  return prismFaces(cx, 0, cz, length, wall.height, Math.max(0.08, wall.thickness), color, { kind: "wall", id: wall.id }, angle, texture);
}

function materialTexture(material?: DesignMaterial): Face["texture"] | undefined {
  if (!material) return undefined; const name = material.name.toLowerCase();
  if (/chêne|bois|parquet|oak|wood/.test(name)) return "wood"; if (/marbre|marble|pierre/.test(name)) return "marble";
  if (material.category === "fabric") return "fabric"; if (material.category === "glass") return "glass"; if (material.category === "metal") return "metal"; return undefined;
}

function stairFaces(cx: number, cz: number, width: number, depth: number, height: number, color: string, selection: Exclude<Design3DSelection, null>, rotation = 0, texture?: Face["texture"]): Face[] {
  const faces: Face[] = [];
  const steps = 9;
  const run = Math.max(0.08, width / steps);
  const c = Math.cos(rotation), s = Math.sin(rotation);
  for (let index = 0; index < steps; index += 1) {
    const localX = -width / 2 + run * (index + 0.5);
    const worldX = cx + localX * c;
    const worldZ = cz + localX * s;
    const stepHeight = Math.max(0.08, height * (index + 1) / steps);
    faces.push(...prismFaces(worldX, 0, worldZ, run * 1.02, stepHeight, depth, color, selection, rotation, texture));
  }
  return faces;
}

function detailedObjectFaces(object: DesignProject["plan"]["objects"][number], cx: number, cz: number, color: string, selection: Exclude<Design3DSelection, null>, rotation: number, texture?: Face["texture"]): Face[] {
  if (object.category === "stairs") return stairFaces(cx, cz, object.width, object.depth, object.height, color, selection, rotation, texture);
  const faces: Face[] = [];
  const place = (lx: number, y: number, lz: number, w: number, h: number, d: number, shade = 0) => {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const x = cx + lx * c - lz * s; const z = cz + lx * s + lz * c;
    faces.push(...prismFaces(x, y, z, Math.max(.03, w), Math.max(.03, h), Math.max(.03, d), tone(color, shade), selection, rotation, texture));
  };
  const name = object.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const w = object.width, d = object.depth, h = object.height;
  if (/canape|sofa/.test(name)) {
    place(0, .16, 0, w, Math.max(.22, h * .42), d * .82, 0.03);
    place(0, Math.max(.3, h * .42), d * .38, w, Math.max(.28, h * .58), d * .16, -0.06);
    place(-w * .46, .28, 0, w * .08, Math.max(.34, h * .55), d * .82, -0.04); place(w * .46, .28, 0, w * .08, Math.max(.34, h * .55), d * .82, -0.04);
    const cushions = Math.max(2, Math.min(4, Math.round(w / .75))); for (let i = 0; i < cushions; i += 1) place(-w * .36 + i * (w * .72 / Math.max(1, cushions - 1)), h * .38, -d * .08, w * .2, h * .18, d * .58, .08);
  } else if (/lit|bed/.test(name)) {
    place(0, .08, 0, w, .16, d, -0.08); place(0, .24, 0, w * .96, Math.max(.18, h * .28), d * .96, .12); place(0, .22, d * .46, w, Math.max(.45, h * .75), d * .08, -0.12);
  } else if (/table|bureau|desk/.test(name) && !/tableau/.test(name)) {
    place(0, Math.max(.55, h * .78), 0, w, Math.max(.06, h * .12), d, .08);
    const legW = Math.min(.12, w * .09), legD = Math.min(.12, d * .13), legH = Math.max(.45, h * .78); for (const sx of [-1, 1]) for (const sz of [-1, 1]) place(sx * (w * .42), 0, sz * (d * .38), legW, legH, legD, -0.16);
  } else if (/chaise|fauteuil|chair/.test(name)) {
    place(0, h * .43, -d * .06, w * .9, h * .12, d * .75, .05); place(0, h * .5, d * .35, w * .9, h * .5, d * .12, -0.04); for (const sx of [-1, 1]) for (const sz of [-1, 1]) place(sx * w * .36, 0, sz * d * .28, w * .08, h * .45, d * .08, -0.12);
  } else if (object.category === "plant") {
    place(0, 0, 0, w * .58, h * .32, d * .58, -0.2); place(0, h * .28, 0, w * .18, h * .42, d * .18, -0.08); place(0, h * .48, 0, w, h * .48, d, 0.02);
  } else if (object.category === "lighting") {
    place(0, h * .2, 0, w * .12, Math.max(.6, h * .65), d * .12, -0.22); place(0, Math.max(.15, h * .82), 0, w, Math.max(.1, h * .12), d, .18);
  } else if (object.category === "kitchen") {
    place(0, 0, 0, w, h * .88, d, -0.08); place(0, h * .88, 0, w * 1.04, h * .1, d * 1.04, .14);
  } else if (object.category === "sanitary") {
    place(0, 0, 0, w, h * .48, d, .1); place(0, h * .45, d * .2, w * .9, h * .4, d * .45, .16);
  } else place(0, 0, 0, w, h, d, 0);
  return faces;
}

export function DesignViewport3D({ project, selection, onSelection, onChange, initialMode = "orbit" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [camera, setCamera] = useState<Camera>({ azimuth: -0.72, elevation: 0.62, zoom: 1, panX: 0, panY: 0, mode: initialMode, worldX: 0, worldZ: project.plan.height / 2 - 0.7, yaw: Math.PI, pitch: 0 });
  const [lighting, setLighting] = useState<"day" | "studio" | "night">("day");
  const drag = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const hitFaces = useRef<Array<{ polygon: Array<{ x: number; y: number }>; selection?: Face["selection"] }>>([]);
  const materialMap = useMemo(() => new Map(project.materials.map((material) => [material.id, material])), [project.materials]);

  useEffect(() => { setCamera((current) => ({ ...current, mode: initialMode, worldX: initialMode === "visit" ? 0 : current.worldX, worldZ: initialMode === "visit" ? project.plan.height / 2 - 0.7 : current.worldZ, yaw: initialMode === "visit" ? Math.PI : current.yaw, pitch: initialMode === "visit" ? 0 : current.pitch })); }, [initialMode, project.id]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const rect = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const cw = rect.width, ch = rect.height;
    const bg = lighting === "night" ? "#111418" : lighting === "studio" ? "#ece9e2" : "#e8edf0"; ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);

    const cosA = Math.cos(camera.azimuth), sinA = Math.sin(camera.azimuth), cosE = Math.cos(camera.elevation), sinE = Math.sin(camera.elevation);
    const scale = Math.min(cw, ch) * (project.domain === "product" ? 0.14 : 0.065) * camera.zoom;
    const projectPoint = (point: Vec3) => {
      if (camera.mode === "visit" && project.domain !== "product") {
        const dx = point.x - camera.worldX; const dy = point.y - 1.65; const dz = point.z - camera.worldZ;
        const cosY = Math.cos(camera.yaw), sinY = Math.sin(camera.yaw), cosP = Math.cos(camera.pitch), sinP = Math.sin(camera.pitch);
        const x1 = dx * cosY - dz * sinY; const z1 = dx * sinY + dz * cosY;
        const y2 = dy * cosP - z1 * sinP; const z2 = dy * sinP + z1 * cosP;
        const visible = z2 > 0.12; const focal = Math.min(cw, ch) * 0.92 * camera.zoom; const safeZ = Math.max(0.12, z2);
        return { x: cw / 2 + x1 * focal / safeZ, y: ch * 0.52 - y2 * focal / safeZ, depth: z2, visible };
      }
      const x1 = point.x * cosA - point.z * sinA; const z1 = point.x * sinA + point.z * cosA;
      const y2 = point.y * cosE - z1 * sinE; const z2 = point.y * sinE + z1 * cosE;
      const perspective = 1 / Math.max(0.55, 1 + z2 * 0.035);
      return { x: cw / 2 + camera.panX + x1 * scale * perspective, y: ch * 0.62 + camera.panY - y2 * scale * perspective, depth: z2, visible: true };
    };

    // Ground plane in orbit mode; horizon floor in visit mode.
    if (camera.mode === "visit" && project.domain !== "product") {
      ctx.fillStyle = lighting === "night" ? "#191d22" : "#d7d3ca"; ctx.fillRect(0, ch * 0.52, cw, ch * 0.48);
      ctx.strokeStyle = lighting === "night" ? "rgba(255,255,255,.08)" : "rgba(72,62,49,.12)"; ctx.beginPath(); ctx.moveTo(0, ch * 0.52); ctx.lineTo(cw, ch * 0.52); ctx.stroke();
    } else {
      const groundSize = project.domain === "product" ? Math.max(4, project.product.width * 3, project.product.depth * 3) : Math.max(project.plan.width, project.plan.height) * 1.45;
      const gp = [[-groundSize / 2, 0, -groundSize / 2], [groundSize / 2, 0, -groundSize / 2], [groundSize / 2, 0, groundSize / 2], [-groundSize / 2, 0, groundSize / 2]].map(([x, y, z]) => projectPoint({ x, y, z }));
      ctx.beginPath(); gp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = lighting === "night" ? "#191d22" : "#dad7cf"; ctx.fill();
    }

    const faces: Face[] = [];
    if (project.domain !== "product") {
      for (const room of project.plan.rooms) {
        const material = materialMap.get(room.floorMaterialId || "");
        faces.push(...prismFaces(room.x + room.width / 2 - project.plan.width / 2, -0.035, room.y + room.height / 2 - project.plan.height / 2, room.width, 0.07, room.height, room.color || material?.color || "#d8cbb8", { kind: "room", id: room.id }, 0, materialTexture(material)));
      }
      for (const wall of project.plan.walls) { const material = materialMap.get(wall.materialId || ""); faces.push(...wallFaces(project, wall, material?.color || "#ddd7cc", materialTexture(material))); }
      for (const object of project.plan.objects) {
        const material = materialMap.get(object.materialId || ""); const color = object.color || material?.color || "#b8a488";
        const cx = object.x + object.width / 2 - project.plan.width / 2;
        const cz = object.y + object.depth / 2 - project.plan.height / 2;
        const rotation = object.rotation * Math.PI / 180;
        faces.push(...detailedObjectFaces(object, cx, cz, color, { kind: "object", id: object.id }, rotation, materialTexture(material)));
      }
      for (const opening of project.plan.openings) {
        const ox = opening.position.x - project.plan.width / 2; const oz = opening.position.y - project.plan.height / 2; const rotation = (opening.rotation || 0) * Math.PI / 180;
        if (opening.kind === "window") faces.push(...prismFaces(ox, opening.sill || .9, oz, opening.width, opening.height, .035, "#8fc7d4", { kind: "wall", id: opening.wallId || "" }, rotation, "glass").map((face) => ({ ...face, alpha: .55 })));
        else faces.push(...prismFaces(ox, 0, oz, opening.width, opening.height, .055, "#8b6b4c", undefined, rotation));
      }
    }
    if (project.domain === "product") {
      const productColor = materialMap.get(project.product.materialId || "")?.color || "#bba68a";
      const virtual = { id: "product-main", name: project.product.category === "furniture" ? "Fauteuil produit" : "Objet produit", category: "product" as const, x: 0, y: 0, width: project.product.width, depth: project.product.depth, height: project.product.height, rotation: 0, color: productColor };
      faces.push(...detailedObjectFaces(virtual, 0, 0, productColor, { kind: "object", id: "product-main" }, 0, materialTexture(materialMap.get(project.product.materialId || ""))));
    }

    for (const face of faces) face.depth = face.points.reduce((sum, p) => sum + projectPoint(p).depth, 0) / face.points.length;
    faces.sort((a, b) => (b.depth || 0) - (a.depth || 0));
    const hits: Array<{ polygon: Array<{ x: number; y: number }>; selection?: Face["selection"] }> = [];
    for (const face of faces) {
      const pts = face.points.map(projectPoint); if (pts.length < 3 || (camera.mode === "visit" && pts.some((point) => !point.visible))) continue;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      const active = selection && face.selection && selection.kind === face.selection.kind && selection.id === face.selection.id;
      ctx.globalAlpha = face.alpha; ctx.fillStyle = active ? tone(face.color, 0.22) : face.color; ctx.fill(); ctx.globalAlpha = 1;
      if (face.texture) {
        const minX = Math.min(...pts.map((point) => point.x)), maxX = Math.max(...pts.map((point) => point.x)), minY = Math.min(...pts.map((point) => point.y)), maxY = Math.max(...pts.map((point) => point.y));
        ctx.save(); ctx.clip(); ctx.globalAlpha = face.texture === "glass" ? .22 : .12; ctx.strokeStyle = face.texture === "marble" ? "#6f7477" : face.texture === "wood" ? "#5d3b20" : face.texture === "glass" ? "#ffffff" : "#3f3b36"; ctx.lineWidth = .7;
        const step = face.texture === "fabric" ? 7 : 11; for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += step) { ctx.beginPath(); if (face.texture === "wood") { ctx.moveTo(x, minY); ctx.lineTo(x + 3, maxY); } else { ctx.moveTo(x, maxY); ctx.lineTo(x + (maxY - minY), minY); } ctx.stroke(); }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = active ? "#a76e22" : face.stroke; ctx.lineWidth = active ? 2 : 0.7; ctx.stroke();
      hits.push({ polygon: pts, selection: face.selection });
    }
    hitFaces.current = hits.reverse();

    // Sun direction indicator.
    ctx.strokeStyle = lighting === "night" ? "rgba(255,255,255,.28)" : "rgba(118,87,42,.28)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cw - 46, 44, 16, 0, Math.PI * 2); ctx.stroke();
    const angle = project.site.orientation * Math.PI / 180; ctx.beginPath(); ctx.moveTo(cw - 46, 44); ctx.lineTo(cw - 46 + Math.sin(angle) * 12, 44 - Math.cos(angle) * 12); ctx.stroke();
  }, [camera, lighting, materialMap, project, selection]);

  const pointInPolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
    let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; const intersect = ((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 0.00001) + a.x); if (intersect) inside = !inside; } return inside;
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selection || selection.kind !== "object") return;
    const next = structuredClone(project); const object = next.plan.objects.find((item) => item.id === selection.id); if (!object) return;
    object.x = Math.max(0, Math.min(next.plan.width - object.width, object.x + dx)); object.y = Math.max(0, Math.min(next.plan.height - object.depth, object.y + dy));
    onChange(next, "Objet déplacé en 3D");
  };

  const moveVisitCamera = (forward: number, strafe: number) => {
    setCamera((current) => {
      if (current.mode !== "visit") return current;
      const step = 0.34;
      const worldX = current.worldX + (Math.sin(current.yaw) * forward + Math.cos(current.yaw) * strafe) * step;
      const worldZ = current.worldZ + (Math.cos(current.yaw) * forward - Math.sin(current.yaw) * strafe) * step;
      const minX = -project.plan.width / 2 + 0.2, maxX = project.plan.width / 2 - 0.2;
      const minZ = -project.plan.height / 2 + 0.2, maxZ = project.plan.height / 2 - 0.2;
      return { ...current, worldX: Math.max(minX, Math.min(maxX, worldX)), worldZ: Math.max(minZ, Math.min(maxZ, worldZ)) };
    });
  };

  return <div className="relative h-full min-h-[480px] overflow-hidden rounded-2xl border border-black/10 bg-zinc-100 shadow-inner dark:border-white/10 dark:bg-zinc-950">
    <canvas ref={canvasRef} tabIndex={0} className="h-full w-full cursor-grab outline-none active:cursor-grabbing" onPointerDown={(event) => { event.currentTarget.focus(); drag.current = { x: event.clientX, y: event.clientY, camera }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current) return; const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y; const start = drag.current.camera; if (start.mode === "visit") setCamera({ ...start, yaw: start.yaw + dx * 0.0045, pitch: Math.max(-0.38, Math.min(0.38, start.pitch - dy * 0.0032)) }); else setCamera({ ...start, azimuth: start.azimuth + dx * 0.006, elevation: Math.max(0.18, Math.min(1.28, start.elevation - dy * 0.004)) }); }} onPointerUp={(event) => { const started = drag.current; drag.current = null; if (!started || Math.hypot(event.clientX - started.x, event.clientY - started.y) > 4) return; const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left, y = event.clientY - rect.top; const hit = hitFaces.current.find((item) => item.selection && pointInPolygon(x, y, item.polygon)); onSelection(hit?.selection || null); }} onWheel={(event) => { event.preventDefault(); setCamera((current) => ({ ...current, zoom: Math.max(0.45, Math.min(2.8, current.zoom * (event.deltaY > 0 ? 0.92 : 1.08))) })); }} onKeyDown={(event) => { if (camera.mode !== "visit") return; const key = event.key.toLowerCase(); if (["w", "arrowup"].includes(key)) { event.preventDefault(); moveVisitCamera(1, 0); } else if (["s", "arrowdown"].includes(key)) { event.preventDefault(); moveVisitCamera(-1, 0); } else if (["a", "arrowleft"].includes(key)) { event.preventDefault(); moveVisitCamera(0, -1); } else if (["d", "arrowright"].includes(key)) { event.preventDefault(); moveVisitCamera(0, 1); } }} />
    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-xl border border-black/10 bg-white/88 p-1.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/88">
      <button type="button" onClick={() => setCamera({ azimuth: -0.72, elevation: 0.62, zoom: 1, panX: 0, panY: 0, mode: "orbit", worldX: 0, worldZ: project.plan.height / 2 - 0.7, yaw: Math.PI, pitch: 0 })} className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" title="Réinitialiser la caméra"><Rotate3D className="size-4" /></button>
      <button type="button" onClick={() => setCamera((current) => ({ ...current, mode: "orbit" }))} className={cn("h-8 rounded-lg px-2 text-[9px] font-bold", camera.mode === "orbit" ? "bg-[#7c5c36] text-white" : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10")}>ORBITE</button>
      {project.domain !== "product" && <button type="button" onClick={() => setCamera((current) => ({ ...current, mode: "visit", worldX: 0, worldZ: project.plan.height / 2 - 0.7, yaw: Math.PI, pitch: 0, zoom: 1 }))} className={cn("h-8 rounded-lg px-2 text-[9px] font-bold", camera.mode === "visit" ? "bg-[#7c5c36] text-white" : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10")}>VISITE</button>}
      <button type="button" onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(2.8, c.zoom * 1.12) }))} className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"><ZoomIn className="size-4" /></button>
      <button type="button" onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(0.45, c.zoom / 1.12) }))} className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"><ZoomOut className="size-4" /></button>
      {(["day", "studio", "night"] as const).map((mode) => <button key={mode} type="button" onClick={() => setLighting(mode)} className={cn("grid size-8 place-items-center rounded-lg", lighting === mode ? "bg-[#7c5c36] text-white" : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10")} title={mode === "day" ? "Lumière naturelle" : mode === "studio" ? "Studio" : "Nuit"}>{mode === "day" ? <Sun className="size-4" /> : mode === "studio" ? <Lightbulb className="size-4" /> : <Box className="size-4" />}</button>)}
    </div>
    <div className="absolute bottom-3 left-3 rounded-xl border border-black/10 bg-white/88 px-3 py-2 text-[10px] text-zinc-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/88 dark:text-zinc-400">{camera.mode === "visit" ? "Visite : souris pour regarder · WASD/flèches pour avancer · molette pour le champ de vue" : "Glisser : orbite · Molette : zoom · Cliquer : sélectionner"}</div>
    {selection?.kind === "object" && <div className="absolute bottom-3 right-3 rounded-xl border border-black/10 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/90"><div className="mb-1 text-center text-[9px] font-bold uppercase tracking-[.14em] text-zinc-400">Déplacer</div><div className="grid grid-cols-3 gap-1"><span /><button onClick={() => nudgeSelected(0, -0.25)} className="size-7 rounded bg-black/5 text-xs dark:bg-white/10">↑</button><span /><button onClick={() => nudgeSelected(-0.25, 0)} className="size-7 rounded bg-black/5 text-xs dark:bg-white/10">←</button><button onClick={() => nudgeSelected(0, 0.25)} className="size-7 rounded bg-black/5 text-xs dark:bg-white/10">↓</button><button onClick={() => nudgeSelected(0.25, 0)} className="size-7 rounded bg-black/5 text-xs dark:bg-white/10">→</button></div></div>}
  </div>;
}
