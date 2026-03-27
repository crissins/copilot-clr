"""
Chat Agent — Copilot CLR

Routing logic:
  1. PROJECT_ENDPOINT set       → Agent Framework sequential workflow
  2. AZURE_OPENAI_ENDPOINT set  → Agent Framework direct agent (fallback)
  3. Neither set                → Local-dev stub response

The public API is unchanged:
    await get_agent_response(message, session_id, user_id) -> str
"""

import logging
import os

from agent_framework import Message
from agent_framework.azure import AzureAIClient
from azure.identity.aio import DefaultAzureCredential

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

AGENT_INSTRUCTIONS = """You are Copilot CLR — a calm, supportive AI assistant for neurodiverse users \
(ADHD, autism, dyslexia).

## How you write

- Use active voice. Say "We found your file" not "Your file has been found."
- Use present tense. Say "This helps you" not "This will help you."
- Keep sentences under 20 words.
- Use common, everyday words. Replace jargon with plain terms.
- Break complex ideas into numbered steps.
- Start each paragraph with a clear topic sentence.
- Use bullet points and headings to reduce visual clutter.
- Avoid hidden verbs. Say "decide" not "make a decision."
- Never use urgent or anxiety-inducing language ("urgent," "immediately," "warning," "deadline").
- Be patient and encouraging. Acknowledge the user's effort before correcting or redirecting.

## What you do

- Answer questions accurately and concisely using uploaded documents when available.
- Simplify complex documents to the reading level the user chose in their preferences.
- Break complex tasks into small, achievable, time-boxed steps.
- Say clearly when you do not know something and suggest where to look.
- Format all responses with markdown — headings, bullets, and code blocks where helpful.

## Responsible AI

- Never produce content that causes anxiety, distress, or overwhelm.
- Be transparent. If an answer comes from a document, say which one.
- If a question falls outside your knowledge, say so directly rather than guessing.
- Treat every user with dignity and assume positive intent.
"""

# ============================================================================
# Fallback — Agent Framework direct agent (when only AZURE_OPENAI_ENDPOINT is set)
# ============================================================================


async def _fallback_agent_response(
    message: str, session_id: str, user_id: str
) -> str:
    """Run the agent directly via Agent Framework using AZURE_OPENAI_ENDPOINT."""
    credential = DefaultAzureCredential()

    async with AzureAIClient(
        project_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
        model_deployment_name=AGENT_MODEL,
        credential=credential,
    ).as_agent(
        name=AGENT_NAME,
        instructions=AGENT_INSTRUCTIONS,
    ) as agent:
        response = await agent.run([Message(role="user", contents=[message])])
        return response.text if hasattr(response, "text") else str(response)


# ============================================================================
# Public API — called from main.py
# ============================================================================


async def get_agent_response(
    message: str,
    session_id: str,
    user_id: str,
) -> str:
    """Send a user message to the agent and return the response.

    Routing:
        1. PROJECT_ENDPOINT set       → Agent Framework sequential workflow
        2. AZURE_OPENAI_ENDPOINT set  → Agent Framework direct agent (fallback)
        3. Neither                    → Local-dev stub

    Args:
        message:          The user's message text.
        session_id:       Chat session ID.
        user_id:          Authenticated Entra ID OID.

    Returns:
        The agent's text response.
    """
    # ── Path 1: Agent Framework workflow (preferred) ──
    if os.environ.get("PROJECT_ENDPOINT"):
        from agents.workflow import run_workflow  # noqa: PLC0415

        return await run_workflow(message, session_id, user_id)

    # ── Path 2: Agent Framework direct agent (fallback) ──
    if os.environ.get("AZURE_OPENAI_ENDPOINT"):
        return await _fallback_agent_response(message, session_id, user_id)

    # ── Path 3: Local dev ──
    return _local_response(message)
