from __future__ import annotations

from dataclasses import dataclass
import logging
import threading

import numpy as np

from ..config import get_settings
from ..languages import normalize_language

logger = logging.getLogger("sophenic.voice.native")


@dataclass(frozen=True, slots=True)
class Transcription:
    text: str
    language: str
    probability: float
    duration_seconds: float


class StreamingWhisper:
    """Warm, local faster-whisper runtime shared by realtime sessions."""

    def __init__(self) -> None:
        self._model = None
        self._load_lock = threading.Lock()
        # CTranslate2 model execution is not safely re-entrant on every device.
        self._inference_lock = threading.Lock()

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
            logger.info("[STT] Loading started: model=%s device=%s compute_type=%s", settings.stt_model, settings.device, settings.compute_type)
            if settings.mock_mode:
                self._model = "mock"
                logger.info("[STT] Loading finished: mock mode enabled")
                return
            try:
                from faster_whisper import WhisperModel

                self._model = WhisperModel(
                    settings.stt_model,
                    device=settings.device,
                    compute_type=settings.compute_type,
                )
                logger.info("[STT] Loading finished: ready=%s model=%s", self.ready, settings.stt_model)
            except Exception:
                logger.exception("[STT] Loading failed")
                raise

    def transcribe(
        self,
        samples: np.ndarray,
        *,
        language: str | None = None,
        partial: bool = False,
    ) -> Transcription:
        self.load()
        audio = np.asarray(samples, dtype=np.float32).reshape(-1)
        requested = normalize_language(language)
        duration = audio.size / 16_000
        if self._model == "mock":
            return Transcription(
                "Local realtime voice engine is ready.",
                requested if requested != "auto" else "en",
                1.0,
                duration,
            )

        with self._inference_lock:
            segments, info = self._model.transcribe(
                audio,
                language=None if requested == "auto" else requested,
                beam_size=1 if partial else 4,
                best_of=1 if partial else 3,
                temperature=0.0,
                condition_on_previous_text=False,
                vad_filter=False,  # Endpointing is handled by our streaming VAD.
                word_timestamps=False,
                without_timestamps=True,
            )
            text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        return Transcription(
            text=text,
            language=str(getattr(info, "language", requested) or requested),
            probability=float(getattr(info, "language_probability", 0.0) or 0.0),
            duration_seconds=duration,
        )
