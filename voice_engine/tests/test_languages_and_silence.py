import unittest

from voice_engine.languages import LANGUAGES, language_profile, normalize_language
from voice_engine.silence_detector.prompt_planner import SilencePromptPlanner


class LanguageAndSilenceTests(unittest.TestCase):
    def test_at_least_thirty_complete_language_profiles(self):
        self.assertGreaterEqual(len(LANGUAGES), 30)
        for code, profile in LANGUAGES.items():
            self.assertEqual(profile.code, code)
            self.assertTrue(profile.locale)
            self.assertTrue(profile.accent_instruction)

    def test_locale_normalization(self):
        self.assertEqual(normalize_language("fr-FR"), "fr")
        self.assertEqual(normalize_language("PT_br"), "pt")
        self.assertEqual(normalize_language("unknown"), "auto")
        self.assertEqual(language_profile("ja-JP").code, "ja")

    def test_silence_delay_is_natural_and_stable(self):
        first = SilencePromptPlanner.delay_seconds("session", 0)
        self.assertGreaterEqual(first, 18.5)
        self.assertLessEqual(first, 22.5)
        self.assertEqual(first, SilencePromptPlanner.delay_seconds("session", 0))
        self.assertTrue(SilencePromptPlanner.prompt("session", 0, "fr"))


if __name__ == "__main__":
    unittest.main()
