# SOPHENIC Architecture V5 — Interior Composition Engine

V5 corrige le défaut principal de V4 : l'IA ne place plus une succession de meubles indépendants sans relation spatiale.

## Nouveau moteur de composition intérieure

- Nouvelle action `furnish_room` pour aménager une pièce comme un ensemble cohérent.
- Nouvelle action `optimize_room_layout` pour corriger un aménagement trop serré.
- Templates sémantiques pour salon, salle à manger, chambre, cuisine, bureau, salle de bain et hall.
- Relations fonctionnelles : canapé ↔ table basse ↔ fauteuils ↔ meuble TV ; lit ↔ chevets ↔ banquette ; table ↔ chaises ; îlot ↔ tabourets.
- Distances minimales entre meubles.
- Dégagement spécifique des portes et fenêtres.
- Rejet automatique d'un meuble impossible à placer proprement.
- Suppression des éléments secondaires plutôt que chevauchement forcé.
- Audit V5 avec conflits de distance entre meubles.

## Transformation globale

Une demande globale de maison/villa produit maintenant un programme coordonné :

1. structure multi-niveaux ;
2. escalier ;
3. style/palette/matériaux ;
4. ouvertures principales ;
5. composition intelligente de chaque pièce ;
6. enrichissement Sketchfab des objets générés ;
7. vérification géométrique et corrections ;
8. résultat final annulable/versionnable.

## Asset Engine

Les objets créés par le moteur de composition conservent une requête d'asset dans leurs métadonnées. Une fois la composition géométrique validée, SOPHENIC peut rechercher et mettre en cache les assets Sketchfab licenciés sans perdre les positions calculées.

## Rendu procédural amélioré

- escalier contemporain à marches fines, limon et garde-corps ;
- chaise/tabouret ;
- tapis ;
- penderie/bibliothèque ;
- bureau ;
- banquette ;
- meuble vasque ;
- douche vitrée ;
- WC ;
- mobilier V4 conservé et amélioré.

## Validation

- `node scripts/test-sophenic-design.mjs` : OK
- `node scripts/test-sophenic.mjs` : OK
- `node scripts/verify-source.mjs` : OK
- noyau Design compilé en TypeScript strict dans la suite de tests.

Les calculs architecturaux et simulations restent des outils de conception et ne constituent pas une validation réglementaire, structurelle ou énergétique professionnelle.
