from __future__ import annotations

from dataclasses import dataclass

from ..config import get_settings
from .base import VoiceProvider
from .voxcpm2 import VoxCPM2Provider


@dataclass(frozen=True, slots=True)
class ProviderDescriptor:
    id: str
    name: str
    streaming: bool
    local: bool
    expressive: bool


class VoiceProviderRegistry:
    _descriptors = {
        "voxcpm2": ProviderDescriptor("sophenic-voxcpm2", "Sophenic Native Voice", True, True, True),
    }

    @classmethod
    def create(cls, provider_id: str | None = None) -> VoiceProvider:
        selected = (provider_id or get_settings().tts_provider).strip().lower()
        if selected == "voxcpm2":
            return VoxCPM2Provider()
        raise RuntimeError(f"Unknown local TTS provider: {selected}")

    @classmethod
    def descriptor(cls, provider_id: str | None = None) -> ProviderDescriptor:
        selected = (provider_id or get_settings().tts_provider).strip().lower()
        if selected not in cls._descriptors:
            cls.create(selected)
        return cls._descriptors[selected]
