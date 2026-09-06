from __future__ import annotations

from collections.abc import Iterator
import hashlib
import logging
import threading

import numpy as np

from ..config import get_settings
from ..languages import language_profile
from .base import SynthesisRequest, VoiceProvider

logger = logging.getLogger("sophenic.voice.native")


class VoxCPM2Provider(VoiceProvider):
    """Local neural TTS with stable voice identity and streamed generation."""

    def __init__(self) -> None:
        self._model = None
        self._sample_rate = 48_000
        self._load_lock = threading.Lock()

    @property
    def provider_id(self) -> str:
        return "sophenic-voxcpm2"

    @property
    def sample_rate(self) -> int:
        return self._sample_rate

    @property
    def ready(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            settings = get_settings()
            logger.info("[TTS] Loading started: provider=%s model=%s", self.provider_id, settings.tts_model)
            if settings.mock_mode:
                self._model = "mock"
                logger.info("[TTS] Loading finished: mock mode enabled")
                return
            try:
                from transformers import LlamaTokenizerFast  # noqa: F401
                from voxcpm import VoxCPM
            except ImportError as exc:  # pragma: no cover - surfaced at runtime under misconfigured environments
                raise RuntimeError(
                    "VoxCPM requires a compatible Transformers build. "
                    "Pin transformers==4.48.3 (or a 4.48.x release) in voice_engine/requirements.txt; "
                    "newer Transformers releases removed LlamaTokenizerFast and break voxcpm startup."
                ) from exc

            try:
                model = VoxCPM.from_pretrained(settings.tts_model)
                sample_rate = int(getattr(getattr(model, "tts_model", None), "sample_rate", 48_000))
                self._sample_rate = sample_rate
                self._model = model
                logger.info("[TTS] Loading finished: ready=%s sample_rate=%s provider=%s", self.ready, self._sample_rate, self.provider_id)
            except Exception:
                logger.exception("[TTS] Loading failed")
                raise

    @staticmethod
    def _stable_seed(voice_id: str) -> int:
        digest = hashlib.sha256(voice_id.encode("utf-8")).digest()
        return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF

    def _kwargs(self, request: SynthesisRequest) -> dict[str, object]:
        settings = get_settings()
        profile = language_profile(request.language)
        controls = [settings.voice_description.strip()]
        if profile:
            controls.append(profile.accent_instruction)
        if request.control.strip():
            controls.append(request.control.strip())
        text = request.text.strip()
        if controls:
            text = f"({', '.join(controls)}){text}"
        kwargs: dict[str, object] = {
            "text": text,
            "cfg_value": max(1.0, min(3.0, float(request.cfg_value))),
            "inference_timesteps": max(4, min(30, int(request.inference_timesteps))),
            "seed": request.seed if request.seed is not None else self._stable_seed(request.voice_id),
        }
        reference = request.reference_wav_path or settings.reference_voice_path
        reference_text = request.reference_text or settings.reference_voice_text
        if reference:
            kwargs["reference_wav_path"] = reference
            if reference_text:
                kwargs["prompt_wav_path"] = reference
                kwargs["prompt_text"] = reference_text
        return kwargs

    def synthesize(self, request: SynthesisRequest) -> np.ndarray:
        self.load()
        if self._model == "mock":
            duration = max(0.28, min(6.0, len(request.text) / 18.0))
            # Audible but gentle development signal; unlike a zero-filled WAV it
            # also exercises playback levels and interruption tests.
            timeline = np.arange(round(self.sample_rate * duration), dtype=np.float32) / self.sample_rate
            envelope = np.minimum(1.0, timeline * 12) * np.minimum(1.0, (duration - timeline) * 12)
            return (0.025 * np.sin(2 * np.pi * 190 * timeline) * envelope).astype(np.float32)
        generated = self._model.generate(**self._kwargs(request))
        return np.asarray(generated, dtype=np.float32).reshape(-1)

    def stream(self, request: SynthesisRequest) -> Iterator[np.ndarray]:
        self.load()
        if self._model == "mock":
            audio = self.synthesize(request)
            step = max(1, self.sample_rate // 5)
            for offset in range(0, audio.size, step):
                yield audio[offset:offset + step]
            return
        for chunk in self._model.generate_streaming(**self._kwargs(request)):
            audio = np.asarray(chunk, dtype=np.float32).reshape(-1)
            if audio.size:
                yield audio
