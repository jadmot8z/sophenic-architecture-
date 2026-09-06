# SOPHENIC 10.0.3 — Connexions développeur professionnelles

## GitHub
- Bouton **Connecter GitHub** basé sur le Device Flow officiel GitHub.
- Aucun Client Secret OAuth n'est requis dans l'application Desktop.
- Le code d'autorisation est copié dans le presse-papiers et GitHub s'ouvre sur `https://github.com/login/device`.
- Un PAT GitHub peut aussi être saisi manuellement (`github_pat_...` ou `ghp_...`).
- Un Client Secret collé dans le champ PAT est refusé avec un message explicite.
- Les jetons validés sont chiffrés avec Electron `safeStorage`.

## Vercel
- Bouton **Connecter Vercel** ouvrant la page officielle Vercel Account Tokens quand aucun token n'est enregistré.
- Saisie directe d'un PAT Vercel `vcp_...` dans Paramètres.
- Validation réelle du token contre l'API Vercel avant stockage.
- Résolution d'URL améliorée : URL `*.vercel.app` avec chemin/query et URL de projet Vercel Dashboard.
- Recherche automatique du scope équipe lorsque le déploiement n'est pas dans le compte personnel.
- Test d'URL Vercel directement depuis Paramètres.
- Récupération des événements/logs de build via l'API Vercel avec fallback CLI.

## SOPHENIC Code
- Barre **Plugins** visible en haut en mode Code.
- GitHub : clic → autorisation officielle GitHub.
- Vercel : clic → page officielle de connexion/token si non connecté, Dashboard si connecté.
- Indicateur de statut vert/gris pour chaque service.

## Sécurité
- Aucun secret n'est journalisé.
- Les tokens Desktop sont protégés par `safeStorage`.
- `.env.local` reste facultatif pour les connexions Desktop.
- Aucun compte Supabase n'est requis pour GitHub/Vercel Desktop.
