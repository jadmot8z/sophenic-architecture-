import type { DesignProject, DesignWebFile, DesignWebWorkspace } from "./types";

const textExtensions = new Set(["html", "htm", "css", "js", "mjs", "cjs", "jsx", "ts", "tsx", "json", "md", "txt", "svg", "xml", "yml", "yaml"]);
const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico"]);

export function normalizeWebPath(input: string): string {
  const clean = input.replace(/\\/g, "/").replace(/^\/+/, "");
  const out: string[] = [];
  for (const part of clean.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { out.pop(); continue; }
    out.push(part.replace(/[\u0000-\u001f]/g, ""));
  }
  return out.join("/").slice(0, 500);
}

export function webFileMime(path: string, supplied = ""): string {
  if (supplied) return supplied;
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const known: Record<string, string> = {
    html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript",
    jsx: "text/javascript", ts: "text/plain", tsx: "text/plain", json: "application/json", svg: "image/svg+xml", png: "image/png",
    jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf"
  };
  return known[ext] || "application/octet-stream";
}

export function isWebTextFile(path: string, mime = ""): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return mime.startsWith("text/") || mime === "application/json" || mime === "application/javascript" || mime === "image/svg+xml" || textExtensions.has(ext);
}

export function ensureWebWorkspace(project: DesignProject): DesignWebWorkspace {
  if (project.webWorkspace) return project.webWorkspace;
  project.webWorkspace = { files: [], entryPath: "", selectedPath: "", viewport: "desktop", changes: [] };
  return project.webWorkspace;
}

export function chooseWebEntry(files: DesignWebFile[]): string {
  const paths = files.map((file) => file.path);
  return paths.find((path) => /(^|\/)index\.html?$/i.test(path))
    || paths.find((path) => /(^|\/)home\.html?$/i.test(path))
    || paths.find((path) => /\.html?$/i.test(path))
    || "";
}

function dirname(path: string): string {
  const normalized = normalizeWebPath(path); const index = normalized.lastIndexOf("/"); return index < 0 ? "" : normalized.slice(0, index);
}

function resolveLocal(fromPath: string, target: string): string | null {
  const raw = target.trim();
  if (!raw || raw.startsWith("#") || /^(?:[a-z]+:)?\/\//i.test(raw) || /^(?:data|blob|mailto|tel|javascript):/i.test(raw)) return null;
  const withoutQuery = raw.split(/[?#]/)[0];
  if (!withoutQuery) return null;
  if (raw.startsWith("/")) return normalizeWebPath(withoutQuery);
  return normalizeWebPath(`${dirname(fromPath)}/${withoutQuery}`);
}

function fileMap(files: DesignWebFile[]): Map<string, DesignWebFile> {
  const map = new Map<string, DesignWebFile>();
  for (const file of files) map.set(normalizeWebPath(file.path), file);
  return map;
}

function escapeClosingTag(value: string, tag: "script" | "style"): string {
  return value.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

function rewriteCssAssets(css: string, cssPath: string, files: Map<string, DesignWebFile>): string {
  return css.replace(/url\(([^)]+)\)/gi, (full, rawValue: string) => {
    const raw = rawValue.trim().replace(/^['"]|['"]$/g, "");
    const resolved = resolveLocal(cssPath, raw); if (!resolved) return full;
    const asset = files.get(resolved); if (!asset?.dataUrl) return full;
    return `url("${asset.dataUrl}")`;
  });
}

function selectorScript(projectId: string, inspectMode: boolean): string {
  const safeProject = JSON.stringify(projectId);
  return `<script>(function(){
    const CHANNEL='sophenic-design-preview'; const PROJECT=${safeProject}; const INSPECT=${inspectMode ? "true" : "false"};
    function selector(el){ if(!el||!el.tagName)return ''; let s=el.tagName.toLowerCase(); if(el.id)return s+'#'+el.id; const cls=String(el.className||'').trim().split(/\\s+/).filter(Boolean).slice(0,2); if(cls.length)s+='.'+cls.join('.'); return s; }
    if(INSPECT){
      let previous=null;
      document.addEventListener('pointerover',function(event){const el=event.target;if(!(el instanceof HTMLElement))return;if(previous&&previous!==el)previous.style.outline=previous.dataset.sophenicOutline||'';previous=el;el.dataset.sophenicOutline=el.style.outline||'';el.style.outline='2px solid #b88747';el.style.outlineOffset='2px';},true);
      document.addEventListener('click',function(event){const el=event.target;if(!(el instanceof HTMLElement))return;event.preventDefault();event.stopPropagation();window.parent.postMessage({channel:CHANNEL,projectId:PROJECT,type:'selection',element:{selector:selector(el),tag:el.tagName.toLowerCase(),id:el.id||undefined,className:String(el.className||'').slice(0,240)||undefined,text:String(el.innerText||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,280)}},'*');},true);
    }
    window.addEventListener('error',function(event){window.parent.postMessage({channel:CHANNEL,projectId:PROJECT,type:'runtime-error',message:String(event.message||'Erreur JavaScript')},'*');});
    window.parent.postMessage({channel:CHANNEL,projectId:PROJECT,type:'ready'},'*');
  })();<\/script>`;
}

export type WebPreviewBuild = { html: string; entryPath: string; warnings: string[] };

export function buildWebPreview(project: DesignProject, inspectMode = false): WebPreviewBuild {
  const workspace = ensureWebWorkspace(project);
  const files = fileMap(workspace.files);
  const entryPath = workspace.entryPath && files.has(normalizeWebPath(workspace.entryPath)) ? normalizeWebPath(workspace.entryPath) : chooseWebEntry(workspace.files);
  if (!entryPath) return { html: "", entryPath: "", warnings: ["Aucun fichier HTML d’entrée n’a été trouvé."] };
  const entry = files.get(entryPath); if (!entry?.content) return { html: "", entryPath, warnings: ["Le fichier d’entrée HTML est illisible."] };
  const warnings: string[] = [];
  let html = entry.content;

  html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (full, before: string, href: string, after: string) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(`${before} ${after}`)) return full;
    const resolved = resolveLocal(entryPath, href); if (!resolved) return full;
    const css = files.get(resolved); if (!css?.content) { warnings.push(`Feuille de style locale non trouvée : ${href}`); return full; }
    return `<style data-sophenic-source="${resolved}">${escapeClosingTag(rewriteCssAssets(css.content, resolved, files), "style")}</style>`;
  });

  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, (full, before: string, src: string, after: string) => {
    const resolved = resolveLocal(entryPath, src); if (!resolved) return full;
    const script = files.get(resolved); if (!script?.content) { warnings.push(`Script local non trouvé : ${src}`); return full; }
    const attrs = `${before} ${after}`.replace(/\s*src\s*=\s*["'][^"']+["']/i, "");
    if (/\btype\s*=\s*["']module["']/i.test(attrs) && /\b(?:import|export)\b/.test(script.content)) warnings.push(`Le module ${resolved} contient des imports locaux : la prévisualisation statique peut être partielle.`);
    return `<script ${attrs} data-sophenic-source="${resolved}">${escapeClosingTag(script.content, "script")}</script>`;
  });

  html = html.replace(/\b(src|poster)=["']([^"']+)["']/gi, (full, attribute: string, value: string) => {
    const resolved = resolveLocal(entryPath, value); if (!resolved) return full;
    const asset = files.get(resolved); if (!asset?.dataUrl) return full;
    return `${attribute}="${asset.dataUrl}"`;
  });

  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs: string, css: string) => `<style${attrs}>${escapeClosingTag(rewriteCssAssets(css, entryPath, files), "style")}</style>`);
  const bridge = selectorScript(project.id, inspectMode);
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${bridge}</body>`); else html += bridge;
  return { html, entryPath, warnings: [...new Set(warnings)].slice(0, 8) };
}

export function webProjectFramework(files: DesignWebFile[]): string {
  const names = new Set(files.map((file) => file.path.toLowerCase()));
  const packageFile = files.find((file) => /(^|\/)package\.json$/i.test(file.path));
  const pkg = packageFile?.content || "";
  if (/"next"\s*:/.test(pkg) || [...names].some((name) => /(^|\/)next\.config\./.test(name))) return "Next.js";
  if (/"react"\s*:/.test(pkg) || [...names].some((name) => /\.(tsx|jsx)$/.test(name))) return "React";
  if (/"vue"\s*:/.test(pkg) || [...names].some((name) => /\.vue$/.test(name))) return "Vue";
  if (/"svelte"\s*:/.test(pkg) || [...names].some((name) => /\.svelte$/.test(name))) return "Svelte";
  if (files.some((file) => /\.html?$/i.test(file.path))) return "HTML / CSS / JS";
  return "Projet web";
}

export function isImageLikeWebFile(file: DesignWebFile): boolean {
  const ext = file.path.split(".").pop()?.toLowerCase() || "";
  return file.mime.startsWith("image/") || imageExtensions.has(ext);
}
