import type { PluginId } from "./plugin-vault";
import { runtimeEnv } from "./runtime-env";

export type OAuthPluginId = Exclude<PluginId, "github" | "postgresql" | "mysql" | "mongodb">;

export type OAuthProviderConfig = {
  id: OAuthPluginId;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientIdEnv: string;
  clientSecretEnv?: string;
  scopes: string[];
  pkce?: boolean;
  basicTokenAuth?: boolean;
  tokenClientSecretField?: string;
  extraAuthorize?: Record<string, string>;
  extraToken?: Record<string, string>;
  shopDomainEnv?: string;
  jsonTokenBody?: boolean;
};

const env = (name: string): string => runtimeEnv(name);
const GOOGLE_BASE_SCOPES = ["openid", "email", "profile"];

export class OAuthProviderRegistry {
  static get(id: OAuthPluginId, options?: Record<string, string>): OAuthProviderConfig {
    const configs: Record<OAuthPluginId, OAuthProviderConfig> = {
      vercel: {
        id, authorizationEndpoint: "https://vercel.com/oauth/authorize", tokenEndpoint: "https://api.vercel.com/login/oauth/token",
        clientIdEnv: "SOPHENIC_OAUTH_VERCEL_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_VERCEL_CLIENT_SECRET",
        scopes: ["openid", "email", "profile", "offline_access"], pkce: true
      },
      supabase: {
        id, authorizationEndpoint: "https://api.supabase.com/v1/oauth/authorize", tokenEndpoint: "https://api.supabase.com/v1/oauth/token",
        clientIdEnv: "SOPHENIC_OAUTH_SUPABASE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_SUPABASE_CLIENT_SECRET",
        scopes: [], pkce: true, basicTokenAuth: true
      },
      cloudflare: {
        id, authorizationEndpoint: "https://dash.cloudflare.com/oauth2/auth", tokenEndpoint: "https://dash.cloudflare.com/oauth2/token",
        clientIdEnv: "SOPHENIC_OAUTH_CLOUDFLARE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_CLOUDFLARE_CLIENT_SECRET",
        scopes: (env("SOPHENIC_OAUTH_CLOUDFLARE_SCOPES") || "openid profile email").split(/\s+/), pkce: true
      },
      firebase: {
        id, authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth", tokenEndpoint: "https://oauth2.googleapis.com/token",
        clientIdEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_SECRET",
        scopes: [...GOOGLE_BASE_SCOPES, "https://www.googleapis.com/auth/cloud-platform"], pkce: true,
        extraAuthorize: { access_type: "offline", prompt: "consent" }
      },
      gmail: {
        id, authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth", tokenEndpoint: "https://oauth2.googleapis.com/token",
        clientIdEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_SECRET",
        scopes: [...GOOGLE_BASE_SCOPES, "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"], pkce: true,
        extraAuthorize: { access_type: "offline", prompt: "consent" }
      },
      "google-drive": {
        id, authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth", tokenEndpoint: "https://oauth2.googleapis.com/token",
        clientIdEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_SECRET",
        scopes: [...GOOGLE_BASE_SCOPES, "https://www.googleapis.com/auth/drive.file"], pkce: true,
        extraAuthorize: { access_type: "offline", prompt: "consent" }
      },
      calendar: {
        id, authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth", tokenEndpoint: "https://oauth2.googleapis.com/token",
        clientIdEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_GOOGLE_CLIENT_SECRET",
        scopes: [...GOOGLE_BASE_SCOPES, "https://www.googleapis.com/auth/calendar.events"], pkce: true,
        extraAuthorize: { access_type: "offline", prompt: "consent" }
      },
      notion: {
        id, authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize", tokenEndpoint: "https://api.notion.com/v1/oauth/token",
        clientIdEnv: "SOPHENIC_OAUTH_NOTION_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_NOTION_CLIENT_SECRET",
        scopes: [], basicTokenAuth: true, jsonTokenBody: true, extraAuthorize: { owner: "user" }
      },
      stripe: {
        id, authorizationEndpoint: "https://connect.stripe.com/oauth/authorize", tokenEndpoint: "https://connect.stripe.com/oauth/token",
        clientIdEnv: "SOPHENIC_OAUTH_STRIPE_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_STRIPE_SECRET_KEY",
        scopes: [env("SOPHENIC_OAUTH_STRIPE_SCOPE") || "read_write"], tokenClientSecretField: "client_secret"
      },
      shopify: {
        id, authorizationEndpoint: "", tokenEndpoint: "",
        clientIdEnv: "SOPHENIC_OAUTH_SHOPIFY_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_SHOPIFY_CLIENT_SECRET",
        scopes: (env("SOPHENIC_OAUTH_SHOPIFY_SCOPES") || "read_products,read_orders,write_products").split(",").map((value) => value.trim()).filter(Boolean),
        shopDomainEnv: "SOPHENIC_OAUTH_SHOPIFY_SHOP_DOMAIN", extraToken: { expiring: "1" }
      },
      wordpress: {
        id, authorizationEndpoint: "https://public-api.wordpress.com/oauth2/authorize", tokenEndpoint: "https://public-api.wordpress.com/oauth2/token",
        clientIdEnv: "SOPHENIC_OAUTH_WORDPRESS_CLIENT_ID", clientSecretEnv: "SOPHENIC_OAUTH_WORDPRESS_CLIENT_SECRET",
        scopes: ["global"], tokenClientSecretField: "client_secret"
      }
    };
    const config = { ...configs[id] };
    if (id === "shopify") {
      let shop = String(options?.shopDomain || env(config.shopDomainEnv || "")).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (shop && !shop.includes(".")) shop = `${shop}.myshopify.com`;
      if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
        throw new Error("Domaine Shopify invalide. Utilise par exemple ma-boutique.myshopify.com.");
      }
      config.authorizationEndpoint = `https://${shop}/admin/oauth/authorize`;
      config.tokenEndpoint = `https://${shop}/admin/oauth/access_token`;
    }
    return config;
  }

  static list(): OAuthProviderConfig[] {
    const ids: OAuthPluginId[] = ["vercel", "supabase", "cloudflare", "firebase", "gmail", "google-drive", "calendar", "notion", "stripe", "shopify", "wordpress"];
    return ids.flatMap((id) => { try { return [this.get(id)]; } catch { return []; } });
  }
}
