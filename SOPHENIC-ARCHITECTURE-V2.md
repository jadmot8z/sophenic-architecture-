# SOPHENIC Architecture Engine V2

## Expérience

Un nouveau projet **Architecture** démarre avec une maison structurelle vide : pièces nommées, murs, sols, plafonds, portes et fenêtres. Aucun canapé, lit, table, plante ou luminaire décoratif n'est ajouté automatiquement.

La vue Architecture propose trois surfaces contextuelles :

- **Extérieur** : caméra orbitale 360° autour du bâtiment, zoom borné et recentrage.
- **Intérieur** : caméra à hauteur humaine dans une pièce nommée. La souris sert uniquement à regarder. Les flèches haut/bas déplacent la caméra entre des `navigationNodes` valides de la pièce ; les flèches gauche/droite tournent le regard. Les flèches de pièce en haut passent à la pièce précédente/suivante.
- **Plan** : édition structurelle 2D (pièces, murs, portes, fenêtres, escalier et cotes).

Les pièces possèdent `connections`, `navigationNodes` et `defaultNavigationNodeId`. L'ordre de visite est calculé à partir de l'adjacence réelle des pièces quand elle existe.

## SOPHENIC Asset Engine

Le renderer ne parle pas directement à Sketchfab. Le chemin est :

`Sophenic Design -> IPC de confiance -> DesignAssetEngine -> SketchfabProvider -> cache local -> viewer Three.js`

`SketchfabProvider` expose les opérations de recherche, lecture de détails, résolution du téléchargement, téléchargement et cache. Cette façade permet d'ajouter plus tard Poly Haven ou une bibliothèque locale sans modifier le copilote Design.

### Sécurité du token

Dans l'application : **Paramètres -> 3D Assets -> Sketchfab**.

Le token :

1. est validé auprès de Sketchfab avant remplacement du secret existant ;
2. est chiffré par le coffre Electron `safeStorage` déjà utilisé par SOPHENIC ;
3. n'est jamais renvoyé au renderer ;
4. n'est jamais écrit dans un projet Design ;
5. n'est jamais inclus dans les logs applicatifs.

Le cache se trouve dans les données utilisateur Electron, sous `design-assets/sketchfab`.

## Import des modèles

SOPHENIC recherche uniquement des modèles déclarés téléchargeables. Avant import, le main process relit les métadonnées du modèle et exige une licence explicite. Un résultat sans licence n'est pas importé automatiquement.

Formats pris en charge : GLTF/GLB, ressources binaires/images associées, Meshopt et Draco. Les matériaux/textures du modèle sont conservés autant que possible. Un modèle externe conserve ses proportions ; les dimensions SOPHENIC servent d'enveloppe de placement.

Le moteur limite la taille du téléchargement, la taille décompressée, le nombre de fichiers et la taille du bundle envoyé au renderer.

## Placement

Avant l'ajout, SOPHENIC cherche une position à l'intérieur de la pièce et vérifie une enveloppe de collision simple avec les objets déjà présents. S'il ne trouve pas de position valide, l'objet n'est pas ajouté au hasard.

Un objet sélectionné dans la scène peut être déplacé par pas, tourné, redimensionné ou supprimé depuis les contrôles contextuels. Les déplacements refusent une position qui sort de la pièce ou entre en collision avec un autre objet.

## Commandes de test

Création :

> Crée une maison moderne avec un salon, une cuisine, trois chambres et deux salles de bain.

Le résultat doit contenir sept pièces nommées et zéro meuble.

Après avoir configuré Sketchfab :

> Meuble uniquement le salon dans un style moderne haut de gamme. Utilise un canapé, une table basse, deux fauteuils, un meuble TV, une lampe et une plante. Garde une circulation confortable et ne bloque aucune porte ni fenêtre.

SOPHENIC doit afficher les étapes de recherche/cache puis ajouter uniquement les assets réellement récupérés. En cas d'asset indisponible ou de licence manquante, le message doit le signaler au lieu d'afficher un faux meuble.

## Limites

Le placement est géométrique et volontairement conservateur ; ce n'est pas un solveur physique/BIM. Les simulations Design restent indicatives et ne remplacent aucune validation réglementaire ou professionnelle.
