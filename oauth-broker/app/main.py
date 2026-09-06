from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass, field
from urllib.parse import urlencode, urlparse

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from .config import get_settings
from .providers import (
    account_label,
    authorization_url,
    exchange,
    normalize_shop_domain,
    provider,
    provider_readiness,
    refresh,
    supported_provider_ids,
)

settings = get_settings()
logger = logging.getLogger("sophenic.oauth")
logging.basicConfig(level="INFO", format="%(message)s")

public_url = urlparse(settings.public_base_url)
if public_url.hostname not in {"127.0.0.1", "localhost"}:
    if public_url.scheme != "https":
        raise RuntimeError("OAUTH_PUBLIC_BASE_URL must use HTTPS outside local development")
    if len(settings.distribution_key) < 32:
        raise RuntimeError("OAUTH_DISTRIBUTION_KEY must contain at least 32 characters in production")


@dataclass(slots=True)
class Session:
    id: str
    provider: str
    state: str
    oauth_state: str
    poll_hash: str
    verifier: str
    desktop_callback: str
    created_at: float
    options: dict[str, str] = field(default_factory=dict)
    token: dict | None = None
    error: str = ""


sessions: dict[str, Session] = {}
lock = asyncio.Lock()


class SessionRequest(BaseModel):
    provider: str
    state: str
    desktop_callback: str
    options: dict[str, str] = Field(default_factory=dict)


class RefreshRequest(BaseModel):
    provider: str
    refresh_token: str
    options: dict[str, str] = Field(default_factory=dict)


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def require_distribution_key(value: str | None) -> None:
    if settings.distribution_key and not secrets.compare_digest(value or "", settings.distribution_key):
        raise HTTPException(status_code=401, detail="Unauthorized distribution")


def validate_desktop_callback(value: str, provider_id: str) -> str:
    url = urlparse(value)
    expected_path = f"/oauth/{provider_id}/callback"
    if (
        url.scheme != "http"
        or url.hostname != "127.0.0.1"
        or url.port != settings.allowed_loopback_port
        or url.path != expected_path
        or url.query
        or url.fragment
    ):
        raise HTTPException(status_code=400, detail="Invalid desktop callback")
    return value


def oauth_callback(provider_id: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/oauth/{provider_id}/callback"


def sanitize_options(provider_id: str, values: dict[str, str]) -> dict[str, str]:
    if provider_id != "shopify":
        return {}
    shop = normalize_shop_domain(str(values.get("shopDomain", "")))
    return {"shopDomain": shop}


def verify_shopify_callback(request: Request, session: Session, client_secret: str) -> None:
    expected_shop = normalize_shop_domain(session.options.get("shopDomain", ""))
    actual_shop = normalize_shop_domain(request.query_params.get("shop", ""))
    if not secrets.compare_digest(actual_shop, expected_shop):
        raise RuntimeError("Shopify a renvoyé une boutique différente de celle demandée.")

    supplied = request.query_params.get("hmac", "")
    if not supplied or not client_secret:
        raise RuntimeError("Signature Shopify manquante.")
    pairs = [
        (key, value)
        for key, value in request.query_params.multi_items()
        if key not in {"hmac", "signature"}
    ]
    message = "&".join(f"{key}={value}" for key, value in sorted(pairs))
    expected = hmac.new(client_secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    if not secrets.compare_digest(expected, supplied):
        raise RuntimeError("Signature Shopify invalide.")


async def prune() -> None:
    cutoff = time.time() - settings.session_ttl_seconds
    async with lock:
        for session_id in [key for key, item in sessions.items() if item.created_at < cutoff]:
            sessions.pop(session_id, None)


app = FastAPI(title="SOPHENIC OAuth Broker", version="1.1")


@app.get("/health")
async def health():
    return {"ok": True, "service": "oauth-broker", "providers": len(supported_provider_ids())}


@app.get("/v1/oauth/providers")
async def providers_status(x_sophenic_distribution_key: str | None = Header(default=None)):
    require_distribution_key(x_sophenic_distribution_key)
    return {"providers": {provider_id: provider_readiness(provider_id) for provider_id in supported_provider_ids()}}


@app.post("/v1/oauth/sessions", status_code=201)
async def create_session(body: SessionRequest, x_sophenic_distribution_key: str | None = Header(default=None)):
    require_distribution_key(x_sophenic_distribution_key)
    await prune()

    provider_id = body.provider.strip().lower()
    if provider_id not in supported_provider_ids():
        raise HTTPException(status_code=400, detail="Fournisseur OAuth inconnu")
    if not body.state or len(body.state) > 256:
        raise HTTPException(status_code=400, detail="État OAuth Desktop invalide")

    try:
        options = sanitize_options(provider_id, body.options)
        item = provider(provider_id, options)
        callback = validate_desktop_callback(body.desktop_callback, provider_id)
        session_id = b64url(secrets.token_bytes(24))
        poll_token = b64url(secrets.token_bytes(32))
        verifier = b64url(secrets.token_bytes(48))
        challenge = b64url(hashlib.sha256(verifier.encode()).digest())
        oauth_state = b64url(secrets.token_bytes(32))
        url = authorization_url(item, oauth_callback(provider_id), oauth_state, challenge)
    except HTTPException:
        raise
    except Exception as exc:
        # Configuration errors are safe to return as long as no credential value
        # is included. Provider helpers only expose provider names/details.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    session = Session(
        session_id,
        provider_id,
        body.state,
        oauth_state,
        digest(poll_token),
        verifier,
        callback,
        time.time(),
        options,
    )
    async with lock:
        sessions[session_id] = session
    logger.info(json.dumps({"event": "oauth.session.created", "provider": provider_id, "session_id": session_id, "at": time.time()}))
    return {
        "session_id": session_id,
        "poll_token": poll_token,
        "authorization_url": url,
        "expires_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + settings.session_ttl_seconds)),
    }


@app.get("/oauth/{provider_id}/callback")
async def callback(provider_id: str, request: Request):
    state = request.query_params.get("state", "")
    async with lock:
        session = next(
            (
                item
                for item in sessions.values()
                if item.provider == provider_id and secrets.compare_digest(item.oauth_state, state)
            ),
            None,
        )
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    error = request.query_params.get("error", "")
    if error:
        session.error = request.query_params.get("error_description", error)
    else:
        code = request.query_params.get("code", "")
        try:
            if not code:
                raise RuntimeError("Missing authorization code")
            item = provider(provider_id, session.options)
            if provider_id == "shopify":
                verify_shopify_callback(request, session, item.client_secret)
            payload = await exchange(item, code=code, redirect_uri=oauth_callback(provider_id), verifier=session.verifier)
            if item.scopes and not payload.get("scope"):
                payload["scope"] = " ".join(item.scopes)
            payload["account"] = await account_label(provider_id, str(payload["access_token"]), payload, options=session.options)
            if provider_id == "shopify":
                payload["extra"] = {"shopDomain": session.options["shopDomain"]}
            session.token = payload
        except Exception as exc:
            session.error = str(exc)

    query = {"state": session.state, "status": "connected" if session.token else "error"}
    if session.error:
        query["error"] = "oauth_failed"
        query["error_description"] = session.error[:400]
    logger.info(json.dumps({"event": "oauth.callback", "provider": provider_id, "ok": bool(session.token), "at": time.time()}))
    return RedirectResponse(f"{session.desktop_callback}?{urlencode(query)}", status_code=302)


@app.get("/v1/oauth/sessions/{session_id}")
async def claim_session(
    session_id: str,
    authorization: str | None = Header(default=None),
    x_sophenic_distribution_key: str | None = Header(default=None),
):
    require_distribution_key(x_sophenic_distribution_key)
    await prune()
    poll_token = (authorization or "").removeprefix("Bearer ").strip()
    async with lock:
        session = sessions.get(session_id)
        if not session or not poll_token or not secrets.compare_digest(session.poll_hash, digest(poll_token)):
            raise HTTPException(status_code=404, detail="OAuth session not found")
        if session.error:
            sessions.pop(session_id, None)
            raise HTTPException(status_code=400, detail=session.error)
        if not session.token:
            raise HTTPException(status_code=202, detail="pending")
        token = {"status": "connected", **session.token}
        sessions.pop(session_id, None)
    return token


@app.post("/v1/oauth/refresh")
async def refresh_token(body: RefreshRequest, x_sophenic_distribution_key: str | None = Header(default=None)):
    require_distribution_key(x_sophenic_distribution_key)
    try:
        provider_id = body.provider.strip().lower()
        options = sanitize_options(provider_id, body.options)
        return await refresh(provider(provider_id, options), body.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
