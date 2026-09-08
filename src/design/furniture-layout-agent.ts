import { furnitureSpec, type FurnitureSpec } from "./furniture-catalog";
import { objectFitsRoom } from "./architecture";
import type { DesignObject, DesignProject, DesignRoom } from "./types";

/**
 * SOPHENIC DESIGN V8.2 — FURNITURE LAYOUT AGENT.
 *
 * Le placement n'est pas codé : l'agent DÉCIDE position, rotation, distances,
 * circulation et équilibre visuel par scoring sous contraintes ergonomiques :
 *  - distance canapé ↔ table basse 0,42–0,68 m ;
 *  - distance canapé ↔ zone TV/meuble focal ≥ 1,9 m ;
 *  - passages de portes protégés (≥ 0,62 m) ;
 *  - un meuble bas (h ≤ 1,15 m) peut passer sous une fenêtre (usage réel) ;
 *  - dorsales (canapés/lits) adossées à une paroi, face au point focal ;
 *  - symétrie des fauteuils autour de l'axe focal ;
 *  - équilibre visuel (barycentre du mobilier proche du centre de la pièce) ;
 *  - un tapis (h ≤ 6 cm) passe SOUS le mobilier.
 *
 * Géométrie : chaque placement est exprimé en EMPREINTE DE PLAN (box), déjà
 * tenant compte de la rotation — les vérifications (murs, ouvertures,
 * superpositions) utilisent cette empreinte, l'objet stocke ses dimensions
 * brutes + rotation pour le rendu 3D.
 */

const uid = (prefix = "layout") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type LayoutDecision = { name: string; x: number; y: number; rotation: number; reasons: string[] };
export type LayoutResult = { objects: DesignObject[]; decisions: LayoutDecision[]; skipped: Array<{ name: string; reason: string }>; focalSide: Side; warnings: string[] };
type Side = "north" | "south" | "east" | "west";
type Box = { x: number; y: number; width: number; depth: number };

const SIDE_NORMAL: Record<Side, { x: number; y: number }> = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };
const opposite = (side: Side): Side => side === "north" ? "south" : side === "south" ? "north" : side === "east" ? "west" : "east";

/** Face avant d'un objet (rotation 0 = nord), en coordonnées plan. */
function facingVector(rotation: number): { x: number; y: number } {
  return { x: Math.sin(rotation), y: -Math.cos(rotation) };
}
function rotationToward(dx: number, dy: number): number {
  return Math.atan2(dx, -dy);
}

function rectOverlap(a: Box, b: Box, gap: number): boolean {
  return !(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x || a.y + a.depth + gap <= b.y || b.y + b.depth + gap <= a.y);
}

/** Mur focal : opposé à la plus grande fenêtre (la TV ne fait pas face à la lumière). */
function focalWallFor(project: DesignProject, room: DesignRoom): Side {
  const onBoundary = (opening: { position: { x: number; y: number } }): Side | null => {
    if (Math.abs(opening.position.y - room.y) < .12) return "north";
    if (Math.abs(opening.position.y - (room.y + room.height)) < .12) return "south";
    if (Math.abs(opening.position.x - room.x) < .12) return "west";
    if (Math.abs(opening.position.x - (room.x + room.width)) < .12) return "east";
    return null;
  };
  let best: Side = room.width <= room.height ? "north" : "west";
  let bestWidth = 0;
  for (const opening of project.plan.openings) {
    if (opening.kind !== "window" || (opening.level || 0) !== (room.level || 0)) continue;
    const side = onBoundary(opening);
    if (!side) continue;
    if ((opening.width || 0) > bestWidth) { bestWidth = opening.width || 0; best = opposite(side); }
  }
  return best;
}

/**
 * Empreinte d'un meuble adossé à un mur : la box tient compte de la rotation
 * (un canapé de 2,2 × 0,95 m adossé à un mur ouest occupe 0,95 × 2,2 m au sol).
 */
function againstWall(room: DesignRoom, spec: { width: number; depth: number }, side: Side, gapWall: number, alongRatio: number): { box: Box; rotation: number } {
  const horizontal = side === "north" || side === "south";
  const span = spec.width;   // emprise LE LONG du mur (la largeur du meuble, rotation appliquée)
  const offWall = spec.depth; // emprise EN FACE du mur (la profondeur du meuble)
  const roomSpan = horizontal ? room.width : room.height;
  const alongBase = horizontal ? room.x : room.y;
  const along = alongBase + Math.max(.2, Math.min(Math.max(0, roomSpan - span - .2), (roomSpan - span) * alongRatio));
  const rotation = rotationToward(-SIDE_NORMAL[side].x, -SIDE_NORMAL[side].y);
  if (side === "north") return { box: { x: along, y: room.y + gapWall, width: span, depth: offWall }, rotation };
  if (side === "south") return { box: { x: along, y: room.y + room.height - gapWall - offWall, width: span, depth: offWall }, rotation };
  if (side === "west") return { box: { x: room.x + gapWall, y: along, width: offWall, depth: span }, rotation };
  return { box: { x: room.x + room.width - gapWall - offWall, y: along, width: offWall, depth: span }, rotation };
}

/** Règle d'ouverture réaliste : porte = passage protégé ; fenêtre = seulement si meuble haut. */
function openingConflicts(project: DesignProject, room: DesignRoom, box: Box, objectHeight: number, doorMargin = .35): boolean {
  const cx = box.x + box.width / 2; const cy = box.y + box.depth / 2;
  const openings = project.plan.openings.filter((opening) => (opening.level || 0) === (room.level || 0));
  for (const opening of openings) {
    const onBoundary = Math.abs(opening.position.x - room.x) < .12 || Math.abs(opening.position.x - (room.x + room.width)) < .12 || Math.abs(opening.position.y - room.y) < .12 || Math.abs(opening.position.y - (room.y + room.height)) < .12;
    if (!onBoundary) continue;
    const ow = opening.width || .9;
    const dx = Math.abs(cx - opening.position.x);
    const dy = Math.abs(cy - opening.position.y);
    const horizontalOverlap = dx < box.width / 2 + ow / 2 + doorMargin;
    if (!horizontalOverlap) continue;
    if (opening.kind === "door") {
      // Passage : on garde ≥ 0,62 m de profondeur devant la porte.
      if (dy < box.depth / 2 + .62) return true;
    } else if (objectHeight > 1.15) {
      // Un meuble haut devant une fenêtre la masque.
      if (dy < box.depth / 2 + .5) return true;
    }
  }
  return false;
}

function boxFits(project: DesignProject, room: DesignRoom, box: Box, placed: Array<{ box: Box; height: number }>, objectHeight: number, clearance = .08): boolean {
  if (box.width <= 0 || box.depth <= 0) return false;
  if (!objectFitsRoom(project, room, box, clearance)) return false;
  if (openingConflicts(project, room, box, objectHeight)) return false;
  const rug = objectHeight <= .06;
  return !placed.some((other) => other.height <= .06 === rug && rectOverlap(box, other.box, .12));
}

/**
 * Compose le layout d'une pièce : décisions + objets placés. Déterministe
 * pour une graine donnée (deux demandes identiques → scènes possiblement
 * différentes via la graine).
 */
export function composeRoomLayout(project: DesignProject, room: DesignRoom, requested: Array<FurnitureSpec | { name: string; category?: DesignObject["category"] }>, options: { seed?: number; focalSide?: Side; sofaHint?: string } = {}): LayoutResult {
  const rng = mulberry32(options.seed ?? 42);
  const focalSide = options.focalSide || focalWallFor(project, room);
  const sofaSide = opposite(focalSide);
  const specs = requested.map((item) => furnitureSpec(item.name, (item as { category?: DesignObject["category"] }).category));
  const byRole = (role: string) => specs.filter((spec) => spec.role === role || (role === "sofa" && /canap|sofa/.test(norm(spec.name))));
  const sofa = byRole("backrest").find((spec) => /canap|sofa/.test(norm(spec.name))) || byRole("backrest")[0];
  const focalItem = specs.find((spec) => spec.role === "focal");
  const centerpiece = specs.find((spec) => spec.role === "centerpiece" && /bassee|coffee|salon/.test(norm(spec.name))) || specs.find((spec) => spec.role === "centerpiece");
  const chairs = specs.filter((spec) => /fauteuil|armchair|chaise|chair/.test(norm(spec.name))).slice(0, 4);
  const rest = specs.filter((spec) => spec !== sofa && spec !== focalItem && spec !== centerpiece && !chairs.includes(spec));

  const objects: DesignObject[] = [];
  const placedBoxes: Array<{ box: Box; height: number }> = [];
  const decisions: LayoutDecision[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const warnings: string[] = [];

  /** Place un meuble à l'empreinte `box` (rotation appliquée pour le rendu). */
  const push = (spec: FurnitureSpec, box: Box, rotation: number, reasons: string[]): DesignObject | null => {
    if (!boxFits(project, room, box, placedBoxes, spec.height)) return null;
    // L'objet stocke ses dimensions brutes + rotation ; sa boite englobante
    // au plan correspond à `box` (rotation ±90° → dimensions permutées).
    const swap = Math.abs(box.width - spec.width) > .01 || Math.abs(box.depth - spec.depth) > .01;
    const object: DesignObject = {
      id: uid("obj"), name: spec.name, category: spec.category,
      x: Math.round((box.x + box.width / 2 - spec.width / 2) * 100) / 100,
      y: Math.round((box.y + box.depth / 2 - spec.depth / 2) * 100) / 100,
      width: spec.width, depth: spec.depth, height: spec.height,
      rotation: Math.round(rotation * 1000) / 1000,
      roomId: room.id, level: room.level || 0, metadata: { layoutAgent: "v8.2", layoutRole: spec.role, ...(swap ? { planBox: `${box.width.toFixed(2)}x${box.depth.toFixed(2)}` } : {}) }
    };
    objects.push(object);
    placedBoxes.push({ box, height: spec.height });
    decisions.push({ name: spec.name, x: object.x, y: object.y, rotation: object.rotation, reasons });
    return object;
  };
  const anchorBox = (object: DesignObject): Box => {
    const stored = objects.find((item) => item.id === object.id);
    const index = stored ? objects.indexOf(stored) : -1;
    return index >= 0 ? placedBoxes[index].box : { x: object.x, y: object.y, width: object.width, depth: object.depth };
  };

  // 1) Meuble focal (TV/cheminée) : mur focal d'abord, puis replis.
  let focalAnchor: DesignObject | null = null;
  if (focalItem) {
    const focalSides: Side[] = [focalSide, ...(sofaSide === "north" || sofaSide === "south" ? (["west", "east"] as Side[]) : (["north", "south"] as Side[])), sofaSide];
    for (let index = 0; index < focalSides.length && !focalAnchor; index += 1) {
      const side = focalSides[index];
      for (const ratio of [.4, .5, .6]) {
        const { box, rotation } = againstWall(room, focalItem, side, .3, ratio);
        if (!boxFits(project, room, box, placedBoxes, focalItem.height)) continue;
        focalAnchor = push(focalItem, box, rotation, [index === 0 ? `adossé au mur focal (${side})` : `adossé au mur ${side} (repli)`, "face à la zone d'assise"]);
        if (focalAnchor) break;
      }
    }
    if (!focalAnchor) skipped.push({ name: focalItem.name, reason: "aucun mur libre pour le meuble focal (portes/fenêtres)" });
  }
  const focalBox = focalAnchor ? anchorBox(focalAnchor) : null;
  const focalCenter = focalBox
    ? { x: focalBox.x + focalBox.width / 2, y: focalBox.y + focalBox.depth / 2 }
    : { x: room.x + room.width / 2 + SIDE_NORMAL[focalSide].x * room.width * .3, y: room.y + room.height / 2 + SIDE_NORMAL[focalSide].y * room.height * .3 };

  // 2) Canapé : dos au mur opposé au focal, face au point focal, ≥ 1,9 m.
  let sofaAnchor: DesignObject | null = null;
  if (sofa) {
    const perps: Side[] = sofaSide === "north" || sofaSide === "south" ? (["west", "east"] as Side[]) : (["north", "south"] as Side[]);
    const allSofaSides: Side[] = [sofaSide, ...perps, focalSide];
    // Un mur d'assise n'est candidat que si l'assise FACE le point focal
    // (jamais de canapé tourné vers... le mur de la TV).
    // Position d'assise typique sur ce mur (à ~1 m du mur), face à l'intérieur.
    const seatCenter = (side: Side): { x: number; y: number } => {
      const facing = { x: -SIDE_NORMAL[side].x, y: -SIDE_NORMAL[side].y };
      const base = side === "north" ? { x: room.x + room.width / 2, y: room.y } : side === "south" ? { x: room.x + room.width / 2, y: room.y + room.height } : side === "west" ? { x: room.x, y: room.y + room.height / 2 } : { x: room.x + room.width, y: room.y + room.height / 2 };
      return { x: base.x + facing.x, y: base.y + facing.y };
    };
    // Le point focal doit être DEVANT l'assise (projection ≥ 0,8 m), jamais
    // dans le dos — sinon la TV se retrouve derrière le canapé.
    const facesFocal = (side: Side): boolean => {
      const facing = { x: -SIDE_NORMAL[side].x, y: -SIDE_NORMAL[side].y };
      const seat = seatCenter(side);
      return (focalCenter.x - seat.x) * facing.x + (focalCenter.y - seat.y) * facing.y >= .8;
    };
    const oriented = allSofaSides.filter(facesFocal);
    const sofaSides: Side[] = oriented.length ? [...oriented, ...allSofaSides.filter((side) => !oriented.includes(side))] : allSofaSides;
    const horizontalIdeal = sofaSide === "north" || sofaSide === "south";
    const roomSpan = horizontalIdeal ? room.height : room.width;
    const desired = 1.95 + rng() * .35;
    const idealGap = Math.max(.3, Math.min(1.2, roomSpan - desired - sofa.depth - .3));
    for (let index = 0; index < sofaSides.length && !sofaAnchor; index += 1) {
      const side = sofaSides[index];
      for (const ratio of [.34, .5, .66]) {
        const { box, rotation } = againstWall(room, sofa, side, index === 0 ? idealGap : .32, ratio);
        if (!boxFits(project, room, box, placedBoxes, sofa.height)) continue;
        sofaAnchor = push(sofa, box, rotation, [
          index === 0 ? `dos au mur ${side}, face au point focal (${focalSide})` : `dos au mur ${side} (mur d'assise alternatif — ouverture sur le mur idéal)`,
          `distance assise–focal visée ≥ 1,9 m`
        ]);
        if (sofaAnchor) break;
      }
    }
    if (!sofaAnchor) {
      warnings.push("Aucun appui dorsal possible : assise flottante centrale (composition ouverte).");
      // Îlot orienté vers le point focal, avec ≥ 1,95 m entre l'assise et le
      // meuble focal (mesurés bord à bord, pas centre à centre).
      const roomCx = room.x + room.width / 2; const roomCy = room.y + room.height / 2;
      let ux = roomCx - focalCenter.x; let uy = roomCy - focalCenter.y;
      const length = Math.hypot(ux, uy) || 1; ux /= length; uy /= length;
      const focalSupport = focalBox ? Math.abs(ux) * focalBox.width / 2 + Math.abs(uy) * focalBox.depth / 2 : .4;
      const sofaSupport = Math.abs(ux) * sofa.depth / 2 + Math.abs(uy) * sofa.width / 2;
      const target = focalSupport + sofaSupport + 1.95 + rng() * .3;
      const halfLong = Math.max(sofa.width, sofa.depth) / 2;
      const cx = Math.min(room.x + room.width - halfLong - .3, Math.max(room.x + halfLong + .3, focalCenter.x + ux * target));
      const cy = Math.min(room.y + room.height - halfLong - .3, Math.max(room.y + halfLong + .3, focalCenter.y + uy * target));
      const rotation = rotationToward(focalCenter.x - cx, focalCenter.y - cy);
      const swap = Math.abs(Math.cos(rotation)) < .5;
      const box: Box = { x: cx - (swap ? sofa.depth : sofa.width) / 2, y: cy - (swap ? sofa.width : sofa.depth) / 2, width: swap ? sofa.depth : sofa.width, depth: swap ? sofa.width : sofa.depth };
      sofaAnchor = push(sofa, box, rotation, ["assise flottante îlot central", `orientée vers le point focal, ≥ 1,95 m de dégagement visuel`]);
    }
    if (!sofaAnchor) skipped.push({ name: sofa.name, reason: "surface trop réduite pour l'assise principale" });
  }

  const sofaBox = sofaAnchor ? anchorBox(sofaAnchor) : null;

  // 3) Table basse/centrale : sur l'axe focal, à 0,42–0,68 m devant l'assise.
  if (centerpiece) {
    const anchor = sofaAnchor || focalAnchor;
    let placed = false;
    if (anchor) {
      const rotation = anchor.rotation;
      const front = facingVector(rotation);
      const box = anchorBox(anchor);
      const gap = .48 + rng() * .14;
      const anchorHalf = Math.abs(front.x) * box.width / 2 + Math.abs(front.y) * box.depth / 2;
      const tableHalf = Math.abs(front.x) * centerpiece.width / 2 + Math.abs(front.y) * centerpiece.depth / 2;
      const cx = box.x + box.width / 2 + front.x * (anchorHalf + gap + tableHalf);
      const cy = box.y + box.depth / 2 + front.y * (anchorHalf + gap + tableHalf);
      placed = Boolean(push(centerpiece, { x: cx - centerpiece.width / 2, y: cy - centerpiece.depth / 2, width: centerpiece.width, depth: centerpiece.depth }, rotationToward(-front.x, -front.y), ["sur l'axe focal", `à ${gap.toFixed(2)} m devant l'assise (ergonomie 0,42–0,68 m)`]));
    }
    if (!placed && sofaBox) {
      // Repli : table décalée sur le flanc de l'assise (coté libre).
      const axis = facingVector(sofaAnchor ? sofaAnchor.rotation : 0);
      const flank = { x: -axis.y, y: axis.x };
      const sofaSupport = Math.abs(flank.x) * sofaBox.width / 2 + Math.abs(flank.y) * sofaBox.depth / 2;
      const tableSupport = Math.abs(flank.x) * centerpiece.width / 2 + Math.abs(flank.y) * centerpiece.depth / 2;
      for (const side of [1, -1]) {
        const cx = sofaBox.x + sofaBox.width / 2 + flank.x * (sofaSupport + .32 + tableSupport) * side;
        const cy = sofaBox.y + sofaBox.depth / 2 + flank.y * (sofaSupport + .32 + tableSupport) * side;
        placed = Boolean(push(centerpiece, { x: cx - centerpiece.width / 2, y: cy - centerpiece.depth / 2, width: centerpiece.width, depth: centerpiece.depth }, rotationToward(-axis.x, -axis.y), ["table latérale au ras de l'assise (axe central occupé)"]));
        if (placed) break;
      }
    }
    if (!placed) {
      placed = Boolean(push(centerpiece, { x: room.x + room.width / 2 - centerpiece.width / 2, y: room.y + room.height / 2 - centerpiece.depth / 2, width: centerpiece.width, depth: centerpiece.depth }, 0, ["centré dans la pièce (pas d'assise pour ancrer l'axe)"]));
    }
    if (!placed) skipped.push({ name: centerpiece.name, reason: "espace central insuffisant" });
  }

  // 4) Fauteuils/chaises : symétriques autour de l'axe focal, face au centre.
  const axisOrigin = sofaBox ? { x: sofaBox.x + sofaBox.width / 2, y: sofaBox.y + sofaBox.depth / 2 } : { x: room.x + room.width / 2, y: room.y + room.height / 2 };
  const axisDir = sofaAnchor ? facingVector(sofaAnchor.rotation) : SIDE_NORMAL[opposite(focalSide)];
  const perp = { x: -axisDir.y, y: axisDir.x };
  chairs.forEach((chair, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    const order = Math.floor(index / 2) + 1;
    const offsetAlong = .35 + order * (chair.depth + .28);
    const offsetPerp = (sofaBox ? sofaBox.width / 2 : 1.2) + .42 + order * .1;
    const cx = axisOrigin.x + axisDir.x * offsetAlong + perp.x * offsetPerp * side;
    const cy = axisOrigin.y + axisDir.y * offsetAlong + perp.y * offsetPerp * side;
    const rotation = rotationToward(axisOrigin.x + axisDir.x * 1.2 - cx, axisOrigin.y + axisDir.y * 1.2 - cy);
    let placedOk = push(chair, { x: cx - chair.width / 2, y: cy - chair.depth / 2, width: chair.width, depth: chair.depth }, rotation, [index < 2 ? "disposition symétrique autour de l'axe focal" : "assise secondaire alignée", "orientée vers le centre de convivialité"]);
    if (!placedOk && sofaBox) {
      // Symétrie resserrée : rapproche progressivement l'assise de l'axe
      // (couloirs étroits, meubles encombrants sur le flanc).
      for (const tightPerp of [Math.max(.7, sofaBox.width / 2 - .1), .95, .8]) {
        const tx = axisOrigin.x + axisDir.x * offsetAlong + perp.x * tightPerp * side;
        const ty = axisOrigin.y + axisDir.y * offsetAlong + perp.y * tightPerp * side;
        placedOk = push(chair, { x: tx - chair.width / 2, y: ty - chair.depth / 2, width: chair.width, depth: chair.depth }, rotation, ["assise latérale resserrée près de l'axe focal", "orientée vers le centre de convivialité"]);
        if (placedOk) break;
      }
    }
    if (!placedOk) {
      // Dernier recours : balayage de la pièce pour une position libre, assise
      // tournée vers le centre de convivialité (jamais de suppression silencieuse).
      const step = .3;
      let best: { box: Box; score: number } | null = null;
      for (let y = room.y + .24; y <= room.y + room.height - chair.depth - .24; y += step) {
        for (let x = room.x + .24; x <= room.x + room.width - chair.width - .24; x += step) {
          const box: Box = { x, y, width: chair.width, depth: chair.depth };
          if (!boxFits(project, room, box, placedBoxes, chair.height, .1)) continue;
          const cx = x + chair.width / 2; const cy = y + chair.depth / 2;
          const distanceToAxis = Math.hypot(cx - axisOrigin.x, cy - axisOrigin.y);
          const wallDistance = Math.min(cx - room.x, room.x + room.width - cx, cy - room.y, room.y + room.height - cy);
          const score = -Math.abs(distanceToAxis - 1.9) - Math.abs(wallDistance - .8) * .6;
          if (!best || score > best.score) best = { box, score };
        }
      }
      if (best) {
        const cx = best.box.x + chair.width / 2; const cy = best.box.y + chair.depth / 2;
        placedOk = push(chair, best.box, rotationToward(axisOrigin.x - cx, axisOrigin.y - cy), ["assise d'appoint repositionnée par le planner", "orientée vers le centre de convivialité"]);
      }
    }
    if (!placedOk) skipped.push({ name: chair.name, reason: "pas de position libre dans la pièce" });
  });

  // 5) Reste du mobilier : greedy par scoring (murs libres, équilibre, circulation).
  for (const spec of rest) {
    const step = .3;
    let best: { box: Box; score: number; reasons: string[] } | null = null;
    for (let y = room.y + .24; y <= room.y + room.height - spec.depth - .24; y += step) {
      for (let x = room.x + .24; x <= room.x + room.width - spec.width - .24; x += step) {
        const box: Box = { x, y, width: spec.width, depth: spec.depth };
        if (!boxFits(project, room, box, placedBoxes, spec.height, .1)) continue;
        const cx = x + spec.width / 2; const cy = y + spec.depth / 2;
        const roomCx = room.x + room.width / 2; const roomCy = room.y + room.height / 2;
        // Équilibre visuel : le barycentre doit rester proche du centre.
        const centroid = [...placedBoxes.map((item) => ({ x: item.box.x + item.box.width / 2, y: item.box.y + item.box.depth / 2 })), { x: cx, y: cy }].reduce((acc, item) => ({ x: acc.x + item.x, y: acc.y + item.y }), { x: 0, y: 0 });
        const count = placedBoxes.length + 1;
        const balance = Math.hypot(centroid.x / count - roomCx, centroid.y / count - roomCy);
        // Affinités par rôle.
        const wallDistance = Math.min(cx - room.x, room.x + room.width - cx, cy - room.y, room.y + room.height - cy);
        const focalDistance = Math.hypot(cx - focalCenter.x, cy - focalCenter.y);
        let score = -balance * 2.2;
        const reasons: string[] = ["équilibre visuel du barycentre"];
        if (spec.role === "storage") { score -= wallDistance * 2.6; reasons.push("rangement adossé à une paroi libre"); }
        else if (spec.role === "pendant") { score -= focalDistance * .4; reasons.push("suspension au-dessus de la zone de vie"); }
        else if (spec.role === "plant") { score -= Math.abs(wallDistance - 1.1) * 1.8; reasons.push("plante en angle lumineux sans gêner le passage"); }
        else if (spec.role === "decor") { score -= Math.abs(focalDistance - 1.6) * 1.2; reasons.push("décor à proximité de la zone de vie"); }
        else if (spec.role === "work") { score -= wallDistance * 2.2; reasons.push("plan de travail adossé, lumière de côté"); }
        if (!best || score > best.score) best = { box, score, reasons };
      }
    }
    if (best) push(spec, best.box, 0, best.reasons);
    else skipped.push({ name: spec.name, reason: "aucune position libre avec les dégagements requis" });
  }

  return { objects, decisions, skipped, focalSide, warnings };
}
