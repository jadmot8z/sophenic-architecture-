"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, Home, Loader2, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { DesignMaterial, DesignObject, DesignProject, DesignRoom, DesignWall } from "@/design/types";
import { roomElevation } from "@/design/architecture";
import { cn } from "@/lib/utils";

export type ArchitectureSelection = { kind: "object" | "wall" | "room"; id: string } | null;

type Props = {
  project: DesignProject;
  mode: "exterior" | "interior";
  activeRoomId?: string;
  onActiveRoom: (roomId: string) => void;
  selection: ArchitectureSelection;
  onSelection: (selection: ArchitectureSelection) => void;
};

type SceneRuntime = { renderer: THREE.WebGLRenderer; composer: EffectComposer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; root: THREE.Group; lighting: THREE.Group; animationId: number; resizeObserver: ResizeObserver; environmentTexture?: THREE.Texture };

type AssetBundle = { cacheId: string; entryPath: string; format: "gltf" | "glb"; files: Array<{ path: string; mime: string; bytes: Uint8Array }> };

function hash01(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function tint(color: string, amount: number): string {
  const base = new THREE.Color(color);
  const target = amount >= 0 ? new THREE.Color("#ffffff") : new THREE.Color("#000000");
  base.lerp(target, Math.min(.8, Math.abs(amount)));
  return `#${base.getHexString()}`;
}

type MaterialMaps = { map?: THREE.CanvasTexture; bumpMap?: THREE.CanvasTexture; roughnessMap?: THREE.CanvasTexture };

function textureFromCanvas(canvas: HTMLCanvasElement, repeat: number, isColor = true): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  return texture;
}

function materialMaps(material: DesignMaterial | undefined): MaterialMaps {
  if (!material || typeof document === "undefined" || material.texture === "glass" || material.texture === "metal") return {};
  const size = 320;
  const colorCanvas = document.createElement("canvas"); colorCanvas.width = size; colorCanvas.height = size;
  const bumpCanvas = document.createElement("canvas"); bumpCanvas.width = size; bumpCanvas.height = size;
  const roughCanvas = document.createElement("canvas"); roughCanvas.width = size; roughCanvas.height = size;
  const ctx = colorCanvas.getContext("2d"), bump = bumpCanvas.getContext("2d"), rough = roughCanvas.getContext("2d");
  if (!ctx || !bump || !rough) return {};
  ctx.fillStyle = material.color; ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#808080"; bump.fillRect(0, 0, size, size);
  rough.fillStyle = "#c0c0c0"; rough.fillRect(0, 0, size, size);
  const kind = material.texture || (/marbre/i.test(material.name) ? "marble" : /travertin/i.test(material.name) ? "travertine" : /chêne|chene|noyer/i.test(material.name) ? "wood" : /béton|beton/i.test(material.name) ? "concrete" : material.category === "fabric" ? "fabric" : material.category === "wall" ? "plaster" : "stone");
  const repeat = material.textureScale || 2;

  if (kind === "wood") {
    const plank = size / 7;
    for (let i = 0; i < 7; i += 1) {
      const x = i * plank;
      ctx.fillStyle = i % 2 ? tint(material.color, .035) : tint(material.color, -.025); ctx.fillRect(x, 0, plank, size);
      ctx.strokeStyle = "rgba(40,20,8,.18)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      bump.fillStyle = i % 2 ? "#858585" : "#797979"; bump.fillRect(x, 0, plank, size);
      rough.fillStyle = i % 2 ? "#b9b9b9" : "#c7c7c7"; rough.fillRect(x, 0, plank, size);
    }
    for (let line = 0; line < 65; line += 1) {
      const y = hash01(line * 5.7) * size; const amp = 3 + hash01(line * 7.1) * 8;
      ctx.strokeStyle = `rgba(48,25,10,${.045 + hash01(line) * .08})`; ctx.lineWidth = .7 + hash01(line * 2) * 1.5;
      ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x * .04 + line) * amp); ctx.stroke();
      bump.strokeStyle = `rgba(118,118,118,${.18 + hash01(line) * .18})`; bump.lineWidth = 1; bump.stroke();
    }
  } else if (kind === "marble") {
    ctx.lineCap = "round";
    for (let i = 0; i < 18; i += 1) {
      const y = 12 + i * 27 + hash01(i) * 10;
      ctx.strokeStyle = `rgba(84,88,92,${.07 + hash01(i * 3) * .11})`; ctx.lineWidth = .7 + hash01(i * 8) * 1.7;
      ctx.beginPath(); ctx.moveTo(-40, y); ctx.bezierCurveTo(90, y - 55 + hash01(i) * 30, 270, y + 45, 550, y - 16); ctx.stroke();
      bump.strokeStyle = `rgba(150,150,150,${.08 + hash01(i) * .08})`; bump.lineWidth = 1; bump.stroke();
    }
    rough.fillStyle = "#707070"; rough.fillRect(0, 0, size, size);
  } else if (kind === "travertine" || kind === "stone") {
    for (let i = 0; i < 2400; i += 1) {
      const x = hash01(i * 1.37) * size, y = hash01(i * 4.91) * size; const r = .4 + hash01(i * 8.31) * 1.7;
      ctx.fillStyle = `rgba(92,69,45,${.018 + hash01(i) * .055})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      bump.fillStyle = `rgba(80,80,80,${.06 + hash01(i * 3) * .12})`; bump.fillRect(x, y, r, r);
    }
    for (let y = 8; y < size; y += 18) { ctx.fillStyle = "rgba(100,78,52,.028)"; ctx.fillRect(0, y, size, 1); }
  } else if (kind === "concrete" || kind === "plaster") {
    for (let i = 0; i < 5000; i += 1) {
      const x = hash01(i * 2.03) * size, y = hash01(i * 5.77) * size; const alpha = kind === "plaster" ? .018 : .03;
      ctx.fillStyle = hash01(i) > .5 ? `rgba(255,255,255,${alpha})` : `rgba(40,40,40,${alpha})`; ctx.fillRect(x, y, 1.2, 1.2);
      bump.fillStyle = hash01(i * 9) > .5 ? "#858585" : "#7b7b7b"; bump.fillRect(x, y, 1, 1);
    }
  } else if (kind === "fabric" || kind === "rug" || kind === "leather") {
    const spacing = kind === "rug" ? 4 : 7;
    for (let y = 0; y < size; y += spacing) {
      for (let x = 0; x < size; x += spacing) {
        const v = hash01(x * 1.7 + y * 3.1);
        ctx.fillStyle = v > .5 ? `rgba(255,255,255,${kind === "leather" ? .018 : .045})` : `rgba(40,30,20,${kind === "leather" ? .022 : .04})`; ctx.fillRect(x, y, 2, 2);
        bump.fillStyle = v > .5 ? "#969696" : "#707070"; bump.fillRect(x, y, kind === "rug" ? 3 : 2, kind === "rug" ? 3 : 2);
      }
    }
    if (kind === "leather") for (let i = 0; i < 24; i += 1) { ctx.strokeStyle = "rgba(55,28,14,.025)"; ctx.beginPath(); ctx.arc(hash01(i)*size, hash01(i*8)*size, 18+hash01(i*5)*38, 0, Math.PI*2); ctx.stroke(); }
  } else if (kind === "ceramic") {
    ctx.fillStyle = material.color; ctx.fillRect(0,0,size,size); rough.fillStyle = "#7c7c7c"; rough.fillRect(0,0,size,size);
  }
  return { map: textureFromCanvas(colorCanvas, repeat, true), bumpMap: textureFromCanvas(bumpCanvas, repeat, false), roughnessMap: textureFromCanvas(roughCanvas, repeat, false) };
}

function pbrMaterial(material: DesignMaterial | undefined, fallback: string, options?: { transparent?: boolean; opacity?: number }): THREE.MeshPhysicalMaterial {
  const maps = materialMaps(material);
  const isGlass = material?.category === "glass" || material?.texture === "glass";
  const isFabric = material?.category === "fabric" || material?.texture === "fabric" || material?.texture === "rug";
  const isPolishedStone = material?.texture === "marble";
  const result = new THREE.MeshPhysicalMaterial({
    color: material?.color || fallback,
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: (material?.normalStrength ?? .18) * (isFabric ? .75 : 1),
    roughnessMap: maps.roughnessMap,
    roughness: Math.max(0.04, Math.min(1, material?.roughness ?? 0.72)),
    metalness: material?.category === "metal" ? Math.max(0.38, Math.min(0.92, material.reflectivity ?? 0.62)) : 0,
    transparent: options?.transparent || isGlass,
    opacity: options?.opacity ?? (isGlass ? .42 : 1),
    transmission: isGlass ? .48 : 0,
    thickness: isGlass ? .025 : 0,
    ior: isGlass ? 1.45 : 1.5,
    clearcoat: isPolishedStone ? .28 : 0,
    clearcoatRoughness: isPolishedStone ? .18 : .5,
    sheen: isFabric ? .35 : 0,
    sheenRoughness: isFabric ? .8 : 1,
    sheenColor: isFabric ? new THREE.Color(material?.color || fallback) : new THREE.Color("#ffffff"),
    envMapIntensity: isGlass ? 1.25 : isPolishedStone ? .82 : .42,
    side: THREE.DoubleSide
  });
  return result;
}

function worldX(project: DesignProject, x: number): number { return x - project.plan.width / 2; }
function worldZ(project: DesignProject, y: number): number { return y - project.plan.height / 2; }

function attachSelection(object: THREE.Object3D, selection: Exclude<ArchitectureSelection, null>): void {
  object.userData.sophenicSelection = selection;
  object.traverse((child) => { child.userData.sophenicSelection = selection; });
}

function createBox(width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number, rotationY = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.015, width), Math.max(0.015, height), Math.max(0.015, depth)), material);
  mesh.position.set(x, y, z); mesh.rotation.y = rotationY; mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

function createRoundedBox(width: number, height: number, depth: number, radius: number, material: THREE.Material, x: number, y: number, z: number, rotationY = 0): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(Math.max(.03, width), Math.max(.03, height), Math.max(.03, depth), 4, Math.max(.008, Math.min(radius, width * .18, height * .18, depth * .18)));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.rotation.y = rotationY; mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

function createCylinder(radiusTop: number, radiusBottom: number, height: number, material: THREE.Material, x = 0, y = 0, z = 0, segments = 32): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(.01, radiusTop), Math.max(.01, radiusBottom), Math.max(.02, height), segments), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

function wallSegments(project: DesignProject, wall: DesignWall): THREE.Object3D[] {
  const baseY = roomElevation(project, wall.level || 0);
  const dx = wall.end.x - wall.start.x; const dz = wall.end.y - wall.start.y; const length = Math.max(0.02, Math.hypot(dx, dz)); const angle = Math.atan2(dz, dx);
  const ux = dx / length; const uz = dz / length;
  const wallMaterial = pbrMaterial(project.materials.find((item) => item.id === wall.materialId), "#ece8df");
  const openings = project.plan.openings.filter((opening) => opening.wallId === wall.id).map((opening) => {
    const px = opening.position.x - wall.start.x; const pz = opening.position.y - wall.start.y; const center = Math.max(0, Math.min(length, px * ux + pz * uz));
    return { opening, center, start: Math.max(0, center - opening.width / 2), end: Math.min(length, center + opening.width / 2) };
  }).sort((a, b) => a.start - b.start);
  const objects: THREE.Object3D[] = [];
  const addAlong = (start: number, end: number, y: number, height: number, material = wallMaterial, depth = wall.thickness) => {
    const span = end - start; if (span <= 0.015 || height <= 0.015) return;
    const mid = (start + end) / 2; const px = wall.start.x + ux * mid; const pz = wall.start.y + uz * mid;
    const mesh = createBox(span, height, depth, material, worldX(project, px), baseY + y, worldZ(project, pz), -angle); mesh.userData.sophenicLevel = wall.level || 0; attachSelection(mesh, { kind: "wall", id: wall.id }); objects.push(mesh);
  };
  let cursor = 0;
  for (const item of openings) {
    addAlong(cursor, item.start, wall.height / 2, wall.height);
    const sill = item.opening.kind === "window" ? Math.max(0.45, item.opening.sill ?? 0.85) : 0;
    if (sill > 0) addAlong(item.start, item.end, sill / 2, sill);
    const openingTop = Math.min(wall.height, sill + item.opening.height); const upper = wall.height - openingTop;
    if (upper > 0) addAlong(item.start, item.end, openingTop + upper / 2, upper);
    const center = item.center; const px = wall.start.x + ux * center; const pz = wall.start.y + uz * center;
    if (item.opening.kind === "window") {
      const glass = pbrMaterial(project.materials.find((mat) => mat.category === "glass"), "#d7eced", { transparent: true, opacity: 0.34 });
      const frame = pbrMaterial(project.materials.find((mat) => mat.id === "mat-black"), "#2b2b29");
      const pane = createBox(item.opening.width * 0.92, item.opening.height * 0.88, 0.025, glass, worldX(project, px), baseY + sill + item.opening.height / 2, worldZ(project, pz), -angle); pane.userData.sophenicLevel = wall.level || 0; objects.push(pane);
      const frameSize = .055; const verticalOffset = item.opening.width / 2 - frameSize / 2;
      for (const side of [-1, 1]) {
        const fx = wall.start.x + ux * (center + side * verticalOffset), fz = wall.start.y + uz * (center + side * verticalOffset);
        const jamb = createBox(frameSize, item.opening.height, wall.thickness * .48, frame, worldX(project, fx), baseY + sill + item.opening.height / 2, worldZ(project, fz), -angle); jamb.userData.sophenicLevel = wall.level || 0; objects.push(jamb);
      }
      for (const offsetY of [sill, sill + item.opening.height]) {
        const rail = createBox(item.opening.width, frameSize, wall.thickness * .48, frame, worldX(project, px), baseY + offsetY, worldZ(project, pz), -angle); rail.userData.sophenicLevel = wall.level || 0; objects.push(rail);
      }
      if (item.opening.width >= 1.25) {
        const curtainMaterial = pbrMaterial(project.materials.find((mat) => mat.id === "mat-fabric"), "#d8cbb9");
        const curtainHeight = Math.min(wall.height - .16, Math.max(1.85, sill + item.opening.height + .34));
        const curtainWidth = Math.min(.32, Math.max(.2, item.opening.width * .14));
        const offset = item.opening.width / 2 + curtainWidth * .42;
        for (const side of [-1, 1]) {
          const cx = wall.start.x + ux * (center + side * offset); const cz = wall.start.y + uz * (center + side * offset);
          const curtain = createRoundedBox(curtainWidth, curtainHeight, .055, .022, curtainMaterial, worldX(project, cx), baseY + curtainHeight / 2 + .04, worldZ(project, cz), -angle); curtain.userData.sophenicLevel = wall.level || 0; objects.push(curtain);
        }
        const rodMaterial = pbrMaterial(project.materials.find((mat) => mat.id === "mat-black"), "#2b2b29");
        const rod = createBox(item.opening.width + curtainWidth * 2.6, .035, .04, rodMaterial, worldX(project, px), baseY + Math.min(wall.height - .08, curtainHeight + .08), worldZ(project, pz), -angle); rod.userData.sophenicLevel = wall.level || 0; objects.push(rod);
      }
    } else {
      const doorMaterial = pbrMaterial(project.materials.find((mat) => mat.id === "mat-walnut"), "#806044");
      const frame = pbrMaterial(project.materials.find((mat) => mat.id === "mat-black"), "#292926");
      const door = createRoundedBox(item.opening.width * 0.92, Math.min(item.opening.height, wall.height - 0.05), 0.06, .018, doorMaterial, worldX(project, px), baseY + item.opening.height / 2, worldZ(project, pz), -angle); door.userData.sophenicLevel = wall.level || 0; objects.push(door);
      const frameSize = .055; const verticalOffset = item.opening.width / 2 - frameSize / 2;
      for (const side of [-1, 1]) {
        const fx = wall.start.x + ux * (center + side * verticalOffset), fz = wall.start.y + uz * (center + side * verticalOffset);
        const jamb = createBox(frameSize, item.opening.height + .05, wall.thickness * .52, frame, worldX(project, fx), baseY + item.opening.height / 2, worldZ(project, fz), -angle); jamb.userData.sophenicLevel = wall.level || 0; objects.push(jamb);
      }
      const header = createBox(item.opening.width, frameSize, wall.thickness * .52, frame, worldX(project, px), baseY + item.opening.height, worldZ(project, pz), -angle); header.userData.sophenicLevel = wall.level || 0; objects.push(header);
    }
    cursor = Math.max(cursor, item.end);
  }
  addAlong(cursor, length, wall.height / 2, wall.height);
  return objects;
}

function createRoomMeshes(project: DesignProject, room: DesignRoom): THREE.Object3D[] {
  const baseY = roomElevation(project, room); const level = room.level || 0;
  const floorMaterial = pbrMaterial(project.materials.find((item) => item.id === room.floorMaterialId), "#b98a55");
  const floor = createBox(room.width - 0.02, 0.075, room.height - 0.02, floorMaterial, worldX(project, room.x + room.width / 2), baseY - 0.0375, worldZ(project, room.y + room.height / 2));
  floor.userData.sophenicRoomId = room.id; floor.userData.sophenicLevel = level; attachSelection(floor, { kind: "room", id: room.id });
  const ceilingMaterial = pbrMaterial(project.materials.find((item) => item.category === "ceiling" || item.id === "mat-wall"), "#f6f3ec");
  const ceilingY = baseY + (room.ceilingHeight || project.plan.wallHeight) + 0.025;
  const ceiling = createBox(room.width - 0.06, 0.045, room.height - 0.06, ceilingMaterial, worldX(project, room.x + room.width / 2), ceilingY, worldZ(project, room.y + room.height / 2));
  ceiling.userData.sophenicCeilingRoomId = room.id; ceiling.userData.sophenicRoomId = room.id; ceiling.userData.sophenicLevel = level;

  const skirtingMaterial = pbrMaterial(project.materials.find((item) => item.id === "mat-wall"), "#ece7de");
  const skirtingHeight = .085, skirtingDepth = .028;
  const objects: THREE.Object3D[] = [floor, ceiling];
  const cx = worldX(project, room.x + room.width / 2), cz = worldZ(project, room.y + room.height / 2);
  const north = createBox(room.width - .06, skirtingHeight, skirtingDepth, skirtingMaterial, cx, baseY + skirtingHeight / 2, worldZ(project, room.y + .018));
  const south = createBox(room.width - .06, skirtingHeight, skirtingDepth, skirtingMaterial, cx, baseY + skirtingHeight / 2, worldZ(project, room.y + room.height - .018));
  const west = createBox(skirtingDepth, skirtingHeight, room.height - .06, skirtingMaterial, worldX(project, room.x + .018), baseY + skirtingHeight / 2, cz);
  const east = createBox(skirtingDepth, skirtingHeight, room.height - .06, skirtingMaterial, worldX(project, room.x + room.width - .018), baseY + skirtingHeight / 2, cz);
  for (const item of [north, south, west, east]) { item.userData.sophenicRoomId = room.id; item.userData.sophenicLevel = level; objects.push(item); }
  return objects;
}


function quietFeatureSide(project: DesignProject, room: DesignRoom): "north" | "south" | "west" | "east" {
  const tolerance = .11;
  const sides = ["north", "west", "south", "east"] as const;
  const openingCount = (side: typeof sides[number]) => project.plan.openings.filter((opening) => {
    if ((opening.level || 0) !== (room.level || 0)) return false;
    if (side === "north") return Math.abs(opening.position.y - room.y) <= tolerance && opening.position.x >= room.x - tolerance && opening.position.x <= room.x + room.width + tolerance;
    if (side === "south") return Math.abs(opening.position.y - (room.y + room.height)) <= tolerance && opening.position.x >= room.x - tolerance && opening.position.x <= room.x + room.width + tolerance;
    if (side === "west") return Math.abs(opening.position.x - room.x) <= tolerance && opening.position.y >= room.y - tolerance && opening.position.y <= room.y + room.height + tolerance;
    return Math.abs(opening.position.x - (room.x + room.width)) <= tolerance && opening.position.y >= room.y - tolerance && opening.position.y <= room.y + room.height + tolerance;
  }).length;
  return [...sides].sort((a, b) => openingCount(a) - openingCount(b))[0] || "north";
}

function createRoomStyling(project: DesignProject, room: DesignRoom): THREE.Group {
  const group = new THREE.Group(); group.name = `SophenicRoomStyling:${room.id}`;
  const baseY = roomElevation(project, room); const level = room.level || 0; const side = quietFeatureSide(project, room);
  const usage = `${room.usage || ""} ${room.name}`.toLowerCase();
  const wood = pbrMaterial(project.materials.find((item) => item.id === "mat-walnut"), "#65452f");
  const stone = pbrMaterial(project.materials.find((item) => item.id === "mat-travertine"), "#d7c4a2");
  const plaster = pbrMaterial(project.materials.find((item) => item.id === "mat-wall"), room.color || "#f1eee7");
  const black = pbrMaterial(project.materials.find((item) => item.id === "mat-black"), "#252522");
  const brass = pbrMaterial(project.materials.find((item) => item.id === "mat-brass"), "#a9844d");
  const addTagged = (mesh: THREE.Object3D) => { mesh.userData.sophenicRoomId = room.id; mesh.userData.sophenicLevel = level; group.add(mesh); };
  const wallPosition = (width: number, height: number, depth: number, y: number) => {
    const cx = worldX(project, room.x + room.width / 2), cz = worldZ(project, room.y + room.height / 2);
    if (side === "north") return { x: cx, y, z: worldZ(project, room.y + .075), w: Math.min(width, room.width - .5), h: height, d: depth };
    if (side === "south") return { x: cx, y, z: worldZ(project, room.y + room.height - .075), w: Math.min(width, room.width - .5), h: height, d: depth };
    if (side === "west") return { x: worldX(project, room.x + .075), y, z: cz, w: depth, h: height, d: Math.min(width, room.height - .5) };
    return { x: worldX(project, room.x + room.width - .075), y, z: cz, w: depth, h: height, d: Math.min(width, room.height - .5) };
  };

  if (/living|salon|sejour|séjour/.test(usage)) {
    const panelW = Math.min(3.1, side === "north" || side === "south" ? room.width - .7 : room.height - .7);
    const p = wallPosition(panelW, 2.15, .035, baseY + 1.1);
    const slatCount = Math.max(8, Math.floor(panelW / .11));
    for (let i = 0; i < slatCount; i += 1) {
      const offset = -panelW / 2 + (i + .5) * panelW / slatCount;
      if (side === "north" || side === "south") addTagged(createRoundedBox(.045, p.h, p.d, .008, wood, p.x + offset, p.y, p.z));
      else addTagged(createRoundedBox(p.w, p.h, .045, .008, wood, p.x, p.y, p.z + offset));
    }
    const artW = Math.min(1.15, panelW * .38); const artH = .74;
    const art = wallPosition(artW, artH, .055, baseY + 1.48);
    const frame = createRoundedBox(art.w, art.h, art.d, .012, black, art.x, art.y, art.z); addTagged(frame);
    const inset = side === "north" || side === "south" ? createRoundedBox(Math.max(.05, art.w - .055), art.h - .055, .012, .005, plaster, art.x, art.y, art.z + (side === "north" ? .024 : -.024)) : createRoundedBox(.012, art.h - .055, Math.max(.05, art.d - .055), .005, plaster, art.x + (side === "west" ? .024 : -.024), art.y, art.z); addTagged(inset);
  } else if (/kitchen|cuisine/.test(usage)) {
    const p = wallPosition(Math.min(3.5, side === "north" || side === "south" ? room.width - .5 : room.height - .5), .72, .028, baseY + 1.2);
    addTagged(createRoundedBox(p.w, p.h, p.d, .008, stone, p.x, p.y, p.z));
  } else if (/bath|salle de bain|salle d.eau/.test(usage)) {
    const p = wallPosition(Math.min(2.6, side === "north" || side === "south" ? room.width - .35 : room.height - .35), 2.15, .026, baseY + 1.08);
    addTagged(createRoundedBox(p.w, p.h, p.d, .008, stone, p.x, p.y, p.z));
    const mirrorMat = pbrMaterial(project.materials.find((item) => item.id === "mat-glass"), "#cfd9dc", { transparent: true, opacity: .72 });
    const mirror = wallPosition(Math.min(.95, p.w * .5 || .95), .86, .036, baseY + 1.45); addTagged(createRoundedBox(mirror.w, mirror.h, mirror.d, .04, mirrorMat, mirror.x, mirror.y, mirror.z));
  } else if (/dining|salle a manger|salle à manger|office|bureau/.test(usage)) {
    const panelW = Math.min(2.4, side === "north" || side === "south" ? room.width - .7 : room.height - .7);
    for (let i = 0; i < 2; i += 1) {
      const p = wallPosition(panelW * .38, .72, .042, baseY + 1.48);
      const lateral = (i ? 1 : -1) * panelW * .23;
      if (side === "north" || side === "south") p.x += lateral; else p.z += lateral;
      addTagged(createRoundedBox(p.w, p.h, p.d, .01, i ? brass : black, p.x, p.y, p.z));
      const fill = side === "north" || side === "south" ? createRoundedBox(Math.max(.05,p.w-.045),p.h-.045,.012,.004,plaster,p.x,p.y,p.z+(side === "north" ? .022 : -.022)) : createRoundedBox(.012,p.h-.045,Math.max(.05,p.d-.045),.004,plaster,p.x+(side === "west" ? .022 : -.022),p.y,p.z); addTagged(fill);
    }
  }
  return group;
}

function createProceduralObject(project: DesignProject, object: DesignObject): THREE.Group {
  const group = new THREE.Group();
  const material = pbrMaterial(project.materials.find((item) => item.id === object.materialId), object.color || "#b39b7d");
  const dark = pbrMaterial(project.materials.find((item) => item.id === "mat-black"), "#2e2d2a");
  const wood = pbrMaterial(project.materials.find((item) => /noyer|chêne/i.test(item.name)), "#76543a");
  const cx = worldX(project, object.x + object.width / 2); const cz = worldZ(project, object.y + object.depth / 2); const baseY = roomElevation(project, object.level || project.plan.rooms.find((room) => room.id === object.roomId)?.level || 0);
  const add = (w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0,ry=0) => { const mesh=createBox(w,h,d,mat,x,y,z,ry); group.add(mesh); return mesh; };
  const addRound = (w:number,h:number,d:number,r:number,mat:THREE.Material,x=0,y=0,z=0,ry=0) => { const mesh=createRoundedBox(w,h,d,r,mat,x,y,z,ry); group.add(mesh); return mesh; };
  const value = object.name.toLowerCase();
  const finishLevel = String(object.metadata?.finishLevel || project.architecture?.finishLevel || project.architecture?.brief?.finishLevel || "balanced");
  const luxury = finishLevel === "luxury";
  if (object.metadata?.structural === "column" || /colonne|column/.test(value)) {
    // V8.1 — colonne monumentale : fût cannelé + base et chapiteau.
    const marbleMat = pbrMaterial(project.materials.find((item) => item.id === object.materialId || /marbre|marble|travertin/i.test(item.name)), object.color || "#e9e4da");
    const radius = Math.min(object.width, object.depth) * .42;
    const shaft = createCylinder(radius * .92, radius, object.height - .28, marbleMat, 0, (object.height - .28) / 2 + .1, 0, 40); group.add(shaft);
    const base = createCylinder(radius * 1.24, radius * 1.3, .1, marbleMat, 0, .05, 0, 40); group.add(base);
    const capital = createCylinder(radius * 1.3, radius * 1.05, .18, marbleMat, 0, object.height - .12, 0, 40); group.add(capital);
    const abacus = createBox(object.width * 1.06, .07, object.depth * 1.06, marbleMat, 0, object.height - .035, 0); group.add(abacus);
  } else if (/lustre|chandelier/.test(value)) {
    // V8.1 — chandelier cristal (archetype palais).
    const room=project.plan.rooms.find((item)=>item.id===object.roomId);
    const ceiling=Math.max(2.4,room?.ceilingHeight || project.plan.wallHeight);
    const brassMat=pbrMaterial(project.materials.find((item)=>item.id==="mat-brass"),"#b08a52");
    const cord=createCylinder(.014,.014,Math.max(.4,ceiling-object.height-.6),dark,0,ceiling-Math.max(.4,ceiling-object.height-.6)/2,0,16); group.add(cord);
    const crown=createCylinder(.05,.05,.1,brassMat,0,ceiling-.2,0,20); group.add(crown);
    const ringCount = 3;
    for (let ring=0; ring<ringCount; ring+=1) {
      const y = Math.max(1.7, ceiling-.55) + ring*.42;
      const r = .3+ring*.24;
      const ringMesh=new THREE.Mesh(new THREE.TorusGeometry(r,.022,10,40),brassMat); ringMesh.rotation.x=Math.PI/2; ringMesh.position.y=y; group.add(ringMesh);
      const dropCount=8+ring*3;
      for (let index=0; index<dropCount; index+=1) {
        const a=index/dropCount*Math.PI*2;
        const drop=new THREE.Mesh(new THREE.OctahedronGeometry(.045+ring*.012),new THREE.MeshPhysicalMaterial({color:"#f4f7ff",roughness:.05,metalness:.05,transmission:.6,thickness:.3,transparent:true,opacity:.85}));
        drop.position.set(Math.cos(a)*r,y-.09,Math.sin(a)*r); group.add(drop);
      }
    }
    const core=new THREE.Mesh(new THREE.SphereGeometry(.09,20,16),new THREE.MeshPhysicalMaterial({color:"#fff6df",roughness:.2,emissive:"#ffd9a0",emissiveIntensity:.7})); core.position.y=Math.max(1.75,ceiling-.4); group.add(core);
    const bulb=new THREE.PointLight(0xffe0b0,46,7,2); bulb.position.y=Math.max(1.8,ceiling-.4); group.add(bulb);
  } else if (object.category === "stairs") {
    // Floating contemporary stair: thin treads + central stringer + glass/metal guard.
    const count = 15; const stepDepth = object.depth / count; const treadThickness = .055;
    for (let index = 0; index < count; index += 1) {
      const h = object.height * (index + 1) / count;
      add(object.width, treadThickness, stepDepth * .9, wood, 0, h, -object.depth / 2 + stepDepth * (index + .5));
    }
    const stringerLength = Math.hypot(object.depth, object.height);
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(.13, .13, stringerLength), dark);
    stringer.position.set(0, object.height / 2, 0); stringer.rotation.x = -Math.atan2(object.height, object.depth); group.add(stringer);
    const railMat = pbrMaterial(project.materials.find((item)=>item.id==="mat-black"),"#2b2b29");
    const glassMat = pbrMaterial(project.materials.find((item)=>item.id==="mat-glass"),"#c6d9da",{transparent:true,opacity:.2});
    for (const side of [-1, 1]) {
      const handrail = new THREE.Mesh(new THREE.BoxGeometry(.035, .035, stringerLength), railMat);
      handrail.position.set(side * object.width * .48, object.height * .72, 0); handrail.rotation.x = -Math.atan2(object.height, object.depth); group.add(handrail);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.018, .72, object.depth * .9), glassMat);
      guard.position.set(side * object.width * .47, object.height * .47, 0); guard.rotation.x = -Math.atan2(object.height * .15, object.depth); group.add(guard);
    }
  } else if (/canapé|canape|sofa/.test(value)) {
    const baseMat = pbrMaterial(project.materials.find((item)=>item.id==="mat-walnut"),"#5f4635");
    addRound(object.width*.94, object.height*.16, object.depth*.76, .05, baseMat, 0, object.height*.16, .02);
    addRound(object.width*.9, object.height*.2, object.depth*.64, .08, material, 0, object.height*.3, -.015);
    const cushionCount = object.width > 2.15 ? 3 : 2; const cushionWidth = object.width*.82/cushionCount;
    for (let i=0;i<cushionCount;i++) addRound(cushionWidth*.92, object.height*.13, object.depth*.5, .07, material, -object.width*.41+cushionWidth*(i+.5), object.height*.43, -.035);
    addRound(object.width*.86, object.height*.43, object.depth*.16, .07, material, 0, object.height*.62, object.depth*.29);
    addRound(object.width*.1, object.height*.34, object.depth*.64, .055, material, -object.width*.46, object.height*.42, -.015);
    addRound(object.width*.1, object.height*.34, object.depth*.64, .055, material, object.width*.46, object.height*.42, -.015);
    const pillowMat=pbrMaterial(project.materials.find((item)=>item.id==="mat-rug"),"#e2d8ca");
    addRound(object.width*.18,object.height*.28,.12,.045,pillowMat,-object.width*.28,object.height*.66,object.depth*.18,-.12);
    addRound(object.width*.18,object.height*.28,.12,.045,pillowMat,object.width*.28,object.height*.66,object.depth*.18,.12);
    if (luxury) {
      const accent = pbrMaterial(project.materials.find((item)=>item.id==="mat-velvet"), "#8d8178");
      addRound(object.width*.15,object.height*.24,.11,.04,accent,0,object.height*.67,object.depth*.19,.06);
      const throwMat = pbrMaterial(project.materials.find((item)=>item.id==="mat-linen"), "#ded5c8");
      addRound(object.width*.34,.035,object.depth*.42,.018,throwMat,object.width*.20,object.height*.49,-object.depth*.04,.08);
    }
    for(const x of [-.39,.39]) add(.045,.11,.045,dark,x*object.width,.055,-object.depth*.24);
  } else if (/fauteuil|armchair/.test(value)) {
    addRound(object.width*.76, object.height*.2, object.depth*.68, .075, material, 0, object.height*.28, 0);
    addRound(object.width*.7, object.height*.43, object.depth*.16, .065, material, 0, object.height*.59, object.depth*.29);
    addRound(object.width*.11, object.height*.34, object.depth*.6, .05, material, -object.width*.4, object.height*.4, 0);
    addRound(object.width*.11, object.height*.34, object.depth*.6, .05, material, object.width*.4, object.height*.4, 0);
    for(const x of [-.3,.3]) add(.04,.14,.04,dark,x*object.width,.07,-object.depth*.22);
  } else if (/chaise|chair|tabouret|stool/.test(value)) {
    const seatH = Math.min(.48, object.height * .52);
    addRound(object.width * .8, .075, object.depth * .72, .035, material, 0, seatH, 0);
    if(!/tabouret|stool/.test(value)) addRound(object.width * .7, object.height * .4, .075, .03, material, 0, seatH + object.height * .23, object.depth * .31,-.04);
    for (const x of [-.3,.3]) for (const z of [-.27,.27]) add(.038, seatH*.96, .038, dark, x*object.width, seatH*.48, z*object.depth);
  } else if (/table basse|coffee table/.test(value)) {
    const topMat=/travertin|marbre/i.test(project.materials.find(m=>m.id===object.materialId)?.name||"") ? material : wood;
    if(/travertin|marbre/i.test(project.materials.find(m=>m.id===object.materialId)?.name||"")) {
      const top=createCylinder(Math.min(object.width,object.depth)*.47,Math.min(object.width,object.depth)*.47,object.height*.16,topMat,0,object.height*.78,0,48); top.scale.x=Math.max(1,object.width/Math.max(.01,object.depth)); group.add(top);
      const base=createCylinder(Math.min(object.width,object.depth)*.22,Math.min(object.width,object.depth)*.28,object.height*.66,topMat,0,object.height*.34,0,42); base.scale.x=1.15; group.add(base);
    } else {
      addRound(object.width, object.height*.14, object.depth, .055, topMat, 0, object.height*.82, 0);
      for (const x of [-.4,.4]) for (const z of [-.34,.34]) add(.045, object.height*.72, .045, dark, x*object.width, object.height*.36, z*object.depth);
    }
    if (luxury) {
      const brassMat = pbrMaterial(project.materials.find((item)=>item.id==="mat-brass"), "#a9844d");
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(.07,.095,.18,24), brassMat); vase.position.set(object.width*.18, object.height+.10, 0); group.add(vase);
      addRound(Math.min(.30,object.width*.26),.025,Math.min(.22,object.depth*.3),.008,pbrMaterial(project.materials.find((item)=>item.id==="mat-linen"),"#ded5c8"),-object.width*.18,object.height+.035,0,.08);
    }
  } else if (/bout de canapé|bout de canape|side table/.test(value)) {
    const top = createCylinder(Math.min(object.width,object.depth)*.48, Math.min(object.width,object.depth)*.48, .055, pbrMaterial(project.materials.find((item)=>item.id==="mat-dark-stone"),"#665e55"), 0, object.height-.035, 0, 36); group.add(top);
    const stem = createCylinder(.045,.065,Math.max(.2,object.height-.08),dark,0,(object.height-.08)/2,0,24); group.add(stem);
    const foot = createCylinder(Math.min(object.width,object.depth)*.28,Math.min(object.width,object.depth)*.32,.035,dark,0,.02,0,32); group.add(foot);
  } else if (/table repas|dining table|table/.test(value)) {
    addRound(object.width, .07, object.depth, .04, wood, 0, object.height-.035, 0);
    const legInset=.36; for (const x of [-legInset,legInset]) for (const z of [-.3,.3]) add(.055, object.height-.09, .055, dark, x*object.width, (object.height-.09)/2, z*object.depth);
    if (luxury) {
      const center = pbrMaterial(project.materials.find((item)=>item.id==="mat-brass"),"#a9844d");
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,.26,28),center); vase.position.y=object.height+.13; group.add(vase);
    }
  } else if (/tapis|rug/.test(value)) {
    addRound(object.width, .028, object.depth, .035, material, 0, .014, 0);
  } else if (/lit|bed/.test(value)) {
    const upholstery=pbrMaterial(project.materials.find((item)=>item.id==="mat-fabric"),"#d5c9b8"); const linen=pbrMaterial(project.materials.find((item)=>item.id==="mat-rug"),"#eee8de");
    addRound(object.width, .2, object.depth*.9, .055, upholstery, 0, .28, 0);
    addRound(object.width*.95, .17, object.depth*.84, .045, linen, 0, .45, 0);
    addRound(object.width, object.height*.86, .13, .05, material, 0, object.height*.46, object.depth*.44);
    addRound(object.width*.42,.12,.4,.055,linen,-object.width*.23,.59,object.depth*.26,-.04); addRound(object.width*.42,.12,.4,.055,linen,object.width*.23,.59,object.depth*.26,.04);
    const throwMat=pbrMaterial(project.materials.find((item)=>item.id==="mat-fabric"),"#baa990"); addRound(object.width*.82,.045,object.depth*.44,.025,throwMat,0,.58,-object.depth*.14);
    if (luxury) {
      const velvet=pbrMaterial(project.materials.find((item)=>item.id==="mat-velvet"),"#8d8178");
      addRound(object.width*.24,.14,.34,.055,velvet,-object.width*.14,.68,object.depth*.17,-.04);
      addRound(object.width*.24,.14,.34,.055,velvet, object.width*.14,.68,object.depth*.17,.04);
    }
  } else if (/penderie|wardrobe|bibliothèque|bibliotheque|bookshelf|shelf/.test(value)) {
    add(object.width, object.height, object.depth, wood, 0, object.height/2, 0);
    const accent = pbrMaterial(project.materials.find((item)=>item.id==="mat-brass"),"#a98953");
    for (let i=1;i<4;i++) add(object.width*.86,.025,object.depth*.82,accent,0,object.height*i/4,0);
  } else if (/bureau|desk/.test(value)) {
    add(object.width, .075, object.depth, wood, 0, object.height-.04, 0);
    add(.075, object.height-.08, object.depth*.82, dark, -object.width*.4, (object.height-.08)/2, 0);
    add(.075, object.height-.08, object.depth*.82, dark, object.width*.4, (object.height-.08)/2, 0);
  } else if (/banquette|bench/.test(value)) {
    add(object.width, object.height*.36, object.depth, material, 0, object.height*.3, 0);
    for (const x of [-.4,.4]) add(.055, object.height*.45, .055, dark, x*object.width, object.height*.22, 0);
  } else if (/meuble vasque|vanity/.test(value)) {
    add(object.width, object.height*.72, object.depth, wood, 0, object.height*.36, 0);
    const basin=new THREE.Mesh(new THREE.CylinderGeometry(object.width*.18,object.width*.2,.1,24),pbrMaterial(undefined,"#f2f0ea")); basin.position.y=object.height*.76; group.add(basin);
  } else if (/douche|shower/.test(value)) {
    const glass=pbrMaterial(project.materials.find((item)=>item.id==="mat-glass"),"#c5d9dd",{transparent:true,opacity:.22});
    add(object.width,.035,object.depth,glass,0,.02,0); add(.025,object.height,object.depth,glass,-object.width*.48,object.height/2,0); add(object.width,object.height,.025,glass,0,object.height/2,-object.depth*.48);
  } else if (/\bwc\b|toilet/.test(value)) {
    const ceramic=pbrMaterial(undefined,"#f4f2ee");
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(object.width*.32,object.width*.38,object.height*.32,24),ceramic); bowl.scale.z=1.35; bowl.position.y=object.height*.18; group.add(bowl); add(object.width*.7,object.height*.5,object.depth*.28,ceramic,0,object.height*.38,object.depth*.28);
  } else if (/meuble tv/.test(value)) {
    addRound(object.width, object.height*.68, object.depth, .025, wood, 0, object.height*.34, 0);
    for(let i=-1;i<=1;i++) add(.012,object.height*.55,object.depth*.82,dark,i*object.width*.27,object.height*.35,0);
    const screenMat=new THREE.MeshPhysicalMaterial({color:"#111111",roughness:.12,metalness:.1,clearcoat:.32}); addRound(object.width*.62,object.height*.95,.035,.018,screenMat,0,object.height*1.2,-.02);
  } else if (/console|buffet|sideboard/.test(value)) {
    addRound(object.width, object.height*.72, object.depth, .03, wood, 0, object.height*.36, 0);
    const brassMat=pbrMaterial(project.materials.find((item)=>item.id==="mat-brass"),"#a9844d");
    for(let i=-1;i<=1;i++) add(.012,object.height*.52,object.depth*.78,brassMat,i*object.width*.27,object.height*.38,0);
    if (luxury || /décor|decor/.test(value)) {
      const vase=new THREE.Mesh(new THREE.CylinderGeometry(.06,.095,.22,24),brassMat); vase.position.set(object.width*.22,object.height+.11,0); group.add(vase);
      const bookMat=pbrMaterial(project.materials.find((item)=>item.id==="mat-linen"),"#ded5c8");
      addRound(.28,.028,.20,.008,bookMat,-object.width*.18,object.height+.02,0,.06);
    }
  } else if (/suspension|pendant/.test(value)) {
    const room=project.plan.rooms.find((item)=>item.id===object.roomId);
    const ceiling=Math.max(2.4,room?.ceilingHeight || project.plan.wallHeight);
    const brassMat=pbrMaterial(project.materials.find((item)=>item.id==="mat-brass"),"#a9844d");
    const fabric=pbrMaterial(project.materials.find((item)=>item.id==="mat-linen"),"#ded5c8");
    const cord=createCylinder(.012,.012,Math.max(.35,ceiling-object.height-.35),dark,0,ceiling-Math.max(.35,ceiling-object.height-.35)/2,0,16); group.add(cord);
    const canopy=createCylinder(.09,.11,.035,brassMat,0,ceiling-.02,0,24); group.add(canopy);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(Math.max(.16,object.width*.38),Math.max(.24,object.height*.26),40,1,true),fabric); shade.position.y=Math.max(1.75,ceiling-.72); group.add(shade);
    const bulb=new THREE.PointLight(0xffd4a2,34,5.2,2); bulb.position.y=Math.max(1.7,ceiling-.78); group.add(bulb);
  } else if (/lampe|lampadaire|luminaire/.test(value) || object.category === "lighting") {
    const stem = createCylinder(.018,.026,Math.max(.5,object.height*.68),dark,0,object.height*.37,0,24); group.add(stem);
    const base=createCylinder(object.width*.22,object.width*.25,.035,dark,0,.018,0,36); group.add(base);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(object.width*.36,object.height*.24,36,1,true), pbrMaterial(project.materials.find((item)=>item.id==="mat-linen" || item.id==="mat-rug"),"#eadfcd")); shade.position.y=object.height*.82; group.add(shade);
    const bulb=new THREE.PointLight(0xffd8aa,28,4.2,2); bulb.position.y=object.height*.77; group.add(bulb);
  } else if (/plante|ficus/.test(value) || object.category === "plant") {
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(object.width*.22,object.width*.3,object.height*.28,20),pbrMaterial(undefined,"#8b6d55")); pot.position.y=object.height*.14; group.add(pot);
    const leafMat=new THREE.MeshStandardMaterial({color:"#456447",roughness:.9});
    for(let i=0;i<9;i++){ const leaf=new THREE.Mesh(new THREE.SphereGeometry(object.width*(.16+((i%3)*.035)),16,12),leafMat); const a=i/9*Math.PI*2; leaf.scale.y=1.45; leaf.position.set(Math.cos(a)*object.width*.22,object.height*(.48+.05*(i%4)),Math.sin(a)*object.depth*.22); group.add(leaf); }
  } else if (/îlot|ilot|island/.test(value) || object.category === "kitchen") {
    const body=pbrMaterial(project.materials.find(m=>m.id==="mat-walnut"),"#73513a"); const stone=pbrMaterial(project.materials.find(m=>m.id==="mat-marble"),"#e4dfd5");
    addRound(object.width*.96, object.height*.88, object.depth*.92, .025, body,0,object.height*.44,0); addRound(object.width*1.04,.065,object.depth*1.04,.022,stone,0,object.height+.012,0);
    const sink=new THREE.Mesh(new THREE.BoxGeometry(object.width*.26,.03,object.depth*.36),pbrMaterial(project.materials.find(m=>m.id==="mat-black"),"#282826")); sink.position.set(object.width*.22,object.height+.055,0); group.add(sink);
  } else {
    add(object.width, object.height, object.depth, material, 0, object.height/2, 0); group.userData.sophenicPlaceholder = true;
  }
  group.position.set(cx, baseY, cz); group.rotation.y = -object.rotation; group.userData.sophenicRoomId = object.roomId; group.userData.sophenicLevel = object.level || project.plan.rooms.find((room) => room.id === object.roomId)?.level || 0; attachSelection(group, { kind: "object", id: object.id }); return group;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }
function normalizedPath(value: string): string { return value.replace(/\\/g, "/").replace(/^\.\//, ""); }

async function loadAssetGroup(project: DesignProject, object: DesignObject): Promise<THREE.Group> {
  if (!object.asset?.cacheId || object.asset.status !== "ready") return createProceduralObject(project, object);
  const api = window.sophenicDesktop?.design; if (!api?.assetBundle) throw new Error("Bridge Asset Engine indisponible.");
  const bundle = await api.assetBundle(object.asset.cacheId) as AssetBundle;
  const urls = new Map<string, string>();
  let dracoLoader: DRACOLoader | null = null;
  try {
    for (const file of bundle.files) {
      const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes as ArrayBuffer);
      const blob = new Blob([asArrayBuffer(bytes)], { type: file.mime || "application/octet-stream" }); urls.set(normalizedPath(file.path), URL.createObjectURL(blob));
    }
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const clean = normalizedPath(decodeURIComponent(url.split("?")[0]));
      if (urls.has(clean)) return urls.get(clean)!;
      const match = [...urls.entries()].find(([key]) => clean.endsWith(key) || key.endsWith(clean));
      return match?.[1] || url;
    });
    const loader = new GLTFLoader(manager); loader.setMeshoptDecoder(MeshoptDecoder);
    dracoLoader = new DRACOLoader(manager); dracoLoader.setDecoderPath("/sophenic-draco/"); loader.setDRACOLoader(dracoLoader);
    const entry = bundle.files.find((file) => normalizedPath(file.path) === normalizedPath(bundle.entryPath));
    if (!entry) throw new Error("Entrée GLTF absente du bundle.");
    const loaded = await new Promise<THREE.Group>((resolve, reject) => {
      const done = (gltf: { scene: THREE.Group }) => resolve(gltf.scene);
      const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes as ArrayBuffer);
      if (bundle.format === "glb") loader.parse(asArrayBuffer(bytes), "", done, reject);
      else loader.parse(new TextDecoder().decode(bytes), "", done, reject);
    });
    loaded.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true; child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
          material.envMapIntensity = Math.max(material.envMapIntensity || 0, .72);
          material.needsUpdate = true;
        }
      }
    });
    const before = new THREE.Box3().setFromObject(loaded); const size = before.getSize(new THREE.Vector3());
    const scaleX = object.width / Math.max(0.001, size.x); const scaleY = object.height / Math.max(0.001, size.y); const scaleZ = object.depth / Math.max(0.001, size.z);
    // Preserve the creator's proportions; the object dimensions are a placement
    // envelope, not permission to squash/stretch the downloaded model.
    const uniformScale = Math.max(.0001, Math.min(scaleX, scaleY, scaleZ));
    loaded.scale.setScalar(uniformScale); loaded.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(loaded); const center = fitted.getCenter(new THREE.Vector3()); const minY = fitted.min.y;
    const group = new THREE.Group(); group.add(loaded);
    loaded.position.x -= center.x; loaded.position.z -= center.z; loaded.position.y -= minY;
    group.position.set(worldX(project, object.x + object.width / 2), roomElevation(project, object.level || project.plan.rooms.find((room) => room.id === object.roomId)?.level || 0), worldZ(project, object.y + object.depth / 2)); group.rotation.y = -object.rotation; group.userData.sophenicRoomId = object.roomId; group.userData.sophenicLevel = object.level || project.plan.rooms.find((room) => room.id === object.roomId)?.level || 0;
    attachSelection(group, { kind: "object", id: object.id }); return group;
  } finally {
    dracoLoader?.dispose();
    window.setTimeout(() => { for (const url of urls.values()) URL.revokeObjectURL(url); }, 1000);
  }
}

function createArchitecturalLighting(project: DesignProject): THREE.Group {
  const group = new THREE.Group(); group.name = "SophenicArchitectureLighting";
  const ambience = project.architecture?.ambience || "day";
  const warm = ambience === "evening" ? 0xffc58d : ambience === "soft" ? 0xffd8b0 : 0xffe4bd;
  const intensity = ambience === "evening" ? 36 : ambience === "soft" ? 22 : 13;
  const fixtureMaterial = new THREE.MeshPhysicalMaterial({ color: "#f4efe7", roughness: .46, metalness: .04, emissive: new THREE.Color(warm), emissiveIntensity: ambience === "evening" ? .48 : .22 });
  for (const room of project.plan.rooms) {
    const ceiling = roomElevation(project, room) + (room.ceilingHeight || project.plan.wallHeight) - .08;
    const countX = room.width > 4.8 ? 2 : 1; const countZ = room.height > 4.4 ? 2 : 1;
    for (let ix = 0; ix < countX; ix += 1) for (let iz = 0; iz < countZ; iz += 1) {
      const x = room.x + room.width * ((ix + 1) / (countX + 1)); const z = room.y + room.height * ((iz + 1) / (countZ + 1));
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .018, 24), fixtureMaterial);
      fixture.rotation.x = Math.PI / 2; fixture.position.set(worldX(project, x), ceiling, worldZ(project, z)); fixture.userData.sophenicRoomId = room.id; fixture.userData.sophenicLevel = room.level || 0; group.add(fixture);
      const light = new THREE.PointLight(warm, intensity, Math.max(3.2, Math.min(6.8, Math.max(room.width, room.height) * 1.2)), 2.1);
      light.position.set(worldX(project, x), ceiling - .12, worldZ(project, z)); light.userData.sophenicRoomId = room.id; light.userData.sophenicLevel = room.level || 0; group.add(light);
    }
  }
  return group;
}

function applyInteriorVisibility(root: THREE.Group, mode: "exterior" | "interior", room: DesignRoom | undefined): void {
  root.traverse((object) => {
    const level = typeof object.userData.sophenicLevel === "number" ? object.userData.sophenicLevel as number : undefined;
    const ceilingRoomId = typeof object.userData.sophenicCeilingRoomId === "string" ? object.userData.sophenicCeilingRoomId as string : undefined;
    if (mode === "exterior") { object.visible = true; return; }
    if (!room) { object.visible = true; return; }
    if (level !== undefined && level !== (room.level || 0)) { object.visible = false; return; }
    if (ceilingRoomId === room.id) { object.visible = false; return; }
    object.visible = true;
  });
}

function styleSceneForAmbience(scene: THREE.Scene, renderer: THREE.WebGLRenderer, project: DesignProject): void {
  const ambience = project.architecture?.ambience || "day";
  if (ambience === "evening") {
    scene.background = new THREE.Color("#242830"); scene.fog = new THREE.Fog("#242830", 34, 105); renderer.toneMappingExposure = .92;
  } else if (ambience === "soft") {
    scene.background = new THREE.Color("#d9d5cf"); scene.fog = new THREE.Fog("#d9d5cf", 44, 125); renderer.toneMappingExposure = 1.0;
  } else {
    scene.background = new THREE.Color("#dce7ec"); scene.fog = new THREE.Fog("#dce7ec", 44, 125); renderer.toneMappingExposure = 1.04;
  }
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      for (const key of Object.keys(material)) { const value = (material as unknown as Record<string, unknown>)[key]; if (value instanceof THREE.Texture) value.dispose(); }
      material.dispose();
    }
  });
}

export function ArchitectureViewport3D({ project, mode, activeRoomId, onActiveRoom, selection, onSelection }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null); const runtimeRef = useRef<SceneRuntime | null>(null); const modeRef = useRef(mode);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: boolean; pointerId: number } | null>(null);
  const yawRef = useRef(0); const pitchRef = useRef(0); const suppressClickUntilRef = useRef(0); const onSelectionRef = useRef(onSelection);
  const [yaw, setYaw] = useState(0); const [pitch, setPitch] = useState(0); const [nodeIndex, setNodeIndex] = useState(0); const [assetLoading, setAssetLoading] = useState(0); const [assetErrors, setAssetErrors] = useState<string[]>([]);
  const roomOrder = useMemo(() => (project.architecture?.roomOrder || []).map((id) => project.plan.rooms.find((room) => room.id === id)).filter((room): room is DesignRoom => Boolean(room)).concat(project.plan.rooms.filter((room) => !(project.architecture?.roomOrder || []).includes(room.id))), [project.architecture?.roomOrder, project.plan.rooms]);
  const activeRoom = roomOrder.find((room) => room.id === activeRoomId) || roomOrder[0]; const activeRoomIndex = Math.max(0, roomOrder.findIndex((room) => room.id === activeRoom?.id)); const nodes = activeRoom?.navigationNodes || [];

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { yawRef.current = yaw; }, [yaw]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { onSelectionRef.current = onSelection; }, [onSelection]);
  useEffect(() => { if (mode === "interior" && activeRoom && activeRoom.id !== activeRoomId) onActiveRoom(activeRoom.id); }, [activeRoom, activeRoomId, mode, onActiveRoom]);
  useEffect(() => { setNodeIndex(0); setYaw(activeRoom?.navigationNodes?.[0]?.yaw || 0); setPitch(0); }, [activeRoom?.id]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04; host.appendChild(renderer.domElement); styleSceneForAmbience(scene, renderer, project);
    const camera = new THREE.PerspectiveCamera(56, 1, 0.035, 220); const span = Math.max(project.plan.width, project.plan.height); const totalHeight = Math.max(project.plan.wallHeight, (project.architecture?.levels?.length || 1) * (project.plan.wallHeight + .28)); camera.position.set(span * 0.92, Math.max(span * .6, totalHeight * .86), span * 0.92);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .075; controls.enablePan = false; controls.minDistance = Math.max(4, span * 0.46); controls.maxDistance = Math.max(18, span * 3.1); controls.minPolarAngle = 0.12; controls.maxPolarAngle = Math.PI / 2 - 0.045; controls.target.set(0, ((project.architecture?.levels?.length || 1) * (project.plan.wallHeight + .28)) * .42, 0);
    const root = new THREE.Group(); root.name = "SophenicArchitectureRoot"; scene.add(root);
    const lighting = new THREE.Group(); lighting.name = "SophenicLighting"; scene.add(lighting);

    const hemi = new THREE.HemisphereLight(0xfffaf1, 0x758071, project.architecture?.ambience === "evening" ? 1.05 : 1.55); scene.add(hemi);
    const sun = new THREE.DirectionalLight(project.architecture?.ambience === "evening" ? 0xffc887 : 0xffedcf, project.architecture?.ambience === "evening" ? 1.7 : 3.0); sun.position.set(-14, 20, 11); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -28; sun.shadow.camera.right = 28; sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28; sun.shadow.bias = -.00035; sun.shadow.normalBias = .02; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdce9ff, .7); fill.position.set(10, 8, -12); scene.add(fill);

    const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader(); const environment = pmrem.fromScene(new RoomEnvironment(), .04); scene.environment = environment.texture; pmrem.dispose();
    const groundMaterial = new THREE.MeshPhysicalMaterial({ color: project.architecture?.ambience === "evening" ? "#62675e" : "#89957e", roughness: .98 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(70, span * 7), Math.max(70, span * 7)), groundMaterial); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.095; ground.receiveShadow = true; scene.add(ground);

    const composer = new EffectComposer(renderer); composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); composer.addPass(new RenderPass(scene, camera));
    const ssao = new SSAOPass(scene, camera, 1, 1); ssao.kernelRadius = 9; ssao.minDistance = .002; ssao.maxDistance = .18; composer.addPass(ssao); composer.addPass(new OutputPass());
    const resize = () => { const rect = host.getBoundingClientRect(); const width = Math.max(1, rect.width), height = Math.max(1, rect.height); renderer.setSize(width, height, false); composer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
    let animationId = 0; const render = () => { if (modeRef.current === "exterior") controls.update(); composer.render(); animationId = requestAnimationFrame(render); }; render();
    runtimeRef.current = { renderer, composer, scene, camera, controls, root, lighting, animationId, resizeObserver, environmentTexture: environment.texture };
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const pointerDown = (event: PointerEvent) => {
      if (modeRef.current !== "interior" || event.button !== 0) return;
      event.preventDefault();
      host.focus({ preventScroll: true });
      dragRef.current = { x: event.clientX, y: event.clientY, yaw: yawRef.current, pitch: pitchRef.current, moved: false, pointerId: event.pointerId };
      renderer.domElement.setPointerCapture?.(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const pointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (modeRef.current !== "interior" || !drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      const nextYaw = drag.yaw - dx * 0.006;
      const nextPitch = Math.max(-1.08, Math.min(1.08, drag.pitch - dy * 0.0044));
      yawRef.current = nextYaw; pitchRef.current = nextPitch; setYaw(nextYaw); setPitch(nextPitch);
    };
    const pointerEnd = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.moved) suppressClickUntilRef.current = Date.now() + 180;
      try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch {}
      dragRef.current = null; renderer.domElement.style.cursor = modeRef.current === "interior" ? "grab" : "default";
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntilRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect(); const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(root.children, true); let selected: ArchitectureSelection = null;
      for (const hit of hits) { let current: THREE.Object3D | null = hit.object; while (current) { if (current.userData.sophenicSelection) { selected = current.userData.sophenicSelection as ArchitectureSelection; break; } current = current.parent; } if (selected) break; }
      onSelectionRef.current(selected);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerEnd);
    renderer.domElement.addEventListener("pointercancel", pointerEnd);
    renderer.domElement.addEventListener("click", click);
    return () => {
      renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", pointerMove); renderer.domElement.removeEventListener("pointerup", pointerEnd); renderer.domElement.removeEventListener("pointercancel", pointerEnd); renderer.domElement.removeEventListener("click", click);
      resizeObserver.disconnect(); cancelAnimationFrame(animationId); controls.dispose(); disposeObject(root); disposeObject(lighting); scene.remove(root); scene.remove(lighting); environment.texture.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove(); runtimeRef.current = null;
    };
  }, [project.architecture?.ambience, project.id, project.plan.height, project.plan.width, project.plan.wallHeight]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return; const { root, lighting, scene, renderer } = runtime;
    while (root.children.length) { const child = root.children[0]; root.remove(child); disposeObject(child); }
    while (lighting.children.length) { const child = lighting.children[0]; lighting.remove(child); disposeObject(child); }
    styleSceneForAmbience(scene, renderer, project);
    for (const room of project.plan.rooms) { for (const mesh of createRoomMeshes(project, room)) root.add(mesh); const styling = createRoomStyling(project, room); if (styling.children.length) root.add(styling); }
    for (const wall of project.plan.walls) for (const mesh of wallSegments(project, wall)) root.add(mesh);
    const roomLighting = createArchitecturalLighting(project); while (roomLighting.children.length) lighting.add(roomLighting.children[0]);
    const procedural = project.plan.objects.filter((object) => object.category === "stairs" || !object.asset?.cacheId || object.asset.status !== "ready");
    procedural.forEach((object) => root.add(createProceduralObject(project, object)));
    applyInteriorVisibility(root, modeRef.current, activeRoom); applyInteriorVisibility(lighting, modeRef.current, activeRoom);
    const assets = project.plan.objects.filter((object) => object.asset?.cacheId && object.asset.status === "ready");
    let cancelled = false; setAssetLoading(assets.length); setAssetErrors([]);
    void Promise.allSettled(assets.map(async (object) => {
      const group = await loadAssetGroup(project, object);
      if (!cancelled) { root.add(group); applyInteriorVisibility(root, modeRef.current, activeRoom); }
    })).then((results) => { if (cancelled) return; setAssetLoading(0); setAssetErrors(results.flatMap((result, index) => result.status === "rejected" ? [`${assets[index]?.name || "Asset"}: ${result.reason instanceof Error ? result.reason.message : "chargement impossible"}`] : [])); });
    return () => { cancelled = true; };
  }, [project]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return;
    applyInteriorVisibility(runtime.root, mode, activeRoom); applyInteriorVisibility(runtime.lighting, mode, activeRoom);
  }, [activeRoom?.id, mode, project.revision]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return; const { camera, controls } = runtime; const span = Math.max(project.plan.width, project.plan.height);
    if (mode === "exterior") {
      controls.enabled = true; runtime.renderer.domElement.style.cursor = "grab"; camera.up.set(0, 1, 0); camera.fov = 58; camera.updateProjectionMatrix();
      if (camera.position.length() < 3) camera.position.set(span * .95, Math.max(span * .62, (project.architecture?.levels?.length || 1) * (project.plan.wallHeight + .28) * .82), span * .95); controls.target.set(0, ((project.architecture?.levels?.length || 1) * (project.plan.wallHeight + .28)) * .42, 0); controls.update();
    } else {
      controls.enabled = false; runtime.renderer.domElement.style.cursor = dragRef.current ? "grabbing" : "grab"; const node = nodes[Math.min(nodeIndex, Math.max(0, nodes.length - 1))]; if (!node || !activeRoom) return;
      const baseY = roomElevation(project, activeRoom); camera.up.set(0, 1, 0); camera.position.set(worldX(project, node.x), baseY + Math.max(1.55, Math.min(1.72, node.eyeHeight || 1.62)), worldZ(project, node.y)); camera.rotation.order = "YXZ"; camera.rotation.set(Math.max(-1.08, Math.min(1.08, pitch)), yaw, 0, "YXZ"); camera.fov = 62; camera.updateProjectionMatrix();
    }
  }, [activeRoom, mode, nodeIndex, nodes, pitch, project, yaw]);

  const goToRoom = (roomId: string) => { const next = roomOrder.find((room) => room.id === roomId); if (!next) return; onActiveRoom(next.id); setNodeIndex(0); const nextYaw = next.navigationNodes?.[0]?.yaw || 0; yawRef.current = nextYaw; pitchRef.current = 0; setYaw(nextYaw); setPitch(0); };
  const switchRoom = (delta: number) => { if (!roomOrder.length) return; const next = roomOrder[(activeRoomIndex + delta + roomOrder.length) % roomOrder.length]; goToRoom(next.id); };
  const moveNode = (delta: number) => { if (!nodes.length) return; setNodeIndex((index) => Math.max(0, Math.min(nodes.length - 1, index + delta))); };
  const resetExterior = () => { const runtime = runtimeRef.current; if (!runtime) return; const span = Math.max(project.plan.width, project.plan.height); runtime.camera.position.set(span * .95, Math.max(span * .62, (project.architecture?.levels?.length || 1) * (project.plan.wallHeight + .28) * .82), span * .95); runtime.controls.target.set(0, ((project.architecture?.levels?.length || 1) * (project.plan.wallHeight + .28)) * .42, 0); runtime.controls.update(); };

  return <div ref={hostRef} tabIndex={0} className="relative h-full min-h-[520px] overflow-hidden rounded-2xl border border-black/10 bg-[#d9dde2] outline-none focus:ring-2 focus:ring-[#9a7138]/30 dark:border-white/10" onKeyDown={(event) => { if (mode !== "interior") return; if (event.key === "ArrowUp") { event.preventDefault(); moveNode(1); } else if (event.key === "ArrowDown") { event.preventDefault(); moveNode(-1); } else if (event.key === "ArrowLeft") { event.preventDefault(); setYaw((value) => value + Math.PI / 12); } else if (event.key === "ArrowRight") { event.preventDefault(); setYaw((value) => value - Math.PI / 12); } }}>
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
      {mode === "interior" && activeRoom ? <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-black/10 bg-white/94 p-1.5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/94"><button type="button" onClick={() => switchRoom(-1)} className="grid size-9 place-items-center rounded-xl text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" title="Pièce précédente"><ArrowLeft className="size-4" /></button><div className="min-w-44 px-1 text-center"><div className="text-[8px] font-bold uppercase tracking-[.18em] text-zinc-400">{(activeRoom.level || 0) > 0 ? `ÉTAGE ${activeRoom.level}` : "REZ-DE-CHAUSSÉE"} · PIÈCE {activeRoomIndex + 1}/{roomOrder.length}</div><select aria-label="Changer de pièce" value={activeRoom.id} onChange={(event) => goToRoom(event.target.value)} className="mt-0.5 h-7 w-full max-w-56 rounded-lg border border-black/[.07] bg-white px-2 text-center text-[11px] font-semibold text-zinc-700 outline-none hover:border-[#b58a55] dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100">{roomOrder.map((room) => <option key={room.id} value={room.id}>{(room.level || 0) > 0 ? `Étage ${room.level} · ` : "RDC · "}{room.name}</option>)}</select></div><button type="button" onClick={() => switchRoom(1)} className="grid size-9 place-items-center rounded-xl text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" title="Pièce suivante"><ArrowRight className="size-4" /></button></div> : <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-[10px] font-semibold text-zinc-600 shadow-xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-300"><Home className="size-3.5" />Extérieur 360° <button type="button" onClick={resetExterior} className="ml-1 grid size-7 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" title="Réinitialiser"><RotateCcw className="size-3.5" /></button></div>}
    </div>
    {mode === "interior" && <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-black/10 bg-white/92 p-2 shadow-xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/92"><div className="mb-1 text-center text-[8px] font-bold uppercase tracking-[.14em] text-zinc-400">Navigation contrôlée · point {Math.min(nodeIndex + 1, Math.max(1, nodes.length))}/{Math.max(1, nodes.length)}</div><div className="grid grid-cols-3 gap-1"><span /><button type="button" disabled={nodeIndex >= nodes.length - 1} onClick={() => moveNode(1)} className="grid size-9 place-items-center rounded-xl bg-[#76572f] text-white disabled:opacity-25" title="Avancer"><ArrowUp className="size-4" /></button><span /><button type="button" onClick={() => setYaw((value) => value + Math.PI / 12)} className="grid size-9 place-items-center rounded-xl bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"><ArrowLeft className="size-4" /></button><button type="button" disabled={nodeIndex <= 0} onClick={() => moveNode(-1)} className="grid size-9 place-items-center rounded-xl bg-black/5 text-zinc-600 disabled:opacity-25 dark:bg-white/10 dark:text-zinc-300" title="Reculer"><ArrowDown className="size-4" /></button><button type="button" onClick={() => setYaw((value) => value - Math.PI / 12)} className="grid size-9 place-items-center rounded-xl bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"><ArrowRight className="size-4" /></button></div></div>}
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-sm rounded-xl border border-black/10 bg-white/86 px-3 py-2 text-[9px] leading-4 text-zinc-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/86 dark:text-zinc-400">{mode === "exterior" ? "Glisser : tourner autour de la maison · Molette : zoom · la caméra reste contrainte autour du bâtiment." : "Maintiens le clic gauche et glisse : regarder librement à 360° · menu du haut : changer de pièce à tout moment · ↑/↓ : changer de point sans traverser les murs."}</div>
    {assetLoading > 0 && <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-xl bg-zinc-950/80 px-3 py-2 text-[9px] text-white"><Loader2 className="size-3.5 animate-spin" />Chargement de {assetLoading} asset(s) 3D…</div>}
    {assetErrors.length > 0 && <div className="absolute bottom-3 right-3 z-20 max-w-xs rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-[9px] leading-4 text-red-700 shadow-sm">{assetErrors.slice(0, 2).join(" · ")}</div>}
    {selection && <div className={cn("absolute right-3 top-14 z-20 rounded-xl border border-black/10 bg-white/88 px-3 py-2 text-[9px] font-semibold text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/88 dark:text-zinc-300")}>Sélection : {selection.kind}</div>}
  </div>;
}
