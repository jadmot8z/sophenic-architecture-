# SOPHENIC 23 — Correctif connecteurs multi-utilisateur

Ce paquet corrige la couche Connecteurs/Plugins sans embarquer les secrets éditeur dans Electron.

## Résultat visé

Pour GitHub et les fournisseurs OAuth (Vercel, Supabase, Cloudflare, Google/Firebase/Gmail/Drive/Calendar, Notion, Stripe, Shopify, WordPress), chaque utilisateur clique sur **Connecter**, autorise **son propre compte** sur la page officielle, puis revient dans SOPHENIC. Les jetons de cet utilisateur sont chiffrés par `electron.safeStorage` dans un coffre stable hors du dossier de version.

PostgreSQL, MySQL et MongoDB n'ont pas d'autorisation OAuth universelle : le bouton **Connecter** ouvre maintenant un formulaire SOPHENIC pour l'URI de connexion de l'utilisateur. L'URI est transmise au main process, un test de joignabilité réseau est effectué, puis elle est chiffrée dans le même coffre persistant.

## Corrections principales

- suppression du blocage artificiel « Connexion temporairement indisponible » ;
- chemin production sécurisé : Desktop → broker OAuth HTTPS SOPHENIC → fournisseur officiel → callback broker → callback Desktop ;
- aucun Client Secret fournisseur dans React/Electron en production ;
- broker multi-utilisateur pour 11 fournisseurs OAuth Desktop ;
- Shopify multi-boutiques : le domaine est fourni par chaque utilisateur et la signature HMAC de callback est vérifiée ;
- endpoint broker `/v1/oauth/providers` pour afficher précisément quels fournisseurs sont provisionnés ;
- stockage des tokens dans `%APPDATA%/SOPHENIC/connector-secrets` (Windows) afin de survivre aux nouvelles versions ;
- migration silencieuse depuis les anciens chemins `userData` ;
- écritures atomiques du coffre ;
- PostgreSQL/MySQL/MongoDB : saisie masquée de l'URI + test réseau + coffre chiffré ;
- correction du crash d'historique lorsque des messages `undefined`/mal formés étaient restaurés ;
- route de démarrage Electron corrigée sur `/desktop/agent`.

## Ce qui reste obligatoirement à faire une seule fois par l'éditeur

Le code ne peut pas créer à ta place des applications OAuth dans les comptes des fournisseurs. Pour une distribution à tous les utilisateurs, crée une application OAuth SOPHENIC chez chaque fournisseur puis place ses Client ID/Secrets **uniquement sur le serveur broker**.

Utilise :

```powershell
.\CONFIGURER-OAUTH-EDITEUR.ps1
```

Le script génère `oauth-broker/.env`, affiche toutes les URL de callback à enregistrer, et ne met jamais les secrets dans Electron.

Ensuite déploie `oauth-broker/` derrière une URL HTTPS publique, puis construis le Desktop avec uniquement :

```text
SOPHENIC_OAUTH_BROKER_URL=https://ton-domaine-broker
SOPHENIC_OAUTH_BROKER_DISTRIBUTION_KEY=...
SOPHENIC_OAUTH_LOOPBACK_PORT=43823
```

Les utilisateurs finaux n'auront aucune clé à saisir.

## Test local du projet

```powershell
npm install
npm run test:sophenic
npm run sophenic:start
```

Pour tester les fournisseurs OAuth réellement, le broker doit être déployé/configuré et les callbacks doivent être enregistrés chez les fournisseurs.

## Sécurité

Les anciens tokens/secrets partagés pendant le diagnostic ne sont pas intégrés à ce paquet. Ils doivent être révoqués/rotatés avant une mise en production.
