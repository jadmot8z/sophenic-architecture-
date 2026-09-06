import type { DesignProject, DesignWebFile } from "./types";

const encoder = new TextEncoder();
let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable; const rows = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; rows[n] = c >>> 0; }
  crcTable = rows; return rows;
}
function crc32(bytes: Uint8Array): number { let c = 0xffffffff; const rows = table(); for (const byte of bytes) c = rows[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function u16(value: number): Uint8Array { const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); return out; }
function asArrayBuffer(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }
function u32(value: number): Uint8Array { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out; }
function join(parts: Uint8Array[]): Uint8Array { const size = parts.reduce((sum, part) => sum + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
function dosDateTime(date = new Date()): { date: number; time: number } { const year = Math.max(1980, date.getFullYear()); return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() }; }
async function fileBytes(file: DesignWebFile): Promise<Uint8Array> { if (file.kind === "text") return encoder.encode(file.content || ""); if (!file.dataUrl) return new Uint8Array(); const response = await fetch(file.dataUrl); return new Uint8Array(await response.arrayBuffer()); }

export async function buildWebProjectZip(project: DesignProject): Promise<Blob> {
  const files = project.webWorkspace?.files || []; if (!files.length) throw new Error("Aucun fichier Web à exporter.");
  const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = []; let offset = 0; const dt = dosDateTime();
  for (const file of files.slice(0, 500)) {
    const name = encoder.encode(file.path.replace(/^\/+/, "")); const data = await fileBytes(file); const crc = crc32(data);
    const local = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dt.time), u16(dt.date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    localParts.push(local);
    const central = join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dt.time), u16(dt.date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    centralParts.push(central); offset += local.length;
  }
  const central = join(centralParts); const local = join(localParts); const count = centralParts.length;
  const end = join([u32(0x06054b50), u16(0), u16(0), u16(count), u16(count), u32(central.length), u32(local.length), u16(0)]);
  return new Blob([asArrayBuffer(local), asArrayBuffer(central), asArrayBuffer(end)], { type: "application/zip" });
}

export async function downloadWebProject(project: DesignProject): Promise<void> {
  const blob = await buildWebProjectZip(project); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${project.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "sophenic-site"}.zip`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
