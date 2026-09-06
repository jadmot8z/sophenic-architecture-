import type { DesignArchitectureBrief, DesignInteriorFinishLevel, DesignProject } from "./types";

const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const STYLE_PRESETS: Array<{ test: RegExp; style: string; palette: string[]; materials: string[] }> = [
  { test: /palais|palace|royal|majestueux|majestueuse/, style: "palatial majestueux ultra premium", palette: ["#F5F0E8", "#DCC7A1", "#B08A52", "#73523C", "#272925"], materials: ["Marbre Calacatta clair", "Noyer fumé", "Laiton brossé", "Velours ivoire", "Verre extra-clair"] },
  { test: /japandi/, style: "japandi chaleureux haut de gamme", palette: ["#F1ECE3", "#D8C9B6", "#A27F61", "#5B4B3E", "#242622"], materials: ["Chêne naturel", "Travertin ivoire", "Laine crème", "Métal noir satiné"] },
  { test: /mediterr|mediterraneen|méditerranéen/, style: "méditerranéen contemporain premium", palette: ["#F5EFE4", "#D8C29E", "#B0835E", "#6D7A68", "#2D302A"], materials: ["Travertin ivoire", "Pierre calcaire", "Chêne naturel", "Laine crème"] },
  { test: /minimal/, style: "minimaliste premium chaleureux", palette: ["#F4F1EA", "#DAD2C6", "#A99883", "#5C574F", "#262624"], materials: ["Chêne naturel", "Pierre calcaire", "Enduit minéral ivoire", "Métal noir satiné"] },
  { test: /industriel/, style: "industriel raffiné", palette: ["#EAE5DC", "#A69C90", "#6C6156", "#343434", "#7D4E32"], materials: ["Béton ciré chaud", "Noyer fumé", "Métal noir satiné", "Cuir cognac"] },
  { test: /luxe|luxury|haut de gamme|premium|raffine|raffiné/, style: "contemporain chaleureux très haut de gamme", palette: ["#F3EEE6", "#D7C8B4", "#B69C7C", "#73523C", "#272925", "#B08A52"], materials: ["Noyer fumé", "Travertin ivoire", "Marbre Calacatta clair", "Laiton brossé", "Bouclé sable", "Verre extra-clair"] },
  { test: /moderne|contemporain/, style: "contemporain chaleureux premium", palette: ["#F3EEE6", "#D3C4B0", "#9A7A5D", "#5F4C3A", "#2A2C29"], materials: ["Chêne naturel", "Travertin ivoire", "Bouclé sable", "Métal noir satiné"] }
];

const MATERIAL_PATTERNS: Array<[RegExp, string]> = [
  [/noyer/, "Noyer fumé"], [/chene|chêne|bois clair/, "Chêne naturel"], [/travertin/, "Travertin ivoire"], [/marbre/, "Marbre Calacatta clair"],
  [/verre/, "Verre extra-clair"], [/laiton/, "Laiton brossé"], [/metal noir|métal noir|noir mat/, "Métal noir satiné"], [/boucle|bouclé/, "Bouclé sable"],
  [/laine|tapis/, "Laine crème"], [/cuir/, "Cuir cognac"], [/beton|béton/, "Béton ciré chaud"], [/pierre/, "Pierre calcaire"]
];

function finishLevel(text: string): DesignInteriorFinishLevel {
  if (/ultra luxe|tres haut de gamme|très haut de gamme|luxury|luxe|hotel 5|hôtel 5|beaucoup plus de decoration|beaucoup plus de décoration|plus de decoration|plus de décoration|tres detaille|très détaillé/.test(text)) return "luxury";
  if (/riche|detaille|détaillé|premium|haut de gamme|raffine|raffiné|plus de details|plus de détails/.test(text)) return "rich";
  if (/minimal|sobre|epure|épuré|leger|léger|peu de decoration|peu de décoration/.test(text)) return "light";
  return "balanced";
}

function roomTargets(project: DesignProject, text: string): string[] {
  const explicit = project.plan.rooms.filter((room) => text.includes(norm(room.name))).map((room) => room.name);
  if (explicit.length) return explicit;
  if (/toute la maison|toutes les pieces|toutes les pièces|maison entiere|maison entière|villa entiere|villa entière|transforme.*maison|reinvente.*maison|réinvente.*maison/.test(text)) {
    return project.plan.rooms.filter((room) => !/garage|terrasse|hall|circulation/i.test(`${room.usage} ${room.name}`)).map((room) => room.name);
  }
  const active = project.plan.rooms.find((room) => room.id === project.architecture?.activeRoomId);
  return active ? [active.name] : [];
}

export function parseArchitectureBrief(instruction: string, project: DesignProject): DesignArchitectureBrief {
  const text = norm(instruction);
  const preset = STYLE_PRESETS.find((item) => item.test.test(text)) || STYLE_PRESETS.at(-1)!;
  const level = finishLevel(text);
  const materials = MATERIAL_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
  const resolvedMaterials = [...new Set(materials.length ? materials : preset.materials)];
  const priorities: string[] = [];
  if (/meilleur.*meuble|beaux? meuble|mobilier|meuble|realiste|réaliste/.test(text)) priorities.push("mobilier réaliste et cohérent");
  if (/deco|décoration|decoration|details|détails|finition/.test(text)) priorities.push("décoration et finitions détaillées");
  if (/texture|matiere|matière|materiaux|matériaux/.test(text)) priorities.push("textures et matériaux premium");
  if (/circulation|passage|fluide/.test(text)) priorities.push("circulation fluide");
  if (/lumiere|lumière|lumineux|eclairage|éclairage/.test(text)) priorities.push("lumière et ambiance");
  if (/logique|coherent|cohérent|intelligent|verification|vérification/.test(text)) priorities.push("cohérence et vérification automatique");
  if (!priorities.length) priorities.push("cohérence générale", "mobilier proportionné", "circulation fluide");

  const constraints = [
    "ne pas bloquer les portes",
    "ne pas bloquer les fenêtres",
    "éviter les collisions et meubles collés",
    "préserver des passages confortables",
    "respecter les proportions de chaque pièce"
  ];
  if (/ne .*pas|evite|évite|garde|respecte/.test(text)) constraints.push("respecter les contraintes explicites du brief utilisateur");

  const ambience: DesignArchitectureBrief["ambience"] = /soir|nuit|evening|tamise|tamisé/.test(text) ? "evening" : /jour|lumineux|naturelle/.test(text) ? "day" : "soft";
  return {
    sourceInstruction: instruction.slice(0, 5000),
    style: preset.style,
    ambience,
    finishLevel: level,
    palette: preset.palette,
    materials: resolvedMaterials,
    priorities: [...new Set(priorities)],
    constraints: [...new Set(constraints)],
    targetRooms: roomTargets(project, text),
    autonomy: /autonomie|libre|prends les decisions|prends les décisions|fais ce que tu juges|comme tu veux/.test(text) ? "high" : project.architecture?.autonomy || "high",
    parsedAt: new Date().toISOString()
  };
}

export function applyArchitectureBrief(project: DesignProject, brief: DesignArchitectureBrief): DesignProject {
  const next = structuredClone(project);
  next.preferences.style = brief.style;
  next.architecture = {
    ...(next.architecture || { cameraMode: "exterior", roomOrder: next.plan.rooms.map((room) => room.id) }),
    cameraMode: next.architecture?.cameraMode || "exterior",
    roomOrder: next.architecture?.roomOrder || next.plan.rooms.map((room) => room.id),
    autonomy: brief.autonomy,
    style: brief.style,
    palette: brief.palette,
    ambience: brief.ambience,
    renderQuality: "high",
    finishLevel: brief.finishLevel,
    brief
  };
  return next;
}

export function architectureBriefSummary(brief: DesignArchitectureBrief): string {
  const rooms = brief.targetRooms.length ? brief.targetRooms.slice(0, 5).join(", ") : "maison entière";
  return `${brief.style} · finition ${brief.finishLevel} · ${rooms} · ${brief.materials.slice(0, 4).join(", ")}`;
}
