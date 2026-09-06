import type { DesignProject, DesignRoom } from "./types";
import { objectsTooCloseInRoom } from "./interior-composition";

export type ArchitectureRoomAudit = {
  roomId: string;
  roomName: string;
  area: number;
  furnitureCoverage: number;
  windowCount: number;
  doorCount: number;
  connectionCount: number;
  blockedOpeningCount: number;
  spacingViolationCount: number;
  decorativeElementCount: number;
  materialCount: number;
  finishScore: number;
  score: number;
  issues: string[];
  recommendations: string[];
};

export type ArchitectureAudit = {
  score: number;
  totalArea: number;
  roomCount: number;
  rooms: ArchitectureRoomAudit[];
  priorities: string[];
};

function openingBelongsToRoom(project: DesignProject, room: DesignRoom, x: number, y: number): boolean {
  const epsilon = 0.08;
  const onHorizontal = x >= room.x - epsilon && x <= room.x + room.width + epsilon
    && (Math.abs(y - room.y) <= epsilon || Math.abs(y - (room.y + room.height)) <= epsilon);
  const onVertical = y >= room.y - epsilon && y <= room.y + room.height + epsilon
    && (Math.abs(x - room.x) <= epsilon || Math.abs(x - (room.x + room.width)) <= epsilon);
  return onHorizontal || onVertical;
}

export function analyzeArchitecture(project: DesignProject): ArchitectureAudit {
  if (project.domain !== "architecture") return { score: 0, totalArea: 0, roomCount: 0, rooms: [], priorities: [] };

  const roomAudits = project.plan.rooms.map((room) => {
    const area = Math.max(0.1, room.width * room.height);
    const objects = project.plan.objects.filter((object) => object.roomId === room.id && object.category !== "stairs");
    const footprint = objects.reduce((sum, object) => sum + Math.max(0, object.width * object.depth), 0);
    const furnitureCoverage = Math.min(1, footprint / area);
    const openings = project.plan.openings.filter((opening) => (opening.level || 0) === (room.level || 0) && openingBelongsToRoom(project, room, opening.position.x, opening.position.y));
    const blockedOpeningCount = openings.filter((opening) => project.plan.objects.some((object) => {
      if (object.roomId !== room.id || object.category === "stairs") return false;
      const dx = Math.abs(object.x + object.width / 2 - opening.position.x); const dy = Math.abs(object.y + object.depth / 2 - opening.position.y);
      return dx < Math.max(.7, opening.width * .55) && dy < Math.max(.7, opening.width * .55);
    })).length;
    const spacingViolationCount = objectsTooCloseInRoom(project, room).length;
    const decorativeRoles = new Set(["rug", "lamp", "pendant", "plant", "side-table", "decor-console", "bench", "shelf"]);
    const decorativeElementCount = objects.filter((object) => decorativeRoles.has(String(object.metadata?.layoutRole || "")) || object.category === "plant" || object.category === "lighting").length;
    const materialCount = new Set(objects.map((object) => object.materialId).filter(Boolean).concat(room.floorMaterialId ? [room.floorMaterialId] : [])).size;
    const finishLevel = project.architecture?.finishLevel || project.architecture?.brief?.finishLevel || "balanced";
    const usage = `${room.usage} ${room.name}`.toLowerCase();
    const baseExpected = /living|salon|sejour|séjour/.test(usage) ? 7 : /dining|salle à manger|salle a manger/.test(usage) ? 7 : /bedroom|chambre|suite/.test(usage) ? 5 : /kitchen|cuisine/.test(usage) ? 4 : /bath|salle de bain|salle d.eau|wc/.test(usage) ? 3 : /office|bureau/.test(usage) ? 4 : 2;
    const multiplier = finishLevel === "luxury" ? 1.25 : finishLevel === "rich" ? 1.08 : finishLevel === "light" ? .7 : .9;
    const expectedObjects = Math.max(1, Math.round(baseExpected * multiplier));
    const expectedDecor = finishLevel === "luxury" ? Math.max(2, Math.round(expectedObjects * .35)) : finishLevel === "rich" ? Math.max(1, Math.round(expectedObjects * .25)) : 1;
    const objectRatio = Math.min(1, objects.length / Math.max(1, expectedObjects));
    const decorRatio = Math.min(1, decorativeElementCount / Math.max(1, expectedDecor));
    const materialRatio = Math.min(1, materialCount / (finishLevel === "luxury" ? 3 : 2));
    const finishScore = Math.round((objectRatio * .5 + decorRatio * .3 + materialRatio * .2) * 100);
    const windowCount = openings.filter((opening) => opening.kind === "window").length;
    const doorCount = openings.filter((opening) => opening.kind === "door").length;
    const connectionCount = room.connections?.length || 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (area < 6 && !/bath|wc|salle de bain/i.test(`${room.usage} ${room.name}`)) {
      issues.push("Surface très compacte pour cet usage.");
      recommendations.push("Réévaluer les dimensions ou réduire le programme mobilier.");
    }
    if (windowCount === 0 && !/garage|storage|wc/i.test(`${room.usage} ${room.name}`)) {
      issues.push("Aucune fenêtre détectée : lumière naturelle probablement faible.");
      recommendations.push("Créer une ouverture extérieure si la façade et le programme le permettent.");
    }
    if (furnitureCoverage > 0.38) {
      issues.push("Emprise mobilier élevée, circulation potentiellement contrainte.");
      recommendations.push("Réduire ou redistribuer le mobilier pour préserver les cheminements.");
    } else if (objects.length > 0 && furnitureCoverage < 0.08 && /living|salon|bedroom|chambre/i.test(`${room.usage} ${room.name}`)) {
      recommendations.push("La pièce reste très peu occupée ; vérifier l'échelle et les zones fonctionnelles.");
    }
    const sameLevelCount = project.plan.rooms.filter((candidate) => (candidate.level || 0) === (room.level || 0)).length;
    if (connectionCount === 0 && sameLevelCount > 1) {
      issues.push("Pièce isolée dans le graphe de circulation de ce niveau.");
      recommendations.push("Vérifier la connexion par porte avec une pièce adjacente.");
    }
    if (blockedOpeningCount > 0) {
      issues.push(`${blockedOpeningCount} ouverture(s) potentiellement gênée(s) par du mobilier.`);
      recommendations.push("Repositionner le mobilier pour libérer portes et fenêtres.");
    }
    if (spacingViolationCount > 0) {
      issues.push(`${spacingViolationCount} conflit(s) de distance entre meubles.`);
      recommendations.push("Réorganiser la composition pour rétablir des dégagements confortables entre les meubles.");
    }
    if ((finishLevel === "luxury" || finishLevel === "rich") && finishScore < 72 && !/garage|terrasse|circulation/.test(usage)) {
      issues.push(`Niveau de finition insuffisant pour le brief ${finishLevel} (${finishScore}/100).`);
      recommendations.push("Enrichir la pièce avec du mobilier secondaire, des luminaires, textiles et détails décoratifs cohérents sans surcharger la circulation.");
    }
    if (finishLevel === "luxury" && materialCount < 2 && objects.length > 0) {
      recommendations.push("Diversifier subtilement les matières : dominant, secondaire et accent, sans casser la palette.");
    }

    let score = 100;
    score -= windowCount === 0 ? 18 : 0;
    score -= connectionCount === 0 && sameLevelCount > 1 ? 22 : 0;
    score -= blockedOpeningCount * 8;
    score -= Math.min(24, spacingViolationCount * 6);
    score -= furnitureCoverage > 0.38 ? Math.min(25, Math.round((furnitureCoverage - 0.38) * 80)) : 0;
    score -= area < 6 && !/bath|wc|salle de bain/i.test(`${room.usage} ${room.name}`) ? 15 : 0;
    if (finishLevel === "luxury" || finishLevel === "rich") score = Math.round(score * .78 + finishScore * .22);
    score = Math.max(0, Math.min(100, score));

    return {
      roomId: room.id,
      roomName: room.name,
      area: Number(area.toFixed(1)),
      furnitureCoverage: Number((furnitureCoverage * 100).toFixed(1)),
      windowCount,
      doorCount,
      connectionCount,
      blockedOpeningCount,
      spacingViolationCount,
      decorativeElementCount,
      materialCount,
      finishScore,
      score,
      issues,
      recommendations
    };
  });

  const totalArea = roomAudits.reduce((sum, room) => sum + room.area, 0);
  const score = roomAudits.length ? Math.round(roomAudits.reduce((sum, room) => sum + room.score, 0) / roomAudits.length) : 0;
  const priorities = roomAudits.flatMap((room) => room.issues.map((issue) => `${room.roomName} : ${issue}`));
  const levels = [...new Set(project.plan.rooms.map((room) => room.level || 0))];
  if (levels.length > 1 && !project.plan.objects.some((object) => object.category === "stairs")) priorities.unshift("Maison multi-niveaux sans escalier de liaison détecté.");

  return { score, totalArea: Number(totalArea.toFixed(1)), roomCount: roomAudits.length, rooms: roomAudits, priorities: priorities.slice(0, 8) };
}
