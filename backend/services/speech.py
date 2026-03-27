"""Speech service utilities — STT and TTS via Azure Speech SDK.

Provides reusable functions for speech recognition and synthesis,
used as agent tools in the Speech Assistant (Feature 7).
"""

import logging
import os
import re
import tempfile
import time

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

_credential = None


def _get_credential():
    """Return a cached DefaultAzureCredential singleton."""
    global _credential
    if _credential is None:
        from azure.identity import DefaultAzureCredential
        _credential = DefaultAzureCredential()
    return _credential


# ── Markdown → plain text for TTS ───────────────────────────────────────────

def strip_markdown_for_speech(text: str) -> str:
    """Convert markdown to clean plain text suitable for speech synthesis.

    Strips headers, bold/italic markers, links, images, code blocks,
    bullet markers, and other markdown syntax so TTS reads naturally.
    """
    s = text
    # Remove code blocks (``` ... ```)
    s = re.sub(r"```[\s\S]*?```", "", s)
    # Remove inline code (`...`)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    # Remove images ![alt](url)
    s = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", s)
    # Convert links [text](url) → text
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    # Remove heading markers (# ## ### etc.)
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.MULTILINE)
    # Remove bold/italic (*** ** * __ _)
    s = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", s)
    s = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", s)
    # Remove strikethrough (~~text~~)
    s = re.sub(r"~~([^~]+)~~", r"\1", s)
    # Remove blockquote markers (> )
    s = re.sub(r"^>\s?", "", s, flags=re.MULTILINE)
    # Remove horizontal rules (--- ___ ***)
    s = re.sub(r"^[-*_]{3,}\s*$", "", s, flags=re.MULTILINE)
    # Convert unordered list markers (- * +) to natural speech
    s = re.sub(r"^[\s]*[-*+]\s+", "", s, flags=re.MULTILINE)
    # Convert ordered list markers (1. 2. etc.)
    s = re.sub(r"^[\s]*\d+\.\s+", "", s, flags=re.MULTILINE)
    # Remove HTML tags
    s = re.sub(r"<[^>]+>", "", s)
    # Collapse multiple newlines into one
    s = re.sub(r"\n{3,}", "\n\n", s)
    # Collapse multiple spaces
    s = re.sub(r" {2,}", " ", s)
    return s.strip()


# ── SSML builder with calm style ────────────────────────────────────────────

# Allowlists for SSML parameters to prevent injection
_ALLOWED_VOICES = {
    "en-US-JennyNeural", "en-US-AriaNeural", "en-US-GuyNeural",
    "en-US-SaraNeural", "en-US-DavisNeural", "en-US-JaneNeural",
    "en-US-JasonNeural", "en-US-TonyNeural",
    "en-US-Ava:DragonHDLatestNeural",
    # Per-language voices
    "es-ES-ElviraNeural", "it-IT-ElsaNeural", "pt-BR-FranciscaNeural",
    "de-DE-KatjaNeural", "ja-JP-NanamiNeural",
    # Multilingual voices (support <lang xml:lang> for any language)
    "en-US-AvaMultilingualNeural", "en-US-AndrewMultilingualNeural",
    "en-US-BrianMultilingualNeural", "en-US-EmmaMultilingualNeural",
}

# Voices that support <lang xml:lang> element for cross-language speech
_MULTILINGUAL_VOICES = {
    "en-US-AvaMultilingualNeural", "en-US-AndrewMultilingualNeural",
    "en-US-BrianMultilingualNeural", "en-US-EmmaMultilingualNeural",
}

# Language code → BCP-47 locale for <lang xml:lang>
_LANG_LOCALES: dict[str, str] = {
    "en": "en-US", "es": "es-ES", "it": "it-IT",
    "pt": "pt-BR", "de": "de-DE", "ja": "ja-JP",
    "fr": "fr-FR", "zh": "zh-CN", "ko": "ko-KR",
    "ar": "ar-EG", "hi": "hi-IN", "ru": "ru-RU",
}
_ALLOWED_STYLES = {"calm", "cheerful", "empathetic", "friendly", "hopeful", "sad", "serious"}
_ALLOWED_RATES = {"x-slow", "slow", "medium", "default", "fast", "x-fast"}


def build_calm_ssml(
    text: str,
    voice: str = "en-US-EmmaMultilingualNeural",
    style: str = "calm",
    style_degree: str = "1.2",
    rate: str = "slow",
    lang: str | None = None,
) -> str:
    """Build SSML with calm, measured delivery for neurodiverse-friendly output.

    When *lang* is provided and *voice* is a multilingual neural voice,
    the text is wrapped in ``<lang xml:lang="…">`` so Azure Speech renders
    it with native pronunciation for that locale.
    """
    # Validate parameters against allowlists to prevent SSML injection
    if voice not in _ALLOWED_VOICES:
        voice = "en-US-EmmaMultilingualNeural"
    if style not in _ALLOWED_STYLES:
        style = "calm"
    if rate not in _ALLOWED_RATES:
        rate = "slow"

    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )

    # ── Multilingual voice path: use <lang xml:lang> ────────────────────
    if voice in _MULTILINGUAL_VOICES and lang:
        locale = _LANG_LOCALES.get(lang, lang if "-" in lang else "en-US")
        return (
            '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            'xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">'
            f'<voice name="{voice}">'
            f'<lang xml:lang="{locale}">'
            f'<prosody rate="{rate}">'
            f"{escaped}"
            "</prosody>"
            "</lang>"
            "</voice>"
            "</speak>"
        )

    # ── Per-language / en-US voice path ─────────────────────────────────
    # Derive xml:lang from voice name (e.g. "es-ES-ElviraNeural" → "es-ES")
    lang_parts = voice.split("-")
    xml_lang = f"{lang_parts[0]}-{lang_parts[1]}" if len(lang_parts) >= 2 else "en-US"

    # mstts:express-as (style) is only supported for en-US Neural voices
    use_style = xml_lang == "en-US"

    if use_style:
        return (
            '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="{xml_lang}">'
            f'<voice name="{voice}">'
            f'<mstts:express-as style="{style}" styledegree="{style_degree}">'
            f'<prosody rate="{rate}">'
            f"{escaped}"
            "</prosody>"
            "</mstts:express-as>"
            "</voice>"
            "</speak>"
        )
    else:
        return (
            '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="{xml_lang}">'
            f'<voice name="{voice}">'
            f'<prosody rate="{rate}">'
            f"{escaped}"
            "</prosody>"
            "</voice>"
            "</speak>"
        )


# ── STT is handled browser-side via Speech SDK ─────────────────────────────
# The browser uses microsoft-cognitiveservices-speech-sdk with an auth token
# from /api/speech/token. No server-side STT needed.


# ── TTS — synthesize with calm SSML ─────────────────────────────────────────

def synthesize_speech_sync(
    text: str,
    voice: str = "en-US-EmmaMultilingualNeural",
    style: str = "calm",
    rate: str = "slow",
    lang: str | None = None,
) -> dict:
    """Synthesize speech from text with calm SSML (synchronous).

    Returns: {"audio_bytes": bytes, "durationMs": int} or error dict.
    """
    text = strip_markdown_for_speech(text)
    ssml = build_calm_ssml(text, voice=voice, style=style, rate=rate, lang=lang)

    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")
    speech_region = os.environ.get("SPEECH_REGION", "eastus2")
    speech_resource_id = os.environ.get("SPEECH_RESOURCE_ID", "")

    if _LOCAL_DEV or not speech_endpoint:
        return {"audio_bytes": b"", "durationMs": 0, "ssml": ssml, "local_dev": True}

    try:
        import azure.cognitiveservices.speech as speechsdk

        token = _get_credential().get_token("https://cognitiveservices.azure.com/.default")

        speech_config = speechsdk.SpeechConfig(
            auth_token=f"aad#{speech_resource_id}#{token.token}",
            region=speech_region,
        )
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=None
        )

        start = time.monotonic()
        result = synthesizer.speak_ssml_async(ssml).get()
        duration_ms = int((time.monotonic() - start) * 1000)

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info("tts_latency_ms=%d chars=%d voice=%s style=%s", duration_ms, len(text), voice, style)
            return {"audio_bytes": result.audio_data, "durationMs": duration_ms}
        else:
            cancellation = result.cancellation_details
            error_msg = f"Speech synthesis failed: {cancellation.reason}" if cancellation else "Speech synthesis failed."
            logger.warning("tts_failed reason=%s details=%s duration_ms=%d", result.reason, cancellation, duration_ms)
            return {"audio_bytes": b"", "durationMs": duration_ms, "error": error_msg}
    except Exception:
        logger.exception("Speech SDK error during synthesis")
        return {"audio_bytes": b"", "durationMs": 0, "error": "Speech synthesis service error."}


def synthesize_ssml_raw_sync(ssml: str) -> dict:
    """Synthesize speech from pre-built SSML (synchronous).

    Used for multilingual onboarding where the caller provides the full
    SSML string with per-language voice tags.

    Returns: {"audio_bytes": bytes, "durationMs": int} or error dict.
    """
    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")
    speech_region = os.environ.get("SPEECH_REGION", "eastus2")
    speech_resource_id = os.environ.get("SPEECH_RESOURCE_ID", "")

    if _LOCAL_DEV or not speech_endpoint:
        return {"audio_bytes": b"", "durationMs": 0, "ssml": ssml, "local_dev": True}

    try:
        import azure.cognitiveservices.speech as speechsdk

        token = _get_credential().get_token("https://cognitiveservices.azure.com/.default")

        speech_config = speechsdk.SpeechConfig(
            auth_token=f"aad#{speech_resource_id}#{token.token}",
            region=speech_region,
        )
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=None
        )

        start = time.monotonic()
        result = synthesizer.speak_ssml_async(ssml).get()
        duration_ms = int((time.monotonic() - start) * 1000)

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info("tts_multilingual_latency_ms=%d", duration_ms)
            return {"audio_bytes": result.audio_data, "durationMs": duration_ms}
        else:
            cancellation = result.cancellation_details
            error_msg = f"Speech synthesis failed: {cancellation.reason}" if cancellation else "Speech synthesis failed."
            logger.warning("tts_multilingual_failed reason=%s details=%s", result.reason, cancellation)
            return {"audio_bytes": b"", "durationMs": duration_ms, "error": error_msg}
    except Exception:
        logger.exception("Speech SDK error during multilingual synthesis")
        return {"audio_bytes": b"", "durationMs": 0, "error": "Speech synthesis service error."}
