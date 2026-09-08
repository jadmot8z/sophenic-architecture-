# SOPHENIC DESIGN V8.1 REAL AI — Audit complet du repository

> Audit réalisé **avant toute modification** (mission : transformer le module Design en agent
> architectural intelligent **sans créer un nouveau cerveau IA**).

## 1. Architecture générale

| Couche | Emplacement | Rôle |
|---|---|---|
| Web (Next.js 15) | `src/` | App web, module Design, routes API `/api/design/*` |
| Desktop (Electron) | `electron/` | Shell privilégié, runtime IA, coffre, IPC |
| Cerveau IA | `electron/runtime/sophenic-brain.ts` | Routage multi-provider, fallbacks, conseil |
| Providers/clés | `electron/runtime/provider-registry.ts`, `provider-secrets.ts`, `plugin-vault.ts` | Clés existantes, vault chiffré, plugins |
| Vision | `electron/runtime/design-vision.ts` + `src/app/api/design/vision` | Analyse d'images via providers existants |
| Assets 3D | `electron/runtime/design-assets.ts`, `design-asset-engine.ts` | API Sketchfab réelle (search/download/cache, token vault) |
| Noyau Design | `src/design/*.ts` | Brief, intent, composition, audit, qualité, sélection assets |
| UI Design | `src/components/design/*.tsx` | Workspace, canvas 2D/3D, timeline, chat |

## 2. Flux agents / Brain (existant, réutilisé tel quel)

- `design-workspace.tsx` → `requestDesignAi()` (`src/design/ai.ts`) :
  - Desktop : `window.sophenicDesktop.openrouter.chat({ provider: "sophenic", model: "auto" })`
    → **SOPHENIC Brain** (profilage de tâche, choix provider parmi gemini/openrouter/xai/zai/alibaba,
    fallbacks automatiques, effort quick/auto/deep).
  - Web : `POST /api/design/ai` → OpenRouter avec les clés/env existants (`src/lib/openrouter.ts`).
- Vision : Desktop `sophenic:design:analyze-image` → `design-vision.ts` (providers vision configurés) ;
  web `/api/design/vision` (OpenRouter vision, `openrouter/auto`).
- Aucun nouveau cerveau n'est nécessaire : V8.1 **réutilise** ces ponts.

## 3. Mémoire / projets

- Projets Design persistés dans `design-projects.json` via IPC (`workspace-data.ts`,
  `src/design/storage.ts`), autosave + undo/redo + snapshots versions.
- Historique conversations Supabase (web) + mémoire locale Desktop — inchangé.

## 4. Génération 3D actuelle (avant V8.1)

Pipeline `sendArchitecture` (design-workspace.tsx) :
1. `parseArchitectureBrief` — **regex presets** (style/palette/matériaux) ;
2. `buildArchitectureIntent` V8 — fusionne brief + références (hints regex) ;
3. **`fastDesignCommand` s'exécute AVANT le Brain** et contient **2 layouts codés en dur**
   (palais 3 niveaux / villa 2 niveaux) + un layout maison fixe (Salon/Cuisine/Chambres/SDB) ;
4. sinon Brain → plan JSON d'actions (`set_villa_program`, `furnish_room`, …) ;
5. application + enrichissement Sketchfab ; 6. quality pass + audit.

### Défauts constatés (confirmés par le code)

- **Templates fixes** : `fastDesignCommand` intercepte les prompts palais/villa AVANT le Brain →
  plusieurs prompts donnent presque la même maison ; les autres prompts retombent sur un
  layout unique fixe (`buildArchitectureLayout` défaut + `requestedHouseRooms`).
- **Design Intent non IA** : construit par regex uniquement ; les références vision produisent du
  texte libre re-regexé (perte d'information : pas de furnitureStyle/lumière/proportions structurés).
- **Pipeline Sketchfab partiellement aveugle au style** : les requêtes sont toujours
  « modern sofa », « designer lamp »… même pour un palais (aucun « royal sofa », « chandelier »).
  Le ranking (PBR/licence/downloadable/polycount) existe mais **ne matche pas le style de l'intent**.
- UI : bouton « Références » existe (import multi-images OK) mais pas de panneau « Références
  analysées / Style détecté / Matériaux » ni de timeline V8.1 en 7 étapes réelles.

## 5. Décisions V8.1 (sans nouveau Brain)

1. **Design Intent System obligatoire (V8.1)** — `DesignIntentSummary` enrichi
   (furnitureStyle, lighting, structuralLanguage, monumentality, heights, assetVocabulary…).
   Construit par le **Brain existant** (`design-intent-ai.ts` + route `/api/design/intent`)
   avec **fallback déterministe** hors-ligne. Toute génération en dépend.
2. **Image Reference Intelligence** — prompt Vision V8.1 exigeant un **JSON structuré**
   (style, matériaux, couleurs, mobilier, lumière, proportions, ambiance, niveau de luxe),
   parsé dans `DesignReferenceAnalysis` puis fusionné dans l'intent.
3. **Suppression des templates fixes** — `fastDesignCommand` ne contient plus de layout codé en
   dur : le **Program Synthesis Engine** (`architect-program.ts`) dérive niveaux/hauteurs/pièces/
   matériaux/features/vocabulaire d'assets **depuis l'intent** (palais ≠ villa structurellement).
4. **Sketchfab Real Asset Pipeline** — `asset-requirements.ts` : intent → besoins
   (royal sofa/chandelier/marble table pour un palais ; modern sofa/designer chair/glass table/
   minimalist lamp pour une villa), ranking V8.1 avec style-matching + PBR + licence +
   downloadable + polycount ; **jamais d'asset inventé**, message explicite si aucun résultat.
5. **UI** — bouton « Ajouter références », panneau « Références analysées / Style détecté /
   Matériaux », timeline réelle en 7 étapes (demande → images → intent → assets →
   architecture → aménagement → vérification).
6. **Tests obligatoires** — `scripts/test-sophenic-design-v81.mjs` : A (palais) vs B (villa)
   structurellement différents, C (image salon moderne → le résultat change), ranking assets.

## 6. Baseline avant modification

- `npm run test:sophenic` → OK (2 suites).
- `npm run verify:source` → OK.
- `npm run typecheck` / `npm run build:web` → vérifiés après modification.
