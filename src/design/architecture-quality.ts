import { analyzeArchitecture } from "./architecture-audit";
import { findSmartPlacementInRoom, openingClearanceOk, syncArchitectureNavigation } from "./architecture";
import { findClearPlacementForObject, objectsTooCloseInRoom, validateRoomClearances } from "./interior-composition";
import type { DesignObject, DesignProject } from "./types";

export type ArchitectureQualityReport = {
  beforeScore: number;
  afterScore: number;
  fixes: string[];
  warnings: string[];
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function objectInsideRoom(object: DesignObject, room: DesignProject["plan"]["rooms"][number]): boolean {
  const margin = .06;
  return object.x >= room.x + margin && object.y >= room.y + margin
    && object.x + object.width <= room.x + room.width - margin
    && object.y + object.depth <= room.y + room.height - margin;
}

export function runArchitectureQualityPass(source: DesignProject): { project: DesignProject; report: ArchitectureQualityReport } {
  let project = structuredClone(source);
  const before = analyzeArchitecture(project);
  const fixes: string[] = [];
  const warnings: string[] = [];

  for (const room of project.plan.rooms) {
    if (!room.floorMaterialId) room.floorMaterialId = /bath|salle de bain|cuisine/i.test(`${room.usage} ${room.name}`) ? "mat-marble" : "mat-oak";
    if (!room.color) room.color = project.architecture?.palette?.[0] || "#f3eee6";
    room.ceilingHeight = Math.max(2.45, room.ceilingHeight || project.plan.wallHeight);
  }

  for (const object of project.plan.objects) {
    const room = project.plan.rooms.find((item) => item.id === object.roomId);
    if (!room) continue;
    object.level = room.level || 0;
    if (object.category === "stairs") continue;
    if (!objectInsideRoom(object, room) || !openingClearanceOk(project, room, object, .42)) {
      const previousX = object.x, previousY = object.y;
      project.plan.objects = project.plan.objects.filter((item) => item.id !== object.id);
      const placement = findSmartPlacementInRoom(project, room, object.width, object.depth, object.name);
      project.plan.objects.push(object);
      if (placement) { object.x = placement.x; object.y = placement.y; fixes.push(`${object.name} replacé dans ${room.name} pour libérer la circulation et les ouvertures.`); }
      else { object.x = previousX; object.y = previousY; warnings.push(`${object.name} ne peut pas être placé proprement dans ${room.name}.`); }
    }
  }

  // V7: enforce semantic separation between furniture pieces, not merely no-overlap.
  for (const room of project.plan.rooms) {
    let guard = 0;
    while (guard < 24) {
      guard += 1;
      const pair = objectsTooCloseInRoom(project, room)[0];
      if (!pair) break;
      const [a, b] = pair;
      const priority = (object: DesignObject) => Number(object.metadata?.layoutPriority ?? 50);
      const movable = priority(a) <= priority(b) ? a : b;
      const placement = findClearPlacementForObject(project, room, movable);
      if (placement) {
        movable.x = placement.x; movable.y = placement.y; movable.rotation = placement.rotation;
        fixes.push(`${movable.name} espacé des autres meubles dans ${room.name}.`);
        continue;
      }
      if (/^v[67]$/.test(String(movable.metadata?.compositionEngine || "")) && priority(movable) < 72) {
        project.plan.objects = project.plan.objects.filter((item) => item.id !== movable.id);
        fixes.push(`${movable.name} retiré de ${room.name} : l'espace ne permettait pas un placement propre.`);
        continue;
      }
      warnings.push(`${a.name} et ${b.name} restent trop proches dans ${room.name}.`);
      break;
    }
    const roomIssues = validateRoomClearances(project, room);
    if (roomIssues.length) warnings.push(...roomIssues.slice(0, 3));
  }

  const levelIndexes = [...new Set(project.plan.rooms.map((room) => room.level || 0))].sort((a, b) => a - b);
  if (levelIndexes.length > 1) {
    for (let index = 0; index + 1 < levelIndexes.length; index += 1) {
      const from = levelIndexes[index]; const to = levelIndexes[index + 1];
      const exists = project.plan.objects.some((object) => object.category === "stairs" && Number(object.metadata?.fromLevel ?? object.level ?? 0) === from && Number(object.metadata?.toLevel ?? from + 1) === to);
      if (exists) continue;
      const room = project.plan.rooms.find((item) => (item.level || 0) === from && /hall|salon|living|séjour|sejour/i.test(`${item.usage} ${item.name}`)) || project.plan.rooms.find((item) => (item.level || 0) === from);
      if (!room) continue;
      const width = Math.min(1.05, Math.max(.85, room.width * .23)); const depth = Math.min(3, Math.max(2.2, room.height * .58));
      const placement = findSmartPlacementInRoom(project, room, width, depth, "Escalier") || { x: room.x + .24, y: room.y + .24 };
      project.plan.objects.push({ id: uid("stairs"), name: `Escalier niveau ${from + 1}→${to + 1}`, category: "stairs", x: placement.x, y: placement.y, width, depth, height: project.plan.wallHeight + .28, rotation: 0, materialId: "mat-oak", roomId: room.id, level: from, metadata: { fromLevel: from, toLevel: to } });
      fixes.push(`Escalier ajouté entre les niveaux ${from + 1} et ${to + 1}.`);
    }
  }

  project = syncArchitectureNavigation(project);
  const after = analyzeArchitecture(project);
  if (after.priorities.length) warnings.push(...after.priorities.slice(0, 4));
  const finishLevel = project.architecture?.finishLevel || project.architecture?.brief?.finishLevel || "balanced";
  if (finishLevel === "rich" || finishLevel === "luxury") {
    for (const roomAudit of after.rooms) {
      if ((roomAudit.finishScore ?? 100) < 72) {
        warnings.push(`${roomAudit.roomName} manque encore de finition (${roomAudit.finishScore ?? 0}/100).`);
      }
    }
  }
  project.architecture = { ...(project.architecture || { cameraMode: "exterior", roomOrder: project.plan.rooms.map((room) => room.id) }), cameraMode: project.architecture?.cameraMode || "exterior", roomOrder: project.architecture?.roomOrder || project.plan.rooms.map((room) => room.id), lastAuditScore: after.score, lastAuditAt: new Date().toISOString() };
  return { project, report: { beforeScore: before.score, afterScore: after.score, fixes, warnings } };
}
