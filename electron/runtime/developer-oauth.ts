import { clipboard, dialog, shell } from "electron";
import { clearConnectorSecret, readConnectorSecret, writeConnectorSecret } from "./code-engine/connector-secrets";
import type { GithubConnector } from "./code-engine/connectors/github";
import type { VercelConnector } from "./code-engine/connectors/vercel";

export type DeveloperOAuthProvider = "github" | "vercel";

export type DeveloperOAuthConnection = {
  provider: DeveloperOAuthProvider;
  connected: boolean;
  username?: string;
  name?: string;
  accountId?: string;
  scopes: string[];
  connectedAt?: string;
  credentialType?: "oauth" | "personal_access_token";
};

type OAuthBundle = {
  provider: DeveloperOAuthProvider;
  accessToken: string;
  credentialType: "oauth" | "personal_access_token";
  scopes: string[];
  accountId?: string;
  username?: string;
  name?: string;
  connectedAt: string;
};

type CodeConnectors = {
  github: GithubConnector;
  vercel: VercelConnector;
};

const DEFAULT_SOPHENIC_GITHUB_CLIENT_ID = "Ov23livNj43OaKhQspRt";
const GITHUB_DEVICE_URL = "https://github.com/login/device";
const GITHUB_PAT_URL = "https://github.com/settings/personal-access-tokens/new";
const VERCEL_TOKEN_URL = "https://vercel.com/account/tokens";
const VERCEL_DASHBOARD_URL = "https://vercel.com/dashboard";

function bundleName(provider: DeveloperOAuthProvider): string {
  return `${provider}-oauth`;
}

function readBundle(provider: DeveloperOAuthProvider): OAuthBundle | null {
  const raw = readConnectorSecret(bundleName(provider));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthBundle;
    if (!parsed || parsed.provider !== provider || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBundle(bundle: OAuthBundle): void {
  writeConnectorSecret(bundleName(bundle.provider), JSON.stringify(bundle));
  writeConnectorSecret(bundle.provider, bundle.accessToken);
}

function clearBundle(provider: DeveloperOAuthProvider): void {
  clearConnectorSecret(bundleName(provider));
  clearConnectorSecret(provider);
}

function currentToken(provider: DeveloperOAuthProvider): string {
  return readBundle(provider)?.accessToken || readConnectorSecret(provider);
}

function githubClientId(): string {
  const fromEnv = (process.env.SOPHENIC_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "").trim();
  return fromEnv || DEFAULT_SOPHENIC_GITHUB_CLIENT_ID;
}

function githubPatLooksValid(token: string): boolean {
  return token.startsWith("github_pat_") || token.startsWith("ghp_");
}

function vercelPatLooksValid(token: string): boolean {
  return token.startsWith("vcp_") || /^[A-Za-z0-9_-]{20,}$/.test(token);
}

async function githubDeviceConnect(connectors: CodeConnectors): Promise<void> {
  const clientId = githubClientId();
  if (!/^[A-Za-z0-9_]{10,200}$/.test(clientId)) {
    throw new Error("Le Client ID public GitHub de SOPHENIC est invalide.");
  }

  const deviceResponse = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: "repo read:user user:email"
    }),
    signal: AbortSignal.timeout(30_000)
  });

  const device = await deviceResponse.json() as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };

  if (!deviceResponse.ok || !device.device_code || !device.user_code) {
    const detail = device.error_description || device.error || "GitHub n’a pas fourni de code d’autorisation.";
    if (String(device.error) === "device_flow_disabled") {
      throw new Error("GitHub Device Flow est désactivé. Dans Developer settings → OAuth Apps → SOPHENIC AI Developer, active « Enable Device Flow », puis réessaie.");
    }
    throw new Error(detail);
  }

  const verificationUri = device.verification_uri || GITHUB_DEVICE_URL;
  clipboard.writeText(device.user_code);
  await shell.openExternal(verificationUri);

  void dialog.showMessageBox({
    type: "info",
    title: "Connecter GitHub à SOPHENIC",
    message: "Autorise SOPHENIC sur GitHub",
    detail: `Le code ${device.user_code} a été copié dans le presse-papiers.\n\nLe navigateur GitHub est ouvert. Colle le code, clique sur Continue puis Authorize.`,
    buttons: ["Compris"],
    defaultId: 0,
    noLink: true
  });

  let intervalMs = Math.max(5, Number(device.interval || 5)) * 1000;
  const deadline = Date.now() + Math.max(60, Number(device.expires_in || 900)) * 1000;
  let accessToken = "";

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      }),
      signal: AbortSignal.timeout(30_000)
    });

    const token = await tokenResponse.json() as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (token.access_token) {
      accessToken = token.access_token;
      break;
    }

    if (token.error === "authorization_pending") continue;
    if (token.error === "slow_down") {
      intervalMs += 5_000;
      continue;
    }
    if (token.error === "device_flow_disabled") {
      throw new Error("GitHub Device Flow est désactivé dans ton OAuth App. Active « Enable Device Flow » puis réessaie.");
    }
    if (token.error === "access_denied") throw new Error("Autorisation GitHub refusée.");
    if (token.error === "expired_token") throw new Error("Le code GitHub a expiré. Clique de nouveau sur Connecter GitHub.");
    throw new Error(token.error_description || token.error || "GitHub OAuth a échoué.");
  }

  if (!accessToken) throw new Error("Le délai d’autorisation GitHub a expiré. Clique de nouveau sur Connecter GitHub.");

  connectors.github.setToken(accessToken, false);
  const validated = await connectors.github.validate();
  if (!validated.connected || !validated.login) {
    connectors.github.setToken("", false);
    throw new Error("GitHub a autorisé la demande mais le profil n’a pas pu être vérifié.");
  }

  writeBundle({
    provider: "github",
    accessToken,
    credentialType: "oauth",
    scopes: ["repo", "read:user", "user:email"],
    username: validated.login,
    connectedAt: new Date().toISOString()
  });
}

async function connectVercelFromStoredToken(connectors: CodeConnectors): Promise<void> {
  const token = currentToken("vercel") || (process.env.SOPHENIC_VERCEL_TOKEN || process.env.VERCEL_TOKEN || "").trim();
  if (!token) {
    // Vercel n'a pas de flux OAuth natif ici : la connexion se fait par token
    // personnel. On ouvre la page des tokens et on GUIDE explicitement au lieu
    // de revenir silencieusement (l'utilisateur croyait que « ça ne marchait pas »).
    await shell.openExternal(VERCEL_TOKEN_URL);
    throw new Error("Vercel se connecte par token personnel : crée un token sur la page qui vient de s’ouvrir (Account → Tokens, il commence par vcp_), puis colle-le dans Plugins → Vercel → Connecter.");
  }

  connectors.vercel.setToken(token, false);
  const validated = await connectors.vercel.validate();
  if (!validated.connected) throw new Error("Le token Vercel enregistré n’est plus valide.");

  writeBundle({
    provider: "vercel",
    accessToken: token,
    credentialType: "personal_access_token",
    scopes: ["Vercel API"],
    ...(validated.username ? { username: validated.username } : {}),
    connectedAt: readBundle("vercel")?.connectedAt || new Date().toISOString()
  });
}

export async function restoreDeveloperOAuth(connectors: CodeConnectors): Promise<void> {
  const github = currentToken("github");
  if (github) connectors.github.setToken(github, false);

  const vercel = currentToken("vercel") || (process.env.SOPHENIC_VERCEL_TOKEN || process.env.VERCEL_TOKEN || "").trim();
  if (vercel) connectors.vercel.setToken(vercel, false);
}

async function connectionStatus(provider: DeveloperOAuthProvider, connectors: CodeConnectors): Promise<DeveloperOAuthConnection> {
  const bundle = readBundle(provider);
  const token = bundle?.accessToken || readConnectorSecret(provider) || (provider === "vercel" ? (process.env.SOPHENIC_VERCEL_TOKEN || process.env.VERCEL_TOKEN || "").trim() : "");
  if (!token) return { provider, connected: false, scopes: [] };

  try {
    if (provider === "github") {
      connectors.github.setToken(token, false);
      const validated = await connectors.github.validate();
      return {
        provider,
        connected: validated.connected,
        ...(validated.login || bundle?.username ? { username: validated.login || bundle?.username } : {}),
        scopes: bundle?.scopes || [],
        ...(bundle?.connectedAt ? { connectedAt: bundle.connectedAt } : {}),
        ...(bundle?.credentialType ? { credentialType: bundle.credentialType } : {})
      };
    }

    connectors.vercel.setToken(token, false);
    const validated = await connectors.vercel.validate();
    return {
      provider,
      connected: validated.connected,
      ...(validated.username || bundle?.username ? { username: validated.username || bundle?.username } : {}),
      scopes: bundle?.scopes || ["Vercel API"],
      ...(bundle?.connectedAt ? { connectedAt: bundle.connectedAt } : {}),
      credentialType: "personal_access_token"
    };
  } catch {
    return {
      provider,
      connected: false,
      ...(bundle?.username ? { username: bundle.username } : {}),
      scopes: bundle?.scopes || [],
      ...(bundle?.connectedAt ? { connectedAt: bundle.connectedAt } : {}),
      ...(bundle?.credentialType ? { credentialType: bundle.credentialType } : {})
    };
  }
}

export async function developerOAuthStatus(connectors: CodeConnectors): Promise<DeveloperOAuthConnection[]> {
  return Promise.all([connectionStatus("github", connectors), connectionStatus("vercel", connectors)]);
}

export async function connectDeveloperOAuth(provider: DeveloperOAuthProvider, connectors: CodeConnectors): Promise<DeveloperOAuthConnection[]> {
  if (provider === "github") await githubDeviceConnect(connectors);
  else await connectVercelFromStoredToken(connectors);
  return developerOAuthStatus(connectors);
}

export async function saveDeveloperPersonalToken(provider: DeveloperOAuthProvider, rawToken: string, connectors: CodeConnectors): Promise<DeveloperOAuthConnection[]> {
  const token = rawToken.trim();
  if (!token) throw new Error("Colle d’abord un token.");

  if (provider === "github" && !githubPatLooksValid(token)) {
    throw new Error("Clé GitHub invalide pour ce champ. Ici SOPHENIC attend un Personal Access Token commençant par « github_pat_ » ou « ghp_ ». Un Client Secret OAuth GitHub ne fonctionne pas comme token API.");
  }
  if (provider === "vercel" && !vercelPatLooksValid(token)) {
    throw new Error("Token Vercel invalide. Colle le Personal Access Token créé dans Vercel → Account → Tokens (généralement vcp_…).");
  }

  const previousToken = currentToken(provider);

  try {
    if (provider === "github") {
      connectors.github.setToken(token, false);
      const validated = await connectors.github.validate();
      if (!validated.connected || !validated.login) throw new Error("GitHub a refusé ce Personal Access Token. Vérifie qu’il n’est pas expiré/révoqué et qu’il s’agit bien d’un PAT, pas d’un Client Secret.");
      writeBundle({
        provider: "github",
        accessToken: token,
        credentialType: "personal_access_token",
        scopes: ["PAT GitHub"],
        username: validated.login,
        connectedAt: new Date().toISOString()
      });
    } else {
      connectors.vercel.setToken(token, false);
      const validated = await connectors.vercel.validate();
      if (!validated.connected) throw new Error("Vercel a refusé ce token.");
      writeBundle({
        provider: "vercel",
        accessToken: token,
        credentialType: "personal_access_token",
        scopes: ["Vercel API"],
        ...(validated.username ? { username: validated.username } : {}),
        connectedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    if (provider === "github") connectors.github.setToken(previousToken, false);
    else connectors.vercel.setToken(previousToken, false);
    throw error;
  }

  return developerOAuthStatus(connectors);
}

export async function disconnectDeveloperOAuth(provider: DeveloperOAuthProvider, connectors: CodeConnectors): Promise<DeveloperOAuthConnection[]> {
  clearBundle(provider);
  if (provider === "github") connectors.github.setToken("", false);
  else connectors.vercel.setToken("", false);
  return developerOAuthStatus(connectors);
}

export async function openDeveloperProviderPortal(provider: DeveloperOAuthProvider, target: "connect" | "token" | "dashboard" = "connect"): Promise<boolean> {
  if (provider === "github") {
    await shell.openExternal(target === "dashboard" ? "https://github.com/" : GITHUB_PAT_URL);
    return true;
  }

  await shell.openExternal(target === "dashboard" ? VERCEL_DASHBOARD_URL : VERCEL_TOKEN_URL);
  return true;
}

export async function testDeveloperVercelUrl(input: string, connectors: CodeConnectors): Promise<{ ok: true; target: string; output: string }> {
  const result = await connectors.vercel.inspect(input);
  if (result.code !== 0) throw new Error(result.output || "Cette URL Vercel n’est pas accessible avec le token enregistré.");
  return { ok: true, target: result.target, output: result.output };
}

export function developerOAuthConfiguration() {
  return {
    github: {
      configured: true,
      mode: "device" as const,
      authorizationUrl: GITHUB_DEVICE_URL,
      tokenPortalUrl: GITHUB_PAT_URL
    },
    vercel: {
      configured: Boolean(currentToken("vercel") || (process.env.SOPHENIC_VERCEL_TOKEN || process.env.VERCEL_TOKEN || "").trim()),
      mode: "token" as const,
      authorizationUrl: VERCEL_TOKEN_URL,
      dashboardUrl: VERCEL_DASHBOARD_URL
    }
  };
}
