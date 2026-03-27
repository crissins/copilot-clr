"""Avatar & Audio Routes — TTS Avatar sessions, batch avatar video, and audio snippets.

Endpoints:
  POST /api/avatar/session       — Create avatar WebRTC session
  POST /api/avatar/speak         — Generate SSML for avatar speech
  POST /api/avatar/batch         — Submit batch avatar video synthesis
  GET  /api/avatar/batch/{id}    — Check batch avatar job status
  GET  /api/avatar/batch         — List batch avatar jobs
  POST /api/tts/batch            — Generate audio for content audio scripts
"""

import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["avatar"])

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

# Strict UUID pattern for job IDs
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

_get_user_id = None
_preferences_container = None
_adapted_container = None


def init_routes(get_user_fn, prefs_ctr, adapted_ctr):
    """Wire dependencies."""
    global _get_user_id, _preferences_container, _adapted_container
    _get_user_id = get_user_fn
    _preferences_container = prefs_ctr
    _adapted_container = adapted_ctr


@router.post("/avatar/session")
async def create_avatar_session(req: Request) -> JSONResponse:
    """Create a real-time TTS avatar session.

    Returns token and config for client-side Speech SDK WebRTC setup.
    """
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    # Load user prefs for avatar config
    user_prefs = None
    try:
        user_prefs = _preferences_container.read_item(item=user_id, partition_key=user_id)
    except Exception:
        pass

    from services.avatar import create_avatar_session as create_session
    result = await create_session(user_prefs)

    if result.get("status") == "ready":
        logger.info("avatar_session_created user=%s", user_id)
    else:
        logger.warning("avatar_session_unavailable user=%s reason=%s", user_id, result.get("message", ""))

    return JSONResponse(result)


@router.post("/avatar/speak")
async def avatar_speak(req: Request) -> JSONResponse:
    """Send text to avatar for speech synthesis.

    Body: {text, voice?, style?}
    Returns: SSML and metadata for client-side avatar speech.
    """
    from auth.entra import AuthError
    try:
        _get_user_id(req.headers.get("Authorization"))
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

    from services.avatar import synthesize_avatar_speech
    result = await synthesize_avatar_speech(
        text=text,
        voice=body.get("voice", "en-US-AvaMultilingualNeural"),
        style=body.get("style", ""),
    )
    return JSONResponse(result)


# ---------------------------------------------------------------------------
# Batch avatar video synthesis
# ---------------------------------------------------------------------------


@router.post("/avatar/batch")
async def submit_avatar_batch(req: Request) -> JSONResponse:
    """Submit a batch avatar video synthesis job.

    Body: {text, voice?, character?, style?, videoFormat?, videoCodec?,
           backgroundColor?, subtitleType?, customized?}
    Returns: {status, job_id}
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

    if len(text) > 10000:
        return JSONResponse({"error": "Text must be under 10000 characters."}, status_code=400)

    from services.avatar import submit_batch_synthesis
    result = submit_batch_synthesis(
        text=text,
        voice=body.get("voice", "en-US-AvaMultilingualNeural"),
        character=body.get("character", "Lisa"),
        style=body.get("style", "casual-sitting"),
        video_format=body.get("videoFormat", "mp4"),
        video_codec=body.get("videoCodec", "h264"),
        background_color=body.get("backgroundColor", "#FFFFFFFF"),
        subtitle_type=body.get("subtitleType", "soft_embedded"),
        customized=body.get("customized", False),
    )

    if result.get("status") == "accepted":
        logger.info("avatar_batch_submitted user=%s job_id=%s", user_id, result.get("job_id"))
    else:
        logger.warning("avatar_batch_failed user=%s error=%s", user_id, result.get("error", ""))

    return JSONResponse(result)


@router.get("/avatar/batch/{job_id}")
async def get_avatar_batch_status(req: Request, job_id: str) -> JSONResponse:
    """Check status of a batch avatar synthesis job.

    Returns: {status, job_id, download_url?}
    """
    from auth.entra import AuthError
    try:
        _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    if not _UUID_RE.match(job_id):
        return JSONResponse({"error": "Invalid job ID format."}, status_code=400)

    from services.avatar import get_batch_synthesis
    result = get_batch_synthesis(job_id)
    return JSONResponse(result)


@router.get("/avatar/batch")
async def list_avatar_batch_jobs(req: Request) -> JSONResponse:
    """List batch avatar synthesis jobs.

    Query params: skip (int), maxPageSize (int)
    Returns: {status, jobs[]}
    """
    from auth.entra import AuthError
    try:
        _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    skip = int(req.query_params.get("skip", "0"))
    max_page_size = min(int(req.query_params.get("maxPageSize", "100")), 100)

    from services.avatar import list_batch_syntheses
    result = list_batch_syntheses(skip=skip, max_page_size=max_page_size)
    return JSONResponse(result)


@router.post("/tts/batch")
async def generate_audio_batch(req: Request) -> JSONResponse:
    """Generate TTS audio for adapted content audio script chunks.

    Body: {adaptedContentId}
    Returns: List of audio chunk metadata with blob URLs.
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

    adapted_id = body.get("adaptedContentId", "")
    if not adapted_id:
        return JSONResponse({"error": "adaptedContentId is required."}, status_code=400)

    try:
        adapted_doc = _adapted_container.read_item(item=adapted_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Adapted content not found."}, status_code=404)

    audio_scripts = adapted_doc.get("audioScripts", [])
    if not audio_scripts:
        return JSONResponse({"error": "No audio scripts found."}, status_code=400)

    speech_endpoint = os.environ.get("SPEECH_ENDPOINT", "")
    speech_region = os.environ.get("SPEECH_REGION", "eastus")

    if _LOCAL_DEV or not speech_endpoint:
        # Return script metadata without actual audio generation
        return JSONResponse({
            "adaptedContentId": adapted_id,
            "chunks": [
                {
                    "index": script["index"],
                    "text": script["text"][:100] + "...",
                    "estimatedDurationS": script["estimated_duration_s"],
                    "status": "simulated",
                }
                for script in audio_scripts
            ],
            "message": "Audio generation requires Speech Service. Scripts ready for synthesis.",
        })

    # Generate audio for each chunk
    generated = []
    try:
        import azure.cognitiveservices.speech as speechsdk
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")

        # Use SPEECH_RESOURCE_ID for the aad# format, not the endpoint URL
        speech_resource_id = os.environ.get("SPEECH_RESOURCE_ID", "")
        auth_token = f"aad#{speech_resource_id}#{token.token}" if speech_resource_id else token.token

        speech_config = speechsdk.SpeechConfig(
            auth_token=auth_token,
            region=speech_region,
        )
        speech_config.speech_synthesis_voice_name = "en-US-JennyNeural"
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

        for script in audio_scripts[:20]:  # Limit batch to 20 chunks
            start = time.monotonic()
            result = synthesizer.speak_text_async(script["text"]).get()
            duration_ms = int((time.monotonic() - start) * 1000)

            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                # Store audio in blob
                audio_id = str(uuid.uuid4())
                storage_account = os.environ.get("STORAGE_ACCOUNT_NAME", "")
                blob_url = ""
                if storage_account:
                    try:
                        from azure.storage.blob import BlobServiceClient
                        blob_svc = BlobServiceClient(
                            account_url=f"https://{storage_account}.blob.core.windows.net",
                            credential=credential,
                        )
                        blob_ctr = blob_svc.get_container_client("audio-clips")
                        try:
                            blob_ctr.create_container()
                        except Exception:
                            pass
                        blob_name = f"{user_id}/{adapted_id}/{audio_id}.mp3"
                        blob_ctr.upload_blob(name=blob_name, data=result.audio_data, overwrite=True)
                        blob_url = f"https://{storage_account}.blob.core.windows.net/audio-clips/{blob_name}"
                    except Exception:
                        logger.warning("Audio blob upload failed for chunk %d", script["index"])

                generated.append({
                    "index": script["index"],
                    "audioId": audio_id,
                    "blobUrl": blob_url,
                    "durationMs": duration_ms,
                    "status": "generated",
                })
            else:
                generated.append({"index": script["index"], "status": "failed"})

        logger.info("tts_batch_complete adapted_id=%s chunks=%d", adapted_id, len(generated))

    except Exception:
        logger.exception("TTS batch generation failed")
        return JSONResponse({"error": "Audio generation failed."}, status_code=500)

    return JSONResponse({
        "adaptedContentId": adapted_id,
        "chunks": generated,
    })
