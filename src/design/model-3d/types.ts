/**
 * SOPHENIC MODEL 3D ENGINE — types purs (V8.5).
 *
 * Le module Design 3D devient un moteur de sélection de modèles Sketchfab :
 * demande utilisateur → brief (Brain) → 5 meilleurs modèles proposés →
 * exploration 3D interactive (caméra libre) → téléchargement en bibliothèque.
 */

export type Model3DAsset = {
  provider: "sketchfab";
  sourceId: string;
  name: string;
  author?: string;
  license?: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  downloadable: boolean;
  tags: string[];
  likeCount?: number;
  viewCount?: number;
  vertexCount?: number;
  faceCount?: number;
  staffPicked?: boolean;
};

/** Brief de recherche : l'intention est TOUJOURS expandée en plusieurs requêtes style/matériau. */
export type Model3DBrief = {
  request: string;
  objectTerms: string[];
  styleHints: string[];
  materialHints: string[];
  queries: string[];
  premium: boolean;
  origin: "brain" | "heuristic";
  notice?: string;
};

export type Model3DCandidate = {
  asset: Model3DAsset;
  compatibility: number;
  reasons: string[];
  query: string;
};

export type Model3DGap = { query: string; reason: string };

/** Entrée bibliothèque = modèle téléchargé (cache SOPHENIC) conservé sur le projet. */
export type Model3DLibraryEntry = {
  sourceId: string;
  cacheId: string;
  name: string;
  author?: string;
  license?: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  format: "gltf" | "glb";
  entryPath: string;
  addedAt: string;
};

export type Model3DProjectState = {
  brief?: Model3DBrief;
  candidates?: Model3DCandidate[];
  gaps?: Model3DGap[];
  library: Model3DLibraryEntry[];
  searchedAt?: string;
};

export type Model3DAttachment = { id: string; name: string; mime: string; size: number; dataUrl: string };
