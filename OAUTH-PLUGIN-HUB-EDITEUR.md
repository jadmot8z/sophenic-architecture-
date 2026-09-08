# SOPHENIC 11 — Plugin Hub OAuth multi-utilisateur

## Contrat produit

L'utilisateur final voit uniquement **Connecter**, l'écran officiel du fournisseur, puis **Connecté**. Aucun `Client Secret`, token éditeur ou clé API de SOPHENIC n'est demandé dans React.

Le chemin production est :

`Electron → broker HTTPS SOPHENIC → fournisseur OAuth → callback broker → loopback Desktop → coffre safeStorage`

Les secrets de l'application SOPHENIC restent exclusivement sur le broker. Chaque utilisateur reçoit son propre token après consentement.

## Persistance entre versions

Les tokens des utilisateurs sont chiffrés avec `safeStorage` et stockés dans un coffre stable sous le répertoire applicatif utilisateur SOPHENIC, indépendant du dossier d'installation et du numéro de version. Les anciennes localisations de coffre sont migrées silencieusement à la première lecture.

## Action unique obligatoire côté SOPHENIC

1. Enregistrer une application OAuth SOPHENIC chez chaque fournisseur.
2. Déployer `oauth-broker/` derrière une URL HTTPS publique.
3. Enregistrer les callbacks `https://<broker>/oauth/<provider>/callback`.
4. Conserver les variables `OAUTH_*` uniquement dans le gestionnaire de secrets du broker.
5. Définir au build Desktop uniquement `SOPHENIC_OAUTH_BROKER_URL` et `SOPHENIC_OAUTH_BROKER_DISTRIBUTION_KEY`.

Utilise :

```powershell
.\CONFIGURER-OAUTH-EDITEUR.ps1
```

Puis déploie `oauth-broker/`.

## Callbacks

- `/oauth/vercel/callback`
- `/oauth/supabase/callback`
- `/oauth/cloudflare/callback`
- `/oauth/firebase/callback`
- `/oauth/gmail/callback`
- `/oauth/google-drive/callback`
- `/oauth/calendar/callback`
- `/oauth/notion/callback`
- `/oauth/stripe/callback`
- `/oauth/shopify/callback`
- `/oauth/wordpress/callback`

GitHub utilise le Device Flow officiel : le Client ID est public et aucun Client Secret GitHub n'est livré au Desktop.

## Shopify

Shopify est maintenant multi-boutiques : l'utilisateur indique seulement son domaine public `ma-boutique.myshopify.com` lors de la connexion. Le broker construit l'URL officielle de cette boutique, valide le HMAC du callback et conserve le Client Secret côté serveur.

## PostgreSQL / MySQL / MongoDB

Ces technologies n'exposent pas un consentement OAuth utilisateur universel comparable à Google ou Notion. SOPHENIC ouvre donc leur portail/documentation officielle au lieu d'afficher une fausse autorisation. Une vraie connexion à une base nécessite les identifiants propres à l'hébergeur de chaque utilisateur.

## Mode développement local

Le fallback direct vers les fournisseurs n'est autorisé que si :

`SOPHENIC_OAUTH_ALLOW_LOCAL_DEV=true`

Il ne doit jamais être activé dans une distribution publique.
