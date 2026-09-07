# SOPHENIC WEB DESIGN ENGINE

> Version 8.3 · Branche `arena/01a07817-sophenic-architecture` · Suite `scripts/test-sophenic-webdesign.mjs` (6/6 verts)

Un **moteur de design de sites de niveau studio créatif premium** (penser Figma AI / Framer AI / Webflow AI / agence Awwwards) intégré à SOPHENIC — qui produit un **WEBSITE DESIGN BLUEPRINT avant toute génération de code**.

## 1. Règle d'architecture absolue — respectée

**Aucun nouveau cerveau IA.** Web Design est une *compétence* du SOPHENIC Brain existant :
- le brief créatif passe par `chatWithExistingBrain` (pont IPC desktop → Brain/routage/providers/clés existants, fallback route web `/api/design/intent`) ;
- sans IA joignable, une analyse heuristique déterministe prend le relais — le pipeline ne casse jamais ;
- le Brain décide quand raisonner ; le moteur de design décide comment construire.

## 2. Nouveau type de projet : WEB DESIGN

`Créer un projet` → **Web Design** (à côté d'Architecture, Design Web, Design 3D). Domaine `webdesign`, atelier dédié (`web-design-workspace.tsx`) : modes, aperçu live desktop/tablette/mobile, panneau blueprint, scores qualité, export, envoi vers Code.

## 3. Les deux modes

### MODE 1 — TEMPLATE INTELLIGENCE (rapide, économique)
1. Brief analysé par le Brain (industrie, audience, positionnement, conversion) ;
2. la bibliothèque interne (8 templates : Luxury Editorial, Immersive 3D, Modern Minimal, Bold E-commerce, Corporate Trust, Warm Hospitality, Creative Portfolio, Serene Wellness) est classée — **top 3 avec score de compatibilité** (industrie + traits + structure + objectif) ;
3. l'utilisateur choisit une structure de départ ;
4. `customizeTemplate` **remplace entièrement l'identité visuelle** (palette, typographie, animations, imagerie, moodboard) par celle de la marque, adapte la structure (± sections conversion/boutique) et garantit de ne **jamais retomber sur l'identité du template** (variantes + palettes sœurs). Le résultat ne ressemble pas au template d'origine.

### MODE 2 — ORIGINAL CREATIVE DESIGN (premium)
Aucun template. **Agence créative complète** en 7 agents, chacun journalisant ses décisions :
`Creative Director` (direction artistique) → `UX Strategist` (pages/sections) → `Brand Designer` (palette/typographie) → `Visual Designer` (composants/spacing/imagerie) → `Motion Designer` (animations) → `3D Experience Designer` (**décide** : 3D seulement si justifiée — gaming/tech → WebGL hero ; joaillerie/lieux → vitrine 3D sobre ; sinon aucune) → `Conversion Specialist` (CTA, preuves de confiance).

Le moteur de style (`style-engine.ts`) mappe industrie × positionnement × traits vers des familles (palettes clair/sombre, pairings typographiques, animations, imagerie) avec **sélection déterministe par graine** : joaillerie ≠ gaming ≠ villa ≠ restaurant, et deux graines produisent des compositions différentes.

## 4. Livrable : le Website Design Blueprint (AUCUN code applicatif)

```json
{ "projectType": "website", "brand": "", "industry": "", "designDirection": "",
  "pages": [{ "name": "Home", "sections": ["Hero", "Features", "Testimonials"] }],
  "visualStyle": { "colors": [], "typography": "", "spacing": "", "animations": [] },
  "components": [], "assets": [], "threeDElements": [], "responsiveRules": [],
  "conversion": { "primaryCta": "", "trustElements": [] }, "quality": { ... } }
```

## 5. AI DESIGN QUALITY SYSTEM

Avant finalisation : évaluation automatique **Visual / UX / Conversion / Brand / Mobile** (contrastes WCAG réels, CTA, preuves, moodboard, règles tactiles…), liste d'issues par sévérité, pénalité sur la note globale, puis **boucle d'auto-amélioration** (contraste recalibré, CTA ajoutés, nav/footer/règles complétées — max 2 itérations, seuil 82). Ex. test 4 : design dégradé 47/100 → corrigé 100/100.

## 6. ASSET INTELLIGENCE

Recommandations par direction artistique : images (hero + séries, directives prêtes shooting/banque/IA), sets d'icônes par section, illustrations (si playful), éléments 3D (suivant les décisions du designer 3D), librairies d'animation (GSAP/Framer Motion/Three.js/Lottie) — chaque asset porte `directive`, `usage` et `raison`.

## 7. EXPORT — SOPHENIC_WEB_DESIGN_PROJECT.zip

Bouton d'export (writer ZIP pur TS, réutilisé de `web-export.ts`) : `design.json` · `brief.json` · `quality-report.json` · `README.md` · `components/*.md` · `assets/asset-plan.json` · `images/image-plan.md` · `animations/animation-rules.md` · `responsive-rules.md` · `3d/3d-experience.md` (si 3D) · `preview/index.html` (aperçu visuel du blueprint — visualisation, pas le code du site).

## 8. CONNECTION SOPHENIC CODE

- **« Envoyer vers SOPHENIC Code »** : construit un `CodeDesignHandoff` (brief d'implémentation complet : identité, pages/sections, composants, animations, responsive, 3D, assets, contraintes qualité), l'enregistre et copie le brief.
- **Compositeur Code (agent)** : bouton **« Design »** — sélectionne un design parmi ceux envoyés (nom, marque, industrie, score) ; le brief d'implémentation remplit l'input, prêt à générer **React · Next.js · Shopify · WordPress · HTML/CSS** à partir du design (le design précède le code, jamais l'inverse).

## 9. Modules (`src/design/web-design/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | Blueprint, brief, template, qualité, handoff (types purs) |
| `templates.ts` | Bibliothèque interne + `rankTemplatesForBrief` (top 3, compatibilité %) |
| `style-engine.ts` | Familles de style par industrie/positionnement, contraste WCAG, palettes sœurs, sélection déterministe par graine |
| `creative-brief.ts` | Brief heuristique + Brain (`chatWithExistingBrain`), prompt JSON strict, merge champ par champ |
| `creative-agents.ts` | Pipeline d'agence 7 agents (mode Original) |
| `template-mode.ts` | `customizeTemplate` : structure conservée, identité remplacée, traçabilité |
| `quality.ts` | Évaluation 5 axes + issues + auto-amélioration + boucle |
| `asset-plan.ts` | Recommandations d'assets |
| `preview.ts` | Aperçu HTML déterministe du blueprint (palette, typo, pages, CTA) |
| `export.ts` | `SOPHENIC_WEB_DESIGN_PROJECT.zip` (13+ fichiers) |
| `code-handoff.ts` | Handoff + stockage + prompt de sélection Code |

## 10. Tests (`npm run test:sophenic` — 5 suites)

```
SOPHENIC WEB DESIGN ENGINE — TESTS OBLIGATOIRES : OK
  TEST 1 Joaillerie luxe  : 5 pages · « Cormorant Garamond + Jost » · accent #B08D3E · qualité 95/100 · 7 agents
  TEST 2 Gaming IA       : fond #0A0E14 (sombre) · « Space Grotesk » · 2 expériences 3D · 90/100 · 0 structure partagée avec TEST 1
  TEST 3 Template mode   : « Bold E-commerce » → 100% structure conservée · 5 couleurs remplacées · typo « Archivo Expanded » · 85/100
  TEST 4 Qualité+Export  : dégradé 47 → corrigé 100 · contraste AA 17.32:1 · ZIP 13 fichiers (design.json, preview, components…)
  TEST 5 Assets+Code     : 4+ recommandations · handoff React · Next.js · Shopify · WordPress · HTML/CSS avec palette + pages
  TEST 6 Anti-répétition : joaillerie ≠ gaming ≠ villa ≠ restaurant · 5 graines → plusieurs compositions distinctes · villa Marrakech « sable chaud, cuivre »
```

## 11. Vérifications livraison

- `tsc --noEmit` : 0 erreur · `npm run build:web` : ✓ (27/27 pages) · 5 suites de tests verts (core, V7, V8.1, V8.2, Web Design).
- Compatibilité : domaines existants (architecture/web/product) intacts — V8.1/V8.2 verts sans modification de contrats.
