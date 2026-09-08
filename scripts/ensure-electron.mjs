import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const exe = process.platform === "win32"
  ? path.join(root, "node_modules", "electron", "dist", "electron.exe")
  : path.join(root, "node_modules", "electron", "dist", "electron");

if (fs.existsSync(exe)) {
  console.log(`[SOPHENIC] Electron prêt : ${exe}`);
  process.exit(0);
}

console.log("[SOPHENIC] Le binaire Electron est absent.");

if (process.platform !== "win32") {
  console.error("[SOPHENIC] Réinstalle Electron avec les scripts npm activés.");
  process.exit(1);
}

const repair = path.join(root, "REPARER-ELECTRON-TAR.ps1");
if (!fs.existsSync(repair)) {
  console.error(`[SOPHENIC] Correctif Electron introuvable : ${repair}`);
  process.exit(1);
}

console.log("[SOPHENIC] Réparation automatique avec l'archive Electron officielle...");
const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", repair], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  console.error(`[SOPHENIC] Impossible de lancer le correctif : ${result.error.message}`);
  process.exit(1);
}

if (!fs.existsSync(exe)) {
  console.error("[SOPHENIC] Electron reste absent après réparation. Vérifie Windows Security / antivirus.");
  process.exit(1);
}

console.log("[SOPHENIC] Electron réparé et prêt.");
