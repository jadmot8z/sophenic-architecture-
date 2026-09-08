import type { DesignProject, DesignSimulationResult, DesignSimulationType } from "./types";

const disclaimer = "Simulation indicative SOPHENIC Design : ce résultat aide à comparer des options de conception. Il ne remplace pas une étude réglementaire, énergétique, structurelle, électrique, incendie, accessibilité ou une validation par un professionnel qualifié.";
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const metricStatus = (score: number): "good" | "warning" | "risk" => score >= 72 ? "good" : score >= 48 ? "warning" : "risk";
const uid = () => `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function totalRoomArea(project: DesignProject): number { return project.plan.rooms.reduce((sum, room) => sum + room.width * room.height, 0); }
function objectFootprint(project: DesignProject): number { return project.plan.objects.reduce((sum, object) => sum + object.width * object.depth, 0); }
function perimeter(project: DesignProject): number { return 2 * (project.plan.width + project.plan.height); }

export function runDesignSimulation(project: DesignProject, type: DesignSimulationType): DesignSimulationResult {
  const area = Math.max(1, totalRoomArea(project));
  const windows = project.plan.openings.filter((opening) => opening.kind === "window");
  const doors = project.plan.openings.filter((opening) => opening.kind === "door");
  const windowArea = windows.reduce((sum, opening) => sum + opening.width * opening.height, 0);
  const occupancy = Math.max(1, Math.round(area / (project.domain === "interior" ? 12 : 15)));
  let score = 70;
  let label = "Simulation";
  let metrics: DesignSimulationResult["metrics"] = [];
  let recommendations: string[] = [];

  if (type === "daylight") {
    const glazingRatio = windowArea / area;
    const orientationBonus = Math.cos(((project.site.orientation - 180) * Math.PI) / 180) * 10;
    score = clamp(42 + glazingRatio * 220 + orientationBonus);
    label = "Lumière naturelle";
    metrics = [
      { label: "Ratio vitré / surface", value: `${(glazingRatio * 100).toFixed(1)} %`, status: metricStatus(score) },
      { label: "Ouvertures vitrées", value: `${windows.length}`, status: windows.length >= 2 ? "good" : "warning" },
      { label: "Orientation principale", value: `${Math.round(project.site.orientation)}°`, status: Math.abs(project.site.orientation - 180) < 70 ? "good" : "warning" }
    ];
    recommendations = score < 72 ? ["Augmenter ou mieux répartir les ouvertures sur les pièces profondes.", "Comparer une variante avec orientation sud / sud-est des espaces de vie."] : ["Conserver une protection solaire pour limiter l’éblouissement et la surchauffe."];
  } else if (type === "shadows") {
    const depthPenalty = Math.max(0, project.plan.height - windows.length * 1.2) * 3.2;
    score = clamp(88 - depthPenalty + Math.abs(Math.sin((project.site.orientation * Math.PI) / 180)) * 8);
    label = "Ombres & exposition";
    metrics = [
      { label: "Profondeur du plan", value: `${project.plan.height.toFixed(1)} m`, status: project.plan.height < 12 ? "good" : "warning" },
      { label: "Façades éclairées estimées", value: `${Math.min(4, Math.max(1, windows.length))} / 4`, status: windows.length >= 3 ? "good" : "warning" },
      { label: "Risque de zones sombres", value: score >= 72 ? "faible" : score >= 48 ? "modéré" : "élevé", status: metricStatus(score) }
    ];
    recommendations = score < 72 ? ["Créer des apports de lumière secondaires ou traversants.", "Tester des cloisons vitrées ou des percements intérieurs."] : ["Vérifier les ombres saisonnières avec le contexte réel du site."];
  } else if (type === "interior-lighting") {
    const lights = project.plan.objects.filter((object) => object.category === "lighting").length;
    const density = lights / Math.max(1, area / 12);
    score = clamp(38 + density * 48 + Math.min(15, windows.length * 3));
    label = "Éclairage intérieur";
    metrics = [
      { label: "Points lumineux", value: `${lights}`, status: lights >= Math.ceil(area / 20) ? "good" : "warning" },
      { label: "Densité indicative", value: `${(lights / area * 100).toFixed(1)} / 100 m²`, status: metricStatus(score) },
      { label: "Complément lumière naturelle", value: `${windows.length} fenêtre(s)`, status: windows.length >= 2 ? "good" : "warning" }
    ];
    recommendations = ["Prévoir des couches d’éclairage : général, fonctionnel et accent.", ...(score < 65 ? ["Ajouter des points lumineux dans les zones de travail et de circulation."] : [])];
  } else if (type === "circulation") {
    const footprint = objectFootprint(project);
    const freeRatio = Math.max(0, (area - footprint) / area);
    const narrowRooms = project.plan.rooms.filter((room) => Math.min(room.width, room.height) < 2.2).length;
    score = clamp(35 + freeRatio * 70 - narrowRooms * 8 + Math.min(8, doors.length * 2));
    label = "Circulation";
    metrics = [
      { label: "Surface libre estimée", value: `${(freeRatio * 100).toFixed(0)} %`, status: freeRatio > 0.72 ? "good" : freeRatio > 0.55 ? "warning" : "risk" },
      { label: "Pièces étroites", value: `${narrowRooms}`, status: narrowRooms === 0 ? "good" : "warning" },
      { label: "Accès / portes", value: `${doors.length}`, status: doors.length >= 1 ? "good" : "risk" }
    ];
    recommendations = score < 72 ? ["Libérer les axes entre entrées, zones de vie et ouvertures.", "Maintenir des passages continus et tester les zones de retournement selon l’usage."] : ["Tester la circulation avec plusieurs scénarios d’occupation et de mobilier."];
  } else if (type === "occupancy") {
    const areaPerPerson = area / occupancy;
    score = clamp(48 + Math.min(42, areaPerPerson * 2.6) - Math.max(0, project.plan.rooms.length - occupancy) * 2);
    label = "Occupation de l’espace";
    metrics = [
      { label: "Capacité indicative", value: `${occupancy} personne(s)`, status: "good" },
      { label: "Surface / personne", value: `${areaPerPerson.toFixed(1)} m²`, status: areaPerPerson >= 10 ? "good" : "warning" },
      { label: "Pièces", value: `${project.plan.rooms.length}`, status: project.plan.rooms.length >= 2 ? "good" : "warning" }
    ];
    recommendations = ["Adapter la capacité cible à l’usage réel du projet.", "Valider séparément les exigences réglementaires d’occupation et d’évacuation."];
  } else if (type === "visibility") {
    const openingDensity = (windows.length + doors.length) / Math.max(1, project.plan.rooms.length);
    const obstruction = objectFootprint(project) / area;
    score = clamp(52 + openingDensity * 18 - obstruction * 32);
    label = "Visibilité & lignes de vue";
    metrics = [
      { label: "Ouvertures / pièce", value: `${openingDensity.toFixed(1)}`, status: openingDensity >= 1 ? "good" : "warning" },
      { label: "Occupation au sol", value: `${(obstruction * 100).toFixed(0)} %`, status: obstruction < 0.28 ? "good" : "warning" },
      { label: "Lecture spatiale", value: score >= 72 ? "claire" : score >= 48 ? "moyenne" : "complexe", status: metricStatus(score) }
    ];
    recommendations = score < 72 ? ["Réduire les obstacles hauts sur les axes visuels principaux.", "Aligner certaines ouvertures pour améliorer la profondeur visuelle."] : ["Conserver des vues structurantes tout en préservant les besoins d’intimité."];
  } else if (type === "energy") {
    const glazingRatio = windowArea / Math.max(1, perimeter(project) * project.plan.wallHeight);
    const compactness = area / Math.max(1, perimeter(project));
    const sustainableBonus = project.preferences.sustainability ? 7 : 0;
    score = clamp(48 + compactness * 5 - Math.abs(glazingRatio - 0.2) * 85 + sustainableBonus);
    label = "Énergie — pré-évaluation";
    metrics = [
      { label: "Compacité", value: compactness.toFixed(2), status: compactness >= 2.2 ? "good" : "warning" },
      { label: "Ratio vitrage / enveloppe", value: `${(glazingRatio * 100).toFixed(1)} %`, status: glazingRatio >= 0.12 && glazingRatio <= 0.32 ? "good" : "warning" },
      { label: "Hypothèse climat", value: project.site.climate || "non définie", status: project.site.climate ? "good" : "warning" }
    ];
    recommendations = ["Renseigner localisation, orientation et composition réelle de l’enveloppe pour une étude plus fiable.", "Faire valider toute performance énergétique par un calcul réglementaire ou un bureau d’études."];
  }

  return { id: uid(), type, label, score, createdAt: new Date().toISOString(), metrics, recommendations, disclaimer };
}

export function runAllDesignSimulations(project: DesignProject): DesignSimulationResult[] {
  return (["daylight", "shadows", "interior-lighting", "circulation", "occupancy", "visibility", "energy"] as const).map((type) => runDesignSimulation(project, type));
}
