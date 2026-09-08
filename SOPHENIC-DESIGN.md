# SOPHENIC DESIGN — Nouvelle architecture

SOPHENIC DESIGN est organisé autour d'une règle simple : **un projet, un canvas principal, Sophenic à droite**.

L'utilisateur n'arrive plus dans une collection de studios techniques. Il arrive sur une page minimaliste avec **Créer un projet**, puis choisit l'un des trois espaces suivants :

1. **Design Web** — sites, interfaces et applications Web.
2. **Architecture** — maisons, appartements, bâtiments, pièces et aménagement intérieur.
3. **Design 3D** — objets, mobilier et concepts produit.

## Expérience commune

Chaque projet possède :

- autosave ;
- undo/redo ;
- snapshots et restauration de versions ;
- canvas contextuel ;
- sélection visuelle ;
- copilot Sophenic qui reçoit le projet et la sélection courante ;
- export du projet.

L'objectif est de rester dans le même projet : sélectionner, demander une modification, voir le résultat, comparer, annuler ou continuer.

## Design Web

Le workspace Web accepte :

- fichiers individuels ;
- dossier de site ;
- archive ZIP.

Les fichiers du site sont réellement lus et conservés dans le projet. Pour un site statique, `index.html`, les feuilles CSS, scripts et assets locaux sont reconstruits dans une **preview iframe réelle**. Ce n'est pas une capture d'écran générée.

Fonctions principales :

- aperçu Desktop / tablette / mobile ;
- inspection visuelle d'un élément de la page ;
- liste des fichiers importés ;
- modification des fichiers par Sophenic Brain via une action contrôlée `write_web_file` ;
- undo de la dernière transformation ;
- export du site modifié en ZIP.

Pour une demande comme « Rends le design de ce site 100x mieux », Sophenic reçoit les vrais fichiers texte du projet et doit produire des réécritures complètes de fichiers, tout en conservant les fonctionnalités et la structure du framework autant que possible.

Pour React/Next/Vue/Svelte sans sortie HTML statique, les fichiers restent lisibles et modifiables par l'IA. La preview statique intégrée nécessite cependant une entrée HTML construite ; un runtime/builder de framework dédié pourra être ajouté ultérieurement.

## Architecture

Le workspace Architecture se concentre sur trois vues :

- **Plan 2D** ;
- **3D** ;
- **Visite**.

Le plan utilise un même modèle de projet que la vue 3D. Les éléments incluent notamment :

- pièces ;
- murs ;
- portes ;
- fenêtres ;
- escaliers ;
- mobilier ;
- cotes ;
- matériaux.

La visualisation 3D différencie davantage les objets : canapé, lit, table/bureau, fauteuil, plante, cuisine, luminaire, sanitaire et escalier. Les portes et fenêtres sont également visibles dans la scène. Des textures procédurales simples sont appliquées aux familles bois, marbre, tissu, verre et métal.

Le mode **Visite** place la caméra à hauteur humaine et permet de se déplacer à la souris et au clavier (WASD/flèches).

Sophenic peut recevoir le contexte de l'élément sélectionné. Une phrase comme « Fais-le plus grand » peut donc être interprétée relativement à l'objet sélectionné.

Des simulations comparatives sont disponibles pour lumière naturelle, ombres, éclairage, circulation, occupation, visibilité et énergie. Elles produisent scores, métriques et recommandations, mais restent indicatives et ne constituent pas une validation professionnelle de construction.

## Design 3D

Le workspace Design 3D est séparé de l'Architecture. Il cible les objets et produits :

- dimensions largeur / profondeur / hauteur ;
- visualisation interactive ;
- matériaux ;
- variantes ;
- modifications conversationnelles via Sophenic.

Le renderer actuel est un moteur de conception temps réel intégré. Il n'est pas encore un noyau CAO/BREP, un système BIM/IFC ou un moteur PBR/physique complet.

## IA et sécurité

Les modifications passent par un protocole d'actions Design limité et validé. Pour le Web, les écritures sont normalisées, les chemins `node_modules` sont interdits et la taille des contenus est bornée.

Le renderer privilégié Electron reste isolé derrière le preload/IPC. Aucun code arbitraire retourné par un modèle n'est exécuté comme commande système par le module Design.

## Fichiers principaux

- `src/components/design/design-workspace.tsx` — accueil, choix des 3 projets et shell canvas + Sophenic.
- `src/components/design/design-web-preview.tsx` — preview réelle et inspection visuelle Web.
- `src/components/design/design-canvas-2d.tsx` — plan 2D.
- `src/components/design/design-viewport-3d.tsx` — 3D et visite.
- `src/design/web-import.ts` — import fichiers/dossiers/ZIP.
- `src/design/web-workspace.ts` — reconstruction de preview et contexte Web.
- `src/design/web-export.ts` — export ZIP.
- `src/design/ai.ts` — contexte projet et protocole avec Sophenic Brain.
- `src/design/commands.ts` — validation/application des actions.
- `scripts/test-sophenic-design.mjs` — suite de tests Design.

## Test rapide

Un site statique de démonstration est fourni dans :

`examples/sophenic-design-web-demo.zip`

Après lancement de l'application :

1. Design → Créer un projet → Design Web.
2. Importer `examples/sophenic-design-web-demo.zip`.
3. Vérifier la preview réelle.
4. Demander :
   `Rends le design de ce site 100x mieux d'après toi, mais garde tout son contenu et ses fonctionnalités.`
5. Activer **Inspecter**, cliquer une section, puis demander :
   `Rends cette section plus premium.`
6. Tester Desktop / tablette / mobile et exporter le site.

Pour Architecture :

1. Design → Créer un projet → Architecture.
2. Demander :
   `Crée un salon moderne avec un canapé, une table et un escalier.`
3. Passer de Plan 2D à 3D puis Visite.
4. Sélectionner un élément et demander :
   `Fais-le plus grand et remplace son matériau par du bois clair.`

## Vérifications source

```powershell
npm run test:sophenic
npm run verify:source
```

La nouvelle archive contient aussi les ressources Windows attendues par le pipeline (`build/icon.ico`, assets NSIS et splash de lancement), afin que `verify:source` puisse être exécuté sur une source complète.
