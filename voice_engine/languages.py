from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LanguageProfile:
    code: str
    name: str
    locale: str
    accent_instruction: str


# Whisper supplies broad multilingual recognition. The TTS provider receives a
# locale-specific pronunciation instruction for every advertised language.
# Keep this registry explicit: the UI and health endpoint use the same source.
_LANGUAGE_ROWS = (
    ("ar", "Arabic", "ar-SA", "modern standard Arabic with a natural regional-neutral accent"),
    ("bn", "Bengali", "bn-BD", "natural Bangladeshi Bengali pronunciation"),
    ("my", "Burmese", "my-MM", "natural Burmese pronunciation and rhythm"),
    ("ca", "Catalan", "ca-ES", "natural central Catalan accent"),
    ("zh", "Chinese", "zh-CN", "natural standard Mandarin pronunciation"),
    ("hr", "Croatian", "hr-HR", "natural Croatian pronunciation"),
    ("cs", "Czech", "cs-CZ", "natural Czech pronunciation"),
    ("da", "Danish", "da-DK", "natural standard Danish accent"),
    ("nl", "Dutch", "nl-NL", "natural Netherlands Dutch accent"),
    ("en", "English", "en-US", "natural neutral international English accent"),
    ("fi", "Finnish", "fi-FI", "natural Finnish pronunciation"),
    ("fr", "French", "fr-FR", "natural metropolitan French accent"),
    ("de", "German", "de-DE", "natural standard German accent"),
    ("el", "Greek", "el-GR", "natural modern Greek pronunciation"),
    ("he", "Hebrew", "he-IL", "natural modern Israeli Hebrew accent"),
    ("hi", "Hindi", "hi-IN", "natural standard Hindi pronunciation"),
    ("hu", "Hungarian", "hu-HU", "natural Hungarian pronunciation"),
    ("id", "Indonesian", "id-ID", "natural Indonesian pronunciation"),
    ("it", "Italian", "it-IT", "natural standard Italian accent"),
    ("ja", "Japanese", "ja-JP", "natural standard Japanese pitch and rhythm"),
    ("km", "Khmer", "km-KH", "natural Khmer pronunciation"),
    ("ko", "Korean", "ko-KR", "natural Seoul Korean pronunciation"),
    ("lo", "Lao", "lo-LA", "natural Lao pronunciation"),
    ("ms", "Malay", "ms-MY", "natural Malaysian Malay pronunciation"),
    ("no", "Norwegian", "nb-NO", "natural eastern Norwegian Bokmal accent"),
    ("fa", "Persian", "fa-IR", "natural Iranian Persian pronunciation"),
    ("pl", "Polish", "pl-PL", "natural standard Polish accent"),
    ("pt", "Portuguese", "pt-BR", "natural Brazilian Portuguese accent"),
    ("ro", "Romanian", "ro-RO", "natural Romanian pronunciation"),
    ("ru", "Russian", "ru-RU", "natural standard Russian accent"),
    ("sk", "Slovak", "sk-SK", "natural Slovak pronunciation"),
    ("es", "Spanish", "es-ES", "natural neutral Spanish pronunciation"),
    ("sw", "Swahili", "sw-KE", "natural East African Swahili pronunciation"),
    ("sv", "Swedish", "sv-SE", "natural central Swedish accent"),
    ("tl", "Tagalog", "fil-PH", "natural Filipino Tagalog pronunciation"),
    ("ta", "Tamil", "ta-IN", "natural Indian Tamil pronunciation"),
    ("te", "Telugu", "te-IN", "natural Indian Telugu pronunciation"),
    ("th", "Thai", "th-TH", "natural central Thai pronunciation and tones"),
    ("tr", "Turkish", "tr-TR", "natural Istanbul Turkish accent"),
    ("uk", "Ukrainian", "uk-UA", "natural standard Ukrainian accent"),
    ("ur", "Urdu", "ur-PK", "natural Pakistani Urdu pronunciation"),
    ("vi", "Vietnamese", "vi-VN", "natural northern Vietnamese pronunciation"),
)

LANGUAGES: dict[str, LanguageProfile] = {
    code: LanguageProfile(code, name, locale, instruction)
    for code, name, locale, instruction in _LANGUAGE_ROWS
}


def normalize_language(value: str | None) -> str:
    clean = (value or "auto").strip().lower().replace("_", "-")
    if not clean or clean == "auto":
        return "auto"
    short = clean.split("-", 1)[0]
    return short if short in LANGUAGES else "auto"


def language_profile(value: str | None) -> LanguageProfile | None:
    return LANGUAGES.get(normalize_language(value))
