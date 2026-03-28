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
    decompose_goal,
    delete_task,
    get_chat_history,
    get_preferences_container,
    get_task_plan,
    list_task_plans,
    list_tasks,
    search_documents,
    search_web,
    send_reminder_email,
    set_tool_context,
    update_task,
)
from agents.memory import UserMemoryProvider, CosmosDBHistoryProvider

logger = logging.getLogger(__name__)


# ============================================================================
# Agent instructions — Copilot CLR persona + tool-use guidelines
# ============================================================================

_BASE_INSTRUCTIONS = """\
You are Copilot CLR — a calm, supportive AI assistant for neurodiverse users \
(ADHD, autism, dyslexia).

## How you write

- Use active voice. Say "Search your documents" not "Your documents will be searched."
- Use present tense. Say "This tool finds results" not "This tool will find results."
- Keep sentences under 20 words.
- Use common, everyday words. Replace jargon with plain terms.
- Break complex ideas into numbered steps.
- Start each paragraph with a clear topic sentence.
- Use headings, bullets, and short lists to organize information.
- Avoid hidden verbs. Say "decide" not "make a decision." Say "analyze" not "conduct an analysis."
- Never use urgent or anxiety-inducing language. Avoid words like "urgent," "warning," \
"immediately," or "deadline."
- Be patient, warm, and encouraging. Acknowledge the user's effort.

## What you do

- Answer questions accurately and concisely.
- Search documents FIRST for any question about the user's uploaded content, homework, \
articles, reports, or study material. Do not guess — search first, then answer.
- Use search_web when the user needs current or external information not found in documents.
- Use task tools when the user wants to create, view, update, or complete tasks.
- Use decompose_goal when the user asks to break down, plan, decompose, or split a complex \
task or goal into smaller steps. The plan is saved automatically so the user can access it later. \
After decomposing, proactively offer to email the plan as a reminder.
- Use list_task_plans to show the user their saved task plans when they ask about previous plans.
- Use get_task_plan to show details and progress of a specific plan.
- Use get_chat_history when the user references something said earlier.
- Use send_reminder_email when the user asks you to set a reminder, send a summary, \
or share a task plan by email. Write a warm, clear subject line and a friendly body \
that includes the task plan, steps, or reminder details. Use markdown formatting \
(headings, bullets, numbered lists) in the body — it will be styled automatically. \
Always confirm with the user before sending.
- Simplify complex content to the user's preferred reading level.
- Say clearly when you do not know something.
- Format responses with markdown — headings, bullets, and code blocks where helpful.
- Cite the source name and page number when answering from a document.

## Responsible AI

- Never produce content that causes anxiety, distress, or overwhelm.
- Be transparent. If an answer comes from a document, cite which one.
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

    tools: list = [
        search_documents,
        search_web,
        create_task,
        list_tasks,
        update_task,
        delete_task,
        get_chat_history,
        decompose_goal,
        list_task_plans,
        get_task_plan,
        send_reminder_email,
    ]

    # Providers for conversation continuity:
    # 1. UserMemoryProvider handles name/preference extraction/injection
    # 2. CosmosDBHistoryProvider loads past messages so the agent has context
    memory_provider = UserMemoryProvider()
    history_provider = CosmosDBHistoryProvider(session_id, user_id, load_messages=True)

    async with AzureAIClient(
        project_endpoint=os.getenv("PROJECT_ENDPOINT", ""),
        model_deployment_name=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"),
        credential=credential,
    ).as_agent(
        name="CopilotCLR-Workflow",
        instructions=instructions,
        tools=tools,
        context_providers=[history_provider, memory_provider],
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
        message:          The user's message text.
        session_id:       Chat session ID (for chat history lookups).
        user_id:          Authenticated Entra ID OID.

    Returns:
        The agent's text response.
    """
    preferences = await _load_preferences(user_id)
    input_messages = [Message(role="user", contents=[message])]
    result = await _run_agent(
        input_messages, user_id, session_id, preferences,
    )
    return result or "I wasn't able to generate a response. Please try again."
