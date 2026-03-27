"""
Chat Agent — Copilot CLR

Routing logic:
  1. PROJECT_ENDPOINT set       → Agent Framework sequential workflow
  2. AZURE_OPENAI_ENDPOINT set  → Legacy OpenAI Assistants API (fallback)
  3. Neither set                → Local-dev stub response

The public API is unchanged:
    await get_agent_response(message, session_id, user_id) -> str
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

# ============================================================================
# Local dev stub
# ============================================================================


def _local_response(message: str) -> str:
    """Canned response for LOCAL_DEV mode (no Azure connection required)."""
    return (
        f"**[Local dev mode]** No Azure AI endpoint configured. "
        f"Set `PROJECT_ENDPOINT` (Agent Framework) or "
        f"`AZURE_OPENAI_ENDPOINT` (legacy) to connect.\n\n"
        f"You said: *{message}*"
    )


# ============================================================================
# Agent configuration — Copilot CLR persona (used by legacy path only)
# ============================================================================

AGENT_NAME = "Copilot CLRAssistant"
AGENT_MODEL = "gpt-4o-mini"

AGENT_INSTRUCTIONS = """You are Copilot CLR — a calm, supportive AI assistant designed specifically
for neurodiverse users including people with ADHD, autism, and dyslexia.

Your communication style:
- Use clear, simple, direct language. Prefer short sentences.
- Break complex ideas into numbered steps whenever possible.
- Never use urgent or anxiety-inducing language (avoid: "urgent", "immediately", "warning", "deadline").
- Be patient and encouraging. If the user seems confused, gently rephrase.
- Always acknowledge the user's effort before correcting or redirecting.
- Use bullet points and headings in your responses to reduce visual clutter.

Your responsibilities:
- Answer questions accurately and concisely using information from uploaded documents when available.
- Simplify complex documents to the reading level the user has chosen in their preferences.
- Break complex tasks into small, achievable, time-boxed steps.
- If you don't know something, say so clearly and suggest where to look.
- Format all responses with markdown — headings, bullets, and code blocks where helpful.

Responsible AI guidelines you always follow:
- Never produce content that could cause anxiety, distress, or overwhelm.
- Always be transparent: if an answer comes from a document, say which one.
- If a question is outside your knowledge, say so directly rather than guessing.
- Treat every user with dignity and assume positive intent.
"""

# ============================================================================
# Cosmos DB helper — thread ID persistence (legacy path)
# ============================================================================

_cosmos_sessions_container = None


def _get_cosmos_container():
    global _cosmos_sessions_container
    if _cosmos_sessions_container is not None:
        return _cosmos_sessions_container

    cosmos_endpoint = os.environ.get("COSMOS_DB_ENDPOINT", "")
    cosmos_database = os.environ.get("COSMOS_DB_DATABASE", "chatdb")
    if not cosmos_endpoint:
        return None
    from azure.cosmos import CosmosClient  # noqa: PLC0415
    from azure.identity import DefaultAzureCredential  # noqa: PLC0415

    client = CosmosClient(url=cosmos_endpoint, credential=DefaultAzureCredential())
    _cosmos_sessions_container = client.get_database_client(
        cosmos_database
    ).get_container_client("sessions")
    return _cosmos_sessions_container


def _read_thread_id_sync(session_id: str, user_id: str) -> str | None:
    container = _get_cosmos_container()
    if container is None:
        return None
    try:
        doc = container.read_item(item=session_id, partition_key=user_id)
        return doc.get("threadId")
    except Exception:
        return None


def _write_thread_id_sync(session_id: str, user_id: str, thread_id: str) -> None:
    container = _get_cosmos_container()
    if container is None:
        return
    try:
        container.patch_item(
            item=session_id,
            partition_key=user_id,
            patch_operations=[
                {"op": "add", "path": "/threadId", "value": thread_id}
            ],
        )
    except Exception:
        logger.warning(
            "Failed to persist threadId=%s for session=%s", thread_id, session_id
        )


# ============================================================================
# Legacy OpenAI Assistants client (fallback when PROJECT_ENDPOINT is absent)
# ============================================================================


def _get_openai_client_sync():
    from azure.identity import (  # noqa: PLC0415
        DefaultAzureCredential,
        get_bearer_token_provider,
    )
    from openai import AzureOpenAI  # noqa: PLC0415

    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
    )
    return AzureOpenAI(
        azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
        azure_ad_token_provider=token_provider,
        api_version="2025-03-01-preview",
    )


_assistant_id: str | None = None


def _ensure_assistant_sync(client) -> str:
    global _assistant_id
    if _assistant_id:
        return _assistant_id

    assistants = client.beta.assistants.list()
    for assistant in assistants.data:
        if assistant.name == AGENT_NAME:
            _assistant_id = assistant.id
            logger.info("Found existing assistant: %s", _assistant_id)
            return _assistant_id

    assistant = client.beta.assistants.create(
        model=AGENT_MODEL,
        name=AGENT_NAME,
        instructions=AGENT_INSTRUCTIONS,
    )
    _assistant_id = assistant.id
    logger.info("Created new assistant: %s", _assistant_id)
    return _assistant_id


def _get_or_create_thread_sync(client, session_id: str, user_id: str) -> str:
    thread_id = _read_thread_id_sync(session_id, user_id)
    if thread_id:
        return thread_id

    thread = client.beta.threads.create()
    thread_id = thread.id
    _write_thread_id_sync(session_id, user_id, thread_id)
    return thread_id


def _run_assistant_sync(
    client, assistant_id: str, thread_id: str, message: str
) -> str:
    client.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=message,
    )
    run = client.beta.threads.runs.create_and_poll(
        thread_id=thread_id,
        assistant_id=assistant_id,
    )
    if run.status == "failed":
        logger.error("Assistant run failed: %s", run.last_error)
        return (
            "I'm sorry, I had trouble processing that. "
            "Let's try a different approach — could you rephrase your question?"
        )

    messages = client.beta.threads.messages.list(thread_id=thread_id, limit=1)
    for msg in messages.data:
        if msg.role == "assistant":
            for block in msg.content:
                if block.type == "text":
                    return block.text.value

    return "I wasn't able to generate a response. Please try again."


async def _legacy_agent_response(
    message: str, session_id: str, user_id: str
) -> str:
    """Run the legacy OpenAI Assistants path in a background thread."""
    client = await asyncio.to_thread(_get_openai_client_sync)
    assistant_id = await asyncio.to_thread(_ensure_assistant_sync, client)
    thread_id = await asyncio.to_thread(
        _get_or_create_thread_sync, client, session_id, user_id
    )
    return await asyncio.to_thread(
        _run_assistant_sync, client, assistant_id, thread_id, message
    )


# ============================================================================
# Public API — called from main.py
# ============================================================================


async def get_agent_response(
    message: str,
    session_id: str,
    user_id: str,
    ground_with_bing: bool = False,
) -> str:
    """Send a user message to the agent and return the response.

    Routing:
        1. PROJECT_ENDPOINT set       → Agent Framework sequential workflow
        2. AZURE_OPENAI_ENDPOINT set  → Legacy OpenAI Assistants
        3. Neither                    → Local-dev stub

    Args:
        message:          The user's message text.
        session_id:       Chat session ID.
        user_id:          Authenticated Entra ID OID.
        ground_with_bing: If True, enable Bing Grounding for real-time web data.

    Returns:
        The agent's text response.
    """
    # ── Path 1: Agent Framework workflow (preferred) ──
    if os.environ.get("PROJECT_ENDPOINT"):
        from agents.workflow import run_workflow  # noqa: PLC0415

        return await run_workflow(message, session_id, user_id, ground_with_bing=ground_with_bing)

    # ── Path 2: Legacy OpenAI Assistants ──
    if os.environ.get("AZURE_OPENAI_ENDPOINT"):
        return await _legacy_agent_response(message, session_id, user_id)

    # ── Path 3: Local dev ──
    return _local_response(message)
