"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, Bell, BookOpen, Box, CalendarDays, Check, ChevronDown, ChevronRight, Circle,
  Cloud, Code2, Database, ExternalLink, FileImage, FileText, Github, HardDrive,
  Image as ImageIcon, Loader2, Mail, MemoryStick, MessageSquare, Mic2, NotebookTabs,
  Plug, Plus, RefreshCw, Search, Settings2, ShoppingBag, Sparkles, Trash2, TrainFront, Triangle,
  UserRound, Volume2, Workflow
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VoiceSettings } from "@voice/types";

type IntegrationPermission = {
  id: string; name: string; description: string; category: string; kind: "capability" | "skill" | "plugin";
  enabled: boolean; connected?: boolean; requiresSetup?: boolean; source?: string; toolset?: string; scopes?: string[];
};
type PluginDefinition = { id: string; name: string; category: "Development" | "Productivity" | "Business" | "Data"; description: string; auth: "github-device" | "oauth" | "database"; portalUrl: string };
type PluginStatus = { id: string; configured: boolean; verified: boolean; connected: boolean; account?: string; detail?: string };
type ConversationRecord = { id: string; title: string; mode: "chat" | "code" | "image"; createdAt: string; updatedAt: string; messages: Array<Record<string, unknown> & { role: "user" | "assistant"; content: string }>; workspace?: string };
type MemoryEntry = { id: string; text: string; source: string; pinned: boolean; createdAt: string; updatedAt: string };
type MemoryState = { enabled: boolean; maxEntries: number; entries: MemoryEntry[] };
type PlannerTask = { id: string; title: string; prompt: string; notes?: string; status: "scheduled" | "running" | "done" | "failed"; recurrence: "once" | "daily"; scheduledFor: string; enabled: boolean; lastRunAt?: string; lastResult?: string; lastError?: string; createdAt: string; updatedAt: string };
type LibraryEntry = { id: string; name: string; kind: "image" | "file" | "project" | "export"; path?: string; url?: string; source?: string; createdAt: string };

const categoryMeta = {
  Development: { icon: Workflow, label: "Development" },
  Productivity: { icon: Mail, label: "Productivity" },
  Business: { icon: ShoppingBag, label: "Business" },
  Data: { icon: Database, label: "Data" }
} as const;

const VOICE_LANGUAGES = [
  ["auto", "Automatique"], ["ar", "Arabe"], ["bn", "Bengali"], ["my", "Birman"], ["ca", "Catalan"], ["zh", "Chinois mandarin"],
  ["hr", "Croate"], ["cs", "Tchèque"], ["da", "Danois"], ["nl", "Néerlandais"], ["en", "Anglais"], ["fi", "Finnois"],
  ["fr", "Français"], ["de", "Allemand"], ["el", "Grec"], ["he", "Hébreu"], ["hi", "Hindi"], ["hu", "Hongrois"],
  ["id", "Indonésien"], ["it", "Italien"], ["ja", "Japonais"], ["km", "Khmer"], ["ko", "Coréen"], ["lo", "Lao"],
  ["ms", "Malais"], ["no", "Norvégien"], ["fa", "Persan"], ["pl", "Polonais"], ["pt", "Portugais"], ["ro", "Roumain"],
  ["ru", "Russe"], ["sk", "Slovaque"], ["es", "Espagnol"], ["sw", "Swahili"], ["sv", "Suédois"], ["tl", "Tagalog"],
  ["ta", "Tamoul"], ["te", "Télougou"], ["th", "Thaï"], ["tr", "Turc"], ["uk", "Ukrainien"], ["ur", "Ourdou"], ["vi", "Vietnamien"]
] as const;

function pluginIcon(id: string) {
  if (id === "github") return Github; if (id === "vercel") return Triangle; if (id === "gmail") return Mail;
  if (id === "calendar") return CalendarDays; if (id === "google-drive") return HardDrive; if (id === "cloudflare") return Cloud;
  if (id === "notion") return NotebookTabs; if (id === "shopify") return ShoppingBag; if (id === "wordpress") return Workflow;
  return Database;
}

export function PluginCenter({ onGoogleConnect, googleBusy, onChanged }: { onGoogleConnect: () => void; googleBusy?: boolean; onChanged?: () => void }) {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  const [catalog, setCatalog] = useState<PluginDefinition[]>([]);
  const [statuses, setStatuses] = useState<PluginStatus[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [databaseTarget, setDatabaseTarget] = useState<PluginDefinition | null>(null);
  const [databaseUri, setDatabaseUri] = useState("");
  const [tokenTarget, setTokenTarget] = useState<PluginDefinition | null>(null);
  const [tokenValue, setTokenValue] = useState("");

  const refresh = useCallback(async () => {
    if (!desktop?.plugins) return;
    const [items, states] = await Promise.all([desktop.plugins.catalog(), desktop.plugins.status()]);
    setCatalog(items as PluginDefinition[]); setStatuses(states as PluginStatus[]);
  }, [desktop]);
  useEffect(() => { void refresh(); }, [refresh]);
  const statusMap = useMemo(() => new Map(statuses.map((item) => [item.id, item])), [statuses]);

  const connect = async (plugin: PluginDefinition) => {
    if (!desktop?.plugins) return;
    setBusy(plugin.id); setMessage("");
    try {
      if (plugin.auth === "database") {
        setDatabaseTarget(plugin);
        setDatabaseUri("");
        setBusy("");
        return;
      }
      if (plugin.id === "vercel") {
        // Vercel : connexion par token personnel (vcp_…) — jamais d'OAuth silencieux.
        setTokenTarget(plugin);
        setTokenValue("");
        setBusy("");
        return;
      }
      const options: { shopDomain?: string; connectionString?: string } = {};
      if (plugin.id === "shopify") {
        const value = window.prompt("Domaine de ta boutique Shopify", "ma-boutique.myshopify.com");
        if (!value?.trim()) { setBusy(""); return; }
        options.shopDomain = value.trim();
      }
      const result = await desktop.plugins.connect(plugin.id, options);
      await refresh(); onChanged?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const submitDatabase = async () => {
    if (!desktop?.plugins || !databaseTarget) return;
    const target = databaseTarget;
    const connectionString = databaseUri.trim();
    if (!connectionString) { setMessage(`Indique l’URL de connexion ${target.name}.`); return; }
    setBusy(target.id); setMessage("");
    try {
      const result = await desktop.plugins.connect(target.id, { connectionString });
      setMessage(result?.detail || `${target.name} enregistré dans le coffre sécurisé.`);
      setDatabaseUri("");
      setDatabaseTarget(null);
      await refresh(); onChanged?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };

  const submitToken = async () => {
    if (!desktop?.developerConnections?.saveToken || !tokenTarget) return;
    const target = tokenTarget;
    const token = tokenValue.trim();
    if (!token) { setMessage(`Colle d’abord le token ${target.name}.`); return; }
    setBusy(target.id); setMessage("");
    try {
      const result = await desktop.developerConnections.saveToken("vercel", token);
      const connection = result.connections.find((item) => item.provider === "vercel");
      setMessage(connection?.connected ? `Vercel connecté${connection.username ? ` : ${connection.username}` : ""}. Token validé et chiffré dans le coffre.` : "Vercel n’a pas confirmé ce token.");
      setTokenValue("");
      setTokenTarget(null);
      await refresh(); onChanged?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };

  const disconnect = async (plugin: PluginDefinition) => {
    if (!desktop?.plugins) return;
    setBusy(plugin.id); setMessage("");
    try { await desktop.plugins.disconnect(plugin.id); await refresh(); onChanged?.(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };

  return <div className="h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
    {tokenTarget && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#e7d8be] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center gap-2 text-sm font-semibold"><Triangle className="size-4" />Connecter {tokenTarget.name} par token</div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">Vercel se connecte avec un <b>token personnel</b> (pas d’écran d’autorisation). Étape 1 : ouvre la page des tokens Vercel. Étape 2 : crée un token (il commence par <b>vcp_</b>). Étape 3 : colle-le ci-dessous — il est validé par l’API Vercel puis chiffré dans le coffre natif, jamais enregistré dans le code ni les projets.</p>
        <div className="mt-3"><Button size="sm" variant="outline" onClick={() => { if (desktop?.developerConnections?.openPortal) void desktop.developerConnections.openPortal("vercel", "token"); else window.open("https://vercel.com/account/tokens", "_blank", "noopener,noreferrer"); }}><ExternalLink className="size-3.5" />Ouvrir Vercel → Account → Tokens</Button></div>
        <Input
          className="mt-3 font-mono text-xs"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={tokenValue}
          onChange={(event) => setTokenValue(event.target.value)}
          placeholder="vcp_…"
          onKeyDown={(event) => { if (event.key === "Enter" && tokenValue.trim() && busy !== tokenTarget.id) void submitToken(); }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setTokenTarget(null); setTokenValue(""); }}>Annuler</Button>
          <Button disabled={!tokenValue.trim() || busy === tokenTarget.id} onClick={() => void submitToken()}>{busy === tokenTarget.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Enregistrer & tester</Button>
        </div>
      </div>
    </div>}
    {databaseTarget && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#e7d8be] bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4" />Connecter {databaseTarget.name}</div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">Colle l’URI de connexion de <b>ton propre compte</b>. Elle est envoyée directement au processus Electron puis chiffrée avec le coffre natif du système. Elle n’est pas enregistrée dans le code SOPHENIC.</p>
        <Input
          className="mt-4 font-mono text-xs"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={databaseUri}
          onChange={(event) => setDatabaseUri(event.target.value)}
          placeholder={databaseTarget.id === "postgresql" ? "postgresql://user:password@host:5432/database" : databaseTarget.id === "mysql" ? "mysql://user:password@host:3306/database" : "mongodb+srv://user:password@cluster/database"}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setDatabaseTarget(null); setDatabaseUri(""); }}>Annuler</Button>
          <Button disabled={!databaseUri.trim() || busy === databaseTarget.id} onClick={() => void submitDatabase()}>{busy === databaseTarget.id ? <Loader2 className="size-4 animate-spin" /> : null}Connecter</Button>
        </div>
      </div>
    </div>}
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700"><Plug className="size-4" />Plugins</div><h1 className="mt-2 text-2xl font-semibold">Connecter des applications</h1><p className="mt-1 text-sm text-zinc-500">Comme dans ChatGPT : clique sur <b>Connecter</b>, ton navigateur ouvre le service officiel, puis tu autorises SOPHENIC et reviens automatiquement dans l’application.</p></div><Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw className="size-4" /></Button></div>
      {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">{message}</div>}
      {(Object.keys(categoryMeta) as Array<keyof typeof categoryMeta>).map((category) => {
        const MetaIcon = categoryMeta[category].icon;
        return <section key={category}><div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-zinc-500"><MetaIcon className="size-4" />{categoryMeta[category].label}</div><div className="overflow-hidden rounded-2xl border border-[#e7d8be] bg-white dark:border-white/10 dark:bg-white/[0.025]">
          {catalog.filter((item) => item.category === category).map((plugin, index, rows) => {
            const status = statusMap.get(plugin.id); const Icon = pluginIcon(plugin.id); const connected = Boolean(status?.connected);
            return <div key={plugin.id} className={cn("flex items-center gap-4 px-4 py-3.5", index < rows.length - 1 && "border-b border-[#efe5d5] dark:border-white/[0.06]")}> 
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#eadcc7] bg-[#fffdf8] text-[#6f5430] dark:border-white/10 dark:bg-white/[0.04]"><Icon className="size-5" /></div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="font-semibold">{plugin.name}</div>{connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-500" />Connecté</span>}</div><p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{status?.account ? `Compte : ${status.account}` : plugin.description}</p>{!connected && status?.detail && <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-400">{status.detail}</p>}</div>
              {connected ? <Button size="sm" variant="outline" disabled={busy === plugin.id} onClick={() => void disconnect(plugin)}>{busy === plugin.id ? <Loader2 className="size-4 animate-spin" /> : null}Déconnecter</Button> : <Button size="sm" disabled={busy === plugin.id} onClick={() => void connect(plugin)}>{busy === plugin.id ? <Loader2 className="size-4 animate-spin" /> : null}Connecter</Button>}
            </div>;
          })}
        </div></section>;
      })}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-200"><b>Connexion sécurisée.</b> Aucun secret, Client Secret ou clé API n’est demandé dans cette page. Les connexions compatibles passent par l’écran d’autorisation officiel du fournisseur et les jetons reçus restent dans le coffre local chiffré de SOPHENIC.</div>
    </div>
  </div>;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!value)} className={cn("relative h-6 w-11 rounded-full transition", value ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700")}><span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-all", value ? "left-6" : "left-1")} /></button>;
}

export function SettingsCenter({ integrations, busyId, onToggle, onSetupComputer, onOpenHermes, onRefresh, onOpenPersonalization }: { integrations: IntegrationPermission[]; busyId: string; onToggle: (item: IntegrationPermission) => void; onSetupComputer: () => void; onOpenHermes: () => void; onRefresh: () => void; onOpenPersonalization: () => void }) {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  const [memory, setMemory] = useState<MemoryState | null>(null); const [newMemory, setNewMemory] = useState("");
  const [voice, setVoice] = useState<VoiceSettings | null>(null); const [voiceMessage, setVoiceMessage] = useState("");
  const [sketchfabToken, setSketchfabToken] = useState("");
  const [sketchfabStatus, setSketchfabStatus] = useState<{ configured: boolean; verified: boolean; account?: string; detail?: string }>({ configured: false, verified: false });
  const [sketchfabBusy, setSketchfabBusy] = useState(false);
  const [railwayToken, setRailwayToken] = useState("");
  const [railwayStatus, setRailwayStatus] = useState<{ configured: boolean; verified: boolean; account?: string; projects?: string[]; detail?: string }>({ configured: false, verified: false });
  const [railwayBusy, setRailwayBusy] = useState(false);
  const refresh = useCallback(async () => { if (!desktop?.workspace) return; const [m, v] = await Promise.all([desktop.workspace.memoryGet(), desktop.workspace.voiceGet()]); setMemory(m as MemoryState); setVoice(v as VoiceSettings); }, [desktop]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!desktop?.design?.assetStatus) return; void desktop.design.assetStatus(false).then((result) => setSketchfabStatus(result.sketchfab)).catch(() => undefined); }, [desktop]);
  useEffect(() => { if (!desktop?.railway?.status) return; void desktop.railway.status(false).then(setRailwayStatus).catch(() => undefined); }, [desktop]);
  const saveVoice = async (patch: Partial<VoiceSettings>) => { if (!desktop?.workspace || !voice) return; const next = await desktop.workspace.voiceSave({ ...voice, ...patch }); setVoice(next as VoiceSettings); };
  const testVoice = async () => {
    if (!voice || !desktop?.voice) return;
    setVoiceMessage("Test du moteur local…");
    const sample = voice.language === "en" ? "Hello, I am SOPHENIC. Native voice mode is ready." : voice.language === "es" ? "Hola, soy SOPHENIC. El modo de voz nativo está listo." : "Bonjour, je suis SOPHENIC. Le mode vocal natif est prêt.";
    try {
      const health = await desktop.voice.health();
      if (!health.ready || !health.local) throw new Error("Le moteur vocal local n’est pas prêt. Lance START-SOPHENIC-VOICE.ps1.");
      const bytes = await desktop.voice.speech({ text: sample, language: voice.language, voiceId: voice.voiceId, speed: voice.speed, expressiveness: voice.expressiveness, natural: voice.naturalConversation, sessionId: "settings-preview" });
      const audioBytes = bytes;
      const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
      new Uint8Array(audioBuffer).set(audioBytes);
      const url = URL.createObjectURL(new Blob([audioBuffer], { type: "audio/wav" }));
      const audio = new Audio(url);
      audio.volume = voice.volume;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
      setVoiceMessage(`${String(health.provider || "Sophenic Native Voice")} · ${String(health.languages || "30+")} langues · local`);
    } catch (cause) {
      setVoiceMessage(cause instanceof Error ? cause.message : "Moteur vocal local indisponible.");
    }
  };
  const capabilities = integrations.filter((item) => item.id !== "google-workspace"); const groups = [...new Set(capabilities.map((item) => item.category))];
  return <div className="h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl space-y-5">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700"><Settings2 className="size-4" />Paramètres</div><h1 className="mt-2 text-2xl font-semibold">SOPHENIC</h1><p className="mt-1 text-sm text-zinc-500">Personnalisation, mémoire, voix et permissions. Les clés IA déjà enregistrées sont conservées dans le coffre, sans page « Fournisseurs IA » côté utilisateur.</p></div>
    <div className="grid gap-3 md:grid-cols-2"><button onClick={onOpenPersonalization} className="rounded-2xl border border-[#e7d8be] bg-white p-4 text-left hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]"><UserRound className="size-5 text-emerald-700" /><div className="mt-3 font-semibold">Personnalisation</div><p className="mt-1 text-xs text-zinc-500">Ton, langue et préférences de réponse.</p></button><button onClick={onOpenHermes} className="rounded-2xl border border-[#e7d8be] bg-white p-4 text-left hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]"><Sparkles className="size-5 text-emerald-700" /><div className="mt-3 font-semibold">Runtime Agent</div><p className="mt-1 text-xs text-zinc-500">Diagnostic et runtime local avancé.</p></button></div>

    {memory && <section className="rounded-3xl border border-[#e7d8be] bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.025]"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 font-semibold"><MemoryStick className="size-5 text-emerald-700" />Grande mémoire</div><p className="mt-1 text-xs leading-5 text-zinc-500">Jusqu’à 20 000 souvenirs locaux. Les éléments épinglés sont prioritaires dans le contexte.</p></div><Toggle value={memory.enabled} onChange={async (value) => setMemory(await desktop!.workspace.memoryEnable(value) as MemoryState)} /></div><div className="mt-4 flex gap-2"><Input value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="Ajouter un souvenir important…" /><Button onClick={async () => { if (!newMemory.trim()) return; setMemory(await desktop!.workspace.memoryRemember(newMemory, "manual", true) as MemoryState); setNewMemory(""); }}><Plus className="size-4" />Mémoriser</Button></div><div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500"><span>{memory.entries.length.toLocaleString()} / {memory.maxEntries.toLocaleString()} souvenirs</span><button className="text-red-500" onClick={async () => { if (confirm("Effacer toute la mémoire SOPHENIC ?")) setMemory(await desktop!.workspace.memoryClear() as MemoryState); }}>Effacer</button></div></section>}

    {voice && <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-5 dark:border-emerald-900/30 dark:from-white/[0.03] dark:to-emerald-950/10"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 font-semibold"><Mic2 className="size-5 text-emerald-700" />Sophenic Native Voice</div><p className="mt-1 text-xs leading-5 text-zinc-500">Moteur local temps réel : micro continu, transcription multilingue, voix neurale expressive, détection de silence et interruption naturelle en full duplex. Aucun audio n’est envoyé à une API vocale externe.</p></div><Toggle value={voice.enabled} onChange={(value) => void saveVoice({ enabled: value })} /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs font-medium">Langue et accent<select value={voice.language} onChange={(e) => void saveVoice({ language: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#dfcfb6] bg-white px-3 text-sm dark:border-white/10 dark:bg-black/20">{VOICE_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-medium">Identité vocale<Input className="mt-1" value={voice.voiceId} onChange={(e) => setVoice({ ...voice, voiceId: e.target.value })} onBlur={() => void saveVoice({ voiceId: voice.voiceId })} /></label></div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">{([["Vitesse", "speed", 0.68, 1.35, 0.05], ["Expressivité", "expressiveness", 0, 1, 0.05], ["Volume", "volume", 0, 1, 0.05], ["Sensibilité micro", "inputSensitivity", 0, 1, 0.05]] as const).map(([label, key, min, max, step]) => <label key={key} className="text-xs font-medium">{label}<input type="range" min={min} max={max} step={step} value={voice[key]} onChange={(e) => void saveVoice({ [key]: Number(e.target.value) })} className="mt-2 w-full accent-emerald-600" /></label>)}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{[["Personnalité émotionnelle contextuelle", "naturalConversation"], ["Relance naturelle après un silence", "silencePrompts"]].map(([label, key]) => <div key={key} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"><span>{label}</span><Toggle value={Boolean(voice[key as keyof VoiceSettings])} onChange={(value) => void saveVoice({ [key]: value })} /></div>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => void testVoice()}><Volume2 className="size-4" />Tester la voix locale</Button><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">42 langues</span>{voiceMessage && <span className="text-[11px] text-zinc-500">{voiceMessage}</span>}</div>
    </section>}

    <section className="rounded-3xl border border-[#e7d8be] bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.025]">
      <div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"><Box className="size-5" /></div><div className="min-w-0 flex-1"><div className="font-semibold">3D Assets · Sketchfab</div><p className="mt-1 text-xs leading-5 text-zinc-500">Le token est validé puis stocké uniquement dans le coffre chiffré Electron. Il n’est jamais relu dans le renderer ni enregistré dans les projets Design.</p></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold", sketchfabStatus.verified ? "bg-emerald-100 text-emerald-700" : sketchfabStatus.configured ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500")}>{sketchfabStatus.verified ? "CONNECTÉ" : sketchfabStatus.configured ? "ENREGISTRÉ" : "NON CONNECTÉ"}</span></div>
      {sketchfabStatus.account && <div className="mt-3 text-xs text-zinc-500">Compte : <b>{sketchfabStatus.account}</b></div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input type="password" autoComplete="off" value={sketchfabToken} onChange={(event) => setSketchfabToken(event.target.value)} placeholder="API Token Sketchfab" className="flex-1" /><Button disabled={sketchfabBusy || !sketchfabToken.trim()} onClick={async () => { if (!desktop?.design) return; setSketchfabBusy(true); try { const result = await desktop.design.saveSketchfabToken(sketchfabToken); setSketchfabStatus(result.sketchfab); setSketchfabToken(""); } catch (error) { const previous = await desktop.design.assetStatus(false).catch(() => ({ sketchfab: { configured: false, verified: false } })); setSketchfabStatus({ ...previous.sketchfab, verified: false, detail: error instanceof Error ? error.message : "Connexion Sketchfab impossible." }); } finally { setSketchfabBusy(false); } }}>{sketchfabBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Enregistrer & tester</Button></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={sketchfabBusy || !sketchfabStatus.configured} onClick={async () => { if (!desktop?.design) return; setSketchfabBusy(true); try { const result = await desktop.design.assetStatus(true); setSketchfabStatus(result.sketchfab); } catch (error) { setSketchfabStatus((current) => ({ ...current, verified: false, detail: error instanceof Error ? error.message : "Test Sketchfab impossible." })); } finally { setSketchfabBusy(false); } }}><RefreshCw className="size-3.5" />Tester connexion</Button>{sketchfabStatus.configured && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (!desktop?.design) return; const result = await desktop.design.clearSketchfabToken(); setSketchfabStatus(result.sketchfab); }}>Déconnecter</Button>}<span className="text-[10px] text-zinc-400">{sketchfabStatus.detail}</span></div>
    </section>

    <section className="rounded-3xl border border-[#e7d8be] bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.025]">
      <div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><TrainFront className="size-5" /></div><div className="min-w-0 flex-1"><div className="font-semibold">Déploiement · Railway</div><p className="mt-1 text-xs leading-5 text-zinc-500">Colle ta clé API Railway (Dashboard Railway → Account → Tokens). Elle est validée puis chiffrée dans le coffre Electron — jamais lue par le renderer, jamais écrite dans les projets. Aucun « Client ID » n’est nécessaire : l’authentification est directe par token.</p></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold", railwayStatus.verified ? "bg-emerald-100 text-emerald-700" : railwayStatus.configured ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500")}>{railwayStatus.verified ? "CONNECTÉ" : railwayStatus.configured ? "ENREGISTRÉ" : "NON CONNECTÉ"}</span></div>
      {railwayStatus.account && <div className="mt-3 text-xs text-zinc-500">Compte : <b>{railwayStatus.account}</b></div>}
      {railwayStatus.projects?.length ? <div className="mt-2 text-xs text-zinc-500">Projets Railway : <b>{railwayStatus.projects.join(" · ")}</b></div> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input type="password" autoComplete="off" value={railwayToken} onChange={(event) => setRailwayToken(event.target.value)} placeholder="Clé API Railway (token)" className="flex-1" /><Button disabled={railwayBusy || !railwayToken.trim()} onClick={async () => { if (!desktop?.railway) return; setRailwayBusy(true); try { const result = await desktop.railway.saveToken(railwayToken); setRailwayStatus(result); setRailwayToken(""); } catch (error) { const previous = await desktop.railway.status(false).catch(() => ({ configured: false, verified: false })); setRailwayStatus({ ...previous, verified: false, detail: error instanceof Error ? error.message : "Connexion Railway impossible." }); } finally { setRailwayBusy(false); } }}>{railwayBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Enregistrer & tester</Button></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={railwayBusy || !railwayStatus.configured} onClick={async () => { if (!desktop?.railway) return; setRailwayBusy(true); try { setRailwayStatus(await desktop.railway.status(true)); } catch (error) { setRailwayStatus((current) => ({ ...current, verified: false, detail: error instanceof Error ? error.message : "Test Railway impossible." })); } finally { setRailwayBusy(false); } }}><RefreshCw className="size-3.5" />Tester connexion</Button>{railwayStatus.configured && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (!desktop?.railway) return; setRailwayStatus(await desktop.railway.clearToken()); }}>Déconnecter</Button>}<span className="text-[10px] text-zinc-400">{railwayStatus.detail}</span></div>
    </section>

    <section className="rounded-3xl border border-[#e7d8be] bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.025]"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Capacités de l’agent</h2><p className="mt-1 text-xs text-zinc-500">Permissions locales et actions sensibles.</p></div><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="size-4" /></Button></div><div className="mt-4 space-y-4">{groups.map((group) => <div key={group}><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-400">{group}</div><div className="grid gap-2 md:grid-cols-2">{capabilities.filter((item) => item.category === group).map((item) => <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#eadfce] bg-[#fffdf9] p-3 dark:border-white/10 dark:bg-black/10"><button type="button" onClick={() => onToggle(item)} disabled={busyId === item.id} className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border", item.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-zinc-200 bg-white text-zinc-400")}>{busyId === item.id ? <Loader2 className="size-4 animate-spin" /> : item.enabled ? <Check className="size-4" /> : <Circle className="size-4" />}</button><div><span className="text-sm font-semibold">{item.name}</span><p className="mt-1 text-[11px] leading-5 text-zinc-500">{item.description}</p>{item.id === "computer_use" && item.enabled && !item.connected && <Button size="sm" variant="outline" className="mt-2" onClick={onSetupComputer}>Installer</Button>}</div></div>)}</div></div>)}</div></section>
  </div></div>;
}

const historyMeta = { chat: { label: "Chat", icon: MessageSquare }, code: { label: "Code", icon: Code2 }, image: { label: "Image", icon: ImageIcon } } as const;
export function HistoryCenter({ onOpen }: { onOpen: (record: ConversationRecord) => void }) {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  const [items, setItems] = useState<ConversationRecord[]>([]); const [query, setQuery] = useState(""); const [expanded, setExpanded] = useState<Record<string, boolean>>({ chat: true, code: true, image: true });
  const refresh = useCallback(async () => { if (desktop?.workspace) setItems(await desktop.workspace.historyList() as ConversationRecord[]); }, [desktop]); useEffect(() => { void refresh(); }, [refresh]);
  const visible = items.filter((item) => !query.trim() || `${item.title} ${item.messages.map((m) => m.content).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="h-full overflow-y-auto px-4 py-6 sm:px-6"><div className="mx-auto max-w-4xl"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700"><Archive className="size-4" />Historique</div><h1 className="mt-2 text-2xl font-semibold">Retrouver une conversation</h1></div><div className="relative mt-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher dans les chats…" className="pl-9" /></div><div className="mt-5 space-y-4">{(["chat", "code", "image"] as const).map((mode) => { const meta = historyMeta[mode], Icon = meta.icon, rows = visible.filter((item) => item.mode === mode); return <section key={mode} className="overflow-hidden rounded-2xl border border-[#e7d8be] bg-white dark:border-white/10 dark:bg-white/[0.025]"><button onClick={() => setExpanded((prev) => ({ ...prev, [mode]: !prev[mode] }))} className="flex w-full items-center gap-2 px-4 py-3 text-left"><Icon className="size-4 text-emerald-700" /><span className="font-semibold">{meta.label}</span><span className="text-xs text-zinc-400">{rows.length}</span><span className="ml-auto">{expanded[mode] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</span></button>{expanded[mode] && <div className="border-t border-[#efe5d5] dark:border-white/[0.06]">{rows.map((item) => <div key={item.id} className="flex items-center gap-2 border-b border-[#f3ebdf] px-4 py-3 last:border-0 dark:border-white/[0.04]"><button onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-medium">{item.title}</div><div className="mt-0.5 text-[10px] text-zinc-400">{new Date(item.updatedAt).toLocaleString()}</div></button><button onClick={async () => { await desktop?.workspace.historyDelete(item.id); await refresh(); }}><Trash2 className="size-4 text-zinc-400 hover:text-red-500" /></button></div>)}{!rows.length && <div className="px-4 py-6 text-center text-xs text-zinc-400">Aucun chat.</div>}</div>}</section>; })}</div></div></div>;
}

export function PlannerCenter() {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined;
  const [tasks, setTasks] = useState<PlannerTask[]>([]); const [title, setTitle] = useState(""); const [prompt, setPrompt] = useState(""); const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)); const [time, setTime] = useState("09:00"); const [recurrence, setRecurrence] = useState<"once" | "daily">("once"); const [showForm, setShowForm] = useState(false);
  const refresh = useCallback(async () => { if (desktop?.workspace) setTasks(await desktop.workspace.plannerList() as PlannerTask[]); }, [desktop]); useEffect(() => { void refresh(); }, [refresh]);
  const add = async () => { if (!desktop?.workspace || !title.trim()) return; const local = new Date(`${date}T${time}:00`); await desktop.workspace.plannerSave({ title, prompt: prompt.trim() || title, recurrence, scheduledFor: local.toISOString(), enabled: true }); setTitle(""); setPrompt(""); setShowForm(false); await refresh(); };
  return <div className="h-full overflow-y-auto px-4 py-6 sm:px-6"><div className="mx-auto max-w-4xl"><div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700"><CalendarDays className="size-4" />Planification</div><h1 className="mt-2 text-2xl font-semibold">Tâches programmées</h1><p className="mt-1 text-sm text-zinc-500">SOPHENIC exécute la consigne à l’heure choisie. Une tâche quotidienne se reprogramme automatiquement jusqu’à sa suppression.</p></div><Button onClick={() => setShowForm(true)}><Plus className="size-4" />Ajouter</Button></div>
    {showForm && <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10"><div className="grid gap-3"><label className="text-xs font-medium">Nom<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Rédiger mon e-mail quotidien" className="mt-1" /></label><label className="text-xs font-medium">Consigne<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex. Rédige un e-mail de suivi professionnel à partir du contexte récent…" className="mt-1 min-h-24 w-full rounded-xl border border-[#dfcfb6] bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-black/20" /></label><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">Jour<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" /></label><label className="text-xs font-medium">Heure<Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" /></label><label className="text-xs font-medium">Répétition<select value={recurrence} onChange={(e) => setRecurrence(e.target.value as "once" | "daily")} className="mt-1 h-10 w-full rounded-xl border border-[#dfcfb6] bg-white px-3 text-sm dark:border-white/10 dark:bg-black/20"><option value="once">Une seule fois</option><option value="daily">Tous les jours</option></select></label></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button><Button onClick={() => void add()}>Programmer</Button></div></div></div>}
    <div className="mt-5 space-y-2">{tasks.map((task) => <div key={task.id} className="rounded-2xl border border-[#e7d8be] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-start gap-3"><div className={cn("mt-0.5 grid size-9 place-items-center rounded-xl", task.status === "failed" ? "bg-red-50 text-red-600" : task.status === "running" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-700")}><Bell className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="font-semibold">{task.title}</div>{task.recurrence === "daily" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">QUOTIDIEN</span>}</div><p className="mt-1 text-xs text-zinc-500">Prochaine exécution : {new Date(task.scheduledFor).toLocaleString()}</p>{task.lastResult && <p className="mt-2 line-clamp-2 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] leading-5 text-zinc-600 dark:bg-white/[0.03] dark:text-zinc-300">Dernier résultat : {task.lastResult}</p>}{task.lastError && <p className="mt-2 text-[11px] text-red-500">{task.lastError}</p>}</div><button onClick={async () => { await desktop?.workspace.plannerDelete(task.id); await refresh(); }} title={task.recurrence === "daily" ? "Supprimer et arrêter cette tâche quotidienne" : "Supprimer la tâche"}><Trash2 className="size-4 text-zinc-400 hover:text-red-500" /></button></div></div>)}{!tasks.length && <div className="rounded-3xl border border-dashed border-[#dfcfb6] p-10 text-center text-sm text-zinc-500">Aucune tâche programmée.</div>}</div>
  </div></div>;
}

export function LibraryCenter() {
  const desktop = typeof window !== "undefined" ? window.sophenicDesktop : undefined; const [items, setItems] = useState<LibraryEntry[]>([]);
  const refresh = useCallback(async () => { if (desktop?.workspace) setItems(await desktop.workspace.libraryList() as LibraryEntry[]); }, [desktop]); useEffect(() => { void refresh(); }, [refresh]);
  const images = items.filter((item) => item.kind === "image"); const files = items.filter((item) => item.kind !== "image");
  const render = (rows: LibraryEntry[], type: "image" | "file") => <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((item) => <div key={item.id} className="rounded-2xl border border-[#e7d8be] bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{type === "image" ? <FileImage className="size-4" /> : <FileText className="size-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 truncate text-[10px] text-zinc-400">{item.source || item.path || item.url}</p></div></div><div className="mt-3 flex gap-2">{item.path && <Button size="sm" variant="outline" onClick={() => desktop?.workspace.openPath(item.path!)}><ExternalLink className="size-3.5" />Ouvrir</Button>}{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border px-3 text-xs">URL</a>}<button className="ml-auto" onClick={async () => { await desktop?.workspace.libraryDelete(item.id); await refresh(); }}><Trash2 className="size-4 text-zinc-400 hover:text-red-500" /></button></div></div>)}</div>;
  return <div className="h-full overflow-y-auto px-4 py-6 sm:px-6"><div className="mx-auto max-w-5xl"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700"><BookOpen className="size-4" />Bibliothèque</div><h1 className="mt-2 text-2xl font-semibold">Fichiers & images</h1><p className="mt-1 text-sm text-zinc-500">Stockage local limité volontairement à <b>20 fichiers</b> et <b>20 images</b> pour garder SOPHENIC léger.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className={cn("rounded-2xl border p-4", images.length >= 20 ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50/50")}><div className="text-sm font-semibold">Images</div><div className="mt-1 text-2xl font-semibold">{images.length}<span className="text-sm font-normal text-zinc-400"> / 20</span></div>{images.length >= 20 && <p className="mt-2 text-xs text-amber-800">Limite atteinte. Supprime une ancienne image pour laisser de la place à une nouvelle création.</p>}</div><div className={cn("rounded-2xl border p-4", files.length >= 20 ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50/50")}><div className="text-sm font-semibold">Fichiers</div><div className="mt-1 text-2xl font-semibold">{files.length}<span className="text-sm font-normal text-zinc-400"> / 20</span></div>{files.length >= 20 && <p className="mt-2 text-xs text-amber-800">Limite atteinte. Supprime un ancien fichier pour libérer une place.</p>}</div></div><section className="mt-6"><h2 className="mb-3 text-sm font-semibold">Images</h2>{render(images, "image")}</section><section className="mt-7"><h2 className="mb-3 text-sm font-semibold">Fichiers</h2>{render(files, "file")}</section></div></div>;
}
