"""TTS Avatar Service — Azure Speech Service Avatar API.

Manages real-time avatar sessions using WebRTC via the Speech SDK
and batch avatar video synthesis via the REST API.
"""

import json
import logging
import os
import uuid
from typing import Any

import requests
from azure.identity import DefaultAzureCredential

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

# Avatar-supported regions
AVATAR_REGIONS = [
    "southeastasia", "northeurope", "westeurope",
    "swedencentral", "southcentralus", "eastus2", "westus2",
]

DEFAULT_AVATAR_CHARACTER = "Lisa"
DEFAULT_AVATAR_STYLE = "casual-sitting"
DEFAULT_AVATAR_VOICE = "en-US-AvaMultilingualNeural"
BATCH_API_VERSION = "2024-04-15-preview"

# Allowed avatar characters (prebuilt)
_ALLOWED_CHARACTERS = {
    "Lisa", "Harry", "Jeff", "Lori", "Max",
}

# Allowed video codecs
_ALLOWED_CODECS = {"h264", "hevc", "vp9"}

# Allowed video formats
_ALLOWED_VIDEO_FORMATS = {"mp4", "webm"}


def _get_auth_headers() -> dict[str, str]:
    """Get authorization headers using DefaultAzureCredential (passwordless)."""
    credential = DefaultAzureCredential()
    token = credential.get_token("https://cognitiveservices.azure.com/.default")
    return {"Authorization": f"Bearer {token.token}"}


def get_avatar_config(user_prefs: dict | None = None) -> dict[str, Any]:
    """Build avatar configuration from user preferences.

    Args:
        user_prefs: User accessibility prefs (may include avatarCharacter, avatarStyle).

    Returns:
        Dict with character, style, voice, and region info.
    """
    character = DEFAULT_AVATAR_CHARACTER
    style = DEFAULT_AVATAR_STYLE
    voice = DEFAULT_AVATAR_VOICE

    if user_prefs:
        character = user_prefs.get("avatarCharacter", character)
        style = user_prefs.get("avatarStyle", style)
        voice = user_prefs.get("ttsVoice", voice)

    return {
        "character": character,
        "style": style,
        "voice": voice,
        "transparentBackground": True,
        "videoFormat": {"width": 1920, "height": 1080},
    }


# ---------------------------------------------------------------------------
# Real-time avatar session (WebRTC via Speech SDK)
# ---------------------------------------------------------------------------


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
        token = DefaultAzureCredential().get_token("https://cognitiveservices.azure.com/.default")
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


# ---------------------------------------------------------------------------
# Batch avatar video synthesis (REST API)
# ---------------------------------------------------------------------------


def submit_batch_synthesis(
    text: str,
    voice: str = DEFAULT_AVATAR_VOICE,
    character: str = DEFAULT_AVATAR_CHARACTER,
    style: str = DEFAULT_AVATAR_STYLE,
    video_format: str = "mp4",
    video_codec: str = "h264",
    background_color: str = "#FFFFFFFF",
    subtitle_type: str = "soft_embedded",
    customized: bool = False,
) -> dict[str, Any]:
    """Submit a batch avatar synthesis job.

    Args:
        text: Plain text for the avatar to speak.
        voice: TTS voice name.
        character: Avatar character name.
        style: Avatar style (required for prebuilt).
        video_format: mp4 or webm.
        video_codec: h264, hevc, or vp9.
        background_color: RGBA hex colour.
        subtitle_type: soft_embedded or none.
        customized: Whether using a customized avatar.

    Returns:
        Dict with job_id and status.
    """
    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")

    if _LOCAL_DEV or not speech_endpoint:
        return {"status": "simulated", "job_id": str(uuid.uuid4())}

    # Validate inputs
    if character not in _ALLOWED_CHARACTERS:
        character = DEFAULT_AVATAR_CHARACTER
    if video_codec not in _ALLOWED_CODECS:
        video_codec = "h264"
    if video_format not in _ALLOWED_VIDEO_FORMATS:
        video_format = "mp4"

    job_id = str(uuid.uuid4())
    url = f"{speech_endpoint}/avatar/batchsyntheses/{job_id}?api-version={BATCH_API_VERSION}"
    headers = {"Content-Type": "application/json"}
    headers.update(_get_auth_headers())

    if customized:
        avatar_config = {
            "customized": True,
            "talkingAvatarCharacter": character,
            "videoFormat": video_format,
            "videoCodec": video_codec,
            "subtitleType": subtitle_type,
            "backgroundColor": background_color,
        }
    else:
        avatar_config = {
            "customized": False,
            "talkingAvatarCharacter": character,
            "talkingAvatarStyle": style,
            "videoFormat": video_format,
            "videoCodec": video_codec,
            "subtitleType": subtitle_type,
            "backgroundColor": background_color,
        }

    payload = {
        "synthesisConfig": {"voice": voice},
        "customVoices": {},
        "inputKind": "plainText",
        "inputs": [{"content": text}],
        "avatarConfig": avatar_config,
    }

    try:
        response = requests.put(url, data=json.dumps(payload), headers=headers, timeout=30)
        if response.status_code < 400:
            result = response.json()
            logger.info("batch_avatar_submitted job_id=%s", result["id"])
            return {"status": "accepted", "job_id": result["id"]}
        else:
            logger.error("batch_avatar_submit_failed status=%d body=%s", response.status_code, response.text)
            return {"status": "error", "error": response.text}
    except Exception:
        logger.exception("Batch avatar submit failed")
        return {"status": "error", "error": "Failed to submit batch avatar synthesis."}


def get_batch_synthesis(job_id: str) -> dict[str, Any]:
    """Check status of a batch avatar synthesis job.

    Args:
        job_id: The job ID returned from submit_batch_synthesis.

    Returns:
        Dict with job status and download URL if succeeded.
    """
    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")

    if _LOCAL_DEV or not speech_endpoint:
        return {"status": "simulated", "job_id": job_id}

    url = f"{speech_endpoint}/avatar/batchsyntheses/{job_id}?api-version={BATCH_API_VERSION}"
    headers = _get_auth_headers()

    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code < 400:
            data = response.json()
            result: dict[str, Any] = {
                "status": data["status"],
                "job_id": job_id,
            }
            if data["status"] == "Succeeded":
                result["download_url"] = data["outputs"]["result"]
                logger.info("batch_avatar_succeeded job_id=%s", job_id)
            elif data["status"] == "Failed":
                logger.error("batch_avatar_failed job_id=%s", job_id)
            return result
        else:
            logger.error("batch_avatar_status_failed status=%d body=%s", response.status_code, response.text)
            return {"status": "error", "job_id": job_id, "error": response.text}
    except Exception:
        logger.exception("Batch avatar status check failed job_id=%s", job_id)
        return {"status": "error", "job_id": job_id, "error": "Failed to check job status."}


def list_batch_syntheses(skip: int = 0, max_page_size: int = 100) -> dict[str, Any]:
    """List batch avatar synthesis jobs.

    Args:
        skip: Number of jobs to skip (pagination).
        max_page_size: Max jobs per page.

    Returns:
        Dict with list of jobs.
    """
    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")

    if _LOCAL_DEV or not speech_endpoint:
        return {"status": "simulated", "jobs": []}

    url = (
        f"{speech_endpoint}/avatar/batchsyntheses"
        f"?api-version={BATCH_API_VERSION}&skip={skip}&maxpagesize={max_page_size}"
    )
    headers = _get_auth_headers()

    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code < 400:
            data = response.json()
            logger.info("batch_avatar_list count=%d", len(data.get("values", [])))
            return {"status": "ok", "jobs": data.get("values", [])}
        else:
            logger.error("batch_avatar_list_failed status=%d body=%s", response.status_code, response.text)
            return {"status": "error", "error": response.text}
    except Exception:
        logger.exception("Batch avatar list failed")
        return {"status": "error", "error": "Failed to list batch avatar jobs."}


# ---------------------------------------------------------------------------
# Avatar speech SSML helper (used by real-time /avatar/speak)
# ---------------------------------------------------------------------------


async def synthesize_avatar_speech(
    text: str,
    voice: str = DEFAULT_AVATAR_VOICE,
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
        "en-US-AvaMultilingualNeural", "en-US-JennyNeural", "en-US-AriaNeural",
        "en-US-GuyNeural", "en-US-SaraNeural", "en-US-DavisNeural",
        "en-US-JaneNeural", "en-US-JasonNeural", "en-US-TonyNeural",
    }
    if voice not in _ALLOWED_VOICES:
        voice = DEFAULT_AVATAR_VOICE

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
