# SOPHENIC Architecture V4 — Intelligent Villa Designer

## Objectif

Architecture V4 transforme SOPHENIC Design en espace de conception architecturale autonome. L'utilisateur peut demander une transformation globale (ex. maison → villa à plusieurs niveaux) et suivre chaque décision de Sophenic dans le chat avant et pendant son application.

## Expérience IA visible

Le panneau Sophenic affiche une timeline reliée verticalement :

1. Réflexion architecturale
2. Analyse de la maison actuelle
3. Construction du plan d'action
4. Actions retenues (niveaux, escalier, style, pièces, mobilier...)
5. Sélection des assets 3D si nécessaire
6. Vérification et optimisation
7. Finalisation

Une étape en cours affiche un cercle avec spinner. Une étape terminée devient verte avec une coche. Une étape échouée devient rouge. Les actions sont appliquées séquentiellement afin que la progression visible corresponde au travail réellement effectué.

## Caméra intérieure

- caméra à hauteur humaine (environ 1,62 m au-dessus du niveau de la pièce)
- horizon forcé droit, sans roulis
- clic gauche maintenu + glisser : regarder à 360°, haut/bas inclus
- OrbitControls désactivé en intérieur pour éviter qu'il réécrive l'orientation
- déplacement limité aux navigation nodes avec les contrôles dédiés
- changement de pièce à tout moment depuis le sélecteur ou les flèches
- support des niveaux : RDC / Étage 1 / etc.

## Caméra extérieure

- orbite 360° autour de la villa
- zoom limité
- centrage et hauteur adaptés au nombre de niveaux
- retour à une vue extérieure stable

## Villa multi-étages

Le modèle Architecture supporte maintenant des niveaux explicites. Une transformation globale peut :

- créer plusieurs étages
- répartir les pièces par niveau
- créer un escalier entre niveaux
- définir une palette et un style
- ajouter des meubles cohérents avec chaque fonction de pièce
- ajouter/adapter des ouvertures

Exemple déterministe pris en charge :

> Transforme cette maison actuelle en une villa contemporaine haut de gamme à deux étages avec un vrai escalier, plusieurs pièces, de beaux meubles et une palette chaleureuse.

## Intelligence de placement

Le placement tient compte au minimum :

- des limites de pièce
- des portes et fenêtres
- des autres objets
- de la fonction du meuble
- de la circulation

Les objets gardent le niveau de leur pièce. Les canapés/lits/TV/bureaux préfèrent les murs, les tables centrales le centre, les plantes/lampes les coins, et la passe qualité peut corriger les placements problématiques.

## Matériaux et rendu

Architecture V4 ajoute des matériaux plus riches et des textures procédurales pour éviter l'apparence « blocs gris » :

- marbre
- travertin
- chêne / noyer
- béton ciré
- métal
- verre
- tissus / palettes chaudes

Le fallback procédural dessine désormais des silhouettes de mobilier reconnaissables (canapé, fauteuil, table, lit, lampe, plante, îlot, escalier) au lieu de simples cubes. Si Sketchfab est connecté, les vrais assets GLTF/GLB autorisés restent prioritaires.

## Sketchfab

Le SOPHENIC Asset Engine reste découplé du provider. Le token Sketchfab est stocké côté Electron via safeStorage et n'est jamais retourné au renderer. Le provider vérifie le modèle, sa licence et son téléchargement avant cache/import.

Sans token ou si aucun asset licencié n'est disponible, Sophenic conserve la décision d'ameublement avec un fallback procédural explicite au lieu de prétendre qu'un asset Sketchfab a été importé.

## Vérification automatique

Après les actions, `runArchitectureQualityPass` vérifie notamment :

- niveaux cohérents
- escalier entre niveaux
- objets dans leur pièce
- ouvertures non bloquées grossièrement
- circulation et densité
- cohérence du modèle

Le chat affiche le score de vérification final et le nombre de corrections automatiques.

Ces vérifications sont des aides de conception et ne remplacent pas une validation réglementaire, structurelle, énergétique ou de sécurité réalisée par un professionnel habilité.

## Test recommandé

1. Ouvrir `Design → Architecture`.
2. Donner :

> Transforme cette maison actuelle en une villa contemporaine haut de gamme à deux étages. Ajoute un vrai escalier, plusieurs pièces intelligemment réparties, une palette chaleureuse, de beaux matériaux et meuble les espaces principaux. Choisis et place les meubles intelligemment, garde les portes et fenêtres libres, vérifie la circulation et corrige automatiquement ce qui ne va pas avant de finaliser.

3. Vérifier la timeline dans le chat : spinner → étapes vertes.
4. Passer en Intérieur.
5. Maintenir clic gauche et glisser : l'horizon doit rester droit.
6. Changer directement de pièce et de niveau depuis le sélecteur.
7. Passer en Extérieur et faire le tour complet de la villa.

## Validation effectuée

- `node scripts/test-sophenic-design.mjs` : OK
- `node scripts/test-sophenic.mjs` : OK
- `npm run verify:source` : OK
- compilation TypeScript stricte du noyau Design Architecture : OK

La validation graphique Electron/Three.js doit être confirmée sur la machine Windows cible disposant d'un vrai contexte GPU.
