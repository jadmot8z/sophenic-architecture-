"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MarkdownMathRenderer } from "@/components/MarkdownMathRenderer";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Bell,
  Bot,
  Check,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Code2,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  Github,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Paperclip,
  FileText,
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MonitorCog,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Plug,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Triangle,
  UserRound,
  WandSparkles,
  Palette,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { routeAction } from "@/actions/router";
import { runtimeModelIdentity } from "@/actions/runtime-model-identity";
import { ThinkingPanel, type ThinkingStepKind, type ThinkingTrace } from "@/components/agent/thinking-panel";
import { HistoryCenter, LibraryCenter, PlannerCenter, PluginCenter, SettingsCenter } from "@/components/agent/workspace-pages";
import { listCodeHandoffs } from "@/design/web-design/code-handoff";
import type { CodeDesignHandoff } from "@/design/web-design/types";
import { DesignWorkspace } from "@/components/design/design-workspace";
import { VoiceMode, type VoiceModeHandle } from "@voice/voice_ui/voice-mode";
import { SpeechSegmenter } from "@voice/text_to_speech/sentence-segmenter";
import type { VoiceSettings, VoiceTranscript } from "@voice/types";

type EngineConfig = {
  installed: boolean;
  provider: string;
  model: string;
  openRouterKeyConfigured: boolean;
  aiProviderCount: number;
  configuredProviders: string[];
  personalization: string;
  preferredLanguage?: "fr" | "en" | "es" | "de" | "it" | "pt";
  version?: string;
};

type ImageItem = { url: string; sourceUrl: string; title: string };
type LocationItem = { latitude: number; longitude: number; accuracy?: number; label?: string };
type PlaceItem = { name: string; address: string; latitude: number; longitude: number; category?: string; type?: string; website?: string; phone?: string; openingHours?: string; sourceUrl: string; mapsUrl?: string; directionsUrl?: string };
type QuestionData = {
  index: number;
  total: number;
  question: string;
  options: string[];
  allowOther: boolean;
  requestId?: string;
  kind?: "normal" | "hermes" | "image-style" | "image-format";
};
type ModelFallbackNotice = { fromProvider: string; fromModel: string; toProvider: string; toModel: string; reason?: string };
type ModelRun = { provider: string; model: string; requestedProvider?: string; requestedModel?: string; fallback?: ModelFallbackNotice; agents?: Array<{ role: string; provider: string; model: string }> };
type UserAttachment = { id: string; name: string; mime: string; size: number; dataUrl: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; error?: boolean; images?: ImageItem[]; location?: LocationItem; places?: PlaceItem[]; question?: QuestionData; run?: ModelRun; thinking?: ThinkingTrace; attachments?: UserAttachment[] };
type StoredConversationRecord = { id: string; title: string; mode: "chat" | "code" | "image"; createdAt: string; updatedAt: string; messages: ChatMessage[]; workspace?: string };

function normalizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const role = row.role === "user" || row.role === "assistant" ? row.role : null;
    if (!role) return [];
    const content = typeof row.content === "string" ? row.content : valueText(row.content);
    const id = typeof row.id === "string" && row.id.trim() ? row.id : `recovered-${Date.now()}-${index}`;
    return [{ ...row, id, role, content } as ChatMessage];
  });
}
const TEXT_ATTACHMENT_MIME = /^(text\/|application\/json|application\/xml|application\/javascript|application\/typescript|application\/x-yaml)/i;
const TEXT_ATTACHMENT_EXTENSION = /\.(txt|md|markdown|json|csv|tsv|ya?ml|toml|ini|cfg|conf|env|log|html?|css|scss|jsx?|tsx?|py|java|kt|go|rs|c|h|cpp|hpp|cs|php|rb|swift|sql|sh|ps1|bat|lua|vue|svelte|dart)$/i;
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 6;

function attachmentIsImage(attachment: UserAttachment): boolean { return attachment.mime.startsWith("image/"); }
function attachmentIsTextual(attachment: UserAttachment): boolean {
  return TEXT_ATTACHMENT_MIME.test(attachment.mime) || (!attachment.mime && TEXT_ATTACHMENT_EXTENSION.test(attachment.name)) || (attachment.mime === "application/octet-stream" && TEXT_ATTACHMENT_EXTENSION.test(attachment.name));
}
function decodeAttachmentText(attachment: UserAttachment, cap = 12_000): string {
  try {
    const base64 = attachment.dataUrl.includes(",") ? attachment.dataUrl.slice(attachment.dataUrl.indexOf(",") + 1) : "";
    const decoded = base64 ? decodeURIComponent(escape(atob(base64))) : "";
    return decoded.length > cap ? `${decoded.slice(0, cap)}\n… [contenu tronqué : ${decoded.length.toLocaleString("fr-FR")} caractères au total]` : decoded;
  } catch { return "[contenu binaire non lisible]"; }
}
/** Bloc de contexte texte injecté dans les moteurs qui ne voient pas les images (Code, génération d'image). */
function buildAttachmentContext(attachments: UserAttachment[]): string {
  if (!attachments.length) return "";
  const lines = attachments.map((attachment) => {
    if (attachmentIsTextual(attachment)) return `— ${attachment.name} (${attachment.mime || "texte"}, ${(attachment.size / 1024).toFixed(1)} Ko) :\n${decodeAttachmentText(attachment)}`;
    const kind = attachmentIsImage(attachment) ? "image" : "document";
    return `— ${attachment.name} (${kind} ${attachment.mime || "inconnu"}, ${(attachment.size / 1024).toFixed(1)} Ko) : pièce jointe ${kind} non lisible dans ce moteur, demande à l'utilisateur de passer par le mode Chat pour l'analyse visuelle si nécessaire.`;
  });
  return `\n\nPIÈCES JOINTES PAR L'UTILISATEUR (${attachments.length}) :\n${lines.join("\n\n")}`;
}

type PlannerNotice = { id: string; title: string; ok: boolean; message: string; detail?: string; completedAt: string };

type IntegrationPermission = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "capability" | "skill" | "plugin";
  enabled: boolean;
  connected?: boolean;
  requiresSetup?: boolean;
  source?: string;
  toolset?: string;
  scopes?: string[];
};
type UsageState = { contextUsed?: number; contextMax?: number; totalTokens?: number; costUsd?: number };
type BootState = "checking" | "key" | "ready" | "error";
type AppMode = "chat" | "code" | "image" | "design" | "plugins" | "history" | "library" | "planner" | "settings";
type DeveloperConnectionState = { provider: "github" | "vercel"; connected: boolean; username?: string; name?: string; accountId?: string; scopes: string[]; connectedAt?: string; expiresAt?: string; credentialType?: "oauth" | "personal_access_token" };
type DeveloperConnectionConfiguration = { github: { configured: boolean; mode: "device"; authorizationUrl: string; tokenPortalUrl: string }; vercel: { configured: boolean; mode: "token"; authorizationUrl: string; dashboardUrl: string } };
type ProviderId = "sophenic" | "ollama" | "xai" | "groq" | "zai" | "gemini" | "cloudflare" | "siliconflow" | "openrouter" | "mistral" | "sambanova" | "cerebras" | "cohere" | "huggingface" | "aimlapi" | "nvidia" | "scaleway" | "alibaba";
type AgentProviderId = Exclude<ProviderId, "sophenic">;
type EffortMode = "quick" | "auto" | "deep";
type IntentDecision = { intent: "chat" | "code" | "agent_pc" | "research" | "project"; label: string; requiresHermes: boolean; purpose: "assistant" | "code" | "pc"; confidence: number; reason: string };
type DashboardEvent = { id: string; label: string; detail?: string; status: "pending" | "running" | "done" | "paused" | "error"; at: number; kind?: "plan" | "file" | "terminal" | "test" | "preview" | "pc" | "other" };
type ApprovalRequest = { requestId: string; title: string; detail: string };
type CredentialRequest = { requestId: string; kind: "sudo" | "secret"; title: string; detail: string };
type PendingImage = { originalPrompt: string; style?: string };
type CodeWorkspaceKind = "managed" | "external-project" | "external-file";
type CodeWorkspaceInfo = { workspace: string; kind: CodeWorkspaceKind; targetFile?: string; projectId?: string; createdAt?: string; stateDir: string };
type CodeCheckpoint = { workspace: string; originalPrompt: string; planSteps: string[]; activeStep?: number; activeProvider: string; activeModel: string; savedAt: number; reason?: string; workspaceKind?: CodeWorkspaceKind; targetFile?: string; progressDigest?: string };
type CodeEngineProbeUI = { id: "claude-code" | "codex"; name: string; installed: boolean; authenticated: boolean; functional: boolean; version?: string; authLabel?: string; checkedAt: number; error?: string };
type CodeEnginesUI = { claudeCode: CodeEngineProbeUI; codex: CodeEngineProbeUI; checkedAt: number };

const BEST_FREE_GLOBAL = "openrouter/free";
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function cleanThinkingDetail(value?: string): string | undefined {
  const compact = value?.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 180) : undefined;
}

function createThinkingTrace(label: string, detail?: string, kind: ThinkingStepKind = "status"): ThinkingTrace {
  const now = Date.now();
  return {
    active: true,
    startedAt: now,
    steps: [{ id: uid(), label, detail: cleanThinkingDetail(detail), kind, at: now }]
  };
}

function appendThinkingStep(trace: ThinkingTrace | undefined, label: string, detail?: string, kind: ThinkingStepKind = "status"): ThinkingTrace {
  const now = Date.now();
  const safeDetail = cleanThinkingDetail(detail);
  const base = trace || { active: true, startedAt: now, steps: [] };
  const previous = base.steps[base.steps.length - 1];
  if (previous?.label === label && previous?.detail === safeDetail) return { ...base, active: true, finishedAt: undefined };
  return {
    ...base,
    active: true,
    finishedAt: undefined,
    steps: [...base.steps, { id: uid(), label, detail: safeDetail, kind, at: now }].slice(-18)
  };
}

function finishThinkingTrace(trace: ThinkingTrace | undefined, label?: string, detail?: string, kind: ThinkingStepKind = "status"): ThinkingTrace | undefined {
  if (!trace) return undefined;
  const next = label ? appendThinkingStep(trace, label, detail, kind) : trace;
  return { ...next, active: false, finishedAt: Date.now() };
}

function compactModel(model: string): string {
  const clean = model.trim();
  if (!clean) return "OpenRouter";
  const parts = clean.split("/");
  return parts[parts.length - 1] || clean;
}

function humanError(error: unknown): string {
  let raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Une erreur est survenue.";
  raw = raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error|TypeError|DOMException):\s*/i, "").replace(/^(?:Error|TypeError|DOMException):\s*/i, "");
  return raw.replace(/gateway/gi, "service local");
}

function providerLabel(provider: string): string {
  const clean = provider.toLowerCase();
  if (clean === "sophenic") return "Sophenic";
  if (clean === "sophenic-tools") return "Sophenic Web";
  if (clean === "ollama") return "Ollama";
  if (clean === "openrouter") return "OpenRouter";
  const labels: Record<string, string> = { xai: "xAI / Grok", groq: "Groq", zai: "Z.AI", gemini: "Gemini", cloudflare: "Cloudflare", siliconflow: "SiliconFlow", mistral: "Mistral", sambanova: "SambaNova", cerebras: "Cerebras", cohere: "Cohere", huggingface: "Hugging Face", aimlapi: "AIMLAPI", nvidia: "NVIDIA NIM", scaleway: "Scaleway", alibaba: "Alibaba Qwen" };
  return labels[clean] || provider || "Inconnu";
}

function responseLanguageInstruction(language?: string): string {
  const labels: Record<string, string> = { fr: "français", en: "anglais", es: "espagnol", de: "allemand", it: "italien", pt: "portugais" };
  const label = language ? labels[language] : "";
  if (label) return `LANGUE OBLIGATOIRE : réponds en ${label}. Même si un outil, une API, Chrome, Windows ou Hermes renvoie un message en anglais, traduis-le et continue en ${label}.`;
  return "LANGUE OBLIGATOIRE : réponds dans la langue du dernier message utilisateur et conserve la langue déjà établie pour les messages courts ou ambigus.";
}

function isModelAvailabilityFailure(value: unknown): boolean {
  const message = humanError(value).toLowerCase();
  return /quota|rate.?limit|429|402|insufficient|credit|invalid api key|incorrect api key|unauthorized|authentication|401|403|user not found|model listing|model.*(?:unavailable|not found|indisponible|introuvable)|provider.*(?:unavailable|error)|timeout|timed out|network|fetch failed|connection|déconnecté|deconnecte|service ia local|délai dépassé|delai depasse|503|502|504|sans renvoyer de réponse visible/.test(message);
}

function isTruncationFailure(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value || "");
  return /response (?:remained )?truncated|truncated after .*continuation|continuation attempts|output length limit|finish_reason.?[:=].?length|consomm[eé].*limite.*sortie/i.test(message);
}

function isHermesProgressStall(value: unknown): boolean {
  const message = humanError(value);
  return /SOPHENIC_CODE_STALLED|aucune progression réelle|Délai dépassé pour la commande IA:\s*prompt\.submit/i.test(message);
}

function hermesProviderFailureText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 1400) return "";
  return /^(?:http\s*)?(?:401|402|403|429|5\d\d)\b|\buser not found\b|\binvalid api key\b|\bincorrect api key\b|\bunauthorized\b|\bmodel .* not found\b|\brate.?limit\b|\bquota exceeded\b/i.test(text) ? text : "";
}

function isHermesIdentityFailure(value: unknown): boolean {
  const text = humanError(value);
  return /\b(?:http\s*)?401\s*:\s*user not found\b|\buser not found\b|\bhermes[^\n]{0,100}(?:session|user|auth)[^\n]{0,100}(?:invalid|expired|unauthor)/i.test(text);
}

function isBareHermesUserNotFound(value: unknown): boolean {
  const text = humanError(value).trim();
  return /^(?:http\s*)?401\s*:\s*user not found\.?$/i.test(text) || /^user not found\.?$/i.test(text);
}

function identityFailureBelongsToActiveProvider(value: unknown, provider: string): boolean {
  const text = humanError(value).toLowerCase();
  const cleanProvider = provider.trim().toLowerCase();
  if (/invalid api key|incorrect api key|api key.*(?:rejected|invalid)|authentication failed|unauthorized/.test(text)) return true;
  if (isBareHermesUserNotFound(value)) return cleanProvider === "openrouter";
  if (cleanProvider === "openrouter" && /user not found|\b401\b/.test(text)) return true;
  const aliases: Record<string, string[]> = {
    groq: ["groq"], mistral: ["mistral", "codestral"], gemini: ["gemini", "google"], zai: ["z.ai", "zai", "glm"],
    cloudflare: ["cloudflare"], cerebras: ["cerebras"], cohere: ["cohere"], nvidia: ["nvidia", "nim"],
    scaleway: ["scaleway"], alibaba: ["alibaba", "qwen"], xai: ["xai", "x.ai", "grok"], siliconflow: ["siliconflow"],
    sambanova: ["sambanova"], huggingface: ["hugging face", "huggingface"], aimlapi: ["aimlapi"], openrouter: ["openrouter"]
  };
  return (aliases[cleanProvider] || [cleanProvider]).some((alias) => alias && text.includes(alias));
}

function friendlyHermesAction(method: string, params: Record<string, unknown>): DashboardEvent | null {
  const rawName = String(params.tool_name || params.tool || params.name || method).toLowerCase();
  const detail = String(params.command || params.path || params.file || params.message || params.description || "").slice(0, 420);
  const combined = `${rawName} ${detail}`.toLowerCase();
  const status: DashboardEvent["status"] = /error|failed/.test(method) ? "error" : /complete|done|finish|result/.test(method) ? "done" : "running";
  if (/npm\s+(?:i|install)|pnpm\s+(?:i|install)|yarn\s+add|pip\s+install|poetry\s+add/.test(combined)) return { id: uid(), label: "⚙️ Installation des dépendances", detail, status, at: Date.now(), kind: "terminal" };
  if (/npm\s+(?:run\s+)?(?:test|build|lint)|pnpm\s+(?:test|build|lint)|pytest|vitest|jest|tsc|flutter\s+test|cargo\s+test/.test(combined)) return { id: uid(), label: "🧪 Test / validation", detail, status, at: Date.now(), kind: "test" };
  if (/write|edit|patch|create.*file|file.*create|filesystem|mkdir|rename|copy|move/.test(combined)) return { id: uid(), label: "✏️ Fichiers", detail: detail || "Modification du projet", status, at: Date.now(), kind: "file" };
  if (/terminal|shell|powershell|cmd|bash|command|exec/.test(combined)) return { id: uid(), label: "⚙️ Terminal", detail, status, at: Date.now(), kind: "terminal" };
  if (/browser|chrome|edge|firefox|computer[_ -]?use|mouse|keyboard|click|screen/.test(combined)) return { id: uid(), label: "🖥️ Action sur l’ordinateur", detail: detail || "Interaction avec l’interface", status, at: Date.now(), kind: "pc" };
  if (/tool|action/.test(method)) return { id: uid(), label: "⚙️ Action Hermes", detail: detail || rawName.replace(/[._-]+/g, " "), status, at: Date.now(), kind: "other" };
  return null;
}

function extractPreviewUrl(messages: ChatMessage[]): string {
  const text = messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n");
  const match = text.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/[^\s)\]}>]*)?/i);
  return match?.[0] || "";
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function imageGenerationRequest(prompt: string): boolean {
  const p = normalize(prompt);
  if (localBuildAction(prompt)) return false;
  const create = /\b(cree|creer|genere|generer|dessine|dessiner|fabrique|produis|produire|imagine)\b/.test(p);
  const visual = /\b(image|photo|illustration|affiche|logo|portrait|dessin|rendu|3d|anime|cinematique|photorealiste|realiste|paysage|scene|ferrari|voiture|supercar|animal|personnage)\b/.test(p);
  return create && visual;
}

function normalizeMathMarkdown(content: string): string {
  let value = content.replace(/\\\[([\s\S]*?)\\\]/g, (_m, body) => `\n$$${String(body).trim()}$$\n`);
  value = value.replace(/(^|\n)\s*\[\s*([^\]\n]*(?:\\frac|\\sqrt|\\boxed|\\begin|\\sum|\\int|\\pi|\\mathbb|\\text|=|\^)[^\]\n]*)\s*\]\s*(?=\n|$)/g, (_m, before, body) => `${before}\n$$${String(body).trim()}$$\n`);
  value = value.replace(/\\\(([^\n]*?)\\\)/g, (_m, body) => `$${String(body).trim()}$`);
  return value;
}

function scoreByPatterns(item: { id: string; name: string }, patterns: Array<[RegExp, number]>): number {
  const text = `${item.id} ${item.name}`.toLowerCase();
  return patterns.reduce((score, [pattern, value]) => Math.max(score, pattern.test(text) ? value : 0), 0);
}

function parseMachineQuestion(content: string): { content: string; question?: QuestionData } {
  const pattern = /\s*<sophenic-question>([\s\S]*?)<\/sophenic-question>\s*$/i;
  const match = pattern.exec(content);
  if (!match) return { content: content.trim() };
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>;
    const options = Array.isArray(raw.options) ? raw.options.map(String).filter(Boolean).slice(0, 8) : [];
    const question = typeof raw.question === "string" ? raw.question.trim() : "";
    if (!question || !options.length) return { content: content.replace(pattern, "").trim() };
    return {
      content: content.replace(pattern, "").trim(),
      question: {
        index: Math.max(1, Number(raw.index) || 1),
        total: Math.max(1, Number(raw.total) || 1),
        question,
        options,
        allowOther: raw.allowOther !== false,
        kind: "normal"
      }
    };
  } catch {
    return { content: content.replace(pattern, "").trim() };
  }
}

function extractCodeBlocks(messages: ChatMessage[]): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const regex = /```([\w.+-]*)\s*\n([\s\S]*?)```/g;
  for (const message of messages.filter((entry) => entry.role === "assistant")) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(message.content))) blocks.push({ language: match[1] || "text", code: match[2].trimEnd() });
  }
  return blocks;
}

function valueText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  for (const key of ["text", "content", "message", "delta", "output", "answer"]) {
    const candidate = row[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = valueText(candidate);
      if (nested) return nested;
    }
  }
  return "";
}

function latestAssistantFromHistory(value: unknown): string {
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { for (const entry of node) visit(entry); return; }
    if (!node || typeof node !== "object") return;
    const row = node as Record<string, unknown>;
    const role = typeof row.role === "string" ? row.role.toLowerCase() : "";
    if (role === "assistant") {
      const text = valueText(row);
      if (text.trim()) found.push(text.trim());
    }
    for (const child of Object.values(row)) if (child && typeof child === "object") visit(child);
  };
  visit(value);
  return found[found.length - 1] || "";
}

function isIdleStatus(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  for (const key of ["status", "state", "phase"]) {
    const state = typeof row[key] === "string" ? String(row[key]).toLowerCase() : "";
    if (/waiting_for_input|approval|clarif|sudo|secret/.test(state)) return false;
    if (/idle|ready|complete|completed|done/.test(state)) return true;
    if (/running|thinking|working|busy|streaming|tool/.test(state)) return false;
  }
  if (typeof row.running === "boolean") return !row.running;
  return false;
}

function failedStatusMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  for (const key of ["status", "state", "phase"]) {
    const raw = typeof row[key] === "string" ? String(row[key]) : "";
    if (/failed|error|cancelled|canceled|interrupted/i.test(raw)) {
      const detail = valueText(value).trim();
      return detail || `Hermes a terminé avec l’état « ${raw} ».`;
    }
  }
  return "";
}

function localBuildAction(prompt: string): boolean {
  const p = normalize(prompt);
  const ideation = /\b(idee(?:s)?|idee generale|concept|brainstorm|imagine|invente|conception|reflexion|pistes?|suggestions?|pourrais je creer|quel(?:le)? (?:site|application|app|saas|projet))\b/.test(p);
  const metaPrompt = /\b(?:donne(?:r)?|ecris|redige|cree|genere|fais)\s+(?:moi\s+)?(?:un|le|ce)\s+prompt\b|\bprompt\s+(?:pour|a donner a|que je donnerai a)\b/.test(p);
  const discussion = /\b(?:explique|analyse|review|avis|conseil|comment fonctionne|quelle architecture|quel framework|difference entre|compare)\b[\s\S]{0,100}\b(?:code|script|typescript|javascript|python|react|next|electron|api|projet|application|site)\b/.test(p);
  const action = /\b(cree|creer|fais|fait|fabrique|construis|construire|code|ecris|modifie|corrige|repare|debug|teste|test|installe|configure|compile|build|lance|demarre|execute|genere|ajoute|implemente)\b/.test(p);
  const target = /\b(site web|site|application|app|projet|code|script|page html|react|next(?:js)?|vite|serveur|localhost|api|backend|frontend|npm|python|node|fichier|dossier|workspace|app\.tsx)\b/.test(p);
  return action && target && !ideation && !metaPrompt && !discussion;
}

function codeNeedsExistingFile(prompt: string): boolean {
  const p = normalize(prompt);
  const change = /\b(corrige|corriger|modifie|modifier|repare|reparer|debug|debogue|ameliore|ameliorer|refactor|analyse|ouvre|lis|edite|editer)\b/.test(p);
  const file = /\b(ce|cet|mon|le|un)\s+fichier\b|\bfichier\s+(?:existant|joint|local|sur mon pc|sur mon ordinateur)\b/.test(p);
  return change && file && !/\b(cree|creer|nouveau|nouvelle)\s+(?:un\s+)?fichier\b/.test(p);
}

function codeNeedsExistingProject(prompt: string): boolean {
  const p = normalize(prompt);
  const change = /\b(corrige|corriger|modifie|modifier|repare|reparer|debug|debogue|ameliore|ameliorer|refactor|continue|reprends|reprend|analyse|ouvre|travaille sur)\b/.test(p);
  const project = /\b(ce|cet|mon|le)\s+(?:projet|dossier|repo|repository|depot|application|site)\b/.test(p) || /\bprojet\s+existant\b/.test(p);
  return change && project && !/\b(cree|creer|nouveau|nouvelle|construis|construire)\b/.test(p);
}

function codeResearchLikelyUseful(prompt: string): boolean {
  const p = normalize(prompt);
  return /\b(actuel|actuelle|latest|recent|recente|documentation|docs|api|sdk|librairie|library|package|npm|pypi|github|depot|repo|exemple|integration|oauth|version|compatibilite|windows|electron|next|react|python|rust|tauri|flutter)\b/.test(p);
}

function pcAction(prompt: string): boolean {
  const p = normalize(prompt.trim());
  return /^(?:(?:est ce que )?(?:tu peux|vous pouvez|peux tu|pourrais tu)\s+)?(?:ouvre|ouvrir|lance|lancer|demarre|demarrer|ferme|fermer|quitte|quitter)\b/.test(p)
    || /\b(clique|double clique|appuie|tape dans|fais defiler|scroll|glisse|drag|depose|capture d ecran|screenshot|sur mon pc|sur mon ordinateur|sur windows|bureau windows|fenetre active|dans whatsapp|dans chrome|dans edge|dans firefox|dans discord|dans spotify)\b/.test(p);
}

function hermesToolAction(prompt: string): boolean {
  const p = normalize(prompt);
  const action = /\b(utilise|avec|execute|lance|demarre|arrete|ouvre|ferme|cree|ajoute|supprime|efface|deplace|renomme|copie|colle|telecharge|installe|desinstalle|configure|cherche|trouve|navigue|remplis|envoie|programme|planifie|sauvegarde|importe|exporte|connecte|synchronise|analyse|lis|ecris|modifie)\b/.test(p);
  const toolTarget = /\b(hermes|outil|tools?|skill|plugin|mcp|terminal|powershell|cmd|shell|fichier|dossier|repertoire|processus|service|navigateur|browser|chrome|edge|firefox|url|telechargement|presse papier|clipboard|home assistant|domotique|cron|tache planifiee|spotify|discord|whatsapp|application|logiciel|programme local)\b/.test(p);
  return action && toolTarget;
}

function googleAction(prompt: string): boolean {
  const p = normalize(prompt);
  const service = /\b(agenda|calendar|google drive|drive|google docs|docs|google sheets|sheets|contacts?)\b/.test(p);
  const action = /\b(envoie|envois|envoyer|envoi|ecris|cree|ajoute|supprime|deplace|repond|reponds|cherche|trouve|planifie|programme|modifie|lis|ouvre|brouillon)\b/.test(p);
  return service && action;
}

function shopifyStoreCreationAction(prompt: string): boolean {
  const p = normalize(prompt);
  const service = /\bshopify\b/.test(p);
  const store = /\b(boutique|store|magasin|e commerce|ecommerce)\b/.test(p);
  const action = /\b(cree|creer|fais|faire|construis|construire|ouvre|ouvrir|demarre|demarrer|lance|lancer)\b/.test(p);
  return service && store && action;
}

function recentActionContinuation(messages: ChatMessage[], kind: "google" | "shopify"): boolean {
  const recent = messages.slice(-10);
  let anchor = -1;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (message.role !== "user") continue;
    const matches = kind === "google" ? googleAction(message.content) : shopifyStoreCreationAction(message.content);
    if (matches) { anchor = index; break; }
  }
  if (anchor < 0) return false;
  const tail = recent.slice(anchor + 1);
  if (tail.filter((message) => message.role === "user").length > 4) return false;
  const lastAssistant = [...tail].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant) return false;
  const p = normalize(lastAssistant.content);
  const completed = kind === "google"
    ? /\b(email|mail|courriel|message)\b[\s\S]{0,50}\b(envoye|envoyee|brouillon cree|termine|reussi)\b/.test(p)
    : /\b(shopify|boutique|store)\b[\s\S]{0,70}\b(creee|cree avec succes|terminee|termine|reussi)\b/.test(p);
  if (completed && !/\b(erreur|echec|manque|requis|besoin|precise|indique)\b/.test(p)) return false;
  const clarification = /[?？]/.test(lastAssistant.content) || /\b(precise|preciser|indique|indiquer|fournis|fournir|quel|quelle|quels|quelles|manque|requis|besoin|connecte|connecter|connexion|confirme|confirmation|captcha|2fa|dis moi)\b/.test(p);
  const serviceContext = kind === "google"
    ? /\b(gmail|email|mail|courriel|objet|sujet|corps|destinataire|adresse)\b/.test(p)
    : /\b(shopify|boutique|store|nom|pays|region|plan|compte|connexion|captcha|2fa)\b/.test(p);
  return clarification && serviceContext;
}

function wantsCurrentLocation(prompt: string): boolean {
  const p = normalize(prompt);
  return /\b(ou suis je|où suis je|ma localisation|ma position|localise moi|localiser ma position|coordonnees actuelles|coordonnées actuelles)\b/.test(p);
}

function placeSearchQuery(prompt: string): string {
  const raw = prompt.trim();
  const p = normalize(raw);
  if (wantsCurrentLocation(raw)) return "";
  const explicit = /\b(?:ou|où)\s+(?:est|sont|se|ce)\s*(?:trouve(?:nt)?)?|\b(?:adresse|localisation)(?:\s+(?:de|du|des|d['’]))?|\b(?:localise|localiser|itineraire|itinéraire|pres de moi|près de moi)\b/.test(p);
  const localCategory = /\b(magasin|boutique|restaurant|hotel|hôtel|bar|cafe|café|coiffeur|beaute|beauté|gamer|gaming|pharmacie|supermarche|supermarché|cinema|cinéma|garage|banque|parfumerie|fast food|centre commercial|mall)\b/.test(p);
  const namedPlace = /\b(burger king|mcdonalds?|kfc|starbucks|sephora|micromania|ldlc|boulanger|fnac|ikea|carrefour|decathlon|zara|h&m)\b/.test(p);
  const cityLike = /\b(?:a|à|sur|dans|vers|pres de|près de)\s+[a-z][a-z' -]{2,50}$/i.test(p)
    || /\b(paris|grenoble|lyon|marseille|lille|bordeaux|toulouse|nice|nantes|strasbourg|rennes|montpellier|marrakech|marrakesh|casablanca|rabat|agadir|dubai|dubaï|londres|london|bruxelles|geneve|genève|lausanne)\b/.test(p)
    || (namedPlace && p.split(/\s+/).length >= 3);
  if (!explicit && !((localCategory || namedPlace) && cityLike)) return "";
  return raw
    .replace(/^(?:salut|bonjour|bonsoir|hello|hey|coucou)\b[\s,;:!-]*/i, "")
    .replace(/^(?:donne(?:[- ]?moi)?\s+)?(?:alors\s+)?(?:la\s+)?(?:localisation|adresse)(?:\s+(?:de|du|des|d['’]))?\s+/i, "")
    .replace(/\b(?:peux[- ]?tu\s+)?(?:me\s+)?(?:dire\s+)?(?:ou|où)\s+(?:est|sont|se|ce)\s*(?:trouve(?:nt)?)?\b/ig, "")
    .replace(/[?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim() || raw;
}

function explicitReferenceImageRequest(prompt: string): boolean {
  const p = normalize(prompt);
  return /\b(?:montre|affiche|cherche|trouve|donne)(?: moi)?\b[\s\S]{0,45}\b(?:photo|photos|image|images)\b/.test(p)
    || /^(?:photo|photos|image|images)\s+(?:de|du|des|d )\b/.test(p);
}

function visualContextQuery(prompt: string): string {
  const raw = prompt.trim();
  const p = normalize(raw);
  if (raw.length > 220 || localBuildAction(raw) || pcAction(raw)) return "";
  if (explicitReferenceImageRequest(raw)) {
    return raw
      .replace(/^(?:salut|bonjour|bonsoir|hello|hey|coucou)\b[\s,;:!-]*/i, "")
      .replace(/^(?:montre|affiche|cherche|trouve|donne)(?:[- ]?moi)?\s+(?:des?|quelques?)\s+(?:photos?|images?|illustrations?)\s+(?:de|du|des|d['’])\s*/i, "")
      .replace(/[?!]+$/g, "")
      .trim() || raw;
  }
  const asksEntity = /^(?:c(?:'|’)est quoi|c est quoi|qui est|qu est ce que|qu'est-ce que|parle moi de|explique moi)\b/.test(p);
  const visualSubject = /\b(marque|restaurant|entreprise|ville|pays|monument|voiture|animal|personnage|produit|burger king|mcdonald|ferrari|tokyo|paris|burj khalifa)\b/.test(p);
  return asksEntity || visualSubject ? raw.replace(/^(?:c(?:'|’)est quoi|c est quoi|qui est|qu est ce que|qu'est-ce que|parle moi de|explique moi)\s*/i, "").trim() || raw : "";
}

function currentBrowserLocation(): Promise<LocationItem> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n’est pas disponible dans cette session Windows."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
        label: "Position Windows"
      }),
      (error) => reject(new Error(error.message || "Windows n’a pas fourni la localisation.")),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 }
    );
  });
}

function titleForMode(mode: AppMode): string {
  if (mode === "code") return "Sophenic Code";
  if (mode === "image") return "Sophenic Image";
  if (mode === "design") return "Sophenic Design";
  if (mode === "plugins") return "Plugins";
  if (mode === "history") return "Historique";
  if (mode === "library") return "Bibliothèque";
  if (mode === "planner") return "Planification";
  if (mode === "settings") return "Paramètres";
  return "Sophenic";
}

function ContextUsage({ usage }: { usage: UsageState }) {
  const used = usage.contextUsed;
  const max = usage.contextMax;
  const percent = used !== undefined && max && max > 0 ? Math.min(100, Math.max(0, Math.round((used / max) * 100))) : undefined;
  return <div className="hidden items-center gap-2 rounded-full border border-amber-900/10 bg-amber-50/70 px-3 py-1.5 text-[11px] text-[#725a38] sm:flex dark:border-amber-200/10 dark:bg-amber-100/[0.06] dark:text-amber-200/70">
    <span>Contexte</span>
    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#e8dcc6] dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#c69a52] to-[#8f6b39] transition-all" style={{ width: `${percent ?? 0}%` }} /></div>
    <span className="w-8 text-right tabular-nums">{percent === undefined ? "—%" : `${percent}%`}</span>
  </div>;
}

function SafeImage({ item, index }: { item: ImageItem; index: number }) {
  const [broken, setBroken] = useState(false);
  const generated = item.url.startsWith("data:image/") || item.url.startsWith("blob:");
  const extension = item.url.startsWith("data:image/jpeg") ? "jpg" : item.url.startsWith("data:image/webp") ? "webp" : "png";
  return <div className="group/image relative h-56 min-w-[72%] snap-center overflow-hidden rounded-2xl border border-[#d7c29e]/60 bg-[#f8efdf] shadow-sm dark:border-white/10 dark:bg-[#2a2520] sm:min-w-[48%]">
    {broken ? <div className="grid h-full place-items-center p-6 text-center text-xs text-zinc-400"><div><ImageIcon className="mx-auto mb-2 size-6" />Image indisponible</div></div> : <>
      <a href={item.url} target="_blank" rel="noreferrer" title={item.title} className="block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.title || `Illustration ${index + 1}`} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
      </a>
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition group-hover/image:opacity-100">
        <a href={item.url} download={generated ? `sophenic-image-${index + 1}.${extension}` : undefined} target={generated ? undefined : "_blank"} rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-black/70 text-white shadow" title={generated ? "Télécharger l’image" : "Ouvrir l’image"}><Download className="size-4" /></a>
        {item.sourceUrl && item.sourceUrl !== item.url && !generated && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-black/70 text-white shadow" title="Voir la source"><ExternalLink className="size-4" /></a>}
      </div>
    </>}
  </div>;
}

function ImageCarousel({ items }: { items: ImageItem[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  if (!items.length) return null;
  const move = (direction: number) => scroller.current?.scrollBy({ left: direction * Math.max(280, scroller.current.clientWidth * .78), behavior: "smooth" });
  return <div className="group/carousel relative my-4">
    <div ref={scroller} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.slice(0, 5).map((item, index) => <SafeImage key={`${item.url.slice(0, 60)}-${index}`} item={item} index={index} />)}
    </div>
    {items.length > 1 && <>
      <button type="button" onClick={() => move(-1)} className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white/90 text-zinc-700 opacity-0 shadow-md transition group-hover/carousel:opacity-100 dark:border-white/10 dark:bg-[#28231f]/90 dark:text-zinc-200"><ArrowLeft className="size-4" /></button>
      <button type="button" onClick={() => move(1)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white/90 text-zinc-700 opacity-0 shadow-md transition group-hover/carousel:opacity-100 dark:border-white/10 dark:bg-[#28231f]/90 dark:text-zinc-200"><ArrowRight className="size-4" /></button>
    </>}
    {items.some((item) => item.sourceUrl.includes("wikimedia.org")) && <div className="mt-1.5 text-[10px] text-zinc-400">Images de référence : Wikimedia Commons</div>}
  </div>;
}

function PlaceResults({ items, images }: { items: PlaceItem[]; images: ImageItem[] }) {
  if (!items.length) return null;
  const featured = items[0];
  const mapsUrl = featured.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${featured.name} ${featured.address}`)}`;
  const directionsUrl = featured.directionsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${featured.latitude},${featured.longitude}`)}`;
  const mapDelta = 0.006;
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${featured.longitude - mapDelta},${featured.latitude - mapDelta},${featured.longitude + mapDelta},${featured.latitude + mapDelta}`)}&layer=mapnik&marker=${encodeURIComponent(`${featured.latitude},${featured.longitude}`)}`;
  return <div className="my-4 space-y-2">
    <div className="overflow-hidden rounded-3xl border border-[#d8c29b] bg-[#fffaf0] shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      {images.length ? <div className="flex h-44 gap-1 overflow-x-auto bg-[#eee3d1] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-white/[0.04]">{images.slice(0, 4).map((image, index) => <a key={`${image.url}-${index}`} href={image.sourceUrl || image.url} target="_blank" rel="noreferrer" className="min-w-[70%] flex-1 overflow-hidden rounded-2xl sm:min-w-[46%] xl:min-w-[72%]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={`${featured.name} — photo ${index + 1}`} className="h-full w-full object-cover" /></a>)}</div> : <div className="grid h-28 place-items-center bg-gradient-to-br from-[#f1e1c5] to-[#e7cfaa] text-[#795827] dark:from-white/[0.07] dark:to-white/[0.02]"><MapPin className="size-8" /></div>}
      <iframe title={`Carte — ${featured.name}`} src={mapEmbedUrl} loading="lazy" className="h-40 w-full border-0 bg-[#eee3d1]" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="text-lg font-semibold leading-6">{featured.name}</div><div className="mt-1 text-sm text-zinc-500">{featured.category || featured.type || "Lieu"}</div></div><MapPin className="mt-1 size-5 shrink-0 text-[#9a7138]" /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={directionsUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#2f2417] px-4 py-2 text-xs font-semibold text-white">Itinéraire</a>
          {featured.website && <a href={featured.website} target="_blank" rel="noreferrer" className="rounded-full border border-[#d8c29b] bg-white px-4 py-2 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100">Site web</a>}
          {featured.phone && <a href={`tel:${featured.phone.replace(/\s+/g, "")}`} className="rounded-full border border-[#d8c29b] bg-white px-4 py-2 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100">Appeler</a>}
        </div>
        <div className="mt-4 divide-y divide-[#e8d9c1] border-y border-[#e8d9c1] text-sm dark:divide-white/10 dark:border-white/10">
          {featured.openingHours && <div className="py-3"><span className="font-medium">Horaires</span><span className="ml-2 text-zinc-500">{featured.openingHours}</span></div>}
          <div className="flex gap-2 py-3"><MapPin className="mt-0.5 size-4 shrink-0" /><span>{featured.address}</span></div>
          {featured.phone && <div className="py-3"><span className="font-medium">Téléphone</span><span className="ml-2 text-zinc-500">{featured.phone}</span></div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-[#8a5d17]">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">Google Maps<ExternalLink className="size-3" /></a>
          <a href={featured.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">Données cartographiques<ExternalLink className="size-3" /></a>
        </div>
      </div>
    </div>
    {items.length > 1 && <div className="grid gap-2 sm:grid-cols-2">{items.slice(1, 5).map((item, index) => <div key={`${item.sourceUrl}-${index}`} className="rounded-2xl border border-[#d8c29b] bg-[#fffaf0] p-3 dark:border-white/10 dark:bg-white/[0.035]"><div className="text-sm font-semibold">{item.name}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{item.address}</div><a href={item.mapsUrl || item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#8a5d17] underline underline-offset-2">Voir sur la carte<ExternalLink className="size-3" /></a></div>)}</div>}
  </div>;
}

function QuestionCard({ data, onAnswer }: { data: QuestionData; onAnswer: (answer: string) => void }) {
  const [other, setOther] = useState(false);
  const [custom, setCustom] = useState("");
  return <div className="mt-4 rounded-2xl border border-[#d8c29b] bg-[#fffaf0] p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
    <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a7138]">Question {data.index}/{data.total}</div>
    <div className="mt-2 text-sm font-medium leading-6 text-zinc-800 dark:text-zinc-100">{data.question}</div>
    <div className="mt-3 grid gap-2">
      {data.options.map((option, index) => <button key={`${option}-${index}`} type="button" onClick={() => onAnswer(option)} className="flex items-center gap-3 rounded-xl border border-[#e3d1b3] bg-white px-3 py-2.5 text-left text-sm transition hover:border-[#bb8b43] hover:bg-[#fbf2e3] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f1e1c5] text-[11px] font-bold text-[#76552a] dark:bg-amber-300/10 dark:text-amber-200">{String.fromCharCode(65 + index)}</span><span>{option}</span></button>)}
      {data.allowOther && <button type="button" onClick={() => setOther(true)} className="flex items-center gap-3 rounded-xl border border-dashed border-[#d7c29e] px-3 py-2.5 text-left text-sm text-zinc-600 hover:bg-[#fbf2e3] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f1e1c5] text-[11px] font-bold text-[#76552a] dark:bg-amber-300/10 dark:text-amber-200">+</span>Autre</button>}
    </div>
    {other && <div className="mt-3 flex gap-2"><Input autoFocus value={custom} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && custom.trim()) onAnswer(custom.trim()); }} placeholder="Écris ta réponse…" /><Button disabled={!custom.trim()} onClick={() => custom.trim() && onAnswer(custom.trim())}>Envoyer</Button></div>}
  </div>;
}

function AssistantMessage({ message, onAnswer }: { message: ChatMessage; onAnswer?: (answer: string) => void }) {
  return <div className={cn("min-w-0 flex-1 text-[15px] leading-7 text-zinc-800 dark:text-zinc-200", message.error && "text-red-600 dark:text-red-300")}>
    <ThinkingPanel trace={message.thinking} />
    {message.run?.fallback && <div className="mb-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/[0.07] dark:text-amber-100"><div className="font-semibold">Fallback activé</div><div className="mt-1">Ancien modèle : <b>{providerLabel(message.run.fallback.fromProvider)} · {message.run.fallback.fromModel}</b></div><div>Nouveau modèle : <b>{providerLabel(message.run.fallback.toProvider)} · {message.run.fallback.toModel}</b></div>{message.run.fallback.reason ? <div className="mt-1 opacity-75">{message.run.fallback.reason}</div> : null}</div>}
    {message.places?.length ? <div className="xl:hidden"><PlaceResults items={message.places} images={message.images || []} /></div> : <ImageCarousel items={message.images || []} />}
    {message.location && <div className="my-4 rounded-2xl border border-[#d8c29b] bg-[#fffaf0] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1e1c5] text-[#795827]"><MapPin className="size-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{message.location.label || "Localisation"}</div><div className="mt-1 font-mono text-xs text-zinc-500">{message.location.latitude.toFixed(6)}, {message.location.longitude.toFixed(6)}</div>{message.location.accuracy ? <div className="mt-1 text-[10px] text-zinc-400">Précision Windows estimée : ±{Math.round(message.location.accuracy)} m</div> : null}<a href={`https://www.openstreetmap.org/?mlat=${message.location.latitude}&mlon=${message.location.longitude}#map=16/${message.location.latitude}/${message.location.longitude}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#8a5d17] underline underline-offset-2">Ouvrir la carte<ExternalLink className="size-3" /></a></div></div>
    </div>}
    {message.content && <div className="prose-sophenic max-w-none">
      <MarkdownMathRenderer content={message.content} />
    </div>}
    {message.question && onAnswer && <QuestionCard data={message.question} onAnswer={onAnswer} />}
    {message.run?.agents?.length ? <div className="mt-3 rounded-2xl border border-[#dcc8a6] bg-[#fbf3e6] px-3 py-2 text-[10px] text-[#76552a] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"><div className="font-bold">MODELS USED</div><div className="mt-1 space-y-1">{message.run.agents.map((agent, index) => <div key={`${agent.role}-${agent.provider}-${agent.model}-${index}`} className="flex flex-wrap gap-1.5"><span className="font-semibold">{agent.role}</span><span>—</span><span>{providerLabel(agent.provider)}</span><span className="opacity-45">•</span><span className="font-mono">{agent.model}</span></div>)}</div></div> : message.run?.provider && message.run?.model ? <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#dcc8a6] bg-[#fbf3e6] px-2.5 py-1 text-[10px] font-medium text-[#76552a] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"><span className="font-bold">MODEL USED:</span><span>{providerLabel(message.run.provider)}</span><span className="opacity-45">•</span><span className="truncate font-mono">{message.run.model}</span></div> : null}
  </div>;
}

function PersonalizationModal({ open, initial, onClose, onSave }: { open: boolean; initial: string; onClose: () => void; onSave: (value: string) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setValue(initial); }, [initial, open]);
  if (!open) return null;
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-[#2d2418]/35 p-4 backdrop-blur-sm" onMouseDown={onClose}><motion.div initial={{ y: 14, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="w-full max-w-xl rounded-3xl border border-[#d7c29e]/70 bg-[#fffdf8] p-6 shadow-2xl dark:border-white/10 dark:bg-[#24211d]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-full bg-[#f4e3c4] text-[#795827]"><Settings2 className="size-4" /></div><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">Personnalisation</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Décris comment tu veux que Sophenic te parle et te réponde.</p></div><button type="button" onClick={onClose}><X className="size-4" /></button></div><textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Exemple : parle-moi en français, sois direct…" className="mt-5 min-h-44 w-full resize-y rounded-2xl border border-[#ddc9a7] bg-[#fffaf0] p-4 text-sm leading-6 outline-none dark:border-white/10 dark:bg-black/20" /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={saving} className="bg-[#5f4a2e] text-white" onClick={async () => { setSaving(true); try { await onSave(value); onClose(); } finally { setSaving(false); } }}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Enregistrer</Button></div></motion.div></motion.div>;
}

function EffortSelector({ value, onChange, disabled }: { value: EffortMode; onChange: (value: EffortMode) => void; disabled?: boolean }) {
  const items: Array<{ id: EffortMode; label: string; hint: string }> = [
    { id: "quick", label: "Rapide", hint: "1 moteur si possible" },
    { id: "auto", label: "Auto", hint: "Sophenic décide" },
    { id: "deep", label: "Deep", hint: "plusieurs IA si utile" }
  ];
  return <div className="ml-1 flex h-9 items-center rounded-xl bg-[#f4ead9] p-1 dark:bg-white/[0.05]">{items.map((item) => <button key={item.id} type="button" disabled={disabled} title={item.hint} onClick={() => onChange(item.id)} className={cn("rounded-lg px-2 py-1 text-[10px] font-semibold transition", value === item.id ? "bg-white text-[#6b4e27] shadow-sm dark:bg-white/10 dark:text-amber-100" : "text-zinc-500 hover:text-[#6b4e27]")}>{item.label}</button>)}</div>;
}

function SetupScreen({ state, error, onRetry, localModels, onUseOllama }: { state: BootState; error: string; onRetry: () => void; localModels: string[]; onUseOllama: (model: string) => Promise<void> }) {
  const firstLocal = localModels[0] || "";
  return <div className="grid min-h-screen place-items-center bg-[#fffaf0] p-5 text-zinc-900 dark:bg-[#1f1b17] dark:text-white"><div className="w-full max-w-md text-center">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/sophenic-logo.png" alt="Sophenic" className="mx-auto w-64 max-w-[80%] rounded-3xl" />{state === "checking" && <div className="mt-7"><Loader2 className="mx-auto size-5 animate-spin text-emerald-600" /><div className="mt-3 text-sm text-zinc-500">Préparation de Sophenic…</div></div>}{state === "key" && <div className="mt-7 rounded-3xl border border-emerald-100 bg-white/85 p-5 text-left shadow-sm dark:border-emerald-900/30 dark:bg-white/[0.04]"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Sparkles className="size-4" /></div><div><div className="font-medium">Runtime IA non disponible</div><div className="mt-0.5 text-xs leading-5 text-zinc-500">Les clés IA ne sont plus configurées dans l’interface utilisateur. Les clés déjà enregistrées restent dans le coffre SOPHENIC ; une nouvelle configuration se fait côté runtime sécurisé.</div></div></div>{error && <div className="mt-3 text-xs leading-5 text-red-600">{error}</div>}{firstLocal && <div className="mt-4 border-t border-[#eadcc4] pt-4 dark:border-white/10"><Button type="button" variant="outline" className="w-full justify-center" onClick={() => void onUseOllama(firstLocal)}><Bot className="size-4" />Utiliser Ollama · {firstLocal}</Button><div className="mt-2 text-[10px] leading-4 text-zinc-400">Le modèle local ne nécessite aucune clé externe.</div></div>}<Button className="mt-4 w-full" variant="outline" onClick={onRetry}><RefreshCw className="size-4" />Revérifier le runtime</Button></div>}{state === "error" && <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm leading-6 text-red-700"><div>{error || "Sophenic n’a pas pu terminer sa préparation."}</div><Button className="mt-4" variant="outline" onClick={onRetry}>Réessayer</Button></div>}</div></div>;
}

function ApprovalModal({ request, onChoice }: { request: ApprovalRequest; onChoice: (choice: "once" | "session" | "deny") => void }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-[#d8c29b] bg-[#fffdf8] p-6 shadow-2xl dark:border-white/10 dark:bg-[#24211d]"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700"><ShieldCheck className="size-5" /></div><div><h2 className="font-semibold">Hermes demande une autorisation</h2><p className="mt-1 text-sm text-zinc-500">{request.title}</p></div></div><pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/[0.04] p-3 text-xs leading-5 dark:bg-black/20">{request.detail}</pre><div className="mt-5 grid grid-cols-2 gap-2"><Button onClick={() => onChoice("once")} className="bg-[#5f4a2e] text-white">Autoriser une fois</Button><Button variant="outline" onClick={() => onChoice("session")}>Pour cette session</Button><Button variant="danger" onClick={() => onChoice("deny")} className="col-span-2">Refuser</Button></div></div></motion.div>;
}

function CredentialModal({ request, onSubmit, onCancel }: { request: CredentialRequest; onSubmit: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const label = request.kind === "sudo" ? "Mot de passe administrateur" : "Secret demandé par Hermes";
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[121] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-[#d8c29b] bg-[#fffdf8] p-6 shadow-2xl dark:border-white/10 dark:bg-[#24211d]"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700"><KeyRound className="size-5" /></div><div><h2 className="font-semibold">{label}</h2><p className="mt-1 text-sm text-zinc-500">{request.title}</p></div></div>{request.detail && <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/[0.04] p-3 text-xs leading-5 dark:bg-black/20">{request.detail}</pre>}<Input autoFocus type="password" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && value) onSubmit(value); }} placeholder={request.kind === "sudo" ? "Mot de passe Windows / sudo" : "Valeur secrète"} className="mt-4" /><p className="mt-2 text-[10px] leading-4 text-zinc-400">La valeur est transmise uniquement au moteur Hermes local pour répondre à cette demande et n’est pas ajoutée au chat.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Annuler</Button><Button disabled={!value} className="bg-[#5f4a2e] text-white" onClick={() => onSubmit(value)}>Envoyer</Button></div></div></motion.div>;
}

function CodeDashboard({ events, messages }: { events: DashboardEvent[]; messages: ChatMessage[] }) {
  const blocks = useMemo(() => extractCodeBlocks(messages), [messages]);
  const latest = blocks[blocks.length - 1];
  const html = [...blocks].reverse().find((block) => /^(html|htm)$/i.test(block.language));
  const previewUrl = useMemo(() => extractPreviewUrl(messages), [messages]);
  const plan = events.filter((event) => event.kind === "plan" || /Analyse|Terminé|Préparation|Reprise/.test(event.label)).slice(-12);
  const actions = events.filter((event) => event.kind !== "plan").slice(-14);
  return <aside className="hidden w-[410px] shrink-0 overflow-y-auto border-l border-[#e6d8c2] bg-[#fbf7ef] p-4 xl:block dark:border-white/[0.06] dark:bg-[#171512]">
    <div className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4 text-[#9a7138]" />Espace Code</div>
    <p className="mt-1 text-[11px] leading-5 text-zinc-400">Le travail réel est présenté en quatre panneaux. Le raisonnement privé du modèle n’est jamais affiché.</p>
    <div className="mt-4 space-y-3">
      <section className="rounded-2xl border border-[#e1d0b5] bg-white/75 p-3 dark:border-white/10 dark:bg-white/[0.03]"><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9a7138]">PLAN</div><div className="mt-2 space-y-2">{plan.length ? plan.map((event) => <div key={event.id} className="flex gap-2 text-[11px] leading-5"><span className="mt-0.5 grid size-4 shrink-0 place-items-center">{event.status === "running" ? <Loader2 className="size-3.5 animate-spin text-amber-500" /> : event.status === "done" ? <span className="grid size-3.5 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-2.5" /></span> : event.status === "error" ? <span className="grid size-3.5 place-items-center rounded-full bg-red-500 text-white"><X className="size-2.5" /></span> : event.status === "paused" ? <span className="size-3.5 rounded-full border-2 border-amber-500 bg-amber-50" /> : <span className="size-3.5 rounded-full border-2 border-[#cdb995] bg-transparent dark:border-white/20" />}</span><span><b>{event.label}</b>{event.detail ? <span className="block text-zinc-500">{event.detail}</span> : null}</span></div>) : <div className="text-[11px] text-zinc-400">🧠 L’analyse apparaîtra ici.</div>}</div></section>
      <section className="rounded-2xl border border-[#e1d0b5] bg-white/75 p-3 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#9a7138]">CODE</div>{latest ? <><div className="mt-2 text-[10px] text-zinc-400">Dernier bloc généré · {latest.language}</div><pre className="mt-2 max-h-72 overflow-auto whitespace-pre rounded-xl bg-[#1f1f1f] p-3 text-[10px] leading-5 text-zinc-100"><code>{latest.code}</code></pre></> : <div className="mt-2 text-[11px] text-zinc-400">Les fichiers et extraits générés apparaîtront ici à mesure que Sophenic Brain travaille dans le workspace avec son moteur Code multi-IA.</div>}</section>
      <section className="rounded-2xl border border-[#e1d0b5] bg-white/75 p-3 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#9a7138]">APERÇU</div>{previewUrl ? <><div className="mt-2 truncate text-[10px] text-zinc-400">{previewUrl}</div><iframe title="Aperçu serveur local" src={previewUrl} className="mt-2 h-72 w-full rounded-xl border border-black/10 bg-white" /></> : html ? <iframe title="Aperçu HTML" sandbox="allow-scripts" srcDoc={html.code} className="mt-2 h-72 w-full rounded-xl border border-black/10 bg-white" /> : <div className="mt-2 text-[11px] leading-5 text-zinc-400">Le serveur local ou l’aperçu HTML s’affichera ici dès qu’il est disponible.</div>}</section>
      <section className="rounded-2xl border border-[#e1d0b5] bg-white/75 p-3 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#9a7138]">ACTIONS</div><div className="mt-2 space-y-2">{actions.length ? actions.map((event) => <div key={event.id} className="rounded-xl bg-black/[0.025] px-2.5 py-2 text-[10px] leading-4 dark:bg-black/15"><div className="font-semibold">{event.label}</div>{event.detail ? <div className="mt-0.5 break-words font-mono text-zinc-500">{event.detail}</div> : null}</div>) : <div className="text-[11px] text-zinc-400">Terminal, fichiers, installations et tests seront listés ici en langage clair.</div>}</div></section>
    </div>
  </aside>;
}

export function LocalAgentWorkspace() {
  const [boot, setBoot] = useState<BootState>("checking");
  const [bootError, setBootError] = useState("");
  const [mode, setMode] = useState<AppMode>("chat");
  const selectedProvider: ProviderId = "sophenic";
  const selectedModel = "auto";
  const [effortMode, setEffortMode] = useState<EffortMode>("auto");
  const [modelValid, setModelValid] = useState(true);
  const [modelValidationError, setModelValidationError] = useState("");
  const [lastRoute, setLastRoute] = useState<IntentDecision | null>(null);
  const [imageAvailable, setImageAvailable] = useState(false);
  const [codeEngines, setCodeEngines] = useState<CodeEnginesUI | null>(null);
  const [codeEnginesLoading, setCodeEnginesLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [codeMessages, setCodeMessages] = useState<ChatMessage[]>([]);
  const [imageMessages, setImageMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<UsageState>({});
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  const [developerConnections, setDeveloperConnections] = useState<DeveloperConnectionState[]>([]);
  const [developerConnectionBusy, setDeveloperConnectionBusy] = useState<"github" | "vercel" | "status" | "">("");
  const [personalization, setPersonalizationState] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarHistory, setSidebarHistory] = useState<StoredConversationRecord[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState<Record<"chat" | "code" | "image", boolean>>({ chat: false, code: false, image: false });
  const [plannerNotice, setPlannerNotice] = useState<PlannerNotice | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [workspace, setWorkspace] = useState("");
  const [workspaceKind, setWorkspaceKind] = useState<CodeWorkspaceKind | "">("");
  const [designPickerOpen, setDesignPickerOpen] = useState(false);
  const [designHandoffs, setDesignHandoffs] = useState<CodeDesignHandoff[]>([]);
  const [targetFile, setTargetFile] = useState("");
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [dashboardEvents, setDashboardEvents] = useState<DashboardEvent[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationPermission[]>([]);
  const [permissionItem, setPermissionItem] = useState<IntegrationPermission | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState("");
  const [googleRedirectOpen, setGoogleRedirectOpen] = useState(false);
  const [googleRedirect, setGoogleRedirect] = useState("");
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [credentialRequest, setCredentialRequest] = useState<CredentialRequest | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [attachments, setAttachments] = useState<UserAttachment[]>([]);
  const attachmentInput = useRef<HTMLInputElement | null>(null);
  const currentRequest = useRef("");
  const currentAssistant = useRef("");
  const currentCodeRequest = useRef("");
  const currentCodeAssistant = useRef("");
  const activeHermesSession = useRef("");
  const sessions = useRef<{ pc?: string; code?: string; integrations?: string }>({});
  const localConversationIds = useRef<Record<"chat" | "code" | "image", string>>({ chat: uid(), code: uid(), image: uid() });
  const historySaveTimers = useRef<Record<"chat" | "code" | "image", number | undefined>>({ chat: undefined, code: undefined, image: undefined });
  const sessionTargets = useRef(new Map<string, { mode: "chat" | "code"; messageId: string }>());
  const interactiveRequests = useRef(new Map<string, string>());
  const sessionToolActivity = useRef(new Map<string, number>());
  const codeCheckpoint = useRef<CodeCheckpoint | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textArea = useRef<HTMLTextAreaElement | null>(null);
  const voiceModeRef = useRef<VoiceModeHandle | null>(null);
  const voiceSegmenter = useRef(new SpeechSegmenter());
  const streamedVoiceMessages = useRef(new Set<string>());

  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  const currentMessages = mode === "code" ? codeMessages : mode === "image" ? imageMessages : mode === "chat" ? chatMessages : [];
  const conversationTitle = useMemo(() => currentMessages.find((message) => message.role === "user")?.content.trim().slice(0, 38) || (mode === "code" ? "Nouvelle session Code" : mode === "image" ? "Nouvelle création" : mode === "chat" ? "Nouvelle conversation" : titleForMode(mode)), [currentMessages, mode]);
  const githubDeveloperConnection = developerConnections.find((item) => item.provider === "github");
  const vercelDeveloperConnection = developerConnections.find((item) => item.provider === "vercel");

  const refreshDeveloperConnections = useCallback(async () => {
    if (!desktop?.developerConnections) return;
    setDeveloperConnectionBusy("status");
    try {
      const result = await desktop.developerConnections.status();
      setDeveloperConnections(result.connections);
    } catch (cause) {
      setError(humanError(cause));
    } finally {
      setDeveloperConnectionBusy("");
    }
  }, [desktop]);

  const connectDeveloperProvider = useCallback(async (provider: "github" | "vercel") => {
    if (!desktop?.developerConnections) {
      window.open(`${window.location.origin}/api/connections/${provider}/connect`, "_blank", "noopener,noreferrer");
      return;
    }
    setDeveloperConnectionBusy(provider);
    try {
      const result = await desktop.developerConnections.connect(provider);
      setDeveloperConnections(result.connections);
    } catch (cause) {
      setError(humanError(cause));
    } finally {
      setDeveloperConnectionBusy("");
    }
  }, [desktop]);

  const openDeveloperPortal = useCallback(async (provider: "github" | "vercel", target: "connect" | "token" | "dashboard" = "connect") => {
    if (!desktop?.developerConnections) return;
    try {
      await desktop.developerConnections.openPortal(provider, target);
    } catch (cause) {
      setError(humanError(cause));
    }
  }, [desktop]);

  useEffect(() => {
    if (mode === "code" || mode === "plugins") void refreshDeveloperConnections();
  }, [mode, refreshDeveloperConnections]);

  const updateMessage = useCallback((targetMode: "chat" | "code" | "image", id: string, patch: Partial<ChatMessage> | ((message: ChatMessage) => Partial<ChatMessage>)) => {
    const setter = targetMode === "chat" ? setChatMessages : targetMode === "code" ? setCodeMessages : setImageMessages;
    setter((prev) => prev.map((message) => message.id === id ? { ...message, ...(typeof patch === "function" ? patch(message) : patch) } : message));
  }, []);

  const appendMessage = useCallback((targetMode: "chat" | "code" | "image", message: ChatMessage) => {
    const setter = targetMode === "chat" ? setChatMessages : targetMode === "code" ? setCodeMessages : setImageMessages;
    setter((prev) => [...prev, message]);
    if (message.role === "user" && message.content.trim().length >= 12) {
      const source = targetMode === "code" && workspace ? `project:${workspace}` : `conversation:${targetMode}`;
      void desktop?.workspace?.memoryRemember(message.content.trim(), source, false).catch(() => undefined);
    }
  }, [desktop, workspace]);

  const saveConversationSnapshot = useCallback(async (targetMode: "chat" | "code" | "image", messages: ChatMessage[]) => {
    if (!desktop?.workspace || !messages.length) return;
    const title = messages.find((message) => message.role === "user")?.content.trim().slice(0, 80) || (targetMode === "code" ? "Session Code" : targetMode === "image" ? "Création Image" : "Conversation");
    const storedMessages = messages.map((message) => message.attachments?.length
      ? { ...message, attachments: message.attachments.map(({ id, name, mime, size }) => ({ id, name, mime, size, dataUrl: "" })) }
      : message);
    await desktop.workspace.historySave({
      id: localConversationIds.current[targetMode],
      title,
      mode: targetMode,
      messages: storedMessages,
      ...(targetMode === "code" && workspace ? { workspace } : {})
    }).catch(() => undefined);
    const recent = await desktop.workspace.historyList().catch(() => [] as StoredConversationRecord[]);
    setSidebarHistory(recent as StoredConversationRecord[]);
  }, [desktop, workspace]);

  useEffect(() => {
    if (!chatMessages.length) return;
    if (historySaveTimers.current.chat) window.clearTimeout(historySaveTimers.current.chat);
    historySaveTimers.current.chat = window.setTimeout(() => void saveConversationSnapshot("chat", chatMessages), 450);
    return () => { if (historySaveTimers.current.chat) window.clearTimeout(historySaveTimers.current.chat); };
  }, [chatMessages, saveConversationSnapshot]);
  useEffect(() => {
    if (!codeMessages.length) return;
    if (historySaveTimers.current.code) window.clearTimeout(historySaveTimers.current.code);
    historySaveTimers.current.code = window.setTimeout(() => void saveConversationSnapshot("code", codeMessages), 450);
    return () => { if (historySaveTimers.current.code) window.clearTimeout(historySaveTimers.current.code); };
  }, [codeMessages, saveConversationSnapshot]);
  useEffect(() => {
    if (!imageMessages.length) return;
    if (historySaveTimers.current.image) window.clearTimeout(historySaveTimers.current.image);
    historySaveTimers.current.image = window.setTimeout(() => void saveConversationSnapshot("image", imageMessages), 450);
    return () => { if (historySaveTimers.current.image) window.clearTimeout(historySaveTimers.current.image); };
  }, [imageMessages, saveConversationSnapshot]);

  const openStoredConversation = useCallback((record: StoredConversationRecord) => {
    localConversationIds.current[record.mode] = record.id;
    if (record.mode === "chat") { setChatMessages(normalizeChatMessages(record.messages)); sessions.current.pc = undefined; sessions.current.integrations = undefined; }
    if (record.mode === "code") { setCodeMessages(normalizeChatMessages(record.messages)); setDashboardEvents([]); if (record.workspace) { setWorkspace(record.workspace); setWorkspaceKind("external-project"); } sessions.current.code = undefined; }
    if (record.mode === "image") { setImageMessages(normalizeChatMessages(record.messages)); setPendingImage(null); }
    setMode(record.mode); setInput(""); setError(""); setUsage({});
  }, []);


  const refreshSidebarHistory = useCallback(async () => {
    if (!desktop?.workspace) return;
    const items = await desktop.workspace.historyList().catch(() => [] as StoredConversationRecord[]);
    setSidebarHistory(items as StoredConversationRecord[]);
  }, [desktop]);

  const refreshVoiceSettings = useCallback(async () => {
    if (!desktop?.workspace) return null;
    const settings = await desktop.workspace.voiceGet().catch(() => null);
    if (settings) setVoiceSettings(settings as VoiceSettings);
    return settings as VoiceSettings | null;
  }, [desktop]);

  useEffect(() => {
    if (boot !== "ready") return;
    void refreshSidebarHistory();
    void refreshVoiceSettings();
  }, [boot, refreshSidebarHistory, refreshVoiceSettings]);

  useEffect(() => {
    if (!desktop?.workspace?.onPlannerCompleted) return;
    return desktop.workspace.onPlannerCompleted((payload) => {
      setPlannerNotice(payload as PlannerNotice);
      window.setTimeout(() => setPlannerNotice((current) => current?.id === payload.id ? null : current), 9_000);
    });
  }, [desktop]);

  // Tool-backed and Hermes responses do not use the OpenRouter delta channel.
  // Once such a turn lands in chat, speak it through the same realtime session.
  useEffect(() => {
    if (!voiceModeOpen || sending || mode !== "chat") return;
    const latest = [...chatMessages].reverse().find((message) => message.role === "assistant" && !message.error && message.content.trim());
    if (!latest || streamedVoiceMessages.current.has(latest.id) || /SOPHENIC_QUESTION/i.test(latest.content)) return;
    streamedVoiceMessages.current.add(latest.id);
    const context = [...chatMessages].reverse().find((message) => message.role === "user")?.content || "";
    voiceModeRef.current?.queueSpeech(latest.content, context);
    voiceModeRef.current?.finishResponse();
  }, [chatMessages, mode, sending, voiceModeOpen]);

  const setCodePlan = useCallback((steps: string[], activeIndex = 0) => {
    const now = Date.now();
    setDashboardEvents((prev) => [
      ...prev.filter((event) => event.kind !== "plan"),
      ...steps.map((label, index) => ({ id: `plan-${now}-${index}`, label, status: index < activeIndex ? "done" as const : index === activeIndex ? "running" as const : "pending" as const, at: now + index, kind: "plan" as const }))
    ].slice(-80));
  }, []);

  const advanceCodePlan = useCallback((kind: "file" | "terminal" | "test" | "quality" | "review" | "complete" | "paused") => {
    setDashboardEvents((prev) => {
      const planIndexes = prev.map((event, index) => event.kind === "plan" ? index : -1).filter((index) => index >= 0);
      if (!planIndexes.length) return prev;
      const currentIndex = planIndexes.find((index) => prev[index].status === "running") ?? planIndexes[0];
      let targetIndex = currentIndex;
      if (kind === "test") targetIndex = planIndexes.find((index) => /test|validation|aperçu|preview|build/i.test(prev[index].label)) ?? currentIndex;
      else if (kind === "quality") targetIndex = planIndexes.find((index) => /qualit|visuel|responsive|ux|parcours|tester réellement|environnement adapté|corriger les écarts|corriger les erreurs/i.test(prev[index].label)) ?? currentIndex;
      else if (kind === "review") targetIndex = planIndexes.find((index) => /review|relecture|vérif|verification/i.test(prev[index].label)) ?? currentIndex;
      else if (kind === "file" || kind === "terminal") targetIndex = planIndexes.find((index) => /implément|implement|fichier|construction|développ|developp/i.test(prev[index].label)) ?? currentIndex;
      const next = prev.map((event) => ({ ...event }));
      if (kind === "paused") { next[currentIndex] = { ...next[currentIndex], status: "paused" }; return next; }
      if (kind === "complete") { for (const index of planIndexes) next[index] = { ...next[index], status: "done" }; return next; }
      for (const index of planIndexes) {
        if (index < targetIndex && next[index].status !== "error") next[index] = { ...next[index], status: "done" };
        else if (index === targetIndex) next[index] = { ...next[index], status: "running" };
      }
      if (codeCheckpoint.current) {
        const activeStep = Math.max(0, planIndexes.indexOf(targetIndex));
        const checkpoint = { ...codeCheckpoint.current, activeStep, savedAt: Date.now() };
        codeCheckpoint.current = checkpoint;
        try { window.localStorage.setItem("sophenic.code.checkpoint.v1", JSON.stringify(checkpoint)); } catch {}
        void window.sophenicDesktop?.runtime.saveCodeCheckpoint(checkpoint).catch(() => false);
      }
      return next;
    });
  }, []);

  const persistCheckpoint = useCallback((checkpoint: CodeCheckpoint | null) => {
    const previousWorkspace = codeCheckpoint.current?.workspace || "";
    codeCheckpoint.current = checkpoint;
    try {
      if (checkpoint) {
        setResumeAvailable(true);
        window.localStorage.setItem("sophenic.code.checkpoint.v1", JSON.stringify(checkpoint));
        void window.sophenicDesktop?.runtime.saveCodeCheckpoint(checkpoint).catch(() => false);
      } else {
        setResumeAvailable(false);
        window.localStorage.removeItem("sophenic.code.checkpoint.v1");
        if (previousWorkspace) void window.sophenicDesktop?.runtime.clearCodeCheckpoint(previousWorkspace).catch(() => false);
      }
    } catch { /* local persistence is optional */ }
  }, []);

  const refreshIntegrations = useCallback(async () => {
    const api = window.sophenicDesktop;
    if (!api) return;
    try { setIntegrations(await api.integrations.list() as IntegrationPermission[]); } catch { /* optional until Hermes exists */ }
  }, []);

  const refreshCodeEngines = useCallback(async (force = false) => {
    const api = window.sophenicDesktop;
    if (!api) return;
    setCodeEnginesLoading(true);
    try { setCodeEngines(await api.code.engines(force) as CodeEnginesUI); }
    catch { /* Code engines are optional and must never block Sophenic Code. */ }
    finally { setCodeEnginesLoading(false); }
  }, []);

  const loadModels = useCallback(async (_force = false) => {
    const api = window.sophenicDesktop;
    if (!api) return;
    try {
      const status = await api.runtime.modelManagerStatus();
      // The user never selects an AI model. Providers/models are resources for Sophenic Brain.
      const hasEngine = (status.configuredProviders || []).length > 0 || status.ollamaReachable;
      setModelValid(hasEngine);
      setModelValidationError(hasEngine ? "" : "Aucun moteur IA n’est disponible dans le coffre runtime. Vérifie la configuration sécurisée ou démarre Ollama.");
    } catch (cause) { setError(humanError(cause)); }
  }, []);

  const loadImageModels = useCallback(async (force = false) => {
    const api = window.sophenicDesktop;
    if (!api) return;
    try {
      const options = await api.openrouter.imageModels(force);
      setImageAvailable(Array.isArray(options) && options.length > 0);
    } catch (cause) { setImageAvailable(false); setError(humanError(cause)); }
  }, []);

  const bootApp = useCallback(async () => {
    const api = window.sophenicDesktop;
    if (!api) { setBoot("error"); setBootError("Cette interface doit être lancée depuis l’application Windows Sophenic."); return; }
    setBootError(""); setBoot("checking");
    try {
      const config = await api.runtime.engineConfig() as EngineConfig;
      setModelValid((config.aiProviderCount || 0) > 0);
      const raw = config.personalization || "";
      const marker = "User communication preference:\n";
      setPersonalizationState(raw.includes(marker) ? raw.split(marker).slice(1).join(marker).trim() : raw);
      if (!config.openRouterKeyConfigured && !(config.aiProviderCount > 0)) {
        const runtimeStatus = await api.runtime.status().catch(() => null);
        const local = runtimeStatus?.ollama?.state === "ready" ? runtimeStatus.ollama.models.map((item) => item.model).filter(Boolean) : [];
        if (local.length) {
          setModelValid(true);
          setModelValidationError("");
        } else {
          // Do not trap a new user in the legacy OpenRouter-only setup screen.
          // The main UI now exposes the encrypted multi-provider vault directly.
          setModelValid(false);
          setModelValidationError("Aucun moteur IA n’est disponible dans le coffre runtime. Vérifie la configuration sécurisée ou démarre Ollama.");
        }
      }
      setBoot("ready");
    } catch (cause) { setBoot("error"); setBootError(humanError(cause)); }
  }, []);

  useEffect(() => { void bootApp(); }, [bootApp]);
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let checkpoint: CodeCheckpoint | null = null;
      try {
        const raw = window.localStorage.getItem("sophenic.code.checkpoint.v1");
        if (raw) checkpoint = JSON.parse(raw) as CodeCheckpoint;
      } catch { checkpoint = null; }
      if (!checkpoint) checkpoint = await window.sophenicDesktop?.runtime.recoverCodeCheckpoint().catch(() => null) || null;
      if (cancelled || !checkpoint?.workspace) return;
      codeCheckpoint.current = checkpoint;
      setResumeAvailable(true);
      setWorkspace(checkpoint.workspace);
      setWorkspaceKind(checkpoint.workspaceKind || "managed");
      setTargetFile(checkpoint.targetFile || "");
      setCodePlan(checkpoint.planSteps?.length ? checkpoint.planSteps : ["Reprendre la tâche depuis le checkpoint"], Math.max(0, checkpoint.activeStep || 0));
      setDashboardEvents((prev) => [...prev, { id: uid(), label: "Projet détecté", detail: "Une tâche interrompue a été restaurée. Reprendre la tâche ?", status: "paused" as const, at: Date.now(), kind: "other" as const }].slice(-80));
    };
    void restore();
    return () => { cancelled = true; };
  }, [setCodePlan]);
  useEffect(() => { if (boot === "ready") { void loadModels(); void refreshIntegrations(); } }, [boot, loadModels, refreshIntegrations]);
  useEffect(() => { if (boot === "ready" && mode === "code") void refreshCodeEngines(false); }, [boot, mode, refreshCodeEngines]);
  useEffect(() => { if (boot === "ready" && mode === "image" && !imageAvailable) void loadImageModels(); }, [boot, imageAvailable, loadImageModels, mode]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [currentMessages, sending, mode]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.openrouter.onStream(({ requestId, text }) => {
      if (requestId !== currentRequest.current || !currentAssistant.current) return;
      const id = currentAssistant.current;
      updateMessage("chat", id, (message) => ({
        content: message.content + text,
        thinking: message.thinking?.active ? finishThinkingTrace(message.thinking, "Réponse en cours", "Premier contenu visible reçu.", "status") : message.thinking
      }));
      if (voiceModeOpen) {
        for (const segment of voiceSegmenter.current.push(text)) {
          streamedVoiceMessages.current.add(id);
          voiceModeRef.current?.queueSpeech(segment);
        }
      }
    });
  }, [desktop, updateMessage, voiceModeOpen]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.code.onEvent((event) => {
      if (event.requestId !== currentCodeRequest.current || !currentCodeAssistant.current) return;
      const id = currentCodeAssistant.current;
      if (event.type === "delta" && event.text) {
        updateMessage("code", id, (message) => ({ content: message.content + event.text }));
      } else if (event.type === "plan" && event.steps?.length) {
        setCodePlan(event.steps, 0);
        setDashboardEvents((prev) => [...prev, { id: uid(), label: "Analyse du projet", detail: "Plan autonome généré par Sophenic Brain.", status: "done" as const, at: Date.now(), kind: "other" as const }].slice(-80));
      } else if (event.type === "checkpoint" && typeof event.step === "number") {
        setDashboardEvents((prev) => {
          const next = prev.map((item) => ({ ...item }));
          const planIndexes = next.map((item, index) => item.kind === "plan" ? index : -1).filter((index) => index >= 0);
          if (planIndexes.length) {
            const target = Math.min(Math.max(0, event.step || 0), planIndexes.length - 1);
            planIndexes.forEach((index, position) => { next[index].status = position < target ? "done" : position === target ? "running" : "pending"; });
          }
          return [...next, { id: uid(), label: "Checkpoint", detail: event.message || "État sauvegardé.", status: "done" as const, at: Date.now(), kind: "other" as const }].slice(-80);
        });
      } else if (event.type === "route" && event.provider && event.model) {
        updateMessage("code", id, (message) => ({
          run: { ...(message.run || { provider: "sophenic", model: "auto" }), provider: event.provider || "sophenic", model: event.model || "auto", requestedProvider: "sophenic", requestedModel: "auto" },
          thinking: appendThinkingStep(message.thinking, "Route Brain active", `${providerLabel(event.provider || "sophenic")} / ${event.model || "auto"}`, "model")
        }));
        setDashboardEvents((prev) => [...prev, { id: uid(), label: "🧠 Route Sophenic Brain", detail: `${providerLabel(event.provider || "sophenic")} / ${event.model || "auto"}`, status: "running" as const, at: Date.now(), kind: "plan" as const }].slice(-80));
      } else if (event.type === "fallback" && event.provider && event.model) {
        const detail = `${providerLabel(event.previousProvider || "")} / ${event.previousModel || "?"} → ${providerLabel(event.provider)} / ${event.model}`;
        updateMessage("code", id, (message) => ({ thinking: appendThinkingStep(message.thinking, "Fallback Brain", detail, "fallback") }));
        setDashboardEvents((prev) => [...prev, { id: uid(), label: "Fallback automatique", detail, status: "running" as const, at: Date.now(), kind: "plan" as const }].slice(-80));
      } else if (event.type === "tool" && event.name) {
        setDashboardEvents((prev) => [...prev, { id: uid(), label: `Outil Sophenic Code · ${event.name}`, detail: "Exécution dans le workspace autorisé.", status: "running" as const, at: Date.now(), kind: "terminal" as const }].slice(-80));
        updateMessage("code", id, (message) => ({ thinking: appendThinkingStep(message.thinking, "Outil Sophenic Code", event.name, "tool") }));
      } else if (event.type === "status" && event.message) {
        updateMessage("code", id, (message) => ({ thinking: appendThinkingStep(message.thinking, "Sophenic Code Engine", event.message, "status") }));
      } else if (event.type === "error" && event.message) {
        setDashboardEvents((prev) => [...prev, { id: uid(), label: "Sophenic Code Engine", detail: event.message, status: "error" as const, at: Date.now(), kind: "other" as const }].slice(-80));
      }
    });
  }, [desktop, updateMessage]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.openrouter.onModelNotice(({ requestId, notice }) => {
      if (requestId !== currentRequest.current || !currentAssistant.current) return;
      const id = currentAssistant.current;
      const type = String(notice.type || "");
      if (type === "fallback") {
        const fromProvider = String(notice.previousProvider || selectedProvider);
        const fromModel = String(notice.previousModel || selectedModel);
        const toProvider = String(notice.provider || "openrouter");
        const toModel = String(notice.model || "");
        updateMessage("chat", id, (message) => ({
          run: { provider: toProvider, model: toModel, requestedProvider: message.run?.requestedProvider || selectedProvider, requestedModel: message.run?.requestedModel || selectedModel, fallback: { fromProvider, fromModel, toProvider, toModel, reason: String(notice.reason || "") } },
          thinking: appendThinkingStep(message.thinking, "Fallback modèle", `${providerLabel(fromProvider)} / ${fromModel} → ${providerLabel(toProvider)} / ${toModel}`, "fallback")
        }));
      } else if (type === "selected") {
        const activeProvider = String(notice.provider || selectedProvider);
        const activeModel = String(notice.model || selectedModel);
        updateMessage("chat", id, (message) => ({
          run: { ...(message.run || {}), provider: activeProvider, model: activeModel },
          thinking: appendThinkingStep(message.thinking, "Moteur actif", `${providerLabel(activeProvider)} / ${activeModel}`, "model")
        }));
      } else if (type === "reasoning") {
        const effort = String(notice.reasoningEffort || "actif");
        updateMessage("chat", id, (message) => ({
          thinking: appendThinkingStep(message.thinking, "Raisonnement modèle", effort, "model")
        }));
      } else if (type === "brain") {
        updateMessage("chat", id, (message) => ({
          thinking: appendThinkingStep(message.thinking, "Sophenic Brain", String(notice.reason || "Analyse et routage de la tâche"), "route")
        }));
      } else if (type === "agent") {
        const activeProvider = String(notice.provider || "");
        const activeModel = String(notice.model || "");
        updateMessage("chat", id, (message) => ({
          thinking: appendThinkingStep(message.thinking, "Agent sélectionné", `${providerLabel(activeProvider)} / ${activeModel}${notice.reason ? ` · ${String(notice.reason)}` : ""}`, "model")
        }));
      } else if (type === "attempt") {
        const activeProvider = String(notice.provider || "");
        const activeModel = String(notice.model || "");
        updateMessage("chat", id, (message) => ({
          thinking: appendThinkingStep(message.thinking, "Route évaluée", `${providerLabel(activeProvider)} / ${activeModel}${notice.reason ? ` · ${String(notice.reason)}` : ""}`, "model")
        }));
      }
    });
  }, [desktop, selectedModel, selectedProvider, updateMessage]);

  useEffect(() => {
    if (!desktop) return;
    return desktop.agent.onEvent((event) => {
      const method = event.method.toLowerCase();
      const params = event.params || {};
      const sessionId = typeof params.session_id === "string" ? params.session_id : "";
      const requestId = String(params.request_id || params.id || "");
      const target = sessionTargets.current.get(sessionId);

      if (method === "approval.request" || (method.includes("approval") && method.includes("required"))) {
        if (requestId) {
          interactiveRequests.current.set(requestId, sessionId);
          const title = String(params.message || params.description || params.tool || "Une action locale nécessite ton accord.");
          setApproval({ requestId, title, detail: String(params.command || params.detail || params.arguments || params.input || JSON.stringify(params, null, 2)).slice(0, 4000) });
          if (target) updateMessage(target.mode, target.messageId, (message) => ({ thinking: appendThinkingStep(message.thinking, "Autorisation requise", title, "tool") }));
        }
      }
      if (method === "clarify.request" || (method.includes("clarify") && method.includes("question"))) {
        const optionsRaw = Array.isArray(params.options) ? params.options : Array.isArray(params.choices) ? params.choices : [];
        const options = optionsRaw.map(String).filter(Boolean).slice(0, 8);
        if (target && requestId) {
          interactiveRequests.current.set(requestId, sessionId);
          const question = String(params.question || params.message || "J’ai besoin d’une précision.");
          updateMessage(target.mode, target.messageId, (message) => ({
            question: { index: Number(params.index) || 1, total: Number(params.total) || 1, question, options: options.length ? options : ["Oui", "Non"], allowOther: true, requestId, kind: "hermes" },
            thinking: appendThinkingStep(message.thinking, "Précision requise", question, "status")
          }));
        }
      }
      if (method === "sudo.request" || method === "secret.request") {
        if (requestId) {
          const kind: CredentialRequest["kind"] = method.startsWith("sudo") ? "sudo" : "secret";
          const title = String(params.message || params.prompt || params.description || (kind === "sudo" ? "Hermes a besoin d’une élévation administrateur." : "Hermes a besoin d’un secret pour continuer."));
          interactiveRequests.current.set(requestId, sessionId);
          setCredentialRequest({
            requestId,
            kind,
            title,
            detail: String(params.command || params.name || params.key || params.detail || "").slice(0, 2000)
          });
          if (target) updateMessage(target.mode, target.messageId, (message) => ({ thinking: appendThinkingStep(message.thinking, kind === "sudo" ? "Élévation Windows requise" : "Secret requis", title, "tool") }));
        }
      }
      if (/^(?:approval|clarify|sudo|secret)\.(?:expire|expired|cancel|cancelled)$/.test(method) && requestId) {
        interactiveRequests.current.delete(requestId);
        setApproval((current) => current?.requestId === requestId ? null : current);
        setCredentialRequest((current) => current?.requestId === requestId ? null : current);
      }
      // Raw chain-of-thought stays private. Handle these events before any generic
      // tool/action matcher so no reasoning payload can leak through a mixed method name.
      if (/reasoning|thinking|analysis/.test(method)) {
        if (target) updateMessage(target.mode, target.messageId, (message) => ({ thinking: appendThinkingStep(message.thinking, "Analyse en cours", undefined, "status") }));
        return;
      }

      if (method.includes("tool") || method.includes("command") || method.includes("action")) {
        if (sessionId) sessionToolActivity.current.set(sessionId, (sessionToolActivity.current.get(sessionId) || 0) + 1);
        const action = friendlyHermesAction(method, params);
        if (action) {
          setDashboardEvents((prev) => [...prev, action].slice(-80));
          if (target?.mode === "code") {
            if (action.kind === "test") advanceCodePlan("test");
            else if (action.kind === "file") advanceCodePlan("file");
            else if (action.kind === "terminal") advanceCodePlan("terminal");
          }
          if (target) {
            const kind: ThinkingStepKind = action.kind === "file" ? "file" : action.kind === "terminal" ? "command" : action.kind === "test" ? "test" : "tool";
            const label = action.label.replace(/^[^\p{L}\p{N}]+/u, "").trim() || "Outil Hermes";
            updateMessage(target.mode, target.messageId, (message) => ({ thinking: appendThinkingStep(message.thinking, label, action.detail, kind) }));
          }
        }
      }

      if (!target) return;
      if (method === "message.delta" || method === "assistant.delta" || method === "response.delta") {
        const text = valueText(params);
        // Code uses session.history/status as the authoritative stream. Hermes
        // event deltas can contain auxiliary/background errors that are not the
        // builder's answer (notably the misleading 401 User-not-found).
        if (text && target.mode !== "code") updateMessage(target.mode, target.messageId, (message) => ({ content: message.content + text }));
      } else if (method === "message.complete" || method === "assistant.complete" || method === "response.complete") {
        const text = valueText(params);
        if (text && target.mode !== "code" && !hermesProviderFailureText(text)) updateMessage(target.mode, target.messageId, { content: text });
      }
    });
  }, [advanceCodePlan, desktop, updateMessage]);



  const ensureHermesSession = async (purpose: "pc" | "code" | "assistant", model: string, provider: AgentProviderId, workspaceOverride = ""): Promise<string> => {
    if (!desktop) throw new Error("Sophenic Desktop indisponible.");
    const setup = await desktop.runtime.setupStatus().catch(() => null);
    if (setup && !setup.installed) {
      
      await desktop.runtime.ensureEngine();
      
    }
    const key = purpose === "pc" ? "pc" : purpose === "code" ? "code" : "integrations";
    const existing = sessions.current[key];
    if (existing) {
      await desktop.agent.switchModel(existing, model, provider);
      await desktop.agent.setApprovalMode("smart").catch(() => undefined);
      return existing;
    }
    // session.create is the first gateway operation for a new Code route. The
    // main process starts Hermes with a provider-pinned, isolated HERMES_HOME
    // before creating the session. Do NOT boot a generic Hermes gateway first:
    // that was allowing stale/default credentials to leak into Code.
    const result = await desktop.agent.createSession({ cwd: purpose === "code" ? (workspaceOverride || workspace) : undefined, model, provider, purpose });
    const sessionId = typeof result.session_id === "string" ? result.session_id : typeof result.id === "string" ? result.id : "";
    if (!sessionId) throw new Error("Hermes n’a pas créé la session demandée.");
    sessions.current[key] = sessionId;
    // Plugins already enabled in Sophenic are product-level consent. Hermes'
    // smart mode then auto-approves low-risk flagged commands while preserving
    // escalation for genuinely risky/destructive operations.
    await desktop.agent.setApprovalMode("smart").catch(() => undefined);
    return sessionId;
  };

  const pollHermesResponse = async (sessionId: string, targetMode: "chat" | "code", messageId: string, baseline = ""): Promise<string> => {
    if (!desktop) return "";
    let last = baseline;
    let terminalHits = 0;
    let consecutiveErrors = 0;
    let lastToolCount = sessionToolActivity.current.get(sessionId) || 0;
    let lastStatusSignature = "";
    let pendingProviderFailure = "";
    let visibleProgressAfterFailure = false;
    // A long Code task is allowed to run for hours only while it actually makes
    // progress. The watchdog never asks the user to type “continue”: it throws
    // an internal recoverable signal so the caller recreates Hermes or changes
    // provider automatically.
    let lastMeaningfulProgressAt = Date.now();
    let hasMeaningfulProgress = false;
    const initialProgressDeadlineMs = 180_000;
    const activeProgressDeadlineMs = 300_000;

    while (true) {
      await sleep(750);
      try {
        const history = await desktop.agent.rpc("session.history", { session_id: sessionId });
        const text = latestAssistantFromHistory(history);
        if (text && text !== last) {
          if (isTruncationFailure(text)) throw new Error(text);
          const providerFailure = hermesProviderFailureText(text);
          if (providerFailure) {
            // Hermes can emit auxiliary/background auth failures into history
            // while the main Code turn is still running. Never render a bare
            // `HTTP 401: User not found` as the assistant answer before status
            // confirms the main turn actually failed.
            pendingProviderFailure = providerFailure;
          } else {
            last = text;
            visibleProgressAfterFailure = Boolean(pendingProviderFailure);
            pendingProviderFailure = "";
            lastMeaningfulProgressAt = Date.now();
            hasMeaningfulProgress = true;
            updateMessage(targetMode, messageId, { content: text });
          }
        }

        const toolCount = sessionToolActivity.current.get(sessionId) || 0;
        if (toolCount !== lastToolCount) {
          lastToolCount = toolCount;
          lastMeaningfulProgressAt = Date.now();
          hasMeaningfulProgress = true;
          if (pendingProviderFailure) visibleProgressAfterFailure = true;
        }

        const status = await desktop.agent.rpc("session.status", { session_id: sessionId }).catch(() => null);
        if (status && isTruncationFailure(JSON.stringify(status))) throw new Error(valueText(status) || "La réponse Hermes a été tronquée.");
        const failedStatus = failedStatusMessage(status);
        if (failedStatus) throw new Error(pendingProviderFailure || failedStatus);

        const statusSignature = status ? JSON.stringify(status, (key, value) => /time|timestamp|updated|elapsed/i.test(key) ? undefined : value).slice(0, 1200) : "";
        if (statusSignature && statusSignature !== lastStatusSignature) {
          lastStatusSignature = statusSignature;
        }

        const hasInteractiveRequest = [...interactiveRequests.current.values()].some((pendingSession) => pendingSession === sessionId);
        if (hasInteractiveRequest) {
          // Waiting for an explicit user approval/answer is not an AI stall.
          terminalHits = 0;
          lastMeaningfulProgressAt = Date.now();
        } else if (isIdleStatus(status)) {
          terminalHits += 1;
        } else {
          terminalHits = 0;
        }

        if (targetMode === "code" && !hasInteractiveRequest) {
          const deadline = hasMeaningfulProgress ? activeProgressDeadlineMs : initialProgressDeadlineMs;
          if (Date.now() - lastMeaningfulProgressAt >= deadline) {
            throw new Error(`SOPHENIC_CODE_STALLED: aucune progression réelle de Hermes depuis ${Math.round(deadline / 1000)} secondes.`);
          }
        }

        consecutiveErrors = 0;
        // Two consecutive idle observations mean the AI has actually completed.
        if (terminalHits >= 2) {
          if (pendingProviderFailure && !visibleProgressAfterFailure && (!last || last === baseline)) {
            throw new Error(pendingProviderFailure);
          }
          if (last) return last;
          if (pendingProviderFailure) throw new Error(pendingProviderFailure);
          throw new Error("Hermes a terminé le tour sans renvoyer de réponse visible.");
        }
      } catch (cause) {
        if (isTruncationFailure(cause) || isModelAvailabilityFailure(cause)) throw cause;
        consecutiveErrors += 1;
        if (consecutiveErrors >= 8) throw cause;
      }
    }
  };

  const resolveCodeWorkspace = async (prompt: string): Promise<CodeWorkspaceInfo> => {
    if (!desktop) throw new Error("Sophenic Desktop indisponible.");

    if (/REPRISE DE CHECKPOINT SOPHENIC/i.test(prompt) && codeCheckpoint.current?.workspace) {
      const checkpoint = codeCheckpoint.current;
      setWorkspace(checkpoint.workspace);
      setWorkspaceKind(checkpoint.workspaceKind || "managed");
      setTargetFile(checkpoint.targetFile || "");
      return { workspace: checkpoint.workspace, kind: checkpoint.workspaceKind || "managed", ...(checkpoint.targetFile ? { targetFile: checkpoint.targetFile } : {}), stateDir: "" };
    }

    if (codeNeedsExistingFile(prompt) && (!targetFile || workspaceKind !== "external-file")) {
      const selected = await desktop.runtime.chooseCodeFile();
      if (!selected) throw new Error("Sélectionne le fichier à modifier pour continuer cette tâche Sophenic Code.");
      setWorkspace(selected.workspace);
      setWorkspaceKind(selected.kind);
      setTargetFile(selected.targetFile || "");
      sessions.current.code = undefined;
      return selected;
    }

    if (codeNeedsExistingProject(prompt) && (!workspace || workspaceKind === "managed" || workspaceKind === "")) {
      const selected = await desktop.runtime.chooseWorkspace();
      if (!selected) throw new Error("Sélectionne le projet/dossier existant à modifier pour continuer cette tâche Sophenic Code.");
      setWorkspace(selected.workspace);
      setWorkspaceKind(selected.kind);
      setTargetFile("");
      sessions.current.code = undefined;
      return selected;
    }

    if (workspace) {
      return {
        workspace,
        kind: workspaceKind || "external-project",
        ...(targetFile ? { targetFile } : {}),
        stateDir: ""
      };
    }

    const created = await desktop.runtime.createCodeWorkspace(prompt);
    setWorkspace(created.workspace);
    setWorkspaceKind(created.kind);
    setTargetFile("");
    sessions.current.code = undefined;
    return created;
  };

  const codeHandoff = async (activeWorkspace: string, checkpoint: CodeCheckpoint | null, activeTargetFile = ""): Promise<string> => {
    if (!desktop || !activeWorkspace) return "";
    try {
      const handoff = await desktop.runtime.codeHandoff({ workspace: activeWorkspace, checkpoint: checkpoint || undefined, targetFile: activeTargetFile || undefined });
      return handoff.summary || "";
    } catch {
      return "";
    }
  };

  const sendHermesPrompt = async (targetMode: "chat" | "code", prompt: string, purpose: "pc" | "code" | "assistant", model: string, provider: ProviderId, route?: IntentDecision, displayPrompt?: string) => {
    if (!desktop) return;
    const user: ChatMessage = { id: uid(), role: "user", content: displayPrompt ?? prompt };
    const assistantId = uid();
    appendMessage(targetMode, user);
    const routeLabel = route?.label || (purpose === "pc" ? "Agent PC" : "Agent Hermes optionnel");
    const initialThinking = appendThinkingStep(
      createThinkingTrace("Analyse de la demande", routeLabel, "route"),
      "Sophenic Brain",
      provider === "sophenic" ? `Auto · ${effortMode}` : `Sélection demandée : ${providerLabel(provider)} / ${model}`,
      "model"
    );
    appendMessage(targetMode, { id: assistantId, role: "assistant", content: "", run: { provider, model, requestedProvider: provider, requestedModel: model }, thinking: initialThinking });
    setSending(true); setError("");
    try {
      const languageConfig = await desktop.runtime.rememberLanguage(prompt).catch(() => null);
      const preferredLanguage = languageConfig?.preferredLanguage;
      const languageDirective = responseLanguageInstruction(preferredLanguage);
      if (preferredLanguage) {
        updateMessage(targetMode, assistantId, (message) => ({ thinking: appendThinkingStep(message.thinking, "Langue conservée", preferredLanguage.toUpperCase(), "status") }));
      }

      const plan = await desktop.runtime.planAgentRoute({ prompt, purpose, provider, model, effortMode });
      let activeProvider = plan.provider as AgentProviderId;
      let activeModel = plan.model;
      const reasoningEffort = plan.reasoningEffort;
      const fallbackQueue = (plan.fallbacks || []).map((candidate) => ({ ...candidate, provider: candidate.provider as AgentProviderId }));
      updateMessage(targetMode, assistantId, (message) => ({
        run: {
          ...(message.run || {}),
          provider: activeProvider,
          model: activeModel,
          requestedProvider: provider,
          requestedModel: model,
          agents: purpose === "code" ? [{ role: "Construction", provider: activeProvider, model: activeModel }] : message.run?.agents
        },
        thinking: appendThinkingStep(
          appendThinkingStep(message.thinking, "Route Brain sélectionnée", `${providerLabel(activeProvider)} / ${activeModel}`, "model"),
          "Niveau de raisonnement",
          `${plan.mode} · ${reasoningEffort} · ${plan.orchestration}`,
          "model"
        )
      }));

      let plannerAdvice = "";
      let plannerProvider = "";
      if (purpose === "code" && plan.orchestration === "deep" && plan.reviewers?.length) {
        try {
          const planner = await desktop.runtime.reviewCode({
            prompt: `Tu es l'architecte/planner indépendant d'une tâche de développement. À partir de la demande ci-dessous, propose un plan d'exécution court, concret et vérifiable. Ne code pas encore. Identifie les points à tester. Pour un produit Web professionnel/commercialisable, exige une vraie architecture, une direction visuelle cohérente, les interactions demandées, responsive mobile/desktop, accessibilité de base, états vide/erreur/chargement utiles et une validation réelle de l'aperçu. Un simple HTML au style navigateur par défaut n'est pas un résultat acceptable sauf demande explicite de l'utilisateur.\n\nDEMANDE :\n${prompt}`,
            candidates: plan.reviewers.map((candidate) => ({ provider: candidate.provider, model: candidate.model }))
          });
          plannerAdvice = planner.content.trim();
          plannerProvider = planner.provider;
          updateMessage(targetMode, assistantId, (current) => ({
            run: { ...(current.run ?? { provider: activeProvider, model: activeModel }), agents: [{ role: "Planification", provider: planner.provider, model: planner.model }, ...(current.run?.agents || [{ role: "Construction", provider: activeProvider, model: activeModel }])] },
            thinking: appendThinkingStep(current.thinking, "Planification indépendante", `${providerLabel(planner.provider)} / ${planner.model}`, "model")
          }));
        } catch {
          // Deep remains usable even if the optional planner is unavailable.
        }
      }

      if (purpose === "pc") {
        const permission = integrations.find((item) => item.id === "computer_use");
        if (!permission?.enabled) throw new Error("Pour agir sur le PC, active d’abord « Contrôle du PC » dans Plugins.");
        if (!permission.connected) {
          setIntegrationBusy("computer_use");
          await desktop.integrations.setupComputerUse();
          await refreshIntegrations();
          setIntegrationBusy("");
          updateMessage(targetMode, assistantId, (message) => ({ thinking: appendThinkingStep(message.thinking, "Computer Use prêt", "Contrôle de l’interface Windows disponible.", "tool") }));
        }
      }

      let activeWorkspace = workspace;
      let activeWorkspaceKind: CodeWorkspaceKind | "" = workspaceKind;
      let activeTargetFile = targetFile;
      if (purpose === "code") {
        const resolved = await resolveCodeWorkspace(displayPrompt ?? prompt);
        activeWorkspace = resolved.workspace;
        activeWorkspaceKind = resolved.kind;
        activeTargetFile = resolved.targetFile || "";
        const workspaceLabel = resolved.kind === "managed" ? "Espace Sophenic autonome" : resolved.kind === "external-file" ? "Fichier utilisateur" : "Projet utilisateur";
        updateMessage(targetMode, assistantId, (message) => ({ thinking: appendThinkingStep(message.thinking, workspaceLabel, activeTargetFile || activeWorkspace, "file") }));
      }

      let codeEngineDirective = "";
      if (purpose === "code") {
        const steps = plan.planSteps?.length ? plan.planSteps : ["Analyser la demande et le workspace", "Implémenter les modifications", "Tester et vérifier", "Finaliser le résultat"];
        setCodePlan(steps, 0);
        const checkpointOriginalPrompt = /REPRISE DE CHECKPOINT SOPHENIC/i.test(prompt) && codeCheckpoint.current?.originalPrompt
          ? codeCheckpoint.current.originalPrompt
          : (displayPrompt ?? prompt);
        persistCheckpoint({ workspace: activeWorkspace, originalPrompt: checkpointOriginalPrompt, planSteps: steps, activeStep: codeCheckpoint.current?.activeStep ?? 0, activeProvider, activeModel, savedAt: Date.now(), reason: "Tâche en cours", workspaceKind: activeWorkspaceKind || "managed", ...(activeTargetFile ? { targetFile: activeTargetFile } : {}) });
        const engines = await desktop.code.engines(false).catch(() => null) as CodeEnginesUI | null;
        if (engines) {
          setCodeEngines(engines);
          const available = [engines.claudeCode.functional ? "Moteur externe désactivé" : "", engines.codex.functional ? "Moteur externe désactivé" : ""].filter(Boolean);
          const unavailable = [!engines.claudeCode.functional ? `moteur externe indisponible${engines.claudeCode.error ? `: ${engines.claudeCode.error}` : ""}` : "", !engines.codex.functional ? `Moteur externe indisponible${engines.codex.error ? `: ${engines.codex.error}` : ""}` : ""].filter(Boolean);
          codeEngineDirective = `MOTEURS CODE EXTERNES TESTÉS EN DIRECT PAR SOPHENIC : ${available.length ? available.join(", ") : "aucun"}. ${unavailable.join(" ")} Si moteur externe est réellement disponible, privilégie le skill claude-code pour une construction substantielle; Le moteur externe peut servir de second builder/reviewer quand il est réellement disponible. IMPORTANT : toute erreur, quota, auth, timeout ou absence de moteurs externes est NON BLOQUANTE. Dans ce cas, continue immédiatement la tâche avec Hermes et ses outils natifs puis le modèle Brain actif. Ne demande jamais à l’utilisateur de réparer Claude/Codex pour terminer la tâche.`;
        } else {
          codeEngineDirective = "moteurs externes n’ont pas pu être vérifiés. Ne tente pas d’en dépendre : continue entièrement avec Hermes et les outils disponibles.";
        }
      }

      const qualityRequested = purpose === "code" && plan.profile?.qualityRequested === true;
      const webProductRequested = purpose === "code" && /\b(site|website|web|dashboard|landing|e-?commerce|saas|skyscanner|frontend|react|next|vue|angular|html|css|ui|ux)\b/i.test(prompt);
      const desktopProductRequested = purpose === "code" && /\b(electron|windows|desktop|win32|wpf|winui|tauri|exe|application windows|app desktop)\b/i.test(prompt);
      const backendRequested = purpose === "code" && /\b(api|backend|serveur|server|express|fastapi|django|flask|spring|nestjs|rest|graphql)\b/i.test(prompt);
      const cliRequested = purpose === "code" && /\b(cli|ligne de commande|command line|script|powershell|bash|cmd|outil console)\b/i.test(prompt);
      const libraryRequested = purpose === "code" && /\b(librairie|library|package|sdk|module|npm package|python package|crate)\b/i.test(prompt);
      const codeResearchDirective = purpose === "code"
        ? `RECHERCHE ET RÉUTILISATION CODE. Tu peux et dois utiliser les outils Web/navigateur/Git/terminal autorisés quand une information actuelle, une documentation, un SDK, une API ou une implémentation existante peut améliorer le résultat. Privilégie la documentation officielle et les dépôts officiels. GitHub peut être utilisé pour consulter des exemples, issues, releases ou scripts. AVANT d'exécuter ou d'intégrer un script trouvé en ligne : lis son contenu, vérifie sa provenance et sa licence, évite tout pipe aveugle du type curl|bash ou irm|iex, épingle une version/commit quand c'est pertinent et n'intègre jamais de secret. Si la recherche Web n'est pas nécessaire, ne perds pas de temps à la faire.${codeResearchLikelyUseful(displayPrompt ?? prompt) ? " Cette demande contient des éléments pour lesquels une vérification documentaire/Web est probablement utile." : " Utilise la recherche seulement si elle apporte une valeur concrète."}`
        : "";
      const workspaceDirective = purpose === "code"
        ? activeWorkspaceKind === "managed"
          ? `ESPACE DE TRAVAIL AUTONOME SOPHENIC : ${activeWorkspace}. Tu es libre de choisir la technologie, l'arborescence et tous les types de fichiers adaptés. Crée le projet directement dans cet espace; ne demande pas à l'utilisateur de préparer un dossier.`
          : activeWorkspaceKind === "external-file"
            ? `FICHIER UTILISATEUR CIBLÉ : ${activeTargetFile}. Inspecte ce fichier et son contexte proche avant modification. Préserve le reste du projet et ne touche aux fichiers adjacents que si c'est nécessaire pour corriger proprement la demande.`
            : `PROJET UTILISATEUR CIBLÉ : ${activeWorkspace}. Inspecte l'architecture existante avant d'écrire; conserve les conventions et ne réinitialise jamais le projet.`
        : "";
      const codeQualityDirective = purpose === "code"
        ? `QUALITY GATE SOPHENIC UNIVERSEL. Une tâche Code n'est jamais terminée parce que du texte ou des fichiers ont simplement été produits. Tu dois vérifier l'état RÉEL du projet et adapter la validation au type de logiciel. ${qualityRequested ? "Le niveau demandé est professionnel/commercialisable : applique une seconde passe de finition stricte et élimine les raccourcis/prototypes." : "Même sans mot-clé 'professionnel', livre une implémentation propre, cohérente et réellement testée."} ${webProductRequested ? "WEB/UI : vérifie design, hiérarchie visuelle, responsive, interactions, erreurs/chargements, clavier/focus et parcours principal avec navigateur/captures si disponibles; aucun style navigateur brut pour une vraie interface produit." : ""} ${desktopProductRequested ? "DESKTOP/WINDOWS : build/lance réellement l'application si possible, inspecte logs/processus, puis utilise Computer Use/vision/captures pour tester les fenêtres, boutons, formulaires et états principaux quand ces outils sont disponibles." : ""} ${backendRequested ? "BACKEND/API : démarre le serveur, teste les endpoints principaux et les erreurs attendues, vérifie codes HTTP, validation des entrées et logs." : ""} ${cliRequested ? "CLI/SCRIPT : exécute au moins un cas nominal et un cas d'erreur/entrée invalide; vérifie codes de sortie et effets fichiers." : ""} ${libraryRequested ? "LIBRAIRIE/PACKAGE : ajoute ou exécute tests unitaires, typecheck/lint pertinents et un exemple d'utilisation minimal vérifié." : ""} Pour tout type de projet : lance les tests/build/lint/typecheck pertinents disponibles, corrige les erreurs avant de finir, vérifie les fonctionnalités demandées une par une et ne prétends jamais avoir testé visuellement ou exécuté quelque chose si aucun outil ne l'a confirmé. Aucun TODO critique, bouton/fonction factice, erreur console évidente ou fonctionnalité centrale non testée ne doit être accepté comme terminé.`
        : "";

      let sessionId = await ensureHermesSession(purpose, activeModel, activeProvider, activeWorkspace);
      sessionToolActivity.current.set(sessionId, 0);
      activeHermesSession.current = sessionId;
      sessionTargets.current.set(sessionId, { mode: targetMode, messageId: assistantId });
      updateMessage(targetMode, assistantId, (message) => ({ thinking: appendThinkingStep(message.thinking, "Hermes connecté", `Session ${sessionId.slice(0, 8) || "active"}`, "tool") }));
      if (targetMode === "code") setDashboardEvents((prev) => [...prev, { id: uid(), label: "Route active", detail: `Sophenic Brain : ${providerLabel(activeProvider)} / ${activeModel}`, status: "running" as const, at: Date.now(), kind: "other" as const }].slice(-80));

      const modeInstruction = route?.intent === "research"
        ? "Mode Sophenic Recherche. Cherche les informations nécessaires avec les outils web autorisés, vérifie les sources et réponds avec un résultat utile. N’effectue aucune action locale non demandée. Ne révèle jamais de chaîne de pensée."
        : purpose === "pc"
          ? "Mode Sophenic action PC. EXÉCUTE réellement l’action demandée avec Computer Use, les plugins natifs ou les intégrations autorisées. Pour WhatsApp, Spotify, Discord et les autres applications Windows, privilégie l’application native et Computer Use. N’utilise jamais Chrome DevTools, CDP, chrome://inspect ou le débogage distant simplement pour ouvrir ou piloter une application native. Pour WhatsApp Web, une ouverture URL normale est préférable à une connexion de débogage. Ne demande pas à l’utilisateur de faire une étape que Sophenic peut exécuter lui-même. Si Windows, Chrome ou un service externe impose réellement une confirmation de sécurité/OAuth, explique uniquement cette confirmation indispensable. Ne prétends jamais avoir effectué une action si aucun outil ne l’a confirmée. Ne révèle jamais de chaîne de pensée."
          : purpose === "code"
            ? "Mode Sophenic Code autonome. Travaille réellement dans l'espace de travail fourni : crée/modifie les fichiers, choisis toi-même l'architecture et les types de fichiers adaptés, utilise terminal, Git, build, tests, navigateur, Web, vision et skills autorisés quand ils sont utiles. Ne te contente jamais d'expliquer comment coder si la demande est exécutable. Ne révèle jamais de chaîne de pensée : montre seulement un plan concis, les fichiers créés/modifiés, les commandes, les recherches utiles, les tests et le résultat. Si tu lances un serveur localhost, indique son URL exacte et vérifie qu'il répond. Pour une application desktop, lance-la et teste l'interface avec les outils Windows disponibles quand c'est possible. N'ouvre JAMAIS Google OAuth, Gmail, Drive, Calendar ou un sélecteur de client OAuth sauf si la demande utilisateur mentionne explicitement un service Google et nécessite réellement cette intégration."
            : "Mode Sophenic Agent. Utilise seulement les outils nécessaires à la demande et autorisés. Exécute l’action quand elle est possible au lieu de décrire à l’utilisateur comment la faire. Ne révèle jamais de chaîne de pensée.";
      const googleExplicitlyRequested = googleAction(prompt);
      const shopifyPcDirective = purpose === "pc" && shopifyStoreCreationAction(prompt)
        ? "ACTION SHOPIFY : l’utilisateur demande la création réelle d’une nouvelle boutique. Utilise le navigateur/Computer Use et l’interface Shopify Dev Dashboard officielle. Ne remplace pas l’action par un tutoriel. Si Shopify exige une connexion, un 2FA, un CAPTCHA ou un consentement protégé, demande uniquement cette intervention indispensable, puis poursuis. Ne déclare la boutique créée qu’après confirmation visible dans l’interface."
        : "";
      const enabledCapabilities = integrations.filter((item) => item.enabled && (purpose !== "code" || item.id !== "google-workspace" || googleExplicitlyRequested)).map((item) => item.toolset || item.name).filter(Boolean);
      const permissionDirective = enabledCapabilities.length
        ? `AUTORISATIONS SOPHENIC DÉJÀ ACCORDÉES : ${enabledCapabilities.join(", ")}. Ne redemande pas l’autorisation produit pour ces capacités. Une confirmation externe réellement imposée par Windows, OAuth ou un service tiers reste distincte.`
        : "Utilise uniquement les capacités disponibles et autorisées dans Sophenic.";
      const turnPrefix = () => `${languageDirective}

${runtimeModelIdentity(activeProvider, activeModel)}

${permissionDirective}

${modeInstruction}

${shopifyPcDirective}

${purpose === "code" ? codeEngineDirective : ""}

${purpose === "code" ? workspaceDirective : ""}

${purpose === "code" ? codeResearchDirective : ""}

${purpose === "code" ? codeQualityDirective : ""}

`;
      let turnText = turnPrefix() + (plannerAdvice ? `PLAN INDÉPENDANT À PRENDRE EN COMPTE (adapte-le à l'état réel du workspace) :\n${plannerAdvice}\n\nDEMANDE UTILISATEUR :\n${prompt}` : prompt);
      const tried = new Set([`${activeProvider}:${activeModel}`]);
      const maxAttempts = Math.max(6, Math.min(18, fallbackQueue.length + 6));
      let identityRecoveries = 0;
      let stallRecoveries = 0;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          await desktop.agent.setReasoningEffort(sessionId, reasoningEffort).catch(() => undefined);
          const baseline = latestAssistantFromHistory(await desktop.agent.rpc("session.history", { session_id: sessionId }).catch(() => null));
          await desktop.agent.rpc("prompt.submit", { session_id: sessionId, text: turnText });
          updateMessage(targetMode, assistantId, (current) => ({ thinking: appendThinkingStep(current.thinking, "Exécution de la tâche", "Suivi des outils et résultats Hermes.", "status") }));
          let mainResult = await pollHermesResponse(sessionId, targetMode, assistantId, baseline);

          // Every Code task gets a verification pass on the REAL workspace.
          // Professional/commercializable requests receive a stricter finish.
          if (purpose === "code" && plan.profile?.verificationRequired) {
            advanceCodePlan("quality");
            const qualityBaseline = latestAssistantFromHistory(await desktop.agent.rpc("session.history", { session_id: sessionId }).catch(() => null));
            updateMessage(targetMode, assistantId, (current) => ({ thinking: appendThinkingStep(current.thinking, "Quality Gate Sophenic", "Validation réelle adaptée au type de logiciel, puis corrections automatiques.", "test") }));
            await desktop.agent.rpc("prompt.submit", {
              session_id: sessionId,
              text: `${turnPrefix()}QUALITY GATE — PASSE DE VALIDATION OBLIGATOIRE. Ne réponds pas encore comme si la tâche était terminée. Inspecte les fichiers réellement créés/modifiés et vérifie les critères de la demande. Choisis les tests adaptés au type de logiciel : Web/UI = lancer et tester le parcours + responsive/console; desktop Windows/Electron = build/lancement + logs + interactions UI avec Computer Use/vision si disponibles; API/backend = démarrer le serveur et tester endpoints/codes d'erreur; CLI/script = cas nominal + erreur/entrée invalide; librairie/package = tests + typecheck/lint + exemple d'utilisation; autre = définis et exécute une preuve de fonctionnement pertinente. ${qualityRequested ? "Le résultat doit en plus atteindre un niveau professionnel/commercialisable : corrige toute finition insuffisante, UX pauvre, raccourci technique ou fonctionnalité factice." : "Corrige toute erreur ou fonctionnalité demandée manquante avant de terminer."} Si une recherche documentaire/Web ou un exemple GitHub officiel est nécessaire pour corriger correctement, utilise les outils autorisés en respectant la règle d'inspection/licence avant réutilisation. Ne prétends jamais avoir testé une interface ou exécuté une commande sans preuve outil.

DEMANDE INITIALE :
${displayPrompt ?? prompt}`
            });
            mainResult = await pollHermesResponse(sessionId, targetMode, assistantId, qualityBaseline);
            updateMessage(targetMode, assistantId, (current) => ({ thinking: appendThinkingStep(current.thinking, "Quality Gate terminé", "Projet exécuté/testé avec la stratégie adaptée puis corrigé avant livraison.", "test") }));
          }

          if (purpose === "code" && plan.orchestration !== "single" && plan.reviewers?.length) {
            advanceCodePlan("review");
            const reviewer = plan.reviewers[0];
            const reviewRequestId = uid();
            updateMessage(targetMode, assistantId, (current) => ({ thinking: appendThinkingStep(current.thinking, "Relecture indépendante", `${providerLabel(reviewer.provider)} / ${reviewer.model}`, "model") }));
            try {
              void reviewRequestId;
              const review = await desktop.runtime.reviewCode({
                prompt: `Tu es le reviewer indépendant d'une tâche de développement. Vérifie strictement le résultat par rapport à la demande, quel que soit le type de logiciel. Ne réponds jamais OK si une fonctionnalité demandée manque, si le builder n'apporte aucune preuve adaptée de build/test/exécution, s'il reste des erreurs évidentes ou si le résultat professionnel demandé est encore un prototype/raccourci. Pour Web, regarde aussi UX/responsive/accessibilité; pour desktop, lancement/UI/logs; pour API, endpoints/erreurs; pour CLI/script, exécutions nominales et invalides; pour librairie, tests/typecheck/exemple. Retourne uniquement une liste courte de défauts concrets et actionnables, ou "OK" si le niveau demandé est réellement atteint.

DEMANDE :
${displayPrompt ?? prompt}

RÉSULTAT DU BUILDER :
${mainResult.slice(0, 14000)}`,
                candidates: (plan.reviewers.some((candidate) => candidate.provider !== plannerProvider) ? plan.reviewers.filter((candidate) => candidate.provider !== plannerProvider) : plan.reviewers).map((candidate) => ({ provider: candidate.provider, model: candidate.model }))
              });
              updateMessage(targetMode, assistantId, (current) => ({
                run: { ...(current.run ?? { provider: activeProvider, model: activeModel }), agents: [...(current.run?.agents || [{ role: "Construction", provider: activeProvider, model: activeModel }]), { role: "Relecture", provider: review.provider, model: review.model }] },
                thinking: appendThinkingStep(current.thinking, "Relecture terminée", `${providerLabel(review.provider)} / ${review.model}`, "model")
              }));
              if (review.content.trim() && !/^ok[.!]?$/i.test(review.content.trim())) {
                const reviewBaseline = latestAssistantFromHistory(await desktop.agent.rpc("session.history", { session_id: sessionId }).catch(() => null));
                await desktop.agent.rpc("prompt.submit", { session_id: sessionId, text: `${turnPrefix()}Un reviewer indépendant a analysé le travail. Inspecte l'état RÉEL du workspace, ne recommence pas ce qui est déjà correct, applique uniquement les corrections pertinentes, puis relance les tests/validation nécessaires.\n\nRETOUR REVIEWER :\n${review.content}` });
                updateMessage(targetMode, assistantId, (current) => ({ thinking: appendThinkingStep(current.thinking, "Corrections après review", "Hermes vérifie et corrige le workspace existant.", "tool") }));
                await pollHermesResponse(sessionId, targetMode, assistantId, reviewBaseline);
              }
            } catch (reviewCause) {
              // A reviewer is advisory: its failure must never destroy a successful build.
              setDashboardEvents((prev) => [...prev, { id: uid(), label: "Relecture IA indisponible", detail: humanError(reviewCause), status: "error" as const, at: Date.now(), kind: "other" as const }].slice(-80));
            }
          }

          updateMessage(targetMode, assistantId, (current) => ({
            run: { ...(current.run || {}), provider: activeProvider, model: activeModel },
            thinking: finishThinkingTrace(current.thinking, "Terminé", "Réponse, actions et vérifications synchronisées.", "status")
          }));
          if (purpose === "code") {
            advanceCodePlan("complete");
            persistCheckpoint(null);
          }
          break;
        } catch (cause) {
          const identityFailure = isHermesIdentityFailure(cause);
          if (purpose === "code" && identityFailure) {
            const reason = humanError(cause);
            const activeCredentialFailure = identityFailureBelongsToActiveProvider(cause, activeProvider);

            // `HTTP 401: User not found` without evidence naming the active
            // provider is treated as a Hermes identity/auxiliary failure, NOT as
            // proof that the Brain-selected API key is bad. Older builds were
            // quarantining healthy Mistral/Groq/etc. keys here.
            if (!activeCredentialFailure && identityRecoveries < 2) {
              identityRecoveries += 1;
              const handoff = await codeHandoff(activeWorkspace, codeCheckpoint.current, activeTargetFile);
              const oldSession = sessionId;
              sessions.current.code = undefined;
              sessionTargets.current.delete(oldSession);
              sessionToolActivity.current.delete(oldSession);
              await desktop.runtime.stopHermes().catch(() => undefined);
              await sleep(250);
              sessionId = await ensureHermesSession(purpose, activeModel, activeProvider, activeWorkspace);
              sessionToolActivity.current.set(sessionId, 0);
              activeHermesSession.current = sessionId;
              sessionTargets.current.set(sessionId, { mode: targetMode, messageId: assistantId });
              if (codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, activeProvider, activeModel, savedAt: Date.now(), reason: "Nettoyage automatique de la session Hermes" });
              updateMessage(targetMode, assistantId, (current) => ({
                // Never expose the transient auxiliary 401 as answer content.
                content: current.content === reason ? "" : current.content,
                thinking: appendThinkingStep(current.thinking, "Session Hermes assainie", `Reconnexion isolée ${identityRecoveries}/2 · route ${providerLabel(activeProvider)} / ${activeModel} conservée.`, "fallback")
              }));
              setDashboardEvents((prev) => [...prev, {
                id: uid(),
                label: "Session Hermes assainie",
                detail: `Incident d’identité interne absorbé; ${providerLabel(activeProvider)} reste la route active.`,
                status: "running" as const,
                at: Date.now(),
                kind: "plan" as const
              }].slice(-80));
              turnText = `${turnPrefix()}La session d’exécution a été recréée dans le profil Hermes isolé de Sophenic, MAIS le builder reste le même. Ne recommence aucune étape déjà réussie. Utilise le handoff ci-dessous comme point de départ, puis vérifie l’état réel des fichiers avant toute modification. N’affiche aucun ancien message 401 dans la réponse finale.

HANDOFF SOPHENIC :
${handoff || "Inspecte le workspace et le checkpoint persistant."}

DEMANDE INITIALE :
${displayPrompt ?? prompt}`;
              continue;
            }

            // Only quarantine/rotate a provider key when the error can actually
            // be attributed to that provider (explicit invalid key, provider
            // name, or OpenRouter's characteristic User-not-found response).
            const keyState = activeCredentialFailure
              ? await desktop.runtime.reportAgentProviderFailure(activeProvider, reason).catch(() => ({ remainingReady: 0, keyCount: 0 }))
              : { remainingReady: 0, keyCount: 0 };
            const previousProvider = activeProvider;
            const previousModel = activeModel;
            const rotatedSameProvider = activeCredentialFailure && keyState.remainingReady > 0;
            const crossProvider = rotatedSameProvider
              ? null
              : fallbackQueue.find((item) => item.provider !== activeProvider && !tried.has(`${item.provider}:${item.model}`));

            if (rotatedSameProvider || crossProvider) {
              const handoff = await codeHandoff(activeWorkspace, codeCheckpoint.current, activeTargetFile);
              if (crossProvider) {
                activeProvider = crossProvider.provider;
                activeModel = crossProvider.model;
                tried.add(`${activeProvider}:${activeModel}`);
              }
              const oldSession = sessionId;
              sessions.current.code = undefined;
              sessionTargets.current.delete(oldSession);
              sessionToolActivity.current.delete(oldSession);
              await desktop.runtime.stopHermes().catch(() => undefined);
              await sleep(250);
              sessionId = await ensureHermesSession(purpose, activeModel, activeProvider, activeWorkspace);
              sessionToolActivity.current.set(sessionId, 0);
              activeHermesSession.current = sessionId;
              sessionTargets.current.set(sessionId, { mode: targetMode, messageId: assistantId });
              if (codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, activeProvider, activeModel, savedAt: Date.now(), reason: rotatedSameProvider ? "Rotation automatique de clé vérifiée" : "Fallback provider après incident Hermes" });
              updateMessage(targetMode, assistantId, (current) => ({
                content: current.content === reason ? "" : current.content,
                run: {
                  ...(current.run || { provider: activeProvider, model: activeModel }),
                  provider: activeProvider,
                  model: activeModel,
                  ...(crossProvider ? { fallback: { fromProvider: previousProvider, fromModel: previousModel, toProvider: activeProvider, toModel: activeModel, reason: activeCredentialFailure ? "Authentification de la route précédente refusée; fallback automatique." : "Incident Hermes persistant; fallback sans invalider la clé précédente." } } : {}),
                  agents: purpose === "code"
                    ? [...(current.run?.agents || []), { role: rotatedSameProvider ? "Construction · clé suivante" : "Construction fallback", provider: activeProvider, model: activeModel }]
                    : current.run?.agents
                },
                thinking: appendThinkingStep(current.thinking, rotatedSameProvider ? "Rotation de clé automatique" : "Fallback provider automatique", rotatedSameProvider
                  ? `${providerLabel(activeProvider)} / ${activeModel} · une autre clé vérifiée est utilisée.`
                  : `${providerLabel(previousProvider)} / ${previousModel} → ${providerLabel(activeProvider)} / ${activeModel}`, "fallback")
              }));
              setDashboardEvents((prev) => [...prev, {
                id: uid(),
                label: rotatedSameProvider ? "Clé IA remplacée" : "Provider IA remplacé",
                detail: rotatedSameProvider
                  ? `La clé explicitement refusée de ${providerLabel(activeProvider)} a été isolée; reprise avec une autre clé vérifiée.`
                  : `${providerLabel(previousProvider)} → ${providerLabel(activeProvider)}. La tâche continue sans invalider arbitrairement les autres clés.`,
                status: "running" as const,
                at: Date.now(),
                kind: "plan" as const
              }].slice(-80));
              turnText = `${turnPrefix()}Sophenic a recréé une route Code saine. Le changement de provider ne crée PAS une nouvelle tâche : tu reprends le même chantier. Lis le handoff, inspecte l’état RÉEL du workspace, conserve tous les fichiers déjà corrects et exécute seulement la prochaine action utile. Ne demande jamais à l’utilisateur de dire « continue » et ne répète pas l’ancien message 401 dans la réponse finale.

HANDOFF SOPHENIC :
${handoff || "Inspecte le workspace et le checkpoint persistant."}

DEMANDE INITIALE :
${displayPrompt ?? prompt}`;
              continue;
            }
          }

          if (purpose === "code" && isHermesProgressStall(cause)) {
            const handoff = await codeHandoff(activeWorkspace, codeCheckpoint.current, activeTargetFile);
            if (stallRecoveries < 3) {
              stallRecoveries += 1;
              const oldSession = sessionId;
              sessions.current.code = undefined;
              sessionTargets.current.delete(oldSession);
              sessionToolActivity.current.delete(oldSession);
              await desktop.runtime.stopHermes().catch(() => undefined);
              await sleep(300);
              sessionId = await ensureHermesSession(purpose, activeModel, activeProvider, activeWorkspace);
              sessionToolActivity.current.set(sessionId, 0);
              activeHermesSession.current = sessionId;
              sessionTargets.current.set(sessionId, { mode: targetMode, messageId: assistantId });
              if (codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, activeProvider, activeModel, savedAt: Date.now(), reason: `Watchdog: reprise ${stallRecoveries}/3 avec le même builder`, progressDigest: handoff });
              updateMessage(targetMode, assistantId, (current) => ({
                thinking: appendThinkingStep(current.thinking, "Watchdog Code · même builder", `${providerLabel(activeProvider)} / ${activeModel} · session Hermes recréée ${stallRecoveries}/3 sans changer de modèle.`, "fallback")
              }));
              setDashboardEvents((prev) => [...prev, {
                id: uid(),
                label: "Watchdog Code · reprise stable",
                detail: `Aucune progression réelle détectée : nouvelle session Hermes, même modèle ${providerLabel(activeProvider)} / ${activeModel}.`,
                status: "running" as const,
                at: Date.now(),
                kind: "plan" as const
              }].slice(-80));
              turnText = `${turnPrefix()}La session Hermes s'est figée mais Sophenic conserve LE MÊME BUILDER pour préserver la continuité. Ne recommence rien. Lis le handoff, vérifie les fichiers réellement présents puis exécute immédiatement la prochaine action utile (fichier, terminal, test ou recherche nécessaire).

HANDOFF SOPHENIC :
${handoff || "Inspecte le workspace et le checkpoint persistant."}

DEMANDE INITIALE :
${displayPrompt ?? prompt}`;
              continue;
            }

            // A model/provider switch is a last resort for a pure stall. Three
            // same-builder recoveries are attempted first so transient Hermes
            // freezes do not cause the project to bounce between AIs.
            const fallback = fallbackQueue.find((item) => item.provider !== activeProvider && !tried.has(`${item.provider}:${item.model}`))
              || fallbackQueue.find((item) => !tried.has(`${item.provider}:${item.model}`));
            if (!fallback) throw cause;
            const previousProvider = activeProvider;
            const previousModel = activeModel;
            tried.add(`${fallback.provider}:${fallback.model}`);
            activeProvider = fallback.provider;
            activeModel = fallback.model;
            stallRecoveries = 0;
            if (codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, activeProvider, activeModel, savedAt: Date.now(), reason: "Fallback après trois reprises du même builder", progressDigest: handoff });
            const oldSession = sessionId;
            sessions.current.code = undefined;
            sessionTargets.current.delete(oldSession);
            sessionToolActivity.current.delete(oldSession);
            await desktop.runtime.stopHermes().catch(() => undefined);
            await sleep(300);
            sessionId = await ensureHermesSession(purpose, activeModel, activeProvider, activeWorkspace);
            sessionToolActivity.current.set(sessionId, 0);
            activeHermesSession.current = sessionId;
            sessionTargets.current.set(sessionId, { mode: targetMode, messageId: assistantId });
            await desktop.agent.setReasoningEffort(sessionId, reasoningEffort).catch(() => undefined);
            updateMessage(targetMode, assistantId, (current) => ({
              run: {
                ...(current.run || { provider: activeProvider, model: activeModel }),
                provider: activeProvider,
                model: activeModel,
                fallback: { fromProvider: previousProvider, fromModel: previousModel, toProvider: activeProvider, toModel: activeModel, reason: "Deux reprises Hermes avec le même builder n'ont produit aucune progression réelle." },
                agents: [...(current.run?.agents || []), { role: "Construction fallback · handoff", provider: activeProvider, model: activeModel }]
              },
              thinking: appendThinkingStep(current.thinking, "Fallback builder · handoff", `${providerLabel(previousProvider)} / ${previousModel} → ${providerLabel(activeProvider)} / ${activeModel} après 2 reprises stables.`, "fallback")
            }));
            setDashboardEvents((prev) => [...prev, {
              id: uid(),
              label: "Builder remplacé en dernier recours",
              detail: `${providerLabel(previousProvider)} / ${previousModel} → ${providerLabel(activeProvider)} / ${activeModel}. Le handoff du workspace est conservé.`,
              status: "running" as const,
              at: Date.now(),
              kind: "plan" as const
            }].slice(-80));
            turnText = `${turnPrefix()}Tu remplaces un builder bloqué, mais tu NE RECOMMENCES PAS la tâche. Le chef de projet est Sophenic et l'état appartient au workspace/checkpoint, pas au modèle précédent. Lis le handoff ci-dessous, inspecte les fichiers, conserve tout ce qui est correct et reprends exactement la prochaine action utile.

HANDOFF SOPHENIC :
${handoff || "Inspecte le workspace et le checkpoint persistant."}

DEMANDE INITIALE :
${displayPrompt ?? prompt}`;
            continue;
          }

          const truncated = isTruncationFailure(cause);
          const unavailable = isModelAvailabilityFailure(cause);
          const toolActivity = sessionToolActivity.current.get(sessionId) || 0;
          const safeToRetry = purpose === "code" ? (truncated || unavailable) : (unavailable && toolActivity === 0);
          if (!safeToRetry || attempt >= maxAttempts - 1) throw cause;
          const fallback = fallbackQueue.find((item) => !tried.has(`${item.provider}:${item.model}`));
          if (!fallback) throw cause;
          const previousProvider = activeProvider;
          const previousModel = activeModel;
          tried.add(`${fallback.provider}:${fallback.model}`);
          activeProvider = fallback.provider;
          activeModel = fallback.model;
          if (purpose === "code" && codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, activeProvider, activeModel, savedAt: Date.now(), reason: "Fallback automatique" });
          const reason = humanError(cause);
          const handoff = purpose === "code" ? await codeHandoff(activeWorkspace, codeCheckpoint.current, activeTargetFile) : "";
          // Provider/auth/model failures may poison a Hermes session itself. Create a
          // fresh session on the next provider and resume from the workspace state.
          if (unavailable) {
            const sessionKey = purpose === "pc" ? "pc" : purpose === "code" ? "code" : "integrations";
            sessions.current[sessionKey] = undefined;
            sessionTargets.current.delete(sessionId);
            sessionId = await ensureHermesSession(purpose, activeModel, activeProvider, activeWorkspace);
            sessionToolActivity.current.set(sessionId, 0);
            activeHermesSession.current = sessionId;
            sessionTargets.current.set(sessionId, { mode: targetMode, messageId: assistantId });
          } else {
            await desktop.agent.switchModel(sessionId, activeModel, activeProvider);
          }
          await desktop.agent.setReasoningEffort(sessionId, reasoningEffort).catch(() => undefined);
          updateMessage(targetMode, assistantId, (current) => ({
            content: current.content,
            run: {
              provider: activeProvider,
              model: activeModel,
              requestedProvider: current.run?.requestedProvider || provider,
              requestedModel: current.run?.requestedModel || model,
              fallback: { fromProvider: previousProvider, fromModel: previousModel, toProvider: activeProvider, toModel: activeModel, reason },
              agents: purpose === "code"
                ? [...(current.run?.agents || []), { role: "Construction fallback", provider: activeProvider, model: activeModel }]
                : current.run?.agents
            },
            thinking: appendThinkingStep(current.thinking, "Fallback Brain", `${providerLabel(previousProvider)} / ${previousModel} → ${providerLabel(activeProvider)} / ${activeModel}`, "fallback")
          }));
          if (targetMode === "code") setDashboardEvents((prev) => [...prev, { id: uid(), label: "Reprise automatique", detail: `Fallback Sophenic Brain : ${providerLabel(previousProvider)} / ${previousModel} → ${providerLabel(activeProvider)} / ${activeModel}.`, status: "running" as const, at: Date.now(), kind: "plan" as const }].slice(-80));
          turnText = truncated
            ? `${turnPrefix()}La génération précédente a été interrompue par une limite de sortie. Tu reprends le même chantier : ne recommence rien, lis le handoff, vérifie les fichiers et continue uniquement l'étape inachevée.\n\nHANDOFF SOPHENIC :\n${handoff || "Inspecte le workspace et le checkpoint persistant."}\n\nDEMANDE INITIALE :\n${displayPrompt ?? prompt}`
            : `${turnPrefix()}Le modèle précédent est réellement devenu indisponible. Tu es un builder de remplacement, pas un nouveau chef de projet : ne recommence rien. Lis le handoff, inspecte l'état réel du workspace, conserve tout travail correct et reprends exactement la prochaine action utile.\n\nHANDOFF SOPHENIC :\n${handoff || "Inspecte le workspace et le checkpoint persistant."}\n\nDEMANDE INITIALE :\n${displayPrompt ?? prompt}`;
        }
      }
    } catch (cause) {
      const message = humanError(cause);
      updateMessage(targetMode, assistantId, (current) => ({
        content: current.content.trim() ? `${current.content}\n\n⚠️ ${message}` : message,
        error: true,
        thinking: finishThinkingTrace(current.thinking, "Interrompu", message, "status")
      }));
      setError(message);
      if (targetMode === "code") {
        setDashboardEvents((prev) => [...prev, { id: uid(), label: "Tour interrompu", detail: message, status: "error" as const, at: Date.now(), kind: "other" as const }].slice(-80));
        if (codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, savedAt: Date.now(), reason: message });
      }
    } finally {
      activeHermesSession.current = "";
      if (purpose === "code") {
        await desktop.runtime.stopHermes().catch(() => undefined);
        sessions.current.code = undefined;
      }
      setSending(false);
      setIntegrationBusy("");
    }
  };

  const sendNativeCodePrompt = async (prompt: string, route?: IntentDecision, displayAttachments?: UserAttachment[]) => {
    const displayedPrompt = displayAttachments?.length ? prompt.split("\n\nPIÈCES JOINTES PAR L'UTILISATEUR")[0] : prompt;
    if (!desktop) return;
    const resolvedWorkspace = await resolveCodeWorkspace(prompt);
    const activeWorkspace = resolvedWorkspace.workspace;
    const assistantId = uid();
    const requestId = uid();
    const initialPrompt = codeCheckpoint.current?.originalPrompt || prompt;
    const redactDeveloperSecrets = (value: string) => value
      .replace(/\bvcp_[A-Za-z0-9_-]{8,}\b/g, "[vercel-token-redacted]")
      .replace(/\bghp_[A-Za-z0-9_-]{8,}\b/g, "[github-token-redacted]")
      .replace(/\bgithub_pat_[A-Za-z0-9_-]{8,}\b/g, "[github-token-redacted]");
    const recentConversation = codeMessages
      .slice(-8)
      .map((message) => `${message.role === "user" ? "UTILISATEUR" : "SOPHENIC"}: ${redactDeveloperSecrets(message.content).slice(0, 3500)}`)
      .join("\n\n")
      .slice(-14_000);
    const enginePrompt = recentConversation
      ? `CONTEXTE RÉCENT DE LA SESSION SOPHENIC CODE (visible par l'utilisateur, à conserver pour les références comme « ce projet », « cette URL », « comme avant ») :\n${recentConversation}\n\nDEMANDE ACTUELLE À EXÉCUTER :\n${prompt}`
      : prompt;

    appendMessage("code", { id: uid(), role: "user", content: displayedPrompt, ...(displayAttachments?.length ? { attachments: displayAttachments } : {}) });
    appendMessage("code", {
      id: assistantId,
      role: "assistant",
      content: "",
      run: { provider: "sophenic", model: "auto", requestedProvider: "sophenic", requestedModel: "auto" },
      thinking: appendThinkingStep(createThinkingTrace("Analyse de la demande", route?.label || "Sophenic Code", "route"), "Sophenic Brain", `Auto · ${effortMode}`, "model")
    });
    currentCodeRequest.current = requestId;
    currentCodeAssistant.current = assistantId;
    setSending(true);
    setError("");
    setResumeAvailable(false);
    setDashboardEvents((prev) => [...prev,
      { id: uid(), label: "🧠 Sophenic Brain", detail: "Analyse complexité, domaine, langage, recherche, tests, coût et qualité.", status: "running" as const, at: Date.now(), kind: "plan" as const },
      { id: uid(), label: "Sophenic Code Engine", detail: `Workspace : ${activeWorkspace} · Hermes non requis`, status: "running" as const, at: Date.now(), kind: "other" as const }
    ].slice(-80));
    try {
      await desktop.runtime.rememberLanguage(prompt).catch(() => null);
      const brain = await desktop.runtime.planAgentRoute({ prompt: enginePrompt, purpose: "code", effortMode });
      setCodePlan(brain.planSteps, 0);
      persistCheckpoint({ workspace: activeWorkspace, originalPrompt: initialPrompt, planSteps: brain.planSteps, activeStep: 0, activeProvider: brain.provider, activeModel: brain.model, savedAt: Date.now(), reason: "Tâche native en cours", workspaceKind: resolvedWorkspace.kind, ...(resolvedWorkspace.targetFile ? { targetFile: resolvedWorkspace.targetFile } : {}) });
      const result = await desktop.code.run({ requestId, cwd: activeWorkspace, prompt: enginePrompt, effortMode });
      if (currentCodeRequest.current !== requestId) return;
      updateMessage("code", assistantId, (message) => ({
        content: result.text,
        run: { provider: result.provider, model: result.model, requestedProvider: "sophenic", requestedModel: "auto" },
        thinking: finishThinkingTrace(message.thinking, "Terminé", `${result.version} · Quality Gate synchronisé.`, "status")
      }));
      advanceCodePlan("complete");
      persistCheckpoint(null);
      setDashboardEvents((prev) => [...prev, { id: uid(), label: "✅ Livré", detail: `Sophenic Code Engine a terminé avec ${result.changedFiles.length} fichier(s) modifié(s).`, status: "done" as const, at: Date.now(), kind: "plan" as const }].slice(-80));
    } catch (cause) {
      if (currentCodeRequest.current !== requestId) return;
      const message = humanError(cause);
      if (codeCheckpoint.current) persistCheckpoint({ ...codeCheckpoint.current, savedAt: Date.now(), reason: message });
      setResumeAvailable(Boolean(codeCheckpoint.current));
      advanceCodePlan("paused");
      updateMessage("code", assistantId, (current) => ({
        content: current.content.trim() ? `${current.content}

⚠️ ${message}` : message,
        error: true,
        thinking: finishThinkingTrace(current.thinking, "Sophenic Code interrompu", `${message} · checkpoint conservé automatiquement.`, "status")
      }));
      setDashboardEvents((prev) => [...prev, { id: uid(), label: "Tâche interrompue", detail: `${message} · le checkpoint est conservé pour reprise.`, status: "error" as const, at: Date.now(), kind: "other" as const }].slice(-80));
      setError(message);
    } finally {
      if (currentCodeRequest.current === requestId) {
        currentCodeRequest.current = "";
        currentCodeAssistant.current = "";
        setSending(false);
      }
    }
  };

  const takeAttachments = (): UserAttachment[] => {
    const taken = attachments.slice(0, ATTACHMENT_MAX_COUNT);
    setAttachments([]);
    if (attachmentInput.current) attachmentInput.current.value = "";
    return taken;
  };
  const readAttachmentFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: UserAttachment[] = [];
    for (const file of Array.from(files).slice(0, ATTACHMENT_MAX_COUNT)) {
      if (file.size > ATTACHMENT_MAX_BYTES) { setError(`« ${file.name} » dépasse 5 Mo et n’a pas été joint.`); continue; }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!dataUrl) { setError(`« ${file.name} » n’a pas pu être lu.`); continue; }
      accepted.push({ id: uid(), name: file.name, mime: file.type || "", size: file.size, dataUrl });
    }
    if (accepted.length) setError("");
    setAttachments((current) => [...current, ...accepted].slice(0, ATTACHMENT_MAX_COUNT));
  };

  const sendChat = async (override?: string, force = false) => {
    if (!desktop || (sending && !force) || boot !== "ready") return;
    const prompt = (override ?? input).trim() || "";
    const outgoingAttachments = override === undefined ? takeAttachments() : [];
    if (!prompt && !outgoingAttachments.length) return;
    if (override === undefined) setInput("");
    if (textArea.current) textArea.current.style.height = "auto";
    if (prompt) await desktop.runtime.rememberLanguage(prompt).catch(() => null);

    // Des pièces jointes (images/fichiers) imposent l'analyse par le modèle :
    // les routeurs deterministes (génération d'image, recherche de lieu…) ne
    // s'appliquent pas à une demande qui porte des fichiers à analyser.
    if (!outgoingAttachments.length && imageGenerationRequest(prompt)) {
      appendMessage("image", { id: uid(), role: "user", content: prompt });
      setMode("image");
      await generateImage(prompt);
      return;
    }

    if (!outgoingAttachments.length && wantsCurrentLocation(prompt)) {
      const permission = integrations.find((item) => item.id === "location");
      if (!permission?.enabled) {
        setError("Active « Localisation » dans Plugins pour autoriser Sophenic à lire ta position Windows uniquement à ta demande.");
        setMode("plugins");
        return;
      }
      appendMessage("chat", { id: uid(), role: "user", content: prompt });
      setSending(true);
      setError("");
      try {
        const location = await currentBrowserLocation();
        appendMessage("chat", {
          id: uid(),
          role: "assistant",
          content: "Voici la localisation fournie par Windows. Elle n’est lue que pour cette demande.",
          location
        });
      } catch (cause) {
        const message = humanError(cause);
        appendMessage("chat", { id: uid(), role: "assistant", content: message, error: true });
        setError(message);
      } finally {
        setSending(false);
      }
      return;
    }

    const directPlaceQuery = placeSearchQuery(prompt);
    if (!outgoingAttachments.length && directPlaceQuery) {
      appendMessage("chat", { id: uid(), role: "user", content: prompt });
      setSending(true); setError("");
      try {
        const places = await desktop.runtime.searchPlaces(directPlaceQuery);
        if (places.length) {
          const featured = places[0];
          const imageQueries = [featured.website || "", featured.name, `${featured.name} ${directPlaceQuery}`, featured.address].filter(Boolean);
          let images: ImageItem[] = [];
          for (const imageQuery of imageQueries) {
            images = await desktop.runtime.searchReferenceImages(imageQuery).catch(() => [] as ImageItem[]);
            if (images.length) break;
          }
          appendMessage("chat", {
            id: uid(),
            role: "assistant",
            content: places.length > 1
              ? `Voici les lieux **vérifiés par le moteur cartographique Sophenic** pour **${directPlaceQuery}**. Le premier est détaillé dans la fiche latérale.`
              : `Voici la fiche **vérifiée par le moteur cartographique Sophenic** pour **${directPlaceQuery}**.`,
            places,
            images,
            run: { provider: "sophenic-tools", model: "OpenStreetMap / Nominatim + Maps" }
          });
        } else {
          appendMessage("chat", {
            id: uid(),
            role: "assistant",
            content: `Je n’ai trouvé aucun établissement suffisamment fiable pour **${directPlaceQuery}** dans le moteur cartographique. Je préfère ne pas inventer de magasin, d’adresse, de téléphone ou d’horaires.`,
            run: { provider: "sophenic-tools", model: "Local Search (no verified result)" }
          });
        }
      } catch (cause) {
        const message = `La recherche cartographique n’a pas pu être vérifiée : ${humanError(cause)}. Aucun lieu n’a été inventé.`;
        appendMessage("chat", { id: uid(), role: "assistant", content: message, error: true });
        setError(message);
      } finally { setSending(false); }
      return;
    }

    if (!outgoingAttachments.length && explicitReferenceImageRequest(prompt)) {
      appendMessage("chat", { id: uid(), role: "user", content: prompt });
      setSending(true); setError("");
      try {
        const query = visualContextQuery(prompt) || prompt;
        const images = await desktop.runtime.searchReferenceImages(query);
        appendMessage("chat", {
          id: uid(),
          role: "assistant",
          content: images.length
            ? `Voici ${images.length} image${images.length > 1 ? "s" : ""} réelle${images.length > 1 ? "s" : ""} trouvée${images.length > 1 ? "s" : ""} pour **${query}**.`
            : `Je n’ai trouvé aucune image de référence vérifiable pour **${query}**. Je préfère ne pas inventer d’URL ou prétendre avoir effectué une recherche qui n’a pas abouti.`,
          images,
          run: { provider: "sophenic-tools", model: images.length ? "Wikimedia Commons" : "Reference Image Search (no verified result)" }
        });
      } catch (cause) {
        const message = `La recherche d’images de référence a échoué : ${humanError(cause)}. Aucune URL n’a été inventée.`;
        appendMessage("chat", { id: uid(), role: "assistant", content: message, error: true });
        setError(message);
      } finally { setSending(false); }
      return;
    }

    // Priority local action router: deterministic Windows/Spotify/filesystem
    // commands are executed before Intent Router, Hermes, Code, or any LLM.
    const directAction = routeAction(prompt);
    if (!outgoingAttachments.length && directAction) {
      setLastRoute({ intent: "agent_pc", label: directAction.label, requiresHermes: false, purpose: "pc", confidence: 1, reason: "Action Router prioritaire" });
      appendMessage("chat", { id: uid(), role: "user", content: prompt });
      setSending(true); setError("");
      try {
        const result = await desktop.runtime.executeAction(directAction);
        appendMessage("chat", { id: uid(), role: "assistant", content: result.message || (result.ok ? "Action Windows exécutée." : "L’action Windows a échoué."), error: !result.ok });
        if (!result.ok) setError(result.message || "L’action Windows a échoué.");
      } catch (cause) {
        const message = humanError(cause);
        appendMessage("chat", { id: uid(), role: "assistant", content: message, error: true });
        setError(message);
      } finally {
        setSending(false);
      }
      return;
    }

    const googleContinuation = !googleAction(prompt) && recentActionContinuation(chatMessages, "google");
    const shopifyContinuation = !shopifyStoreCreationAction(prompt) && recentActionContinuation(chatMessages, "shopify");
    const shopifyBrowserAction = shopifyStoreCreationAction(prompt) || shopifyContinuation;
    const localRoute = (): IntentDecision => {
      if (shopifyBrowserAction) return { intent: "agent_pc", label: "Shopify · création boutique", requiresHermes: true, purpose: "pc", confidence: 0.995, reason: "Création Shopify via interface authentifiée." };
      if (localBuildAction(prompt)) return { intent: "project", label: "Création projet", requiresHermes: false, purpose: "code", confidence: 0.86, reason: "Demande de création détectée localement." };
      if (pcAction(prompt)) return { intent: "agent_pc", label: "Agent PC", requiresHermes: true, purpose: "pc", confidence: 0.86, reason: "Action ordinateur détectée localement." };
      if (googleAction(prompt) || googleContinuation || hermesToolAction(prompt)) return { intent: "research", label: googleContinuation ? "Google Workspace · suite" : "Recherche / outils", requiresHermes: true, purpose: "assistant", confidence: 0.72, reason: "Demande nécessitant un outil détectée localement." };
      return { intent: "chat", label: "Chat", requiresHermes: false, purpose: "assistant", confidence: 0.65, reason: "Conversation générale." };
    };

    let route = await desktop.runtime.routeIntent(prompt).catch(localRoute) as IntentDecision;
    if (shopifyBrowserAction) route = { intent: "agent_pc", label: "Shopify · création boutique", requiresHermes: true, purpose: "pc", confidence: 0.995, reason: shopifyContinuation ? "Suite de la création Shopify en cours." : "Création Shopify via interface authentifiée." };
    if (googleContinuation) route = { intent: "research", label: "Google Workspace · suite", requiresHermes: true, purpose: "assistant", confidence: 0.98, reason: "Suite d’une action Google Workspace en cours." };
    if (placeSearchQuery(prompt)) route = { intent: "chat", label: "Recherche locale", requiresHermes: false, purpose: "assistant", confidence: 1, reason: "Recherche de lieu prise en charge par le moteur de localisation Sophenic." };
    setLastRoute(route);

    const google = googleAction(prompt) || googleContinuation;
    if (google) {
      const permission = integrations.find((item) => item.id === "google-workspace");
      if (!permission?.enabled) { setError("Pour agir sur Gmail/Google Workspace, autorise d’abord Google Workspace dans Plugins."); setMode("plugins"); return; }
      if (!permission.connected) { setError("Google Workspace est autorisé mais pas encore connecté. Clique sur « Connecter Google »."); setMode("plugins"); return; }
    }

    if (route.intent === "agent_pc" && !outgoingAttachments.length) {
      const permission = integrations.find((item) => item.id === "computer_use");
      if (!permission?.enabled) {
        if (permission) setPermissionItem(permission); else setMode("plugins");
        setError("Autorise « Contrôle du PC » une fois, puis Sophenic pourra confier tes actions Windows à Hermes.");
        return;
      }
      const nativeAction = await desktop.runtime.tryNativePcAction(prompt).catch(() => ({ handled: false, message: "" }));
      if (nativeAction.handled) {
        appendMessage("chat", { id: uid(), role: "user", content: prompt || "(pièces jointes)", ...(outgoingAttachments.length ? { attachments: outgoingAttachments } : {}) });
        appendMessage("chat", { id: uid(), role: "assistant", content: nativeAction.message || "Action Windows exécutée." });
        setError("");
        return;
      }
      await sendHermesPrompt("chat", prompt, "pc", selectedModel, selectedProvider, route);
      return;
    }

    if (route.intent === "project" || route.intent === "code") {
      setMode("code");
      await sendNativeCodePrompt(prompt + buildAttachmentContext(outgoingAttachments), route, outgoingAttachments);
      return;
    }

    if (((route.requiresHermes && route.intent !== "research") || google) && !outgoingAttachments.length) {
      await sendHermesPrompt("chat", prompt, "assistant", selectedModel, selectedProvider, route);
      return;
    }

    const userMessage: ChatMessage = { id: uid(), role: "user", content: prompt || "(pièces jointes)", ...(outgoingAttachments.length ? { attachments: outgoingAttachments } : {}) };
    const assistantId = uid();
    const requestId = uid();
    const placeQuery = placeSearchQuery(prompt);
    const referenceImageQuery = visualContextQuery(prompt);
    const placePromise = placeQuery ? desktop.runtime.searchPlaces(placeQuery).catch(() => [] as PlaceItem[]) : Promise.resolve([] as PlaceItem[]);
    const researchPromise = route.intent === "research" ? desktop.runtime.webSearch(prompt, 6).catch(() => [] as Array<{ title: string; url: string; snippet: string }>) : Promise.resolve([] as Array<{ title: string; url: string; snippet: string }>);
    let imagePromise = referenceImageQuery ? desktop.runtime.searchReferenceImages(referenceImageQuery).catch(() => [] as ImageItem[]) : Promise.resolve([] as ImageItem[]);
    const history = [...chatMessages, userMessage];
    currentRequest.current = requestId; currentAssistant.current = assistantId;
    voiceSegmenter.current.reset();
    setError(""); setSending(true);
    const chatThinking = appendThinkingStep(
      appendThinkingStep(createThinkingTrace("Analyse de la demande", route.label || "Chat", "route"), "Contexte chargé", `${history.length} message(s)`, "status"),
      "Routage automatique",
      `Sophenic Brain / ${effortMode}`,
      "model"
    );
    setChatMessages([...history, {
      id: assistantId,
      role: "assistant",
      content: "",
      run: { provider: selectedProvider, model: selectedModel, requestedProvider: selectedProvider, requestedModel: selectedModel },
      thinking: chatThinking
    }]);
    try {
      const [places, researchResults] = await Promise.all([placePromise, researchPromise]);
      if (places.length) {
        const exactPlaceImageQuery = `${places[0].name} ${places[0].address}`;
        imagePromise = desktop.runtime.searchReferenceImages(exactPlaceImageQuery).catch(() => [] as ImageItem[]);
      }
      const modelHistory = history.map((message, index) => {
        // Seul le dernier message utilisateur porte les payloads image/document
        // (la vision porte sur la demande actuelle, pas sur l'historique ancien).
        const isLatest = index === history.length - 1 && message.role === "user";
        const messageAttachments = isLatest ? outgoingAttachments : [];
        const images = messageAttachments.filter(attachmentIsImage).map((attachment) => attachment.dataUrl);
        const files = messageAttachments.filter((attachment) => !attachmentIsImage(attachment) && !attachmentIsTextual(attachment)).map((attachment) => ({ name: attachment.name, mime: attachment.mime, dataUrl: attachment.dataUrl }));
        const textFiles = messageAttachments.filter(attachmentIsTextual);
        const attachmentNote = [...message.attachments?.map((attachment) => `[pièce jointe précédente : ${attachment.name}]`) || [], ...textFiles.map((attachment) => `FICHIER JOINT « ${attachment.name} » (${attachment.mime || "texte"}, ${(attachment.size / 1024).toFixed(1)} Ko) :\n${decodeAttachmentText(attachment)}`)].join("\n\n");
        const content = attachmentNote ? `${message.content}\n\n${attachmentNote}` : message.content;
        return { role: message.role, content, ...(images.length ? { images } : {}), ...(files.length ? { files } : {}) };
      });
      if (places.length) {
        const grounded = places.slice(0, 5).map((item, index) => `${index + 1}. ${item.name} — ${item.address}${item.phone ? ` — ${item.phone}` : ""}${item.website ? ` — ${item.website}` : ""}`).join("\n");
        modelHistory[modelHistory.length - 1] = { role: "user", content: `${prompt}\n\nRÉSULTATS DE LOCALISATION RÉELS FOURNIS PAR L'OUTIL SOPHENIC :\n${grounded}\n\nUtilise ces résultats pour répondre. N'invente pas une adresse absente des résultats.` };
      }
      if (referenceImageQuery) {
        modelHistory[modelHistory.length - 1] = { role: "user", content: `${modelHistory[modelHistory.length - 1].content}\n\nSOPHENIC gère lui-même les images de référence. Ne prétends pas effectuer une recherche Web et n'invente aucune URL d'image.` };
      }
      const result = await desktop.openrouter.chat({
        requestId,
        provider: selectedProvider,
        model: selectedModel,
        effortMode,
        messages: modelHistory
      });
      if (currentRequest.current !== requestId) return;
      const parsed = parseMachineQuestion(result.content);
      const [referenceImages, resolvedPlaces] = await Promise.all([imagePromise, placePromise]);
      const mergedImages = [...(result.images || []), ...referenceImages].filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 5);
      updateMessage("chat", assistantId, (current) => ({
        content: parsed.content,
        question: parsed.question,
        images: mergedImages,
        places: resolvedPlaces,
        thinking: current.thinking?.active ? finishThinkingTrace(current.thinking, "Réponse prête", "Flux terminé.", "status") : current.thinking,
        run: {
          provider: result.provider || current.run?.provider || selectedProvider,
          model: result.model || current.run?.model || selectedModel,
          requestedProvider: result.requestedProvider || current.run?.requestedProvider || selectedProvider,
          requestedModel: result.requestedModel || current.run?.requestedModel || selectedModel,
          fallback: result.fallback ? {
            fromProvider: result.fallback.fromProvider,
            fromModel: result.fallback.fromModel,
            toProvider: result.fallback.toProvider,
            toModel: result.fallback.toModel,
            reason: result.fallback.reason
          } : current.run?.fallback,
          agents: result.agents?.length ? result.agents : current.run?.agents
        }
      }));
      setUsage({
        contextUsed: result.usage.promptTokens,
        contextMax: result.contextMax,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.costUsd
      });
      if (voiceModeOpen) {
        const remainingVoice = voiceSegmenter.current.flush();
        streamedVoiceMessages.current.add(assistantId);
        if (remainingVoice && !/SOPHENIC_QUESTION/i.test(remainingVoice)) voiceModeRef.current?.queueSpeech(remainingVoice, prompt);
        voiceModeRef.current?.finishResponse();
      }
    } catch (cause) {
      if (currentRequest.current === requestId) {
        const message = humanError(cause);
        updateMessage("chat", assistantId, (current) => ({
          content: current.content.trim() ? `${current.content}\n\n⚠️ ${message}` : message,
          error: true,
          thinking: finishThinkingTrace(current.thinking, "Erreur modèle", message, "status")
        }));
        setError(message);
        if (voiceModeOpen) voiceModeRef.current?.notifyError(message);
      }
    } finally {
      const completedCurrentTurn = currentRequest.current === requestId;
      if (completedCurrentTurn) { currentRequest.current = ""; currentAssistant.current = ""; setSending(false); }
      if (voiceModeOpen && completedCurrentTurn) voiceModeRef.current?.finishResponse();
    }
  };

  const sendCode = async (override?: string) => {
    if (sending) return;
    const rawPrompt = (override ?? input).trim();
    const outgoingAttachments = override === undefined ? takeAttachments() : [];
    if (!rawPrompt && !outgoingAttachments.length) return;
    const userPrompt = rawPrompt || "(analyse les pièces jointes)";
    if (override === undefined) setInput("");

    const resumeRequested = /^(?:continue|continue ton travail|continue ton travaille|reprends|reprend|reprise|poursuis|poursuit)(?:\s|[.!?])*$/i.test(normalize(userPrompt));
    const checkpoint = resumeRequested ? codeCheckpoint.current : null;
    let effectivePrompt = userPrompt + buildAttachmentContext(outgoingAttachments);
    if (checkpoint) {
      if (checkpoint.workspace) setWorkspace(checkpoint.workspace);
      if (checkpoint.workspaceKind) setWorkspaceKind(checkpoint.workspaceKind);
      setTargetFile(checkpoint.targetFile || "");
      setCodePlan(checkpoint.planSteps, Math.min(checkpoint.activeStep ?? 0, Math.max(0, checkpoint.planSteps.length - 1)));
      effectivePrompt = `REPRISE DE CHECKPOINT SOPHENIC. Ne recommence pas le projet. Inspecte l'état réel du workspace et reprends exactement à l'étape inachevée. Conserve tous les fichiers corrects et vérifie avant d'écraser quoi que ce soit.\n\nDEMANDE INITIALE :\n${checkpoint.originalPrompt}\n\nÉTAPE MÉMORISÉE : ${checkpoint.activeStep !== undefined ? checkpoint.activeStep + 1 : "inconnue"}/${checkpoint.planSteps.length}\nRAISON DU CHECKPOINT : ${checkpoint.reason || "reprise utilisateur"}`;
    }

    const route: IntentDecision = { intent: "code", label: checkpoint ? "Reprise Sophenic Code" : "Sophenic Code", requiresHermes: false, purpose: "code", confidence: 1, reason: checkpoint ? "Reprise du checkpoint persistant." : "Mode Code sélectionné explicitement." };
    setLastRoute(route);
    await sendNativeCodePrompt(effectivePrompt, route, checkpoint ? undefined : outgoingAttachments);
  };

  const generateImage = async (originalPrompt: string, style?: string, format?: string) => {
    if (!desktop) return;
    if (!imageAvailable) {
      try {
        const engines = await desktop.openrouter.imageModels(false);
        if (!engines?.length) {
          setError("Aucun moteur de génération d’image n’est disponible. Sophenic Brain n’a trouvé aucune ressource image configurée.");
          return;
        }
        setImageAvailable(true);
      } catch {
        setError("Aucun moteur de génération d’image n’est disponible. Sophenic Brain n’a trouvé aucune ressource image configurée.");
        return;
      }
    }
    const assistantId = uid();
    const imageThinking = appendThinkingStep(createThinkingTrace("Préparation de l’image", "Sophenic Image", "route"), "Routage Sophenic Brain", "Sélection automatique du moteur d’image.", "model");
    appendMessage("image", { id: assistantId, role: "assistant", content: "", thinking: imageThinking });
    setSending(true); setError("");
    const ratio = format === "Paysage" ? "16:9" : format === "Portrait" ? "9:16" : format === "Carré" ? "1:1" : undefined;
    const customFormat = format && !["Paysage", "Portrait", "Carré", "Automatique"].includes(format) ? `Format souhaité : ${format}.` : "";
    const finalPrompt = [originalPrompt, style ? `Style souhaité : ${style}.` : "", customFormat].filter(Boolean).join("\n");
    try {
      const result = await desktop.openrouter.generateImage({ requestId: uid(), prompt: finalPrompt, aspectRatio: ratio, quality: "auto" });
      updateMessage("image", assistantId, (current) => ({ content: `Image créée avec ${compactModel(result.model)}.`, images: result.images, run: { provider: result.provider || "openrouter", model: result.model, requestedProvider: "sophenic", requestedModel: "auto" }, thinking: finishThinkingTrace(current.thinking, "Image prête", `${result.images.length} résultat(s) reçu(s).`, "status") }));
    } catch (cause) { const message = humanError(cause); updateMessage("image", assistantId, (current) => ({ content: message, error: true, thinking: finishThinkingTrace(current.thinking, "Génération interrompue", message, "status") })); setError(message); }
    finally { setSending(false); }
  };

  const sendImage = async () => {
    if (sending) return;
    const rawPrompt = input.trim();
    const outgoingAttachments = takeAttachments();
    if (!rawPrompt && !outgoingAttachments.length) return;
    const referenceNote = outgoingAttachments.length ? `\n\n(Références visuelles jointes par l'utilisateur : ${outgoingAttachments.map((attachment) => attachment.name).join(", ")} — inspires-ti de leur style/sujet.)` : "";
    const prompt = rawPrompt || "Crée une image inspirée des références visuelles jointes.";
    await desktop?.runtime.rememberLanguage(prompt).catch(() => null);
    setInput(""); appendMessage("image", { id: uid(), role: "user", content: prompt, ...(outgoingAttachments.length ? { attachments: outgoingAttachments } : {}) });
    if (prompt.split(/\s+/).length < 7) {
      setPendingImage({ originalPrompt: prompt + referenceNote });
      appendMessage("image", { id: uid(), role: "assistant", content: "Je peux préciser le rendu avant de générer.", question: { index: 1, total: 2, question: "Quel style veux-tu ?", options: ["Photo réaliste", "Illustration", "3D", "Anime"], allowOther: true, kind: "image-style" } });
      return;
    }
    await generateImage(prompt + referenceNote);
  };

  const answerQuestion = async (message: ChatMessage, answer: string) => {
    if (!message.question || !desktop) return;
    const question = message.question;
    const targetMode: "chat" | "code" | "image" = mode === "code" ? "code" : mode === "image" ? "image" : "chat";
    updateMessage(targetMode, message.id, { question: undefined });
    if (question.kind === "image-style" && pendingImage) {
      appendMessage("image", { id: uid(), role: "user", content: answer });
      setPendingImage({ ...pendingImage, style: answer });
      appendMessage("image", { id: uid(), role: "assistant", content: "Parfait. Dernier choix avant la génération.", question: { index: 2, total: 2, question: "Quel format veux-tu ?", options: ["Carré", "Paysage", "Portrait", "Automatique"], allowOther: true, kind: "image-format" } });
      return;
    }
    if (question.kind === "image-format" && pendingImage) {
      appendMessage("image", { id: uid(), role: "user", content: answer });
      const current = pendingImage; setPendingImage(null); await generateImage(current.originalPrompt, current.style, answer); return;
    }
    if (question.kind === "hermes" && question.requestId) {
      appendMessage(targetMode, { id: uid(), role: "user", content: answer });
      try {
        await desktop.agent.respondClarify(question.requestId, answer);
        interactiveRequests.current.delete(question.requestId);
      } catch (cause) { setError(humanError(cause)); }
      return;
    }
    if (targetMode === "chat") await sendChat(answer); else if (targetMode === "code") await sendCode(answer);
  };

  const stop = async () => {
    if (!desktop) return;
    if (currentRequest.current) {
      const id = currentRequest.current; currentRequest.current = ""; currentAssistant.current = "";
      await desktop.openrouter.abort(id).catch(() => false);
    }
    if (currentCodeRequest.current) {
      const codeId = currentCodeRequest.current;
      currentCodeRequest.current = "";
      currentCodeAssistant.current = "";
      await desktop.code.abort(codeId).catch(() => false);
    }
    if (activeHermesSession.current) await desktop.agent.rpc("session.interrupt", { session_id: activeHermesSession.current }).catch(() => undefined);
    setSending(false);
  };

  const newSession = async () => {
    if (sending) await stop();
    const targetMode: "chat" | "code" | "image" = mode === "code" || mode === "image" ? mode : "chat";
    const messages = targetMode === "chat" ? chatMessages : targetMode === "code" ? codeMessages : imageMessages;
    if (messages.length) await saveConversationSnapshot(targetMode, messages);
    localConversationIds.current[targetMode] = uid();
    setInput(""); setError(""); setUsage({}); setMode(targetMode);
    if (targetMode === "chat") { setChatMessages([]); sessions.current.pc = undefined; sessions.current.integrations = undefined; }
    if (targetMode === "code") { setCodeMessages([]); setDashboardEvents([]); setWorkspace(""); setWorkspaceKind(""); setTargetFile(""); sessions.current.code = undefined; persistCheckpoint(null); }
    if (targetMode === "image") { setImageMessages([]); setPendingImage(null); }
  };


  const savePersonalization = async (value: string) => {
    if (!desktop) return;
    await desktop.runtime.setPersonalization(value); setPersonalizationState(value.trim());
  };

  const confirmPermission = async () => {
    if (!desktop || !permissionItem) return;
    const item = permissionItem; setPermissionItem(null); setIntegrationBusy(item.id);
    try {
      setIntegrations(await desktop.integrations.setPermission(item.id, true, item.scopes) as IntegrationPermission[]);
      if (item.id === "computer_use") {
        await desktop.integrations.setupComputerUse();
        await refreshIntegrations();
      }
    } catch (cause) { setError(humanError(cause)); }
    finally { setIntegrationBusy(""); }
  };

  const toggleIntegration = async (item: IntegrationPermission) => {
    if (!desktop) return;
    if (!item.enabled) { setPermissionItem(item); return; }
    setIntegrationBusy(item.id);
    try { setIntegrations(await desktop.integrations.setPermission(item.id, false, item.scopes) as IntegrationPermission[]); }
    catch (cause) { setError(humanError(cause)); }
    finally { setIntegrationBusy(""); }
  };

  const setupComputer = async () => {
    if (!desktop) return; setIntegrationBusy("computer_use");
    try { await desktop.integrations.setupComputerUse(); await refreshIntegrations(); } catch (cause) { setError(humanError(cause)); } finally { setIntegrationBusy(""); }
  };

  const connectGoogle = async () => {
    if (!desktop) return; setIntegrationBusy("google-workspace");
    try {
      const google = integrations.find((item) => item.id === "google-workspace");
      if (!google?.enabled) setIntegrations(await desktop.integrations.setPermission("google-workspace", true, google?.scopes) as IntegrationPermission[]);
      const result = await desktop.integrations.startGoogleOAuth();
      if (!result.canceled) { setGoogleRedirect(""); setGoogleRedirectOpen(true); }
    } catch (cause) { setError(humanError(cause)); }
    finally { setIntegrationBusy(""); }
  };

  const finishGoogle = async () => {
    if (!desktop || !googleRedirect.trim()) return;
    setIntegrationBusy("google-workspace");
    try { await desktop.integrations.finishGoogleOAuth(googleRedirect.trim()); setGoogleRedirectOpen(false); await refreshIntegrations(); }
    catch (cause) { setError(humanError(cause)); }
    finally { setIntegrationBusy(""); }
  };

  const respondApproval = async (choice: "once" | "session" | "deny") => {
    if (!desktop || !approval) return;
    const current = approval; setApproval(null);
    try {
      await desktop.agent.respondApproval(current.requestId, choice);
      interactiveRequests.current.delete(current.requestId);
    } catch (cause) { setError(humanError(cause)); }
  };

  const respondCredential = async (value: string) => {
    if (!desktop || !credentialRequest) return;
    const current = credentialRequest; setCredentialRequest(null);
    try {
      if (current.kind === "sudo") await desktop.agent.respondSudo(current.requestId, value);
      else await desktop.agent.respondSecret(current.requestId, value);
      interactiveRequests.current.delete(current.requestId);
    } catch (cause) { setError(humanError(cause)); }
  };

  const cancelCredential = async () => {
    if (!desktop || !credentialRequest) return;
    const current = credentialRequest; setCredentialRequest(null);
    try {
      // Resolve the pending Hermes request explicitly. An empty credential is a
      // deterministic cancellation and avoids leaving the worker blocked.
      if (current.kind === "sudo") await desktop.agent.respondSudo(current.requestId, "");
      else await desktop.agent.respondSecret(current.requestId, "");
      interactiveRequests.current.delete(current.requestId);
    } catch (cause) { setError(humanError(cause)); }
  };

  if (boot !== "ready") return <SetupScreen state={boot} error={bootError} onRetry={() => void bootApp()} localModels={[]} onUseOllama={async () => {}} />;

  const modeIcon = mode === "code" ? <Code2 className="size-4 text-[#b17c31]" /> : mode === "image" ? <ImageIcon className="size-4 text-[#b17c31]" /> : mode === "design" ? <PenTool className="size-4 text-[#b17c31]" /> : mode === "plugins" ? <Plug className="size-4 text-[#b17c31]" /> : mode === "history" ? <Archive className="size-4 text-[#b17c31]" /> : mode === "planner" ? <CalendarDays className="size-4 text-[#b17c31]" /> : mode === "library" ? <FolderOpen className="size-4 text-[#b17c31]" /> : mode === "settings" ? <Settings2 className="size-4 text-[#b17c31]" /> : <Sparkles className="size-4 text-[#b17c31]" />;
  const composerVisible = mode === "chat" || mode === "code" || mode === "image";
  const latestPlaceMessage = mode === "chat" ? [...chatMessages].reverse().find((message) => message.role === "assistant" && Boolean(message.places?.length)) : undefined;
  const placePanelVisible = Boolean(latestPlaceMessage?.places?.length);

  return <div className="flex h-screen overflow-hidden bg-[#fffdf8] text-zinc-900 dark:bg-[#201d19] dark:text-zinc-100">
    <aside className={cn("relative shrink-0 overflow-hidden border-r border-[#e7d8be] bg-[#fbf4e8] transition-[width] duration-200 dark:border-white/[0.05] dark:bg-[#181613]", sidebarOpen ? "w-[270px]" : "w-0")}><div className="flex h-full w-[270px] flex-col p-3"><div className="flex items-center justify-between px-1 py-1">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/sophenic-logo.png" alt="Sophenic" className="h-8 w-[108px] rounded-lg object-cover object-center" /><button type="button" onClick={() => setSidebarOpen(false)} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-[#efe2ce]"><PanelLeftClose className="size-4" /></button></div>
      <button type="button" onClick={() => void newSession()} className="mt-3 flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-[#efe2ce]/80 dark:hover:bg-white/[0.06]"><MessageSquarePlus className="size-4 text-[#9a7138]" /><span>Nouvelle session</span></button>
      <nav className="mt-4 space-y-1">
        <button onClick={() => setMode("chat")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "chat" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><MessageSquare className="size-4 text-[#9a7138]" />Chat</button>
        <button onClick={() => setMode("code")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "code" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><Code2 className="size-4 text-[#9a7138]" />Code</button>
        <button onClick={() => setMode("image")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "image" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><ImageIcon className="size-4 text-[#9a7138]" />Image</button>
        <button onClick={() => setMode("design")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "design" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><PenTool className="size-4 text-[#9a7138]" />Design</button>
        <button onClick={() => setMode("history")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "history" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><Archive className="size-4 text-[#9a7138]" />Historique</button>
        <button onClick={() => setMode("library")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "library" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><FolderOpen className="size-4 text-[#9a7138]" />Bibliothèque</button>
        <button onClick={() => setMode("planner")} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "planner" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><CalendarDays className="size-4 text-[#9a7138]" />Planification</button>
        <button onClick={() => { setMode("plugins"); void refreshDeveloperConnections(); void refreshIntegrations(); }} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "plugins" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><Plug className="size-4 text-[#9a7138]" />Plugins</button>
        <button onClick={() => { setMode("settings"); void refreshIntegrations(); }} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm", mode === "settings" ? "bg-[#efe3d1] text-[#5d4b34] dark:bg-white/[0.07] dark:text-zinc-100" : "hover:bg-[#efe2ce]/70")}><Settings2 className="size-4 text-[#9a7138]" />Paramètres</button>
      </nav>
      <div className="mt-6 px-2 text-[11px] font-medium text-[#a48b68]">Session actuelle</div><div className="mt-1 rounded-xl bg-[#f4ead9]/70 px-2.5 py-2 text-sm text-[#5d4b34] dark:bg-white/[0.04] dark:text-zinc-200"><div className="truncate">{conversationTitle}</div>{mode === "code" && workspace && <div className="mt-1 truncate text-[10px] text-zinc-400">{workspace}</div>}</div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {(["chat", "code", "image"] as const).map((historyMode) => {
          const meta = historyMode === "chat" ? { label: "Chat", icon: MessageSquare } : historyMode === "code" ? { label: "Code", icon: Code2 } : { label: "Image", icon: ImageIcon };
          const Icon = meta.icon;
          const rows = sidebarHistory.filter((item) => item.mode === historyMode);
          const visibleRows = historyExpanded[historyMode] ? rows : rows.slice(0, 3);
          return <div key={historyMode} className="mb-3"><button type="button" onClick={() => setHistoryExpanded((current) => ({ ...current, [historyMode]: !current[historyMode] }))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#7b6547] hover:bg-[#efe2ce]/70 dark:text-zinc-300"><Icon className="size-3.5 text-emerald-700" /><span>{meta.label}</span><span className="text-[9px] font-normal text-zinc-400">{rows.length}</span><span className="ml-auto">{historyExpanded[historyMode] ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</span></button><div className="mt-0.5 space-y-0.5">{visibleRows.map((item) => <button key={item.id} type="button" onClick={() => openStoredConversation(item)} className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[11px] text-zinc-500 hover:bg-[#efe2ce]/70 hover:text-[#5d4b34] dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200" title={item.title}>{item.title}</button>)}{!rows.length && <div className="px-2.5 py-1 text-[10px] text-zinc-400">Aucune conversation</div>}</div></div>;
        })}
      </div>
      <div className="mt-auto space-y-1 border-t border-[#e4d3b7] pt-2 dark:border-white/[0.06]"><button type="button" onClick={() => setMode("plugins")} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-[#efe2ce]/80"><Plug className="size-4 text-[#9a7138]" />Plugins & comptes</button><button type="button" onClick={() => { setMode("settings"); void refreshIntegrations(); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-[#efe2ce]/80"><Settings2 className="size-4 text-[#9a7138]" />Paramètres</button></div>
    </div></aside>

    <main className="relative flex min-w-0 flex-1 flex-col"><header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#efe3d0]/70 px-3 sm:px-4 dark:border-white/[0.04]">{!sidebarOpen && <button type="button" onClick={() => setSidebarOpen(true)} className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-[#f4ead9]"><PanelLeftOpen className="size-5" /></button>}<div className="min-w-0 flex-1"><div className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold">{modeIcon}{titleForMode(mode)}</div></div>{mode === "code" && <div className="hidden items-center gap-1 rounded-xl border border-[#e3d2b5] bg-[#fbf5ea] p-1 md:flex dark:border-white/10 dark:bg-white/[0.04]"><span className="px-1.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">Plugins</span><button type="button" disabled={developerConnectionBusy === "github"} onClick={() => void connectDeveloperProvider("github")} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-[#654a29] hover:bg-white dark:text-zinc-200 dark:hover:bg-white/[0.07]" title={githubDeveloperConnection?.connected ? `GitHub connecté${githubDeveloperConnection.username ? ` : ${githubDeveloperConnection.username}` : ""}. Cliquer pour réautoriser.` : "Connecter GitHub à SOPHENIC via l’autorisation officielle GitHub"}>{developerConnectionBusy === "github" ? <Loader2 className="size-3 animate-spin" /> : <Github className="size-3.5" />}<span>GitHub</span><span className={cn("size-1.5 rounded-full", githubDeveloperConnection?.connected ? "bg-emerald-500" : "bg-zinc-300")} /></button><button type="button" disabled={developerConnectionBusy === "vercel"} onClick={() => { if (vercelDeveloperConnection?.connected) void openDeveloperPortal("vercel", "dashboard"); else setMode("plugins"); }} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-[#654a29] hover:bg-white dark:text-zinc-200 dark:hover:bg-white/[0.07]" title={vercelDeveloperConnection?.connected ? `Vercel connecté${vercelDeveloperConnection.username ? ` : ${vercelDeveloperConnection.username}` : ""}. Cliquer pour ouvrir Vercel.` : "Connecter Vercel via l’autorisation officielle dans Plugins"}>{developerConnectionBusy === "vercel" ? <Loader2 className="size-3 animate-spin" /> : <Triangle className="size-3.5" />}<span>Vercel</span><span className={cn("size-1.5 rounded-full", vercelDeveloperConnection?.connected ? "bg-emerald-500" : "bg-zinc-300")} /></button></div>} <div title={mode === "chat" && !modelValid ? modelValidationError : "Sophenic Brain choisit automatiquement le provider, le modèle, la clé et les fallbacks."} className={cn("hidden max-w-[46vw] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold md:flex", mode === "chat" && !modelValid ? "border-red-200 bg-red-50 text-red-700" : "border-[#decbaa] bg-[#f8efdf] text-[#71532d] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300")}><span>Sophenic Brain</span><span className="opacity-40">•</span><span className="truncate font-mono">Auto</span>{mode === "chat" && !modelValid && <span>⚠</span>}</div>{lastRoute && mode !== "plugins" && <div className="hidden rounded-full bg-[#f3e7d4] px-2.5 py-1 text-[10px] font-semibold text-[#795827] lg:block">Route : {lastRoute.label}</div>}{mode === "chat" && <ContextUsage usage={usage} />}<Button variant="ghost" size="sm" onClick={() => setMode("plugins")} className="gap-2 rounded-lg text-[#735735]"><Plug className="size-4" /><span className="hidden lg:inline">Plugins</span></Button><Button variant="ghost" size="sm" onClick={() => { setMode("settings"); void refreshIntegrations(); }} className="gap-2 rounded-lg text-[#735735]"><Settings2 className="size-4" /><span className="hidden lg:inline">Paramètres</span></Button></header>

      {mode === "design" ? <DesignWorkspace effortMode={effortMode} />
      : mode === "plugins" ? <PluginCenter onGoogleConnect={() => void connectGoogle()} googleBusy={integrationBusy === "google-workspace"} onChanged={() => { void refreshDeveloperConnections(); void refreshIntegrations(); }} />
      : mode === "settings" ? <SettingsCenter integrations={integrations} busyId={integrationBusy} onToggle={(item) => void toggleIntegration(item)} onSetupComputer={() => void setupComputer()} onOpenHermes={() => void desktop?.integrations.openHermesDashboard().catch((cause) => setError(humanError(cause)))} onRefresh={() => void refreshIntegrations()} onOpenPersonalization={() => setPersonalizationOpen(true)} />
      : mode === "history" ? <HistoryCenter onOpen={(record) => openStoredConversation(record as unknown as StoredConversationRecord)} />
      : mode === "library" ? <LibraryCenter />
      : mode === "planner" ? <PlannerCenter />
      : <div className="flex min-h-0 flex-1"><section className="min-h-0 min-w-0 flex-1 overflow-y-auto"><div className={cn("mx-auto w-full px-4 pb-44 pt-5 sm:px-6", mode === "code" ? "max-w-4xl" : "max-w-3xl", !currentMessages.length && "flex min-h-full items-center justify-center pb-28")}>{!currentMessages.length ? <div className="mb-14 w-full text-center">{mode === "code" ? <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-[#f2e2c7] text-[#7e5a29]"><Code2 className="size-9" /></div> : mode === "image" ? <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-[#f2e2c7] text-[#7e5a29]"><WandSparkles className="size-9" /></div> : <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/sophenic-logo.png" alt="Sophenic Artificial Intelligence" className="mx-auto w-[320px] max-w-[82vw] rounded-[28px] shadow-[0_18px_60px_rgba(116,83,34,.08)]" /></>}<h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#403425] sm:text-3xl dark:text-zinc-100">{mode === "code" ? "Que veux-tu construire ?" : mode === "image" ? "Quelle image veux-tu créer ?" : "Comment puis-je t’aider ?"}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">{mode === "code" ? `Sophenic Code crée automatiquement son propre espace de projet, choisit le meilleur modèle via Sophenic Brain, puis utilise directement fichiers, terminal, Docker, Playwright, Web/GitHub, Vercel, tests et QA. Hermes reste optionnel et n’est jamais requis pour coder.` : mode === "image" ? imageAvailable ? "Sophenic Brain utilise automatiquement le meilleur moteur d’image disponible. Aucun modèle n’est à sélectionner manuellement." : "Chargement des capacités de génération d’image…" : `Sophenic Brain est actif en mode ${effortMode === "quick" ? "Rapide" : effortMode === "deep" ? "Deep" : "Auto"}. Il choisit automatiquement le meilleur fournisseur, modèle, clé et fallback disponibles.`}</p>{mode === "code" && resumeAvailable ? <Button type="button" className="mt-4 bg-[#5f4a2e] text-white" onClick={() => void sendCode("reprends")}><RefreshCw className="size-4" />Reprendre la tâche</Button> : null}</div> : <div className="space-y-8 py-4">{currentMessages.map((message) => <motion.article initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>{message.role === "user" ? <div className="max-w-[82%] rounded-3xl bg-[#f1e2c8] px-4 py-2.5 text-[15px] leading-6 text-[#4e3f2c] shadow-sm dark:bg-[#40382f] dark:text-zinc-100">{message.attachments?.length ? <div className="mb-2 flex flex-wrap gap-1.5">{message.attachments.map((attachment) => attachment.dataUrl && attachmentIsImage(attachment) ? <span key={attachment.id} className="relative"><img src={attachment.dataUrl} alt={attachment.name} className="size-16 rounded-xl border border-black/10 object-cover" /><span className="absolute inset-x-0 bottom-0 truncate rounded-b-xl bg-black/45 px-1 text-[7px] text-white">{attachment.name}</span></span> : <span key={attachment.id} className="flex items-center gap-1 rounded-lg bg-black/[.05] px-2 py-1 text-[9px] font-medium text-[#6b5637] dark:bg-white/10 dark:text-zinc-300"><FileText className="size-3" />{attachment.name}</span>)}</div> : null}<div className="whitespace-pre-wrap">{message.content}</div></div> : <AssistantMessage message={message} onAnswer={(answer) => void answerQuestion(message, answer)} />}</motion.article>)}{sending && <div className="flex items-center gap-1.5 py-2 text-[#b08a55]"><span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:-.3s]" /><span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:-.15s]" /><span className="size-1.5 animate-pulse rounded-full bg-current" /></div>}<div ref={endRef} /></div>}</div></section>{mode === "code" && <CodeDashboard events={dashboardEvents} messages={codeMessages} />}{mode === "chat" && latestPlaceMessage?.places?.length ? <aside className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-[#e6d8c2] bg-[#fbf7ef] p-4 xl:block dark:border-white/[0.06] dark:bg-[#171512]"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-[#9a7138]" />Lieu</div><PlaceResults items={latestPlaceMessage.places} images={latestPlaceMessage.images || []} /></aside> : null}</div>}

      {composerVisible && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#fffdf8] via-[#fffdf8]/95 to-transparent px-3 pb-3 pt-12 dark:from-[#201d19] dark:via-[#201d19]/95 sm:px-6"><div className={cn("pointer-events-auto mx-auto", mode === "code" ? "max-w-4xl xl:mr-[406px]" : placePanelVisible ? "max-w-3xl xl:mr-[420px]" : "max-w-3xl")}>{error && <div className="mb-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"><span className="flex-1">{error}</span><button type="button" onClick={() => setError("")}><X className="size-3.5" /></button></div>}<div className="rounded-[26px] border border-[#d9c39e] bg-white/95 p-2 shadow-[0_8px_36px_rgba(112,79,30,.12)] backdrop-blur dark:border-white/[0.08] dark:bg-[#302b25]/95">{attachments.length ? <div className="mb-1.5 flex flex-wrap gap-1.5 px-1 pt-1">{attachments.map((attachment) => <span key={attachment.id} className="group relative">{attachment.dataUrl && attachmentIsImage(attachment) ? <span className="relative block"><img src={attachment.dataUrl} alt={attachment.name} className="size-14 rounded-xl border border-black/10 object-cover" /><span className="absolute inset-x-0 bottom-0 truncate rounded-b-xl bg-black/45 px-1 text-[7px] text-white">{attachment.name}</span></span> : <span className="flex h-14 max-w-44 items-center gap-1.5 rounded-xl border border-[#e1d0b5] bg-[#faf5ec] px-2 text-[9px] font-medium text-[#6b5637] dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300"><FileText className="size-3.5 shrink-0" /><span className="truncate">{attachment.name}</span></span>}<button type="button" onClick={() => setAttachments((current) => current.filter((row) => row.id !== attachment.id))} className="absolute -right-1.5 -top-1.5 grid size-4.5 place-items-center rounded-full bg-[#5f4a2e] text-white opacity-0 transition group-hover:opacity-100" title="Retirer"><X className="size-2.5" /></button></span>)}</div> : null}<textarea ref={textArea} value={input} onChange={(event) => { setInput(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (mode === "chat") void sendChat(); else if (mode === "code") void sendCode(); else void sendImage(); } }} placeholder={mode === "code" ? "Décris ce que tu veux coder…" : mode === "image" ? "Décris l’image à créer…" : "Pose une question ou demande une action sur le PC…"} rows={1} className="max-h-[180px] min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 outline-none placeholder:text-zinc-400" /><div className="flex items-center gap-1 px-1 pb-1">{<><div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e1d0b5] bg-[#faf5ec] px-2.5 text-[11px] font-semibold text-[#735735] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"><Sparkles className="size-3.5" /><span>Sophenic Brain</span><span className="opacity-40">•</span><span className="font-mono">Auto</span></div>{mode !== "image" && <EffortSelector value={effortMode} onChange={setEffortMode} disabled={sending} />}</>}{mode === "code" && <><div className="ml-1 hidden h-9 items-center gap-1.5 rounded-xl bg-[#faf5ec] px-2 text-[10px] text-[#735735] sm:flex dark:bg-white/[0.04]" title={targetFile || workspace || "Sophenic créera automatiquement son propre espace de travail"}><FolderOpen className="size-3.5" /><span>{workspace ? workspaceKind === "managed" ? "Espace Sophenic" : workspaceKind === "external-file" ? "Fichier ciblé" : "Projet ciblé" : "Espace auto"}</span></div><button type="button" onClick={async () => { const chosen = await desktop?.runtime.chooseCodeFile(); if (chosen) { setWorkspace(chosen.workspace); setWorkspaceKind(chosen.kind); setTargetFile(chosen.targetFile || ""); sessions.current.code = undefined; } }} className="flex h-9 items-center rounded-xl px-2 text-[11px] text-[#735735] hover:bg-[#f7ecd9]" title="Sélectionner un fichier existant à corriger/modifier"><Code2 className="mr-1 size-3.5" /><span className="hidden lg:inline">Fichier</span></button><button type="button" onClick={async () => { const chosen = await desktop?.runtime.chooseWorkspace(); if (chosen) { setWorkspace(chosen.workspace); setWorkspaceKind(chosen.kind); setTargetFile(""); sessions.current.code = undefined; } }} className="flex h-9 items-center rounded-xl px-2 text-[11px] text-[#735735] hover:bg-[#f7ecd9]" title="Sélectionner un projet/dossier existant"><FolderOpen className="mr-1 size-3.5" /><span className="hidden lg:inline">Projet</span></button><div className="relative"><button type="button" onClick={() => { const rows = listCodeHandoffs(); setDesignHandoffs(rows); setDesignPickerOpen((open) => !open); }} className="flex h-9 items-center rounded-xl px-2 text-[11px] text-[#735735] hover:bg-[#f7ecd9]" title="Sélectionner un design SOPHENIC (Web Design Engine) pour générer le site"><Palette className="mr-1 size-3.5" /><span className="hidden lg:inline">Design</span></button>{designPickerOpen && (designHandoffs.length ? <div className="absolute bottom-11 left-0 z-50 w-[420px] rounded-2xl border border-[#d9c39e] bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#26221d]"><div className="px-1.5 pb-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-[#9a7447]">Designs SOPHENIC — sélectionne puis choisis ta stack (React · Next.js · Shopify · WordPress · HTML/CSS)</div><div className="max-h-72 overflow-auto">{designHandoffs.map((row) => <button key={row.id} type="button" onClick={() => { setInput(row.implementationBrief); setDesignPickerOpen(false); textArea.current?.focus(); }} className="mb-1 w-full rounded-xl border border-black/[.06] p-2 text-left hover:border-[#c6a477] dark:border-white/[.08]"><div className="text-[11px] font-semibold">{row.name} — {row.blueprint.brand}</div><div className="text-[9px] text-zinc-500">{row.blueprint.industry} · design {row.blueprint.mode}{row.blueprint.templateName ? ` « ${row.blueprint.templateName} »` : ""}{row.blueprint.quality ? ` · ${row.blueprint.quality.scores.overall}/100` : ""} · {new Date(row.createdAt).toLocaleDateString("fr-FR")}</div></button>)}</div></div> : <div className="absolute bottom-11 left-0 z-50 w-[320px] rounded-2xl border border-[#d9c39e] bg-white p-3 text-[10px] leading-4 text-zinc-500 shadow-2xl dark:border-white/10 dark:bg-[#26221d]">Aucun design enregistré. Crée un design dans <span className="font-semibold">Design → Web Design</span>, puis « Envoyer vers SOPHENIC Code ».</div>)}</div>{workspace && <button type="button" onClick={() => void desktop?.runtime.openCodeWorkspace(workspace, targetFile || undefined).catch((cause) => setError(humanError(cause)))} className="flex h-9 items-center rounded-xl px-2 text-[11px] text-[#735735] hover:bg-[#f7ecd9]" title="Ouvrir l’espace de travail dans l’Explorateur Windows"><ExternalLink className="mr-1 size-3.5" /><span className="hidden xl:inline">Ouvrir</span></button>}</>}<input ref={attachmentInput} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv,.tsv,.yaml,.yml,.toml,.log,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.kt,.go,.rs,.c,.h,.cpp,.cs,.php,.rb,.swift,.sql,.sh,.ps1,.bat,.lua,.vue,.svelte,.docx,.doc,.xls,.xlsx,.pptx" className="hidden" onChange={(event) => { void readAttachmentFiles(event.target.files); }} /><button type="button" onClick={() => attachmentInput.current?.click()} disabled={sending || attachments.length >= ATTACHMENT_MAX_COUNT} className="flex h-9 items-center gap-1 rounded-xl px-2 text-[11px] text-[#735735] hover:bg-[#f7ecd9] disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/10" title="Joindre des images ou fichiers (analyse par Sophenic)"><Paperclip className="size-3.5" /><span className="hidden lg:inline">Joindre</span></button><div className="flex-1" />{mode === "chat" && <button type="button" onClick={async () => {
        let current = voiceSettings || await refreshVoiceSettings();
        if (current && !current.enabled && desktop?.workspace) {
          current = await desktop.workspace.voiceSave({ ...current, enabled: true }) as VoiceSettings;
          setVoiceSettings(current);
        }
        setVoiceModeOpen(true);
      }} className={cn("grid size-9 place-items-center rounded-full transition", voiceModeOpen ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/20")} title="Démarrer une conversation vocale" aria-label="Démarrer une conversation vocale"><Mic className="size-4" /></button>}{sending ? <button type="button" onClick={() => void stop()} className="grid size-9 place-items-center rounded-full bg-[#5f4a2e] text-white" title="Arrêter"><CircleStop className="size-4" /></button> : <button type="button" onClick={() => { if (mode === "chat") void sendChat(); else if (mode === "code") void sendCode(); else void sendImage(); }} disabled={(!input.trim() && !attachments.length) || (mode === "image" && !imageAvailable)} className="grid size-9 place-items-center rounded-full bg-[#5f4a2e] text-white disabled:bg-[#e7dbc8] disabled:text-[#a89578]" title="Envoyer"><Send className="size-4" /></button>}</div></div><div className="mt-2 text-center text-[10px] text-zinc-400">{mode === "code" ? "Sophenic Code crée son propre espace par défaut; Fichier/Projet sert uniquement à modifier un élément existant. Recherche Web, Git, terminal, tests et handoff restent sous le même chef de projet." : mode === "image" ? "Sophenic choisit automatiquement le moteur d’image disponible ; aucun choix de modèle n’est exposé." : "Sophenic Brain choisit seul le provider, le modèle, la clé et les fallbacks. Rapide / Auto / Deep règle uniquement l’effort demandé."}</div></div></div>}
    </main>

    <AnimatePresence>{voiceModeOpen && desktop?.voice && voiceSettings && <VoiceMode
      ref={voiceModeRef}
      bridge={desktop.voice}
      settings={voiceSettings}
      onTranscript={async (transcript: VoiceTranscript) => {
        if (sending) await stop();
        await sendChat(transcript.text, true);
      }}
      onInterrupt={async () => { if (sending) await stop(); }}
      onClose={() => setVoiceModeOpen(false)}
    />}</AnimatePresence>

    <AnimatePresence>{plannerNotice && <motion.div initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="fixed bottom-5 right-5 z-[140] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-emerald-900/40 dark:bg-[#24211d]/95"><div className="flex items-start gap-3"><div className={cn("grid size-10 shrink-0 place-items-center rounded-full", plannerNotice.ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300")}>{plannerNotice.ok ? <Check className="size-5" /> : <X className="size-5" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-emerald-700 dark:text-emerald-300"><Bell className="size-3.5" />SOPHENIC</div><div className="mt-1 font-semibold">{plannerNotice.message}</div><div className="mt-1 text-xs text-zinc-500">{plannerNotice.title}</div>{plannerNotice.detail ? <div className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{plannerNotice.detail}</div> : null}</div><button type="button" onClick={() => setPlannerNotice(null)} className="text-zinc-400 hover:text-zinc-700"><X className="size-4" /></button></div></motion.div>}</AnimatePresence>

    <AnimatePresence>{personalizationOpen && <PersonalizationModal open initial={personalization} onClose={() => setPersonalizationOpen(false)} onSave={savePersonalization} />}</AnimatePresence>
    <AnimatePresence>{approval && <ApprovalModal request={approval} onChoice={(choice) => void respondApproval(choice)} />}</AnimatePresence>
    <AnimatePresence>{credentialRequest && <CredentialModal request={credentialRequest} onSubmit={(value) => void respondCredential(value)} onCancel={() => void cancelCredential()} />}</AnimatePresence>
    <AnimatePresence>{permissionItem && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[115] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-[#d8c29b] bg-[#fffdf8] p-6 shadow-2xl dark:border-white/10 dark:bg-[#24211d]"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-full bg-[#f2e2c7] text-[#795827]"><ShieldCheck className="size-5" /></div><div><h2 className="font-semibold">Autoriser {permissionItem.name} ?</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Tu autorises Sophenic à demander à Hermes d’utiliser cette capacité quand tu le demandes explicitement.</p></div></div><div className="mt-4 rounded-2xl bg-black/[0.035] p-4 text-sm leading-6 dark:bg-black/20">{permissionItem.description}{permissionItem.scopes?.length ? <div className="mt-2 text-xs text-zinc-500">Accès concerné : {permissionItem.scopes.join(", ")}.</div> : null}{permissionItem.id === "google-workspace" && <div className="mt-2 text-xs font-medium text-amber-700">Cette autorisation ne connecte pas encore ton compte Google : l’écran OAuth Google sera demandé séparément.</div>}</div><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPermissionItem(null)}>Annuler</Button><Button className="bg-[#5f4a2e] text-white" onClick={() => void confirmPermission()}><ShieldCheck className="size-4" />Autoriser</Button></div></div></motion.div>}</AnimatePresence>
    <AnimatePresence>{googleRedirectOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[116] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-[#d8c29b] bg-[#fffdf8] p-6 shadow-2xl dark:border-white/10 dark:bg-[#24211d]"><h2 className="font-semibold">Terminer la connexion Google</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Après avoir accepté dans Google, le navigateur peut afficher une page localhost qui ne charge pas. Copie l’URL complète de cette page et colle-la ici.</p><Input className="mt-4" value={googleRedirect} onChange={(event) => setGoogleRedirect(event.target.value)} placeholder="http://localhost:…/?code=…" /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setGoogleRedirectOpen(false)}>Annuler</Button><Button disabled={!googleRedirect.trim() || integrationBusy === "google-workspace"} onClick={() => void finishGoogle()}>{integrationBusy === "google-workspace" && <Loader2 className="size-4 animate-spin" />}Valider</Button></div></div></motion.div>}</AnimatePresence>
  </div>;
}
