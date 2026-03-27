"""
Task Decomposer — AI Foundry Agent for breaking complex goals into steps.

Uses Microsoft Agent Framework SDK (agent-framework-azure-ai) with
AzureAIClient to decompose a complex goal into numbered, time-boxed
sub-tasks with priority, duration, and focus tips.

Consistent with workflow.py and speech_agent.py patterns — uses
AzureAIClient.as_agent() with async DefaultAzureCredential.

RAI: Instructions enforce calm, supportive language — no urgency words.
"""

import json
import logging
import os
import uuid

from agent_framework import Message
from agent_framework.azure import AzureAIClient
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

# ============================================================================
# Agent instructions — calm, supportive persona (RAI requirement)
# ============================================================================

DECOMPOSER_INSTRUCTIONS = """You are the Task Decomposer for Copilot CLR — a calm, supportive AI assistant \
for neurodiverse users (ADHD, autism, dyslexia).

Your job: Take a complex goal and break it into clear, numbered, time-boxed sub-tasks.

## How you write

- Use active voice. Say "Read the first section" not "The first section should be read."
- Use present tense. Say "This step takes 10 minutes" not "This step will take 10 minutes."
- Keep sentences under 15 words.
- Use common, everyday words. Replace jargon with plain terms.
- Avoid hidden verbs. Say "review" not "conduct a review."
- Never use urgency words: "immediately," "ASAP," "urgent," "deadline," "warning," or "hurry."
- Be calm and encouraging.

## Rules

1. Give every step an estimated duration in minutes. No open-ended steps.
2. Keep each step short and achievable — 5 to 30 minutes.
3. Include a brief focus tip for each step — a practical way to stay on track.
4. Assign a priority to each step: "high," "medium," or "low."
5. Order steps logically — dependencies first.
6. When the user asks "why did you split it this way?" — explain your reasoning clearly.

## Output format

Respond with valid JSON only (no markdown, no extra text):
{
  "steps": [
    {
      "title": "Clear description of what to do",
      "estimatedMinutes": 15,
      "priority": "high",
      "focusTip": "A helpful tip for staying focused on this step"
    }
  ],
  "explanation": "Brief explanation of why you split the goal this way"
}
"""

DECOMPOSER_AGENT_NAME = "Copilot-CLR-Task-Decomposer"
DECOMPOSER_MODEL = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")


# ============================================================================
# Local dev stub
# ============================================================================

def _local_decompose(goal: str) -> dict:
    """Return sample decomposition for LOCAL_DEV mode."""
    return {
        "steps": [
            {
                "id": str(uuid.uuid4()),
                "title": f"Research what is needed for: {goal[:60]}",
                "estimatedMinutes": 10,
                "priority": "high",
                "focusTip": "Find a quiet spot and set a 10-minute timer.",
                "completed": False,
                "completedAt": None,
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Gather the required materials or information",
                "estimatedMinutes": 15,
                "priority": "high",
                "focusTip": "Make a short list before you start gathering.",
                "completed": False,
                "completedAt": None,
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Work through the first section step by step",
                "estimatedMinutes": 20,
                "priority": "medium",
                "focusTip": "Take a short break after this step if you need one.",
                "completed": False,
                "completedAt": None,
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Review what you have done so far",
                "estimatedMinutes": 10,
                "priority": "medium",
                "focusTip": "Read through your work slowly — no rush.",
                "completed": False,
                "completedAt": None,
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Complete the remaining parts and finish up",
                "estimatedMinutes": 15,
                "priority": "low",
                "focusTip": "You are almost there — take it one piece at a time.",
                "completed": False,
                "completedAt": None,
            },
        ],
        "explanation": (
            "[Local dev mode] This is a sample decomposition. "
            "Set PROJECT_ENDPOINT to connect to Azure for real decomposition."
        ),
    }


# ============================================================================
# JSON response parser
# ============================================================================

def _parse_decomposition(raw_text: str) -> dict:
    """Parse the agent's JSON response, handling markdown code fences."""
    text = raw_text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse decomposition JSON: %s", text[:200])
        return {
            "steps": [],
            "explanation": (
                "I had trouble formatting the steps. "
                "Let me try again — please rephrase your goal."
            ),
        }

    steps = data.get("steps", [])
    enriched_steps = []
    for step in steps:
        enriched_steps.append({
            "id": str(uuid.uuid4()),
            "title": step.get("title", "Untitled step"),
            "estimatedMinutes": step.get("estimatedMinutes", 15),
            "priority": step.get("priority", "medium"),
            "focusTip": step.get("focusTip", "Take your time with this step."),
            "completed": False,
            "completedAt": None,
        })

    return {
        "steps": enriched_steps,
        "explanation": data.get("explanation", ""),
    }


# ============================================================================
# Public API — called from main.py
# ============================================================================

async def decompose_task(
    goal: str,
    user_id: str,
    reading_level: str = "",
) -> dict:
    """Decompose a complex goal into time-boxed steps.

    Uses Agent Framework SDK (AzureAIClient.as_agent()) with async
    DefaultAzureCredential — same pattern as workflow.py and speech_agent.py.

    Args:
        goal:          The user's complex goal text.
        user_id:       Authenticated user ID.
        reading_level: Optional grade level for step language.

    Returns:
        Dict with 'steps' list and 'explanation' string.
    """
    if not os.environ.get("PROJECT_ENDPOINT"):
        return _local_decompose(goal)

    prompt = f"Break down this goal into time-boxed steps: {goal}"
    if reading_level:
        prompt += f"\n\nWrite the steps at reading level: grade {reading_level}."

    credential = DefaultAzureCredential()

    async with AzureAIClient(
        project_endpoint=os.environ["PROJECT_ENDPOINT"],
        model_deployment_name=DECOMPOSER_MODEL,
        credential=credential,
    ).as_agent(
        name=DECOMPOSER_AGENT_NAME,
        instructions=DECOMPOSER_INSTRUCTIONS,
    ) as agent:
        response = await agent.run([Message(role="user", contents=[prompt])])
        raw_text = response.text if hasattr(response, "text") else str(response)

    return _parse_decomposition(raw_text)