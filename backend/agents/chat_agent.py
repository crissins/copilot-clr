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
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from azure.ai.projects import AIProjectClient

logger = logging.getLogger(__name__)

# ============================================================================
# Local dev stub
# ============================================================================

def _local_response(message: str) -> str:
    """Canned response for LOCAL_DEV mode (no Azure connection required)."""
    return (
        f"**[Local dev mode]** No AI Foundry project configured. "
        f"Set `AI_FOUNDRY_ENDPOINT` to connect to Azure.\n\n"
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

def _get_cosmos_container():
    """Return the sessions Cosmos container, or None in local dev mode."""
    cosmos_endpoint = os.environ.get("COSMOS_DB_ENDPOINT", "")
    cosmos_database = os.environ.get("COSMOS_DB_DATABASE", "chatdb")
    if not cosmos_endpoint:
        return None
    from azure.cosmos import CosmosClient  # noqa: PLC0415
    from azure.identity import DefaultAzureCredential  # noqa: PLC0415
    client = CosmosClient(url=cosmos_endpoint, credential=DefaultAzureCredential())
    return client.get_database_client(cosmos_database).get_container_client("sessions")


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
# Azure AI Projects client
# ============================================================================

def _get_project_client_sync():
    """Create AI Project client (synchronous — always call via asyncio.to_thread)."""
    from azure.identity import DefaultAzureCredential  # noqa: PLC0415
    from azure.ai.projects import AIProjectClient  # noqa: PLC0415
    return AIProjectClient(
        endpoint=os.environ.get("AI_FOUNDRY_ENDPOINT", ""),
        credential=DefaultAzureCredential(),
    )


# Agent ID cached in-process for the lifetime of this replica only.
# Thread IDs are persisted to Cosmos so restarts don't lose session continuity.
_agent_id: str | None = None


def _ensure_agent_sync(client) -> str:
    """Create or retrieve the Copilot CLR agent. Returns agent ID.
    
    NOTE: Synchronous — must be called via asyncio.to_thread().
    """
    global _agent_id
    if _agent_id:
        return _agent_id

    # Check if agent already exists in AI Foundry
    agents = client.agents.list_agents()
    for agent in agents.data:
        if agent.name == AGENT_NAME:
            _agent_id = agent.id
            logger.info("Found existing agent: %s", _agent_id)
            return _agent_id

    # Create new agent with file_search + code_interpreter + custom tools
    agent = client.agents.create_agent(
        model=AGENT_MODEL,
        name=AGENT_NAME,
        instructions=AGENT_INSTRUCTIONS,
        tools=[
            {"type": "code_interpreter"},
            {"type": "file_search"},
        ],
    )
    _agent_id = agent.id
    logger.info("Created new agent: %s", _agent_id)
    return _agent_id


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
    thread = client.agents.create_thread()
    thread_id = thread.id
    logger.info("Created thread %s for session %s", thread_id, session_id)
    _write_thread_id_sync(session_id, user_id, thread_id)
    return thread_id


def _run_agent_sync(client, agent_id: str, thread_id: str, message: str) -> str:
    """Add message, run agent, return response text.

    NOTE: Synchronous — must be called via asyncio.to_thread().
    """
    # Add user message
    client.agents.create_message(
        thread_id=thread_id,
        role="user",
        content=message,
    )

    # Run the agent (blocks until complete)
    run = client.agents.create_and_process_run(
        thread_id=thread_id,
        agent_id=agent_id,
    )

    if run.status == "failed":
        logger.error("Agent run failed: %s", run.last_error)
        return (
            "I'm sorry, I had trouble processing that. "
            "Let's try a different approach — could you rephrase your question?"
        )

    # Extract the latest assistant message
    messages = client.agents.list_messages(thread_id=thread_id)
    for msg in messages.data:
        if msg.role in ("assistant", "agent"):
            for block in msg.content:
                if hasattr(block, "text"):
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
    if not os.environ.get("AI_FOUNDRY_ENDPOINT"):
        return _local_response(message)

    # FIX 1: All sync SDK calls wrapped in asyncio.to_thread()
    client = await asyncio.to_thread(_get_project_client_sync)
    agent_id = await asyncio.to_thread(_ensure_agent_sync, client)
    thread_id = await asyncio.to_thread(
        _get_or_create_thread_sync, client, session_id, user_id
    )
    response = await asyncio.to_thread(
        _run_agent_sync, client, agent_id, thread_id, message
    )
    return response
