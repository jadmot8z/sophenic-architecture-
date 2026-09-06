SOPHENIC DESIGN V8 — LANCEMENT RAPIDE

1) Dézipper le projet.
2) Installer Node.js 20 ou 22.
3) Ouvrir le dossier du projet.
4) Double-cliquer sur LANCER-SOPHENIC-AUTO.bat sur Windows.
   Le script va :
   - vérifier Node/npm
   - installer les dépendances si nécessaire
   - lancer les tests SOPHENIC
   - démarrer l’application Electron + Next.js

LANCEMENT MANUEL :
- npm install
- npm run test:sophenic
- npm run sophenic:start

FONCTIONS AJOUTÉES DANS CETTE VERSION :
- Intent Design V8 (brief texte + références visuelles)
- Route API /api/design/v8-intent
- Import d’images de référence dans le mode Architecture
- Différenciation palais majestueux vs villa moderne
- Stratégie Sketchfab stricte pour le mobilier réaliste

UTILISATION DANS L’APP :
- Crée un projet Architecture
- Clique sur “Références” pour ajouter des images d’inspiration
- Puis écris par exemple :
  • Crée un palais majestueux
  • Crée une villa moderne
- L’app construit le brief, l’intent, puis aménage avec assets/fallback cohérents.
