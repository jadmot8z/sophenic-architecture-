# SOPHENIC 10.2.0 — Plugins, Grande Mémoire & Workspace

Date : 22 août 2026

## Plugins centralisés

La page **Plugins** devient le centre unique des comptes et services externes :

- Development : GitHub, Vercel, Supabase, Cloudflare, Firebase
- Productivity : Gmail, Google Drive, Calendar, Notion
- Business : Stripe, Shopify, WordPress
- Data : PostgreSQL, MySQL, MongoDB

Les secrets sont conservés avec `Electron safeStorage`. SOPHENIC distingue **Configuré** de **Connecté** et ne passe au vert qu'après validation quand un test réseau est disponible.

GitHub conserve le Device Flow officiel et accepte aussi un PAT manuel. Le champ PAT refuse explicitement les Client Secrets OAuth. Vercel utilise un Personal Access Token `vcp_…`.

## Paramètres réorganisés

Les réglages internes de l'agent (fournisseurs IA, personnalisation, mémoire, runtime/capacités) sont désormais dans **Paramètres**. Les comptes externes et identifiants de services sont dans **Plugins**.

## Grande mémoire SOPHENIC

- mémoire locale persistante activable/désactivable ;
- capacité réglable jusqu'à 20 000 souvenirs ;
- souvenirs manuels épinglés ;
- mémorisation automatique de contexte utile ;
- injection dans SOPHENIC Brain et SOPHENIC Code sans exposer les secrets des plugins ;
- suppression individuelle ou remise à zéro complète.

## Historique des chats

**Nouvelle session** archive la conversation active avant d'ouvrir une conversation vide. La page **Historique** permet de rechercher, rouvrir et supprimer les conversations conservées.

## Bibliothèque

Nouvelle page **Bibliothèque** pour indexer les images, fichiers, exports et projets créés/ouverts par SOPHENIC. Les captures du navigateur, images générées et principaux artefacts écrits par SOPHENIC Code sont ajoutés automatiquement.

## Planification

Nouvelle page **Planification** avec colonnes À faire / En cours / Terminé pour conserver les prochaines actions et tâches de projet.

## SOPHENIC Code + plugins

Le runtime Code reçoit la liste des plugins configurés et les noms de variables d'environnement disponibles, sans jamais recevoir les valeurs secrètes dans le prompt. Les commandes exécutées dans le workspace reçoivent les secrets nécessaires via l'environnement du processus.

## Sécurité

- secrets chiffrés avec `safeStorage` ;
- aucun secret rendu au frontend après enregistrement ;
- aucune clé intégrée dans le ZIP ;
- avertissements explicites pour les clés backend (Supabase, Firebase, Stripe, bases de données) ;
- Device Flow GitHub sans Client Secret dans l'application Desktop.
