# SOPHENIC OAuth Broker — multi-utilisateur

Composant confidentiel côté éditeur. Les `client_secret` des fournisseurs vivent ici et **ne sont jamais** embarqués dans Electron ou exposés à React.

## Ce que voit l'utilisateur final

`Connecter → page officielle du fournisseur → Autoriser SOPHENIC → retour automatique dans SOPHENIC → Connecté`

Chaque utilisateur obtient son propre access token. Le Desktop le conserve dans `safeStorage` dans un coffre utilisateur stable qui survit aux mises à jour de SOPHENIC.

## Provisionnement unique côté éditeur

1. Créer une application OAuth **SOPHENIC** chez chaque fournisseur.
2. Déployer ce service derrière une URL HTTPS publique, par exemple `https://connect.sophenic.ai`.
3. Enregistrer chez chaque fournisseur le callback correspondant :
   `https://connect.sophenic.ai/oauth/<provider>/callback`.
4. Remplir `oauth-broker/.env` avec les `OAUTH_*_CLIENT_ID` / `OAUTH_*_CLIENT_SECRET`.
5. Construire le Desktop en lui donnant uniquement :
   - `SOPHENIC_OAUTH_BROKER_URL`
   - `SOPHENIC_OAUTH_BROKER_DISTRIBUTION_KEY`
   - éventuellement `SOPHENIC_OAUTH_LOOPBACK_PORT`

Le script `../CONFIGURER-OAUTH-EDITEUR.ps1` prépare le `.env` et affiche tous les callbacks.

## Fournisseurs

- Vercel App
- Supabase OAuth App (Management API)
- Cloudflare OAuth Client
- Google OAuth (Firebase, Gmail, Drive, Calendar)
- Notion Public Connection
- Stripe Connect
- Shopify App
- WordPress.com OAuth App

GitHub utilise déjà le Device Flow officiel côté Desktop et n'a pas besoin d'un Client Secret dans l'application.

### Shopify multi-boutiques

Le broker ne contient plus un domaine Shopify unique. Chaque utilisateur saisit uniquement son domaine public `*.myshopify.com` au moment de cliquer sur **Connecter**. Le Client Secret reste côté broker. Le callback Shopify est validé avec HMAC avant l'échange du code.

## Endpoints du broker

- `GET /health`
- `GET /v1/oauth/providers` — état de provisionnement, sans révéler de secret
- `POST /v1/oauth/sessions`
- `GET /v1/oauth/sessions/{session_id}`
- `GET /oauth/{provider}/callback`
- `POST /v1/oauth/refresh`

Le ticket de remise du token est à usage unique. Les sessions expirent rapidement et sont conservées en mémoire dans cette version à un worker. Pour plusieurs workers, remplace le store mémoire par Redis sans changer le contrat HTTP.

## Production

Le démarrage échoue si l'URL publique n'utilise pas HTTPS ou si la clé de distribution fait moins de 32 caractères. Les tokens et Client Secrets ne sont jamais écrits dans les logs.
