/**
 * SOPHENIC VERCEL TOKEN — Tests obligatoires avant livraison. (V8.7)
 *
 * Connexion Vercel réparée : Vercel n'a pas de flux OAuth natif dans SOPHENIC —
 * la connexion se fait par token personnel (vcp_…). Le moteur savait déjà
 * valider un PAT (saveDeveloperPersonalToken) mais il était INJOIGNABLE depuis
 * l'interface : le bouton « Connecter » ouvrait silencieusement la page des
 * tokens sans jamais permettre de coller la clé. Ces tests verrouillent le
 * raccordement complet IPC → preload → UI + le guidage explicite sans token.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const assert = (value, message) => { if (!value) throw new Error(message); };
const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

/* ---------- 1. Moteur : guidage explicite quand aucun token n'est stocké ---------- */
const oauthSource = await read("electron/runtime/developer-oauth.ts");
assert(oauthSource.includes("export async function saveDeveloperPersonalToken"), "saveDeveloperPersonalToken doit exister (validation PAT avant coffre).");
const noTokenBlock = oauthSource.slice(
  oauthSource.indexOf("async function connectVercelFromStoredToken"),
  oauthSource.indexOf("export async function restoreDeveloperOAuth")
);
assert(noTokenBlock.includes("shell.openExternal(VERCEL_TOKEN_URL)"), "Sans token, la page des tokens Vercel doit s'ouvrir.");
assert(noTokenBlock.includes("throw new Error"), "Sans token, un message GUIDANT doit être lancé au lieu d'un succès silencieux.");
assert(/vcp_/.test(noTokenBlock), "Le message doit mentionner le format du token (vcp_).");
assert(noTokenBlock.includes("Plugins → Vercel"), "Le message doit indiquer où coller le token (Plugins → Vercel).");
// Validation AVANT persistance (ordre dans saveDeveloperPersonalToken) :
const saveBlock = oauthSource.slice(oauthSource.indexOf("export async function saveDeveloperPersonalToken"));
const validateIndex = saveBlock.indexOf("connectors.vercel.setToken(token, false);");
const bundleIndex = saveBlock.indexOf("writeBundle({", validateIndex);
assert(validateIndex > 0 && bundleIndex > validateIndex, "Le token Vercel doit être validé par l'API AVANT d'être écrit dans le coffre.");
assert(saveBlock.includes("Vercel a refusé ce token"), "Le refus de l'API Vercel doit être explicite.");
// Rollback en cas d'échec :
assert(saveBlock.includes("connectors.vercel.setToken(previousToken, false);"), "Un token refusé doit restaurer le token précédent (pas de coupure de connexion).");

/* ---------- 2. IPC : le canal save-token est exposé de bout en bout ---------- */
const mainSource = await read("electron/main.ts");
assert(mainSource.includes('"sophenic:developer-connections:save-token"'), "Canal IPC « sophenic:developer-connections:save-token » absent de main.ts.");
assert(mainSource.includes("saveDeveloperPersonalToken"), "main.ts doit appeler saveDeveloperPersonalToken.");
const saveHandler = mainSource.slice(mainSource.indexOf('"sophenic:developer-connections:save-token"'));
assert(saveHandler.slice(0, 600).includes("assertTrustedFrame(event);"), "Le handler save-token doit vérifier le frame de confiance.");
assert(saveHandler.slice(0, 600).includes("> 512"), "Le handler save-token doit borner la taille du token.");
const preloadSource = await read("electron/preload.ts");
assert(preloadSource.includes("saveToken: (provider"), "Le preload n'expose pas developerConnections.saveToken.");
const typesSource = await read("src/types/electron.d.ts");
assert(typesSource.includes('saveToken(provider: "github" | "vercel", token: string)'), "Le contrat saveToken manque dans electron.d.ts.");

/* ---------- 3. UI : dialogue « coller le token » sur la carte Vercel ---------- */
const pagesSource = await read("src/components/agent/workspace-pages.tsx");
for (const expected of [
  "Connecter {tokenTarget.name} par token",
  "Ouvrir Vercel → Account → Tokens",
  "vcp_…",
  "submitToken",
  'desktop.developerConnections.saveToken("vercel", token)',
  'openPortal("vercel", "token")',
  "Enregistrer & tester"
]) {
  assert(pagesSource.includes(expected), `Dialogue token Vercel incomplet : « ${expected} » absent de workspace-pages.tsx.`);
}
// La carte Vercel doit être interceptée AVANT le flux OAuth générique (qui ne peut pas aboutir) :
const connectFn = pagesSource.slice(pagesSource.indexOf("const connect = async (plugin: PluginDefinition) => {"), pagesSource.indexOf("const submitDatabase"));
assert(connectFn.indexOf('plugin.id === "vercel"') < connectFn.indexOf("await desktop.plugins.connect"), "Vercel doit être intercepté avant le flux OAuth générique.");
// Message de succès honnête :
assert(pagesSource.includes("Token validé et chiffré dans le coffre"), "Le succès doit confirmer validation + chiffrement.");

console.log("SOPHENIC VERCEL TOKEN — TESTS OBLIGATOIRES : OK");
console.log("  Moteur : sans token → page des tokens ouverte + message guidant (plus de succès silencieux) · PAT validé par l'API AVANT coffre · rollback si refus");
console.log("  IPC    : sophenic:developer-connections:save-token (frame de confiance, taille bornée) · preload + electron.d.ts alignés");
console.log("  UI     : carte Vercel (Plugins) → dialogue « Connecter par token » avec ouverture Account→Tokens, champ vcp_…, Enregistrer & tester");
