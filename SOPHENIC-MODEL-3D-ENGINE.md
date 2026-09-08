# SOPHENIC MODEL 3D ENGINE (V8.5)

Le module **Design 3D** applique le même système que le Web Design : l'utilisateur décrit ce qu'il veut, le SOPHENIC Brain expande l'intention, **les 5 meilleurs modèles Sketchfab** sont proposés, explorables **en entier** (caméra libre façon Blender) puis téléchargeables.

## 1. Flux

1. **Demande** — texte libre + références images optionnelles (analysées en vision par le Brain, pièces jointes V8.4).
2. **Brief de recherche (Brain)** — `resolveModel3DBrief` extrait l'objet, le style et les matériaux puis **expande l'intention en 4-6 requêtes anglaises enrichies** (style + matériau + qualité). **Jamais le nom exact de l'objet seul, jamais la demande brute** — règle anti-recherche-exacte. Garde-fou heuristique déterministe (lexiques objet/style/matériau FR→EN) si aucune IA n'est joignable, avec notice honnête.
3. **Recherche Sketchfab** — toutes les requêtes expandées sont exécutées via l'Asset Engine existant (`desktop.design.searchAssets`, token du coffre chiffré, `downloadable=true`).
4. **Galerie des 5 meilleurs** — `rankModelCandidates` : dédoublonnage par `sourceId`, filtre licence + téléchargeable, scoring intent-aware (objet, style, matériaux, Staff Pick, j'aime/vues, polycount crédible, pénalités placeholder), compatibilité 5-99 %, raisons en français, badge « ✦ SOPHENIC AI ».
5. **Exploration 3D** — « Voir en 3D » met le modèle en cache puis l'ouvre dans la visionneuse : **caméra libre façon Blender** (orbite clic gauche, déplacement clic droit/milieu, zoom vers le curseur, amortissement), auto-cadrage, grille au sol, environnement PBR studio, licence/auteur/faces affichés.
6. **Téléchargement** — « Télécharger » ajoute le modèle à la **bibliothèque du projet** (persistée) : cache SOPHENIC + métadonnées (auteur, licence, format, source). Ré-explorable à tout moment.

## 2. Honnêteté (règles absolues)

- **Aucun asset inventé** : requêtes vides ou échouées → **gap enregistré** avec message explicite (« SOPHENIC refuse d'inventer un asset ») et invitation à reformuler.
- **Aucun nouveau cerveau IA** : le brief passe par le SOPHENIC Brain existant (`chatWithExistingBrain` — IPC desktop → route web).
- La licence est **revérifiée côté serveur** au moment du téléchargement (métadonnées du renderer jamais autoritaires — comportement de l'Asset Engine existant).
- Sketchfab doit être configuré (Paramètres → 3D Assets) sinon message clair, aucune recherche factice.

## 3. Modules

| Fichier | Rôle |
|---|---|
| `src/design/model-3d/types.ts` | Brief, candidats, gaps, bibliothèque (types purs) |
| `src/design/model-3d/model-brief.ts` | Brief heuristique (lexiques FR→EN) + Brain (`chatWithExistingBrain`, pièces jointes images) + merge champ par champ avec rejet des requêtes non expandées |
| `src/design/model-3d/model-gallery.ts` | Recherche multi-requêtes (search injecté), dédoublonnage, scoring, top 5, gaps honnêtes |
| `src/components/design/model-3d-workspace.tsx` | Atelier : demande, pipeline, galerie, bibliothèque, écarts |
| `src/components/design/model-3d-viewer.tsx` | Visionneuse Three.js : GLB/GLTF (Draco + Meshopt), OrbitControls caméra libre, auto-cadrage, badge « ✦ SOPHENIC AI » |

## 4. Intégration

- `Créer un projet` → **Design 3D** (domaine `product`) : la carte annonce le flux Sketchfab ; les nouveaux projets initialisent `model3d: { library: [] }`.
- Les anciens projets « Design 3D » (objet paramétrique) restent ouvrables — branche legacy conservée, comme pour l'ancien « Design Web ».
- `DesignProject.model3d` : `{ brief?, candidates?, gaps?, library, searchedAt? }` — persisté avec le projet.
- Réutilise l'Asset Engine existant : `searchAssets` / `cacheAsset` / `assetBundle` (IPC `sophenic:design:*`, token chiffré, limites de taille, licence vérifiée).

## 5. Tests (`npm run test:model3d`, inclus dans `test:sophenic`)

- **TEST 1** Expansion : « canapé scandinave en chêne » → ≥ 3 requêtes combinant style et matériau, jamais le nom exact seul, jamais la demande brute.
- **TEST 2** Robustesse : demande vague → requêtes génériques de qualité ; low-poly explicite → non premium ; sans IA → notice honnête.
- **TEST 3** Merge Brain : une requête réduite au nom objet est rejetée ; les requêtes expandées sont conservées.
- **TEST 4** Classement : top 5 dédoublonné, sans-licence et non-téléchargeable rejetés, compatibilités triées 5-99 %.
- **TEST 5** Galerie + honnêteté : toutes les requêtes exécutées ; zéro résultat → gap « refuse d'inventer » ; échec HTTP enregistré comme gap.
