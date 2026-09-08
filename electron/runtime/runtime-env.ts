import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let cache: Record<string, string> | null = null;

function parseEnvFile(filePath: string, target: Record<string, string>): void {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index <= 0) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (key && !(key in target)) target[key] = value;
    }
  } catch { /* optional env file */ }
}

function load(): Record<string, string> {
  if (cache) return cache;
  const values: Record<string, string> = {};
  // `publisher-runtime.env` is generated during packaging from a strict
  // allow-list. It can contain broker/service routing values, never provider
  // Client Secrets or user tokens. In the packaged app it lives inside ASAR.
  const candidates = [path.join(__dirname, "..", "publisher-runtime.env"), path.join(process.cwd(), ".env.local"), path.join(process.cwd(), ".env")];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "Sophenic", "sophenic.env"));
  else candidates.push(path.join(os.homedir(), ".sophenic", "sophenic.env"));
  for (const candidate of candidates) parseEnvFile(candidate, values);
  cache = values;
  return values;
}

export function runtimeEnv(name: string): string {
  const direct = String(process.env[name] || "").trim();
  if (direct) return direct;
  return String(load()[name] || "").trim();
}

export function resetRuntimeEnvCache(): void { cache = null; }
