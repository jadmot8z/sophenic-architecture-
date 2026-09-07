export {};

type RuntimeState = "missing" | "stopped" | "starting" | "ready" | "error";

type CodeWorkspaceKind = "managed" | "external-project" | "external-file";
type CodeWorkspaceInfo = { workspace: string; kind: CodeWorkspaceKind; targetFile?: string; projectId?: string; createdAt?: string; stateDir: string };
type CodeWorkspaceCheckpoint = { workspace: string; originalPrompt: string; planSteps: string[]; activeStep?: number; activeProvider: string; activeModel: string; savedAt: number; reason?: string; workspaceKind?: CodeWorkspaceKind; targetFile?: string; progressDigest?: string };
type CodeWorkspaceHandoff = { workspace: string; stateDir: string; summary: string; files: string[]; recentFiles: string[]; gitStatus: string[]; checkpoint?: CodeWorkspaceCheckpoint | null };

type LocalModel = {
  name: string;
  model: string;
  modifiedAt?: string;
  size: number;
  digest?: string;
  details?: { format?: string; family?: string; families?: string[]; parameterSize?: string; quantizationLevel?: string };
};

type DesktopRuntimeStatus = {
  desktop: true;
  platform: string;
  hermes: { state: RuntimeState; command?: string; version?: string; port?: number; connected: boolean; managed: boolean; error?: string };
  claudeCode: { installed: boolean; command?: string; version?: string; gateway: { running: boolean; port?: number; baseUrl?: string; model: "sophenic-auto" }; error?: string };
  ollama: { state: RuntimeState; baseUrl: string; version?: string; models: LocalModel[]; error?: string };
  capabilities: { localModels: true; hermesGateway: true; claudeCodeAgent: true; brainManagedModels: true; approvalBridge: true; filesystemDirect: true; terminalDirect: true; autonomousCodeEngine: true };
};

type HermesGatewayEvent = { method: string; params: Record<string, unknown> };
type SophenicLocalAction = Record<string, unknown> & { kind: string };
type SophenicLocalActionResult = { handled: true; ok: boolean; kind: string; message: string; target?: string; verified?: boolean };

type EngineSetupStatus = {
  installed: boolean;
  readyForChat: boolean;
  provider: string;
  model: string;
  openRouterKeyConfigured: boolean;
  aiProviderCount: number;
  configuredProviders: string[];
  version?: string;
};

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



type SophenicIntentDecision = {
  intent: "chat" | "code" | "agent_pc" | "research" | "project";
  label: string;
  requiresHermes: boolean;
  purpose: "assistant" | "code" | "pc";
  confidence: number;
  reason: string;
};

type ModelFallback = {
  activated: boolean;
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  reason: string;
};

type ModelManagerStatus = {
  selected: { provider: string; model: string };
  selectedValid: boolean;
  validationError?: string;
  openRouterReachable: boolean;
  ollamaReachable: boolean;
  ollamaModels: string[];
  configuredProviders: string[];
};

type SophenicAgentRouteCandidate = {
  provider: string;
  model: string;
  score: number;
  reason: string;
};

type SophenicAgentRoutePlan = {
  requestedProvider: string;
  requestedModel: string;
  provider: string;
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high";
  fallbacks: SophenicAgentRouteCandidate[];
  reviewers: SophenicAgentRouteCandidate[];
  orchestration: "single" | "review" | "deep";
  planSteps: string[];
  profile: { complexity: number; risk: number; skills: string[]; verificationRequired: boolean; parallelizable: boolean; qualityRequested: boolean; domain: "frontend" | "backend" | "desktop" | "mobile" | "data" | "devops" | "general"; languages: string[]; projectSize: "small" | "medium" | "large"; needsImages: boolean; needsResearch: boolean; needsTests: boolean; estimatedTokens: number; costSensitivity: "low" | "balanced" | "quality-first" };
  mode: "quick" | "auto" | "deep";
};

type ProviderSecretStatus = {
  id: string;
  name: string;
  role: string;
  keyCount: number;
  accountCount?: number;
  configured: boolean;
  requiresAccountId: boolean;
  accountIdConfigured: boolean;
  baseUrlConfigured: boolean;
  docsUrl: string;
  keyUrl: string;
  models: Array<{ id: string; name: string; context?: number }>;
};

type ProviderVaultInfo = {
  encrypted: boolean;
  path: string;
  providerCount: number;
  maxKeysPerProvider: number;
};

type ProviderCatalogItem = {
  id: string;
  name: string;
  role: string;
  docsUrl: string;
  keyUrl: string;
  requiresAccountId: boolean;
  supportsCustomBaseUrl: boolean;
  models: Array<{ id: string; name: string; context?: number }>;
};

type ProviderStatusResult = {
  providers: ProviderSecretStatus[];
  catalog?: ProviderCatalogItem[];
  vault: ProviderVaultInfo;
};


type ProviderImportResult = {
  canceled: boolean;
  fileName?: string;
  summaries?: Array<{ provider: string; name: string; imported: number; accountCount?: number }>;
  warnings?: string[];
  providers?: ProviderSecretStatus[];
  vault?: ProviderVaultInfo;
};

type OpenRouterModel = {
  id: string;
  name: string;
  contextLength?: number;
  free: boolean;
  promptPrice?: number;
  completionPrice?: number;
  inputModalities: string[];
  outputModalities: string[];
  supportedParameters: string[];
};

type OpenRouterImageModel = {
  id: string;
  name: string;
  description?: string;
  inputModalities: string[];
  outputModalities: string[];
  supportedParameters: string[];
  supportsStreaming: boolean;
  free: boolean;
};

type OpenRouterAccount = { isFreeTier: boolean; limit?: number; limitRemaining?: number; usage?: number };

type OpenRouterImage = { url: string; sourceUrl: string; title: string };
type SophenicPlaceResult = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  type?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  sourceUrl: string;
  mapsUrl?: string;
  directionsUrl?: string;
};

type SophenicReferenceImage = { url: string; sourceUrl: string; title: string };

type OpenRouterChatResult = {
  content: string;
  model: string;
  provider: string;
  requestedProvider: string;
  requestedModel: string;
  fallback?: ModelFallback;
  attempts: Array<{ provider: string; model: string; status: "trying" | "success" | "failed"; reason?: string }>;
  agents?: Array<{ role: string; provider: string; model: string }>;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number };
  contextMax?: number;
  images: OpenRouterImage[];
};


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
type OpenRouterGeneratedImageResult = {
  provider?: "xai" | "cloudflare" | "huggingface" | "gemini" | "openrouter";
  model: string;
  images: OpenRouterImage[];
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number };
};


type SophenicPluginField = { id: string; label: string; placeholder?: string; secret?: boolean; multiline?: boolean; help?: string };
type SophenicPluginDefinition = { id: string; name: string; category: "Development" | "Productivity" | "Business" | "Data"; description: string; auth: "github-device" | "oauth" | "database"; portalUrl: string; docsUrl: string; fields: SophenicPluginField[]; testable?: boolean };
type SophenicPluginStatus = { id: string; configured: boolean; verified: boolean; connected: boolean; account?: string; lastVerifiedAt?: string; detail?: string };
type SophenicConversationRecord = { id: string; title: string; mode: "chat" | "code" | "image"; createdAt: string; updatedAt: string; messages: Array<Record<string, unknown> & { role: "user" | "assistant"; content: string }>; workspace?: string };
type SophenicMemoryEntry = { id: string; text: string; source: string; pinned: boolean; scope: "user" | "project" | "preference"; kind: "identity" | "preference" | "constraint" | "goal" | "project" | "fact"; projectId?: string; importance: number; accessCount: number; lastAccessedAt?: string; createdAt: string; updatedAt: string };
type SophenicMemoryState = { enabled: boolean; maxEntries: number; entries: SophenicMemoryEntry[] };
type SophenicPlannerTask = { id: string; title: string; prompt: string; notes?: string; status: "scheduled" | "running" | "done" | "failed"; recurrence: "once" | "daily"; scheduledFor: string; enabled: boolean; lastRunAt?: string; lastResult?: string; lastError?: string; createdAt: string; updatedAt: string };
type SophenicLibraryEntry = { id: string; name: string; kind: "image" | "file" | "project" | "export"; path?: string; url?: string; source?: string; createdAt: string };
type SophenicVoiceSettings = { enabled: boolean; language: string; voiceId: string; speed: number; expressiveness: number; volume: number; naturalConversation: boolean; silencePrompts: boolean; inputSensitivity: number; serviceUrl: string };
type SophenicDesignProjectRecord = { schemaVersion: 1; id: string; name: string; createdAt: string; updatedAt: string; [key: string]: unknown };

declare global {
  interface Window {
    sophenicDesktop?: {
      isDesktop: true;
      platform: string;
      versions: { electron?: string; chromium?: string };
      runtime: {
        status(): Promise<DesktopRuntimeStatus>;
        setupStatus(): Promise<EngineSetupStatus>;
        ensureEngine(): Promise<EngineSetupStatus>;
        engineConfig(): Promise<EngineConfig>;
        modelSelection(): Promise<{ provider: string; model: string }>;
        routeIntent(prompt: string): Promise<SophenicIntentDecision>;
        searchPlaces(query: string): Promise<SophenicPlaceResult[]>;
        searchReferenceImages(query: string): Promise<SophenicReferenceImage[]>;
        webSearch(query: string, limit?: number): Promise<Array<{ title: string; url: string; snippet: string }>>;
        webFetch(url: string, maxChars?: number): Promise<{ url: string; status: number; contentType: string; text: string }>;
        reviewCode(input: { prompt: string; candidates: Array<{ provider: string; model: string }> }): Promise<{ provider: string; model: string; content: string }>;
        rememberLanguage(prompt: string): Promise<EngineConfig>;
        tryNativePcAction(prompt: string): Promise<{ handled: boolean; ok?: boolean; message?: string; target?: string; verified?: boolean }>;
        executeAction(action: SophenicLocalAction): Promise<SophenicLocalActionResult>;
        modelManagerStatus(): Promise<ModelManagerStatus>;
        planAgentRoute(input: { prompt: string; purpose?: "pc" | "code" | "assistant"; provider?: string; model?: string; effortMode?: "quick" | "auto" | "deep" }): Promise<SophenicAgentRoutePlan>;
        providerStatus(): Promise<ProviderStatusResult>;
        reportAgentProviderFailure(provider: string, message: string): Promise<{ remainingReady: number; keyCount: number }>;
        setDefaultModel(provider: string, model: string): Promise<EngineConfig>;
        setPersonalization(value: string): Promise<EngineConfig>;
        startHermes(): Promise<DesktopRuntimeStatus>;
        stopHermes(): Promise<DesktopRuntimeStatus>;
        logs(): Promise<string[]>;
        chooseWorkspace(): Promise<CodeWorkspaceInfo | null>;
        chooseCodeFile(): Promise<CodeWorkspaceInfo | null>;
        createCodeWorkspace(prompt: string): Promise<CodeWorkspaceInfo>;
        recoverCodeCheckpoint(): Promise<CodeWorkspaceCheckpoint | null>;
        saveCodeCheckpoint(checkpoint: CodeWorkspaceCheckpoint): Promise<boolean>;
        clearCodeCheckpoint(workspace: string): Promise<boolean>;
        codeHandoff(input: { workspace: string; checkpoint?: CodeWorkspaceCheckpoint; targetFile?: string }): Promise<CodeWorkspaceHandoff>;
        openCodeWorkspace(workspace: string, targetFile?: string): Promise<boolean>;
        copyHermesInstallCommand(): Promise<string>;
        copyHermesModelCommand(): Promise<string>;
        openHermesWebsite(): Promise<boolean>;
        openOllamaDownload(): Promise<boolean>;
      };
      developerConnections: {
        status(): Promise<{
          connections: Array<{ provider: "github" | "vercel"; connected: boolean; username?: string; name?: string; accountId?: string; scopes: string[]; connectedAt?: string; expiresAt?: string; credentialType?: "oauth" | "personal_access_token" }>;
          configuration: { github: { configured: boolean; mode: "device"; authorizationUrl: string; tokenPortalUrl: string }; vercel: { configured: boolean; mode: "token"; authorizationUrl: string; dashboardUrl: string } };
        }>;
        connect(provider: "github" | "vercel"): Promise<{
          connections: Array<{ provider: "github" | "vercel"; connected: boolean; username?: string; name?: string; accountId?: string; scopes: string[]; connectedAt?: string; expiresAt?: string; credentialType?: "oauth" | "personal_access_token" }>;
          configuration: { github: { configured: boolean; mode: "device"; authorizationUrl: string; tokenPortalUrl: string }; vercel: { configured: boolean; mode: "token"; authorizationUrl: string; dashboardUrl: string } };
        }>;
        disconnect(provider: "github" | "vercel"): Promise<{
          connections: Array<{ provider: "github" | "vercel"; connected: boolean; username?: string; name?: string; accountId?: string; scopes: string[]; connectedAt?: string; expiresAt?: string; credentialType?: "oauth" | "personal_access_token" }>;
          configuration: { github: { configured: boolean; mode: "device"; authorizationUrl: string; tokenPortalUrl: string }; vercel: { configured: boolean; mode: "token"; authorizationUrl: string; dashboardUrl: string } };
        }>;
        openPortal(provider: "github" | "vercel", target?: "connect" | "token" | "dashboard"): Promise<boolean>;
        testVercelUrl(url: string): Promise<{ ok: true; target: string; output: string }>;
      };
      plugins: {
        catalog(): Promise<SophenicPluginDefinition[]>;
        status(): Promise<SophenicPluginStatus[]>;
        connect(id: string, options?: { shopDomain?: string; connectionString?: string }): Promise<SophenicPluginStatus | null>;
        disconnect(id: string, options?: { shopDomain?: string; connectionString?: string }): Promise<SophenicPluginStatus | null>;
        open(id: string, target?: "portal" | "docs"): Promise<boolean>;
        invoke(input: { provider: string; action: string; input?: Record<string, unknown> }): Promise<{ ok: true; provider: string; action: string; summary: string; data: unknown }>;
      };
      workspace: {
        historyList(): Promise<SophenicConversationRecord[]>;
        historySave(input: Record<string, unknown>): Promise<SophenicConversationRecord>;
        historyDelete(id: string): Promise<boolean>;
        historyClear(): Promise<boolean>;
        memoryGet(): Promise<SophenicMemoryState>;
        memoryRemember(text: string, source?: string, pinned?: boolean): Promise<SophenicMemoryState>;
        memoryDelete(id: string): Promise<SophenicMemoryState>;
        memoryClear(): Promise<SophenicMemoryState>;
        memoryEnable(enabled: boolean): Promise<SophenicMemoryState>;
        memoryCapacity(value: number): Promise<SophenicMemoryState>;
        voiceGet(): Promise<SophenicVoiceSettings>;
        voiceSave(input: Record<string, unknown>): Promise<SophenicVoiceSettings>;
        plannerList(): Promise<SophenicPlannerTask[]>;
        plannerSave(input: Record<string, unknown>): Promise<SophenicPlannerTask>;
        plannerDelete(id: string): Promise<boolean>;
        libraryList(): Promise<SophenicLibraryEntry[]>;
        libraryCapacity(): Promise<{ images: number; files: number; imageLimit: number; fileLimit: number }>;
        libraryAdd(input: Record<string, unknown>): Promise<SophenicLibraryEntry>;
        libraryDelete(id: string): Promise<boolean>;
        designList(): Promise<SophenicDesignProjectRecord[]>;
        designSave(input: SophenicDesignProjectRecord): Promise<SophenicDesignProjectRecord>;
        designDelete(id: string): Promise<boolean>;
        openPath(value: string): Promise<boolean>;
        onPlannerCompleted(listener: (payload: { id: string; title: string; ok: boolean; message: string; detail?: string; completedAt: string }) => void): () => void;
      };
      design: {
        analyzeImage(input: { dataUrl: string; name?: string; prompt?: string }): Promise<{ provider: string; model: string; analysis: string }>;
        assetStatus(test?: boolean): Promise<{ sketchfab: { configured: boolean; verified: boolean; account?: string; detail?: string } }>;
        saveSketchfabToken(token: string): Promise<{ sketchfab: { configured: boolean; verified: boolean; account?: string; detail?: string } }>;
        clearSketchfabToken(): Promise<{ sketchfab: { configured: boolean; verified: boolean; detail?: string } }>;
        searchAssets(query: string, limit?: number): Promise<Array<{ provider: "sketchfab"; sourceId: string; name: string; author?: string; license?: string; sourceUrl: string; thumbnailUrl?: string; downloadable: boolean; tags: string[] }>>;
        cacheAsset(input: { provider: "sketchfab"; sourceId: string; name: string; author?: string; license?: string; sourceUrl: string; thumbnailUrl?: string; downloadable: boolean; tags: string[] }): Promise<{ provider: "sketchfab"; sourceId: string; name: string; author?: string; license?: string; sourceUrl: string; thumbnailUrl?: string; downloadable: boolean; tags: string[]; cacheId: string; entryPath: string; format: "gltf" | "glb"; cachedAt: string }>;
        assetBundle(cacheId: string): Promise<{ cacheId: string; entryPath: string; format: "gltf" | "glb"; files: Array<{ path: string; mime: string; bytes: Uint8Array }> }>;
      };
      voice: {
        health(): Promise<Record<string, unknown> & { ok?: boolean; ready?: boolean; local?: boolean; realtime?: boolean }>;
        speech(input: Record<string, unknown>): Promise<Uint8Array>;
        sessionStart(input: { sessionId: string; language?: string; sampleRate: number }): Promise<{ sessionId: string }>;
        sessionAudio(sessionId: string, bytes: Uint8Array): Promise<boolean>;
        sessionAssistantState(sessionId: string, speaking: boolean): Promise<boolean>;
        sessionSynthesize(sessionId: string, input: Record<string, unknown> & { requestId: string; text: string }): Promise<boolean>;
        sessionCancelOutput(sessionId: string, requestId?: string): Promise<boolean>;
        sessionResetInput(sessionId: string): Promise<boolean>;
        sessionStop(sessionId: string): Promise<boolean>;
        onEvent(listener: (payload: Record<string, unknown> & { sessionId: string; type: string; requestId?: string }) => void): () => void;
      };
      code: {
        status(): Promise<{ installed: true; version: string; native: true; hermesRequired: false; status: "ready" }>;
        engines(force?: boolean): Promise<{
          claudeCode: { id: "claude-code"; name: string; installed: boolean; authenticated: boolean; functional: boolean; command?: string; version?: string; authLabel?: string; checkedAt: number; error?: string };
          codex: { id: "codex"; name: string; installed: boolean; authenticated: boolean; functional: boolean; command?: string; version?: string; authLabel?: string; checkedAt: number; error?: string };
          checkedAt: number;
        }>;
        run(input: { requestId: string; cwd: string; prompt: string; effortMode?: "quick" | "auto" | "deep" }): Promise<{ ok: true; text: string; sessionId: string; provider: string; model: string; fallbacks: Array<{ provider: string; model: string }>; version: string; changedFiles: string[]; verification: unknown }>;
        abort(requestId?: string): Promise<boolean>;
        onEvent(listener: (event: { requestId: string; type: string; text?: string; message?: string; name?: string; provider?: string; model?: string; previousProvider?: string; previousModel?: string; reason?: string; input?: unknown; ok?: boolean; steps?: string[]; step?: number; profile?: SophenicAgentRoutePlan["profile"] }) => void): () => void;
      };
      integrations: {
        list(): Promise<IntegrationPermission[]>;
        setPermission(id: string, enabled: boolean, scopes?: string[]): Promise<IntegrationPermission[]>;
        setupComputerUse(): Promise<{ ok: boolean; message: string }>;
        startGoogleOAuth(): Promise<{ canceled: boolean; authUrl?: string; message?: string }>;
        finishGoogleOAuth(redirectUrl: string): Promise<{ ok: boolean; message: string }>;
        openHermesDashboard(): Promise<boolean>;
      };
      openrouter: {
        models(force?: boolean): Promise<OpenRouterModel[]>;
        account(): Promise<OpenRouterAccount>;
        imageModels(force?: boolean): Promise<OpenRouterImageModel[]>;
        chat(input: { requestId: string; provider?: string; model: string; effortMode?: "quick" | "auto" | "deep"; messages: Array<{ role: "user" | "assistant"; content: string; images?: string[]; files?: Array<{ name: string; mime: string; dataUrl: string }> }> }): Promise<OpenRouterChatResult>;
        generateImage(input: { requestId: string; prompt: string; aspectRatio?: string; quality?: "auto" | "low" | "medium" | "high" }): Promise<OpenRouterGeneratedImageResult>;
        abort(requestId: string): Promise<boolean>;
        onStream(listener: (event: { requestId: string; text: string }) => void): () => void;
        onModelNotice(listener: (event: { requestId: string; notice: Record<string, unknown> }) => void): () => void;
      };
      agent: {
        rpc(method: string, params?: Record<string, unknown>): Promise<unknown>;
        createSession(input?: { cwd?: string; model?: string; provider?: string; purpose?: "pc" | "code" | "assistant" }): Promise<Record<string, unknown>>;
        switchModel(sessionId: string, model: string, provider?: string): Promise<unknown>;
        setApprovalMode(mode: "smart"): Promise<unknown>;
        setReasoningEffort(sessionId: string, effort: "none" | "minimal" | "low" | "medium" | "high"): Promise<unknown>;
        respondApproval(requestId: string, choice: "once" | "session" | "deny"): Promise<unknown>;
        respondClarify(requestId: string, answer: string): Promise<unknown>;
        respondSudo(requestId: string, password: string): Promise<unknown>;
        respondSecret(requestId: string, value: string): Promise<unknown>;
        onEvent(listener: (event: HermesGatewayEvent) => void): () => void;
      };
    };
  }
}
