# SOPHENIC Architecture Engine V3

## Navigation corrigée

- **Extérieur** : OrbitControls uniquement en mode extérieur, rotation 360° autour du bâtiment et zoom contraint.
- **Intérieur** : la caméra est fixe sur un point de navigation valide. Maintenir le clic gauche puis glisser tourne réellement la caméra à 360° sans déplacer sa position.
- Le moteur n'appelle plus `OrbitControls.update()` en intérieur, ce qui empêchait auparavant la rotation de rester appliquée.
- Le nom de la pièce devient un sélecteur : Salon, Cuisine, Chambre 1, etc. On peut aller directement dans n'importe quelle pièce.
- La barre Architecture possède aussi un sélecteur **Aller à** qui ouvre directement la pièce choisie en mode intérieur.
- ↑ / ↓ changent de point de navigation dans la pièce sans traverser les murs.

## Architecture plus cohérente

- Maison neuve : **0 meuble**.
- Dimensions recommandées selon l'usage : salon, cuisine, chambres, salles de bain, bureau, garage, terrasse.
- Les pièces remplissent un maillage contigu : elles partagent réellement leurs murs au lieu d'être séparées par des vides arbitraires.
- Portes, fenêtres, murs et points caméra sont recalculés après modification structurelle.

## Sophenic Architecte

Sophenic reçoit maintenant un audit géométrique du projet avant ses décisions :

- surface par pièce ;
- emprise du mobilier ;
- fenêtres ;
- portes ;
- connexions entre pièces ;
- problèmes de circulation ;
- priorités et recommandations.

Nouvelles actions IA :

- renommer une pièce ;
- vider une pièce ;
- supprimer un objet ;
- déplacer et orienter un objet ;
- ajouter une porte ou une fenêtre/baie ;
- modifier la hauteur des murs ;
- modifier la hauteur de plafond ;
- audit architectural instantané ;
- optimisation contextualisée avec la pièce active.

Les audits et simulations restent des outils de conception indicatifs et ne remplacent pas une validation professionnelle ou réglementaire.

## Phrases de test

1. `Crée une maison moderne avec un salon, une cuisine, trois chambres et deux salles de bain.`
2. Passe en **Intérieur**, maintiens le clic gauche et glisse dans toutes les directions.
3. Choisis directement **Chambre 2** dans le sélecteur de pièce.
4. `Fais un audit architectural complet de la pièce actuelle.`
5. `Optimise cette pièce pour la circulation, la lumière et l'usage sans changer sa fonction.`
6. `Ajoute une grande baie vitrée dans le salon si elle améliore la lumière naturelle.`
7. Avec Sketchfab configuré : `Meuble intelligemment le salon avec de vrais assets Sketchfab sans bloquer les portes ni les fenêtres.`
8. `Vide complètement le salon en gardant uniquement la structure.`
