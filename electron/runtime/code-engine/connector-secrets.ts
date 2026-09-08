import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Connector credentials must survive application upgrades and must not depend on
 * the source/install directory.  Keep them in a stable per-user SOPHENIC vault.
 *
 * Windows: %APPDATA%\\SOPHENIC\\connector-secrets
 * macOS/Linux: Electron appData/SOPHENIC/connector-secrets
 *
 * Older builds used app.getPath("userData").  Reads transparently migrate those
 * encrypted files into the stable vault the first time they are encountered.
 */
function safeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function stableSecretPath(name: string): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath("appData"), "SOPHENIC", "connector-secrets", `${safeFileName(name)}.enc`);
}

function legacySecretPaths(name: string): string[] {
  if (!app.isReady()) return [];
  const file = `${safeFileName(name)}.enc`;
  const candidates = [
    path.join(app.getPath("userData"), "connector-secrets", file),
    path.join(app.getPath("appData"), "sophenic", "connector-secrets", file),
    path.join(app.getPath("appData"), "Sophenic", "connector-secrets", file)
  ];
  const stable = stableSecretPath(name);
  return [...new Set(candidates.filter((item) => item && item !== stable))];
}

function decryptFile(file: string): string {
  if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(file)) return "";
  try { return safeStorage.decryptString(fs.readFileSync(file)).trim(); } catch { return ""; }
}

function writeEncrypted(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, safeStorage.encryptString(value));
    // renameSync is atomic on the same filesystem. Remove a stale destination
    // only on platforms where replacement can fail.
    try { fs.renameSync(temp, file); }
    catch {
      try { fs.rmSync(file, { force: true }); } catch {}
      fs.renameSync(temp, file);
    }
  } finally {
    try { fs.rmSync(temp, { force: true }); } catch {}
  }
}

export function readConnectorSecret(name: string): string {
  const file = stableSecretPath(name);
  if (!file || !safeStorage.isEncryptionAvailable()) return "";

  const current = decryptFile(file);
  if (current) return current;

  // One-time, silent migration from previous SOPHENIC versions/build names.
  for (const legacy of legacySecretPaths(name)) {
    const value = decryptFile(legacy);
    if (!value) continue;
    try { writeEncrypted(file, value); } catch { /* keep legacy readable */ }
    return value;
  }
  return "";
}

export function writeConnectorSecret(name: string, value: string): void {
  const clean = value.trim();
  if (!clean) return;
  const file = stableSecretPath(name);
  if (!file) throw new Error("Le coffre connecteur n'est disponible qu'après le démarrage d'Electron.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Le chiffrement natif du système n'est pas disponible; le secret n'a pas été enregistré.");
  writeEncrypted(file, clean);
}

export function clearConnectorSecret(name: string): void {
  const files = [stableSecretPath(name), ...legacySecretPaths(name)].filter((item): item is string => Boolean(item));
  for (const file of new Set(files)) {
    try { fs.rmSync(file, { force: true }); } catch {}
  }
}
