# SOPHENIC — Connecteurs officiels et modèle d'autorisation

> Version multi-utilisateur : les utilisateurs finaux ne saisissent aucun Client Secret/API key SOPHENIC. Les secrets éditeur restent dans `oauth-broker`.

## Development

### GitHub
- Device Flow : https://github.com/login/device
- OAuth Apps : https://github.com/settings/developers

SOPHENIC utilise un Client ID public et le Device Flow. Chaque utilisateur autorise son propre compte GitHub.

### Vercel
- Apps / Sign in with Vercel : https://vercel.com/docs/sign-in-with-vercel

Créer une App SOPHENIC une seule fois côté éditeur. Les utilisateurs autorisent ensuite leur propre compte.

### Supabase
- OAuth integration : https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration

Créer une OAuth App SOPHENIC dans l'organisation éditeur. Les tokens obtenus appartiennent aux utilisateurs qui autorisent l'intégration.

### Cloudflare
- OAuth : https://developers.cloudflare.com/fundamentals/oauth/

Créer un OAuth Client SOPHENIC côté éditeur.

### Firebase / Gmail / Drive / Calendar
- Google OAuth : https://developers.google.com/identity/protocols/oauth2

Utiliser un projet Google Cloud SOPHENIC et un client OAuth configuré avec les callbacks HTTPS du broker. Activer les APIs nécessaires et l'écran de consentement approprié.

## Productivity

### Notion
- Public connections : https://developers.notion.com/guides/get-started/public-connections

Utiliser une **Public Connection**. Un token `ntn_...` d'intégration interne n'est pas le mécanisme multi-utilisateur.

## Business

### Stripe
- Stripe Connect OAuth : https://docs.stripe.com/connect/oauth-reference

Utiliser le Client ID Stripe Connect de SOPHENIC et la clé secrète de plateforme uniquement côté broker.

### Shopify
- App authentication : https://shopify.dev/docs/apps/build/authentication-authorization

Créer une App Shopify SOPHENIC. Chaque marchand indique son domaine public `*.myshopify.com`, puis Shopify affiche l'écran officiel d'autorisation. Le Client Secret reste côté broker.

### WordPress.com
- OAuth2 : https://developer.wordpress.com/docs/api/oauth2/

Créer une application WordPress.com SOPHENIC une seule fois.

## Data

PostgreSQL, MySQL/MariaDB et MongoDB génériques ne disposent pas d'un consentement OAuth universel comparable à Notion/Google. Une connexion réelle dépend de l'URI et des identifiants fournis par l'hébergeur de chaque utilisateur. SOPHENIC ne doit pas faire passer une simple page de documentation pour une autorisation OAuth réussie.
