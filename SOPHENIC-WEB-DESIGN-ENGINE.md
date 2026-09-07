# SOPHENIC WEB DESIGN ENGINE

> Version 8.3 · Branche `arena/01a07817-sophenic-architecture` · Suite `scripts/test-sophenic-webdesign.mjs` (6/6 verts)

Un **moteur de design de sites de niveau studio créatif premium** (penser Figma AI / Framer AI / Webflow AI / agence Awwwards) intégré à SOPHENIC — qui produit un **WEBSITE DESIGN BLUEPRINT avant toute génération de code**.

## 1. Règle d'architecture absolue — respectée

**Aucun nouveau cerveau IA.** Web Design est une *compétence* du SOPHENIC Brain existant :
- le brief créatif passe par `chatWithExistingBrain` (pont IPC desktop → Brain/routage/providers/clés existants, fallback route web `/api/design/intent`) ;
- sans IA joignable, une analyse heuristique déterministe prend le relais — le pipeline ne casse jamais ;
- le Brain décide quand raisonner ; le moteur de design décide comment construire.

## 2. Nouveau type de projet : WEB DESIGN

`Créer un projet` → **Web Design** (à côté d'Architecture et Design 3D). Domaine `webdesign`, atelier dédié (`web-design-workspace.tsx`) : modes, aperçu live desktop/tablette/mobile, panneau blueprint, scores qualité, export, envoi vers Code.

## 3. Le mode unique — TEMPLATE INTELLIGENCE (V8.4)

> **V8.4** : le mode « Création Originale » (agence créative sans template) est **supprimé** de l'interface. Seul le flux Template Intelligence reste ; les anciens blueprints originaux restent lisibles (rendu piloté par les données).

1. Brief analysé par le Brain (industrie, audience, positionnement, conversion) — **pièces jointes acceptées** (images et fichiers, analysés en vision par le Brain) ;
2. la bibliothèque interne (**24 templates** : Luxury Editorial, Immersive 3D, Modern Minimal, Bold E-commerce, Corporate Trust, Warm Hospitality, Creative Portfolio, Serene Wellness, Dark Mansion, Fashion Lookbook, SaaS Product, Crypto Web3, Fine Dining, Artisan Café, Bold Agency, Fullscreen Photography, Swiss Architecture, Prestige Law, Medical Care, Academy Learning, Impact Nonprofit, Festival Energy, Podcast Studio, App Showcase) est classée — **top 5 avec score de compatibilité** (industrie pondérée par spécificité du mot-clé + traits + structure + objectif) ;
3. **galerie de test** : chaque template proposé est **testable dans son intégralité** (aperçu complet multi-pages navigable, onglets, identité du template, badge « ✦ SOPHENIC AI ») avant tout engagement ;
4. l'utilisateur **sélectionne** la structure de départ ;
5. `customizeTemplate` **remplace entièrement l'identité visuelle** (palette, typographie, animations, imagerie, moodboard) par celle de la marque, adapte la structure (± sections conversion/boutique) et garantit de ne **jamais retomber sur l'identité du template** (variantes + palettes sœurs). Le résultat ne ressemble pas au template d'origine. Six agents journalisent leurs décisions : `Template Selection` → `Brand Restyler` → `Visual Designer` → `3D Experience Designer` (**décide** : 3D seulement si justifiée — conservée si le template en porte ET que le brief la justifie, sinon retirée) → `Conversion Specialist` → `Motion Designer`.

Le moteur de style (`style-engine.ts`) mappe industrie × positionnement × traits vers des familles (palettes clair/sombre, pairings typographiques, animations, imagerie) avec sélection déterministe : joaillerie ≠ gaming ≠ villa ≠ restaurant, et les 5 templates d'une même galerie produisent 5 designs customisés distincts.

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

## 8 bis. PIÈCES JOINTES UNIVERSELLES (V8.4)

Partout où l'utilisateur parle à Sophenic — **Chat, Code, Image, Design (Web Design)** — le bouton « Joindre » / « Références » accepte **une ou plusieurs images et fichiers** (≤ 6 pièces, ≤ 5 Mo chacune) :

- **Chat** : les images partent en **vision native** au Brain (format multimodal OpenAI-compatible `image_url` ; le Brain force le skill `vision` et route vers un modèle qui voit) ; les documents (PDF…) partent en `file_data` (skill `documents` forcé) ; les fichiers texte sont inlinés dans le prompt. Les pièces jointes **court-circuitent les routeurs déterministes** (génération d'image, lieu, action PC, Hermes) : une demande illustrée va au modèle.
- **Code** : fichiers texte inlinés dans le prompt moteur (secrets du développeur déjà redactés), images notées honnêtement (le moteur Code ne voit pas les pixels — il oriente vers le Chat).
- **Image** : pièces jointes notées comme références visuelles dans le prompt du moteur d'image.
- **Design** : images/fichiers transmis au Brain pour le brief créatif (style, ambiance, niveau de gamme extraits des références).
- Historique : les vignettes sont conservées en conversation, les dataUrls ne sont pas persistés (poids).

Côté moteur : `OpenRouterChatMessage` porte `images`/`files` ; `compactHistory` ne conserve les payloads que sur le message le plus récent ; `requestBody` construit le contenu multimodal au niveau wire (aucun nouveau Brain — règles absolues respectées).

## 9. Modules (`src/design/web-design/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | Blueprint, brief, template, qualité, handoff (types purs) |
| `templates.ts` | Bibliothèque interne (24 templates V8.4) + `rankTemplatesForBrief` (top 5, compatibilité %, spécificité industrie) |
| `style-engine.ts` | Familles de style par industrie/positionnement, contraste WCAG, palettes sœurs, sélection déterministe par graine |
| `creative-brief.ts` | Brief heuristique + Brain (`chatWithExistingBrain`), prompt JSON strict, merge champ par champ |
| `template-mode.ts` | `customizeTemplate` : structure conservée, identité remplacée, 6 agents, traçabilité |
| `quality.ts` | Évaluation 5 axes + issues + auto-amélioration + boucle |
| `asset-plan.ts` | Recommandations d'assets |
| `preview.ts` | Aperçu HTML du blueprint + aperçu complet des templates (galerie V8.4) — badge « ✦ SOPHENIC AI » |
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
