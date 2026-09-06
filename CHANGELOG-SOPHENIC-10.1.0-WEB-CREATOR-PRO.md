# SOPHENIC 10.1.0 — Web Creator Pro

Cette version renforce spécifiquement SOPHENIC Code pour la création et la refonte de sites web professionnels.

## Problème corrigé

Une demande ouverte comme « crée un site de voyage et mets-le sur ce projet Vercel » pouvait auparavant produire une page techniquement valide mais visuellement pauvre (HTML quasi brut, très peu de contenu) puis la déployer parce que le build avait réussi.

## Nouveau comportement

- Les créations de sites sont automatiquement classées comme tâches Frontend à haute exigence et le mode Auto est promu vers Deep.
- SOPHENIC conserve le contexte récent de la conversation Code pour comprendre « ce projet », « cette URL », « comme avant », etc. Les tokens développeur présents dans l'historique sont masqués avant envoi au modèle.
- Le modèle actif reçoit un standard **Web Creator Pro** : direction artistique, architecture multi-fichiers, contenu réaliste, responsive, accessibilité, SEO et interactions.
- `website.audit` inspecte le code source et bloque les sites trop pauvres : rendu navigateur par défaut, trop peu de sections, absence de responsive, manque de style, manque de contenu ou architecture trop simpliste.
- `browser.audit` vérifie réellement le site rendu en desktop (1440×1000) et mobile (390×844), y compris débordements horizontaux et erreurs JavaScript/console.
- Une tâche de déploiement Vercel ne peut plus être déclarée terminée sans projet lié, déploiement réussi, URL `*.vercel.app` réelle et audit live réussi.
- Le moteur prend une capture finale du site déployé dans `.sophenic/screenshots/`.
- Vercel peut lister les projets accessibles, inspecter une URL et lier le workspace au bon projet avant déploiement.
- Une revue indépendante est demandée en mode Deep après les Quality Gates.

## Quality Gates

Pour une création Web professionnelle :

1. `project.verify` — installation, typecheck, tests, lint et build disponibles.
2. `website.audit` — score source minimum 80/100 et aucune détection critique de page brute.
3. `browser.audit` — score live minimum 78/100, aucune erreur de page et aucun overflow mobile.
4. revue indépendante — design, UX, complétude et respect du brief.

Si un gate échoue, SOPHENIC doit corriger le projet existant et revérifier avant livraison.

## Connexions développeur

Les corrections de SOPHENIC 10.0.3 restent présentes :

- GitHub Desktop : Device Flow officiel, sans Client Secret embarqué.
- GitHub PAT manuel : uniquement `github_pat_...` ou `ghp_...`.
- Vercel : Personal Access Token `vcp_...`, validé par l'API puis chiffré avec Electron `safeStorage`.
- Plugins GitHub/Vercel accessibles depuis SOPHENIC Code.
