import type { DesignWebFile } from "./types";
import { isWebTextFile, normalizeWebPath, webFileMime } from "./web-workspace";

const MAX_FILES = 260;
const MAX_SINGLE_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 42 * 1024 * 1024;

function allowedPath(path: string): boolean {
  return Boolean(path) && !/(^|\/)(?:node_modules|\.git|\.next|dist|build|coverage)(\/|$)/i.test(path) && !/(?:\.map|\.lock)$/i.test(path);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error || new Error("Lecture du fichier impossible.")); reader.readAsDataURL(blob); });
}

async function bytesToWebFile(path: string, bytes: Uint8Array, mime = ""): Promise<DesignWebFile | null> {
  const clean = normalizeWebPath(path); if (!allowedPath(clean) || bytes.byteLength > MAX_SINGLE_FILE) return null;
  const resolvedMime = webFileMime(clean, mime);
  const base = { path: clean, mime: resolvedMime, size: bytes.byteLength, modifiedAt: new Date().toISOString() };
  if (isWebTextFile(clean, resolvedMime)) return { ...base, kind: "text", content: new TextDecoder("utf-8", { fatal: false }).decode(bytes) };
  return { ...base, kind: "asset", dataUrl: await readAsDataUrl(new Blob([asArrayBuffer(bytes)], { type: resolvedMime })) };
}

async function browserFileToWebFile(file: File): Promise<DesignWebFile | null> {
  const relative = file.webkitRelativePath || file.name;
  const clean = normalizeWebPath(relative); if (!allowedPath(clean) || file.size > MAX_SINGLE_FILE) return null;
  const mime = webFileMime(clean, file.type);
  const base = { path: clean, mime, size: file.size, modifiedAt: new Date(file.lastModified || Date.now()).toISOString() };
  if (isWebTextFile(clean, mime)) return { ...base, kind: "text", content: await file.text() };
  return { ...base, kind: "asset", dataUrl: await readAsDataUrl(file) };
}

function findEocd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset += 1) {
    const index = bytes.length - 22 - (offset - Math.max(0, bytes.length - 65_557));
    if (index >= 0 && view.getUint32(index, true) === 0x06054b50) return index;
  }
  return -1;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("Ce runtime ne prend pas en charge la décompression ZIP.");
  const DS = DecompressionStream as unknown as { new(format: string): DecompressionStream };
  const stream = new Blob([asArrayBuffer(data)]).stream().pipeThrough(new DS("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function extractWebZip(file: File): Promise<DesignWebFile[]> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const eocd = findEocd(raw); if (eocd < 0) throw new Error("Archive ZIP invalide ou non prise en charge.");
  const entryCount = Math.min(MAX_FILES, view.getUint16(eocd + 10, true));
  const centralOffset = view.getUint32(eocd + 16, true);
  let cursor = centralOffset; let total = 0;
  const result: DesignWebFile[] = [];
  for (let index = 0; index < entryCount && cursor + 46 <= raw.length; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true); const compressedSize = view.getUint32(cursor + 20, true); const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const localOffset = view.getUint32(cursor + 42, true);
    const name = normalizeWebPath(new TextDecoder().decode(raw.slice(cursor + 46, cursor + 46 + nameLength)));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/") || !allowedPath(name) || uncompressedSize > MAX_SINGLE_FILE || total + uncompressedSize > MAX_TOTAL) continue;
    if (localOffset + 30 > raw.length || view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true); const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = raw.slice(dataStart, dataStart + compressedSize);
    let bytes: Uint8Array;
    if (method === 0) bytes = compressed;
    else if (method === 8) bytes = await inflateRaw(compressed);
    else continue;
    const converted = await bytesToWebFile(name, bytes); if (converted) { result.push(converted); total += converted.size; }
  }
  if (!result.length) throw new Error("Aucun fichier web exploitable trouvé dans le ZIP.");
  return result;
}

export async function readWebImport(files: FileList | File[]): Promise<{ files: DesignWebFile[]; label: string }> {
  const input = Array.from(files).slice(0, MAX_FILES);
  if (input.length === 1 && /\.zip$/i.test(input[0].name)) return { files: await extractWebZip(input[0]), label: input[0].name };
  const result: DesignWebFile[] = []; let total = 0;
  for (const file of input) {
    if (total + file.size > MAX_TOTAL) break;
    const converted = await browserFileToWebFile(file); if (!converted) continue;
    result.push(converted); total += converted.size;
  }
  if (!result.length) throw new Error("Aucun fichier web exploitable n’a été sélectionné.");
  const root = input[0]?.webkitRelativePath?.split("/")[0];
  return { files: result, label: root || (input.length === 1 ? input[0].name : `${result.length} fichiers`) };
}
