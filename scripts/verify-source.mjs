import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json", "next.config.js", "electron-builder.yml", "electron/main.js", "electron/main.ts", "electron/preload.ts",
  "electron/runtime/index.ts", "electron/runtime/sophenic-brain.ts", "electron/runtime/code-workspace.ts",
  "electron/runtime/provider-secrets.ts", "electron/runtime/provider-validation.ts", "electron/runtime/provider-client.ts",
  "electron/runtime/hermes.ts", "electron/runtime/gateway.ts", "electron/runtime/claude-code.ts", "electron/runtime/code-engines.ts",
  "electron/runtime/code-engine/autonomous-runtime.ts", "electron/runtime/code-engine/tool-executor.ts", "electron/runtime/code-engine/website-quality.ts",
  "electron/runtime/code-engine/security-guard.ts", "electron/runtime/code-engine/safe-terminal.ts",
  "electron/runtime/code-engine/environment-manager.ts", "electron/runtime/code-engine/web-research.ts",
  "electron/runtime/code-engine/connectors/docker-sandbox.ts", "electron/runtime/code-engine/connectors/playwright-agent.ts",
  "electron/runtime/code-engine/connectors/github.ts", "electron/runtime/code-engine/connectors/vercel.ts", "electron/runtime/developer-oauth.ts",
  "electron/runtime/oauth-provider-registry.ts", "electron/runtime/oauth-broker-client.ts", "electron/runtime/plugin-connectors.ts",
  "src/components/agent/local-agent-workspace.tsx", "src/components/agent/workspace-pages.tsx", "src/types/electron.d.ts",
  "voice_engine/service/main.py", "voice_engine/speech_to_text/whisper_engine.py", "voice_engine/text_to_speech/voxcpm2.py",
  "voice_engine/audio_stream/vad.py", "voice_engine/emotion_engine/personality.py", "voice_engine/interruption_handler/cancellation.py",
  "voice_engine/silence_detector/natural-silence.ts", "voice_engine/voice_ui/voice-mode.tsx",
  "src/components/MarkdownMathRenderer.tsx", "src/components/developer-connections-panel.tsx",
  "src/lib/server/developer-connections.ts", "src/app/(app)/settings/connections/page.tsx",
  "src/app/api/connections/github/connect/route.ts", "src/app/api/connections/github/callback/route.ts", "src/app/api/connections/github/disconnect/route.ts",
  "src/app/api/connections/vercel/connect/route.ts", "src/app/api/connections/vercel/callback/route.ts", "src/app/api/connections/vercel/disconnect/route.ts",
  "build/icon.ico", "build/installerSidebar.bmp", "build/installerHeader.bmp", "build/provision-ai.ps1", "build/installer.nsh",
  "build/launch/splash.html", "build/launch/intro.mp4", "RUN-SOPHENIC-VSCODE.ps1", ".env.example",
  "scripts/normalize-standalone.mjs", "scripts/test-sophenic.mjs", "scripts/windows-doctor.ps1", "voice_engine/docker-compose.yml", "voice_engine/Dockerfile", "oauth-broker/app/main.py", "oauth-broker/app/providers.py", "oauth-broker/Dockerfile", "README.md"
];
for (const file of required) await access(path.join(root, file));

const assert = (value, message) => { if (!value) throw new Error(message); };
const text = async (file) => readFile(path.join(root, file), "utf8");
const pkg = JSON.parse(await text("package.json"));
assert(/^11\.0\.0/.test(pkg.version), "La source finale doit être versionnée 11.0.0.");
assert(pkg.main === "electron/main.js", "Entrée Electron invalide.");
assert(pkg.scripts?.test === "npm run test:sophenic", "npm test doit exécuter la suite Sophenic.");
assert(pkg.scripts?.build?.includes("build:web") && pkg.scripts?.build?.includes("build:electron"), "npm run build doit compiler Web + Electron.");
assert(!pkg.scripts?.build?.includes("package:win:installer"), "npm run build doit rester portable; l'installateur Windows appartient à build:installer.");
assert(pkg.scripts?.["build:installer"]?.includes("package:win:installer"), "build:installer doit conserver le packaging NSIS.");
assert(pkg.devDependencies?.playwright, "Playwright doit être une dépendance de développement explicite.");
assert(pkg.dependencies?.next === "15.5.21" && pkg.devDependencies?.typescript === "5.9.2", "Versions Next/TypeScript reproductibles attendues.");
const prepareDesktop = await text("scripts/prepare-desktop.mjs");
assert(prepareDesktop.includes("publisherRuntimeKeys") && prepareDesktop.includes("SOPHENIC_OAUTH_BROKER_URL") && !prepareDesktop.includes("SOPHENIC_OAUTH_NOTION_CLIENT_SECRET"), "Le package Desktop doit embarquer uniquement le routage éditeur autorisé.");

assert((await stat(path.join(root, "build/launch/intro.mp4"))).size > 100_000, "Vidéo d'introduction invalide.");
assert((await stat(path.join(root, "build/icon.ico"))).size > 1_000, "Icône Windows invalide.");
const nextConfig = await text("next.config.js");
assert(nextConfig.includes('output: "standalone"'), "Next standalone est requis pour Desktop.");
const builder = await text("electron-builder.yml");
assert(builder.includes("target: nsis") && builder.includes("createDesktopShortcut: always"), "Packaging Windows NSIS incomplet.");

const main = await text("electron/main.ts");
assert(main.includes('return runtime.code.runTask({'), "Le main process doit déléguer Code au moteur natif Sophenic.");
assert(main.includes('return runtime.code.inspect()'), "Le statut Code doit provenir du moteur natif.");
assert(main.includes('runtime.code.abort('), "L'annulation Code native est manquante.");
assert(main.includes('"sophenic:runtime:recover-code-checkpoint"') && main.includes("findLatestCodeWorkspaceCheckpoint"), "Reprise checkpoint disque manquante.");
assert(main.includes('"sophenic:hermes:create-session"'), "Hermes optionnel doit rester disponible pour Computer Use/plugins.");
assert(!main.includes("https://app.sophenic.com"), "Le renderer privilégié ne doit pas charger une URL distante.");

const preload = await text("electron/preload.ts");
for (const forbidden of ["node:fs", "node:child_process", "exec(", "spawn("]) assert(!preload.includes(forbidden), `Preload dangereux: ${forbidden}`);
for (const expected of ["sophenic:code:run", "sophenic:code:event", "recoverCodeCheckpoint", "providerStatus", "sophenic:plugins:connect", "sophenic:plugins:invoke", "sophenic:workspace:voice-get", "sophenic:voice:health", "sophenic:voice:session-start", "sophenic:voice:session-audio", "onPlannerCompleted"]) assert(preload.includes(expected), `Bridge preload manquant: ${expected}`);

const renderer = await text("src/components/agent/local-agent-workspace.tsx");
assert(renderer.includes("sendNativeCodePrompt"), "L'UI Code doit utiliser le moteur natif.");
assert(!renderer.includes('sendHermesPrompt("code"'), "Hermes ne doit plus être le moteur Code obligatoire.");
assert(renderer.includes("Hermes reste optionnel") && renderer.includes("Hermes non requis"), "L'UI doit expliciter le statut optionnel de Hermes pour Code.");
assert(renderer.includes("Reprendre la tâche") && renderer.includes("recoverCodeCheckpoint"), "UX de reprise checkpoint manquante.");
for (const expected of ["PLAN", "CODE", "APERÇU", "ACTIONS", "Sophenic Brain", "Outil Sophenic Code", "Quality Gate", "Plugins", "Démarrer une conversation vocale", "Session actuelle"]) assert(renderer.includes(expected), `UI Code incomplète: ${expected}`);
for (const forbidden of ["node:fs", "node:child_process", "window.require("]) assert(!renderer.includes(forbidden), `Renderer dangereux: ${forbidden}`);


const markdownMath = await text("src/components/MarkdownMathRenderer.tsx");
for (const expected of ["react-markdown", "remark-math", "rehype-katex", "MATH_FENCE", "normalizeMathMarkdown"]) assert(markdownMath.includes(expected), `Renderer mathématique incomplet: ${expected}`);
const bubble = await text("src/components/chat/message-bubble.tsx");
assert(bubble.includes("MarkdownMathRenderer"), "Les réponses IA du chat doivent passer par MarkdownMathRenderer.");
assert(renderer.includes("MarkdownMathRenderer"), "Les réponses IA de l'agent local doivent passer par MarkdownMathRenderer.");
assert(pkg.dependencies?.["react-markdown"] && pkg.dependencies?.["remark-math"] && pkg.dependencies?.["rehype-katex"] && pkg.dependencies?.katex, "Dépendances Markdown/KaTeX manquantes.");

const oauthServer = await text("src/lib/server/developer-connections.ts");
for (const expected of ["aes-256-gcm", "timingSafeEqual", "createPkcePair", "tool_connections", "SOPHENIC_CONNECTIONS_ENCRYPTION_KEY"]) assert(oauthServer.includes(expected), `Infrastructure OAuth incomplète: ${expected}`);
const githubConnect = await text("src/app/api/connections/github/connect/route.ts");
const githubCallback = await text("src/app/api/connections/github/callback/route.ts");
const githubDisconnect = await text("src/app/api/connections/github/disconnect/route.ts");
assert(githubConnect.includes("https://github.com/login/oauth/authorize"), "Autorisation OAuth GitHub officielle manquante.");
assert(githubCallback.includes("https://github.com/login/oauth/access_token") && githubCallback.includes("safeEqual"), "Callback OAuth GitHub incomplet.");
assert(githubDisconnect.includes("api.github.com/applications") && githubDisconnect.includes('method: "DELETE"'), "Révocation OAuth GitHub manquante.");
const vercelConnect = await text("src/app/api/connections/vercel/connect/route.ts");
const vercelCallback = await text("src/app/api/connections/vercel/callback/route.ts");
const vercelDisconnect = await text("src/app/api/connections/vercel/disconnect/route.ts");
assert(vercelConnect.includes("https://vercel.com/oauth/authorize") && vercelConnect.includes("code_challenge"), "Autorisation OAuth/PKCE Vercel manquante.");
assert(vercelCallback.includes("https://api.vercel.com/login/oauth/token") && vercelCallback.includes("code_verifier"), "Callback OAuth Vercel incomplet.");
assert(vercelDisconnect.includes("https://api.vercel.com/login/oauth/token/revoke"), "Révocation OAuth Vercel manquante.");
const connectionPanel = await text("src/components/developer-connections-panel.tsx");
for (const expected of ["GitHub", "Vercel", "Connecter ${copy.name}", "Déconnecter ${copy.name}", "Connecté", "Non connecté"]) assert(connectionPanel.includes(expected), `UX Connexions développeur incomplète: ${expected}`);

const brain = await text("electron/runtime/sophenic-brain.ts");
for (const expected of ["domain", "languages", "projectSize", "needsImages", "needsResearch", "needsTests", "estimatedTokens", "costSensitivity", "planSophenicAgentRoute", "fallbacks", "reviewers"]) assert(brain.includes(expected), `Brain incomplet: ${expected}`);
assert(!brain.includes('candidate.provider !== "xai"'), "xAI ne doit pas être exclu du Code à cause de Hermes.");

const native = await text("electron/runtime/code-engine/autonomous-runtime.ts");
for (const expected of ["Hermes n'est PAS dans le chemin", "CodeToolExecutor", "planSophenicAgentRoute", "MAX_TURNS", "fallback", "project.verify", "saveCodeWorkspaceCheckpoint", "clearCodeWorkspaceCheckpoint", "reviewers"]) assert(native.includes(expected), `Runtime Code natif incomplet: ${expected}`);
assert(!/from\s+["'][^"']*hermes/i.test(native), "Le runtime Code natif ne doit importer aucun moteur Hermes.");

const tools = await text("electron/runtime/code-engine/tool-executor.ts");
for (const expected of ["filesystem.write", "terminal.run", "project.verify", "website.audit", "docker.run", "browser.audit", "browser.screenshot", "web.search", "plugin.invoke", "github.create_repo", "vercel.projects", "vercel.link", "vercel.deploy"]) assert(tools.includes(expected), `Outil natif manquant: ${expected}`);
const websiteQuality = await text("electron/runtime/code-engine/website-quality.ts");
for (const expected of ["isWebsiteTaskPrompt", "auditWebsiteProject", "hasDefaultBrowserLook", "score >= threshold"]) assert(websiteQuality.includes(expected), `Web Quality Gate incomplet: ${expected}`);
assert(native.includes("QUALITY GATE WEB ÉCHOUÉ") && native.includes("Validation visuelle du déploiement final"), "Le runtime doit refuser les sites pauvres et vérifier le déploiement live.");
assert(brain.includes("websiteBuild") && brain.includes('requestedMode === "auto"'), "Le Brain doit détecter les créations Web et promouvoir Auto vers Deep.");
assert(renderer.includes("recentConversation") && renderer.includes("enginePrompt") && renderer.includes("vercel-token-redacted"), "Le contexte Code récent doit être transmis avec redaction des tokens développeur.");

const guard = await text("electron/runtime/code-engine/security-guard.ts");
for (const expected of ["formatage de disque", "suppression récursive", "exécution aveugle de code distant", "désactivation de sécurité"]) assert(guard.includes(expected), `Security Guard incomplet: ${expected}`);

const workspace = await text("electron/runtime/code-workspace.ts");
for (const expected of ['"projects"', '"logs"', '"checkpoints"', '"versions"', '"tests"', '"delivery"', "findLatestCodeWorkspaceCheckpoint", "handoff.json"]) assert(workspace.includes(expected), `Workspace professionnel incomplet: ${expected}`);

const github = await text("electron/runtime/code-engine/connectors/github.ts");
for (const expected of ["device/code", "createRepository", "commitAll", "push("]) assert(github.includes(expected), `Connecteur GitHub incomplet: ${expected}`);
const vercel = await text("electron/runtime/code-engine/connectors/vercel.ts");
assert(vercel.includes("api.vercel.com") && vercel.includes("deploy(") && vercel.includes("inspect(") && vercel.includes("async projects(") && vercel.includes("async linkProject(") && vercel.includes("/v3/deployments/") && vercel.includes("/v2/teams"), "Connecteur Vercel incomplet.");
const desktopDeveloperAuth = await text("electron/runtime/developer-oauth.ts");
for (const expected of ["GITHUB_DEVICE_URL", "login/device/code", "login/oauth/access_token", "personal_access_token", "githubPatLooksValid", "saveDeveloperPersonalToken", "openDeveloperProviderPortal", "connectors.vercel.validate()"] ) assert(desktopDeveloperAuth.includes(expected), `Connexion développeur Desktop incomplète: ${expected}`);
assert(!desktopDeveloperAuth.includes("SOPHENIC_GITHUB_CLIENT_SECRET"), "Le Device Flow GitHub Desktop ne doit pas dépendre du Client Secret.");
const playwright = await text("electron/runtime/code-engine/connectors/playwright-agent.ts");
for (const expected of ["chromium.launch", "click(", "fill(", "screenshot(", "async audit()", "horizontalOverflow", "pageerror", "consoleErrors"]) assert(playwright.includes(expected), `Agent Playwright incomplet: ${expected}`);
const env = await text("electron/runtime/code-engine/environment-manager.ts");
for (const expected of ["node", "npm", "git", "python", "docker", "playwright", "winget install"]) assert(env.includes(expected), `Installation/doctor incomplet: ${expected}`);

const secrets = await text("electron/runtime/provider-secrets.ts");
assert(secrets.includes("safeStorage.encryptString") && secrets.includes("safeStorage.decryptString"), "Le coffre API doit utiliser electron.safeStorage.");
const validation = await text("electron/runtime/provider-validation.ts");
assert(validation.includes("validateProviderKeys"), "Validation des clés avant sauvegarde manquante.");
const envExample = await text(".env.example");
assert(envExample.includes("SOPHENIC_GITHUB_TOKEN=") && envExample.includes("SOPHENIC_VERCEL_TOKEN="), ".env.example connecteurs incomplet.");
for (const expected of ["SOPHENIC_GITHUB_CLIENT_ID=", "SOPHENIC_GITHUB_CLIENT_SECRET=", "SOPHENIC_VERCEL_CLIENT_ID=", "SOPHENIC_VERCEL_CLIENT_SECRET=", "SOPHENIC_OAUTH_BASE_URL=", "SOPHENIC_CONNECTIONS_ENCRYPTION_KEY="]) assert(envExample.includes(expected), `.env.example OAuth incomplet: ${expected}`);
assert(!/(?:ghp_|github_pat_|sk-|AIza)[A-Za-z0-9_.-]{12,}/.test(envExample), ".env.example ne doit contenir aucun secret réel.");

const pluginVault = await text("electron/runtime/plugin-vault.ts");
const pluginOauth = await text("electron/runtime/plugin-oauth.ts");
const oauthRegistry = await text("electron/runtime/oauth-provider-registry.ts");
const oauthBroker = await text("electron/runtime/oauth-broker-client.ts");
const pluginConnectors = await text("electron/runtime/plugin-connectors.ts");
for (const expected of ["GitHub", "Vercel", "Supabase", "Cloudflare", "Firebase", "Gmail", "Google Drive", "Calendar", "Notion", "Stripe", "Shopify", "WordPress", "PostgreSQL", "MySQL", "MongoDB", "safeStorage", "pluginSecretsEnvironment", "pluginAgentContext"]) assert(pluginVault.includes(expected) || (expected === "safeStorage" && pluginVault.includes("connector-secrets")), `Plugin Hub incomplet: ${expected}`);
const workspaceData = await text("electron/runtime/workspace-data.ts");
for (const expected of ["conversation-history.json", "memory.json", "planner.json", "library.json", "20_000", "memoryPrompt"]) assert(workspaceData.includes(expected), `Workspace persistant incomplet: ${expected}`);
const workspacePages = await text("src/components/agent/workspace-pages.tsx");
for (const expected of ["PluginCenter", "SettingsCenter", "HistoryCenter", "PlannerCenter", "LibraryCenter", "Grande mémoire", "Sophenic Native Voice", "Tâches programmées", "Retrouver une conversation"]) assert(workspacePages.includes(expected), `Nouvelle UI 10.2.0 incomplète: ${expected}`);
assert(main.includes('"sophenic:plugins:catalog"') && main.includes('"sophenic:plugins:invoke"') && main.includes('"sophenic:workspace:history-list"') && main.includes('"sophenic:workspace:memory-get"'), "IPC Plugins/Workspace 11.0.0 incomplet.");
for (const expected of ["vercel.com/oauth/authorize", "api.supabase.com/v1/oauth/authorize", "dash.cloudflare.com/oauth2/auth", "accounts.google.com/o/oauth2/v2/auth", "api.notion.com/v1/oauth/authorize", "connect.stripe.com/oauth/authorize"]) assert(oauthRegistry.includes(expected), `Registry OAuth incomplet: ${expected}`);
assert(oauthBroker.includes("SOPHENIC_OAUTH_BROKER_URL") && pluginOauth.includes("safeStorage") === false && pluginOauth.includes("OAuthBrokerClient"), "Le Desktop doit déléguer les secrets OAuth au broker éditeur.");
for (const expected of ["create_page", "send_email", "create_text_file", "create_event", "list_projects", "list_zones", "list_customers", "create_post"]) assert(pluginConnectors.includes(expected), `Action connecteur manquante: ${expected}`);
assert(preload.includes("plugins:") && preload.includes("workspace:"), "Bridge Plugins/Workspace manquant.");

const voiceMain = await text("voice_engine/service/main.py");
const voiceUi = await text("voice_engine/voice_ui/voice-mode.tsx");
const voiceVad = await text("voice_engine/audio_stream/vad.py");
const voiceEmotion = await text("voice_engine/emotion_engine/personality.py");
for (const expected of ["/v2/realtime", "transcript_partial", "transcript_final", "output_audio", "cancel_output", "AdaptiveVoiceActivityDetector", "OutputCancellationRegistry"]) assert(voiceMain.includes(expected), `Moteur vocal natif incomplet: ${expected}`);
for (const expected of ["FullDuplexAudioCapture", "NaturalSilenceDetector", "interruptOutput", "queueSpeech", "Je t’écoute", "onClose"]) assert(voiceUi.includes(expected), `UI vocale temps réel incomplète: ${expected}`);
assert(voiceVad.includes("assistant_speaking") && voiceVad.includes("endpoint_silence_ms") && voiceEmotion.includes("marker_allowed") && voiceEmotion.includes("EMOTIONS"), "VAD adaptatif ou émotion contextuelle incomplet.");
assert(main.includes("startPlannerScheduler") && main.includes("new Notification") && main.includes("sophenic:voice:session-start") && main.includes("sophenic:voice:session-audio"), "Planification/notifications/voix Desktop incomplètes.");
assert(!main.includes("nativeWindowsListen") && !preload.includes("nativeSpeak") && !renderer.includes("voice-client"), "L’ancien système vocal doit être entièrement retiré.");
assert(workspaceData.includes("stableMemory") && workspaceData.includes("MemoryScope") && workspaceData.includes("projectMatch"), "Mémoire sélective utilisateur/projet incomplète.");
assert(preload.includes("plugins:") && preload.includes("voice:") && !preload.includes("saveProvider:"), "Le renderer ne doit plus exposer la sauvegarde de clés IA.");
console.log("SOPHENIC 11.0.0 source verification: OK — Native Realtime Voice + OAuth broker/connectors + scoped memory/history.");
