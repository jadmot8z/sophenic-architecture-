# SOPHENIC Architecture V7 — Fidelity & Luxury Interior

## Objectif

V7 conserve la navigation pièce par pièce d’Architecture V6 mais change le comportement de conception : Sophenic transforme d’abord la demande utilisateur en **brief de design structuré**, puis compose et vérifie les pièces en fonction de ce brief.

## Nouveautés

- Intent Design Parser V7 : style, ambiance, niveau de finition, palette, matériaux, priorités, contraintes, pièces ciblées et autonomie.
- Niveaux de finition : `light`, `balanced`, `rich`, `luxury`.
- Timeline liée au brief réel : compréhension → brief → audit → plan → actions → assets → contrôle → optimisation.
- Interior Composition Engine V7 :
  - compositions complètes par usage de pièce ;
  - mobilier principal + secondaire + décoration ;
  - dégagements explicites ;
  - tapis et suspensions traités comme couches décoratives/verticales ;
  - suppression d’un élément secondaire quand aucun placement propre n’existe.
- Asset ranking V7 :
  - priorité aux assets `photorealistic`, `PBR`, `realistic`, `staff picked` ;
  - bonus likes/views ;
  - pénalités fortes pour `low-poly`, `cartoon`, `voxel`, `prototype`, etc. ;
  - un mauvais asset est rejeté plutôt que préféré au fallback procédural.
- Matériaux supplémentaires : lin ivoire, velours taupe, verre fumé bronze, bronze patiné, pierre brune veinée.
- Fallback procédural enrichi :
  - coussins/plaids sur canapés ;
  - centre de table ;
  - bout de canapé ;
  - consoles décoratives ;
  - suspensions au plafond ;
  - lit plus habillé.
- Audit de finition par pièce : densité utile, décoration, diversité de matières et score de finition.
- Quality pass V7 : collisions, ouvertures, distances, niveau, escalier et avertissements de finition.

## Principes de placement

V7 vérifie notamment :

- aucune porte bloquée ;
- aucune fenêtre bloquée ;
- aucun meuble hors de sa pièce ;
- pas de chevauchement ;
- dégagement sémantique entre les meubles ;
- mobilier secondaire supprimé s’il ne rentre pas proprement ;
- cohérence du niveau/étage ;
- contrôle du score de finition pour les briefs `rich` et `luxury`.

## Sketchfab

Le token reste dans le coffre Electron. La sélection V7 recherche davantage de candidats et choisit le meilleur score de qualité/licence. Les modèles low-poly ou stylisés sont volontairement pénalisés lorsqu’un brief demande du réalisme.

## Test principal

Dans un nouveau projet Architecture :

> Transforme complètement cette maison en une villa contemporaine très haut de gamme, chaleureuse et réaliste. Je veux beaucoup plus de décoration, les meilleurs meubles réalistes disponibles, des textures riches, du noyer, du travertin, du verre et du laiton. Compose chaque pièce intelligemment, préserve la circulation, ne colle pas les meubles et vérifie puis corrige ton travail avant de terminer.

Vérifier ensuite le Salon en mode Intérieur / Doux.

## Lancement

Double-cliquer sur `LANCER-SOPHENIC-AUTO.bat`.

Le script :
1. vérifie Node/npm ;
2. installe les dépendances si nécessaire ;
3. prépare les assets Three.js ;
4. exécute `npm run test:sophenic` ;
5. lance `npm run sophenic:start`.
