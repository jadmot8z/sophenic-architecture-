"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Armchair, Box, Building2, Check, ChevronDown, Code2, Copy, Crosshair, DoorOpen, Download,
  FileCode2, Files, FlaskConical, FolderOpen, Globe2, History, Layers3, Loader2, MessageSquareText, Monitor,
  MousePointer2, Package, Palette, PanelLeft, Plus, Redo2, RotateCcw, Ruler, Save, Send, Smartphone,
  Sparkles, Square, Footprints, Tablet, Trash2, Undo2, Upload, WandSparkles, X, Sun, Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DesignCanvas2D, type DesignSelection } from "./design-canvas-2d";
import { DesignViewport3D, type Design3DSelection } from "./design-viewport-3d";
import { ArchitectureViewport3D, type ArchitectureSelection } from "./architecture-viewport-3d";
import { ArchitectureThinkingTimeline, type ArchitectureWorkStep, type ArchitectureWorkStatus } from "./architecture-thinking-timeline";
import { DesignWebPreview, type WebPreviewSelection } from "./design-web-preview";
import { applyDesignActions, fastDesignCommand } from "@/design/commands";
import { cloneDesignProject, createDesignProject } from "@/design/project-factory";
import { requestDesignAi } from "@/design/ai";
import { runAllDesignSimulations } from "@/design/simulations";
import { deleteDesignProject, listDesignProjects, saveDesignProject, setActiveDesignProjectId } from "@/design/storage";
import { chooseWebEntry, ensureWebWorkspace, webProjectFramework } from "@/design/web-workspace";
import { readWebImport } from "@/design/web-import";
import { downloadWebProject } from "@/design/web-export";
import { objectFitsRoom } from "@/design/architecture";
import { analyzeArchitecture } from "@/design/architecture-audit";
import { runArchitectureQualityPass } from "@/design/architecture-quality";
import { applyArchitectureBrief, architectureBriefSummary, parseArchitectureBrief } from "@/design/interior-brief";
import { analyzeReferenceText, buildArchitectureIntent, designIntentSummary } from "@/design/design-intent";
import { resolveDesignIntent } from "@/design/design-intent-ai";
import { assetQueryForObject as intentAwareAssetQuery, assetRequirementsForIntent, noAssetMessage } from "@/design/asset-requirements";
import { selectBestDesignAsset, selectBestDesignAssetForIntent } from "@/design/asset-selection";
import type { DesignAiAction, DesignAiPlan, DesignAssetSearchResult, DesignDomain, DesignMaterial, DesignProject, DesignTool, DesignVersionSnapshot, DesignWebChange } from "@/design/types";

type EffortMode = "quick" | "auto" | "deep";
type Props = { effortMode?: EffortMode };
type Screen = "home" | "choose" | "project";
type PhysicalView = "exterior" | "interior" | "plan";
type Drawer = "none" | "files" | "versions" | "simulations" | "materials" | "projects";

const uid = (prefix = "design") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const copy = <T,>(value: T): T => structuredClone(value);

const projectKinds: Array<{ domain: DesignDomain; label: string; eyebrow: string; description: string; icon: typeof Globe2 }> = [
  { domain: "web", label: "Design Web", eyebrow: "SITES · APPS · UI", description: "Importe un site, affiche-le en direct et demande à Sophenic de le redesign ou de modifier ses fichiers.", icon: Globe2 },
  { domain: "architecture", label: "Architecture", eyebrow: "MAISON · ESPACES", description: "Commence par une maison vide, tourne autour à 360°, entre dans chaque pièce puis meuble-la avec Sophenic.", icon: Building2 },
  { domain: "product", label: "Design 3D", eyebrow: "OBJETS · MOBILIER", description: "Conçois un objet paramétrique, change ses dimensions et matériaux, explore des variantes en 3D.", icon: Box }
];

const planTools: Array<{ id: DesignTool; label: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "Sélection", icon: MousePointer2 }, { id: "room", label: "Pièce", icon: Square }, { id: "wall", label: "Mur", icon: Ruler },
  { id: "door", label: "Porte", icon: DoorOpen }, { id: "window", label: "Fenêtre", icon: PanelLeft }, { id: "stairs", label: "Escalier", icon: Footprints },
  { id: "dimension", label: "Cote", icon: Ruler }
 ];

function architectureActionLabel(action: DesignAiAction): string {
  if (action.type === "apply_architecture_program") return `Construire le programme ${action.program.archetype === "palace" ? "palais monumental" : action.program.archetype === "villa" ? "villa contemporaine" : "maison"} (${action.program.levels.length} niveau(x), murs ${action.program.wallHeight.toFixed(1)} m)`;
  if (action.type === "set_villa_program") return `Construire la villa sur ${action.levels.length} niveau(x)`;
  if (action.type === "add_stairs_connection") return `Créer l’escalier niveau ${action.fromLevel + 1} → ${action.toLevel + 1}`;
  if (action.type === "set_architecture_style") return `Définir le style : ${action.style}`;
  if (action.type === "set_architecture_ambience") return `Régler l’ambiance lumineuse : ${action.ambience}`;
  if (action.type === "furnish_room") return `Composer intelligemment ${action.room}`;
  if (action.type === "optimize_room_layout") return `Optimiser les distances et la circulation de ${action.room}`;
  if (action.type === "set_architecture_layout") return `Recomposer ${action.rooms.length} pièce(s)`;
  if (action.type === "add_object") return `Choisir et placer : ${action.name}`;
  if (action.type === "add_opening") return `Créer ${action.kind === "window" ? "une ouverture vitrée" : "une porte"} dans ${action.room}`;
  if (action.type === "set_material") return `Appliquer ${action.material}`;
  if (action.type === "set_room_color") return `Colorer ${action.room}`;
  if (action.type === "move_object") return `Replacer ${action.object}`;
  if (action.type === "resize_room") return `Redimensionner ${action.room}`;
  if (action.type === "clear_room") return `Réinitialiser ${action.room}`;
  if (action.type === "set_ceiling_height") return `Ajuster le plafond de ${action.room}`;
  if (action.type === "set_wall_height") return "Ajuster la hauteur architecturale";
  if (action.type === "rename_room") return `Renommer ${action.room}`;
  if (action.type === "remove_object") return `Retirer ${action.object}`;
  return "Appliquer une modification de conception";
}

function projectSnapshot(project: DesignProject, label: string, summary: string): DesignVersionSnapshot {
  const { versions: _versions, updatedAt: _updatedAt, ...snapshot } = copy(project);
  return { id: uid("version"), label, summary, createdAt: new Date().toISOString(), project: snapshot };
}

function projectTypeLabel(project: DesignProject): string {
  return project.domain === "web" ? "Design Web" : project.domain === "product" ? "Design 3D" : "Architecture";
}

function changedWebFiles(before: DesignProject, after: DesignProject, prompt: string, summary: string): DesignWebChange | null {
  const oldMap = new Map((before.webWorkspace?.files || []).filter((file) => file.kind === "text").map((file) => [file.path, file.content || ""]));
  const nextMap = new Map((after.webWorkspace?.files || []).filter((file) => file.kind === "text").map((file) => [file.path, file.content || ""]));
  const paths = new Set([...oldMap.keys(), ...nextMap.keys()]);
  const files = [...paths].filter((path) => oldMap.get(path) !== nextMap.get(path)).slice(0, 24).map((path) => ({ path, before: oldMap.get(path) || "", after: nextMap.get(path) || "" }));
  return files.length ? { id: uid("web-change"), createdAt: new Date().toISOString(), prompt, summary, status: "applied", files } : null;
}

/** Convertit une sélection 2D/3D large en sélection 3D valide (room/object/wall). */
function to3dSelection(value: DesignSelection | ArchitectureSelection | null): Design3DSelection {
  if (!value) return null;
  if (value.kind === "room" || value.kind === "object" || value.kind === "wall") return { kind: value.kind, id: value.id };
  return null;
}

function selectedPhysicalLabel(project: DesignProject, selection: DesignSelection | Design3DSelection | ArchitectureSelection): string {
  if (!selection) return "";
  if (selection.kind === "room") return project.plan.rooms.find((item) => item.id === selection.id)?.name || "Pièce";
  if (selection.kind === "object") return project.plan.objects.find((item) => item.id === selection.id)?.name || (selection.id === "product-main" ? "Objet 3D" : "Objet");
  if (selection.kind === "wall") return "Mur sélectionné";
  if (selection.kind === "opening") return project.plan.openings.find((item) => item.id === selection.id)?.kind === "window" ? "Fenêtre" : "Porte";
  return "Élément sélectionné";
}

function assetSearchQuery(action: Extract<DesignAiAction, { type: "add_object" }>, project: DesignProject): string {
  // V8.1 : requête dérivée du Design Intent ; l'assetQuery explicite (Brain ou
  // specs de composition) est conservée et re-stylisée par l'intent.
  return intentAwareAssetQuery({ name: action.name, metadata: action.assetQuery ? { assetQuery: action.assetQuery } : undefined }, project);
}

function assetSearchQueryForObject(object: DesignProject["plan"]["objects"][number], project: DesignProject): string {
  // V8.1 : la requête Sketchfab est dérivée du Design Intent (palais →
  // « royal sofa », villa moderne → « modern sofa »…).
  return intentAwareAssetQuery(object, project);
}

async function enrichGeneratedArchitectureAssets(project: DesignProject, objectIds: string[], progress: (value: string) => void): Promise<{ project: DesignProject; warnings: string[] }> {
  const next = copy(project);
  const intent = next.architecture?.designIntent || null;
  // V8.1 : les éléments structurels (colonnades) ne sont jamais remplacés par un asset.
  const objects = next.plan.objects.filter((object) => objectIds.includes(object.id) && object.category !== "stairs" && !object.asset?.cacheId && object.metadata?.structural !== "column");
  if (!objects.length) return { project: next, warnings: [] };
  if (!window.sophenicDesktop?.design) return { project: next, warnings: ["Asset Engine Desktop indisponible : mobilier procédural utilisé."] };
  const designApi = window.sophenicDesktop.design;
  const status = await designApi.assetStatus(false);
  if (!status.sketchfab.configured) return { project: next, warnings: ["Sketchfab non connecté : composition conservée avec mobilier procédural."] };
  const warnings: string[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    try {
      const query = assetSearchQueryForObject(object, next);
      progress(`Sketchfab ${index + 1}/${objects.length} · ${object.name}`);
      const results = await designApi.searchAssets(query, 16) as DesignAssetSearchResult[];
      // V8.1 : ranking IA avec style-matching de l'intent (jamais d'asset inventé).
      const candidate = selectBestDesignAssetForIntent(results, query, intent) || selectBestDesignAsset(results, query);
      if (!candidate) { warnings.push(noAssetMessage(null, object.name)); continue; }
      progress(`Téléchargement · ${candidate.name}`);
      const cached = await designApi.cacheAsset(candidate);
      object.asset = { provider: "sketchfab", sourceId: cached.sourceId, cacheId: cached.cacheId, entryPath: cached.entryPath, sourceUrl: cached.sourceUrl, thumbnailUrl: cached.thumbnailUrl, author: cached.author, license: cached.license, status: "ready" };
    } catch (error) {
      warnings.push(`${object.name} : ${error instanceof Error ? error.message : "import Sketchfab impossible"}`);
    }
  }
  return { project: next, warnings };
}

async function enrichArchitectureAssets(project: DesignProject, actions: DesignAiAction[], progress: (value: string) => void): Promise<{ actions: DesignAiAction[]; warnings: string[] }> {
  const intent = project.architecture?.designIntent || null;
  const furnitureActions = actions.filter((action): action is Extract<DesignAiAction, { type: "add_object" }> => action.type === "add_object" && action.category !== "stairs" && !action.asset);
  if (!furnitureActions.length) return { actions, warnings: [] };
  if (!window.sophenicDesktop?.design) return { actions, warnings: ["Asset Engine Desktop indisponible : SOPHENIC utilise temporairement son mobilier procédural détaillé."] };
  const designApi = window.sophenicDesktop.design;
  const status = await designApi.assetStatus(false);
  if (!status.sketchfab.configured) return { actions, warnings: ["Sketchfab n’est pas connecté : mobilier procédural détaillé utilisé en attendant le token API."] };
  const resolved: DesignAiAction[] = []; const warnings: string[] = []; let assetIndex = 0;
  for (const action of actions) {
    if (action.type !== "add_object" || action.category === "stairs" || action.asset) { resolved.push(action); continue; }
    try {
      assetIndex += 1; const query = assetSearchQuery(action, project); progress(`Recherche Sketchfab ${assetIndex}/${furnitureActions.length} · ${action.name}`);
      const results = await designApi.searchAssets(query, 16) as DesignAssetSearchResult[];
      const candidate = selectBestDesignAssetForIntent(results, query, intent) || selectBestDesignAsset(results, query);
      if (!candidate) { warnings.push(noAssetMessage(null, action.name)); resolved.push(action); continue; }
      progress(`Téléchargement & cache · ${candidate.name}`);
      const cached = await designApi.cacheAsset(candidate);
      resolved.push({ ...action, asset: { provider: "sketchfab", sourceId: cached.sourceId, cacheId: cached.cacheId, entryPath: cached.entryPath, sourceUrl: cached.sourceUrl, thumbnailUrl: cached.thumbnailUrl, author: cached.author, license: cached.license, status: "ready" } });
    } catch (error) { warnings.push(`${action.name} : ${error instanceof Error ? error.message : "import Sketchfab impossible"} · modèle procédural utilisé.`); resolved.push(action); }
  }
  return { actions: resolved, warnings };
}

function downloadProject(project: DesignProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${project.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "sophenic-design"}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DesignWorkspace({ effortMode = "auto" }: Props) {
  const [screen, setScreen] = useState<Screen>("home");
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [physicalView, setPhysicalView] = useState<PhysicalView>("exterior");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [tool, setTool] = useState<DesignTool>("select");
  const [selection, setSelection] = useState<DesignSelection>(null);
  const [selection3d, setSelection3d] = useState<Design3DSelection>(null);
  const [inspectWeb, setInspectWeb] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiProgress, setAiProgress] = useState("");
  const [aiSteps, setAiSteps] = useState<ArchitectureWorkStep[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<DesignProject[]>([]);
  const [redoStack, setRedoStack] = useState<DesignProject[]>([]);
  const [newName, setNewName] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const architectureReferenceInput = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const changeToken = useRef(0);
  const activeRef = useRef<DesignProject | null>(null);
  const active = projects.find((project) => project.id === activeId) || null;
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    let cancelled = false;
    void listDesignProjects().then((rows) => { if (!cancelled) { setProjects(rows); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const node = folderInput.current; if (node) node.setAttribute("webkitdirectory", "");
  }, [screen, activeId]);

  useEffect(() => {
    if (!active || loading || saveState !== "dirty") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const token = changeToken.current;
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saving");
      void saveDesignProject(active).then((saved) => {
        if (changeToken.current !== token) { setSaveState("dirty"); return; }
        setProjects((rows) => rows.map((item) => item.id === saved.id ? saved : item)); setSaveState("saved");
      }).catch(() => setSaveState("dirty"));
    }, 550);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [active, loading, saveState]);

  const updateProject = useCallback((next: DesignProject, summary?: string) => {
    const current = activeRef.current;
    if (!current || current.id !== next.id) return;
    if (summary) { setUndoStack((stack) => [...stack.slice(-39), copy(current)]); setRedoStack([]); }
    changeToken.current += 1; next.updatedAt = new Date().toISOString(); next.revision = Math.max(next.revision, current.revision + (summary ? 1 : 0));
    setProjects((rows) => rows.map((item) => item.id === next.id ? next : item)); setSaveState("dirty");
  }, []);

  const mutate = useCallback((recipe: (project: DesignProject) => void, summary: string) => {
    const current = activeRef.current; if (!current) return; const next = copy(current); recipe(next); updateProject(next, summary);
  }, [updateProject]);

  const openProject = (project: DesignProject) => {
    setActiveId(project.id); setActiveDesignProjectId(project.id); setScreen("project"); setDrawer("none"); setTool("select"); setSelection(null); setSelection3d(null); setUndoStack([]); setRedoStack([]);
    setPhysicalView(project.domain === "architecture" && project.architecture?.cameraMode === "interior" ? "interior" : "exterior");
    setActiveRoomId(project.domain === "architecture" ? (project.architecture?.activeRoomId || project.plan.rooms[0]?.id || "") : "");
  };

  const createProject = (domain: DesignDomain) => {
    const defaultName = domain === "web" ? "Nouveau site" : domain === "product" ? "Nouvel objet 3D" : "Nouveau projet d’architecture";
    const project = createDesignProject(newName.trim() || defaultName, domain); setProjects((rows) => [project, ...rows]); setNewName(""); openProject(project); setSaveState("dirty");
  };

  const removeProject = async (projectId: string) => {
    await deleteDesignProject(projectId); const remaining = projects.filter((project) => project.id !== projectId); setProjects(remaining);
    if (activeId === projectId) { setActiveId(""); setScreen("home"); }
  };

  const undo = () => {
    if (!active || !undoStack.length) return; const previous = undoStack[undoStack.length - 1]; setUndoStack((stack) => stack.slice(0, -1)); setRedoStack((stack) => [...stack.slice(-39), copy(active)]); changeToken.current += 1;
    const next = { ...copy(previous), updatedAt: new Date().toISOString(), revision: active.revision + 1 }; setProjects((rows) => rows.map((item) => item.id === active.id ? next : item)); setSaveState("dirty");
  };
  const redo = () => {
    if (!active || !redoStack.length) return; const nextState = redoStack[redoStack.length - 1]; setRedoStack((stack) => stack.slice(0, -1)); setUndoStack((stack) => [...stack.slice(-39), copy(active)]); changeToken.current += 1;
    const next = { ...copy(nextState), updatedAt: new Date().toISOString(), revision: active.revision + 1 }; setProjects((rows) => rows.map((item) => item.id === active.id ? next : item)); setSaveState("dirty");
  };

  const createVersion = () => mutate((project) => { project.versions.unshift(projectSnapshot(project, `Version ${project.versions.length + 1}`, "Snapshot manuel")); project.versions = project.versions.slice(0, 50); }, "Version créée");
  const restoreVersion = (snapshot: DesignVersionSnapshot) => {
    if (!active) return; const restored: DesignProject = { ...copy(snapshot.project), versions: active.versions, updatedAt: new Date().toISOString(), revision: active.revision + 1 }; updateProject(restored, `Version restaurée : ${snapshot.label}`); setDrawer("none");
  };

  const setWebViewport = (viewport: "desktop" | "tablet" | "mobile") => mutate((project) => { ensureWebWorkspace(project).viewport = viewport; }, `Preview ${viewport}`);
  const setWebSelection = useCallback((value: WebPreviewSelection) => {
    const current = activeRef.current; if (!current?.webWorkspace) return; const next = copy(current); ensureWebWorkspace(next).selectedElement = value || undefined; updateProject(next);
  }, [updateProject]);

  const importWeb = async (files: FileList | null) => {
    if (!active || !files?.length || importBusy) return; setImportBusy(true); setAiError("");
    try {
      const imported = await readWebImport(files); const next = copy(active); const workspace = ensureWebWorkspace(next); workspace.files = imported.files; workspace.entryPath = chooseWebEntry(imported.files); workspace.selectedPath = workspace.entryPath || imported.files.find((file) => file.kind === "text")?.path || ""; workspace.sourceLabel = imported.label; workspace.selectedElement = undefined; workspace.changes = [];
      next.aiMessages.push({ id: uid("msg"), role: "assistant", content: `Site importé : ${imported.files.length} fichier(s). ${workspace.entryPath ? "La prévisualisation live est prête." : "Je peux analyser le code ; aucun index.html statique n’a été détecté."}`, createdAt: new Date().toISOString(), applied: true }); updateProject(next, `Site importé : ${imported.label}`);
    } catch (error) { setAiError(error instanceof Error ? error.message : "Import du site impossible."); }
    finally { setImportBusy(false); if (fileInput.current) fileInput.current.value = ""; if (folderInput.current) folderInput.current.value = ""; }
  };



  const importArchitectureReferences = async (files: FileList | null) => {
    const current = activeRef.current;
    if (!current || current.domain !== "architecture" || !files?.length || referenceBusy) return;
    setReferenceBusy(true); setAiError("");
    const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Lecture impossible : ${file.name}`));
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.readAsDataURL(file);
    });
    // V8.1 REAL AI — le modèle Vision (via SOPHENIC Brain / providers existants)
    // doit retourner un JSON structuré : style, matériaux, couleurs, mobilier,
    // lumière, proportions, ambiance, niveau de luxe.
    const visionPrompt = `Analyse cette image de référence pour SOPHENIC Design V8.1. Réponds UNIQUEMENT en JSON valide (aucun markdown) avec exactement ces champs : {"style":"...","materials":["..."],"colors":["#RRGGBB ou noms de couleurs dominantes"],"furniture":["meubles visibles"],"furnitureStyle":"style de mobilier détecté","lighting":"description de la lumière","proportions":"proportions et échelle du espace","ambiance":"day|evening|soft","luxuryLevel":"light|balanced|rich|luxury","rooms":["types de pièces visibles"],"summary":"synthèse en une phrase"}. Décris uniquement ce qui est réellement visible ; n'invente rien.`;
    try {
      const images = [...files].filter((file) => file.type.startsWith("image/")).slice(0, 8);
      if (!images.length) throw new Error("Ajoute au moins une image PNG/JPG/WebP comme référence.");
      const next = copy(current);
      const analyses = [...(next.architecture?.referenceAnalyses || [])];
      for (const file of images) {
        const dataUrl = await toDataUrl(file);
        const assetId = uid("asset");
        let analysisText = "";
        if (window.sophenicDesktop?.design?.analyzeImage) {
          const result = await window.sophenicDesktop.design.analyzeImage({ dataUrl, name: file.name, prompt: visionPrompt });
          analysisText = result.analysis;
        } else {
          const response = await fetch("/api/design/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, name: file.name, prompt: visionPrompt }) });
          const payload = await response.json() as { analysis?: string; error?: string };
          if (!response.ok) throw new Error(payload.error || `Analyse impossible pour ${file.name}`);
          analysisText = payload.analysis || "";
        }
        next.assets.unshift({ id: assetId, name: file.name, kind: "reference", mime: file.type, size: file.size, dataUrl, extractedText: analysisText, createdAt: new Date().toISOString() });
        analyses.unshift(analyzeReferenceText({ assetId, name: file.name, analysis: analysisText }));
      }
      next.architecture = { ...(next.architecture || { cameraMode: "exterior", roomOrder: next.plan.rooms.map((room) => room.id) }), referenceAnalyses: analyses.slice(0, 12), designIntent: buildArchitectureIntent(next, next.architecture?.brief?.sourceInstruction || next.aiMessages.at(-1)?.content || "", analyses.slice(0, 12)), sketchfabStrategy: "strict" };
      next.aiMessages.push({ id: uid("msg"), role: "assistant", content: `${images.length} image(s) de référence analysée(s) par le modèle Vision. Intent V8.1 : ${designIntentSummary(next.architecture.designIntent!)}`, createdAt: new Date().toISOString(), applied: true });
      updateProject(next, `Références importées : ${images.length}`);
    } catch (error) { setAiError(error instanceof Error ? error.message : "Import des références impossible."); }
    finally { setReferenceBusy(false); if (architectureReferenceInput.current) architectureReferenceInput.current.value = ""; }
  };

  const selectedContext = useMemo(() => {
    if (!active || active.domain === "web") return "";
    const selected = selectedPhysicalLabel(active, selection3d || selection);
    if (selected) return selected;
    if (active.domain === "architecture") return active.plan.rooms.find((room) => room.id === activeRoomId)?.name || active.plan.rooms[0]?.name || "";
    return "";
  }, [active, activeRoomId, selection, selection3d]);

  const setArchitectureView = useCallback((view: PhysicalView) => {
    setPhysicalView(view);
    const current = activeRef.current;
    if (!current || current.domain !== "architecture" || view === "plan") return;
    const next = copy(current); next.architecture = { ...(next.architecture || { roomOrder: next.plan.rooms.map((room) => room.id) }), cameraMode: view === "interior" ? "interior" : "exterior", activeRoomId: activeRoomId || next.architecture?.activeRoomId || next.plan.rooms[0]?.id, roomOrder: next.architecture?.roomOrder?.length ? next.architecture.roomOrder : next.plan.rooms.map((room) => room.id) }; updateProject(next);
  }, [activeRoomId, updateProject]);

  const setArchitectureRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
    const current = activeRef.current; if (!current || current.domain !== "architecture") return;
    const next = copy(current); const selectedRoom = next.plan.rooms.find((room) => room.id === roomId); next.architecture = { ...(next.architecture || { cameraMode: "interior", roomOrder: next.plan.rooms.map((room) => room.id) }), cameraMode: "interior", activeRoomId: roomId, activeLevel: selectedRoom?.level || 0, roomOrder: next.architecture?.roomOrder?.length ? next.architecture.roomOrder : next.plan.rooms.map((room) => room.id) }; updateProject(next);
  }, [updateProject]);

  const selectedArchitectureObject = active?.domain === "architecture" && selection3d?.kind === "object" ? active.plan.objects.find((object) => object.id === selection3d.id) : undefined;
  const editSelectedArchitectureObject = useCallback((kind: "left" | "right" | "forward" | "back" | "rotate-left" | "rotate-right" | "larger" | "smaller" | "delete") => {
    const current = activeRef.current; const selectedId = selection3d?.kind === "object" ? selection3d.id : ""; if (!current || current.domain !== "architecture" || !selectedId) return;
    const next = copy(current); const object = next.plan.objects.find((item) => item.id === selectedId); if (!object) return;
    if (kind === "delete") { next.plan.objects = next.plan.objects.filter((item) => item.id !== selectedId); updateProject(next, `Objet supprimé : ${object.name}`); setSelection3d(null); setSelection(null); return; }
    const room = next.plan.rooms.find((item) => item.id === object.roomId) || next.plan.rooms.find((item) => object.x >= item.x && object.x <= item.x + item.width && object.y >= item.y && object.y <= item.y + item.height);
    const before = copy(object); const step = .2;
    if (kind === "left") object.x -= step; else if (kind === "right") object.x += step; else if (kind === "forward") object.y -= step; else if (kind === "back") object.y += step;
    else if (kind === "rotate-left") object.rotation -= Math.PI / 12; else if (kind === "rotate-right") object.rotation += Math.PI / 12;
    else if (kind === "larger" || kind === "smaller") { const factor = kind === "larger" ? 1.08 : .92; const cx = object.x + object.width / 2, cy = object.y + object.depth / 2; object.width = Math.max(.08, object.width * factor); object.depth = Math.max(.08, object.depth * factor); object.height = Math.max(.08, object.height * factor); object.x = cx - object.width / 2; object.y = cy - object.depth / 2; }
    if (room && !objectFitsRoom(next, room, object, .08)) Object.assign(object, before);
    updateProject(next, `Objet modifié : ${object.name}`);
  }, [selection3d, updateProject]);

  const updateWorkStep = useCallback((id: string, status: ArchitectureWorkStatus, detail?: string) => {
    setAiSteps((steps) => steps.map((step) => step.id === id ? { ...step, status, ...(detail !== undefined ? { detail } : {}) } : step));
  }, []);

  const beginArchitectureWork = useCallback((brief: ReturnType<typeof parseArchitectureBrief>, referenceCount: number) => {
    // V8.1 REAL AI — timeline réelle : chaque étape correspond à un travail
    // réellement exécuté par le pipeline (intent Brain, vision, assets, synthèse).
    const steps: ArchitectureWorkStep[] = [
      { id: "thinking", label: "Analyse de la demande", detail: "Comprendre la demande utilisateur : style, finition, priorités, contraintes.", status: "running" },
      { id: "references", label: "Analyse des images", detail: referenceCount ? `${referenceCount} référence(s) visuelle(s) analysée(s) par le modèle Vision (style, matériaux, couleurs, mobilier, lumière, proportions).` : "Aucune image de référence importée — brief texte seul.", status: "queued" },
      { id: "intent", label: "Création du Design Intent", detail: `Construire le brief de design : ${architectureBriefSummary(brief)}`, status: "queued" },
      { id: "assets", label: "Recherche assets (Sketchfab)", detail: "Besoins d'assets dérivés du Design Intent · recherche réelle, licence, PBR, style, polycount.", status: "queued" },
      { id: "structure", label: "Construction de l'architecture", detail: "Programme structural : niveaux, hauteurs, pièces, ouvertures, matériaux.", status: "queued" },
      { id: "furnish", label: "Aménagement des pièces", detail: "Composition intérieure par relations fonctionnelles, dégagements contrôlés.", status: "queued" },
      { id: "quality", label: "Vérification", detail: "Vérifier et optimiser le résultat : collisions, circulation, ouvertures, cohérence.", status: "queued" },
      { id: "final", label: "Finalisation", status: "queued" }
    ];
    setAiSteps(steps); return steps;
  }, []);

  const submitAi = async (preset?: string) => {
    const current = activeRef.current; if (!current || aiBusy) return; const raw = (preset ?? aiInput).trim(); if (!raw) return;
    if (current.domain === "web" && !current.webWorkspace?.files.length) { setAiError("Importe d’abord le site ou son dossier de fichiers."); return; }
    setAiInput(""); setAiError(""); setAiProgress("");
    const architectureBrief = current.domain === "architecture" ? parseArchitectureBrief(raw, current) : null;
    if (architectureBrief) beginArchitectureWork(architectureBrief, current.architecture?.referenceAnalyses?.length || 0); else setAiSteps([]);

    if (current.domain === "architecture" && /(?:audit|diagnostic|analyse|analyser).{0,35}(?:architecture|maison|projet|pi[eè]ce|salon|cuisine|chambre)/i.test(raw) && !/(?:optimise|optimiser|ameliore|améliore|modifie|corrige|applique)/i.test(raw)) {
      const audit = analyzeArchitecture(current);
      const activeRoom = current.plan.rooms.find((room) => room.id === current.architecture?.activeRoomId);
      const roomAudit = activeRoom ? audit.rooms.find((room) => room.roomId === activeRoom.id) : undefined;
      const priorities = (roomAudit?.issues.length ? roomAudit.issues.map((issue) => `${activeRoom?.name} : ${issue}`) : audit.priorities).slice(0, 5);
      const recommendations = (roomAudit?.recommendations.length ? roomAudit.recommendations : audit.rooms.flatMap((room) => room.recommendations.map((item) => `${room.roomName} : ${item}`))).slice(0, 5);
      const next = copy(current);
      next.architecture = { ...(next.architecture || { cameraMode: "exterior", roomOrder: next.plan.rooms.map((room) => room.id) }), lastAuditScore: audit.score, lastAuditAt: new Date().toISOString() };
      next.aiMessages.push({ id: uid("msg"), role: "user", content: raw, createdAt: new Date().toISOString() });
      next.aiMessages.push({ id: uid("msg"), role: "assistant", content: `Audit architectural indicatif : ${audit.score}/100 · ${audit.totalArea} m² · ${audit.roomCount} pièce(s).${roomAudit ? ` ${roomAudit.roomName} : ${roomAudit.score}/100, emprise mobilier ${roomAudit.furnitureCoverage}%.` : ""}${priorities.length ? `\n\nPriorités : ${priorities.join(" · ")}` : ""}${recommendations.length ? `\n\nRecommandations : ${recommendations.join(" · ")}` : ""}\n\nCet audit est un outil de conception, pas une validation réglementaire ou structurelle.`, createdAt: new Date().toISOString(), applied: false });
      updateProject(next, "Audit architectural");
      setAiSteps([
        { id: "thinking", label: "Réflexion architecturale", detail: "Demande d’audit comprise.", status: "done" },
        { id: "audit", label: "Analyser la maison actuelle", detail: `Score : ${audit.score}/100 · ${audit.roomCount} pièce(s).`, status: "done" },
        { id: "final", label: "Présenter les priorités", detail: `${priorities.length} priorité(s) et ${recommendations.length} recommandation(s).`, status: "done" }
      ]);
      return;
    }
    if (current.domain === "architecture" && /(?:lance|execute|fais).{0,20}(?:toutes les )?simulations?/i.test(raw)) {
      const next = copy(current); next.aiMessages.push({ id: uid("msg"), role: "user", content: raw, createdAt: new Date().toISOString() }); next.simulations = [...runAllDesignSimulations(next), ...next.simulations].slice(0, 80); const average = Math.round(next.simulations.slice(0, 7).reduce((sum, item) => sum + item.score, 0) / 7); next.aiMessages.push({ id: uid("msg"), role: "assistant", content: `Les 7 simulations indicatives ont été exécutées. Score moyen : ${average}/100. Ouvre “Simulations” pour le détail et les recommandations.`, createdAt: new Date().toISOString(), applied: true }); updateProject(next, "Toutes les simulations exécutées"); setAiSteps([{ id: "thinking", label: "Préparer les simulations", status: "done" }, { id: "audit", label: "Exécuter les 7 simulations", detail: `Score moyen : ${average}/100.`, status: "done" }, { id: "final", label: "Résultats prêts", status: "done" }]); setDrawer("simulations"); return;
    }
    if (current.domain === "architecture" && /(?:mode |ouvre |passe en |va en )(?:visite|interieur|intérieur|walk|promenade)/i.test(raw)) { setArchitectureView("interior"); return; }
    if (current.domain === "architecture" && /(?:mode |ouvre |passe en |va en )(?:exterieur|extérieur|dehors)/i.test(raw)) { setArchitectureView("exterior"); return; }

    setAiBusy(true); setAiProgress("Analyse du projet…");
    let base = copy(current);
    if (architectureBrief) {
      base = applyArchitectureBrief(base, architectureBrief);
      const designIntent = buildArchitectureIntent(base, raw, base.architecture?.referenceAnalyses || []);
      base.architecture = { ...(base.architecture || { cameraMode: "exterior", roomOrder: base.plan.rooms.map((room) => room.id) }), designIntent, sketchfabStrategy: designIntent.sketchfabStrategy };
    }
    base.aiMessages.push({ id: uid("msg"), role: "user", content: raw, createdAt: new Date().toISOString() });
    let instruction = raw;
    if (architectureBrief) instruction += `\n\nBRIEF SOPHENIC V7 : ${JSON.stringify(architectureBrief)}`;
    if (base.domain !== "web" && selectedContext) instruction += `\n\nCONTEXTE VISUEL : ${base.domain === "architecture" ? `pièce actuelle ou sélection = « ${selectedContext} »` : `sélection = « ${selectedContext} »`}. Les pronoms comme « le », « ça », « cet élément » désignent ce contexte.`;
    if (base.domain === "web" && base.webWorkspace?.selectedElement) instruction += `\n\nÉLÉMENT CLIQUÉ DANS LA PREVIEW : ${JSON.stringify(base.webWorkspace.selectedElement)}.`;
    try {
      let preAudit: ReturnType<typeof analyzeArchitecture> | null = null;
      if (base.domain === "architecture") {
        updateWorkStep("thinking", "done", "Demande comprise et contexte visuel chargé.");
        const referenceCount = base.architecture?.referenceAnalyses?.length || 0;
        updateWorkStep("references", "done", referenceCount
          ? `${referenceCount} référence(s) déjà analysée(s) : ${(base.architecture?.referenceAnalyses || []).slice(0, 3).map((reference) => reference.styleHints[0] || reference.kind).join(", ")}.`
          : "Aucune image de référence — brief texte seul (utilise « Ajouter références » pour enrichir l'analyse).");
        // V8.1 REAL AI — le Design Intent est construit/routé via le SOPHENIC
        // Brain existant (desktop IPC ou route web), avec fallback déterministe.
        updateWorkStep("intent", "running", "Routage via SOPHENIC Brain : style, matériaux, mobilier, lumière, monumentalité…");
        setAiProgress("Création du Design Intent V8.1…");
        const resolved = await resolveDesignIntent({ project: base, instruction: raw, references: base.architecture?.referenceAnalyses || [], effortMode });
        base.architecture = { ...(base.architecture || { cameraMode: "exterior", roomOrder: base.plan.rooms.map((room) => room.id) }), designIntent: resolved.intent, sketchfabStrategy: resolved.intent.sketchfabStrategy };
        const requirements = assetRequirementsForIntent(resolved.intent);
        updateWorkStep("intent", "done", `${designIntentSummary(resolved.intent)}${resolved.origin === "brain" ? " · via SOPHENIC Brain" : " · synthèse déterministe (IA indisponible)"} · ${requirements.length} besoin(s) d'assets.`);
        preAudit = analyzeArchitecture(base);
        updateWorkStep("structure", "running", `Audit avant intervention : ${preAudit.score}/100 · ${preAudit.roomCount} pièce(s). Sophenic synthétise le programme architectural depuis le Design Intent…`);
        setAiProgress("Construction du plan d’action…");
      }
      const direct = fastDesignCommand(base, instruction); const plan: DesignAiPlan = direct || await requestDesignAi(base, instruction, effortMode);
      let effectiveActions = plan.actions; let assetWarnings: string[] = []; let architectureQualitySummary = "";
      if (base.domain === "architecture") {
        const audit = preAudit || analyzeArchitecture(base); updateWorkStep("structure", "running", `Audit avant intervention : ${audit.score}/100 · ${plan.actions.length} action(s) retenue(s) pour respecter le brief utilisateur.`);
        const visibleActions = plan.actions.slice(0, 14).map((action, index): ArchitectureWorkStep => ({ id: `action-${index}`, label: architectureActionLabel(action), status: "queued" }));
        if (plan.actions.length > 14) visibleActions.push({ id: "action-more", label: `${plan.actions.length - 14} autre(s) action(s) coordonnées`, status: "queued" });
        const hasAssets = plan.actions.some((action) => (action.type === "add_object" && action.category !== "stairs") || (action.type === "furnish_room" && action.preferAssets !== false));
        // V8.1 : les étapes assets/quality/final existent déjà dans la timeline
        // réelle (beginArchitectureWork) ; on n'ajoute que les sous-étapes d'actions.
        if (!hasAssets) setAiSteps((steps) => steps.filter((step) => step.id !== "assets"));
        else {
          const requirements = assetRequirementsForIntent(base.architecture?.designIntent || null);
          updateWorkStep("assets", "running", `Besoins Sketchfab : ${requirements.slice(0, 4).map((requirement) => requirement.query).join(" · ")}…`);
        }
        setAiSteps((steps) => [...steps, ...visibleActions]);
        const enriched = await enrichArchitectureAssets(base, effectiveActions, (value) => { setAiProgress(value); updateWorkStep("assets", "running", value); }); effectiveActions = enriched.actions; assetWarnings = enriched.warnings;
      }
      setAiProgress("Application des modifications…");
      let next = base;
      const objectIdsBefore = new Set(base.plan.objects.map((object) => object.id));
      if (base.domain === "architecture") {
        for (let index = 0; index < effectiveActions.length; index += 1) {
          const stepId = index < 14 ? `action-${index}` : "action-more";
          const detail = index < 14 ? `Action ${index + 1}/${effectiveActions.length}` : `${effectiveActions.length - 14} action(s) coordonnées restantes`;
          updateWorkStep(stepId, "running", detail);
          const currentAction = effectiveActions[index];
          const structural = currentAction.type === "apply_architecture_program" || currentAction.type === "set_villa_program" || currentAction.type === "set_architecture_layout" || currentAction.type === "add_stairs_connection" || currentAction.type === "set_architecture_style" || currentAction.type === "set_wall_height" || currentAction.type === "add_opening";
          if (structural) updateWorkStep("structure", "running", `Action ${index + 1}/${effectiveActions.length} : ${architectureActionLabel(currentAction)}`);
          if (currentAction.type === "furnish_room") updateWorkStep("furnish", "running", `Composition de ${currentAction.room} (${currentAction.density || "balanced"})…`);
          const beforeRoomObjectCount = currentAction.type === "furnish_room" ? next.plan.objects.filter((object) => next.plan.rooms.find((room) => room.name === currentAction.room)?.id === object.roomId && object.category !== "stairs").length : 0;
          next = applyDesignActions(next, [currentAction]);
          let appliedDetail = index < 14 ? "Appliqué au modèle architectural." : "Actions coordonnées appliquées.";
          if (currentAction.type === "furnish_room") {
            const room = next.plan.rooms.find((candidate) => candidate.name === currentAction.room);
            const afterCount = room ? next.plan.objects.filter((object) => object.roomId === room.id && object.category !== "stairs").length : beforeRoomObjectCount;
            appliedDetail = `${afterCount} élément(s) composés avec dégagements et relations fonctionnelles contrôlés.`;
          }
          if (structural) updateWorkStep("structure", "done", `Programme appliqué : ${next.plan.rooms.length} pièce(s) sur ${new Set(next.plan.rooms.map((room) => room.level || 0)).size} niveau(x) · murs ${next.plan.wallHeight.toFixed(1)} m.`);
          if (currentAction.type === "furnish_room") updateWorkStep("furnish", "done", `${next.plan.objects.filter((object) => object.category !== "stairs" && object.metadata?.structural !== "column").length} meuble(s) placé(s) au total.`);
          updateWorkStep(stepId, "done", appliedDetail);
          // Rend la progression visible dans le chat, même lorsque les opérations locales sont rapides.
          if (index < 14) await new Promise<void>((resolve) => window.setTimeout(resolve, 45));
        }
      } else {
        next = applyDesignActions(base, effectiveActions);
      }
      if (base.domain === "architecture") {
        const generatedObjectIds = next.plan.objects.filter((object) => !objectIdsBefore.has(object.id) && object.category !== "stairs" && !object.asset?.cacheId).map((object) => object.id);
        const wantsAssets = effectiveActions.some((action) => (action.type === "add_object" && action.category !== "stairs") || (action.type === "furnish_room" && action.preferAssets !== false));
        if (wantsAssets && generatedObjectIds.length) {
          updateWorkStep("assets", "running", `${generatedObjectIds.length} objet(s) issus de la composition à enrichir.`);
          const upgraded = await enrichGeneratedArchitectureAssets(next, generatedObjectIds, (value) => { setAiProgress(value); updateWorkStep("assets", "running", value); });
          next = upgraded.project; assetWarnings = [...assetWarnings, ...upgraded.warnings];
          updateWorkStep("assets", "done", upgraded.warnings.length ? `${generatedObjectIds.length - upgraded.warnings.length}/${generatedObjectIds.length} asset(s) enrichi(s), fallback procédural pour le reste.` : `${generatedObjectIds.length} asset(s) 3D enrichi(s).`);
        } else if (wantsAssets) {
          updateWorkStep("assets", "done", "Aucun nouvel asset n’était nécessaire après composition.");
        }
        updateWorkStep("structure", "done", next.plan.rooms.length ? `${next.plan.rooms.length} pièce(s) · ${new Set(next.plan.rooms.map((room) => room.level || 0)).size} niveau(x) · murs ${next.plan.wallHeight.toFixed(1)} m.` : "Structure inchangée.");
        updateWorkStep("furnish", "done", `${next.plan.objects.filter((object) => object.category !== "stairs" && object.metadata?.structural !== "column").length} meuble(s) dans le projet.`);
        updateWorkStep("quality", "running", "Contrôle V7 : distances, collisions, portes, fenêtres, circulation, style, matériaux et niveau de finition…");
        const quality = runArchitectureQualityPass(next); next = quality.project;
        architectureQualitySummary = `

Vérification automatique : ${quality.report.afterScore}/100${quality.report.fixes.length ? ` · ${quality.report.fixes.length} correction(s) de placement` : ""}${quality.report.warnings.length ? ` · ${quality.report.warnings.length} point(s) à surveiller` : ""}.`;
        updateWorkStep("quality", "done", `Score après vérification : ${quality.report.afterScore}/100${quality.report.fixes.length ? ` · ${quality.report.fixes.length} correction(s) automatique(s)` : ""}${quality.report.warnings.length ? ` · ${quality.report.warnings.length} avertissement(s)` : ""}.`);
        updateWorkStep("final", "done", "Projet cohérent appliqué, sauvegardable et annulable.");
      }
      const webChange = base.domain === "web" ? changedWebFiles(base, next, raw, plan.summary) : null;
      if (webChange) { const workspace = ensureWebWorkspace(next); workspace.changes.unshift(webChange); workspace.changes = workspace.changes.slice(0, 40); }
      const details = webChange ? `\n\nFichiers modifiés : ${webChange.files.map((file) => file.path).join(", ")}.` : "";
      const recommendationItems = [...assetWarnings, ...plan.recommendations].slice(0, 4);
      const recommendations = recommendationItems.length ? `\n\n${recommendationItems.join(" · ")}` : "";
      next.aiMessages.push({ id: uid("msg"), role: "assistant", content: `${plan.summary}${details}${architectureQualitySummary}${recommendations}`, createdAt: new Date().toISOString(), applied: effectiveActions.length > 0 });
      next.stage = effectiveActions.length ? "generation" : next.stage; updateProject(next, effectiveActions.length ? `Sophenic : ${plan.summary.slice(0, 90)}` : "Réponse Sophenic Design");
      if (base.domain === "architecture" && next.plan.rooms.length && !next.plan.rooms.some((room) => room.id === activeRoomId)) setActiveRoomId(next.plan.rooms[0].id);
    } catch (error) {
      const fallback = copy(activeRef.current || base); if (!fallback.aiMessages.some((message) => message.id === base.aiMessages.at(-1)?.id)) fallback.aiMessages.push(base.aiMessages.at(-1)!);
      if (base.domain === "architecture") setAiSteps((steps) => steps.map((step) => step.status === "running" ? { ...step, status: "error" as const, detail: "Étape interrompue." } : step));
      fallback.aiMessages.push({ id: uid("msg"), role: "assistant", content: "Je n’ai pas pu appliquer cette modification au projet.", createdAt: new Date().toISOString() }); updateProject(fallback, "Instruction Sophenic Design"); setAiError(error instanceof Error ? error.message : "Sophenic Brain indisponible.");
    } finally { setAiBusy(false); setAiProgress(""); }
  };

  const revertLastWebChange = () => {
    if (!active?.webWorkspace) return; const change = active.webWorkspace.changes.find((item) => item.status === "applied"); if (!change) return;
    mutate((project) => { const workspace = ensureWebWorkspace(project); for (const diff of change.files) { const file = workspace.files.find((item) => item.path === diff.path); if (file) { file.content = diff.before; file.size = diff.before.length; file.modifiedAt = new Date().toISOString(); } } const row = workspace.changes.find((item) => item.id === change.id); if (row) row.status = "reverted"; }, `Modification Web annulée : ${change.summary}`);
  };

  const applyMaterial = (material: DesignMaterial) => {
    if (!active) return;
    mutate((project) => {
      if (project.domain === "product") { project.product.materialId = material.id; return; }
      const selectedObject = selection3d?.kind === "object" || selection?.kind === "object" ? project.plan.objects.find((item) => item.id === (selection3d?.kind === "object" ? selection3d.id : selection?.kind === "object" ? selection.id : "")) : undefined;
      const selectedRoom = selection3d?.kind === "room" || selection?.kind === "room" ? project.plan.rooms.find((item) => item.id === (selection3d?.kind === "room" ? selection3d.id : selection?.kind === "room" ? selection.id : "")) : undefined;
      if (selectedObject) { selectedObject.materialId = material.id; selectedObject.color = material.color; } else if (selectedRoom) selectedRoom.floorMaterialId = material.id; else project.plan.rooms.forEach((room) => { room.floorMaterialId = material.id; });
    }, `Matériau appliqué : ${material.name}`);
  };

  if (loading) return <div className="grid h-full min-h-[620px] place-items-center bg-[#f7f4ee] dark:bg-[#111]"><Loader2 className="size-6 animate-spin text-[#9a7138]" /></div>;

  if (screen === "home") return <DesignHome onCreate={() => setScreen("choose")} />;

  if (screen === "choose") return <DesignChooser projects={projects} name={newName} onName={setNewName} onCreate={createProject} onOpen={openProject} onDelete={(id) => void removeProject(id)} onBack={() => setScreen("home")} />;

  if (!active) return <DesignHome onCreate={() => setScreen("choose")} />;

  const webWorkspace = active.webWorkspace;
  const lastWebChange = webWorkspace?.changes.find((item) => item.status === "applied");

  return <div className="flex h-full min-h-[650px] flex-col overflow-hidden bg-[#f5f2eb] text-zinc-800 dark:bg-[#101010] dark:text-zinc-100">
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-black/[.07] bg-[#fbf9f5]/95 px-2.5 backdrop-blur dark:border-white/[.07] dark:bg-[#141414]/95">
      <button type="button" onClick={() => setScreen("choose")} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10" title="Retour aux projets"><ArrowLeft className="size-4" /></button>
      <div className="hidden h-5 w-px bg-black/10 sm:block dark:bg-white/10" />
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-[12px] font-semibold">{active.name}</span><span className="hidden rounded-full bg-[#eee4d5] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.14em] text-[#795b36] sm:inline dark:bg-white/10 dark:text-zinc-300">{projectTypeLabel(active)}</span></div><div className="text-[8px] uppercase tracking-[.14em] text-zinc-400">{saveState === "saving" ? "Sauvegarde…" : saveState === "dirty" ? "Modifié" : "Sauvegardé"} · r{active.revision}</div></div>
      <div className="flex-1" />
      <button type="button" disabled={!undoStack.length} onClick={undo} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10" title="Annuler"><Undo2 className="size-4" /></button>
      <button type="button" disabled={!redoStack.length} onClick={redo} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10" title="Rétablir"><Redo2 className="size-4" /></button>
      <button type="button" onClick={() => setDrawer(drawer === "versions" ? "none" : "versions")} className="hidden h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 sm:flex dark:hover:bg-white/10"><History className="size-3.5" />Versions</button>
      <button type="button" onClick={() => downloadProject(active)} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10" title="Exporter le projet"><Download className="size-4" /></button>
    </header>

    <div className="relative flex min-h-0 flex-1">
      <main className="relative flex min-w-0 flex-1 flex-col">
        {active.domain === "web" ? <>
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/[.06] bg-white/45 px-3 dark:border-white/[.06] dark:bg-white/[.015]">
            <button type="button" onClick={() => fileInput.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7e5d37] px-3 text-[10px] font-semibold text-white shadow-sm"><Upload className="size-3.5" />{importBusy ? "Import…" : "Importer fichiers / ZIP"}</button>
            <button type="button" onClick={() => folderInput.current?.click()} className="hidden h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-[10px] font-semibold text-zinc-600 sm:flex dark:border-white/10 dark:bg-white/[.04] dark:text-zinc-300"><FolderOpen className="size-3.5" />Importer dossier</button>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => void importWeb(event.target.files)} accept=".zip,.html,.htm,.css,.js,.mjs,.cjs,.jsx,.ts,.tsx,.json,.svg,.png,.jpg,.jpeg,.webp,.gif,.woff,.woff2,.ttf,.otf" />
            <input ref={folderInput} type="file" multiple className="hidden" onChange={(event) => void importWeb(event.target.files)} />
            <button type="button" onClick={() => setDrawer(drawer === "files" ? "none" : "files")} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold", drawer === "files" ? "bg-black/[.07] dark:bg-white/10" : "text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10")}><Files className="size-3.5" />{webWorkspace?.files.length || 0} fichiers</button>
            {webWorkspace?.files.length ? <span className="hidden truncate text-[9px] text-zinc-400 lg:block">{webWorkspace.sourceLabel} · {webProjectFramework(webWorkspace.files)}</span> : null}
            <div className="flex-1" />
            {webWorkspace?.files.length ? <button type="button" onClick={() => void downloadWebProject(active).catch((error) => setAiError(error instanceof Error ? error.message : "Export impossible."))} className="hidden h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 lg:flex"><Download className="size-3.5" />Exporter site</button> : null}
            {lastWebChange && <button type="button" onClick={revertLastWebChange} className="hidden h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 md:flex"><RotateCcw className="size-3.5" />Annuler dernière modif</button>}
          </div>
          <div className="flex min-h-0 flex-1 gap-2 p-2.5">
            {drawer === "files" && <WebFilesPanel project={active} onSelect={(path) => mutate((project) => { ensureWebWorkspace(project).selectedPath = path; }, `Fichier sélectionné : ${path}`)} onClose={() => setDrawer("none")} />}
            <div className="min-w-0 flex-1"><DesignWebPreview project={active} inspectMode={inspectWeb} onInspectMode={setInspectWeb} onSelection={setWebSelection} onViewport={setWebViewport} /></div>
          </div>
        </> : active.domain === "architecture" ? <>
          <PhysicalToolbar view={physicalView} onView={setArchitectureView} drawer={drawer} onDrawer={setDrawer} rooms={active.plan.rooms.map((room) => ({ id: room.id, name: room.name, level: room.level || 0 }))} activeRoomId={activeRoomId} onRoom={(roomId) => { setArchitectureRoom(roomId); setPhysicalView("interior"); }} ambience={active.architecture?.ambience || "soft"} onAmbience={(ambience) => mutate((project) => { project.architecture = { ...(project.architecture || { cameraMode: "exterior", roomOrder: project.plan.rooms.map((room) => room.id) }), cameraMode: project.architecture?.cameraMode || "exterior", roomOrder: project.architecture?.roomOrder || project.plan.rooms.map((room) => room.id), ambience, renderQuality: "high" }; }, `Ambiance ${ambience}`)} onReferences={() => architectureReferenceInput.current?.click()} referenceBusy={referenceBusy} referenceCount={active.architecture?.referenceAnalyses?.length || 0} styleLabel={active.architecture?.designIntent?.style || ""} />
          <input ref={architectureReferenceInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(event) => void importArchitectureReferences(event.target.files)} />
          <div className="relative min-h-0 flex-1 p-2.5">
            {physicalView === "plan" && <div className="flex h-full gap-2"><PlanToolRail tool={tool} onTool={setTool} /><div className="min-w-0 flex-1"><DesignCanvas2D project={active} tool={tool} selection={selection} onSelection={(value) => { setSelection(value); setSelection3d(to3dSelection(value)); }} onChange={updateProject} /></div></div>}
            {physicalView !== "plan" && <ArchitectureViewport3D project={active} mode={physicalView} activeRoomId={activeRoomId} onActiveRoom={setArchitectureRoom} selection={selection3d} onSelection={(value) => { setSelection3d(to3dSelection(value)); setSelection(to3dSelection(value)); }} />}
            {selectedArchitectureObject && <ArchitectureObjectControls object={selectedArchitectureObject} onEdit={editSelectedArchitectureObject} />}
            {drawer === "simulations" && <SimulationDrawer project={active} onRun={() => mutate((project) => { project.simulations = [...runAllDesignSimulations(project), ...project.simulations].slice(0, 80); }, "Pack de simulations exécuté")} onClose={() => setDrawer("none")} />}
            {drawer === "materials" && <MaterialsDrawer project={active} onApply={applyMaterial} onClose={() => setDrawer("none")} />}
          </div>
        </> : <>
          <ProductToolbar project={active} drawer={drawer} onDrawer={setDrawer} onChange={(width, depth, height) => mutate((project) => { project.product.width = width; project.product.depth = depth; project.product.height = height; }, "Dimensions produit modifiées")} />
          <div className="relative min-h-0 flex-1 p-2.5"><DesignViewport3D project={active} selection={selection3d} onSelection={setSelection3d} onChange={updateProject} initialMode="orbit" />{drawer === "materials" && <MaterialsDrawer project={active} onApply={applyMaterial} onClose={() => setDrawer("none")} />}</div>
        </>}

        {drawer === "versions" && <VersionDrawer project={active} onCreate={createVersion} onRestore={restoreVersion} onDuplicate={() => { const cloned = cloneDesignProject(active); setProjects((rows) => [cloned, ...rows]); openProject(cloned); setSaveState("dirty"); }} onClose={() => setDrawer("none")} />}
      </main>

      <SophenicPanel project={active} input={aiInput} onInput={setAiInput} busy={aiBusy} progress={aiProgress} steps={aiSteps} error={aiError} onSubmit={(value) => void submitAi(value)} selectedContext={active.domain === "web" ? active.webWorkspace?.selectedElement?.selector || "" : selectedContext} onClearSelection={() => { if (active.domain === "web") setWebSelection(null); else { setSelection(null); setSelection3d(null); } }} />
    </div>
  </div>;
}

function DesignHome({ onCreate }: { onCreate: () => void }) {
  return <div className="relative grid h-full min-h-[650px] place-items-center overflow-hidden bg-[#f6f2ea] px-6 dark:bg-[#101010]">
    <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_50%_35%,rgba(177,124,49,.13),transparent_34%),linear-gradient(rgba(120,95,65,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(120,95,65,.035)_1px,transparent_1px)] [background-size:auto,40px_40px,40px_40px]" />
    <div className="relative text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[#d8c4a4] bg-[#efe3cf] text-[#8a6332] shadow-[0_12px_40px_rgba(105,77,43,.12)] dark:border-white/10 dark:bg-white/[.06]"><Sparkles className="size-5" /></div><div className="mt-5 text-[10px] font-bold uppercase tracking-[.34em] text-[#9a7447]">SOPHENIC DESIGN</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-[#2f2922] sm:text-4xl dark:text-zinc-100">Créer. Modifier. Explorer.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">Un seul espace de conception, piloté avec Sophenic.</p><button type="button" onClick={onCreate} className="mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2d2924] px-6 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(45,41,36,.18)] transition hover:-translate-y-0.5 hover:bg-[#1f1c19] dark:bg-[#eee8de] dark:text-[#26221d]"><Plus className="size-4" />Créer un projet</button></div>
  </div>;
}

function DesignChooser({ projects, name, onName, onCreate, onOpen, onDelete, onBack }: { projects: DesignProject[]; name: string; onName: (value: string) => void; onCreate: (domain: DesignDomain) => void; onOpen: (project: DesignProject) => void; onDelete: (id: string) => void; onBack: () => void }) {
  return <div className="h-full min-h-[650px] overflow-auto bg-[#f6f2ea] p-5 sm:p-8 dark:bg-[#101010]"><div className="mx-auto max-w-5xl"><button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><ArrowLeft className="size-3.5" />Retour</button><div className="mt-12"><div className="text-[10px] font-bold uppercase tracking-[.28em] text-[#9a7447]">NOUVEAU PROJET</div><h2 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Qu’est-ce que tu veux concevoir ?</h2><Input value={name} onChange={(event) => onName(event.target.value)} placeholder="Nom du projet (optionnel)" className="mt-5 h-11 max-w-md rounded-xl border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[.04]" /></div><div className="mt-7 grid gap-4 md:grid-cols-3">{projectKinds.map((item) => <button key={item.domain} type="button" onClick={() => onCreate(item.domain)} className="group min-h-56 rounded-[26px] border border-black/[.08] bg-white/78 p-6 text-left shadow-[0_18px_50px_rgba(76,59,39,.06)] transition hover:-translate-y-1 hover:border-[#c9aa7b] hover:shadow-[0_24px_60px_rgba(76,59,39,.12)] dark:border-white/[.08] dark:bg-white/[.035]"><div className="grid size-11 place-items-center rounded-2xl bg-[#eee3d2] text-[#805c32] transition group-hover:scale-105 dark:bg-white/10"><item.icon className="size-5" /></div><div className="mt-8 text-[9px] font-bold tracking-[.2em] text-[#a47b48]">{item.eyebrow}</div><div className="mt-1.5 text-xl font-semibold tracking-[-.03em]">{item.label}</div><p className="mt-3 text-xs leading-5 text-zinc-500">{item.description}</p></button>)}</div>{projects.length > 0 && <div className="mt-14"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-zinc-400"><Layers3 className="size-3.5" />Projets existants</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 12).map((project) => <div key={project.id} className="group flex items-center gap-3 rounded-2xl border border-black/[.07] bg-white/55 p-3 dark:border-white/[.07] dark:bg-white/[.025]"><button type="button" onClick={() => onOpen(project)} className="min-w-0 flex-1 text-left"><div className="truncate text-xs font-semibold">{project.name}</div><div className="mt-0.5 text-[9px] text-zinc-400">{projectTypeLabel(project)} · {new Date(project.updatedAt).toLocaleDateString("fr-FR")}</div></button><button type="button" onClick={() => onDelete(project.id)} className="grid size-7 place-items-center rounded-lg text-zinc-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950"><Trash2 className="size-3" /></button></div>)}</div></div>}</div></div>;
}

function ArchitectureObjectControls({ object, onEdit }: { object: DesignProject["plan"]["objects"][number]; onEdit: (kind: "left" | "right" | "forward" | "back" | "rotate-left" | "rotate-right" | "larger" | "smaller" | "delete") => void }) {
  return <div className="absolute bottom-3 right-3 z-30 w-[245px] rounded-2xl border border-black/10 bg-white/94 p-3 shadow-xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/94"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{object.name}</div><div className="mt-0.5 text-[8px] uppercase tracking-[.12em] text-zinc-400">{object.category}</div></div><button type="button" onClick={() => onEdit("delete")} className="grid size-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40" title="Supprimer"><Trash2 className="size-3.5" /></button></div><div className="mt-2 grid grid-cols-4 gap-1"><button onClick={() => onEdit("left")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">← X</button><button onClick={() => onEdit("right")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">X →</button><button onClick={() => onEdit("forward")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">↑ Z</button><button onClick={() => onEdit("back")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">Z ↓</button><button onClick={() => onEdit("rotate-left")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">↶ 15°</button><button onClick={() => onEdit("rotate-right")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">↷ 15°</button><button onClick={() => onEdit("smaller")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">− Taille</button><button onClick={() => onEdit("larger")} className="rounded-lg bg-black/5 py-1.5 text-[10px] dark:bg-white/10">+ Taille</button></div>{object.asset?.provider === "sketchfab" && <div className="mt-2 border-t border-black/[.06] pt-2 text-[8px] leading-4 text-zinc-400 dark:border-white/[.07]">Sketchfab · {object.asset.author || "Auteur inconnu"}<br />Licence : {object.asset.license || "non renseignée"}</div>}</div>;
}

function PhysicalToolbar({ view, onView, drawer, onDrawer, rooms, activeRoomId, onRoom, ambience, onAmbience, onReferences, referenceBusy, referenceCount, styleLabel }: { view: PhysicalView; onView: (view: PhysicalView) => void; drawer: Drawer; onDrawer: (drawer: Drawer) => void; rooms: Array<{ id: string; name: string; level: number }>; activeRoomId: string; onRoom: (roomId: string) => void; ambience: "day" | "evening" | "soft"; onAmbience: (ambience: "day" | "evening" | "soft") => void; onReferences?: () => void; referenceBusy?: boolean; referenceCount?: number; styleLabel?: string }) {
  const ambienceModes = [["day", Sun, "Jour"], ["soft", Sparkles, "Doux"], ["evening", Moon, "Soir"]] as const;
  return <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-black/[.06] bg-white/45 px-3 py-1.5 dark:border-white/[.06] dark:bg-white/[.015]">
    <div className="flex items-center gap-1 rounded-xl bg-black/[.035] p-1 dark:bg-white/[.05]">{([['exterior', Building2, 'Extérieur'], ['interior', Crosshair, 'Intérieur'], ['plan', Ruler, 'Plan']] as const).map(([id, Icon, label]) => <button key={id} type="button" onClick={() => onView(id)} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold", view === id ? "bg-white text-[#805b32] shadow-sm dark:bg-white/10 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}><Icon className="size-3.5" />{label}</button>)}</div>
    <div className="hidden items-center gap-1.5 md:flex"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-zinc-400">Aller à</span><select value={activeRoomId || rooms[0]?.id || ""} onChange={(event) => onRoom(event.target.value)} className="h-8 max-w-44 rounded-lg border border-black/10 bg-white px-2 text-[10px] font-semibold text-zinc-600 outline-none hover:border-[#b58a55] dark:border-white/10 dark:bg-white/[.05] dark:text-zinc-200">{rooms.map((room) => <option key={room.id} value={room.id}>{room.level > 0 ? `Étage ${room.level} · ` : "RDC · "}{room.name}</option>)}</select></div>
    <div className="hidden items-center gap-1 rounded-xl bg-black/[.03] p-1 lg:flex dark:bg-white/[.045]">{ambienceModes.map(([id, Icon, label]) => <button key={id} type="button" title={`Ambiance ${label}`} onClick={() => onAmbience(id)} className={cn("flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold transition", ambience === id ? "bg-white text-[#805b32] shadow-sm dark:bg-white/10 dark:text-white" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200")}><Icon className="size-3" />{label}</button>)}</div>
    <button type="button" onClick={onReferences} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><Upload className="size-3.5" />{referenceBusy ? "Analyse des références…" : `Ajouter références${referenceCount ? ` (${referenceCount})` : ""}`}</button>
    {styleLabel ? <div className="hidden max-w-[280px] truncate rounded-full bg-black/[.035] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.12em] text-zinc-500 xl:block dark:bg-white/[.05]">Intent · {styleLabel}</div> : null}
    <div className="flex-1" />
    <button type="button" onClick={() => onDrawer(drawer === "materials" ? "none" : "materials")} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><Palette className="size-3.5" />Matériaux</button>
    <button type="button" onClick={() => onDrawer(drawer === "simulations" ? "none" : "simulations")} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><FlaskConical className="size-3.5" />Simulations</button>
  </div>;
}

function PlanToolRail({ tool, onTool }: { tool: DesignTool; onTool: (tool: DesignTool) => void }) {
  return <div className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-2xl border border-black/[.08] bg-white/75 py-2 shadow-sm dark:border-white/[.08] dark:bg-white/[.035]">{planTools.map((item) => <button key={item.id} type="button" title={item.label} onClick={() => onTool(item.id)} className={cn("grid size-9 place-items-center rounded-xl", tool === item.id ? "bg-[#805e37] text-white" : "text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10")}><item.icon className="size-4" /></button>)}</div>;
}

function ProductToolbar({ project, drawer, onDrawer, onChange }: { project: DesignProject; drawer: Drawer; onDrawer: (drawer: Drawer) => void; onChange: (w: number, d: number, h: number) => void }) {
  const [w, setW] = useState(project.product.width); const [d, setD] = useState(project.product.depth); const [h, setH] = useState(project.product.height);
  useEffect(() => { setW(project.product.width); setD(project.product.depth); setH(project.product.height); }, [project.id, project.product.depth, project.product.height, project.product.width]);
  return <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-black/[.06] bg-white/45 px-3 py-1.5 dark:border-white/[.06] dark:bg-white/[.015]"><div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500"><Package className="size-3.5" />Objet 3D</div><div className="hidden h-5 w-px bg-black/10 sm:block dark:bg-white/10" />{([['L', w, setW], ['P', d, setD], ['H', h, setH]] as const).map(([label, value, setter]) => <label key={label} className="flex items-center gap-1 text-[9px] text-zinc-400">{label}<input type="number" min="0.01" step="0.05" value={value} onChange={(event) => setter(Number(event.target.value))} onBlur={() => onChange(Math.max(.01, w), Math.max(.01, d), Math.max(.01, h))} className="h-7 w-16 rounded-lg border border-black/10 bg-white px-2 text-[10px] text-zinc-700 outline-none focus:border-[#b58a55] dark:border-white/10 dark:bg-white/[.04] dark:text-zinc-200" />m</label>)}<div className="flex-1" /><button type="button" onClick={() => onDrawer(drawer === "materials" ? "none" : "materials")} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><Palette className="size-3.5" />Matériaux</button></div>;
}

function WebFilesPanel({ project, onSelect, onClose }: { project: DesignProject; onSelect: (path: string) => void; onClose: () => void }) {
  const workspace = project.webWorkspace; const selected = workspace?.selectedPath || ""; const current = workspace?.files.find((file) => file.path === selected);
  return <aside className="flex w-[230px] shrink-0 flex-col overflow-hidden rounded-2xl border border-black/[.08] bg-white/85 dark:border-white/[.08] dark:bg-[#171717]"><div className="flex h-10 items-center gap-2 border-b border-black/[.06] px-3 dark:border-white/[.06]"><FileCode2 className="size-3.5 text-[#9a7138]" /><span className="flex-1 text-[10px] font-bold uppercase tracking-[.15em] text-zinc-500">Fichiers</span><button onClick={onClose}><X className="size-3.5 text-zinc-400" /></button></div><div className="min-h-0 flex-1 overflow-auto p-1.5">{workspace?.files.map((file) => <button key={file.path} type="button" onClick={() => onSelect(file.path)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px]", selected === file.path ? "bg-[#eee3d3] text-[#694b29] dark:bg-white/10 dark:text-white" : "text-zinc-500 hover:bg-black/[.04] dark:hover:bg-white/[.05]")}><Code2 className="size-3 shrink-0 opacity-60" /><span className="truncate">{file.path}</span></button>)}</div>{current?.kind === "text" && <div className="max-h-44 overflow-auto border-t border-black/[.06] bg-[#f8f6f2] p-2 font-mono text-[8px] leading-4 text-zinc-500 dark:border-white/[.06] dark:bg-black/20"><pre className="whitespace-pre-wrap">{(current.content || "").slice(0, 5000)}</pre></div>}</aside>;
}

function SimulationDrawer({ project, onRun, onClose }: { project: DesignProject; onRun: () => void; onClose: () => void }) {
  const latest = new Map<string, DesignProject["simulations"][number]>(); for (const item of project.simulations) if (!latest.has(item.type)) latest.set(item.type, item);
  return <div className="absolute bottom-4 left-4 top-4 z-30 w-[320px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-[#181818]/95"><div className="flex h-12 items-center border-b border-black/[.06] px-3 dark:border-white/[.06]"><FlaskConical className="mr-2 size-4 text-[#966d3b]" /><div className="flex-1 text-xs font-semibold">Simulations indicatives</div><button onClick={onClose}><X className="size-4 text-zinc-400" /></button></div><div className="p-3"><Button size="sm" onClick={onRun} className="w-full rounded-xl bg-[#7f5c35] text-xs hover:bg-[#694a2a]">Lancer les 7 simulations</Button><p className="mt-2 text-[9px] leading-4 text-zinc-400">Ces scores aident à comparer des concepts. Ils ne constituent pas une validation professionnelle, réglementaire, structurelle ou énergétique.</p><div className="mt-3 space-y-2">{[...latest.values()].map((item) => <div key={item.id} className="rounded-xl border border-black/[.06] p-2.5 dark:border-white/[.07]"><div className="flex items-center"><span className="flex-1 text-[10px] font-semibold">{item.label}</span><span className="text-xs font-bold text-[#7f5c35]">{item.score}/100</span></div><p className="mt-1 text-[9px] leading-4 text-zinc-500">{item.recommendations[0] || "Aucune recommandation prioritaire."}</p></div>)}</div></div></div>;
}

function MaterialsDrawer({ project, onApply, onClose }: { project: DesignProject; onApply: (material: DesignMaterial) => void; onClose: () => void }) {
  return <div className="absolute bottom-4 left-4 top-4 z-30 w-[290px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-[#181818]/95"><div className="flex h-12 items-center border-b border-black/[.06] px-3 dark:border-white/[.06]"><Palette className="mr-2 size-4 text-[#966d3b]" /><div className="flex-1 text-xs font-semibold">Matériaux</div><button onClick={onClose}><X className="size-4 text-zinc-400" /></button></div><div className="grid gap-2 p-3">{project.materials.map((material) => <button type="button" key={material.id} onClick={() => onApply(material)} className="flex items-center gap-3 rounded-xl border border-black/[.06] p-2 text-left hover:border-[#c5a174] dark:border-white/[.07]"><span className="size-9 rounded-lg border border-black/10 shadow-inner" style={{ background: material.color }} /><span><span className="block text-[10px] font-semibold">{material.name}</span><span className="text-[8px] uppercase tracking-wider text-zinc-400">{material.category}</span></span></button>)}</div></div>;
}

function VersionDrawer({ project, onCreate, onRestore, onDuplicate, onClose }: { project: DesignProject; onCreate: () => void; onRestore: (snapshot: DesignVersionSnapshot) => void; onDuplicate: () => void; onClose: () => void }) {
  return <div className="absolute inset-y-3 right-[362px] z-40 w-[300px] overflow-hidden rounded-2xl border border-black/10 bg-white/96 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-[#181818]/96"><div className="flex h-12 items-center border-b border-black/[.06] px-3 dark:border-white/[.06]"><History className="mr-2 size-4 text-[#966d3b]" /><span className="flex-1 text-xs font-semibold">Versions</span><button onClick={onClose}><X className="size-4 text-zinc-400" /></button></div><div className="grid grid-cols-2 gap-2 p-3"><Button size="sm" onClick={onCreate} className="rounded-xl bg-[#7f5c35] text-[10px]">Créer version</Button><Button size="sm" variant="outline" onClick={onDuplicate} className="rounded-xl text-[10px]"><Copy className="mr-1 size-3" />Dupliquer</Button></div><div className="max-h-[calc(100%-100px)] overflow-auto px-3 pb-3">{project.versions.length ? project.versions.map((version) => <button key={version.id} type="button" onClick={() => onRestore(version)} className="mb-2 w-full rounded-xl border border-black/[.06] p-2.5 text-left hover:border-[#c8a67b] dark:border-white/[.07]"><div className="text-[10px] font-semibold">{version.label}</div><div className="mt-1 text-[8px] text-zinc-400">{new Date(version.createdAt).toLocaleString("fr-FR")}</div><div className="mt-1 text-[9px] text-zinc-500">{version.summary}</div></button>) : <div className="py-10 text-center text-[10px] text-zinc-400">Aucune version manuelle.</div>}</div></div>;
}

/** V8.1 — panneau « Références analysées / Style détecté / Matériaux ». */
function ReferenceSummaryCard({ project }: { project: DesignProject }) {
  const references = project.architecture?.referenceAnalyses || [];
  const intent = project.architecture?.designIntent;
  if (!references.length && !intent) return null;
  const materials = intent?.materials?.length ? intent.materials : [...new Set(references.flatMap((reference) => reference.materialHints))].slice(0, 5);
  const style = intent?.detectedStyleLabel || references.find((reference) => reference.styleHints.length)?.styleHints[0] || intent?.style || "En attente d'analyse";
  const furnitureStyle = intent?.furnitureStyle || references.find((reference) => reference.furnitureStyle)?.furnitureStyle;
  const lighting = intent?.lighting || references.find((reference) => reference.lighting)?.lighting;
  const visionAnalyzed = references.filter((reference) => reference.extraction === "vision-ai").length;
  return <div className="mb-3 rounded-2xl border border-[#e0d3bc] bg-[#faf5ec] p-3 dark:border-white/[.08] dark:bg-white/[.04]">
    <div className="mb-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-[#8a6539] dark:text-zinc-400"><Palette className="size-3" />Références & Design Intent V8.1</div>
    <dl className="space-y-1.5 text-[9.5px] leading-4">
      <div className="flex gap-2"><dt className="w-[92px] shrink-0 font-semibold text-zinc-500">Références analysées</dt><dd className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{references.length}{visionAnalyzed ? ` · ${visionAnalyzed} via modèle Vision` : ""}{intent?.origin === "brain" ? " · intent via SOPHENIC Brain" : ""}</dd></div>
      <div className="flex gap-2"><dt className="w-[92px] shrink-0 font-semibold text-zinc-500">Style détecté</dt><dd className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{style}</dd></div>
      <div className="flex gap-2"><dt className="w-[92px] shrink-0 font-semibold text-zinc-500">Matériaux</dt><dd className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{materials.length ? materials.join(", ") : "—"}</dd></div>
      {furnitureStyle && <div className="flex gap-2"><dt className="w-[92px] shrink-0 font-semibold text-zinc-500">Mobilier</dt><dd className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{furnitureStyle}</dd></div>}
      {lighting && <div className="flex gap-2"><dt className="w-[92px] shrink-0 font-semibold text-zinc-500">Lumière</dt><dd className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{lighting}</dd></div>}
      {typeof intent?.monumentality === "number" && <div className="flex gap-2"><dt className="w-[92px] shrink-0 font-semibold text-zinc-500">Monumentalité</dt><dd className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">{intent.monumentality}/100 · murs {intent.wallHeight?.toFixed(1) || "—"} m</dd></div>}
    </dl>
  </div>;
}

function SophenicPanel({ project, input, onInput, busy, progress, steps, error, onSubmit, selectedContext, onClearSelection }: { project: DesignProject; input: string; onInput: (value: string) => void; busy: boolean; progress: string; steps: ArchitectureWorkStep[]; error: string; onSubmit: (value?: string) => void; selectedContext: string; onClearSelection: () => void }) {  const messages = project.aiMessages.slice(-60); const suggestions = project.domain === "web" ? ["Rends le design de ce site beaucoup plus premium sans casser ses fonctionnalités.", "Améliore uniquement la version mobile.", "Rends la hero plus forte et la navigation plus élégante."] : project.domain === "architecture" ? ["Transforme la pièce actuelle en intérieur très haut de gamme, réaliste et détaillé : meilleurs meubles, textures, lumière, décoration et finitions, puis vérifie tout.", "Recompose la pièce avec une finition luxury : mobilier cohérent, tapis, rideaux, luminaires, plantes et détails décoratifs sans bloquer la circulation.", "Transforme toute la maison selon mon brief, compose chaque pièce comme un ensemble cohérent et vérifie style, matériaux, distances et ouvertures avant de terminer.", "Fais un audit architectural et de finition complet de la pièce actuelle.", "Ajoute une grande baie vitrée seulement si elle améliore réellement la lumière et l’usage."] : ["Rends cet objet plus élégant et plus léger visuellement.", "Propose 3 variantes avec des matériaux différents.", "Affine les proportions sans changer la largeur totale."];
  return <aside className="flex w-[350px] max-w-[42vw] shrink-0 flex-col border-l border-black/[.07] bg-[#fbf9f5] dark:border-white/[.07] dark:bg-[#141414]"><div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/[.06] px-3 dark:border-white/[.06]"><div className="grid size-7 place-items-center rounded-lg bg-[#eee3d2] text-[#876238] dark:bg-white/10"><Sparkles className="size-3.5" /></div><div><div className="text-[11px] font-semibold">Sophenic</div><div className="text-[8px] uppercase tracking-[.16em] text-zinc-400">Copilote du projet</div></div><div className="flex-1" /><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">AUTO</span></div>{selectedContext && <div className="flex items-center gap-2 border-b border-[#eadcc7] bg-[#f8efe1] px-3 py-2 text-[9px] text-[#735433] dark:border-white/[.06] dark:bg-white/[.035] dark:text-zinc-300"><Crosshair className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">Contexte : {selectedContext}</span><button onClick={onClearSelection}><X className="size-3" /></button></div>}<div className="min-h-0 flex-1 overflow-auto p-3"><div className="mb-4 rounded-2xl bg-[#f0e7da] p-3 text-[10px] leading-5 text-[#594832] dark:bg-white/[.045] dark:text-zinc-300">Je transforme ta demande en Design Intent V8.1 via SOPHENIC Brain : style, matériaux, mobilier, lumière, monumentalité et contraintes. Tes images de référence sont analysées par le modèle Vision et orientent toute la génération. Ensuite je synthétise un programme architectural, compose chaque pièce avec les meilleurs assets Sketchfab réels disponibles et vérifie tout avant de finaliser.</div>{project.domain === "architecture" && <ReferenceSummaryCard project={project} />}{project.domain === "architecture" && <ArchitectureThinkingTimeline steps={steps} />}{messages.length ? <div className="space-y-3">{messages.map((message) => <div key={message.id} className={cn("max-w-[92%] rounded-2xl px-3 py-2.5 text-[10px] leading-5", message.role === "user" ? "ml-auto bg-[#302b25] text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-white text-zinc-600 shadow-sm ring-1 ring-black/[.05] dark:bg-white/[.045] dark:text-zinc-300 dark:ring-white/[.05]")}><div className="whitespace-pre-wrap">{message.content}</div>{message.role === "assistant" && message.applied && <div className="mt-1.5 flex items-center gap-1 text-[8px] font-semibold text-emerald-600"><Check className="size-2.5" />Appliqué au projet</div>}</div>)}</div> : <div className="space-y-2">{suggestions.map((text) => <button key={text} type="button" onClick={() => onInput(text)} className="w-full rounded-xl border border-black/[.06] bg-white/55 p-2.5 text-left text-[9px] leading-4 text-zinc-500 hover:border-[#c6a477] dark:border-white/[.07] dark:bg-white/[.025]">{text}</button>)}</div>}</div><div className="shrink-0 border-t border-black/[.06] p-3 dark:border-white/[.06]">{progress && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#f5ecdf] px-2.5 py-1.5 text-[9px] text-[#76572f] dark:bg-white/[.05] dark:text-zinc-300"><Loader2 className="size-3 animate-spin" />{progress}</div>}{error && <div className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[9px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}<div className="rounded-2xl border border-black/[.09] bg-white p-2 shadow-sm focus-within:border-[#c19a68] dark:border-white/10 dark:bg-white/[.035]"><textarea value={input} onChange={(event) => onInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} rows={3} placeholder={project.domain === "web" ? "Ex. Rends ce site 100x mieux…" : project.domain === "architecture" ? "Ex. Agrandis le salon…" : "Ex. Arrondis davantage les angles…"} className="w-full resize-none bg-transparent px-1.5 py-1 text-[11px] leading-5 outline-none placeholder:text-zinc-350" /><div className="flex items-center"><span className="px-1.5 text-[8px] text-zinc-400">Entrée pour envoyer · Maj+Entrée pour une ligne</span><div className="flex-1" /><button type="button" disabled={busy || !input.trim()} onClick={() => onSubmit()} className="grid size-8 place-items-center rounded-xl bg-[#7f5d36] text-white disabled:opacity-35">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}</button></div></div></div></aside>;
}
