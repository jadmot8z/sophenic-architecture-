from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True, slots=True)
class SynthesisRequest:
    text: str
    language: str = "auto"
    voice_id: str = "sophenic-native"
    control: str = ""
    reference_wav_path: str = ""
    reference_text: str = ""
    cfg_value: float = 2.0
    inference_timesteps: int = 10
    seed: int | None = None


class VoiceProvider(ABC):
    @property
    @abstractmethod
    def provider_id(self) -> str: ...

    @property
    @abstractmethod
    def sample_rate(self) -> int: ...

    @property
    @abstractmethod
    def ready(self) -> bool: ...

    @abstractmethod
    def load(self) -> None: ...

    @abstractmethod
    def synthesize(self, request: SynthesisRequest) -> np.ndarray: ...

    @abstractmethod
    def stream(self, request: SynthesisRequest) -> Iterator[np.ndarray]: ...
