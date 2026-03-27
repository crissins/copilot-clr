"""Speech Routes — STT recognition and TTS synthesis with calm SSML.

Endpoints:
  POST /api/speech/recognize  — Transcribe uploaded audio via Azure Speech SDK
  POST /api/speech/synthesize — Generate TTS audio with calm SSML, return MP3
"""

import logging
import os
import time

from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/speech", tags=["speech"])

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

_get_user_id = None


def init_routes(get_user_fn):
    """Wire auth dependency."""
    global _get_user_id
    _get_user_id = get_user_fn


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
    """Build SSML with calm, measured delivery.

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

    # Escape XML special characters in user-provided text
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


# ── POST /api/speech/recognize ──────────────────────────────────────────────

@router.post("/recognize")
async def speech_recognize(req: Request, audio: UploadFile = File(...)) -> JSONResponse:
    """Transcribe uploaded audio to text via Azure Speech SDK.

    Accepts audio file (webm, wav, mp3, ogg).
    Returns: {text, confidence, durationMs}
    """
    from auth.entra import AuthError

    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    audio_bytes = await audio.read()
    if not audio_bytes:
        return JSONResponse({"error": "No audio data received."}, status_code=400)

    if len(audio_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        return JSONResponse({"error": "Audio file too large (max 10 MB)."}, status_code=400)

    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")
    speech_region = os.environ.get("SPEECH_REGION", "eastus2")

    if _LOCAL_DEV or not speech_endpoint:
        return JSONResponse({
            "text": "[Local dev mode] Speech recognition requires Azure Speech Service. "
                    "Set SPEECH_ENDPOINT to enable.",
            "confidence": 0.0,
            "durationMs": 0,
        })

    start = time.monotonic()

    try:
        import azure.cognitiveservices.speech as speechsdk
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")

        speech_config = speechsdk.SpeechConfig(
            auth_token=f"aad#{speech_endpoint}#{token.token}",
            region=speech_region,
        )
        speech_config.speech_recognition_language = "en-US"

        # Write audio to temp file for the SDK
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config,
            )

            result = recognizer.recognize_once()
            duration_ms = int((time.monotonic() - start) * 1000)

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                logger.info(
                    "stt_recognized user=%s chars=%d duration_ms=%d",
                    user_id, len(result.text), duration_ms,
                )
                return JSONResponse({
                    "text": result.text,
                    "confidence": 1.0,
                    "durationMs": duration_ms,
                })
            elif result.reason == speechsdk.ResultReason.NoMatch:
                return JSONResponse({
                    "text": "",
                    "confidence": 0.0,
                    "durationMs": duration_ms,
                    "message": "No speech could be recognized.",
                })
            else:
                logger.warning("stt_error user=%s reason=%s", user_id, result.reason)
                return JSONResponse({
                    "text": "",
                    "confidence": 0.0,
                    "durationMs": duration_ms,
                    "message": "Speech recognition failed.",
                })
        finally:
            import os as _os
            try:
                _os.unlink(tmp_path)
            except OSError:
                pass

    except Exception:
        logger.exception("STT error for user=%s", user_id)
        return JSONResponse(
            {"error": "Speech recognition service error."},
            status_code=502,
        )


# ── POST /api/speech/synthesize ─────────────────────────────────────────────

@router.post("/synthesize")
async def speech_synthesize(req: Request) -> Response:
    """Generate TTS audio with calm SSML. Returns MP3 audio bytes.

    Body: {text, voice?, style?, rate?}
    Response: audio/mpeg binary
    """
    from auth.entra import AuthError

    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    text = body.get("text", "").strip()
    if not text:
        return JSONResponse({"error": "Text is required."}, status_code=400)

    if len(text) > 5000:
        return JSONResponse({"error": "Text must be under 5000 characters."}, status_code=400)

    voice = body.get("voice", "en-US-JennyNeural")
    style = body.get("style", "calm")
    rate = body.get("rate", "slow")
    lang = body.get("lang") or None

    # Strip markdown syntax so TTS reads clean prose
    from services.speech import strip_markdown_for_speech
    text = strip_markdown_for_speech(text)

    ssml = build_calm_ssml(text, voice=voice, style=style, rate=rate, lang=lang)

    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")
    speech_region = os.environ.get("SPEECH_REGION", "eastus2")

    if _LOCAL_DEV or not speech_endpoint:
        return JSONResponse({
            "message": "TTS requires Azure Speech Service. Set SPEECH_ENDPOINT to enable.",
            "ssml": ssml,
        })

    start = time.monotonic()

    try:
        import azure.cognitiveservices.speech as speechsdk
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")

        speech_config = speechsdk.SpeechConfig(
            auth_token=f"aad#{speech_endpoint}#{token.token}",
            region=speech_region,
        )
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=None
        )
        result = synthesizer.speak_ssml_async(ssml).get()

        duration_ms = int((time.monotonic() - start) * 1000)

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info(
                "tts_latency_ms=%d user=%s chars=%d voice=%s style=%s",
                duration_ms, user_id, len(text), voice, style,
            )
            return Response(
                content=result.audio_data,
                media_type="audio/mpeg",
                headers={
                    "X-TTS-Latency-Ms": str(duration_ms),
                    "X-TTS-Voice": voice,
                    "X-TTS-Style": style,
                },
            )
        else:
            logger.warning(
                "tts_failed user=%s reason=%s duration_ms=%d",
                user_id, result.reason, duration_ms,
            )
            return JSONResponse(
                {"error": "Speech synthesis failed."},
                status_code=502,
            )

    except Exception:
        logger.exception("TTS error for user=%s", user_id)
        return JSONResponse(
            {"error": "Speech synthesis service error."},
            status_code=502,
        )
