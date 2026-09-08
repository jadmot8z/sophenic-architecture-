import unittest

import numpy as np

from voice_engine.audio_stream.vad import AdaptiveVoiceActivityDetector


class AdaptiveVadTests(unittest.TestCase):
    def detector(self):
        return AdaptiveVoiceActivityDetector(
            sample_rate=16_000,
            base_threshold=0.01,
            endpoint_silence_ms=600,
            minimum_speech_ms=200,
            maximum_utterance_seconds=10,
            partial_interval_seconds=1.0,
            pre_roll_ms=300,
        )

    def test_preserves_pauses_and_emits_complete_utterance(self):
        vad = self.detector()
        quiet = np.zeros(320, dtype=np.float32)
        speech = np.full(320, 0.08, dtype=np.float32)
        for _ in range(8):
            self.assertFalse(vad.feed(quiet).speech_started)
        started = any(vad.feed(speech).speech_started for _ in range(8))
        self.assertTrue(started)
        for _ in range(8):  # 160 ms hesitation must not end the turn.
            self.assertFalse(vad.feed(quiet).speech_ended)
        for _ in range(12):
            vad.feed(speech)
        endpoint = None
        for _ in range(36):
            update = vad.feed(quiet)
            if update.speech_ended:
                endpoint = update
                break
        self.assertIsNotNone(endpoint)
        self.assertGreater(endpoint.utterance.size, 16_000 * 0.5)

    def test_playback_echo_threshold_still_allows_barge_in(self):
        vad = self.detector()
        vad.set_assistant_speaking(True)
        echo = np.full(320, 0.012, dtype=np.float32)
        self.assertFalse(any(vad.feed(echo).speech_started for _ in range(20)))
        user = np.full(320, 0.10, dtype=np.float32)
        self.assertTrue(any(vad.feed(user).speech_started for _ in range(12)))


if __name__ == "__main__":
    unittest.main()
