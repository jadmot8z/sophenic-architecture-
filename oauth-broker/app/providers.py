from __future__ import annotations

import base64
import os
import re
from dataclasses import dataclass, field
from urllib.parse import urlencode

import httpx


SHOP_RE = re.compile(r"^[a-z0-9][a-z0-9-]*\.myshopify\.com$", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class Provider:
    id: str
    authorize_url: str
    token_url: str
    client_id_env: str
    client_secret_env: str
    scopes: tuple[str, ...] = ()
    pkce: bool = True
    basic_auth: bool = False
    json_body: bool = False
    authorize_extra: dict[str, str] = field(default_factory=dict)
    token_secret_field: str = "client_secret"
    token_extra: dict[str, str] = field(default_factory=dict)
    include_authorization_grant_type: bool = True
    shop_domain: str = ""

    @property
    def client_id(self) -> str:
        return os.getenv(self.client_id_env, "").strip()

    @property
    def client_secret(self) -> str:
        return os.getenv(self.client_secret_env, "").strip()

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


GOOGLE_SCOPES = ("openid", "email", "profile")
PROVIDERS: dict[str, Provider] = {
    "vercel": Provider(
        "vercel", "https://vercel.com/oauth/authorize", "https://api.vercel.com/login/oauth/token",
        "OAUTH_VERCEL_CLIENT_ID", "OAUTH_VERCEL_CLIENT_SECRET",
        ("openid", "email", "profile", "offline_access")
    ),
    "supabase": Provider(
        "supabase", "https://api.supabase.com/v1/oauth/authorize", "https://api.supabase.com/v1/oauth/token",
        "OAUTH_SUPABASE_CLIENT_ID", "OAUTH_SUPABASE_CLIENT_SECRET", basic_auth=True
    ),
    "cloudflare": Provider(
        "cloudflare", "https://dash.cloudflare.com/oauth2/auth", "https://dash.cloudflare.com/oauth2/token",
        "OAUTH_CLOUDFLARE_CLIENT_ID", "OAUTH_CLOUDFLARE_CLIENT_SECRET",
        tuple(filter(None, os.getenv("OAUTH_CLOUDFLARE_SCOPES", "openid profile email").split()))
    ),
    "firebase": Provider(
        "firebase", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
        "OAUTH_GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_SECRET",
        GOOGLE_SCOPES + ("https://www.googleapis.com/auth/cloud-platform",),
        authorize_extra={"access_type": "offline", "prompt": "consent"}
    ),
    "gmail": Provider(
        "gmail", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
        "OAUTH_GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_SECRET",
        GOOGLE_SCOPES + ("https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"),
        authorize_extra={"access_type": "offline", "prompt": "consent"}
    ),
    "google-drive": Provider(
        "google-drive", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
        "OAUTH_GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_SECRET",
        GOOGLE_SCOPES + ("https://www.googleapis.com/auth/drive.file",),
        authorize_extra={"access_type": "offline", "prompt": "consent"}
    ),
    "calendar": Provider(
        "calendar", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
        "OAUTH_GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_SECRET",
        GOOGLE_SCOPES + ("https://www.googleapis.com/auth/calendar.events",),
        authorize_extra={"access_type": "offline", "prompt": "consent"}
    ),
    "notion": Provider(
        "notion", "https://api.notion.com/v1/oauth/authorize", "https://api.notion.com/v1/oauth/token",
        "OAUTH_NOTION_CLIENT_ID", "OAUTH_NOTION_CLIENT_SECRET",
        pkce=False, basic_auth=True, json_body=True, authorize_extra={"owner": "user"}
    ),
    "stripe": Provider(
        "stripe", "https://connect.stripe.com/oauth/authorize", "https://connect.stripe.com/oauth/token",
        "OAUTH_STRIPE_CLIENT_ID", "OAUTH_STRIPE_SECRET_KEY",
        (os.getenv("OAUTH_STRIPE_SCOPE", "read_write").strip() or "read_write",),
        pkce=False
    ),
    "wordpress": Provider(
        "wordpress", "https://public-api.wordpress.com/oauth2/authorize", "https://public-api.wordpress.com/oauth2/token",
        "OAUTH_WORDPRESS_CLIENT_ID", "OAUTH_WORDPRESS_CLIENT_SECRET", ("global",), pkce=False
    ),
}


def normalize_shop_domain(value: str) -> str:
    shop = (value or "").strip().lower()
    shop = shop.removeprefix("https://").removeprefix("http://").split("/", 1)[0]
    if shop and "." not in shop:
        shop = f"{shop}.myshopify.com"
    if not SHOP_RE.fullmatch(shop):
        raise ValueError("Domaine Shopify invalide. Utilise par exemple ma-boutique.myshopify.com.")
    return shop


def provider(provider_id: str, options: dict[str, str] | None = None) -> Provider:
    if provider_id == "shopify":
        shop = normalize_shop_domain(str((options or {}).get("shopDomain", "")))
        scopes = tuple(
            value.strip()
            for value in os.getenv("OAUTH_SHOPIFY_SCOPES", "read_products,read_orders,write_products").split(",")
            if value.strip()
        )
        return Provider(
            "shopify",
            f"https://{shop}/admin/oauth/authorize",
            f"https://{shop}/admin/oauth/access_token",
            "OAUTH_SHOPIFY_CLIENT_ID",
            "OAUTH_SHOPIFY_CLIENT_SECRET",
            scopes,
            pkce=False,
            token_extra={"expiring": "1"},
            include_authorization_grant_type=False,
            shop_domain=shop,
        )
    if provider_id not in PROVIDERS:
        raise ValueError("Fournisseur OAuth inconnu")
    return PROVIDERS[provider_id]


def supported_provider_ids() -> tuple[str, ...]:
    return (*PROVIDERS.keys(), "shopify")


def provider_readiness(provider_id: str) -> dict[str, object]:
    try:
        if provider_id == "shopify":
            client_id = os.getenv("OAUTH_SHOPIFY_CLIENT_ID", "").strip()
            secret = os.getenv("OAUTH_SHOPIFY_CLIENT_SECRET", "").strip()
            ready = bool(client_id and secret)
        else:
            item = provider(provider_id)
            ready = item.configured
        return {
            "configured": ready,
            "detail": "Prêt" if ready else "Application OAuth SOPHENIC non provisionnée côté serveur",
        }
    except Exception as exc:
        return {"configured": False, "detail": str(exc)}


def authorization_url(item: Provider, redirect_uri: str, state: str, challenge: str) -> str:
    if not item.configured:
        raise RuntimeError(f"{item.id}: l'application OAuth SOPHENIC n'est pas provisionnée côté serveur")
    params = {
        "client_id": item.client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state,
        **item.authorize_extra,
    }
    if item.scopes:
        params["scope"] = ",".join(item.scopes) if item.id == "shopify" else " ".join(item.scopes)
    if item.pkce:
        params.update({"code_challenge": challenge, "code_challenge_method": "S256"})
    return f"{item.authorize_url}?{urlencode(params)}"


async def exchange(item: Provider, *, code: str, redirect_uri: str, verifier: str) -> dict:
    values: dict[str, str] = {"code": code, "redirect_uri": redirect_uri}
    if item.include_authorization_grant_type:
        values["grant_type"] = "authorization_code"
    if item.pkce:
        values["code_verifier"] = verifier
    values.update(item.token_extra)

    headers = {"Accept": "application/json"}
    if item.basic_auth:
        headers["Authorization"] = "Basic " + base64.b64encode(f"{item.client_id}:{item.client_secret}".encode()).decode()
    else:
        values["client_id"] = item.client_id
        values[item.token_secret_field] = item.client_secret
    if item.id == "notion":
        headers["Notion-Version"] = "2026-03-11"

    kwargs = {"json": values} if item.json_body else {"data": values}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(item.token_url, headers=headers, **kwargs)
    try:
        payload = response.json()
    except Exception:
        payload = {"error": response.text[:500]}
    if response.is_error or not payload.get("access_token"):
        raise RuntimeError(str(payload.get("error_description") or payload.get("error") or f"OAuth HTTP {response.status_code}"))
    return payload


async def refresh(item: Provider, refresh_token: str) -> dict:
    values: dict[str, str] = {"grant_type": "refresh_token", "refresh_token": refresh_token}
    headers = {"Accept": "application/json"}
    if item.basic_auth:
        headers["Authorization"] = "Basic " + base64.b64encode(f"{item.client_id}:{item.client_secret}".encode()).decode()
    else:
        values["client_id"] = item.client_id
        values[item.token_secret_field] = item.client_secret
    if item.id == "shopify":
        values["client_secret"] = item.client_secret

    kwargs = {"json": values} if item.json_body else {"data": values}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(item.token_url, headers=headers, **kwargs)
    try:
        payload = response.json()
    except Exception:
        payload = {"error": response.text[:500]}
    if response.is_error or not payload.get("access_token"):
        raise RuntimeError(str(payload.get("error_description") or payload.get("error") or f"OAuth HTTP {response.status_code}"))
    return payload


async def account_label(provider_id: str, token: str, token_payload: dict, *, options: dict[str, str] | None = None) -> str:
    if provider_id == "notion":
        return str(token_payload.get("workspace_name") or "Notion")
    if provider_id == "stripe":
        return str(token_payload.get("stripe_user_id") or "Stripe")
    if provider_id == "shopify":
        try:
            return normalize_shop_domain(str((options or {}).get("shopDomain", "")))
        except Exception:
            return "Shopify"
    try:
        if provider_id in {"gmail", "google-drive", "calendar", "firebase"}:
            url = "https://openidconnect.googleapis.com/v1/userinfo"
        elif provider_id == "supabase":
            url = "https://api.supabase.com/v1/organizations"
        elif provider_id == "cloudflare":
            url = "https://dash.cloudflare.com/oauth2/userinfo"
        elif provider_id == "vercel":
            url = "https://api.vercel.com/login/oauth/userinfo"
        elif provider_id == "wordpress":
            url = "https://public-api.wordpress.com/rest/v1.1/me"
        else:
            return provider_id
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        data = response.json()
        if isinstance(data, list) and data:
            return str(data[0].get("name") or data[0].get("slug") or provider_id)
        return str(data.get("email") or data.get("name") or data.get("username") or data.get("display_name") or provider_id)
    except Exception:
        return provider_id
