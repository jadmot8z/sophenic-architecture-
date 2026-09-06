from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class VoiceEngineSettings(BaseSettings):
    """Runtime settings for the self-hosted engine.

    Models and audio never leave the configured host. HTTP is accepted only on
    loopback by the Electron bridge; remote deployments must use HTTPS.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SOPHENIC_VOICE_",
        extra="ignore",
    )

    service_key: str = ""
    host: str = "0.0.0.0"
    port: int = 8765
    mock_mode: bool = False
    allow_unauthenticated_loopback: bool = True

    stt_model: str = "large-v3-turbo"
    tts_provider: str = "voxcpm2"
    tts_model: str = "openbmb/VoxCPM2"
    device: str = "cuda"
    compute_type: str = "float16"
    max_concurrency: int = 2
    max_audio_mb: int = 30

    partial_interval_seconds: float = 1.2
    endpoint_silence_ms: int = 760
    minimum_speech_ms: int = 220
    maximum_utterance_seconds: int = 60
    base_energy_threshold: float = 0.010
    pre_roll_ms: int = 320

    reference_voice_path: str = ""
    reference_voice_text: str = ""
    voice_description: str = (
        "A warm, nuanced, confident adult voice with intimate studio clarity, "
        "natural conversational rhythm, subtle breaths, and precise multilingual pronunciation"
    )


@lru_cache
def get_settings() -> VoiceEngineSettings:
    return VoiceEngineSettings()
