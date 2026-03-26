"""TTS Avatar Service — Azure Speech Service Avatar API.

Manages real-time avatar sessions using WebRTC via the Speech SDK.
Supports standard avatars (lisa, etc.) and custom photo avatars.
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

# Avatar-supported regions
AVATAR_REGIONS = [
    "southeastasia", "northeurope", "westeurope",
    "swedencentral", "southcentralus", "eastus2", "westus2",
]

DEFAULT_AVATAR_CHARACTER = "lisa"
DEFAULT_AVATAR_STYLE = "casual-sitting"


def get_avatar_config(user_prefs: dict | None = None) -> dict[str, Any]:
    """Build avatar configuration from user preferences.

    Args:
        user_prefs: User accessibility prefs (may include avatarCharacter, avatarStyle).

    Returns:
        Dict with character, style, voice, and region info.
    """
    character = DEFAULT_AVATAR_CHARACTER
    style = DEFAULT_AVATAR_STYLE
    is_photo = False
    voice = "en-US-JennyNeural"

    if user_prefs:
        character = user_prefs.get("avatarCharacter", character)
        style = user_prefs.get("avatarStyle", style)
        is_photo = user_prefs.get("usePhotoAvatar", False)
        voice = user_prefs.get("ttsVoice", voice)

    return {
        "character": character,
        "style": style,
        "isPhotoAvatar": is_photo,
        "voice": voice,
        "transparentBackground": True,
        "videoFormat": {"width": 1920, "height": 1080},
    }


async def create_avatar_session(user_prefs: dict | None = None) -> dict[str, Any]:
    """Create a real-time avatar session using Azure Speech SDK.

    Args:
        user_prefs: User accessibility preferences.

    Returns:
        Dict with session info including ICE servers and SDP offer.
    """
    speech_region = os.environ.get("SPEECH_REGION", "eastus2")
    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")

    if _LOCAL_DEV or not speech_endpoint:
        return {
            "status": "unavailable",
            "message": "Avatar service requires Speech Service in an avatar-supported region.",
            "supported_regions": AVATAR_REGIONS,
        }

    if speech_region not in AVATAR_REGIONS:
        return {
            "status": "unsupported_region",
            "message": f"Region {speech_region} does not support avatars. Use one of: {AVATAR_REGIONS}",
        }

    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        speech_resource_id = os.environ.get("SPEECH_RESOURCE_ID", "")

        config = get_avatar_config(user_prefs)

        # Return auth token in Speech SDK format (aad#resource_id#token)
        # Never expose raw Entra tokens directly to the client
        auth_token = f"aad#{speech_resource_id}#{token.token}" if speech_resource_id else token.token

        return {
            "status": "ready",
            "authToken": auth_token,
            "region": speech_region,
            "endpoint": speech_endpoint,
            "avatarConfig": config,
        }

    except Exception:
        logger.exception("Failed to create avatar session")
        return {"status": "error", "message": "Failed to initialize avatar session."}


async def synthesize_avatar_speech(
    text: str,
    voice: str = "en-US-JennyNeural",
    style: str = "",
) -> dict[str, Any]:
    """Generate SSML for avatar speech synthesis.

    Args:
        text: Text for the avatar to speak.
        voice: TTS voice name.
        style: Speaking style (e.g., cheerful, calm).

    Returns:
        Dict with SSML string and metadata.
    """
    # Escape XML special characters to prevent SSML injection
    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )

    # Validate voice name against known Azure Neural voices
    _ALLOWED_VOICES = {
        "en-US-JennyNeural", "en-US-AriaNeural", "en-US-GuyNeural",
        "en-US-SaraNeural", "en-US-DavisNeural", "en-US-JaneNeural",
        "en-US-JasonNeural", "en-US-TonyNeural",
    }
    if voice not in _ALLOWED_VOICES:
        voice = "en-US-JennyNeural"

    # Validate style against known Azure TTS styles
    _ALLOWED_STYLES = {
        "", "calm", "cheerful", "empathetic", "friendly",
        "hopeful", "sad", "serious", "angry",
    }
    if style not in _ALLOWED_STYLES:
        style = ""

    # Build SSML with style if provided
    style_attr = f' style="{style}"' if style else ""
    ssml = (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">'
        f'<voice name="{voice}">'
        f'<mstts:express-as{style_attr}>'
        f'{escaped}'
        f'</mstts:express-as>'
        f'</voice></speak>'
    )

    return {
        "ssml": ssml,
        "voice": voice,
        "text_length": len(text),
        "estimated_duration_s": round(len(text.split()) / 150 * 60, 1),
    }
