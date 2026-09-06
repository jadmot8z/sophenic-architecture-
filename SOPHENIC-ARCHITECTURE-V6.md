# SOPHENIC Architecture V6 — Premium Room Experience

## Objectif

V6 conserve l'expérience validée : **Extérieur / Intérieur / Plan**, navigation **pièce par pièce**, sélection d'objets, timeline d'exécution IA, composition intérieure anti-collision et Asset Engine Sketchfab.

La priorité V6 est la qualité visuelle et la crédibilité de la visite : la vue isométrique n'est pas un objectif produit.

## Rendu Architecture V6

Le viewer Architecture utilise désormais un pipeline temps réel plus riche :

- Three.js WebGL avec tone mapping **ACES Filmic** ;
- environnement **PMREM + RoomEnvironment** pour les réflexions PBR ;
- **EffectComposer** ;
- **SSAO** pour renforcer les contacts mur/sol/meuble ;
- ombres `PCFSoftShadowMap` ;
- lumière hémisphérique + soleil directionnel + éclairage intérieur par pièce ;
- matériaux `MeshPhysicalMaterial` ;
- verre avec transmission ;
- marbre avec clearcoat ;
- tissus avec sheen ;
- textures procédurales déterministes pour bois, marbre, travertin, pierre, béton, enduit, tissu, tapis, cuir et céramique.

Les textures procédurales sont générées localement : aucune clé externe n'est nécessaire pour les matériaux de base.

## Bibliothèque de matériaux

La factory ajoute notamment :

- Chêne naturel ;
- Noyer fumé ;
- Marbre Calacatta clair ;
- Travertin ivoire ;
- Béton ciré chaud ;
- Enduit minéral ivoire ;
- Verre extra-clair ;
- Métal noir satiné ;
- Laiton brossé ;
- Bouclé sable ;
- Laine crème ;
- Cuir cognac ;
- Céramique blanche mate ;
- Pierre calcaire.

Les matériaux créés dynamiquement par Sophenic reçoivent aussi une catégorie de texture cohérente lorsque le nom permet de l'inférer.

## Mobilier procédural amélioré

Quand aucun asset Sketchfab licencié n'est disponible, le fallback n'est plus volontairement un simple cube. V6 possède des géométries détaillées pour les principales catégories :

- canapé avec base, assises, coussins, dossier, accoudoirs et pieds ;
- fauteuil ;
- chaise / tabouret ;
- table basse ;
- table de repas ;
- tapis ;
- lit avec matelas, tête de lit, oreillers et plaid ;
- penderie / bibliothèque ;
- bureau ;
- banquette ;
- meuble vasque ;
- douche ;
- WC ;
- meuble TV + écran ;
- lampadaire avec source lumineuse ;
- plante ;
- îlot de cuisine ;
- escalier contemporain avec marches, limon et garde-corps.

Les vrais assets GLTF/GLB restent prioritaires lorsque le provider Sketchfab est configuré et que la licence permet l'import.

## Finitions contextuelles des pièces

V6 ajoute des détails visuels légers qui ne modifient pas le plan :

- panneaux/slats en noyer et cadre dans un salon ;
- crédence pierre dans la cuisine ;
- surface minérale + miroir dans les salles d'eau ;
- cadres muraux dans salle à manger / bureau ;
- rideaux sur les grandes fenêtres ;
- plinthes autour des pièces ;
- spots plafonniers et éclairage chaud par pièce.

Une paroi choisie pour une finition décorative privilégie un côté avec peu d'ouvertures.

## Caméra intérieure

La navigation pièce par pièce est conservée.

V6 force :

- point principal au centre logique de la pièce ;
- hauteur d'œil : **1,62 m** ;
- horizon sans roulis ;
- FOV intérieur : **62°** pour réduire l'effet grand-angle ;
- pitch limité pour éviter les orientations irréalistes ;
- clic gauche maintenu + glisser pour regarder librement ;
- déplacement uniquement entre navigation nodes avec les flèches ;
- changement immédiat de pièce via le sélecteur supérieur ;
- plafond de la pièce active masqué dans la visite afin d'éviter les obstructions de caméra ;
- autres niveaux masqués en mode intérieur.

Les anciens projets sont migrés de manière non destructive vers les nouveaux points `Vue principale`.

## Ambiances

La toolbar Architecture expose :

- **Jour** ;
- **Doux** ;
- **Soir**.

Le choix affecte arrière-plan, exposition, lumière extérieure et éclairage intérieur. La transformation globale haut de gamme utilise `Doux` par défaut, sauf intention différente.

## Intelligence architecturale conservée et renforcée

V6 conserve le moteur de V5 :

- `furnish_room` pour composer une pièce comme un ensemble ;
- `optimize_room_layout` ;
- distances minimales entre meubles ;
- dégagements portes/fenêtres ;
- placement sémantique par rôle ;
- suppression d'un élément secondaire si aucun placement propre n'existe ;
- quality pass après transformation ;
- villa multi-niveaux ;
- escalier inter-étage ;
- timeline de réflexion/exécution ;
- sélection puis remplacement par asset Sketchfab quand possible.

Les objets générés par le moteur de composition portent `compositionEngine: "v6"` et `visualQuality: "premium"`.

## Limites réelles

V6 est un renderer temps réel, pas un moteur de path tracing hors-ligne. Le niveau final dépend fortement de la qualité des modèles 3D importés. Un fallback procédural détaillé ne peut pas reproduire la finesse d'un modèle professionnel sculpté/texturé.

L'Asset Engine ne contourne jamais les licences. Un modèle sans licence exploitable ou sans téléchargement autorisé n'est pas présenté comme un asset importé.

Les audits/simulations restent des aides de conception et ne constituent pas une validation d'architecte, d'ingénieur structure, énergétique ou réglementaire.

## Test recommandé

Créer un projet Architecture puis demander :

> Transforme complètement cette maison en une villa contemporaine haut de gamme à deux étages. Utilise une palette chaleureuse, du noyer, du travertin, du marbre, du verre et des tissus. Compose chaque pièce intelligemment, garde les passages et ouvertures libres, utilise de vrais assets 3D lorsqu'ils sont disponibles, puis vérifie les distances et corrige automatiquement les mauvais placements avant de terminer.

Ensuite vérifier :

1. `Intérieur` : caméra droite, vue principale centrée, clic-glisser ;
2. changement direct Salon → Cuisine → Chambre ;
3. `Jour / Doux / Soir` ;
4. matériaux/ombres/contacts ;
5. absence de collisions évidentes ;
6. timeline complète ;
7. objets Sketchfab attribués lorsque le token est configuré.

## Tests automatisés

La suite `npm run test:sophenic` vérifie notamment :

- maison sans mobilier au départ ;
- programme villa 2 niveaux ;
- composition complète du salon ;
- `compositionEngine: v6` ;
- absence de conflits de dégagement selon le moteur ;
- matériaux PBR disponibles ;
- `ambience=soft` + `renderQuality=high` sur transformation globale ;
- navigation nodes `Vue principale` à 1,62 m ;
- Asset Engine Sketchfab/licences ;
- modules historiques SOPHENIC non régressés.
