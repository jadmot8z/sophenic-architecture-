import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type PublicWebPage = {
  url: string;
  status: number;
  contentType: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
};

const USER_AGENT = "SOPHENIC-Design/1.0 (+website redesign analyser)";

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateIp(address: string): boolean {
  const value = address.toLowerCase().replace(/^::ffff:/, "");
  if (value === "::" || value === "::1" || value === "0.0.0.0") return true;
  if (/^10\./.test(value) || /^127\./.test(value) || /^169\.254\./.test(value) || /^192\.168\./.test(value)) return true;
  const v172 = /^172\.(\d{1,3})\./.exec(value); if (v172 && Number(v172[1]) >= 16 && Number(v172[1]) <= 31) return true;
  return value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd");
}

function parsePublicUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Seules les URL HTTP(S) sont acceptées.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Les adresses locales ne peuvent pas être importées.");
  if (isIP(host) && isPrivateIp(host)) throw new Error("Les adresses réseau privées ne peuvent pas être importées.");
  return url;
}

async function assertPublic(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) { if (isPrivateIp(host)) throw new Error("Adresse privée interdite."); return; }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) throw new Error("La cible résout vers un réseau local ou privé.");
}

async function readLimited(response: Response, maxBytes = 1_500_000): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0; let text = "";
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (total >= maxBytes) break;
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); }
  return text;
}

async function fetchPublic(value: string): Promise<Response> {
  let url = parsePublicUrl(value);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublic(url);
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9,*/*;q=0.4" },
      signal: AbortSignal.timeout(20_000)
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    if (redirects >= 5) throw new Error("Trop de redirections.");
    url = parsePublicUrl(new URL(location, url).toString());
  }
  throw new Error("Redirection invalide.");
}

export async function fetchPublicWebPage(value: string, maxChars = 12_000): Promise<PublicWebPage> {
  const response = await fetchPublic(value.trim());
  const contentType = response.headers.get("content-type") || "";
  if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) throw new Error(`Type de contenu non pris en charge pour l'analyse Design (${contentType || "inconnu"}).`);
  const raw = await readLimited(response);
  const title = stripHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] || "").slice(0, 240);
  const description = decodeEntities(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(raw)?.[1]
    || /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(raw)?.[1]
    || "").trim().slice(0, 500);
  const headings = Array.from(raw.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((match) => stripHtml(match[1])).filter(Boolean).slice(0, 30);
  const text = (/html/i.test(contentType) ? stripHtml(raw) : raw.replace(/\s+/g, " ").trim()).slice(0, Math.max(1_000, Math.min(20_000, maxChars)));
  return { url: response.url || parsePublicUrl(value).toString(), status: response.status, contentType, title, description, headings, text };
}
