# SOPHENIC Architecture V8.1 — REAL AI Design Agent

## Règle absolue respectée

V8.1 ne crée **aucun nouveau cerveau IA**. Le module Design utilise :

- **SOPHENIC Brain existant** (`electron/runtime/sophenic-brain.ts`) via le pont IPC
  `window.sophenicDesktop.openrouter.chat({ provider: "sophenic", model: "auto" })` ;
- le **système de routing existant** (providers gemini/openrouter/xai/zai/alibaba,
  effort quick/auto/deep, fallbacks automatiques) ;
- les **API keys existantes** (coffre chiffré Desktop ou env/route web
  `/api/design/intent` qui réutilise `openRouterHeaders()`) ;
- les **providers existants** pour la Vision (`design-vision.ts` Desktop,
  `/api/design/vision` web) ;
- le **système plugins/Asset Engine existant** pour Sketchfab
  (`design-asset-engine.ts`, token dans le coffre, IPC sécurisé).

## Les 5 fonctions livrées

### 1) Image Reference Intelligence

« Ajouter références » (multi-images : salon, chambre, cuisine, façade,
matériaux, inspiration). Chaque image passe par le modèle Vision avec un prompt
V8.1 exigeant un **JSON structuré** :

```json
{ "style": "...", "materials": ["travertine", "walnut", "glass"],
  "colors": ["#RRGGBB"], "furniture": ["minimalist sofa"],
  "furnitureStyle": "minimaliste premium contemporain",
  "lighting": "warm indirect", "proportions": "open plan",
  "ambiance": "soft", "luxuryLevel": "rich", "rooms": ["living room"],
  "summary": "..." }
```

`parseVisionReferenceAnalysis` (design-intent.ts) le convertit en
`DesignReferenceAnalysis` riche (extraction « vision-ai »), avec fallback
heuristique si la réponse n'est pas du JSON.

### 2) Design Intent System (couche intermédiaire obligatoire)

`DesignIntentSummary` V8.1 enrichi : `archetype`, `furnitureStyle`, `lighting`,
`structuralLanguage`, `monumentality` (0-100), `wallHeight`, `assetVocabulary`,
`requestedRooms`, `detectedStyleLabel`, `intentVersion: "8.1"`, `origin:
"brain" | "heuristic"`.

Construction :

1. base déterministe (`buildArchitectureIntent`) ;
2. **enrichissement par le Brain existant** (`resolveDesignIntent`,
   design-intent-ai.ts) — Desktop d'abord, route web ensuite ;
3. fusion validée champ par champ (`mergeBrainIntent`) : une réponse IA
   partielle ne casse jamais la génération.

**Toute** génération dépend de cet objet : Program Synthesis, composition
intérieure, requêtes Sketchfab, prompt Brain.

### 3) Suppression de la logique template fixe

Les deux layouts codés en dur (palais/villa) de `fastDesignCommand` sont
supprimés. Ils sont remplacés par :

- `intent-profiles.ts` — archétypes **paramétriques** (palace/villa/house) :
  styles, matériaux, vocabulaire d'assets, programmes de pièces ;
- `architect-program.ts` — **Program Synthesis Engine** : niveaux, pièces,
  hauteurs, colonnades, ouvertures monumentales/baies vitrées, sols par usage,
  densités d'ameublement — tous modulés par `monumentality`, `finishLevel`,
  matériaux détectés et pièces demandées ;
- nouvelle action atomique `apply_architecture_program` appliquée par le
  pipeline existant (timeline, undo, autosave).

Résultat mesuré (tests A/B) : palais 19 pièces / 3 niveaux / murs 4,9 m /
17 colonnes vs villa 10 pièces / 2 niveaux / murs 3,0 m / baies vitrées —
Jaccard pièces 0,17, Δ hauteurs 1,9 m.

### 4) Sketchfab Real Asset Pipeline

`asset-requirements.ts` : Design Intent → besoins d'assets.

- Palais → `royal sofa`, `crystal chandelier`, `marble dining table`,
  `classic chair`, `royal canopy bed`…
- Villa moderne → `modern sofa`, `designer chair`, `glass coffee table`,
  `minimalist pendant lamp`…

Ranking V8.1 (`asset-selection.ts`) : **style-matching IA** (jetons
classique/royal vs modern/minimalist, bonus/malus), catégorie meuble, PBR /
photorealistic, qualité (staff pick, likes, views), **licence**,
**downloadable**, polycount crédible. Filtres inchangés : sans licence ou non
téléchargeable → rejeté. **Aucun asset n'est jamais inventé** : si rien n'est
compatible, `noAssetMessage()` l'annonce et le fallback procédural premium est
conservé.

### 5) UI

- bouton **« Ajouter références »** dans la barre Architecture ;
- panneau **Références & Design Intent V8.1** : « Références analysées : N »,
  « Style détecté », « Matériaux », mobilier, lumière, monumentalité ;
- **timeline réelle en 7 étapes** : Analyse demande → Analyse images →
  Création Design Intent → Recherche assets → Construction architecture →
  Aménagement → Vérification (+ sous-étapes d'actions détaillées) ;
- rendu 3D : colonnes monumentales et chandeliers en cristal procéduraux.

## Tests obligatoires (passent sans réseau ni clés)

`npm run test:design-v81` (`scripts/test-sophenic-design-v81.mjs`) :

- **A. « Créer un palais majestueux »** → 3 niveaux, murs ≥ 4 m, colonnades,
  marbre/dorures, fenêtres monumentales, mobilier luxury classique,
  assets « royal sofa / chandelier / marble table / classic chair » ;
- **B. « Créer une villa moderne »** → 1-2 niveaux, murs ≤ 3,4 m, baies vitrées
  (large + allège basse), bois/pierre/verre, mobilier minimaliste premium,
  assets « modern sofa / designer chair / glass table / minimalist lamp » ;
- **A ≠ B structurellement** (niveaux, pièces, hauteurs, colonnes, sols,
  vocabulaires d'assets) ;
- **C. image de salon moderne (JSON Vision)** → style « contemporary luxury »
  détecté, noyer/travertin/laiton intégrés, sols changés
  (Chêne→Noyer, →Travertin cuisine), aménagement `balanced`→`complete` ;
- **Assets** : ranking intent-aware (palais→royal classic, villa→modern
  minimalist), rejet sans licence/low-poly, null sur recherche vide + message
  honnête ;
- qualité : aucune collision/dégagement invalide dans le Grand Salon, passe de
  vérification OK, déterminisme du moteur hors IA.

## Fichiers clés

| Rôle | Fichier |
|---|---|
| Archétypes paramétriques | `src/design/intent-profiles.ts` (nouveau) |
| Intent heuristique + parsing Vision JSON | `src/design/design-intent.ts` |
| Intent via Brain existant | `src/design/design-intent-ai.ts` (nouveau) |
| Route web d'intent (clés existantes) | `src/app/api/design/intent/route.ts` (nouveau) |
| Program Synthesis Engine | `src/design/architect-program.ts` (nouveau) |
| Besoins d'assets Sketchfab | `src/design/asset-requirements.ts` (nouveau) |
| Ranking IA des assets | `src/design/asset-selection.ts` |
| Actions/commandes (sans templates) | `src/design/commands.ts` |
| UI (bouton, panneau, timeline) | `src/components/design/design-workspace.tsx` |
| Tests obligatoires V8.1 | `scripts/test-sophenic-design-v81.mjs` (nouveau) |

## Vérifications

```powershell
npm run test:sophenic   # 3 suites (core + design V7 + V8.1 obligatoires)
npm run verify:source
npm run typecheck       # 0 erreur (corrigé : 8 erreurs préexistantes résolues)
npm run build:web       # build Next.js complet OK
```
