from __future__ import annotations

from dataclasses import asdict, dataclass
import re
import threading
import time


EMOTIONS = ("happy", "curious", "serious", "calm", "excited", "concerned", "playful", "thoughtful")


@dataclass(frozen=True, slots=True)
class SpeechStyle:
    emotion: str
    pace: float
    energy: float
    warmth: float
    pause_before_ms: int
    allow_breath: bool
    allow_chuckle: bool
    marker: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(slots=True)
class _SessionMood:
    emotion: str = "calm"
    marker_cooldown_until: float = 0.0
    turns: int = 0


class ConversationEmotionEngine:
    """Contextual delivery policy with conservative, explainable reactions.

    It never scatters random filler into responses. A spoken marker is allowed
    only when both the user's context and the response strongly support the same
    reaction, and at most once per cooldown window.
    """

    _signals: dict[str, tuple[str, ...]] = {
        "concerned": (
            "désolé", "inquiet", "danger", "urgent", "malheureusement", "peur", "problème grave",
            "sorry", "worried", "danger", "urgent", "unfortunately", "afraid", "serious problem",
        ),
        "excited": (
            "incroyable", "extraordinaire", "génial", "victoire", "réussi", "fantastique",
            "amazing", "incredible", "fantastic", "we did it", "success", "wonderful",
        ),
        "happy": ("merci", "bravo", "félicit", "heureux", "content", "thank you", "congrat", "glad", "happy"),
        "playful": ("haha", "mdr", "lol", "blague", "drôle", "funny", "joke", "kidding"),
        "curious": ("étrange", "bizarre", "curieux", "inattendu", "strange", "weird", "curious", "unexpected"),
        "serious": ("important", "critique", "sécurité", "juridique", "médical", "critical", "security", "legal", "medical"),
        "thoughtful": ("réfléch", "complexe", "peut-être", "nuance", "think", "complex", "perhaps", "maybe", "nuance"),
    }

    _markers: dict[str, dict[str, str]] = {
        "fr": {"curious": "Hmm…", "excited": "Oh, wow…", "concerned": "Oh…", "thoughtful": "Alors…"},
        "en": {"curious": "Hmm…", "excited": "Oh, wow…", "concerned": "Oh…", "thoughtful": "Well…"},
        "es": {"curious": "Mmm…", "excited": "Vaya…", "concerned": "Oh…", "thoughtful": "Bueno…"},
        "de": {"curious": "Hm…", "excited": "Oh, wow…", "concerned": "Oh…", "thoughtful": "Also…"},
        "it": {"curious": "Mmh…", "excited": "Oh, wow…", "concerned": "Oh…", "thoughtful": "Beh…"},
        "pt": {"curious": "Hmm…", "excited": "Nossa…", "concerned": "Ah…", "thoughtful": "Bem…"},
    }

    def __init__(self) -> None:
        self._sessions: dict[str, _SessionMood] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _count_signals(text: str, tokens: tuple[str, ...]) -> int:
        lower = text.casefold()
        return sum(1 for token in tokens if token in lower)

    def infer_emotion(self, response: str, context: str = "") -> tuple[str, int]:
        combined = f"{context}\n{response}".strip()
        scores = {emotion: self._count_signals(combined, tokens) for emotion, tokens in self._signals.items()}
        if "?" in response:
            scores["curious"] = scores.get("curious", 0) + 1
        if re.search(r"!{1,2}(?:\s|$)", response):
            scores["excited"] = scores.get("excited", 0) + 1
        emotion, score = max(scores.items(), key=lambda item: item[1], default=("calm", 0))
        return (emotion if score else "calm"), score

    def style(
        self,
        response: str,
        *,
        context: str = "",
        language: str = "auto",
        session_id: str = "default",
        natural: bool = True,
        expressiveness: float = 0.72,
        speed: float = 1.0,
    ) -> SpeechStyle:
        expressive = max(0.0, min(1.0, float(expressiveness)))
        pace = max(0.68, min(1.35, float(speed)))
        emotion, confidence = self.infer_emotion(response, context)
        if not natural:
            emotion, confidence = "calm", 0

        energy = 0.58 + expressive * 0.2
        warmth = 0.66 + expressive * 0.18
        pause = 90
        if emotion == "concerned":
            energy, warmth, pace, pause = 0.48, 0.9, pace * 0.92, 180
        elif emotion == "serious":
            energy, warmth, pace, pause = 0.58, 0.7, pace * 0.94, 135
        elif emotion == "thoughtful":
            energy, warmth, pace, pause = 0.55, 0.78, pace * 0.93, 165
        elif emotion == "curious":
            energy, pause = min(0.86, energy + 0.05), 125
        elif emotion in {"happy", "excited", "playful"}:
            energy, warmth, pause = min(0.96, energy + 0.12), 0.86, 65

        marker = ""
        now = time.monotonic()
        with self._lock:
            mood = self._sessions.setdefault(session_id, _SessionMood())
            mood.turns += 1
            # Require two independent lexical/punctuation signals. This keeps
            # natural reactions contextual rather than decorative.
            marker_allowed = natural and confidence >= 2 and now >= mood.marker_cooldown_until
            if marker_allowed and emotion in {"curious", "excited", "concerned", "thoughtful"}:
                marker = self._markers.get(language, self._markers["en"]).get(emotion, "")
                # Do not duplicate a marker already authored by the model.
                first_words = response.strip().casefold()[:24]
                if marker.strip("…").casefold() in first_words:
                    marker = ""
                if marker:
                    mood.marker_cooldown_until = now + 42
            mood.emotion = emotion

        return SpeechStyle(
            emotion=emotion,
            pace=max(0.68, min(1.35, pace)),
            energy=energy,
            warmth=warmth,
            pause_before_ms=pause,
            allow_breath=natural and len(response) > 80,
            allow_chuckle=natural and emotion == "playful" and confidence >= 2,
            marker=marker,
        )

    @staticmethod
    def render_text(text: str, style: SpeechStyle) -> str:
        clean = text.strip()
        return f"{style.marker} {clean}" if style.marker else clean

    @staticmethod
    def control_instruction(style: SpeechStyle) -> str:
        instructions = [
            f"{style.emotion} emotional tone",
            f"natural conversational pace around {style.pace:.2f}x",
            f"energy {style.energy:.2f}",
            f"warmth {style.warmth:.2f}",
            "human phrasing with meaningful intonation, never announcer-like",
        ]
        if style.allow_breath:
            instructions.append("subtle breathing space only at semantic boundaries")
        if style.allow_chuckle:
            instructions.append("one very small contextual chuckle, not exaggerated")
        if style.emotion == "thoughtful":
            instructions.append("a brief reflective hesitation before the key idea")
        return ", ".join(instructions)
