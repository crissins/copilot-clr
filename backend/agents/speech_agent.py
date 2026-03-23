"""
Speech Agent — Azure AI Foundry Agent Service + Voice Live SDK

Feature 7: Voice Assistant powered by Azure AI Foundry Agent Service
(AIProjectClient + PromptAgentDefinition) with Voice Live for real-time
voice conversation. Calm voice configuration ensures neurodiverse-friendly
delivery.

Architecture:
  - Text chat  (/api/speech/chat):
      Foundry Agent Service (azure-ai-projects) → response text → TTS with calm SSML
  - Real-time voice (/ws/realtime):
      Voice Live SDK with Foundry Agent — calm voice config stored in
      agent metadata and applied at session level

All sync SDK calls run via asyncio.to_thread() to avoid blocking the
event loop.
"""

import asyncio
import base64
import json
import logging
import os
from typing import Optional

from azure.identity import DefaultAzureCredential
from azure.identity.aio import DefaultAzureCredential as AsyncDefaultAzureCredential

from agent_framework import Message
from agent_framework.azure import AzureAIClient
from agents.memory import UserMemoryProvider, CosmosDBHistoryProvider
from agents.agent_tools import (
    search_documents,
    search_web,
    create_task,
    list_tasks,
    update_task,
    delete_task,
    get_chat_history,
    set_tool_context,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Local dev stub
# ============================================================================

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")


def _local_response(message: str) -> dict:
    return {
        "text": (
            f"**[Local dev mode]** Speech agent requires Azure AI Foundry. "
            f"Set `PROJECT_ENDPOINT` to connect.\n\n"
            f"You said: *{message}*"
        ),
        "audio_bytes": b"",
    }


# ============================================================================
# Agent configuration — Speech Assistant persona
# ============================================================================

AGENT_NAME = os.environ.get("SPEECH_AGENT_NAME", "CopilotCLR-SpeechAssistant")
AGENT_MODEL = os.environ.get("SPEECH_MODEL_DEPLOYMENT", "gpt-4o-mini")

AGENT_INSTRUCTIONS = """You are Copilot CLR Speech Assistant — a calm, warm AI designed to help
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
# Calm Voice Configuration — SSML-equivalent for Voice Live sessions
#
# Voice Live manages TTS internally, so instead of building SSML tags we
# configure calm delivery through session voice settings:
#   - Low temperature (0.5) for measured, consistent tone
#   - en-US-JennyNeural: supports calm style natively
#   - Semantic VAD for patient, natural turn-taking
#   - Deep noise suppression + echo cancellation for clean input
# ============================================================================

CALM_VOICE_NAME = os.environ.get(
    "SPEECH_VOICE_NAME", "en-US-Ava:DragonHDLatestNeural"
)

VOICE_LIVE_CONFIG = {
    "session": {
        "voice": {
            "name": CALM_VOICE_NAME,
            "type": "azure-standard",
            "temperature": 0.5,
        },
        "input_audio_transcription": {
            "model": "azure-speech",
        },
        "turn_detection": {
            "type": "azure_semantic_vad",
            "end_of_utterance_detection": {
                "model": "semantic_detection_v1_multilingual",
            },
        },
        "input_audio_noise_reduction": {"type": "azure_deep_noise_suppression"},
        "input_audio_echo_cancellation": {"type": "server_echo_cancellation"},
    }
}


# ============================================================================
# Voice Live config chunking — 512-char metadata limit per key
# ============================================================================

def _chunk_config(config_json: str, limit: int = 512) -> dict:
    """Split Voice Live config JSON into chunked metadata entries (512-char limit)."""
    metadata = {"microsoft.voice-live.configuration": config_json[:limit]}
    remaining = config_json[limit:]
    chunk_num = 1
    while remaining:
        metadata[f"microsoft.voice-live.configuration.{chunk_num}"] = remaining[:limit]
        remaining = remaining[limit:]
        chunk_num += 1
    return metadata


def _reassemble_config(metadata: dict) -> str:
    """Reassemble chunked Voice Live configuration from agent metadata."""
    config = metadata.get("microsoft.voice-live.configuration", "")
    chunk_num = 1
    while f"microsoft.voice-live.configuration.{chunk_num}" in metadata:
        config += metadata[f"microsoft.voice-live.configuration.{chunk_num}"]
        chunk_num += 1
    return config


# ============================================================================
# Cosmos DB helper — conversation ID persistence
# ============================================================================

_cosmos_sessions_container = None


def _get_cosmos_container():
    """Return the sessions Cosmos container, or None in local dev mode."""
    global _cosmos_sessions_container
    if _cosmos_sessions_container is not None:
        return _cosmos_sessions_container

    cosmos_endpoint = os.environ.get("COSMOS_DB_ENDPOINT", "")
    cosmos_database = os.environ.get("COSMOS_DB_DATABASE", "chatdb")
    if not cosmos_endpoint:
        return None
    from azure.cosmos import CosmosClient  # noqa: PLC0415
    client = CosmosClient(url=cosmos_endpoint, credential=DefaultAzureCredential())
    _cosmos_sessions_container = (
        client.get_database_client(cosmos_database).get_container_client("sessions")
    )
    return _cosmos_sessions_container


def _read_conversation_id_sync(session_id: str, user_id: str) -> Optional[str]:
    """Read Foundry conversationId from Cosmos DB sessions document."""
    container = _get_cosmos_container()
    if container is None:
        return None
    try:
        doc = container.read_item(item=session_id, partition_key=user_id)
        return doc.get("speechConversationId")
    except Exception:
        return None


def _write_conversation_id_sync(
    session_id: str, user_id: str, conversation_id: str
) -> None:
    """Patch speechConversationId into the Cosmos DB sessions document."""
    container = _get_cosmos_container()
    if container is None:
        return
    try:
        container.patch_item(
            item=session_id,
            partition_key=user_id,
            patch_operations=[
                {"op": "add", "path": "/speechConversationId", "value": conversation_id}
            ],
        )
    except Exception:
        logger.warning(
            "Failed to persist speechConversationId=%s for session=%s",
            conversation_id, session_id,
        )


# ============================================================================
# Azure AI Foundry Agent Service client (synchronous — via asyncio.to_thread)
# Uses AIProjectClient from azure-ai-projects with PromptAgentDefinition.
# ============================================================================

def _get_project_client_sync():
    """Create AIProjectClient for the Foundry Agent Service."""
    from azure.ai.projects import AIProjectClient  # noqa: PLC0415
    return AIProjectClient(
        endpoint=os.environ.get("PROJECT_ENDPOINT", ""),
        credential=DefaultAzureCredential(),
    )


_agent_ensured = False


def _ensure_agent_sync(client) -> str:
    """Create or verify the Foundry Speech Agent. Returns agent name.

    Uses agents.create_version() with PromptAgentDefinition to create
    the agent with Voice Live configuration stored in metadata.
    """
    global _agent_ensured
    if _agent_ensured:
        return AGENT_NAME

    from azure.ai.projects.models import PromptAgentDefinition  # noqa: PLC0415

    # Check if agent already exists
    try:
        existing = client.agents.get(agent_name=AGENT_NAME)
        if existing:
            logger.info("Found existing Foundry speech agent: %s", AGENT_NAME)
            _agent_ensured = True
            return AGENT_NAME
    except Exception:
        logger.info("Agent %s not found, creating via Foundry Agent Service...", AGENT_NAME)

    # Create agent with Voice Live configuration in metadata
    agent = client.agents.create_version(
        agent_name=AGENT_NAME,
        definition=PromptAgentDefinition(
            model=AGENT_MODEL,
            instructions=AGENT_INSTRUCTIONS,
        ),
        metadata=_chunk_config(json.dumps(VOICE_LIVE_CONFIG)),
    )
    logger.info(
        "Created Foundry speech agent: %s (version %s)",
        agent.name, agent.version,
    )
    _agent_ensured = True
    return AGENT_NAME


async def _run_agent_chat_async(
    message: str,
    session_id: str,
    user_id: str,
) -> dict:
    """Run a single chat turn via Agent Framework with persistent memory.

    Args:
        message:    The user's message text.
        session_id: Chat session ID.
        user_id:    Authenticated user ID.

    Returns:
        {"text": str}
    """
    # Set context vars for tools (like get_chat_history)
    set_tool_context(user_id, session_id)

    credential = AsyncDefaultAzureCredential()
    
    # We use the same tools as the main assistant to provide a unified experience
    tools = [
        search_documents,
        search_web,
        create_task,
        list_tasks,
        update_task,
        delete_task,
        get_chat_history,
    ]

    # Providers:
    # 1. UserMemoryProvider handles name/preference extraction/injection
    # 2. CosmosDBHistoryProvider handles loading/storing conversation history
    memory_provider = UserMemoryProvider()
    history_provider = CosmosDBHistoryProvider(session_id, user_id, load_messages=True)

    async with AzureAIClient(
        project_endpoint=os.environ.get("PROJECT_ENDPOINT", ""),
        model_deployment_name=AGENT_MODEL,
        credential=credential,
    ).as_agent(
        name=AGENT_NAME,
        instructions=AGENT_INSTRUCTIONS,
        tools=tools,
        context_providers=[history_provider, memory_provider],
    ) as agent:
        input_messages = [Message(role="user", content=message)]
        response = await agent.run(input_messages)
        
        text = response.text if hasattr(response, "text") else str(response)
        return {"text": text}


# ============================================================================
# TTS with calm SSML (fallback for text-based endpoint)
# ============================================================================

def _synthesize_calm_speech_sync(text: str) -> str:
    """Generate TTS audio via Azure Speech SDK with calm SSML. Returns base64."""
    from services.speech import synthesize_speech_sync  # noqa: PLC0415

    result = synthesize_speech_sync(text)

    if result.get("local_dev"):
        return ""

    audio_bytes = result.get("audio_bytes", b"")
    if not audio_bytes:
        logger.warning("TTS failed: %s", result.get("error", "unknown"))
        return ""

    return base64.b64encode(audio_bytes).decode("ascii")


# ============================================================================
# Public API — Text chat (called from main.py /api/speech/chat)
# ============================================================================

async def get_speech_agent_response(
    message: str,
    session_id: str,
    user_id: str,
) -> dict:
    """Send a user message to the Foundry Speech Agent and return response + audio.

    Uses Foundry Agent Service (AIProjectClient) for the AI response, then
    synthesizes calm TTS via Azure Speech SDK with SSML for the audio component.

    Returns:
        {"text": str, "audio_base64": str, "sessionId": str}
    """
    project_endpoint = os.environ.get("PROJECT_ENDPOINT", "")
    if _LOCAL_DEV or not project_endpoint:
        result = _local_response(message)
        return {
            "text": result["text"],
            "audio_base64": "",
            "sessionId": session_id,
        }

    # Agent Framework chat — with persistent memory providers
    result = await _run_agent_chat_async(message, session_id, user_id)
    response_text = result["text"]

    # TTS synthesis with calm SSML in a thread
    audio_base64 = await asyncio.to_thread(_synthesize_calm_speech_sync, response_text)

    return {
        "text": response_text,
        "audio_base64": audio_base64,
        "sessionId": session_id,
    }


# ============================================================================
# Public API — Voice Live real-time config (called from main.py /ws/realtime)
# ============================================================================

async def ensure_speech_agent() -> None:
    """Ensure the Foundry speech agent exists (pre-warm on startup)."""
    project_endpoint = os.environ.get("PROJECT_ENDPOINT", "")
    if _LOCAL_DEV or not project_endpoint:
        return
    client = await asyncio.to_thread(_get_project_client_sync)
    await asyncio.to_thread(_ensure_agent_sync, client)


def get_voicelive_agent_config() -> dict:
    """Return the AgentSessionConfig dict for Voice Live connections.

    Used by the WebSocket relay in webpubsub.py to connect Voice Live
    with the Foundry speech agent.  Fields follow the Voice Live SDK's
    AgentSessionConfig contract.
    """
    return {
        "agent_name": AGENT_NAME,
        "agent_version": os.environ.get("SPEECH_AGENT_VERSION"),
        "project_name": os.environ.get(
            "PROJECT_NAME", os.environ.get("AI_PROJECT_NAME", "")
        ),
        "conversation_id": None,
        "foundry_resource_override": os.environ.get("FOUNDRY_RESOURCE_OVERRIDE"),
        "authentication_identity_client_id": os.environ.get(
            "AGENT_AUTHENTICATION_IDENTITY_CLIENT_ID"
        ),
    }


def build_calm_session_request():
    """Build Voice Live RequestSession with calm voice settings.

    This is the SSML-equivalent configuration for Voice Live: calm voice,
    low temperature for measured delivery, semantic VAD for patient
    turn-taking, and noise/echo handling for clean input.
    """
    from azure.ai.voicelive.models import (  # noqa: PLC0415
        InputAudioFormat,
        Modality,
        OutputAudioFormat,
        RequestSession,
        LlmInterimResponseConfig,
        InterimResponseTrigger,
        AzureStandardVoice,
        AudioNoiseReduction,
        AudioEchoCancellation,
        AzureSemanticVadMultilingual,
    )

    interim = LlmInterimResponseConfig(
        triggers=[InterimResponseTrigger.LATENCY],
        latency_threshold_ms=100,
        instructions=(
            "Create brief, calming interim responses while processing. "
            "Use a warm, patient tone. Never say you don't have real-time "
            "access to information when calling tools."
        ),
    )

    return RequestSession(
        modalities=[Modality.TEXT, Modality.AUDIO],
        input_audio_format=InputAudioFormat.PCM16,
        output_audio_format=OutputAudioFormat.PCM16,
        interim_response=interim,
        voice=AzureStandardVoice(name=CALM_VOICE_NAME),
        turn_detection=AzureSemanticVadMultilingual(),
        input_audio_echo_cancellation=AudioEchoCancellation(),
        input_audio_noise_reduction=AudioNoiseReduction(
            type="azure_deep_noise_suppression"
        ),
    )




