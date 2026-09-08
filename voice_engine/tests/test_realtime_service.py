import json
import os
import unittest

import numpy as np

os.environ.setdefault("SOPHENIC_VOICE_MOCK_MODE", "true")
os.environ.setdefault("SOPHENIC_VOICE_ALLOW_UNAUTHENTICATED_LOOPBACK", "true")

from fastapi.testclient import TestClient
from voice_engine.service.main import app


class RealtimeServiceTests(unittest.TestCase):
    @staticmethod
    def receive_type(socket, expected: set[str]):
        for _ in range(40):
            payload = socket.receive_json()
            if payload.get("type") in expected:
                return payload
        raise AssertionError(f"Did not receive any of {expected}")

    def test_full_duplex_protocol_transcription_speech_and_cancel(self):
        with TestClient(app) as client:
            health = client.get("/health").json()
            self.assertTrue(health["ready"])
            self.assertTrue(health["full_duplex"])
            self.assertGreaterEqual(health["languages"], 30)

            with client.websocket_connect("/v2/realtime") as socket:
                socket.send_json({"type": "start", "session_id": "test-session", "language": "en", "sample_rate": 16_000})
                self.assertEqual(socket.receive_json()["type"], "ready")

                speech = (np.full(320, 0.10, dtype=np.float32) * 32767).astype("<i2").tobytes()
                silence = np.zeros(320, dtype="<i2").tobytes()
                for _ in range(20):
                    socket.send_bytes(speech)
                self.assertEqual(self.receive_type(socket, {"speech_started"})["type"], "speech_started")
                for _ in range(40):
                    socket.send_bytes(silence)
                final = self.receive_type(socket, {"transcript_final"})
                self.assertTrue(final["text"])
                self.assertEqual(final["language"], "en")

                socket.send_json({"type": "synthesize", "request_id": "normal", "text": "Hello from the local voice engine.", "language": "en"})
                started = self.receive_type(socket, {"output_started"})
                self.assertEqual(started["request_id"], "normal")
                audio = self.receive_type(socket, {"output_audio"})
                self.assertEqual(audio["format"], "pcm_s16le")
                self.assertTrue(audio["data"])
                self.assertEqual(self.receive_type(socket, {"output_done"})["request_id"], "normal")

                socket.send_json({"type": "synthesize", "request_id": "interrupt-me", "text": "This output should be interrupted naturally.", "language": "en"})
                self.assertEqual(self.receive_type(socket, {"output_started"})["request_id"], "interrupt-me")
                socket.send_json({"type": "cancel_output", "request_id": "interrupt-me"})
                cancelled = self.receive_type(socket, {"output_cancelled"})
                self.assertEqual(cancelled["request_id"], "interrupt-me")
                socket.send_json({"type": "stop"})


if __name__ == "__main__":
    unittest.main()
