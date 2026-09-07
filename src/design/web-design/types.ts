/**
 * SOPHENIC WEB DESIGN ENGINE — Types du blueprint de design de site.
 *
 * Le module Web Design ne génère PAS de code applicatif : il produit un
 * WEBSITE DESIGN BLUEPRINT (structure, direction artistique, composants,
 * 3D, assets, règles responsive) contrôlé par le SOPHENIC Brain existant.
 */

export type WebDesignMode = "template" | "original";

/** Brief créatif analysé par le Brain (industrie, audience, positionnement…). */
export type WebDesignBrief = {
  instruction: string;
  brand: string;
  industry: string;
  audience: string;
  positioning: string;
  emotions: string[];
  premiumLevel: "accessible" | "premium" | "ultra-premium";
  conversionGoal: string;
  pages: string[];
  /** Traits 0-1 guidant la direction artistique. */
  traits: {
    luxury: number;
    minimal: number;
    immersive3d: number;
    editorial: number;
    dark: number;
    colorful: number;
    corporate: number;
    playful: number;
    ecommerce: number;
    storytelling: number;
    technological: number;
  };
  language: "fr" | "en";
  origin: "brain" | "heuristic";
  notes?: string;
};

/** Identité visuelle du design. */
export type WebDesignVisualStyle = {
  /** [fond, texte principal, accent, support, surface douce]. */
  colors: string[];
  /** Ex. « Cormorant Garamond (titres) + Jost (texte) ». */
  typography: string;
  typographyStack: { display: string; body: string };
  spacing: string;
  animations: string[];
  imagery: string;
  moodboardKeywords: string[];
};

export type WebDesignSection = { name: string; purpose: string; componentHints?: string[] };
export type WebDesignPage = { name: string; sections: WebDesignSection[] };

export type WebDesignComponent = { name: string; variant: string; description: string; pages: string[] };

export type WebDesignThreeDElement = { concept: string; library: string; placement: string; rationale: string };

export type WebDesignResponsiveRule = { breakpoint: string; rule: string };

export type WebDesignAssetKind = "image" | "icon" | "illustration" | "3d" | "animation";
export type WebDesignAssetRecommendation = { kind: WebDesignAssetKind; name: string; directive: string; usage: string; reason: string };

export type WebDesignQualityScores = { visual: number; ux: number; conversion: number; brand: number; mobile: number; overall: number };
export type WebDesignQualityIssue = { area: "visual" | "ux" | "conversion" | "brand" | "mobile"; severity: "low" | "medium" | "high"; message: string; autoFixable: boolean };
export type WebDesignQualityReport = { scores: WebDesignQualityScores; issues: WebDesignQualityIssue[]; iterations: number; evaluatedAt: string };

/** Pipeline d'agences créatives (mode Original). */
export type WebDesignAgencyStep = { agent: string; role: string; decisions: string[] };

/** LE livrable : le Website Design Blueprint (aucun code applicatif). */
export type WebDesignBlueprint = {
  id: string;
  schemaVersion: 1;
  projectType: "website";
  mode: WebDesignMode;
  templateId?: string;
  templateName?: string;
  brand: string;
  industry: string;
  /** Direction artistique en une phrase. */
  designDirection: string;
  concept: string;
  pages: WebDesignPage[];
  visualStyle: WebDesignVisualStyle;
  components: WebDesignComponent[];
  threeDElements: WebDesignThreeDElement[];
  responsiveRules: WebDesignResponsiveRule[];
  assets: WebDesignAssetRecommendation[];
  conversion: { primaryCta: string; secondaryCta: string; trustElements: string[] };
  quality?: WebDesignQualityReport;
  agencyLog: WebDesignAgencyStep[];
  createdAt: string;
  updatedAt: string;
};

/** État persisté dans DesignProject.webDesign. */
export type WebDesignState = {
  mode: WebDesignMode;
  brief?: WebDesignBrief;
  blueprint?: WebDesignBlueprint;
  /** Top 3 templates proposés en mode Template Intelligence. */
  templateCandidates?: Array<{ templateId: string; name: string; compatibility: number; reasons: string[] }>;
  selectedTemplateId?: string;
};

/** Template interne (point de départ structurel uniquement). */
export type WebDesignTemplate = {
  id: string;
  name: string;
  tagline: string;
  industries: string[];
  traits: Partial<WebDesignBrief["traits"]>;
  /** Structure de départ — la personnalisation peut l'adapter. */
  pages: WebDesignPage[];
  /** Identité visuelle de départ — TOUJOURS remplacée par celle de la marque. */
  visualStyle: WebDesignVisualStyle;
  components: WebDesignComponent[];
  threeDElements: WebDesignThreeDElement[];
  responsiveRules: WebDesignResponsiveRule[];
  animations: string[];
};

/** Candidat template avec score de compatibilité. */
export type WebDesignTemplateCandidate = { templateId: string; name: string; compatibility: number; reasons: string[] };

/** Passerelle vers SOPHENIC Code. */
export type CodeDesignHandoff = {
  id: string;
  name: string;
  createdAt: string;
  stacks: string[];
  blueprint: WebDesignBlueprint;
  implementationBrief: string;
};
