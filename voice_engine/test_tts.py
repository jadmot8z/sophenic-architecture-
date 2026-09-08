from __future__ import annotations

import wave

import numpy as np

from voice_engine.audio_stream import wav_bytes
from voice_engine.service.main import tts
from voice_engine.text_to_speech import SynthesisRequest


def main() -> None:
    tts.load()
    audio = tts.synthesize(SynthesisRequest(
        text="Bonjour, je suis Sophenic votre assistant vocal.",
        language="fr",
    ))
    if audio.size == 0 or not np.isfinite(audio).all() or float(np.max(np.abs(audio))) < 1e-5:
        raise RuntimeError("VoxCPM2 returned empty or silent audio")
    with open("output.wav", "wb") as output:
        output.write(wav_bytes(audio, tts.sample_rate))
    with wave.open("output.wav", "rb") as wav:
        frames = wav.getnframes()
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or frames == 0:
            raise RuntimeError("output.wav is not a valid mono PCM16 WAV")
    print(f"TTS OK: output.wav frames={frames} sample_rate={tts.sample_rate}")


if __name__ == "__main__":
    main()