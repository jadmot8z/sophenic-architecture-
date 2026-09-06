import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  path.join(root, "node_modules", "three", "examples", "jsm", "libs", "draco", "gltf"),
  path.join(root, "node_modules", "three", "examples", "jsm", "libs", "draco")
];
const source = candidates.find((value) => fs.existsSync(value));
if (!source) {
  console.warn("[SOPHENIC Design] Decodeur Draco Three.js introuvable; le viewer restera disponible pour les GLTF/GLB non Draco.");
  process.exit(0);
}
const destination = path.join(root, "public", "sophenic-draco");
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const name of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  const sourceFile = path.join(source, name);
  if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, path.join(destination, name));
}
console.log(`[SOPHENIC Design] Decodeur Draco prepare dans ${path.relative(root, destination)}.`);
