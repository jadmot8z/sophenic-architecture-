import { runtimeEnv } from "./runtime-env";
import type { OAuthPluginId } from "./oauth-provider-registry";

export type BrokerSession = { session_id: string; poll_token: string; authorization_url: string; expires_at: string };
export type BrokerToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  account?: string;
  extra?: Record<string, string>;
};
export type BrokerProviderState = { configured: boolean; detail?: string };
export type BrokerProviderMap = Partial<Record<OAuthPluginId, BrokerProviderState>>;

function cleanBaseUrl(value: string): string {
  const raw = value.trim().replace(/\/$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    // Never treat documentation/example domains as a configured production broker.
    if (parsed.hostname.endsWith(".example") || parsed.hostname === "connect.sophenic.example") return "";
    const remoteHttps = parsed.protocol === "https:";
    const localHttp = parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    return remoteHttps || localHttp ? parsed.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return { detail: text.slice(0, 500) };
  }
}

export class OAuthBrokerClient {
  readonly baseUrl: string;
  readonly distributionKey: string;

  constructor() {
    this.baseUrl = cleanBaseUrl(runtimeEnv("SOPHENIC_OAUTH_BROKER_URL"));
    this.distributionKey = runtimeEnv("SOPHENIC_OAUTH_BROKER_DISTRIBUTION_KEY");
  }

  get configured(): boolean { return Boolean(this.baseUrl); }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", ...(this.distributionKey ? { "X-Sophenic-Distribution-Key": this.distributionKey } : {}) };
  }

  async providerStates(): Promise<BrokerProviderMap> {
    if (!this.configured) return {};
    const response = await fetch(`${this.baseUrl}/v1/oauth/providers`, {
      headers: this.headers(), signal: AbortSignal.timeout(8_000)
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(String(payload.detail || "Le broker OAuth SOPHENIC est indisponible."));
    const providers = payload.providers;
    return providers && typeof providers === "object" && !Array.isArray(providers) ? providers as BrokerProviderMap : {};
  }

  async createSession(input: { provider: OAuthPluginId; state: string; desktopCallback: string; options?: Record<string, string> }): Promise<BrokerSession> {
    if (!this.configured) throw new Error("Le service OAuth SOPHENIC n'est pas configuré dans cette distribution.");
    const response = await fetch(`${this.baseUrl}/v1/oauth/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ provider: input.provider, state: input.state, desktop_callback: input.desktopCallback, options: input.options || {} }),
      signal: AbortSignal.timeout(20_000)
    });
    const payload = await responsePayload(response) as Partial<BrokerSession> & { detail?: string };
    if (!response.ok || !payload.session_id || !payload.poll_token || !payload.authorization_url) {
      throw new Error(String(payload.detail || "Le service de connexion SOPHENIC est momentanément indisponible."));
    }
    return payload as BrokerSession;
  }

  async claim(session: BrokerSession, signal?: AbortSignal): Promise<BrokerToken> {
    const deadline = Math.min(Date.parse(session.expires_at) || Date.now() + 180_000, Date.now() + 180_000);
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
      const response = await fetch(`${this.baseUrl}/v1/oauth/sessions/${encodeURIComponent(session.session_id)}`, {
        headers: { ...this.headers(), Authorization: `Bearer ${session.poll_token}` }, signal: requestSignal
      });
      const payload = await responsePayload(response);
      if (response.status === 202 || payload.status === "pending") {
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      if (!response.ok) throw new Error(String(payload.detail || payload.error || "La connexion OAuth a échoué."));
      if (typeof payload.access_token !== "string" || !payload.access_token) throw new Error("Le broker OAuth n’a renvoyé aucun jeton utilisable.");
      return payload as BrokerToken;
    }
    throw new Error("Le délai d’autorisation a expiré. Clique de nouveau sur Connecter.");
  }

  async refresh(provider: OAuthPluginId, refreshToken: string, options?: Record<string, string>): Promise<BrokerToken> {
    if (!this.configured) throw new Error("Le broker OAuth SOPHENIC n'est pas disponible pour renouveler la connexion.");
    const response = await fetch(`${this.baseUrl}/v1/oauth/refresh`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ provider, refresh_token: refreshToken, options: options || {} }),
      signal: AbortSignal.timeout(30_000)
    });
    const payload = await responsePayload(response) as BrokerToken & { detail?: string };
    if (!response.ok || !payload.access_token) throw new Error(String(payload.detail || "Le renouvellement OAuth a échoué."));
    return payload;
  }
}
