import unittest

from voice_engine.emotion_engine.personality import ConversationEmotionEngine, EMOTIONS


class EmotionEngineTests(unittest.TestCase):
    def test_exposes_required_emotional_range(self):
        self.assertEqual(
            set(EMOTIONS),
            {"happy", "curious", "serious", "calm", "excited", "concerned", "playful", "thoughtful"},
        )

    def test_marker_requires_context_and_obeys_cooldown(self):
        engine = ConversationEmotionEngine()
        first = engine.style(
            "That is genuinely curious.",
            context="Something strange and unexpected happened.",
            language="en",
            session_id="conversation-a",
        )
        self.assertEqual(first.emotion, "curious")
        self.assertEqual(first.marker, "Hmm…")
        second = engine.style(
            "That is curious too.",
            context="Another strange and unexpected event.",
            language="en",
            session_id="conversation-a",
        )
        self.assertEqual(second.marker, "")

    def test_neutral_text_never_gets_random_filler(self):
        engine = ConversationEmotionEngine()
        for index in range(50):
            style = engine.style("The report contains three sections.", session_id=f"neutral-{index}")
            self.assertEqual(style.marker, "")


if __name__ == "__main__":
    unittest.main()
