import { Buffer } from "node:buffer";
import { getValidOAuthBundle, type OAuthPluginId } from "./plugin-oauth";

export type PluginInvocation = { provider: OAuthPluginId; action: string; input?: Record<string, unknown> };
export type PluginInvocationResult = { ok: true; provider: OAuthPluginId; action: string; summary: string; data: unknown };

function string(input: Record<string, unknown>, key: string, required = false): string {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (required && !value) throw new Error(`${key} est requis pour cette action.`);
  return value;
}

function cleanData(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 50).map(cleanData);
  if (!value || typeof value !== "object") return typeof value === "string" && value.length > 8_000 ? `${value.slice(0, 8_000)}…` : value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|password|authorization|api.?key/i.test(key)) continue;
    out[key] = cleanData(item);
  }
  return out;
}

async function request(url: string, token: string, init: RequestInit = {}, headers: Record<string, string> = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...headers, ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch { payload = text; }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? payload.message || payload.error?.message || payload.error_description || payload.error : text;
    throw new Error(`Connecteur HTTP ${response.status}: ${String(detail || response.statusText).slice(0, 800)}`);
  }
  return payload;
}

function notionParagraphs(content: string): Array<Record<string, unknown>> {
  return content.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean).slice(0, 100).map((text) => ({
    object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text.slice(0, 1900) } }] }
  }));
}

async function notion(token: string, action: string, input: Record<string, unknown>): Promise<{ summary: string; data: unknown }> {
  const headers = { "Notion-Version": "2026-03-11" };
  if (action === "search") {
    const data = await request("https://api.notion.com/v1/search", token, { method: "POST", body: JSON.stringify({ query: string(input, "query"), page_size: 20 }) }, headers);
    return { summary: `${data.results?.length || 0} résultat(s) Notion.`, data };
  }
  if (action === "create_page") {
    const title = string(input, "title", true); const content = string(input, "content");
    let parentId = string(input, "parentId");
    if (!parentId) {
      const found = await request("https://api.notion.com/v1/search", token, { method: "POST", body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 1 }) }, headers);
      parentId = String(found.results?.[0]?.id || "");
    }
    if (!parentId) throw new Error("Notion n’a exposé aucune page parente. Partage au moins une page avec la connexion SOPHENIC puis réessaie.");
    const body = { parent: { page_id: parentId }, properties: { title: { type: "title", title: [{ type: "text", text: { content: title.slice(0, 500) } }] } }, children: notionParagraphs(content) };
    const data = await request("https://api.notion.com/v1/pages", token, { method: "POST", body: JSON.stringify(body) }, headers);
    return { summary: `Page Notion « ${title} » créée.`, data: { id: data.id, url: data.url, created_time: data.created_time } };
  }
  throw new Error(`Action Notion non prise en charge: ${action}`);
}

function emailRaw(to: string, subject: string, body: string): string {
  const mime = [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
  return Buffer.from(mime, "utf8").toString("base64url");
}

async function google(provider: OAuthPluginId, token: string, action: string, input: Record<string, unknown>): Promise<{ summary: string; data: unknown }> {
  if (provider === "gmail") {
    if (action === "search") {
      const data = await request(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(string(input, "query"))}&maxResults=20`, token);
      return { summary: `${data.resultSizeEstimate || data.messages?.length || 0} e-mail(s) trouvé(s).`, data };
    }
    if (action === "send_email" || action === "create_draft") {
      const to = string(input, "to", true); const subject = string(input, "subject"); const body = string(input, "body", true);
      const endpoint = action === "send_email" ? "send" : "drafts";
      const payload = action === "send_email" ? { raw: emailRaw(to, subject, body) } : { message: { raw: emailRaw(to, subject, body) } };
      const data = await request(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, token, { method: "POST", body: JSON.stringify(payload) });
      return { summary: action === "send_email" ? `E-mail envoyé à ${to}.` : `Brouillon créé pour ${to}.`, data };
    }
  }
  if (provider === "google-drive") {
    if (action === "list_files") {
      const query = string(input, "query");
      const suffix = query ? `&q=${encodeURIComponent(`name contains '${query.replace(/'/g, "\\'")}'`)}` : "";
      const data = await request(`https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,modifiedTime,webViewLink)${suffix}`, token);
      return { summary: `${data.files?.length || 0} fichier(s) Drive.`, data };
    }
    if (action === "create_text_file") {
      const name = string(input, "name", true); const content = string(input, "content", true);
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify({ name, mimeType: "text/plain" })], { type: "application/json" }));
      form.append("file", new Blob([content], { type: "text/plain;charset=utf-8" }));
      const data = await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", token, { method: "POST", body: form });
      return { summary: `Fichier Drive « ${name} » créé.`, data };
    }
  }
  if (provider === "calendar") {
    if (action === "list_events") {
      const data = await request(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(new Date().toISOString())}`, token);
      return { summary: `${data.items?.length || 0} événement(s) à venir.`, data };
    }
    if (action === "create_event") {
      const summary = string(input, "summary", true); const start = string(input, "start", true); const end = string(input, "end", true);
      const data = await request("https://www.googleapis.com/calendar/v3/calendars/primary/events", token, { method: "POST", body: JSON.stringify({ summary, description: string(input, "description"), start: { dateTime: start }, end: { dateTime: end } }) });
      return { summary: `Événement « ${summary} » créé dans Calendar.`, data };
    }
  }
  if (provider === "firebase" && action === "list_projects") {
    const data = await request("https://firebase.googleapis.com/v1beta1/projects?pageSize=30", token);
    return { summary: `${data.results?.length || 0} projet(s) Firebase.`, data };
  }
  throw new Error(`Action ${provider}.${action} non prise en charge.`);
}

async function providerAction(provider: OAuthPluginId, token: string, action: string, input: Record<string, unknown>, extra?: Record<string, string>): Promise<{ summary: string; data: unknown }> {
  if (provider === "notion") return notion(token, action, input);
  if (["gmail", "google-drive", "calendar", "firebase"].includes(provider)) return google(provider, token, action, input);
  if (provider === "supabase" && ["list_organizations", "list_projects"].includes(action)) {
    const endpoint = action === "list_organizations" ? "organizations" : "projects";
    const data = await request(`https://api.supabase.com/v1/${endpoint}`, token);
    return { summary: `${Array.isArray(data) ? data.length : 0} élément(s) Supabase.`, data };
  }
  if (provider === "cloudflare" && action === "list_zones") {
    const data = await request("https://api.cloudflare.com/client/v4/zones?per_page=50", token);
    return { summary: `${data.result?.length || 0} zone(s) Cloudflare.`, data };
  }
  if (provider === "vercel" && action === "list_projects") {
    const data = await request("https://api.vercel.com/v9/projects?limit=50", token);
    return { summary: `${data.projects?.length || 0} projet(s) Vercel.`, data };
  }
  if (provider === "stripe" && action === "list_customers") {
    const data = await request("https://api.stripe.com/v1/customers?limit=25", token);
    return { summary: `${data.data?.length || 0} client(s) Stripe.`, data };
  }
  if (provider === "shopify") {
    const shop = extra?.shopDomain || "";
    if (!shop) throw new Error("Le domaine Shopify manque dans l’autorisation.");
    if (action === "list_products" || action === "list_orders") {
      const resource = action === "list_products" ? "products" : "orders";
      const data = await request(`https://${shop}/admin/api/2026-07/${resource}.json?limit=50`, "", {}, { "X-Shopify-Access-Token": token });
      return { summary: `${data[resource]?.length || 0} ${resource} Shopify.`, data };
    }
  }
  if (provider === "wordpress") {
    const sites = await request("https://public-api.wordpress.com/rest/v1.1/me/sites", token);
    const siteId = string(input, "siteId") || String(sites.sites?.[0]?.ID || "");
    if (!siteId) throw new Error("Aucun site WordPress.com accessible.");
    if (action === "list_posts") {
      const data = await request(`https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(siteId)}/posts/?number=20`, token);
      return { summary: `${data.posts?.length || 0} article(s) WordPress.`, data };
    }
    if (action === "create_post") {
      const title = string(input, "title", true); const content = string(input, "content", true);
      const data = await request(`https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(siteId)}/posts/new`, token, { method: "POST", body: JSON.stringify({ title, content, status: string(input, "status") || "draft" }) });
      return { summary: `Article WordPress « ${title} » créé.`, data };
    }
  }
  throw new Error(`Action ${provider}.${action} non prise en charge.`);
}

export async function invokePluginConnector(invocation: PluginInvocation): Promise<PluginInvocationResult> {
  const action = invocation.action.trim().toLowerCase();
  if (!action) throw new Error("Action connecteur manquante.");
  const allowed = pluginToolCatalog().find((entry) => entry.provider === invocation.provider);
  if (!allowed || !allowed.actions.includes(action)) throw new Error(`Action connecteur non autorisée: ${String(invocation.provider)}.${action}`);
  const bundle = await getValidOAuthBundle(invocation.provider);
  const result = await providerAction(invocation.provider, bundle.accessToken, action, invocation.input || {}, bundle.extra);
  return { ok: true, provider: invocation.provider, action, summary: result.summary, data: cleanData(result.data) };
}

export function pluginToolCatalog(): Array<{ provider: OAuthPluginId; actions: string[] }> {
  return [
    { provider: "notion", actions: ["search", "create_page"] }, { provider: "gmail", actions: ["search", "create_draft", "send_email"] },
    { provider: "google-drive", actions: ["list_files", "create_text_file"] }, { provider: "calendar", actions: ["list_events", "create_event"] },
    { provider: "firebase", actions: ["list_projects"] }, { provider: "supabase", actions: ["list_organizations", "list_projects"] },
    { provider: "cloudflare", actions: ["list_zones"] }, { provider: "vercel", actions: ["list_projects"] },
    { provider: "stripe", actions: ["list_customers"] }, { provider: "shopify", actions: ["list_products", "list_orders"] },
    { provider: "wordpress", actions: ["list_posts", "create_post"] }
  ];
}

export function pluginToolPromptCatalog(): string[] {
  return [
    "- notion.search input {query?: string}; notion.create_page input {title: string, content?: string, parentId?: string}.",
    "- gmail.search input {query?: string}; gmail.create_draft input {to: string, body: string, subject?: string}; gmail.send_email input {to: string, body: string, subject?: string}. L'objet Gmail est facultatif et peut être une chaîne vide.",
    "- google-drive.list_files input {query?: string}; google-drive.create_text_file input {name: string, content: string}.",
    "- calendar.list_events input {}; calendar.create_event input {summary: string, start: string ISO-8601, end: string ISO-8601, description?: string}.",
    "- firebase.list_projects input {}; supabase.list_organizations input {}; supabase.list_projects input {}; cloudflare.list_zones input {}; vercel.list_projects input {}; stripe.list_customers input {}.",
    "- shopify.list_products input {}; shopify.list_orders input {}. Ces actions concernent uniquement une boutique déjà autorisée; ne fabrique jamais une action create_store inexistante.",
    "- wordpress.list_posts input {siteId?: string}; wordpress.create_post input {siteId?: string, title: string, content: string, status?: string}."
  ];
}
