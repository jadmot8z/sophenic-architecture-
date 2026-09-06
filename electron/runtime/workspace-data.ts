import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export type WorkspaceMessage = { id?: string; role: "user" | "assistant"; content: string; [key: string]: unknown };
export type ConversationRecord = { id: string; title: string; mode: "chat" | "code" | "image"; createdAt: string; updatedAt: string; messages: WorkspaceMessage[]; workspace?: string };
export type MemoryScope = "user" | "project" | "preference";
export type MemoryKind = "identity" | "preference" | "constraint" | "goal" | "project" | "fact";
export type MemoryEntry = {
  id: string;
  text: string;
  source: string;
  pinned: boolean;
  scope: MemoryScope;
  kind: MemoryKind;
  projectId?: string;
  importance: number;
  accessCount: number;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type MemoryState = { enabled: boolean; maxEntries: number; entries: MemoryEntry[] };
export type PlannerTask = {
  id: string;
  title: string;
  prompt: string;
  notes?: string;
  status: "scheduled" | "running" | "done" | "failed";
  recurrence: "once" | "daily";
  scheduledFor: string;
  enabled: boolean;
  lastRunAt?: string;
  lastResult?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};
export type LibraryEntry = { id: string; name: string; kind: "image" | "file" | "project" | "export"; path?: string; url?: string; source?: string; createdAt: string };
export type DesignProjectRecord = { schemaVersion: 1; id: string; name: string; updatedAt: string; createdAt: string; [key: string]: unknown };
export type VoiceSettings = {
  enabled: boolean;
  language: string;
  voiceId: string;
  speed: number;
  expressiveness: number;
  volume: number;
  naturalConversation: boolean;
  silencePrompts: boolean;
  inputSensitivity: number;
  serviceUrl: string;
};

function dataHome(): string {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "Sophenic");
  return path.join(os.homedir(), ".sophenic");
}
function file(name: string): string { return path.join(dataHome(), name); }
function id(): string { return `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`; }
function readJson<T>(name: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(file(name), "utf8")) as T; } catch { return fallback; } }
function writeJson(name: string, value: unknown): void { const target = file(name); fs.mkdirSync(path.dirname(target), { recursive: true }); const tmp = `${target}.${process.pid}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.renameSync(tmp, target); }

function cleanConversationTitle(value: string, mode: ConversationRecord["mode"]): string {
  const fallback = mode === "code" ? "Nouvelle session Code" : mode === "image" ? "Nouvelle création Image" : "Nouvelle conversation";
  const normalized = value.replace(/[`*_#>]/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  const compact = normalized.replace(/^(peux[- ]tu|tu peux|je veux que tu|s'il te plaît|stp)\s+/i, "");
  return (compact || normalized).slice(0, 58).replace(/[.,;:!?\-]+$/g, "").trim() || fallback;
}

export function listConversations(): ConversationRecord[] { return readJson<ConversationRecord[]>("conversation-history.json", []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 1000); }
export function saveConversation(input: Partial<ConversationRecord> & { id: string; title: string; mode: ConversationRecord["mode"]; messages: WorkspaceMessage[] }): ConversationRecord {
  const all = listConversations();
  const previous = all.find((item) => item.id === input.id);
  const now = new Date().toISOString();
  const firstUser = input.messages.find((message) => message.role === "user")?.content || input.title;
  const record: ConversationRecord = { id: input.id, title: previous?.title || cleanConversationTitle(firstUser, input.mode), mode: input.mode, createdAt: previous?.createdAt || input.createdAt || now, updatedAt: now, messages: input.messages.slice(-500), ...(input.workspace ? { workspace: input.workspace } : {}) };
  const next = [record, ...all.filter((item) => item.id !== record.id)].slice(0, 1000);
  writeJson("conversation-history.json", next);
  return record;
}
export function deleteConversation(conversationId: string): boolean { writeJson("conversation-history.json", listConversations().filter((item) => item.id !== conversationId)); return true; }
export function clearConversationHistory(): boolean { writeJson("conversation-history.json", []); return true; }

function defaultMemory(): MemoryState { return { enabled: true, maxEntries: 20_000, entries: [] }; }
function memoryKind(text: string): MemoryKind {
  if (/\b(pr[ée]f[èe]re|j['’]aime|je n['’]aime pas|toujours|jamais)\b/i.test(text)) return "preference";
  if (/\b(objectif|but|ambition|priorit[ée])\b/i.test(text)) return "goal";
  if (/\b(doit|contrainte|interdit|obligatoire|ne .* jamais)\b/i.test(text)) return "constraint";
  if (/\b(projet|workspace|codebase|application|produit)\b/i.test(text)) return "project";
  if (/\b(je m['’]appelle|mon nom|j['’]habite|je vis|je travaille|mon m[ée]tier|je suis)\b/i.test(text)) return "identity";
  return "fact";
}
function stableMemory(text: string, source: string, pinned: boolean): boolean {
  if (source === "manual" || pinned) return true;
  const explicitlyPersistent = /\b(souviens[- ]toi|m[ée]morise|retiens|n['’]oublie pas)\b/i.test(text);
  if (explicitlyPersistent) return true;
  if (text.trim().endsWith("?")) return false;
  if (source.startsWith("project:") && /\b(typescript|javascript|react|next\.?js|vue|angular|python|rust|java|stack|framework|architecture|base de donn[ée]es|doit|obligatoire|sans|ne .* pas)\b/i.test(text)) return true;
  return /\b(je m['’]appelle|mon nom|j['’]habite|je vis|je travaille|mon m[ée]tier|je suis|je pr[ée]f[èe]re|j['’]aime|je n['’]aime pas|mon objectif|notre objectif|ma soci[ée]t[ée]|mon entreprise|pour ce projet|dans ce projet|ce projet doit|toujours|ne .* jamais)\b/i.test(text);
}
function memoryScopeFor(kind: MemoryKind, source: string): MemoryScope {
  if (source.startsWith("project:") || source.includes(":code") || kind === "project") return "project";
  if (kind === "preference" || kind === "constraint") return "preference";
  return "user";
}
function projectFromSource(source: string): string | undefined {
  if (!source.startsWith("project:")) return undefined;
  const value = source.slice("project:".length).trim();
  return value ? value.slice(0, 500) : undefined;
}
export function getMemoryState(): MemoryState {
  const state = readJson<MemoryState>("memory.json", defaultMemory());
  const entries = Array.isArray(state.entries) ? state.entries.map((entry) => {
    const kind = entry.kind || memoryKind(entry.text || "");
    return {
      ...entry,
      scope: entry.scope || memoryScopeFor(kind, entry.source || "legacy"),
      kind,
      importance: Math.max(0, Math.min(1, Number(entry.importance) || (entry.pinned ? 1 : 0.65))),
      accessCount: Math.max(0, Number(entry.accessCount) || 0)
    } as MemoryEntry;
  }) : [];
  return { enabled: state.enabled !== false, maxEntries: Math.max(100, Math.min(20_000, Number(state.maxEntries) || 20_000)), entries };
}
export function setMemoryEnabled(enabled: boolean): MemoryState { const current = getMemoryState(); current.enabled = enabled; writeJson("memory.json", current); return current; }
export function setMemoryCapacity(maxEntries: number): MemoryState { const current = getMemoryState(); current.maxEntries = Math.max(100, Math.min(20_000, Math.round(maxEntries || 20_000))); current.entries = current.entries.slice(0, current.maxEntries); writeJson("memory.json", current); return current; }
export function remember(text: string, source = "manual", pinned = false): MemoryState {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 3000);
  const current = getMemoryState();
  if (!clean || (!current.enabled && source !== "manual") || !stableMemory(clean, source, pinned)) return current;
  const normalized = clean.toLowerCase();
  const existing = current.entries.find((entry) => entry.text.toLowerCase() === normalized);
  const now = new Date().toISOString();
  if (existing) { existing.updatedAt = now; existing.pinned = existing.pinned || pinned; existing.importance = Math.max(existing.importance, pinned ? 1 : 0.7); }
  else {
    const kind = memoryKind(clean);
    current.entries.unshift({ id: id(), text: clean, source, pinned, scope: memoryScopeFor(kind, source), kind, projectId: projectFromSource(source), importance: pinned ? 1 : /souviens|m[ée]morise|retiens/i.test(clean) ? 0.9 : 0.7, accessCount: 0, createdAt: now, updatedAt: now });
  }
  current.entries.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  current.entries = current.entries.slice(0, current.maxEntries);
  writeJson("memory.json", current);
  return current;
}
export function deleteMemoryEntry(entryId: string): MemoryState { const current = getMemoryState(); current.entries = current.entries.filter((entry) => entry.id !== entryId); writeJson("memory.json", current); return current; }
export function clearMemory(): MemoryState { const current = getMemoryState(); current.entries = []; writeJson("memory.json", current); return current; }
function memoryTokens(value: string): Set<string> {
  return new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) || []);
}
export function memoryPrompt(query = "", projectId = ""): string {
  const current = getMemoryState();
  if (!current.enabled || !current.entries.length) return "";
  const queryTokens = memoryTokens(query);
  const eligible = current.entries.filter((entry) => entry.scope !== "project" || Boolean(projectId && (!entry.projectId || entry.projectId === projectId)));
  const selected = eligible.map((entry) => {
    const overlap = [...memoryTokens(entry.text)].filter((token) => queryTokens.has(token)).length;
    const projectMatch = Boolean(projectId && entry.projectId && entry.projectId === projectId);
    const ageDays = Math.max(0, (Date.now() - Date.parse(entry.updatedAt || entry.createdAt)) / 86_400_000);
    const score = (entry.pinned ? 100 : 0) + overlap * 14 + (projectMatch ? 45 : 0) + entry.importance * 10 + Math.max(0, 8 - ageDays / 7);
    return { entry, score };
  }).sort((a, b) => b.score - a.score).slice(0, 80).map((row) => row.entry);
  let out = "SOPHENIC PERSISTENT MEMORY (use only when relevant; never mention this section unless asked):\n";
  for (const entry of selected) {
    const next = `- [${entry.scope}/${entry.kind}] ${entry.text}\n`;
    if ((out + next).length > 24_000) break;
    out += next;
  }
  return out.trim();
}

function normalizePlannerTask(input: Partial<PlannerTask> & { title: string }, previous?: PlannerTask): PlannerTask {
  const now = new Date().toISOString();
  const scheduledFor = input.scheduledFor && !Number.isNaN(Date.parse(input.scheduledFor)) ? new Date(input.scheduledFor).toISOString() : previous?.scheduledFor || new Date(Date.now() + 60_000).toISOString();
  return {
    id: input.id || previous?.id || id(),
    title: input.title.trim().slice(0, 180),
    prompt: (input.prompt || input.title).trim().slice(0, 8000),
    notes: input.notes?.trim().slice(0, 4000),
    status: input.status === "running" || input.status === "done" || input.status === "failed" ? input.status : "scheduled",
    recurrence: input.recurrence === "daily" ? "daily" : "once",
    scheduledFor,
    enabled: input.enabled !== false,
    lastRunAt: input.lastRunAt || previous?.lastRunAt,
    lastResult: input.lastResult || previous?.lastResult,
    lastError: input.lastError || previous?.lastError,
    createdAt: previous?.createdAt || input.createdAt || now,
    updatedAt: now
  };
}
export function listPlannerTasks(): PlannerTask[] { return readJson<PlannerTask[]>("planner.json", []).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)).slice(0, 2000); }
export function savePlannerTask(input: Partial<PlannerTask> & { title: string }): PlannerTask {
  const all = listPlannerTasks(); const previous = input.id ? all.find((item) => item.id === input.id) : undefined;
  const task = normalizePlannerTask(input, previous);
  writeJson("planner.json", [task, ...all.filter((item) => item.id !== task.id)].slice(0, 2000)); return task;
}
export function deletePlannerTask(taskId: string): boolean { writeJson("planner.json", listPlannerTasks().filter((item) => item.id !== taskId)); return true; }
export function duePlannerTasks(now = new Date()): PlannerTask[] {
  const ts = now.getTime();
  return listPlannerTasks().filter((task) => task.enabled && task.status !== "running" && Date.parse(task.scheduledFor) <= ts && (!task.lastRunAt || Date.now() - Date.parse(task.lastRunAt) > 30_000));
}
export function markPlannerTaskRunning(taskId: string): PlannerTask | null {
  const task = listPlannerTasks().find((item) => item.id === taskId); if (!task) return null;
  return savePlannerTask({ ...task, status: "running" });
}
export function completePlannerTask(taskId: string, result: string, error = ""): PlannerTask | null {
  const task = listPlannerTasks().find((item) => item.id === taskId); if (!task) return null;
  const now = new Date();
  const nextDate = new Date(task.scheduledFor);
  if (task.recurrence === "daily") {
    while (nextDate.getTime() <= now.getTime()) nextDate.setDate(nextDate.getDate() + 1);
  }
  return savePlannerTask({
    ...task,
    status: error ? "failed" : task.recurrence === "daily" ? "scheduled" : "done",
    enabled: task.recurrence === "daily" ? task.enabled : false,
    scheduledFor: task.recurrence === "daily" ? nextDate.toISOString() : task.scheduledFor,
    lastRunAt: now.toISOString(),
    lastResult: result.slice(0, 12_000),
    lastError: error.slice(0, 3000)
  });
}

export function listLibraryEntries(): LibraryEntry[] { return readJson<LibraryEntry[]>("library.json", []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200); }
export function libraryCapacity(): { images: number; files: number; imageLimit: number; fileLimit: number } {
  const all = listLibraryEntries();
  return { images: all.filter((item) => item.kind === "image").length, files: all.filter((item) => item.kind !== "image").length, imageLimit: 20, fileLimit: 20 };
}
export function addLibraryEntry(input: Omit<LibraryEntry, "id" | "createdAt"> & Partial<Pick<LibraryEntry, "id" | "createdAt">>): LibraryEntry {
  const all = listLibraryEntries();
  const entry: LibraryEntry = { id: input.id || id(), name: input.name.trim().slice(0, 180), kind: input.kind, path: input.path, url: input.url, source: input.source, createdAt: input.createdAt || new Date().toISOString() };
  const key = `${entry.kind}:${entry.path || entry.url || entry.name}`;
  const already = all.find((item) => `${item.kind}:${item.path || item.url || item.name}` === key);
  if (!already) {
    const capacity = libraryCapacity();
    if (entry.kind === "image" && capacity.images >= capacity.imageLimit) throw new Error("Bibliothèque pleine : 20 images sont déjà enregistrées. Supprime une ancienne image pour libérer une place avant d’en ajouter une nouvelle.");
    if (entry.kind !== "image" && capacity.files >= capacity.fileLimit) throw new Error("Bibliothèque pleine : 20 fichiers sont déjà enregistrés. Supprime un ancien fichier pour libérer une place avant d’en ajouter un nouveau.");
  }
  const next = [entry, ...all.filter((item) => `${item.kind}:${item.path || item.url || item.name}` !== key)].slice(0, 40); writeJson("library.json", next); return entry;
}
export function deleteLibraryEntry(entryId: string): boolean { writeJson("library.json", listLibraryEntries().filter((item) => item.id !== entryId)); return true; }

export function listDesignProjects(): DesignProjectRecord[] {
  return readJson<DesignProjectRecord[]>("design-projects.json", [])
    .filter((item) => item && item.schemaVersion === 1 && typeof item.id === "string" && typeof item.name === "string")
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 100);
}
export function saveDesignProject(input: DesignProjectRecord): DesignProjectRecord {
  if (!input || input.schemaVersion !== 1 || typeof input.id !== "string" || !input.id.trim() || typeof input.name !== "string" || !input.name.trim()) throw new Error("Projet Design invalide.");
  const all = listDesignProjects();
  const previous = all.find((item) => item.id === input.id);
  const now = new Date().toISOString();
  const record: DesignProjectRecord = { ...input, id: input.id.trim().slice(0, 180), name: input.name.trim().slice(0, 180), createdAt: previous?.createdAt || input.createdAt || now, updatedAt: now };
  writeJson("design-projects.json", [record, ...all.filter((item) => item.id !== record.id)].slice(0, 100));
  return record;
}
export function deleteDesignProject(projectId: string): boolean {
  writeJson("design-projects.json", listDesignProjects().filter((item) => item.id !== projectId));
  return true;
}

function defaultVoiceSettings(): VoiceSettings {
  return {
    enabled: true,
    language: "auto",
    voiceId: "sophenic-native",
    speed: 1,
    expressiveness: 0.72,
    volume: 1,
    naturalConversation: true,
    silencePrompts: true,
    inputSensitivity: 0.55,
    serviceUrl: "http://127.0.0.1:8765"
  };
}
export function getVoiceSettings(): VoiceSettings {
  const stored = readJson<Partial<VoiceSettings>>("voice-settings.json", {});
  return saveVoiceSettings({ ...defaultVoiceSettings(), ...stored }, false);
}
export function saveVoiceSettings(input: Partial<VoiceSettings>, persist = true): VoiceSettings {
  const current = persist ? getVoiceSettings() : defaultVoiceSettings();
  const next: VoiceSettings = {
    enabled: input.enabled !== undefined ? input.enabled === true : current.enabled,
    language: typeof input.language === "string" ? input.language.trim().slice(0, 32) || "auto" : current.language,
    voiceId: typeof input.voiceId === "string" ? input.voiceId.trim().slice(0, 80) || "sophenic-native" : current.voiceId,
    serviceUrl: typeof input.serviceUrl === "string" ? input.serviceUrl.trim().slice(0, 500) : current.serviceUrl,
    speed: Math.max(0.68, Math.min(1.35, Number(input.speed ?? current.speed))),
    expressiveness: Math.max(0, Math.min(1, Number(input.expressiveness ?? current.expressiveness))),
    volume: Math.max(0, Math.min(1, Number(input.volume ?? current.volume))),
    naturalConversation: input.naturalConversation !== undefined ? input.naturalConversation === true : current.naturalConversation,
    silencePrompts: input.silencePrompts !== undefined ? input.silencePrompts === true : current.silencePrompts,
    inputSensitivity: Math.max(0, Math.min(1, Number(input.inputSensitivity ?? current.inputSensitivity)))
  };
  if (persist) writeJson("voice-settings.json", next);
  return next;
}

