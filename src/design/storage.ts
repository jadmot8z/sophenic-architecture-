import type { DesignProject } from "./types";
import { syncArchitectureNavigation } from "./architecture";

const STORAGE_KEY = "sophenic.design.projects.v1";
const ACTIVE_KEY = "sophenic.design.active.v1";

function validProject(value: unknown): value is DesignProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<DesignProject>;
  return row.schemaVersion === 1 && typeof row.id === "string" && typeof row.name === "string" && Boolean(row.plan && row.digital && row.product);
}

function normalizeProject(project: DesignProject): DesignProject {
  if (project.domain !== "architecture") return project;
  // Migration non destructive : on conserve les objets des anciens projets,
  // mais on leur ajoute la navigation V2 nécessaire au nouveau viewer.
  return syncArchitectureNavigation(project);
}

function browserList(): DesignProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(validProject).map(normalizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 100) : [];
  } catch { return []; }
}
function browserWrite(projects: DesignProject[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 100))); } catch { /* desktop persistence remains authoritative when available */ }
}

export async function listDesignProjects(): Promise<DesignProject[]> {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  if (desktop?.workspace.designList) {
    try {
      const rows = await desktop.workspace.designList();
      const projects = Array.isArray(rows) ? rows.filter(validProject).map(normalizeProject) : [];
      if (projects.length) browserWrite(projects);
      return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch { /* fallback below */ }
  }
  return browserList();
}

export async function saveDesignProject(project: DesignProject): Promise<DesignProject> {
  const next = structuredClone(project);
  next.updatedAt = new Date().toISOString();
  const local = browserList();
  browserWrite([next, ...local.filter((item) => item.id !== next.id)]);
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  if (desktop?.workspace.designSave) {
    try { return await desktop.workspace.designSave(next) as DesignProject; } catch { /* local copy is already saved */ }
  }
  return next;
}

export async function deleteDesignProject(projectId: string): Promise<boolean> {
  browserWrite(browserList().filter((item) => item.id !== projectId));
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  if (desktop?.workspace.designDelete) {
    try { return await desktop.workspace.designDelete(projectId); } catch { return true; }
  }
  return true;
}

export function getActiveDesignProjectId(): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(ACTIVE_KEY) || ""; } catch { return ""; }
}
export function setActiveDesignProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  try { if (projectId) window.localStorage.setItem(ACTIVE_KEY, projectId); else window.localStorage.removeItem(ACTIVE_KEY); } catch {}
}
