"""
Speech Agent — Azure OpenAI Chat Completions + Azure Speech TTS/STT

Feature 7: Speech Assistant that combines STT, AI chat completions, and
TTS with calm SSML. Uses gpt-5.4-nano via AzureOpenAI.

All Azure SDK calls run via asyncio.to_thread() to avoid blocking the
event loop.
"""

import asyncio
import base64
import logging
import os

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

logger = logging.getLogger(__name__)

# ============================================================================
# Local dev stub
# ============================================================================

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")


def _local_response(message: str) -> dict:
    return {
        "text": (
            f"**[Local dev mode]** Speech agent requires Azure OpenAI. "
            f"Set `AZURE_OPENAI_ENDPOINT` and `SPEECH_MODEL_DEPLOYMENT` to connect.\n\n"
            f"You said: *{message}*"
        ),
        "audio_bytes": b"",
    }


# ============================================================================
# Agent configuration — Speech Assistant persona
# ============================================================================

AGENT_NAME = "CopilotCLR-SpeechAssistant"
AGENT_MODEL = os.environ.get("SPEECH_MODEL_DEPLOYMENT", "gpt-5.4-nano")

SYSTEM_PROMPT = """You are Copilot CLR Speech Assistant — a calm, warm AI designed to help
neurodiverse users (ADHD, autism, dyslexia) through voice conversation.

Your communication style:
- Use clear, simple, direct language. Prefer short sentences (under 15 words each).
- Break complex ideas into numbered steps.
- Never use urgent or anxiety-inducing language.
- Be patient and encouraging. Acknowledge the user's effort.
- Responses should be concise — optimized for being spoken aloud.
- Limit responses to 3-4 sentences unless the user asks for more detail.

Your responsibilities:
- Simplify complex content so it can be comfortably spoken and understood.
- Answer questions accurately and concisely.
- When you receive transcribed speech input, respond naturally as in conversation.
- Format for spoken delivery — avoid markdown, code blocks, or visual formatting.
- Use natural pauses by inserting commas and periods at logical breaks.

Responsible AI:
- Never produce content that could cause anxiety, distress, or overwhelm.
- Be transparent about what you know and don't know.
- Treat every user with dignity and assume positive intent.
"""


# ============================================================================
# Azure OpenAI client helpers
# ============================================================================

def _get_openai_client_sync() -> AzureOpenAI:
    """Build an AzureOpenAI client with Entra ID auth."""
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    )
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_ad_token_provider=token_provider,
        api_version="2025-03-01-preview",
    )


def _chat_sync(client: AzureOpenAI, message: str) -> str:
    """Run a chat completion with the speech persona. Returns assistant text."""
    response = client.chat.completions.create(
        model=AGENT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        temperature=0.7,
        max_completion_tokens=512,
    )
    return response.choices[0].message.content or ""


def _synthesize_calm_speech_sync(text: str) -> str:
    """Generate TTS audio via Azure Speech SDK. Returns base64 audio or empty."""
    from services.speech import synthesize_speech_sync

    result = synthesize_speech_sync(text)

    if result.get("local_dev"):
        return ""

    audio_bytes = result.get("audio_bytes", b"")
    if not audio_bytes:
        logger.warning("TTS failed: %s", result.get("error", "unknown"))
        return ""

    return base64.b64encode(audio_bytes).decode("ascii")


# ============================================================================
# Public API — called from main.py
# ============================================================================

async def get_speech_agent_response(
    message: str,
    session_id: str,
    user_id: str,
) -> dict:
    """Send a user message to the Speech Assistant and return response + audio.

    Returns:
        {"text": str, "audio_base64": str, "sessionId": str}
    """
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    if _LOCAL_DEV or not endpoint:
        result = _local_response(message)
        return {
            "text": result["text"],
            "audio_base64": "",
            "sessionId": session_id,
        }

    # Chat completion in a thread to avoid blocking
    client = await asyncio.to_thread(_get_openai_client_sync)
    response_text = await asyncio.to_thread(_chat_sync, client, message)

    # TTS synthesis in a thread
    audio_base64 = await asyncio.to_thread(_synthesize_calm_speech_sync, response_text)

    return {
        "text": response_text,
        "audio_base64": audio_base64,
        "sessionId": session_id,
    }


async def transcribe_audio_for_speech(audio_bytes: bytes) -> dict:
    """Transcribe audio bytes via Azure Speech SDK (runs in thread pool).

    Returns: {"text": str, "confidence": float, "durationMs": int}
    """
    from services.speech import transcribe_audio_sync

    return await asyncio.to_thread(transcribe_audio_sync, audio_bytes)
