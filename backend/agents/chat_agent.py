"""
Chat Agent — Microsoft Agent Framework (azure-ai-projects)

Uses Azure AI Foundry's Agent Service to manage conversational agents.
The agent is created once (or retrieved if it exists) and reused.
Each chat session maps to an Agent Service thread.
"""

import logging
import os
from typing import TYPE_CHECKING

# Azure AI Projects SDK imports are deferred to avoid ImportError when the
# package version changes or when running in LOCAL_DEV mode (where the agent
# path is never actually reached). All Azure objects are imported inside the
# functions that use them so the module loads cleanly in every mode.
if TYPE_CHECKING:
    from azure.ai.projects import AIProjectClient

logger = logging.getLogger(__name__)

# ============================================================================
# Local dev stub
# ============================================================================

def _local_response(message: str) -> str:
    """Return a canned response when no AI Foundry connection is configured.

    Useful for exercising the UI and session persistence without Azure.
    """
    return (
        f"**[Local dev mode]** No AI Foundry project is configured. "
        f"Set `AI_PROJECT_NAME` (and related env vars) to connect to Azure.\n\n"
        f"You said: *{message}*"
    )


# ============================================================================
# Agent configuration
# ============================================================================

AGENT_NAME = "ChatAssistant"
AGENT_MODEL = "gpt-4o-mini"
AGENT_INSTRUCTIONS = """You are a helpful, friendly AI assistant for a chat application.

Your responsibilities:
- Answer questions accurately and concisely
- Be helpful, harmless, and honest
- If you don't know something, say so clearly
- Format responses with markdown when helpful
- Be conversational but professional

You have access to tools that let you search documents and run code.
Use them when they would help answer the user's question.
"""

# Cache the agent ID to avoid recreating it on every invocation
_agent_id: str | None = None
# Cache thread IDs mapped to session IDs
_thread_cache: dict[str, str] = {}


def _get_project_client():
    """Create an AI Project client using managed identity.

    Imports are deferred so this module can be loaded without the Azure AI
    Projects SDK being importable (e.g., when the SDK version changes).
    """
    from azure.identity import DefaultAzureCredential  # noqa: PLC0415
    from azure.ai.projects import AIProjectClient       # noqa: PLC0415

    credential = DefaultAzureCredential()
    endpoint = os.environ.get("AI_FOUNDRY_ENDPOINT", "")
    return AIProjectClient(
        endpoint=endpoint,
        credential=credential,
    )


async def _ensure_agent(client) -> str:
    """Create or retrieve the chat agent. Returns agent ID."""
    global _agent_id
    if _agent_id:
        return _agent_id

    # List existing agents to find ours
    agents = client.agents.list_agents()
    for agent in agents.data:
        if agent.name == AGENT_NAME:
            _agent_id = agent.id
            logger.info(f"Found existing agent: {_agent_id}")
            return _agent_id

    # Create new agent
    agent = client.agents.create_agent(
        model=AGENT_MODEL,
        name=AGENT_NAME,
        instructions=AGENT_INSTRUCTIONS,
        tools=[{"type": "code_interpreter"}],  # Enable code interpreter tool
    )
    _agent_id = agent.id
    logger.info(f"Created new agent: {_agent_id}")
    return _agent_id


async def _get_or_create_thread(client, session_id: str) -> str:
    """Get or create an Agent Service thread for the session. Returns thread ID."""
    if session_id in _thread_cache:
        return _thread_cache[session_id]

    thread = client.agents.create_thread()
    _thread_cache[session_id] = thread.id
    logger.info(f"Created thread {thread.id} for session {session_id}")
    return thread.id


async def get_agent_response(
    message: str,
    session_id: str,
    user_id: str,
) -> str:
    """
    Send a user message to the agent and return the response.

    Args:
        message: The user's message text
        session_id: Chat session ID (maps to agent thread)
        user_id: Authenticated user ID (for audit)

    Returns:
        The agent's text response
    """
    if not os.environ.get("AI_FOUNDRY_ENDPOINT"):
        return _local_response(message)

    client = _get_project_client()

    # Ensure agent exists
    agent_id = await _ensure_agent(client)

    # Get or create thread for this session
    thread_id = await _get_or_create_thread(client, session_id)

    # Add user message to thread
    client.agents.create_message(
        thread_id=thread_id,
        role="user",
        content=message,
    )

    # Run the agent on the thread
    run = client.agents.create_and_process_run(
        thread_id=thread_id,
        agent_id=agent_id,
    )

    if run.status == "failed":
        logger.error(f"Agent run failed: {run.last_error}")
        return "I'm sorry, I encountered an error. Please try again."

    # Get the latest assistant message
    messages = client.agents.list_messages(thread_id=thread_id)

    # Find the most recent assistant message
    for msg in messages.data:
        if msg.role in ("assistant", "agent"):
            # Extract text content from the message
            for content_block in msg.content:
                if hasattr(content_block, "text"):
                    return content_block.text.value

    return "I'm sorry, I couldn't generate a response. Please try again."
