"use client";

/**
 * SOPHENIC MODEL 3D ENGINE — visionneuse interactive (V8.5).
 *
 * Charge un modèle du cache Sketchfab (GLB/GLTF, Draco + Meshopt) et le
 * présente avec une caméra libre façon Blender : orbite (clic gauche),
 * déplacement (clic droit / milieu), zoom vers le curseur (molette),
 * amortissement fluide. Auto-cadrage sur le modèle, grille au sol,
 * environnement PBR studio, badge « ✦ SOPHENIC AI ».
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Box, Loader2 } from "lucide-react";

type AssetBundleFile = { path: string; mime: string; bytes: Uint8Array };
type AssetBundle = { cacheId: string; entryPath: string; format: "gltf" | "glb"; files: AssetBundleFile[] };

export type Model3DViewerInfo = {
  cacheId: string;
  name: string;
  author?: string;
  license?: string;
  faceCount?: number;
  sourceUrl?: string;
};

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }
function normalizedPath(value: string): string { return value.replace(/\\/g, "/").replace(/^\.\//, ""); }

export function Model3DViewer({ model }: { model: Model3DViewerInfo | null }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !model) return;
    const api = window.sophenicDesktop?.design;
    if (!api?.assetBundle) { setError("La visionneuse 3D nécessite l'application SOPHENIC (moteur Sketchfab)."); return; }
    let disposed = false;
    const objectUrls: string[] = [];
    const runtime: {
      animationId?: number;
      renderer?: THREE.WebGLRenderer;
      controls?: OrbitControls;
      dracoLoader?: DRACOLoader;
      grid?: THREE.GridHelper;
      observer?: ResizeObserver;
      pmrem?: THREE.PMREMGenerator;
    } = {};

    setError("");
    setLoading(true);

    const run = async () => {
      try {
        const bundle = await api.assetBundle(model.cacheId) as AssetBundle;
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#141311");

        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        const camera = new THREE.PerspectiveCamera(42, width / height, .01, 2000);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        runtime.renderer = renderer;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        mount.appendChild(renderer.domElement);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "none";

        // Environnement PBR studio (réflexions matériaux).
        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new RoomEnvironment(), .04);
        scene.environment = environment.texture;

        const lighting = new THREE.Group();
        const key = new THREE.DirectionalLight(0xfff4e2, 2.2); key.position.set(4, 7, 5); lighting.add(key);
        const fill = new THREE.DirectionalLight(0xd9e6ff, .9); fill.position.set(-6, 3, -4); lighting.add(fill);
        lighting.add(new THREE.HemisphereLight(0xf5efe4, 0x2a2622, .55));
        scene.add(lighting);

        // Chargement du bundle : blob URLs + LoadingManager pour les dépendances.
        const urls = new Map<string, string>();
        for (const file of bundle.files) {
          const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes as ArrayBuffer);
          const blob = new Blob([asArrayBuffer(bytes)], { type: file.mime || "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          urls.set(normalizedPath(file.path), url);
          objectUrls.push(url);
        }
        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          const clean = normalizedPath(decodeURIComponent(url.split("?")[0]));
          if (urls.has(clean)) return urls.get(clean)!;
          const match = [...urls.entries()].find(([key]) => clean.endsWith(key) || key.endsWith(clean));
          return match?.[1] || url;
        });
        const loader = new GLTFLoader(manager);
        loader.setMeshoptDecoder(MeshoptDecoder);
        const dracoLoader = new DRACOLoader(manager);
        dracoLoader.setDecoderPath("/sophenic-draco/");
        loader.setDRACOLoader(dracoLoader);
        runtime.dracoLoader = dracoLoader;
        const entry = bundle.files.find((file) => normalizedPath(file.path) === normalizedPath(bundle.entryPath));
        if (!entry) throw new Error("Entrée GLTF absente du bundle.");
        const group = await new Promise<THREE.Group>((resolve, reject) => {
          const done = (gltf: { scene: THREE.Group }) => resolve(gltf.scene);
          const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes as ArrayBuffer);
          if (bundle.format === "glb") loader.parse(asArrayBuffer(bytes), "", done, reject);
          else loader.parse(new TextDecoder().decode(bytes), "", done, reject);
        });
        if (disposed) return;

        group.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.castShadow = false;
          child.receiveShadow = false;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
              material.envMapIntensity = Math.max(material.envMapIntensity || 0, .85);
              material.needsUpdate = true;
            }
          }
        });
        scene.add(group);

        // Auto-cadrage : centre + distance focale sur la boîte englobante.
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const distance = (maxDim / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.5;
        camera.near = Math.max(.001, distance / 400);
        camera.far = distance * 60;
        camera.position.set(center.x + distance * .72, center.y + distance * .5, center.z + distance * .72);
        camera.updateProjectionMatrix();

        // Grille au sol, à la base du modèle (repère façon blender).
        const grid = new THREE.GridHelper(maxDim * 3, 24, 0x8a7a5c, 0x3a352d);
        runtime.grid = grid;
        grid.position.set(center.x, box.min.y, center.z);
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = .5;
        scene.add(grid);

        // Caméra libre façon Blender : orbite + PAN + zoom vers le curseur.
        const controls = new OrbitControls(camera, renderer.domElement);
        runtime.controls = controls;
        controls.enableDamping = true;
        controls.dampingFactor = .08;
        controls.enablePan = true;
        controls.panSpeed = .9;
        controls.rotateSpeed = .85;
        controls.zoomSpeed = 1;
        controls.zoomToCursor = true;
        controls.screenSpacePanning = true;
        controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
        controls.target.copy(center);
        controls.minDistance = maxDim * .12;
        controls.maxDistance = distance * 12;
        controls.update();

        const resize = () => {
          if (disposed || !renderer) return;
          const w = Math.max(1, mount.clientWidth);
          const h = Math.max(1, mount.clientHeight);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(mount);
        runtime.observer = observer;

        const render = () => {
          if (disposed) return;
          runtime.controls?.update();
          renderer.render(scene, camera);
          runtime.animationId = requestAnimationFrame(render);
        };
        setLoading(false);
        render();
      } catch (cause) {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : "Modèle 3D impossible à charger.");
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      disposed = true;
      if (runtime.animationId) cancelAnimationFrame(runtime.animationId);
      runtime.observer?.disconnect();
      runtime.pmrem?.dispose();
      runtime.controls?.dispose();
      runtime.dracoLoader?.dispose();
      if (runtime.grid) { runtime.grid.geometry.dispose(); (runtime.grid.material as THREE.Material).dispose(); }
      runtime.renderer?.dispose();
      if (runtime.renderer?.domElement.parentElement === mount) mount.removeChild(runtime.renderer.domElement);
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [model]);

  if (!model) {
    return <div className="grid h-full place-items-center rounded-2xl border border-black/[.07] bg-[#faf8f4] text-center dark:border-white/[.07] dark:bg-[#141414]">
      <div className="px-8">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eee3d2] text-[#805c32] dark:bg-white/10"><Box className="size-6" /></div>
        <p className="mt-3 text-[11px] font-semibold">Aucun modèle en cours d’exploration</p>
        <p className="mt-1 text-[9px] leading-4 text-zinc-500">Décris ce que tu cherches : SOPHENIC proposera les 5 meilleurs modèles Sketchfab à explorer ici, caméra libre.</p>
      </div>
    </div>;
  }

  return <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-black/[.07] bg-[#141311] dark:border-white/[.07]">
    <div ref={mountRef} className="absolute inset-0" />
    <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl bg-black/45 px-2.5 py-1.5 backdrop-blur">
      <div className="text-[8px] font-extrabold uppercase tracking-[.16em] text-[#e8c98a]">✦ SOPHENIC AI · Visionneuse 3D</div>
      <div className="mt-0.5 max-w-[320px] truncate text-[10px] font-semibold text-white">{model.name}</div>
      {model.author ? <div className="text-[8px] text-white/60">par {model.author} · Sketchfab</div> : null}
    </div>
    <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-xl bg-black/45 px-2.5 py-1.5 text-right backdrop-blur">
      {model.license ? <div className="text-[8px] text-white/70">Licence : {model.license}</div> : null}
      {model.faceCount ? <div className="text-[8px] text-white/50">{model.faceCount.toLocaleString("fr-FR")} faces</div> : null}
    </div>
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-black/40 px-2 py-1 text-[8px] text-white/60 backdrop-blur">🖱 Glisser : orbiter · Clic droit : déplacer · Molette : zoom</div>
    {model.sourceUrl ? <a href={model.sourceUrl} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/40 px-2 py-1 text-[8px] text-white/60 backdrop-blur hover:text-white">Voir sur Sketchfab ↗</a> : null}
    {loading && <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-sm"><div className="flex items-center gap-2 text-[11px] font-semibold text-white"><Loader2 className="size-4 animate-spin" />Chargement du modèle…</div></div>}
    {error && <div className="absolute inset-x-3 top-1/2 z-20 mx-auto max-w-md -translate-y-1/2 rounded-xl border border-red-300/40 bg-red-950/80 px-3 py-2 text-[10px] leading-4 text-red-100">{error}</div>}
  </div>;
}
