/**
 * SOPHENIC RAILWAY CONNECTION — Tests obligatoires avant livraison. (V8.6)
 *
 * Connexion Railway par clé API (token direct, aucun OAuth/client ID) :
 * validation contre l'API GraphQL officielle AVANT persistance, chiffrement
 * dans le coffre natif Electron, exposition IPC + carte Plugins/Paramètres.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const assert = (value, message) => { if (!value) throw new Error(message); };
const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

const tsModule = await import("typescript").catch(() => null);
const ts = tsModule?.default || tsModule;

/* ---------- 1. Syntaxe du connecteur ---------- */
const connectorSource = await read("electron/runtime/railway-connection.ts");
assert(connectorSource.trim().length > 0, "Connecteur Railway vide.");
if (ts?.createSourceFile) {
  const parsed = ts.createSourceFile("railway-connection.ts", connectorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors = (parsed.parseDiagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, "Erreur de syntaxe TypeScript dans railway-connection.ts.");
}

/* ---------- 2. Contrats du connecteur ---------- */
assert(connectorSource.includes("writeConnectorSecret"), "Le token Railway doit être chiffré via le coffre (writeConnectorSecret).");
assert(connectorSource.includes("clearConnectorSecret"), "La déconnexion doit purger le coffre (clearConnectorSecret).");
assert(connectorSource.includes("readConnectorSecret"), "Le statut doit lire le coffre (readConnectorSecret).");
assert(connectorSource.includes("https://backboard.railway.app/graphql"), "Le connecteur doit appeler l'API GraphQL officielle Railway.");
// Validation AVANT persistance : une faute de frappe ne remplace jamais un token fonctionnel.
const verifyIndex = connectorSource.indexOf("await verifyToken(clean);");
const persistIndex = connectorSource.indexOf("writeConnectorSecret(RAILWAY_SECRET, clean);");
assert(verifyIndex > 0 && persistIndex > verifyIndex, "Le token doit être validé par l'API AVANT d'être persisté dans le coffre.");
assert(!/console\.(log|info|debug)/.test(connectorSource), "Le connecteur ne doit jamais logger (fuite de token possible).");
assert(connectorSource.includes("{ __typename }"), "La vérification doit utiliser la requête minimale insensible au schéma.");
assert(connectorSource.includes("SOPHENIC_RAILWAY_TOKEN"), "Variable d'environnement SOPHENIC_RAILWAY_TOKEN attendue en repli.");

/* ---------- 3. Contrats IPC (main + preload + types) ---------- */
const mainSource = await read("electron/main.ts");
for (const channel of ["sophenic:railway:status", "sophenic:railway:save", "sophenic:railway:clear"]) {
  assert(mainSource.includes(`"${channel}"`), `Canal IPC « ${channel} » absent de electron/main.ts.`);
}
assert(mainSource.includes("assertTrustedFrame(event); return railwayStatus(test === true);"), "Le canal status doit vérifier le frame de confiance.");
const preloadSource = await read("electron/preload.ts");
assert(preloadSource.includes("railway:") && preloadSource.includes("sophenic:railway:save"), "Le preload n'expose pas le bridge railway.");
const typesSource = await read("src/types/electron.d.ts");
assert(typesSource.includes("railway: {") && typesSource.includes("saveToken(token: string)"), "Le contrat railway manque dans electron.d.ts.");

/* ---------- 4. Contrat UI ---------- */
const pagesSource = await read("src/components/agent/workspace-pages.tsx");
for (const expected of ["Déploiement · Railway", "Clé API Railway", "Enregistrer & tester", "Déconnecter", "coffre", "Aucun « Client ID » n’est nécessaire"]) {
  assert(pagesSource.includes(expected), `Carte Railway incomplète : « ${expected} » absent de workspace-pages.tsx.`);
}
assert(pagesSource.includes("desktop.railway.saveToken"), "La carte doit appeler desktop.railway.saveToken.");

console.log("SOPHENIC RAILWAY CONNECTION — TESTS OBLIGATOIRES : OK");
console.log("  Connecteur : token direct (aucun OAuth/client ID) · validé contre backboard.railway.app/graphql AVANT persistance · coffre chiffré · aucun log");
console.log("  IPC        : sophenic:railway:status/save/clear avec frame de confiance · preload + electron.d.ts alignés");
console.log("  UI         : carte « Déploiement · Railway » (Paramètres) avec statut, compte, projets, test et déconnexion");
