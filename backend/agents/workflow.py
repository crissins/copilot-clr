"""
Sequential Agent Framework Workflow — Copilot CLR

Uses Microsoft Agent Framework SDK (agent-framework-azure-ai==1.0.0rc3)
with AzureAIClient and WorkflowBuilder for a two-stage pipeline:

  IntakeExecutor  →  AgentExecutor
       │                   │
  Load user prefs     AI agent with tools:
  + recent chat       - search_documents
  history as          - search_web
  context             - create/list/update/delete tasks
                      - get_chat_history

Environment variables:
  PROJECT_ENDPOINT            — Azure AI Foundry project endpoint
  MODEL_DEPLOYMENT_NAME       — Model deployment (default: gpt-4o-mini)
  COSMOS_DB_ENDPOINT          — Cosmos DB account endpoint
  COSMOS_DB_DATABASE          — Cosmos DB database name (default: ChatApp)
  BING_SEARCH_API_KEY         — (optional) Bing Search v7 API key

SDK packages (pin these versions):
  agent-framework-azure-ai==1.0.0rc3
  agent-framework-core==1.0.0rc3
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv(override=False)

from agent_framework import Message
from agent_framework.azure import AzureAIClient
from azure.identity.aio import DefaultAzureCredential

from agents.agent_tools import (
    create_task,
    delete_task,
    get_chat_history,
    get_preferences_container,
    list_tasks,
    search_documents,
    search_web,
    set_tool_context,
    update_task,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Agent instructions — Copilot CLR persona + tool-use guidelines
# ============================================================================

_BASE_INSTRUCTIONS = """\
You are Copilot CLR — a calm, supportive AI assistant designed specifically
for neurodiverse users including people with ADHD, autism, and dyslexia.

Communication style:
- Use clear, simple, direct language. Prefer short sentences.
- Break complex ideas into numbered steps whenever possible.
- Never use urgent or anxiety-inducing language.
- Be patient and encouraging. Acknowledge the user's effort.
- Use bullet points and headings to reduce visual clutter.

Responsibilities:
- Answer questions accurately and concisely.
- ALWAYS call search_documents FIRST for ANY question that might relate to
  the user's uploaded content, homework, articles, reports, or study material.
  Do not guess — search first, then answer based on what you find.
- Use search_web when the user needs current or external information not found in documents.
- Use the task tools when the user wants to create, view, update, or complete tasks.
- Use get_chat_history when the user references something said earlier.
- Simplify complex content to the user's preferred reading level.
- If you don't know something, say so clearly.
- Format responses with markdown — headings, bullets, and code blocks where helpful.
- When answering from a document, always cite the source name and page number.

Responsible AI:
- Never produce content that could cause anxiety, distress, or overwhelm.
- Be transparent: if an answer comes from a document, cite which one.
- Treat every user with dignity and assume positive intent.
"""


def _build_instructions(preferences: dict) -> str:
    """Produce agent instructions personalised with user preferences."""
    parts = [_BASE_INSTRUCTIONS]
    if preferences:
        lines = [
            "\nUser preferences (adapt your responses accordingly):",
            f"- Reading level: {preferences.get('readingLevel', 'Grade 5')}",
            f"- Preferred format: {preferences.get('preferredFormat', 'bullet points')}",
            f"- Response length: {preferences.get('responseLengthPreference', 'medium')}",
        ]
        if preferences.get("dyslexiaFont"):
            lines.append(
                "- User has dyslexia-friendly font enabled — keep text structured and clear"
            )
        if preferences.get("reducedMotion"):
            lines.append("- User prefers reduced motion — avoid describing animations")
        if preferences.get("language", "en") != "en":
            lines.append(
                f"- User's preferred language: {preferences.get('language')}"
            )
        parts.append("\n".join(lines))
    return "\n".join(parts)


# ============================================================================
# Stage 1 — Load user context (preferences from Cosmos DB)
# ============================================================================


async def _load_preferences(user_id: str) -> dict:
    """Load accessibility preferences from Cosmos DB."""
    try:
        container = get_preferences_container()
        if container:
            import asyncio
            doc = await asyncio.to_thread(
                container.read_item, item=user_id, partition_key=user_id
            )
            return {k: v for k, v in doc.items() if not k.startswith("_")}
    except Exception:
        logger.debug("No saved preferences for user=%s, using defaults", user_id)
    return {}


# ============================================================================
# Stage 2 — Run the AI agent with tools
# ============================================================================


async def _run_agent(
    messages: list[Message],
    user_id: str,
    session_id: str,
    preferences: dict,
) -> str:
    """Run the Copilot CLR agent with file search, web search, and task tools."""
    set_tool_context(user_id, session_id)

    instructions = _build_instructions(preferences)
    credential = DefaultAzureCredential()

    tools = [
        search_documents,
        search_web,
        create_task,
        list_tasks,
        update_task,
        delete_task,
        get_chat_history,
    ]

    async with AzureAIClient(
        project_endpoint=os.getenv("PROJECT_ENDPOINT", ""),
        model_deployment_name=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"),
        credential=credential,
    ).as_agent(
        name="CopilotCLR-Workflow",
        instructions=instructions,
        tools=tools,
    ) as agent:
        response = await agent.run(messages)
        return response.text if hasattr(response, "text") else str(response)


# ============================================================================
# Public API
# ============================================================================


async def run_workflow(
    message: str,
    session_id: str,
    user_id: str,
) -> str:
    """Execute the sequential Copilot CLR workflow.

    Args:
        message:    The user's message text.
        session_id: Chat session ID (for chat history lookups).
        user_id:    Authenticated Entra ID OID.

    Returns:
        The agent's text response.
    """
    preferences = await _load_preferences(user_id)
    input_messages = [Message(role="user", contents=[message])]
    result = await _run_agent(input_messages, user_id, session_id, preferences)
    return result or "I wasn't able to generate a response. Please try again."
