import { spawn } from "node:child_process";
import { readConnectorSecret, writeConnectorSecret } from "../connector-secrets";

function tokenValue(explicit?: string): string {
  return (explicit || process.env.SOPHENIC_VERCEL_TOKEN || process.env.VERCEL_TOKEN || "").trim();
}

function redact(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [secret]")
    .replace(/\bvcp_[A-Za-z0-9_-]+\b/g, "[secret]");
}

type VercelTeam = { id: string; slug: string; name?: string };
type VercelResolvedTarget = {
  input: string;
  hostname: string;
  deploymentId?: string;
  deploymentUrl?: string;
  projectId?: string;
  projectName?: string;
  teamId?: string;
  teamSlug?: string;
  readyState?: string;
  target?: string | null;
};

type VercelApiResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown> | unknown[] | null;
  text: string;
};

function safeJson(text: string): Record<string, unknown> | unknown[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Keep raw body for diagnostics.
  }
  return null;
}

function cleanUrlInput(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Colle une URL Vercel.");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("URL Vercel invalide.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("URL Vercel invalide.");
  return parsed;
}

function dashboardParts(url: URL): { teamSlug?: string; projectName?: string } {
  if (url.hostname.toLowerCase() !== "vercel.com" && url.hostname.toLowerCase() !== "www.vercel.com") return {};
  const parts = url.pathname.split("/").map((item) => item.trim()).filter(Boolean);
  if (!parts.length) return {};
  if (parts[0] === "dashboard") return {};
  const teamSlug = parts[0];
  const projectName = parts[1] && !["settings", "domains", "integrations", "account", "teams"].includes(parts[1]) ? parts[1] : undefined;
  return { teamSlug, projectName };
}

export class VercelConnector {
  private token = "";

  constructor(token?: string) {
    this.token = tokenValue(token);
  }

  connected(): boolean {
    return Boolean(this.getToken());
  }

  setToken(token: string, persist = true): void {
    this.token = token.trim();
    if (persist && this.token) {
      try {
        writeConnectorSecret("vercel", this.token);
      } catch {
        // Memory-only when OS encryption is unavailable; never plaintext.
      }
    }
  }

  private getToken(): string {
    return this.token || tokenValue() || readConnectorSecret("vercel");
  }

  private async apiGet(pathname: string, query: Record<string, string | number | undefined> = {}): Promise<VercelApiResult> {
    const token = this.getToken();
    if (!token) throw new Error("Vercel n’est pas connecté.");
    const url = new URL(`https://api.vercel.com${pathname}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(25_000)
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, body: safeJson(text), text: redact(text) };
  }

  async validate(): Promise<{ connected: boolean; username?: string }> {
    const token = this.getToken();
    if (!token) return { connected: false };
    const result = await this.apiGet("/v2/user");
    if (!result.ok) throw new Error(`Vercel HTTP ${result.status}: ${result.text.slice(0, 500)}`);
    const body = result.body && !Array.isArray(result.body) ? result.body : {};
    const user = body.user && typeof body.user === "object" ? body.user as Record<string, unknown> : {};
    const username = typeof user.username === "string" ? user.username : typeof user.name === "string" ? user.name : undefined;
    return { connected: true, ...(username ? { username } : {}) };
  }

  private async listTeams(): Promise<VercelTeam[]> {
    const result = await this.apiGet("/v2/teams", { limit: 100 });
    if (!result.ok || !result.body || Array.isArray(result.body)) return [];
    const teams = Array.isArray(result.body.teams) ? result.body.teams : [];
    return teams
      .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {})
      .map((row) => ({
        id: typeof row.id === "string" ? row.id : "",
        slug: typeof row.slug === "string" ? row.slug : "",
        ...(typeof row.name === "string" ? { name: row.name } : {})
      }))
      .filter((row) => row.id && row.slug);
  }

  private async getDeployment(idOrUrl: string, teamId?: string): Promise<Record<string, unknown> | null> {
    const result = await this.apiGet(`/v13/deployments/${encodeURIComponent(idOrUrl)}`, teamId ? { teamId } : {});
    if (!result.ok || !result.body || Array.isArray(result.body)) return null;
    return result.body;
  }

  private async resolveDeploymentHost(hostname: string): Promise<VercelResolvedTarget> {
    const normalized = hostname.toLowerCase().replace(/\.$/, "");
    const personal = await this.getDeployment(normalized);
    if (personal) return this.deploymentRecordToTarget(normalized, personal);

    const teams = await this.listTeams();
    for (const team of teams) {
      const found = await this.getDeployment(normalized, team.id);
      if (found) return this.deploymentRecordToTarget(normalized, found, team);
    }

    throw new Error("Ce déploiement Vercel est introuvable avec le token enregistré. Vérifie que le token a accès au compte ou à l’équipe propriétaire du projet.");
  }

  private deploymentRecordToTarget(input: string, record: Record<string, unknown>, team?: VercelTeam): VercelResolvedTarget {
    const project = record.project && typeof record.project === "object" ? record.project as Record<string, unknown> : {};
    const teamRecord = record.team && typeof record.team === "object" ? record.team as Record<string, unknown> : {};
    const recordTeamId = typeof teamRecord.id === "string" ? teamRecord.id : undefined;
    const url = typeof record.url === "string" ? record.url : input;
    return {
      input,
      hostname: url.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
      ...(typeof record.uid === "string" ? { deploymentId: record.uid } : typeof record.id === "string" ? { deploymentId: record.id } : {}),
      deploymentUrl: `https://${url.replace(/^https?:\/\//i, "").replace(/\/$/, "")}`,
      ...(typeof project.id === "string" ? { projectId: project.id } : typeof record.projectId === "string" ? { projectId: record.projectId } : {}),
      ...(typeof project.name === "string" ? { projectName: project.name } : typeof record.name === "string" ? { projectName: record.name } : {}),
      ...(team?.id || recordTeamId ? { teamId: team?.id || recordTeamId } : {}),
      ...(team?.slug ? { teamSlug: team.slug } : {}),
      ...(typeof record.readyState === "string" ? { readyState: record.readyState } : {}),
      ...(typeof record.target === "string" || record.target === null ? { target: record.target as string | null } : {})
    };
  }

  private async resolveDashboardProject(url: URL): Promise<VercelResolvedTarget> {
    const { teamSlug, projectName } = dashboardParts(url);
    if (!teamSlug || !projectName) {
      throw new Error("Cette URL Vercel Dashboard ne contient pas de projet. Ouvre le projet puis copie son URL, ou colle directement une URL *.vercel.app.");
    }

    const teams = await this.listTeams();
    const team = teams.find((item) => item.slug.toLowerCase() === teamSlug.toLowerCase());
    const query = team ? { teamId: team.id } : { slug: teamSlug };
    const projectResult = await this.apiGet(`/v9/projects/${encodeURIComponent(projectName)}`, query);
    if (!projectResult.ok || !projectResult.body || Array.isArray(projectResult.body)) {
      throw new Error(`Projet Vercel « ${projectName} » inaccessible dans le scope « ${teamSlug} ». Vérifie les droits du token.`);
    }

    const project = projectResult.body;
    const projectId = typeof project.id === "string" ? project.id : projectName;
    const deployments = await this.apiGet("/v6/deployments", { projectId, limit: 1, ...(team ? { teamId: team.id } : { slug: teamSlug }) });
    const rows = deployments.body && !Array.isArray(deployments.body) && Array.isArray(deployments.body.deployments) ? deployments.body.deployments : [];
    const latest = rows[0] && typeof rows[0] === "object" ? rows[0] as Record<string, unknown> : null;
    if (!latest) {
      return {
        input: url.toString(),
        hostname: "",
        projectId,
        projectName,
        ...(team ? { teamId: team.id, teamSlug: team.slug } : { teamSlug })
      };
    }

    return this.deploymentRecordToTarget(url.toString(), latest, team);
  }

  private async resolve(input: string): Promise<VercelResolvedTarget> {
    const url = cleanUrlInput(input);
    if (url.hostname.toLowerCase() === "vercel.com" || url.hostname.toLowerCase() === "www.vercel.com") {
      return this.resolveDashboardProject(url);
    }
    return this.resolveDeploymentHost(url.hostname);
  }

  async inspect(input: string): Promise<{ code: number; output: string; target: string; teamId?: string; projectId?: string }> {
    const resolved = await this.resolve(input);
    const target = resolved.deploymentUrl || resolved.projectName || resolved.hostname || input.trim();
    const lines = [
      "Connexion Vercel opérationnelle.",
      resolved.projectName ? `Projet : ${resolved.projectName}` : "",
      resolved.deploymentId ? `Deployment : ${resolved.deploymentId}` : "",
      resolved.deploymentUrl ? `URL : ${resolved.deploymentUrl}` : "",
      resolved.teamSlug ? `Équipe : ${resolved.teamSlug}` : resolved.teamId ? `Équipe : ${resolved.teamId}` : "Compte personnel",
      resolved.readyState ? `État : ${resolved.readyState}` : "",
      resolved.target ? `Cible : ${resolved.target}` : ""
    ].filter(Boolean);
    return {
      code: 0,
      output: lines.join("\n"),
      target,
      ...(resolved.teamId ? { teamId: resolved.teamId } : {}),
      ...(resolved.projectId ? { projectId: resolved.projectId } : {})
    };
  }

  async projects(limit = 50): Promise<Array<{ id: string; name: string; framework?: string; teamId?: string; teamSlug?: string }>> {
    const max = Math.max(1, Math.min(100, limit));
    const rows: Array<{ id: string; name: string; framework?: string; teamId?: string; teamSlug?: string }> = [];
    const collect = async (team?: VercelTeam) => {
      const result = await this.apiGet("/v9/projects", { limit: max, ...(team ? { teamId: team.id } : {}) });
      if (!result.ok || !result.body || Array.isArray(result.body)) return;
      const projects = Array.isArray(result.body.projects) ? result.body.projects : [];
      for (const item of projects) {
        if (!item || typeof item !== "object") continue;
        const project = item as Record<string, unknown>;
        const id = typeof project.id === "string" ? project.id : "";
        const name = typeof project.name === "string" ? project.name : "";
        if (!id || !name) continue;
        rows.push({
          id,
          name,
          ...(typeof project.framework === "string" ? { framework: project.framework } : {}),
          ...(team ? { teamId: team.id, teamSlug: team.slug } : {})
        });
      }
    };
    await collect();
    const teams = await this.listTeams();
    for (const team of teams) await collect(team);
    return rows.slice(0, max);
  }

  async linkProject(cwd: string, projectName: string, teamSlug?: string): Promise<{ code: number; output: string; projectName: string; teamSlug?: string }> {
    const token = this.getToken();
    if (!token) throw new Error("Vercel n’est pas connecté. Ajoute ton token dans Paramètres → Connexions développeur.");
    const cleanName = projectName.trim();
    if (!cleanName) throw new Error("Nom du projet Vercel requis.");
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const args = ["vercel", "link", "--yes", "--project", cleanName, "--token", token, ...(teamSlug?.trim() ? ["--scope", teamSlug.trim()] : [])];
    return new Promise((resolve) => {
      let output = "";
      const child = spawn(executable, args, { cwd, windowsHide: true, env: { ...process.env, VERCEL_TOKEN: token } });
      const append = (chunk: Buffer | string) => { output += chunk.toString(); if (output.length > 60_000) output = output.slice(-60_000); };
      child.stdout?.on("data", append);
      child.stderr?.on("data", append);
      const timer = setTimeout(() => { try { child.kill(); } catch {} }, 60_000);
      child.once("error", (error) => { clearTimeout(timer); resolve({ code: 1, output: error.message, projectName: cleanName, ...(teamSlug ? { teamSlug } : {}) }); });
      child.once("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, output: redact(output).trim().slice(-30_000), projectName: cleanName, ...(teamSlug ? { teamSlug } : {}) });
      });
    });
  }

  async link(cwd: string, target: string): Promise<{ code: number; output: string; projectName?: string; teamSlug?: string }> {
    const resolved = await this.resolve(target);
    const projectName = resolved.projectName;
    if (!projectName) throw new Error("Impossible d’identifier le projet Vercel cible depuis cette URL. Colle l’URL du projet Dashboard ou une URL de déploiement *.vercel.app.");
    return this.linkProject(cwd, projectName, resolved.teamSlug);
  }

  async logs(deployment: string, limit = 120): Promise<{ code: number; output: string }> {
    const token = this.getToken();
    if (!token) throw new Error("Vercel n’est pas connecté.");
    const resolved = await this.resolve(deployment);
    const idOrUrl = resolved.deploymentId || resolved.hostname;
    if (!idOrUrl) throw new Error("Aucun déploiement Vercel n’a été trouvé pour cette URL de projet.");

    const result = await this.apiGet(`/v3/deployments/${encodeURIComponent(idOrUrl)}/events`, {
      direction: "backward",
      follow: 0,
      limit: Math.max(10, Math.min(500, limit)),
      ...(resolved.teamId ? { teamId: resolved.teamId } : {})
    });

    if (result.ok && Array.isArray(result.body)) {
      const lines = result.body
        .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : {})
        .map((event) => {
          const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {};
          return typeof payload.text === "string" ? payload.text : "";
        })
        .filter(Boolean)
        .slice(-Math.max(10, Math.min(500, limit)));
      return { code: 0, output: redact(lines.join("\n")).trim() || "Aucun log de build disponible pour ce déploiement." };
    }

    // Fallback CLI for older accounts/API responses.
    const target = resolved.deploymentUrl || `https://${resolved.hostname}`;
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const args = ["vercel", "logs", target, "--token", token, ...(resolved.teamSlug ? ["--scope", resolved.teamSlug] : [])];
    return new Promise((resolve) => {
      let output = "";
      const child = spawn(executable, args, { windowsHide: true, env: { ...process.env, VERCEL_TOKEN: token } });
      const append = (chunk: Buffer | string) => {
        output += chunk.toString();
        if (output.length > 80_000) output = output.slice(-80_000);
      };
      child.stdout?.on("data", append);
      child.stderr?.on("data", append);
      const timer = setTimeout(() => { try { child.kill(); } catch {} }, 30_000);
      child.once("error", (error) => { clearTimeout(timer); resolve({ code: 1, output: error.message }); });
      child.once("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, output: redact(output).trim().split(/\r?\n/).slice(-Math.max(10, Math.min(500, limit))).join("\n") });
      });
    });
  }

  async deploy(cwd: string, options: { production?: boolean } = {}): Promise<{ code: number; output: string; url?: string }> {
    const token = this.getToken();
    if (!token) throw new Error("Vercel n’est pas connecté. Ajoute ton token dans Paramètres → Connexions développeur.");
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const args = ["vercel", "deploy", "--yes", ...(options.production === false ? [] : ["--prod"]), "--token", token];
    return new Promise((resolve) => {
      let output = "";
      const child = spawn(executable, args, { cwd, windowsHide: true, env: { ...process.env, VERCEL_TOKEN: token } });
      child.stdout?.on("data", (d) => { output += d.toString(); });
      child.stderr?.on("data", (d) => { output += d.toString(); });
      child.once("error", (error) => resolve({ code: 1, output: error.message }));
      child.once("close", (code) => {
        const clean = redact(output).trim().slice(-40_000);
        const urls = clean.match(/https:\/\/[a-z0-9.-]+\.vercel\.app\b/gi) || [];
        resolve({ code: code ?? 1, output: clean, ...(urls.length ? { url: urls.at(-1) } : {}) });
      });
    });
  }
}
