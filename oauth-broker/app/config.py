from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="OAUTH_", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8787
    public_base_url: str = "http://127.0.0.1:8787"
    distribution_key: str = ""
    session_ttl_seconds: int = 300
    allowed_loopback_port: int = 43823


@lru_cache
def get_settings() -> Settings:
    return Settings()
