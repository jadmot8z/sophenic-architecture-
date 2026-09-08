import type { PluginInvocation } from "./plugin-connectors";

export type PluginConversationMessage = { role: "user" | "assistant"; content: string };

const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+\\?@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`´_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function isEmailTaskStart(content: string): boolean {
  const p = normalize(content);
  const hasService = /\b(gmail|e mail|email|mail|courriel)\b/.test(p) || EMAIL_ADDRESS.test(content);
  EMAIL_ADDRESS.lastIndex = 0;
  const hasAction = /\b(envoie|envois|envoyer|envoi|send|expedie|expedier|ecris|ecrire|redige|rediger|prepare|preparer|brouillon|draft|repond|repondre)\b/.test(p);
  return hasService && hasAction;
}

function gmailAnchor(messages: PluginConversationMessage[]): number {
  const floor = Math.max(0, messages.length - 20);
  for (let index = messages.length - 1; index >= floor; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && isEmailTaskStart(message.content)) return index;
  }
  return -1;
}

function gmailScope(messages: PluginConversationMessage[]): PluginConversationMessage[] {
  const anchor = gmailAnchor(messages);
  return anchor >= 0 ? messages.slice(anchor) : messages.slice(-12);
}

function gmailActionMode(messages: PluginConversationMessage[]): "send_email" | "create_draft" | null {
  let mode: "send_email" | "create_draft" | null = null;
  for (const message of gmailScope(messages)) {
    if (message.role !== "user") continue;
    const p = normalize(message.content);
    if (/\b(ne (?:l )?envoie pas|n envoie pas|sans envoyer|ne pas envoyer|garde(?: le)? en brouillon|(?:cree|creer|prepare|preparer|fais|faire)(?: moi)? (?:un )?brouillon|create draft)\b/.test(p)) {
      mode = "create_draft";
      continue;
    }
    if (/\b(envoie|envois|envoyer|envoi|send|expedie|expedier)\b/.test(p)) mode = "send_email";
  }
  return mode;
}

function extractRecipient(messages: PluginConversationMessage[]): string {
  const scoped = gmailScope(messages);
  for (let index = scoped.length - 1; index >= 0; index -= 1) {
    if (scoped[index].role !== "user") continue;
    const matches = scoped[index].content.match(EMAIL_ADDRESS);
    EMAIL_ADDRESS.lastIndex = 0;
    if (matches?.length) return matches[matches.length - 1].trim().replace("\\@", "@");
  }
  return "";
}

function explicitlyNoSubject(content: string): boolean {
  const p = normalize(content);
  return /\b(sans objet|pas d objet|aucun objet|aucun sujet|sans sujet|objet vide|sujet vide|il n y a pas d objet|il n y a pas de sujet|objet (?:il )?n en a pas|sujet (?:il )?n en a pas|n a pas d objet|n a pas de sujet)\b/.test(p);
}

function extractSubject(messages: PluginConversationMessage[]): { found: boolean; value: string } {
  const scoped = gmailScope(messages);
  for (let index = scoped.length - 1; index >= 0; index -= 1) {
    const message = scoped[index];
    if (message.role !== "user") continue;
    if (explicitlyNoSubject(message.content)) return { found: true, value: "" };
    const match = /(?:^|[\s,;.])(?:l(?:['’]\s*|\s+))?(?:objet|sujet)\s*(?::|=|\best\b|\bsera\b)\s*[«"“]?(.+?)[»"”]?(?=\s+(?:(?:le|la)\s+|l(?:['’]\s*|\s+))?(?:texte|corps|contenu|message)\b|$)/i.exec(message.content);
    const candidate = match?.[1]?.trim().replace(/[.;,]+$/g, "") || "";
    if (candidate && !explicitlyNoSubject(candidate)) return { found: true, value: candidate };
  }
  return { found: false, value: "" };
}

function bodyFromMarkedText(content: string): string {
  const patterns = [
    /(?:^|[\s,;.])(?:le\s+)?(?:texte(?:\s+(?:à|a)\s+placer)?|corps(?:\s+du\s+(?:mail|courriel|message))?|contenu(?:\s+du\s+(?:mail|courriel|message))?|message)\s*(?::|=|\best\b|\bsera\b)\s*[«"“]?([\s\S]+?)[»"”]?(?=\s+(?:(?:le|la)\s+|l(?:['’]\s*|\s+))?(?:objet|sujet)\b|$)/i,
    /(?:^|[\s,;.])(?:écris|ecris|mets?|mettre)\s+(?:dans\s+(?:le\s+)?(?:mail|courriel|message)\s+)?[«"“]([\s\S]+?)[»"”](?:[.!?]|$)/i
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(content);
    const candidate = match?.[1]?.trim().replace(/\s+(?:l(?:['’]\s*|\s+))?(?:objet|sujet)\s+.*$/i, "").trim() || "";
    if (candidate) return candidate;
  }
  return "";
}

function assistantAskedForBody(content: string): boolean {
  const p = normalize(content);
  const asks = /\b(quel texte|quel contenu|corps du message|corps du mail|texte a placer|contenu du message|message a envoyer|corps|texte)\b/.test(p);
  const context = /\b(mail|email|e mail|courriel|gmail|message)\b/.test(p);
  return asks && context;
}

function assistantAskedForSubject(content: string): boolean {
  const p = normalize(content);
  const asks = /\b(objet|sujet)\b/.test(p) && (/\?/.test(content) || /\b(quel|quelle|precise|indiquer|indique|fournis|fournir|besoin)\b/.test(p));
  const context = /\b(mail|email|e mail|courriel|gmail|message)\b/.test(p);
  return asks && context;
}

function assistantConfirmedGmailCompletion(content: string, action: "send_email" | "create_draft"): boolean {
  const p = normalize(content);
  if (action === "send_email") {
    return /\b(mail|email|e mail|courriel|message)\b/.test(p) && /\b(envoye|envoyee|expedie|expediee|transmis|transmise)\b/.test(p) && !/\b(pas|echec|erreur|impossible)\b/.test(p);
  }
  return /\bbrouillon\b/.test(p) && /\b(cree|enregistre|sauvegarde)\b/.test(p) && !/\b(pas|echec|erreur|impossible)\b/.test(p);
}

function acknowledgementOnly(content: string): boolean {
  return /^(?:ok|okay|oui|yes|non|no|d accord|daccord|merci|parfait|vas y|continue|go)$/i.test(normalize(content));
}

function extractBody(messages: PluginConversationMessage[]): string {
  const scoped = gmailScope(messages);
  for (let index = scoped.length - 1; index >= 0; index -= 1) {
    const message = scoped[index];
    if (message.role !== "user") continue;
    const marked = bodyFromMarkedText(message.content);
    if (marked) return marked;
  }
  for (let index = scoped.length - 1; index >= 1; index -= 1) {
    const message = scoped[index];
    const previous = scoped[index - 1];
    if (message.role !== "user" || previous.role !== "assistant") continue;
    const candidate = message.content.trim();
    if (!candidate || acknowledgementOnly(candidate) || isEmailTaskStart(candidate)) continue;
    if (assistantAskedForBody(previous.content)) return candidate;
  }
  return "";
}

export function gmailSendWasExplicitlyRequested(messages: PluginConversationMessage[]): boolean {
  return gmailActionMode(messages) === "send_email";
}

export function hydratePluginInvocationFromConversation(invocation: PluginInvocation, messages: PluginConversationMessage[]): PluginInvocation {
  if (invocation.provider !== "gmail" || !["send_email", "create_draft"].includes(invocation.action)) return invocation;
  const input = { ...(invocation.input || {}) };
  if (typeof input.to !== "string" || !input.to.trim()) {
    const to = extractRecipient(messages);
    if (to) input.to = to;
  }
  if (typeof input.subject !== "string") {
    const subject = extractSubject(messages);
    if (subject.found) input.subject = subject.value;
  }
  if (typeof input.body !== "string" || !input.body.trim()) {
    const body = extractBody(messages);
    if (body) input.body = body;
  }
  const actionMode = gmailActionMode(messages);
  const action = actionMode || invocation.action;
  return { ...invocation, action, input };
}

const REQUIRED_PLUGIN_FIELDS: Record<string, string[]> = {
  "gmail.send_email": ["to", "body"],
  "gmail.create_draft": ["to", "body"],
  "notion.create_page": ["title"],
  "google-drive.create_text_file": ["name", "content"],
  "calendar.create_event": ["summary", "start", "end"],
  "wordpress.create_post": ["title", "content"]
};

export function inferReadyGmailInvocationFromConversation(messages: PluginConversationMessage[]): PluginInvocation | null {
  if (gmailAnchor(messages) < 0) return null;
  const action = gmailActionMode(messages);
  if (!action) return null;
  const scoped = gmailScope(messages);
  const latestUserIndex = (() => {
    for (let index = scoped.length - 1; index >= 0; index -= 1) if (scoped[index].role === "user") return index;
    return -1;
  })();
  if (latestUserIndex < 0) return null;
  if (scoped.slice(0, latestUserIndex).some((message) => message.role === "assistant" && assistantConfirmedGmailCompletion(message.content, action))) return null;
  const latestUser = scoped[latestUserIndex];
  const previousAssistant = latestUserIndex > 0 && scoped[latestUserIndex - 1].role === "assistant" ? scoped[latestUserIndex - 1] : null;
  const latestHasRecipient = (() => {
    const found = EMAIL_ADDRESS.test(latestUser.content);
    EMAIL_ADDRESS.lastIndex = 0;
    return found;
  })();
  const latestUpdatesFields = latestHasRecipient || Boolean(bodyFromMarkedText(latestUser.content)) || explicitlyNoSubject(latestUser.content) || extractSubject([latestUser]).found;
  const followsClarification = Boolean(previousAssistant && (assistantAskedForBody(previousAssistant.content) || assistantAskedForSubject(previousAssistant.content)));
  if (!isEmailTaskStart(latestUser.content) && !latestUpdatesFields && !followsClarification) return null;
  const subject = extractSubject(messages);
  const subjectWasRequested = scoped.some((message) => message.role === "assistant" && assistantAskedForSubject(message.content));
  if (subjectWasRequested && !subject.found) return null;
  const invocation = hydratePluginInvocationFromConversation({ provider: "gmail", action, input: {} }, messages);
  if (missingPluginInvocationFields(invocation).length) return null;
  return invocation;
}

export function missingPluginInvocationFields(invocation: PluginInvocation): string[] {
  const input = invocation.input || {};
  const required = REQUIRED_PLUGIN_FIELDS[`${invocation.provider}.${invocation.action}`] || [];
  return required.filter((field) => typeof input[field] !== "string" || !String(input[field]).trim());
}
