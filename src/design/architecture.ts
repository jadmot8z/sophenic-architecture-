import type { DesignNavigationNode, DesignOpening, DesignProject, DesignRoom, DesignWall } from "./types";

const uid = (prefix = "arch") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type ArchitectureRoomRequest = { name: string; usage?: string; width?: number; depth?: number };

function wallKey(x1: number, y1: number, x2: number, y2: number): string {
  const a = `${x1.toFixed(3)}:${y1.toFixed(3)}`;
  const b = `${x2.toFixed(3)}:${y2.toFixed(3)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function wallsForRooms(rooms: DesignRoom[], height: number): DesignWall[] {
  type Edge = { axis: "h" | "v"; fixed: number; start: number; end: number; level: number };
  const edges: Edge[] = [];
  for (const room of rooms) {
    const level = room.level || 0;
    edges.push(
      { axis: "h", fixed: room.y, start: room.x, end: room.x + room.width, level },
      { axis: "v", fixed: room.x + room.width, start: room.y, end: room.y + room.height, level },
      { axis: "h", fixed: room.y + room.height, start: room.x, end: room.x + room.width, level },
      { axis: "v", fixed: room.x, start: room.y, end: room.y + room.height, level }
    );
  }
  const groups = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = `${edge.level}:${edge.axis}:${edge.fixed.toFixed(4)}`;
    const group = groups.get(key) || []; group.push(edge); groups.set(key, group);
  }
  const walls: DesignWall[] = [];
  for (const group of groups.values()) {
    const axis = group[0]?.axis; const fixed = group[0]?.fixed; const level = group[0]?.level || 0; if (!axis || fixed === undefined) continue;
    const points = [...new Set(group.flatMap((edge) => [edge.start, edge.end]).map((value) => Number(value.toFixed(6))))].sort((a, b) => a - b);
    for (let index = 0; index + 1 < points.length; index += 1) {
      const a = points[index], b = points[index + 1], mid = (a + b) / 2;
      if (b - a < .015 || !group.some((edge) => mid >= edge.start - 1e-6 && mid <= edge.end + 1e-6)) continue;
      walls.push(axis === "h"
        ? { id: uid("wall"), start: { x: a, y: fixed }, end: { x: b, y: fixed }, thickness: .18, height, materialId: "mat-wall", level }
        : { id: uid("wall"), start: { x: fixed, y: a }, end: { x: fixed, y: b }, thickness: .18, height, materialId: "mat-wall", level });
    }
  }
  return walls;
}

function pointOnWall(wall: DesignWall, x: number, y: number): boolean {
  const minX = Math.min(wall.start.x, wall.end.x) - 0.03;
  const maxX = Math.max(wall.start.x, wall.end.x) + 0.03;
  const minY = Math.min(wall.start.y, wall.end.y) - 0.03;
  const maxY = Math.max(wall.start.y, wall.end.y) + 0.03;
  const horizontal = Math.abs(wall.start.y - wall.end.y) < 0.03 && Math.abs(y - wall.start.y) < 0.04;
  const vertical = Math.abs(wall.start.x - wall.end.x) < 0.03 && Math.abs(x - wall.start.x) < 0.04;
  return (horizontal || vertical) && x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function openingAt(walls: DesignWall[], kind: "door" | "window", x: number, y: number, width: number, height: number, sill = 0, level = 0): DesignOpening {
  const wall = walls.find((item) => (item.level || 0) === level && pointOnWall(item, x, y));
  const vertical = wall ? Math.abs(wall.start.x - wall.end.x) < Math.abs(wall.start.y - wall.end.y) : false;
  return { id: uid("opening"), kind, wallId: wall?.id, position: { x, y }, width, height, sill, rotation: vertical ? Math.PI / 2 : 0, level };
}

function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

export function roomAdjacency(rooms: DesignRoom[]): Map<string, string[]> {
  const map = new Map<string, string[]>(rooms.map((room) => [room.id, []]));
  const epsilon = 0.08;
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i]; const b = rooms[j];
      if ((a.level || 0) !== (b.level || 0)) continue;
      const verticalTouch = (Math.abs(a.x + a.width - b.x) < epsilon || Math.abs(b.x + b.width - a.x) < epsilon) && overlap(a.y, a.y + a.height, b.y, b.y + b.height) > 0.7;
      const horizontalTouch = (Math.abs(a.y + a.height - b.y) < epsilon || Math.abs(b.y + b.height - a.y) < epsilon) && overlap(a.x, a.x + a.width, b.x, b.x + b.width) > 0.7;
      if (!verticalTouch && !horizontalTouch) continue;
      map.get(a.id)?.push(b.id); map.get(b.id)?.push(a.id);
    }
  }
  return map;
}

export function navigationNodesForRoom(room: DesignRoom): DesignNavigationNode[] {
  // V6: keep viewpoints comfortably away from walls/furniture and aim every
  // secondary point back toward the visual centre of the room. This makes the
  // first interior frame feel like a real estate walkthrough rather than a
  // camera spawned against a wall.
  const center = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
  const marginX = Math.max(.72, Math.min(1.15, room.width * .24));
  const marginY = Math.max(.72, Math.min(1.15, room.height * .24));
  const candidates = room.width >= room.height
    ? [center, { x: room.x + marginX, y: center.y }, { x: room.x + room.width - marginX, y: center.y }]
    : [center, { x: center.x, y: room.y + marginY }, { x: center.x, y: room.y + room.height - marginY }];
  const yawToward = (point: { x: number; y: number }) => {
    const dx = center.x - point.x; const dz = center.y - point.y;
    if (Math.abs(dx) + Math.abs(dz) < .001) return room.width >= room.height ? Math.PI / 2 : 0;
    return Math.atan2(-dx, -dz);
  };
  const nodes = candidates.map((point, index) => ({
    id: uid("nav"), roomId: room.id, label: index === 0 ? "Vue principale" : `Point ${index + 1}`,
    x: point.x, y: point.y, eyeHeight: 1.62, yaw: yawToward(point), connections: [] as string[]
  }));
  for (let index = 0; index < nodes.length; index += 1) {
    if (index > 0) nodes[index].connections.push(nodes[index - 1].id);
    if (index + 1 < nodes.length) nodes[index].connections.push(nodes[index + 1].id);
  }
  return nodes;
}

export function syncArchitectureNavigation(project: DesignProject): DesignProject {
  const next = structuredClone(project);
  const adjacency = roomAdjacency(next.plan.rooms);
  for (const room of next.plan.rooms) {
    room.connections = adjacency.get(room.id) || [];
    if (!room.navigationNodes?.length || room.navigationNodes[0]?.label !== "Vue principale" || room.navigationNodes.some((node) => !pointInsideRoom(room, node.x, node.y, 0.08))) room.navigationNodes = navigationNodesForRoom(room);
    room.defaultNavigationNodeId = room.navigationNodes[0]?.id;
  }
  const roomOrder: string[] = [];
  const visited = new Set<string>();
  const queue = next.plan.rooms[0] ? [next.plan.rooms[0].id] : [];
  while (queue.length) {
    const id = queue.shift()!; if (visited.has(id)) continue; visited.add(id); roomOrder.push(id);
    for (const neighbor of adjacency.get(id) || []) if (!visited.has(neighbor)) queue.push(neighbor);
  }
  for (const room of next.plan.rooms) if (!visited.has(room.id)) roomOrder.push(room.id);
  const levelIndexes = [...new Set(next.plan.rooms.map((room) => room.level || 0))].sort((a, b) => a - b);
  const levels = levelIndexes.map((index) => ({
    id: `level-${index}`,
    name: index === 0 ? "Rez-de-chaussée" : `Étage ${index}`,
    index,
    elevation: index * (next.plan.wallHeight + .28),
    height: next.plan.wallHeight
  }));
  const activeRoomId = next.architecture?.activeRoomId && next.plan.rooms.some((room) => room.id === next.architecture?.activeRoomId) ? next.architecture.activeRoomId : next.plan.rooms[0]?.id;
  const activeRoom = next.plan.rooms.find((room) => room.id === activeRoomId);
  next.architecture = {
    ...next.architecture,
    roomOrder,
    activeRoomId,
    activeLevel: activeRoom?.level || 0,
    levels,
    autonomy: next.architecture?.autonomy || "high",
    cameraMode: next.architecture?.cameraMode === "interior" ? "interior" : "exterior"
  };
  return next;
}

function roomsTouchingSide(room: DesignRoom, rooms: DesignRoom[], side: "top" | "right" | "bottom" | "left"): boolean {
  const epsilon = 0.08;
  return rooms.some((other) => {
    if (other.id === room.id || (other.level || 0) !== (room.level || 0)) return false;
    if (side === "top") return Math.abs(other.y + other.height - room.y) < epsilon && overlap(other.x, other.x + other.width, room.x, room.x + room.width) > 0.7;
    if (side === "bottom") return Math.abs(room.y + room.height - other.y) < epsilon && overlap(other.x, other.x + other.width, room.x, room.x + room.width) > 0.7;
    if (side === "left") return Math.abs(other.x + other.width - room.x) < epsilon && overlap(other.y, other.y + other.height, room.y, room.y + room.height) > 0.7;
    return Math.abs(room.x + room.width - other.x) < epsilon && overlap(other.y, other.y + other.height, room.y, room.y + room.height) > 0.7;
  });
}

function sharedBoundaryPoint(a: DesignRoom, b: DesignRoom): { x: number; y: number } | null {
  if ((a.level || 0) !== (b.level || 0)) return null;
  const epsilon = 0.08;
  if (Math.abs(a.x + a.width - b.x) < epsilon || Math.abs(b.x + b.width - a.x) < epsilon) {
    const y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.height, b.y + b.height);
    if (y2 - y1 > 0.7) return { x: Math.abs(a.x + a.width - b.x) < epsilon ? b.x : a.x, y: (y1 + y2) / 2 };
  }
  if (Math.abs(a.y + a.height - b.y) < epsilon || Math.abs(b.y + b.height - a.y) < epsilon) {
    const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.width, b.x + b.width);
    if (x2 - x1 > 0.7) return { x: (x1 + x2) / 2, y: Math.abs(a.y + a.height - b.y) < epsilon ? b.y : a.y };
  }
  return null;
}

/** Rebuilds walls/openings from the room geometry after any structural edit. */
export function rebuildArchitectureStructure(source: DesignProject): DesignProject {
  const next = structuredClone(source);
  next.plan.walls = wallsForRooms(next.plan.rooms, next.plan.wallHeight);
  const openings: DesignOpening[] = [];
  const levels = [...new Set(next.plan.rooms.map((room) => room.level || 0))].sort((a, b) => a - b);
  for (const level of levels) {
    const rooms = next.plan.rooms.filter((room) => (room.level || 0) === level);
    const first = rooms[0];
    if (first && level === 0) openings.push(openingAt(next.plan.walls, "door", first.x + first.width / 2, first.y, Math.min(1.1, first.width * .3), 2.15, 0, level));
    const adjacency = roomAdjacency(rooms);
    const paired = new Set<string>();
    for (const room of rooms) {
      for (const otherId of adjacency.get(room.id) || []) {
        const key = [room.id, otherId].sort().join(":"); if (paired.has(key)) continue; paired.add(key);
        const other = rooms.find((item) => item.id === otherId); if (!other) continue;
        const point = sharedBoundaryPoint(room, other); if (point) openings.push(openingAt(next.plan.walls, "door", point.x, point.y, .92, 2.12, 0, level));
      }
      const sides: Array<"top" | "right" | "bottom" | "left"> = room.id === first?.id ? ["right", "bottom", "left", "top"] : ["top", "right", "bottom", "left"];
      const side = sides.find((candidate) => !roomsTouchingSide(room, rooms, candidate) && !(room.id === first?.id && level === 0 && candidate === "top"));
      if (side) {
        const position = side === "top" ? { x: room.x + room.width / 2, y: room.y }
          : side === "bottom" ? { x: room.x + room.width / 2, y: room.y + room.height }
          : side === "left" ? { x: room.x, y: room.y + room.height / 2 }
          : { x: room.x + room.width, y: room.y + room.height / 2 };
        const span = side === "top" || side === "bottom" ? room.width : room.height;
        const bathroom = /bath|salle de bain|wc/i.test(`${room.usage || ""} ${room.name}`);
        openings.push(openingAt(next.plan.walls, "window", position.x, position.y, Math.min(bathroom ? 1 : 2.25, span * .52), bathroom ? .72 : 1.45, bathroom ? 1.35 : .72, level));
      }
    }
  }
  next.plan.openings = openings;
  return syncArchitectureNavigation(next);
}


function recommendedRoomSize(name: string, usage?: string): { width: number; depth: number } {
  const value = `${usage || ""} ${name}`.toLowerCase();
  if (/living|salon|séjour|sejour/.test(value)) return { width: 5.4, depth: 4.4 };
  if (/kitchen|cuisine/.test(value)) return { width: 3.8, depth: 3.6 };
  if (/bedroom|chambre/.test(value)) return { width: 3.6, depth: 3.4 };
  if (/bath|salle de bain|wc/.test(value)) return { width: 2.4, depth: 2.2 };
  if (/office|bureau/.test(value)) return { width: 3.2, depth: 3.0 };
  if (/garage/.test(value)) return { width: 5.4, depth: 3.4 };
  if (/terrace|terrasse/.test(value)) return { width: 4.4, depth: 2.8 };
  return { width: 3.4, depth: 3.2 };
}

export function buildArchitectureLayout(source: DesignProject, requests: ArchitectureRoomRequest[]): DesignProject {
  const next = structuredClone(source);
  const clean = requests.filter((item) => item.name.trim()).slice(0, 24);
  const sourceRooms = clean.length ? clean : [
    { name: "Salon", usage: "living" }, { name: "Cuisine", usage: "kitchen" }, { name: "Chambre 1", usage: "bedroom" }, { name: "Salle de bain", usage: "bathroom" }
  ];
  const columns = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(sourceRooms.length))));
  const rows = Math.max(1, Math.ceil(sourceRooms.length / columns));
  const margin = 0.6;
  const requestedSizes = sourceRooms.map((item) => { const recommended = recommendedRoomSize(item.name, item.usage); return { width: Math.max(2.0, item.width || recommended.width), depth: Math.max(2.0, item.depth || recommended.depth) }; });
  const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(...requestedSizes.filter((_, index) => index % columns === column).map((size) => size.width), 2.4));
  const rowDepths = Array.from({ length: rows }, (_, row) => Math.max(...requestedSizes.filter((_, index) => Math.floor(index / columns) === row).map((size) => size.depth), 2.4));
  const columnOffsets = columnWidths.map((_, index) => margin + columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0));
  const rowOffsets = rowDepths.map((_, index) => margin + rowDepths.slice(0, index).reduce((sum, value) => sum + value, 0));
  const rooms: DesignRoom[] = sourceRooms.map((item, index) => {
    const column = index % columns; const row = Math.floor(index / columns);
    return {
      id: uid("room"), name: item.name.slice(0, 80), usage: item.usage || "multi-purpose",
      x: columnOffsets[column], y: rowOffsets[row],
      // Fill the grid cell so adjacent rooms share real walls. The grid cell is
      // sized from the requested/recommended dimensions, avoiding dead gaps.
      width: columnWidths[column], height: rowDepths[row],
      floorMaterialId: "mat-oak", ceilingHeight: next.plan.wallHeight, color: "#f1ede5"
    };
  });
  next.plan.width = margin * 2 + columnWidths.reduce((sum, value) => sum + value, 0);
  next.plan.height = margin * 2 + rowDepths.reduce((sum, value) => sum + value, 0);
  next.site.width = next.plan.width; next.site.depth = next.plan.height;
  next.plan.rooms = rooms;
  next.plan.objects = [];
  next.plan.annotations = [];
  next.updatedAt = new Date().toISOString();
  next.revision += 1;
  return rebuildArchitectureStructure(next);
}

export function buildVillaProgram(source: DesignProject, levelRequests: Array<{ name?: string; rooms: ArchitectureRoomRequest[] }>): DesignProject {
  const next = structuredClone(source);
  const requests = levelRequests.filter((level) => level.rooms.some((room) => room.name.trim())).slice(0, 4);
  const sourceLevels = requests.length ? requests : [
    { name: "Rez-de-chaussée", rooms: [{ name: "Salon", usage: "living" }, { name: "Cuisine", usage: "kitchen" }, { name: "Salle à manger", usage: "dining" }, { name: "Salle d’eau", usage: "bathroom" }] },
    { name: "Étage 1", rooms: [{ name: "Suite parentale", usage: "bedroom" }, { name: "Chambre 2", usage: "bedroom" }, { name: "Chambre 3", usage: "bedroom" }, { name: "Salle de bain", usage: "bathroom" }] }
  ];
  const allRooms: DesignRoom[] = [];
  let maxWidth = 0; let maxDepth = 0;
  sourceLevels.forEach((level, levelIndex) => {
    const temp = buildArchitectureLayout(next, level.rooms);
    const levelRooms = temp.plan.rooms.map((room) => ({ ...room, id: uid("room"), level: levelIndex, navigationNodes: undefined, defaultNavigationNodeId: undefined, connections: [] }));
    maxWidth = Math.max(maxWidth, temp.plan.width); maxDepth = Math.max(maxDepth, temp.plan.height);
    allRooms.push(...levelRooms);
  });
  next.plan.rooms = allRooms;
  next.plan.width = maxWidth; next.plan.height = maxDepth; next.site.width = maxWidth; next.site.depth = maxDepth;
  next.plan.objects = []; next.plan.annotations = [];
  next.architecture = { ...(next.architecture || { cameraMode: "exterior", roomOrder: [] }), cameraMode: "exterior", roomOrder: [], activeLevel: 0, autonomy: "high" };
  next.updatedAt = new Date().toISOString(); next.revision += 1;
  return rebuildArchitectureStructure(next);
}

export function roomElevation(project: DesignProject, roomOrLevel: DesignRoom | number): number {
  const level = typeof roomOrLevel === "number" ? roomOrLevel : roomOrLevel.level || 0;
  return project.architecture?.levels?.find((item) => item.index === level)?.elevation ?? level * (project.plan.wallHeight + .28);
}

export function createDefaultArchitecture(source: DesignProject): DesignProject {
  return buildArchitectureLayout(source, [
    { name: "Salon", usage: "living" },
    { name: "Cuisine", usage: "kitchen" },
    { name: "Chambre 1", usage: "bedroom" },
    { name: "Salle de bain", usage: "bathroom" }
  ]);
}

export function pointInsideRoom(room: DesignRoom, x: number, y: number, padding = 0.2): boolean {
  return x >= room.x + padding && x <= room.x + room.width - padding && y >= room.y + padding && y <= room.y + room.height - padding;
}

export function objectFitsRoom(project: DesignProject, room: DesignRoom, object: { x: number; y: number; width: number; depth: number }, clearance = 0.12): boolean {
  if (!pointInsideRoom(room, object.x + clearance, object.y + clearance, 0) || !pointInsideRoom(room, object.x + object.width - clearance, object.y + object.depth - clearance, 0)) return false;
  return !project.plan.objects.some((other) => {
    if (other.id === (object as { id?: string }).id) return false;
    const separated = object.x + object.width + clearance <= other.x || other.x + other.width + clearance <= object.x || object.y + object.depth + clearance <= other.y || other.y + other.depth + clearance <= object.y;
    return !separated;
  });
}


export function openingClearanceOk(project: DesignProject, room: DesignRoom, object: { x: number; y: number; width: number; depth: number }, clearance = .65): boolean {
  const cx = object.x + object.width / 2; const cy = object.y + object.depth / 2;
  const openings = project.plan.openings.filter((opening) => (opening.level || 0) === (room.level || 0));
  return !openings.some((opening) => {
    const onRoomBoundary = Math.abs(opening.position.x - room.x) < .08 || Math.abs(opening.position.x - (room.x + room.width)) < .08 || Math.abs(opening.position.y - room.y) < .08 || Math.abs(opening.position.y - (room.y + room.height)) < .08;
    if (!onRoomBoundary) return false;
    const dx = Math.abs(cx - opening.position.x); const dy = Math.abs(cy - opening.position.y);
    return dx < object.width / 2 + opening.width / 2 + clearance && dy < object.depth / 2 + clearance;
  });
}

export function findSmartPlacementInRoom(project: DesignProject, room: DesignRoom, width: number, depth: number, name = "Objet"): { x: number; y: number } | null {
  const normalized = name.toLowerCase(); const step = .28; const candidates: Array<{ x: number; y: number; score: number }> = [];
  const roomCx = room.x + room.width / 2; const roomCy = room.y + room.height / 2;
  for (let y = room.y + .22; y <= room.y + room.height - depth - .22; y += step) {
    for (let x = room.x + .22; x <= room.x + room.width - width - .22; x += step) {
      const object = { x, y, width, depth };
      if (!objectFitsRoom(project, room, object, .1) || !openingClearanceOk(project, room, object, .48)) continue;
      const cx = x + width / 2, cy = y + depth / 2;
      const centerDistance = Math.hypot(cx - roomCx, cy - roomCy);
      const wallDistance = Math.min(cx - room.x, room.x + room.width - cx, cy - room.y, room.y + room.height - cy);
      let score = 0;
      if (/table basse|coffee table|îlot|ilot|island|table repas|dining/.test(normalized)) score -= centerDistance * 2.2;
      else if (/canap|sofa|lit|bed|meuble tv|console|bureau|desk/.test(normalized)) score -= wallDistance * 2.4;
      else if (/plante|plant|lampe|lampadaire/.test(normalized)) score -= wallDistance * 1.5 + centerDistance * .2;
      else score -= centerDistance;
      const related = project.plan.objects.filter((item) => item.roomId === room.id);
      if (/table basse|coffee table/.test(normalized)) {
        const sofa = related.find((item) => /canap|sofa/i.test(item.name)); if (sofa) score -= Math.abs(Math.hypot(cx - (sofa.x + sofa.width/2), cy - (sofa.y + sofa.depth/2)) - 1.25) * 2;
      }
      if (/meuble tv|console/.test(normalized)) {
        const sofa = related.find((item) => /canap|sofa/i.test(item.name)); if (sofa) score += Math.hypot(cx - (sofa.x + sofa.width/2), cy - (sofa.y + sofa.depth/2)) * .35;
      }
      candidates.push({ x, y, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score); return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
}

export function findPlacementInRoom(project: DesignProject, room: DesignRoom, width: number, depth: number): { x: number; y: number } | null {
  const step = 0.35;
  for (let y = room.y + 0.3; y <= room.y + room.height - depth - 0.3; y += step) {
    for (let x = room.x + 0.3; x <= room.x + room.width - width - 0.3; x += step) {
      if (objectFitsRoom(project, room, { x, y, width, depth })) return { x, y };
    }
  }
  return null;
}
