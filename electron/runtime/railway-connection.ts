/**
 * SOPHENIC — connexion Railway (déploiement & infrastructure).
 *
 * Patron identique à Sketchfab/Vercel : le token API Railway est validé contre
 * l'API officielle (GraphQL backboard.railway.app) AVANT d'être chiffré dans le
 * coffre natif (safeStorage Electron). Il n'est jamais relu dans le renderer ni
 * écrit dans les projets. L'authentification est directe par token — aucun flux
 * OAuth, donc aucun « client ID » n'est nécessaire.
 */

import { clearConnectorSecret, readConnectorSecret, writeConnectorSecret } from "./code-engine/connector-secrets";

const RAILWAY_SECRET = "railway-api-token";
const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql";

export type RailwayConnectionStatus = {
  configured: boolean;
  verified: boolean;
  account?: string;
  projects?: string[];
  detail?: string;
};

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

async function railwayGraphql(query: string, token: string): Promise<Record<string, unknown>> {
  const response = await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "SOPHENIC/11" },
    body: JSON.stringify({ query })
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const row = asRecord(payload);
    const errors = Array.isArray(row.errors) ? row.errors.map((item) => asRecord(item).message).filter(Boolean).join(" · ") : "";
    const detail = typeof errors === "string" && errors ? errors : `HTTP ${response.status}`;
    throw new Error(`Railway : ${detail}`);
  }
  return asRecord(payload);
}

function currentToken(): string {
  return (readConnectorSecret(RAILWAY_SECRET) || process.env.SOPHENIC_RAILWAY_TOKEN || process.env.RAILWAY_TOKEN || "").trim();
}

/**
 * Vérifie le token : `{ __typename }` est la requête la plus petite possible —
 * un token invalide renvoie 401, un token valide renvoie 200. Insensible aux
 * évolutions du schéma GraphQL Railway.
 */
async function verifyToken(token: string): Promise<void> {
  await railwayGraphql("{ __typename }", token);
}

async function bestEffortAccount(token: string): Promise<{ account?: string; projects?: string[] }> {
  const result: { account?: string; projects?: string[] } = {};
  try {
    const me = await railwayGraphql("query { me { name email } }", token);
    const meRow = asRecord(asRecord(me.data).me);
    const account = typeof meRow.name === "string" && meRow.name.trim() ? meRow.name.trim() : typeof meRow.email === "string" ? meRow.email.trim() : "";
    if (account) result.account = account;
  } catch { /* best effort : le schéma peut différer, la connexion reste valide */ }
  try {
    const list = await railwayGraphql("query { projects { edges { node { name } } } }", token);
    const edges = Array.isArray(asRecord(asRecord(list.data).projects).edges) ? asRecord(asRecord(list.data).projects).edges as unknown[] : [];
    const projects = edges.map((edge) => asRecord(asRecord(edge).node).name).filter((name): name is string => typeof name === "string" && Boolean(name.trim())).slice(0, 12);
    if (projects.length) result.projects = projects;
  } catch { /* best effort */ }
  return result;
}

export async function railwayStatus(test = false): Promise<RailwayConnectionStatus> {
  const token = currentToken();
  if (!token) return { configured: false, verified: false, detail: "Aucun token Railway enregistré." };
  if (!test) return { configured: true, verified: false, detail: "Token enregistré dans le coffre chiffré." };
  try {
    await verifyToken(token);
    const extra = await bestEffortAccount(token);
    return { configured: true, verified: true, ...extra, detail: "Connexion Railway vérifiée." };
  } catch (error) {
    return { configured: true, verified: false, detail: error instanceof Error ? error.message : "Token Railway invalide." };
  }
}

export async function saveRailwayToken(token: string): Promise<RailwayConnectionStatus> {
  const clean = token.trim();
  if (clean.length < 20 || clean.length > 512) throw new Error("Token Railway invalide.");
  // Validation AVANT persistance : une faute de frappe ne remplace jamais un token fonctionnel.
  await verifyToken(clean);
  writeConnectorSecret(RAILWAY_SECRET, clean);
  const extra = await bestEffortAccount(clean).catch(() => ({}));
  return { configured: true, verified: true, ...extra, detail: "Connexion Railway vérifiée et token enregistré dans le coffre." };
}

export function clearRailwayToken(): RailwayConnectionStatus {
  clearConnectorSecret(RAILWAY_SECRET);
  return { configured: false, verified: false, detail: "Connexion Railway supprimée." };
}
