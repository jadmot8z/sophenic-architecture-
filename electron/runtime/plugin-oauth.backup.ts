import crypto from "node:crypto";
import http from "node:http";
import { shell } from "electron";
import { clearConnectorSecret, readConnectorSecret, writeConnectorSecret } from "./code-engine/connector-secrets";
import { OAuthBrokerClient, type BrokerToken } from "./oauth-broker-client";
import { OAuthProviderRegistry, type OAuthPluginId, type OAuthProviderConfig } from "./oauth-provider-registry";
import { runtimeEnv } from "./runtime-env";

export type { OAuthPluginId } from "./oauth-provider-registry";

export type OAuthTokenBundle = {
  provider: OAuthPluginId;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
  account?: string;
  connectedAt: string;
  tokenType?: string;
  extra?: Record<string, string>;
};

const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PORT = Number(runtimeEnv("SOPHENIC_OAUTH_LOOPBACK_PORT") || 43823);

function env(name: string): string { return runtimeEnv(name); }
function secretName(id: OAuthPluginId): string { return `plugin-oauth-${id}`; }
function encodeBase64Url(input: Buffer): string { return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function randomUrlSafe(bytes = 32): string { return encodeBase64Url(crypto.randomBytes(bytes)); }
function pkceChallenge(verifier: string): string { return encodeBase64Url(crypto.createHash("sha256").update(verifier).digest()); }

function providerConfig(id: OAuthPluginId): OAuthProviderConfig { return OAuthProviderRegistry.get(id); }

export function readOAuthBundle(id: OAuthPluginId): OAuthTokenBundle | null {
  const raw = readConnectorSecret(secretName(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthTokenBundle;
    return parsed?.provider === id && parsed.accessToken ? parsed : null;
  } catch { return null; }
}

export function clearOAuthBundle(id: OAuthPluginId): void { clearConnectorSecret(secretName(id)); }
function callbackUrl(id: OAuthPluginId): string { return `http://${CALLBACK_HOST}:${CALLBACK_PORT}/oauth/${encodeURIComponent(id)}/callback`; }

function waitForCallback(id: OAuthPluginId, state: string, timeoutMs = 180_000, signal?: AbortSignal): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    let server: http.Server | null = null;
    const finish = (error?: Error, code?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { server?.close(); } catch {}
      if (error) reject(error); else resolve({ code: code || "" });
    };
    server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);
        if (url.pathname !== `/oauth/${id}/callback`) { res.writeHead(404); res.end("Not found"); return; }
        if (url.searchParams.get("state") !== state) { res.writeHead(400); res.end("Invalid state"); finish(new Error("État OAuth invalide.")); return; }
        const error = url.searchParams.get("error");
        if (error) { res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Autorisation refusée. Tu peux fermer cette page."); finish(new Error(url.searchParams.get("error_description") || error)); return; }
        const code = url.searchParams.get("code") || "";
        if (!code) { res.writeHead(400); res.end("Missing code"); finish(new Error("Le fournisseur n’a pas renvoyé de code OAuth.")); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<!doctype html><meta charset=utf-8><title>SOPHENIC</title><body style='font-family:system-ui;padding:48px;background:#07110c;color:#effaf2'><h2>Compte connecté à SOPHENIC</h2><p>Autorisation reçue. Tu peux fermer cette page et revenir dans l’application.</p></body>");
        finish(undefined, code);
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
    server.on("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
    server.listen(CALLBACK_PORT, CALLBACK_HOST);
    timer = setTimeout(() => finish(new Error("Le délai d’autorisation a expiré. Clique de nouveau sur Connecter.")), timeoutMs);
    signal?.addEventListener("abort", () => finish(new Error("Autorisation OAuth interrompue.")), { once: true });
  });
}

function waitForBrokerCallback(id: OAuthPluginId, state: string, timeoutMs = 180_000, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    let server: http.Server | null = null;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { server?.close(); } catch {}
      if (error) reject(error); else resolve();
    };
    server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);
        if (url.pathname !== `/oauth/${id}/callback`) { res.writeHead(404); res.end("Not found"); return; }
        if (url.searchParams.get("state") !== state) { res.writeHead(400); res.end("Invalid state"); finish(new Error("État OAuth invalide.")); return; }
        const error = url.searchParams.get("error");
        if (error) { res.writeHead(400); res.end("Autorisation refusée. Tu peux fermer cette page."); finish(new Error(url.searchParams.get("error_description") || error)); return; }
        if (url.searchParams.get("status") !== "connected") { res.writeHead(400); res.end("OAuth incomplete"); finish(new Error("La connexion OAuth n’a pas été finalisée.")); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<!doctype html><meta charset=utf-8><title>SOPHENIC</title><body style='font-family:system-ui;padding:48px;background:#07110c;color:#effaf2'><h2>Compte connecté à SOPHENIC</h2><p>La connexion est sécurisée. Tu peux fermer cette page et revenir dans l’application.</p></body>");
        finish();
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
    server.on("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
    server.listen(CALLBACK_PORT, CALLBACK_HOST);
    timer = setTimeout(() => finish(new Error("Le délai d’autorisation a expiré. Clique de nouveau sur Connecter.")), timeoutMs);
    signal?.addEventListener("abort", () => finish(new Error("Autorisation OAuth interrompue.")), { once: true });
  });
}

async function jsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return Object.fromEntries(new URLSearchParams(text)); }
}

async function accountLabel(id: OAuthPluginId, token: string, tokenJson: any, config: OAuthProviderConfig): Promise<string> {
  try {
    if (["gmail", "google-drive", "calendar", "firebase"].includes(id)) {
      const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(j.email || j.name || "Google");
    }
    if (id === "vercel") {
      const r = await fetch("https://api.vercel.com/login/oauth/userinfo", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(j.email || j.name || j.username || "Vercel");
    }
    if (id === "cloudflare") {
      const r = await fetch("https://dash.cloudflare.com/oauth2/userinfo", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(j.email || j.name || "Cloudflare");
    }
    if (id === "supabase") {
      const r = await fetch("https://api.supabase.com/v1/organizations", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(Array.isArray(j) && j[0] ? j[0].name || j[0].slug : "Supabase");
    }
    if (id === "notion") {
      const r = await fetch("https://api.notion.com/v1/users/me", { headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2026-03-11" }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(j.name || tokenJson?.workspace_name || "Notion");
    }
    if (id === "stripe") {
      const r = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(j.business_profile?.name || j.id || tokenJson?.stripe_user_id || "Stripe");
    }
    if (id === "shopify") return env(config.shopDomainEnv || "") || "Shopify";
    if (id === "wordpress") {
      const r = await fetch("https://public-api.wordpress.com/rest/v1.1/me", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      const j = await jsonResponse(r); return String(j.display_name || j.username || "WordPress.com");
    }
  } catch {}
  return id;
}

let oauthConnectionInProgress = false;

async function connectPluginOAuthInternal(id: OAuthPluginId): Promise<OAuthTokenBundle> {
  const broker = new OAuthBrokerClient();
  if (broker.configured) {
    const state = randomUrlSafe(24);
    const session = await broker.createSession({ provider: id, state, desktopCallback: callbackUrl(id) });
    // N'ouvre le port loopback qu'après validation du broker : une panne réseau
    // ne laisse ainsi aucun serveur orphelin pendant le délai OAuth.
    const callbackAbort = new AbortController();
    const callback = waitForBrokerCallback(id, state, 180_000, callbackAbort.signal);
    const claim = broker.claim(session, callbackAbort.signal);
    let token: BrokerToken;
    try {
      await shell.openExternal(session.authorization_url);
      await Promise.race([callback, claim.then(() => undefined)]);
      token = await claim;
    } finally {
      callbackAbort.abort();
      await Promise.allSettled([callback, claim]);
    }
    const expiresIn = Number(token.expires_in || 0);
    const bundle: OAuthTokenBundle = {
      provider: id,
      accessToken: token.access_token,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
      ...(expiresIn > 0 ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
      scopes: String(token.scope || "").split(/[ ,]+/).filter(Boolean),
      account: token.account || id,
      connectedAt: new Date().toISOString(),
      tokenType: token.token_type || "Bearer",
      ...(token.extra ? { extra: token.extra } : {})
    };
    writeConnectorSecret(secretName(id), JSON.stringify(bundle));
    return bundle;
  }

  if (env("SOPHENIC_OAUTH_ALLOW_LOCAL_DEV").toLowerCase() !== "true") {
    throw new Error("Connexion temporairement indisponible. Cette intégration doit être provisionnée une seule fois par SOPHENIC côté serveur ; aucune clé ne doit être demandée à l’utilisateur final.");
  }
  const config = providerConfig(id);
  const clientId = env(config.clientIdEnv);
  const clientSecret = config.clientSecretEnv ? env(config.clientSecretEnv) : "";
  if (!clientId) {
    throw new Error("Mode développement OAuth incomplet. L’éditeur SOPHENIC doit provisionner cette application une seule fois côté serveur.");
  }
  if (config.clientSecretEnv && !clientSecret && (config.basicTokenAuth || config.tokenClientSecretField)) {
    throw new Error(`${id}: le secret OAuth de l’application SOPHENIC manque côté runtime sécurisé. Il ne doit jamais être demandé dans l’interface Plugins.`);
  }

  const redirectUri = callbackUrl(id);
  const state = randomUrlSafe(24);
  const verifier = config.pkce ? randomUrlSafe(48) : "";
  const authorization = new URL(config.authorizationEndpoint);
  authorization.searchParams.set("client_id", clientId);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("state", state);
  if (config.scopes.length) authorization.searchParams.set("scope", id === "shopify" ? config.scopes.join(",") : config.scopes.join(" "));
  if (verifier) { authorization.searchParams.set("code_challenge", pkceChallenge(verifier)); authorization.searchParams.set("code_challenge_method", "S256"); }
  for (const [key, value] of Object.entries(config.extraAuthorize || {})) authorization.searchParams.set(key, value);

  const callbackAbort = new AbortController();
  const callback = waitForCallback(id, state, 180_000, callbackAbort.signal);
  let code = "";
  try {
    await shell.openExternal(authorization.toString());
    ({ code } = await callback);
  } finally {
    callbackAbort.abort();
    await callback.catch(() => undefined);
  }

  const tokenValues: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: redirectUri };
  if (verifier) tokenValues.code_verifier = verifier;
  if (!config.basicTokenAuth) tokenValues.client_id = clientId;
  if (config.tokenClientSecretField && clientSecret) tokenValues[config.tokenClientSecretField] = clientSecret;
  for (const [key, value] of Object.entries(config.extraToken || {})) tokenValues[key] = value;
  if (clientSecret && !config.basicTokenAuth && !config.tokenClientSecretField) tokenValues.client_secret = clientSecret;

  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": config.jsonTokenBody ? "application/json" : "application/x-www-form-urlencoded" };
  if (config.basicTokenAuth) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  if (id === "notion") headers["Notion-Version"] = "2026-03-11";
  const tokenBody = config.jsonTokenBody ? JSON.stringify(tokenValues) : new URLSearchParams(tokenValues);

  const response = await fetch(config.tokenEndpoint, { method: "POST", headers, body: tokenBody, signal: AbortSignal.timeout(30_000) });
  const tokenJson = await jsonResponse(response);
  const accessToken = String(tokenJson.access_token || "").trim();
  if (!response.ok || !accessToken) throw new Error(String(tokenJson.error_description || tokenJson.error || `OAuth ${id} a échoué (HTTP ${response.status}).`));

  const expiresIn = Number(tokenJson.expires_in || 0);
  const extra = id === "shopify" ? { shopDomain: env(config.shopDomainEnv || "") } : undefined;
  const bundle: OAuthTokenBundle = {
    provider: id,
    accessToken,
    ...(tokenJson.refresh_token ? { refreshToken: String(tokenJson.refresh_token) } : {}),
    ...(expiresIn > 0 ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
    scopes: String(tokenJson.scope || "").split(/[ ,]+/).filter(Boolean).length ? String(tokenJson.scope).split(/[ ,]+/).filter(Boolean) : config.scopes,
    account: await accountLabel(id, accessToken, tokenJson, config),
    connectedAt: new Date().toISOString(),
    tokenType: String(tokenJson.token_type || "Bearer"),
    ...(extra ? { extra } : {})
  };
  writeConnectorSecret(secretName(id), JSON.stringify(bundle));
  return bundle;
}

export async function connectPluginOAuth(id: OAuthPluginId): Promise<OAuthTokenBundle> {
  if (oauthConnectionInProgress) throw new Error("Une autorisation est déjà en cours. Termine-la dans le navigateur avant de connecter un autre plugin.");
  oauthConnectionInProgress = true;
  try { return await connectPluginOAuthInternal(id); }
  finally { oauthConnectionInProgress = false; }
}

export function pluginOAuthConfigured(id: OAuthPluginId): boolean {
  const broker = new OAuthBrokerClient();
  if (broker.configured) return true;
  if (env("SOPHENIC_OAUTH_ALLOW_LOCAL_DEV").toLowerCase() !== "true") return false;
  try { return Boolean(env(providerConfig(id).clientIdEnv)); } catch { return false; }
}

export async function getValidOAuthBundle(id: OAuthPluginId): Promise<OAuthTokenBundle> {
  const current = readOAuthBundle(id);
  if (!current) throw new Error(`${id} n’est pas connecté. Ouvre Paramètres → Plugins puis clique sur Connecter.`);
  const expiresAt = current.expiresAt ? Date.parse(current.expiresAt) : 0;
  if (!expiresAt || expiresAt > Date.now() + 60_000) return current;
  if (!current.refreshToken) throw new Error(`${id} doit être reconnecté pour renouveler l’autorisation.`);
  const broker = new OAuthBrokerClient();
  if (!broker.configured) throw new Error(`${id} doit être reconnecté ; le broker OAuth n’est pas disponible pour renouveler le jeton.`);
  const token = await broker.refresh(id, current.refreshToken);
  const expiresIn = Number(token.expires_in || 0);
  const next: OAuthTokenBundle = {
    ...current,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || current.refreshToken,
    ...(expiresIn > 0 ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() } : {}),
    scopes: String(token.scope || "").split(/[ ,]+/).filter(Boolean).length ? String(token.scope).split(/[ ,]+/).filter(Boolean) : current.scopes,
    tokenType: token.token_type || current.tokenType || "Bearer"
  };
  writeConnectorSecret(secretName(id), JSON.stringify(next));
  return next;
}

export function pluginOAuthEnvironment(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  const names: Array<[OAuthPluginId, string]> = [
    ["vercel", "VERCEL_ACCESS_TOKEN"], ["supabase", "SUPABASE_ACCESS_TOKEN"], ["cloudflare", "CLOUDFLARE_OAUTH_TOKEN"],
    ["firebase", "GOOGLE_CLOUD_ACCESS_TOKEN"], ["gmail", "GMAIL_OAUTH_TOKEN"], ["google-drive", "GOOGLE_DRIVE_OAUTH_TOKEN"],
    ["calendar", "GOOGLE_CALENDAR_OAUTH_TOKEN"], ["notion", "NOTION_TOKEN"], ["stripe", "STRIPE_OAUTH_TOKEN"],
    ["shopify", "SHOPIFY_ACCESS_TOKEN"], ["wordpress", "WORDPRESS_OAUTH_TOKEN"]
  ];
  for (const [id, key] of names) { const bundle = readOAuthBundle(id); if (bundle?.accessToken) out[key] = bundle.accessToken; }
  const shop = readOAuthBundle("shopify")?.extra?.shopDomain; if (shop) out.SHOPIFY_SHOP_DOMAIN = shop;
  return out;
}
