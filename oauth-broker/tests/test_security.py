from fastapi import HTTPException

from app.main import digest, validate_desktop_callback
from app.providers import provider


def test_loopback_callback_is_strict():
    assert validate_desktop_callback("http://127.0.0.1:43823/oauth/notion/callback")
    for invalid in (
        "https://evil.example/oauth/notion/callback",
        "http://localhost:43823/oauth/notion/callback",
        "http://127.0.0.1:9999/oauth/notion/callback",
    ):
        try:
            validate_desktop_callback(invalid)
        except HTTPException:
            continue
        raise AssertionError(f"callback externe accepté: {invalid}")


def test_poll_tokens_are_hashed_and_provider_registry_is_confidential():
    assert digest("poll-token") != "poll-token"
    assert provider("notion").basic_auth is True
    assert provider("gmail").client_secret_env == "OAUTH_GOOGLE_CLIENT_SECRET"
