# SOPHENIC DESIGN V8.2 — REAL AI DESIGN AGENT

> Version 8.2.0 · Branche `arena/01a07817-sophenic-architecture` · Suite `scripts/test-sophenic-design-v82.mjs` (5/5 verts)

V8.2 transforme SOPHENIC Design en **véritable agent IA d'architecture d'intérieur** : il comprend une image de référence, en extrait un **ROOM_BLUEPRINT** structuré, puis **reconstruit entièrement la pièce** demandée — suppression du mobilier existant, nouvelle composition, nouveaux matériaux, nouvelle ambiance. C'est un correctif **architectural**, pas cosmétique.

## 1. Pipeline V8.2 (obligatoire, bout en bout)

```
IMAGE + PROMPT
   → VISION AI (modèles existants du SOPHENIC Brain — aucun nouveau cerveau)
   → ROOM UNDERSTANDING ENGINE (room-blueprint.ts + room-understanding.ts)
   → DESIGN INTENT JSON (V8.1, enrichi)
   → SPACE REBUILD ENGINE (space-rebuild.ts) : SUPPRESSION puis RECONSTRUCTION
   → ASSET SEARCH ENGINE (asset-intelligence.ts + asset-selection.ts)
   → 3D PLACEMENT ENGINE (furniture-layout-agent.ts)
   → QUALITY CHECK (architecture-quality.ts)
   → FINAL SCENE
```

### Nouveaux modules (`src/design/`)

| Module | Rôle |
|---|---|
| `furniture-catalog.ts` | Dimensions ergonomiques et rôles (backrest, focal, centerpiece, pendant, plant, storage…) par type de meuble |
| `material-canon.ts` | Normalisation libre → canon matériaux (« lin beige » → « Lin ivoire ») |
| `room-blueprint.ts` | `parseRoomBlueprint` (JSON Vision → blueprint), `deriveRoomBlueprint` (fallback honnête), `blueprintSummaryLines` (carte UI) |
| `room-understanding.ts` | `ROOM_UNDERSTANDING_VISION_PROMPT` (schéma JSON strict), `resolveRoomBlueprint` (Brain → dérivation), `inspirationVisionPrompt` |
| `furniture-layout-agent.ts` | Agent de placement par scoring : mur focal, assise face au point focal (≥ 1,95 m), table basse à 0,42–0,68 m, symétrie des fauteuils, passages de portes ≥ 0,62 m, canapé sous fenêtre autorisé (h ≤ 1,15 m), tapis sous le mobilier, équilibre du barycentre, îlot flottant si aucun mur libre |
| `space-rebuild.ts` | `rebuildRoomFromBlueprint` : SUPPRIME meubles/déco/placement (conserve escaliers + colonnes) puis RECONSTRUIT via le layout agent ; applique sols (palais → marbre, villa → bois), palette du style demandé, hauteur de plafond du blueprint ; `rebuildRoomPlan` → action `rebuild_room` |
| `asset-intelligence.ts` | Expansion d'intention **multi-requêtes** (JAMAIS le nom exact), `recordAssetGap` (manque enregistré + message honnête + alternative), `qualityScore`, `reasonSelected` |
| `program-requests.ts` | Comptage des pièces demandées depuis le prompt |
| `intent-profiles.ts` (réécrit) | Paramètres de style uniquement — plus AUCUN programme de pièces figé |
| `architect-program.ts` (réécrit) | Synthèse générative **seeded** (hash + mulberry32) : dimensions, ouvertures, niveaux varient avec la graine |

### État (`types.ts`)

- `architecture.roomBlueprint` — le blueprint de l'image analysée (source de vérité primaire des transformations).
- `architecture.assetGaps` — manques Sketchfab enregistrés (jamais de fallback silencieux).
- `architecture.variationSeed` — graine : deux demandes identiques peuvent produire deux scènes différentes.
- Action `{ type: "rebuild_room", room, blueprint?, style? }`.

## 2. Règles respectées

- **RÈGLE ABSOLUE** : aucun nouveau Design Brain. La Vision et le Brain passent par `chatWithExistingBrain` (pont IPC desktop existant → route web existante), clés et routage inchangés.
- **Aucun template fixe** : le mobilier vient du BLUEPRINT de l'image + transfert de style ; le layout est décidé par l'agent de placement ; le programme architectural est génératif et seedé. Le test 3 prouve que deux graines → deux compositions.
- **« Transforme mon salon »** = suppression totale puis reconstruction (le test 1 vérifie `0 ancien objet conservé`) — jamais des retouches de couleur ni des déplacements de 20 cm.
- **Sketchfab sans nom exact** : « table basse sculpturale » (palais) → `organic/sculptural/marble/stone/luxury coffee table` ; ranking V8.1 (+9/−16, style + PBR + licence + download) ; `{asset, source, license, qualityScore, reasonSelected}` sur chaque meuble enrichi ; sur échec : « Je n'ai pas trouvé un asset Sketchfab compatible. Je génère un placeholder premium temporaire. » + gap enregistré + alternative.
- **Précédence** : une demande citant une PIÈCE (« Transforme ce salon en palace royal ») déclenche le rebuild de la pièce, pas une génération globale.

## 3. UI

- Bouton **« Analyser une inspiration »** (barre d'outils 3D) : analyse Vision → blueprint stocké → message chat « IMAGE ANALYSÉE » (Style / Matériaux / Layout / Furniture).
- Carte **IMAGE ANALYSÉE · Room Understanding V8.2** dans le panneau (pièce, dimensions, style, matériaux, layout, mobilier) + liste des **manques Sketchfab**.
- Timeline enrichie : Room Understanding, Asset Intelligence (expansion multi-requêtes), Space Rebuild.
- Sans clic préalable, une demande « Transforme ce salon… » déclenche elle-même le Room Understanding (Brain → dérivation).

## 4. Tests (`npm run test:sophenic` — 4 suites)

```
SOPHENIC DESIGN V8.2 REAL AI DESIGN AGENT — TESTS OBLIGATOIRES : OK
  TEST 1 Salon→Japandi  : 7 objets reconstruits · canapé/table/fauteuils japandi · sol « Bois vernis » · 0 ancien objet conservé · layout agent v8.2
  TEST 2 Même image→Palace : 9 objets · mobilier « classique royal » · lustre + tapis · sol « Marbre Calacatta clair » · Jaccard TEST1/TEST2 0.00
  TEST 3 Villa≠Palais    : niveaux 2 vs 3 · murs 3 vs 4.9 m · Jaccard pièces 0.17 · graines 111/999 → compositions différentes
  TEST 4 Asset Intel     : « Table basse sculpturale en marbre » → 5 requêtes · jamais le nom exact · gap enregistré + message honnête
  TEST 5 Room Understand : JSON Vision → blueprint · texte invalide → null · sans IA → notice honnête
```

Même image beige classique : japandi → bois clair/minimalisme ; palace royal → marbre/classique royal/lustre. Jaccard 0.00 : deux univers radicalement différents.

## 5. Vérifications livraison

- `npx tsc --noEmit` : 0 erreur.
- `npm run test:sophenic` : 4 suites OK (core, design V7, V8.1 REAL AI, V8.2 DESIGN AGENT).
- `npm run build:web` : build Next.js OK.

## 6. Compatibilité

V8.1 intact : `apply_architecture_program` reste l'unique chemin structurel global ; intents, références, assets et suite V8.1 verts sans modification de leurs contrats.
