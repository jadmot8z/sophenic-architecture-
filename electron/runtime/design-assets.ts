import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";
import { clearConnectorSecret, readConnectorSecret, writeConnectorSecret } from "./code-engine/connector-secrets";

const SKETCHFAB_SECRET = "sketchfab-api-token";
const SKETCHFAB_API = "https://api.sketchfab.com/v3";
const MAX_DOWNLOAD_BYTES = 120 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 96 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 350 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 800;

type UnknownRecord = Record<string, unknown>;
export type DesignAssetSearchResult = {
  provider: "sketchfab";
  sourceId: string;
  name: string;
  author?: string;
  license?: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  downloadable: boolean;
  tags: string[];
  likeCount?: number;
  viewCount?: number;
  vertexCount?: number;
  faceCount?: number;
  staffPicked?: boolean;
  publishedAt?: string;
};
export type CachedDesignAsset = DesignAssetSearchResult & { cacheId: string; entryPath: string; format: "gltf" | "glb"; cachedAt: string };

function asRecord(value: unknown): UnknownRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}; }
function stringValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function safeId(value: string): string { return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 128); }
function cacheRoot(): string {
  if (!app.isReady()) throw new Error("Le cache 3D n'est disponible qu'après le démarrage d'Electron.");
  return path.join(app.getPath("userData"), "design-assets", "sketchfab");
}
function assetDir(sourceId: string): string { const id = safeId(sourceId); if (!id) throw new Error("Identifiant Sketchfab invalide."); return path.join(cacheRoot(), id); }
function metadataPath(sourceId: string): string { return path.join(assetDir(sourceId), "sophenic-asset.json"); }
function authorizationHeaders(token = readConnectorSecret(SKETCHFAB_SECRET)): Record<string, string> {
  if (!token) throw new Error("Sketchfab n'est pas configuré. Ajoute ton API Token dans Paramètres → 3D Assets.");
  return { Authorization: `Token ${token}`, Accept: "application/json", "User-Agent": "SOPHENIC-Design/11" };
}
async function fetchJson(url: string, token?: string): Promise<UnknownRecord> {
  const response = await fetch(url, { headers: authorizationHeaders(token), redirect: "follow" });
  const payload = await response.json().catch(() => ({})) as unknown;
  if (!response.ok) {
    const row = asRecord(payload); const detail = stringValue(row.detail) || stringValue(row.message) || `HTTP ${response.status}`;
    throw new Error(`Sketchfab: ${detail}`);
  }
  return asRecord(payload);
}

export async function sketchfabStatus(test = false): Promise<{ configured: boolean; verified: boolean; account?: string; detail?: string }> {
  const token = readConnectorSecret(SKETCHFAB_SECRET);
  if (!token) return { configured: false, verified: false, detail: "Aucun token Sketchfab enregistré." };
  if (!test) return { configured: true, verified: false, detail: "Token enregistré dans le coffre chiffré." };
  try {
    const me = await fetchJson(`${SKETCHFAB_API}/me`, token);
    const displayName = stringValue(me.displayName) || stringValue(me.username) || stringValue(asRecord(me.user).displayName);
    return { configured: true, verified: true, ...(displayName ? { account: displayName } : {}), detail: "Connexion Sketchfab vérifiée." };
  } catch (error) {
    return { configured: true, verified: false, detail: error instanceof Error ? error.message : "Token Sketchfab invalide." };
  }
}

export async function saveSketchfabToken(token: string): Promise<{ configured: boolean; verified: boolean; account?: string; detail?: string }> {
  const clean = token.trim();
  if (clean.length < 12 || clean.length > 512) throw new Error("API Token Sketchfab invalide.");
  // Validate before persisting so an accidental value never replaces a working token.
  const me = await fetchJson(`${SKETCHFAB_API}/me`, clean);
  writeConnectorSecret(SKETCHFAB_SECRET, clean);
  const displayName = stringValue(me.displayName) || stringValue(me.username) || stringValue(asRecord(me.user).displayName);
  return { configured: true, verified: true, ...(displayName ? { account: displayName } : {}), detail: "Connexion Sketchfab vérifiée et token enregistré dans le coffre chiffré." };
}

export function clearSketchfabToken(): { configured: false; verified: false; detail: string } {
  clearConnectorSecret(SKETCHFAB_SECRET);
  return { configured: false, verified: false, detail: "Connexion Sketchfab supprimée." };
}

function thumbnailUrl(row: UnknownRecord): string {
  const thumbnails = asRecord(row.thumbnails);
  const images = Array.isArray(thumbnails.images) ? thumbnails.images.map(asRecord) : [];
  const sorted = images.filter((item) => stringValue(item.url)).sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
  return stringValue(sorted[Math.min(2, Math.max(0, sorted.length - 1))]?.url) || stringValue(sorted[0]?.url);
}

function mapSearchResult(value: unknown): DesignAssetSearchResult | null {
  const row = asRecord(value); const uid = safeId(stringValue(row.uid)); if (!uid) return null;
  const user = asRecord(row.user); const license = asRecord(row.license);
  const rawTags = Array.isArray(row.tags) ? row.tags : [];
  const tags = rawTags.map((tag) => typeof tag === "string" ? tag : stringValue(asRecord(tag).name)).filter(Boolean).slice(0, 30);
  const downloadable = row.isDownloadable === true || row.downloadable === true;
  const result: DesignAssetSearchResult = {
    provider: "sketchfab", sourceId: uid, name: stringValue(row.name) || `Sketchfab ${uid}`,
    sourceUrl: stringValue(row.viewerUrl) || `https://sketchfab.com/models/${uid}`, downloadable, tags
  };
  const author = stringValue(user.displayName) || stringValue(user.username); if (author) result.author = author;
  const licenseLabel = stringValue(license.label) || stringValue(license.slug); if (licenseLabel) result.license = licenseLabel;
  const preview = thumbnailUrl(row); if (preview) result.thumbnailUrl = preview;
  const likeCount = Number(row.likeCount ?? row.likes ?? 0); if (Number.isFinite(likeCount) && likeCount > 0) result.likeCount = likeCount;
  const viewCount = Number(row.viewCount ?? row.views ?? 0); if (Number.isFinite(viewCount) && viewCount > 0) result.viewCount = viewCount;
  const vertexCount = Number(row.vertexCount ?? row.vertices ?? 0); if (Number.isFinite(vertexCount) && vertexCount > 0) result.vertexCount = vertexCount;
  const faceCount = Number(row.faceCount ?? row.faces ?? 0); if (Number.isFinite(faceCount) && faceCount > 0) result.faceCount = faceCount;
  if (row.staffpicked === true || row.staffPicked === true) result.staffPicked = true;
  const publishedAt = stringValue(row.publishedAt) || stringValue(row.createdAt); if (publishedAt) result.publishedAt = publishedAt;
  return result;
}

export async function searchSketchfabAssets(query: string, limit = 12): Promise<DesignAssetSearchResult[]> {
  const clean = query.replace(/[\r\n\t]+/g, " ").trim().slice(0, 180);
  if (!clean) return [];
  const url = new URL(`${SKETCHFAB_API}/search`);
  url.searchParams.set("type", "models"); url.searchParams.set("q", clean); url.searchParams.set("downloadable", "true"); url.searchParams.set("count", String(Math.max(1, Math.min(24, limit))));
  const payload = await fetchJson(url.toString());
  const rows = Array.isArray(payload.results) ? payload.results : [];
  return rows.map(mapSearchResult).filter((item): item is DesignAssetSearchResult => Boolean(item)).filter((item) => item.downloadable).slice(0, Math.max(1, Math.min(24, limit)));
}

function readCached(sourceId: string): CachedDesignAsset | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath(sourceId), "utf8")) as CachedDesignAsset;
    const entry = path.join(assetDir(sourceId), parsed.entryPath);
    return parsed?.cacheId && fs.existsSync(entry) ? parsed : null;
  } catch { return null; }
}

function walkFiles(root: string, current = root, rows: string[] = []): string[] {
  for (const name of fs.readdirSync(current)) {
    const target = path.join(current, name); const stat = fs.statSync(target);
    if (stat.isDirectory()) walkFiles(root, target, rows); else if (stat.isFile()) rows.push(path.relative(root, target).replace(/\\/g, "/"));
  }
  return rows;
}

function chooseEntry(root: string): { entryPath: string; format: "gltf" | "glb" } {
  const files = walkFiles(root).filter((file) => !file.endsWith("sophenic-asset.json"));
  const glb = files.find((file) => /(^|\/)scene\.glb$/i.test(file)) || files.find((file) => /\.glb$/i.test(file));
  if (glb) return { entryPath: glb, format: "glb" };
  const gltf = files.find((file) => /(^|\/)scene\.gltf$/i.test(file)) || files.find((file) => /\.gltf$/i.test(file));
  if (gltf) return { entryPath: gltf, format: "gltf" };
  throw new Error("Sketchfab a téléchargé l'asset, mais aucun fichier GLTF/GLB exploitable n'a été trouvé.");
}

async function downloadBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Téléchargement Sketchfab impossible (HTTP ${response.status}).`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error("Asset Sketchfab trop volumineux pour le cache SOPHENIC (limite 120 Mo).");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("Asset Sketchfab trop volumineux pour le cache SOPHENIC (limite 120 Mo).");
  return bytes;
}

export async function cacheSketchfabAsset(input: DesignAssetSearchResult): Promise<CachedDesignAsset> {
  if (input.provider !== "sketchfab" || !input.downloadable) throw new Error("Cet asset n'est pas téléchargeable via Sketchfab.");
  const sourceId = safeId(input.sourceId); if (!sourceId) throw new Error("Asset Sketchfab invalide.");
  const previous = readCached(sourceId); if (previous?.license?.trim()) return previous;
  // Revalidate identity/licence server-side. Metadata supplied by the renderer is
  // never authoritative for an automatic import.
  const details = await fetchJson(`${SKETCHFAB_API}/models/${encodeURIComponent(sourceId)}`);
  const verified = mapSearchResult(details);
  const verifiedLicense = verified?.license?.trim() || "";
  if (!verifiedLicense) throw new Error("Licence Sketchfab indisponible : SOPHENIC refuse d'importer cet asset automatiquement.");
  const verifiedInput: DesignAssetSearchResult = {
    ...input,
    ...(verified || {}),
    provider: "sketchfab",
    sourceId,
    license: verifiedLicense,
    downloadable: true
  };
  const payload = await fetchJson(`${SKETCHFAB_API}/models/${encodeURIComponent(sourceId)}/download`);
  const gltf = asRecord(payload.gltf); const glb = asRecord(payload.glb);
  const formatData = stringValue(glb.url) ? { row: glb, directGlb: true } : stringValue(gltf.url) ? { row: gltf, directGlb: false } : null;
  if (!formatData) throw new Error("Cet asset Sketchfab n'est pas proposé au téléchargement en GLTF/GLB par l'API.");
  const signedUrl = stringValue(formatData.row.url); if (!signedUrl) throw new Error("URL de téléchargement Sketchfab manquante.");
  const destination = assetDir(sourceId); const temp = `${destination}.tmp-${process.pid}-${Date.now()}`;
  fs.rmSync(temp, { recursive: true, force: true }); fs.mkdirSync(temp, { recursive: true });
  try {
    const bytes = await downloadBytes(signedUrl);
    const looksZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (formatData.directGlb && !looksZip) fs.writeFileSync(path.join(temp, "scene.glb"), bytes);
    else {
      const archive = path.join(temp, "asset.zip"); fs.writeFileSync(archive, bytes);
      const unpack = path.join(temp, "model"); fs.mkdirSync(unpack, { recursive: true });
      await extract(archive, { dir: unpack }); fs.rmSync(archive, { force: true });
      const extractedFiles = walkFiles(unpack);
      if (extractedFiles.length > MAX_EXTRACTED_FILES) throw new Error("Asset Sketchfab refusé : trop de fichiers extraits.");
      const extractedBytes = extractedFiles.reduce((sum, relative) => sum + fs.statSync(path.join(unpack, relative)).size, 0);
      if (extractedBytes > MAX_EXTRACTED_BYTES) throw new Error("Asset Sketchfab refusé : archive décompressée trop volumineuse.");
    }
    const root = fs.existsSync(path.join(temp, "model")) ? path.join(temp, "model") : temp;
    const entry = chooseEntry(root);
    // Normalize cache layout so every cacheId resolves from the asset root.
    const finalRoot = destination;
    fs.rmSync(finalRoot, { recursive: true, force: true }); fs.mkdirSync(path.dirname(finalRoot), { recursive: true });
    if (root === temp) fs.renameSync(temp, finalRoot); else { fs.renameSync(root, finalRoot); fs.rmSync(temp, { recursive: true, force: true }); }
    const cached: CachedDesignAsset = { ...verifiedInput, cacheId: sourceId, entryPath: entry.entryPath, format: entry.format, cachedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(finalRoot, "sophenic-asset.json"), `${JSON.stringify(cached, null, 2)}\n`, "utf8");
    return cached;
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".gltf") return "model/gltf+json"; if (ext === ".glb") return "model/gltf-binary"; if (ext === ".bin") return "application/octet-stream";
  if (ext === ".png") return "image/png"; if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"; if (ext === ".webp") return "image/webp";
  if (ext === ".ktx2") return "image/ktx2"; return "application/octet-stream";
}

export function readCachedAssetBundle(cacheId: string): { cacheId: string; entryPath: string; format: "gltf" | "glb"; files: Array<{ path: string; mime: string; bytes: Uint8Array }> } {
  const id = safeId(cacheId); const metadata = readCached(id); if (!metadata) throw new Error("Asset 3D absent du cache SOPHENIC.");
  const root = assetDir(id); const allowed = /\.(?:gltf|glb|bin|png|jpe?g|webp|ktx2)$/i;
  const files = walkFiles(root).filter((file) => allowed.test(file)).slice(0, 220);
  let total = 0;
  const payload = files.map((relative) => {
    const target = path.resolve(root, relative); if (!target.startsWith(path.resolve(root) + path.sep) && target !== path.resolve(root)) throw new Error("Chemin d'asset invalide.");
    const stat = fs.statSync(target); total += stat.size; if (total > MAX_BUNDLE_BYTES) throw new Error("Asset 3D trop volumineux à charger dans la scène.");
    return { path: relative.replace(/\\/g, "/"), mime: mimeFor(relative), bytes: new Uint8Array(fs.readFileSync(target)) };
  });
  return { cacheId: id, entryPath: metadata.entryPath, format: metadata.format, files: payload };
}


/** Provider Sketchfab derrière l'Asset Engine SOPHENIC. */
export class SketchfabProvider {
  readonly id = "sketchfab" as const;
  status(test = false) { return sketchfabStatus(test); }
  saveToken(token: string) { return saveSketchfabToken(token); }
  clearToken() { return clearSketchfabToken(); }
  searchAssets(query: string, limit = 12) { return searchSketchfabAssets(query, limit); }
  async getAssetDetails(sourceId: string): Promise<UnknownRecord> {
    const id = safeId(sourceId); if (!id) throw new Error("Identifiant Sketchfab invalide.");
    return fetchJson(`${SKETCHFAB_API}/models/${encodeURIComponent(id)}`);
  }
  async resolveDownloadableAsset(sourceId: string): Promise<UnknownRecord> {
    const id = safeId(sourceId); if (!id) throw new Error("Identifiant Sketchfab invalide.");
    return fetchJson(`${SKETCHFAB_API}/models/${encodeURIComponent(id)}/download`);
  }
  async downloadAsset(url: string): Promise<Uint8Array> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("URL d'asset Sketchfab non sécurisée.");
    return downloadBytes(parsed.toString());
  }
  cacheAsset(input: DesignAssetSearchResult) { return cacheSketchfabAsset(input); }
  readBundle(cacheId: string) { return readCachedAssetBundle(cacheId); }
}
