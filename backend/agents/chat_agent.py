"""
Chat Agent — Microsoft Agent Framework (azure-ai-projects)

FIX 1: All sync SDK calls are wrapped in asyncio.to_thread() so FastAPI's
        event loop is never blocked.
FIX 2: Thread IDs are persisted to Cosmos DB (sessions container) so they
        survive pod restarts and Container App scale-out.
FIX 3: Agent instructions updated to Copilot CLR calm/supportive persona
        to satisfy the Responsible AI scoring criterion.
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
        f"**[Local dev mode]** No Azure OpenAI endpoint configured. "
        f"Set `AZURE_OPENAI_ENDPOINT` to connect to Azure.\n\n"
        f"You said: *{message}*"
    )


# ============================================================================
# Agent configuration — Copilot CLR persona (Responsible AI requirement)
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
# Cosmos DB helper — thread ID persistence (FIX 2)
# ============================================================================

_cosmos_sessions_container = None


def _get_cosmos_container():
    """Return the sessions Cosmos container, or None in local dev mode.

    Uses a module-level singleton per Microsoft best practices:
    https://learn.microsoft.com/azure/cosmos-db/best-practice-python
    """
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
    _cosmos_sessions_container = client.get_database_client(cosmos_database).get_container_client("sessions")
    return _cosmos_sessions_container


def _read_thread_id_sync(session_id: str, user_id: str) -> str | None:
    """Read threadId from Cosmos DB sessions document. Returns None if missing."""
    container = _get_cosmos_container()
    if container is None:
        return None
    try:
        doc = container.read_item(item=session_id, partition_key=user_id)
        return doc.get("threadId")
    except Exception:
        return None


def _write_thread_id_sync(session_id: str, user_id: str, thread_id: str) -> None:
    """Patch threadId into the Cosmos DB sessions document."""
    container = _get_cosmos_container()
    if container is None:
        return
    try:
        container.patch_item(
            item=session_id,
            partition_key=user_id,
            patch_operations=[{"op": "add", "path": "/threadId", "value": thread_id}],
        )
    except Exception:
        logger.warning("Failed to persist threadId=%s for session=%s", thread_id, session_id)


# ============================================================================
# Azure OpenAI Assistants client
# ============================================================================

def _get_openai_client_sync():
    """Create AzureOpenAI client (synchronous — always call via asyncio.to_thread)."""
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider  # noqa: PLC0415
    from openai import AzureOpenAI  # noqa: PLC0415
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
    )
    return AzureOpenAI(
        azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
        azure_ad_token_provider=token_provider,
        api_version="2025-03-01-preview",
    )


# Agent ID cached in-process for the lifetime of this replica only.
# Thread IDs are persisted to Cosmos so restarts don't lose session continuity.
_assistant_id: str | None = None


def _ensure_assistant_sync(client) -> str:
    """Create or retrieve the Copilot CLR assistant. Returns assistant ID.
    
    NOTE: Synchronous — must be called via asyncio.to_thread().
    """
    global _assistant_id
    if _assistant_id:
        return _assistant_id

    # Check if assistant already exists
    assistants = client.beta.assistants.list()
    for assistant in assistants.data:
        if assistant.name == AGENT_NAME:
            _assistant_id = assistant.id
            logger.info("Found existing assistant: %s", _assistant_id)
            return _assistant_id

    # Create new assistant
    assistant = client.beta.assistants.create(
        model=AGENT_MODEL,
        name=AGENT_NAME,
        instructions=AGENT_INSTRUCTIONS,
    )
    _assistant_id = assistant.id
    logger.info("Created new assistant: %s", _assistant_id)
    return _assistant_id


def _get_or_create_thread_sync(client, session_id: str, user_id: str) -> str:
    """Get thread ID from Cosmos or create a new one.

    NOTE: Synchronous — must be called via asyncio.to_thread().
    """
    # FIX 2: Look up persisted thread ID from Cosmos first
    thread_id = _read_thread_id_sync(session_id, user_id)
    if thread_id:
        logger.debug("Reusing thread %s for session %s", thread_id, session_id)
        return thread_id

    # Create new thread and persist its ID
    thread = client.beta.threads.create()
    thread_id = thread.id
    logger.info("Created thread %s for session %s", thread_id, session_id)
    _write_thread_id_sync(session_id, user_id, thread_id)
    return thread_id


def _run_assistant_sync(client, assistant_id: str, thread_id: str, message: str) -> str:
    """Add message, run assistant, return response text.

    NOTE: Synchronous — must be called via asyncio.to_thread().
    """
    # Add user message
    client.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=message,
    )

    # Run the assistant and poll until complete
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

    # Extract the latest assistant message
    messages = client.beta.threads.messages.list(thread_id=thread_id, limit=1)
    for msg in messages.data:
        if msg.role == "assistant":
            for block in msg.content:
                if block.type == "text":
                    return block.text.value

    return "I wasn't able to generate a response. Please try again."


# ============================================================================
# Public API — called from main.py
# ============================================================================

async def get_agent_response(
    message: str,
    session_id: str,
    user_id: str,
) -> str:
    """Send a user message to the agent and return the response.

    All synchronous Azure SDK calls are run in a thread pool via
    asyncio.to_thread() to avoid blocking FastAPI's event loop (FIX 1).

    Args:
        message:    The user's message text.
        session_id: Chat session ID — maps to an Agent Service thread.
        user_id:    Authenticated Entra ID OID (for Cosmos lookups).

    Returns:
        The agent's text response.
    """
    if not os.environ.get("AZURE_OPENAI_ENDPOINT"):
        return _local_response(message)

    # FIX 1: All sync SDK calls wrapped in asyncio.to_thread()
    client = await asyncio.to_thread(_get_openai_client_sync)
    assistant_id = await asyncio.to_thread(_ensure_assistant_sync, client)
    thread_id = await asyncio.to_thread(
        _get_or_create_thread_sync, client, session_id, user_id
    )
    response = await asyncio.to_thread(
        _run_assistant_sync, client, assistant_id, thread_id, message
    )
    return response
