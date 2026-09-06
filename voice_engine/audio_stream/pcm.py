from __future__ import annotations

import io
import wave

import numpy as np


def pcm16_bytes(samples: np.ndarray) -> bytes:
    audio = np.asarray(samples, dtype=np.float32).reshape(-1)
    clipped = np.clip(audio, -1.0, 1.0)
    return (clipped * 32767.0).astype("<i2").tobytes()


def pcm16_samples(raw: bytes) -> np.ndarray:
    if len(raw) % 2:
        raw = raw[:-1]
    return np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0


def wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(pcm16_bytes(samples))
    return output.getvalue()


def resample(samples: np.ndarray, source_rate: int, target_rate: int = 16_000) -> np.ndarray:
    audio = np.asarray(samples, dtype=np.float32).reshape(-1)
    if not audio.size or source_rate == target_rate:
        return audio
    count = max(1, round(audio.size * target_rate / source_rate))
    positions = np.linspace(0, audio.size - 1, count)
    return np.interp(positions, np.arange(audio.size), audio).astype(np.float32)
