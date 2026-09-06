import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { URL } from "node:url";

export type WebSearchResult = { title: string; url: string; snippet: string };

const USER_AGENT = "SOPHENIC-CodeEngine/6.0 (+local autonomous developer agent)";

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function privateIp(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0.0.0.0" || normalized === "127.0.0.1") return true;
  if (/^10\./.test(normalized) || /^127\./.test(normalized) || /^169\.254\./.test(normalized) || /^192\.168\./.test(normalized)) return true;
  const v172 = /^172\.(\d{1,3})\./.exec(normalized); if (v172 && Number(v172[1]) >= 16 && Number(v172[1]) <= 31) return true;
  if (normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return false;
}

function safeHttpUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Seules les URL HTTP(S) sont autorisées.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("La recherche Web ne peut pas lire une adresse locale.");
  if (isIP(host) && privateIp(host)) throw new Error("La recherche Web ne peut pas lire une adresse réseau privée.");
  return url;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) { if (privateIp(host)) throw new Error("Adresse réseau privée interdite."); return; }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => privateIp(entry.address))) throw new Error("La page cible résout vers un réseau local ou privé.");
}

async function fetchPublic(urlValue: string, init: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = safeHttpUrl(urlValue);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    await assertPublicHost(current);
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    if (redirect >= maxRedirects) throw new Error("Trop de redirections Web.");
    current = safeHttpUrl(new URL(location, current).toString());
  }
  throw new Error("Redirection Web invalide.");
}

export class WebResearchConnector {
  async search(query: string, limit = 6): Promise<WebSearchResult[]> {
    const clean = query.trim();
    if (!clean) return [];
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(clean)}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`Recherche Web HTTP ${response.status}`);
    const html = await response.text();
    const results: WebSearchResult[] = [];
    const linkPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(html)) && results.length < Math.max(1, Math.min(limit, 10))) {
      const rawUrl = match[1].replace(/&amp;/g, "&");
      let resolved = rawUrl;
      try {
        const candidate = new URL(rawUrl, "https://duckduckgo.com");
        const redirected = candidate.searchParams.get("uddg");
        resolved = redirected ? decodeURIComponent(redirected) : candidate.toString();
        safeHttpUrl(resolved);
      } catch { continue; }
      const title = cleanText(match[2]);
      const tail = html.slice(linkPattern.lastIndex, linkPattern.lastIndex + 1800);
      const snippetMatch = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\//i.exec(tail);
      results.push({ title: title || resolved, url: resolved, snippet: snippetMatch ? cleanText(snippetMatch[1]).slice(0, 500) : "" });
    }
    return results;
  }

  async fetch(urlValue: string, maxChars = 18_000): Promise<{ url: string; status: number; contentType: string; text: string }> {
    const response = await fetchPublic(urlValue.trim(), {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(25_000)
    });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    const text = /html/i.test(contentType) ? cleanText(body) : body.trim();
    return { url: response.url || safeHttpUrl(urlValue.trim()).toString(), status: response.status, contentType, text: text.slice(0, Math.max(1_000, Math.min(maxChars, 40_000))) };
  }
}
