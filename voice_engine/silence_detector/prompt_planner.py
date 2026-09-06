from __future__ import annotations

import hashlib


class SilencePromptPlanner:
    """Deterministic natural prompt rotation used by service-side clients/tests."""

    _prompts = {
        "fr": ("Tu es toujours là ?", "Prends ton temps, je t’écoute.", "Tu voulais continuer ?"),
        "en": ("Are you still there?", "Take your time, I'm listening.", "Did you want to continue?"),
        "es": ("¿Sigues ahí?", "Tómate tu tiempo, te escucho.", "¿Querías continuar?"),
        "de": ("Bist du noch da?", "Lass dir Zeit, ich höre zu.", "Möchtest du weitermachen?"),
        "it": ("Ci sei ancora?", "Prenditi pure il tuo tempo, ti ascolto.", "Volevi continuare?"),
        "pt": ("Você ainda está aí?", "Sem pressa, estou ouvindo.", "Você queria continuar?"),
    }

    @classmethod
    def prompt(cls, session_id: str, reminder_index: int, language: str) -> str:
        values = cls._prompts.get(language, cls._prompts["en"])
        digest = hashlib.sha256(f"{session_id}:{reminder_index}".encode()).digest()
        return values[int.from_bytes(digest[:2], "big") % len(values)]

    @staticmethod
    def delay_seconds(session_id: str, reminder_index: int) -> float:
        digest = hashlib.sha256(f"delay:{session_id}:{reminder_index}".encode()).digest()
        # 18.5–22.5 seconds feels less mechanical than an exact repeated alarm.
        return 18.5 + int.from_bytes(digest[:2], "big") / 65535 * 4.0
