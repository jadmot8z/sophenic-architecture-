from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np


@dataclass(slots=True)
class VadUpdate:
    level: float
    threshold: float
    speech_started: bool = False
    speech_ended: bool = False
    partial_due: bool = False
    forced_endpoint: bool = False
    utterance: np.ndarray | None = None


class AdaptiveVoiceActivityDetector:
    """Streaming endpoint detector with adaptive noise floor and pre-roll.

    This detector deliberately favors not cutting the user off. A turn ends only
    after sustained silence; short pauses, breaths, and hesitations remain part
    of the same utterance. During assistant playback the threshold rises enough
    to reject residual speaker echo while still allowing a nearby user to barge
    in naturally.
    """

    def __init__(
        self,
        *,
        sample_rate: int,
        base_threshold: float = 0.010,
        endpoint_silence_ms: int = 640,
        minimum_speech_ms: int = 220,
        maximum_utterance_seconds: int = 60,
        partial_interval_seconds: float = 1.2,
        pre_roll_ms: int = 320,
    ) -> None:
        self.sample_rate = max(8_000, min(96_000, int(sample_rate)))
        self.base_threshold = max(0.002, float(base_threshold))
        self.endpoint_silence_ms = max(350, int(endpoint_silence_ms))
        self.minimum_speech_ms = max(100, int(minimum_speech_ms))
        self.maximum_utterance_seconds = max(5, int(maximum_utterance_seconds))
        self.partial_interval_seconds = max(0.7, float(partial_interval_seconds))
        self.pre_roll_samples = max(0, round(self.sample_rate * pre_roll_ms / 1000))

        self.noise_floor = self.base_threshold / 2
        self.assistant_speaking = False
        self.active = False
        self._candidate_ms = 0.0
        self._speech_ms = 0.0
        self._silence_ms = 0.0
        self._partial_at_samples = 0
        self._chunks: list[np.ndarray] = []
        self._pre_roll: deque[np.ndarray] = deque()
        self._pre_roll_count = 0

    @property
    def buffered_samples(self) -> int:
        return sum(chunk.size for chunk in self._chunks)

    def set_assistant_speaking(self, value: bool) -> None:
        self.assistant_speaking = bool(value)

    def _remember_pre_roll(self, chunk: np.ndarray) -> None:
        if not self.pre_roll_samples:
            return
        self._pre_roll.append(chunk.copy())
        self._pre_roll_count += chunk.size
        while self._pre_roll and self._pre_roll_count > self.pre_roll_samples:
            removed = self._pre_roll.popleft()
            self._pre_roll_count -= removed.size

    def _threshold(self) -> float:
        adaptive = self.noise_floor * (4.2 if self.assistant_speaking else 3.0)
        playback_floor = self.base_threshold * (1.65 if self.assistant_speaking else 1.0)
        return max(playback_floor, min(0.12, adaptive))

    def snapshot(self) -> np.ndarray:
        return np.concatenate(self._chunks).astype(np.float32, copy=False) if self._chunks else np.empty(0, dtype=np.float32)

    def reset(self) -> None:
        self.active = False
        self._candidate_ms = 0.0
        self._speech_ms = 0.0
        self._silence_ms = 0.0
        self._partial_at_samples = 0
        self._chunks = []
        self._pre_roll.clear()
        self._pre_roll_count = 0

    def flush(self) -> np.ndarray | None:
        utterance = self.snapshot()
        valid = self._speech_ms >= self.minimum_speech_ms and utterance.size > 0
        self.reset()
        return utterance if valid else None

    def feed(self, samples: np.ndarray) -> VadUpdate:
        chunk = np.asarray(samples, dtype=np.float32).reshape(-1)
        if not chunk.size:
            return VadUpdate(0.0, self._threshold())

        level = float(np.sqrt(np.mean(np.square(chunk), dtype=np.float64)))
        duration_ms = chunk.size / self.sample_rate * 1000
        threshold = self._threshold()
        voiced = level >= threshold
        update = VadUpdate(level=level, threshold=threshold)

        if not self.active:
            self._remember_pre_roll(chunk)
            if voiced:
                self._candidate_ms += duration_ms
            else:
                # Learn the room only while no speech is active. The slow rise
                # prevents a fan or keyboard burst from immediately becoming the
                # new baseline; the faster fall follows a room becoming quieter.
                rate = 0.015 if level > self.noise_floor else 0.05
                self.noise_floor = max(0.0005, self.noise_floor * (1 - rate) + level * rate)
                self._candidate_ms = max(0.0, self._candidate_ms - duration_ms * 1.5)

            if self._candidate_ms >= 120:
                self.active = True
                self._chunks = [part.copy() for part in self._pre_roll]
                self._pre_roll.clear()
                self._pre_roll_count = 0
                self._speech_ms = self._candidate_ms
                self._silence_ms = 0.0
                self._partial_at_samples = self.buffered_samples
                update.speech_started = True
            return update

        self._chunks.append(chunk.copy())
        if voiced:
            self._speech_ms += duration_ms
            self._silence_ms = 0.0
        else:
            self._silence_ms += duration_ms

        buffered = self.buffered_samples
        if (
            self._speech_ms >= self.minimum_speech_ms
            and buffered - self._partial_at_samples >= self.sample_rate * self.partial_interval_seconds
            and self._silence_ms < self.endpoint_silence_ms
        ):
            self._partial_at_samples = buffered
            update.partial_due = True

        elapsed_seconds = buffered / self.sample_rate
        endpoint = self._speech_ms >= self.minimum_speech_ms and self._silence_ms >= self.endpoint_silence_ms
        forced = elapsed_seconds >= self.maximum_utterance_seconds
        if endpoint or forced:
            update.utterance = self.snapshot()
            update.speech_ended = True
            update.forced_endpoint = forced
            self.reset()
        return update
