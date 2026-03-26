"""
Task Decomposer — AI Foundry Agent for breaking complex goals into steps.
Uses the Azure AI Foundry Agent Framework to decompose a complex goal
into numbered, time-boxed sub-tasks with priority, duration, and focus tips.
All sync SDK calls are wrapped in asyncio.to_thread() to avoid blocking
FastAPI's event loop (consistent with chat_agent.py pattern).
RAI: Instructions enforce calm, supportive language — no urgency words.
"""
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ============================================================================
# Agent instructions — calm, supportive persona (RAI requirement)
# ============================================================================
DECOMPOSER_INSTRUCTIONS = """You are the Task Decomposer for Copilot CLR — a calm, supportive AI assistant
designed for neurodiverse users including people with ADHD, autism, and dyslexia.

Your job is to take a complex goal and break it into clear, numbered, time-boxed sub-tasks.

Rules you MUST follow:
1. Every step must have an estimated duration in minutes. No step should be "open-ended."
2. Keep each step short and achievable — ideally 5 to 30 minutes.
3. Use calm, encouraging language. NEVER use urgency words like "immediately," "ASAP,"
   "urgent," "deadline," "warning," or "hurry."
4. Write at a clear, simple reading level. Prefer short sentences.
5. Include a brief focus tip for each step — a practical suggestion to stay on track.
6. Assign a priority to each step: "high", "medium", or "low".
7. Order steps logically — dependencies first.

When the user asks "why did you split it this way?" — explain your reasoning clearly
and transparently. Mention which parts seemed complex and why you chose the groupings.

You MUST respond with valid JSON in this exact format (no markdown, no extra text):
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

DECOMPOSER_AGENT_NAME = "Copilot CLR Task Decomposer"
DECOMPOSER_MODEL = "gpt-4o-mini"


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
            "Set AI_FOUNDRY_ENDPOINT to connect to Azure for real decomposition."
        ),
    }


# ============================================================================
# AI Foundry Agent calls (synchronous — always run via asyncio.to_thread)
# ============================================================================
_decomposer_agent_id: str | None = None


def _ensure_decomposer_agent_sync(client) -> str:
    """Create or retrieve the Task Decomposer agent. Returns agent ID."""
    global _decomposer_agent_id
    if _decomposer_agent_id:
        return _decomposer_agent_id

    agents = client.agents.list_agents()
    for agent in agents:
        if agent.name == DECOMPOSER_AGENT_NAME:
            _decomposer_agent_id = agent.id
            logger.info("Found existing decomposer agent: %s", _decomposer_agent_id)
            return _decomposer_agent_id

    agent = client.agents.create_agent(
        model=DECOMPOSER_MODEL,
        name=DECOMPOSER_AGENT_NAME,
        instructions=DECOMPOSER_INSTRUCTIONS,
    )
    _decomposer_agent_id = agent.id
    logger.info("Created new decomposer agent: %s", _decomposer_agent_id)
    return _decomposer_agent_id


def _run_decomposition_sync(client, agent_id: str, goal: str, reading_level: str) -> dict:
    """Send goal to decomposer agent, parse structured JSON response."""
    thread = client.agents.threads.create()

    prompt = f"Break down this goal into time-boxed steps: {goal}"
    if reading_level:
        prompt += f"\n\nWrite the steps at reading level: grade {reading_level}."

    client.agents.messages.create(
        thread_id=thread.id,
        role="user",
        content=prompt,
    )

    run = client.agents.runs.create_and_process(
        thread_id=thread.id,
        agent_id=agent_id,
    )

    if run.status == "failed":
        logger.error("Decomposer agent run failed: %s", run.last_error)
        return {
            "steps": [],
            "explanation": (
                "I had a little trouble breaking that down. "
                "Could you try rephrasing your goal?"
            ),
        }

    messages = client.agents.messages.list(thread_id=thread.id)
    for msg in messages:
        if msg.role in ("assistant", "agent"):
            for block in msg.content:
                if hasattr(block, "text"):
                    raw_text = block.text.value
                    return _parse_decomposition(raw_text)

    return {
        "steps": [],
        "explanation": "I was not able to generate steps. Please try again.",
    }


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

    Args:
        goal:          The user's complex goal text.
        user_id:       Authenticated user ID.
        reading_level: Optional grade level for step language.

    Returns:
        Dict with 'steps' list and 'explanation' string.
    """
    if not os.environ.get("AI_FOUNDRY_ENDPOINT"):
        return _local_decompose(goal)

    from azure.identity import DefaultAzureCredential  # noqa: PLC0415
    from azure.ai.projects import AIProjectClient  # noqa: PLC0415

    client = await asyncio.to_thread(
        lambda: AIProjectClient(
            endpoint=os.environ["AI_FOUNDRY_ENDPOINT"],
            credential=DefaultAzureCredential(),
        )
    )

    agent_id = await asyncio.to_thread(_ensure_decomposer_agent_sync, client)

    result = await asyncio.to_thread(
        _run_decomposition_sync, client, agent_id, goal, reading_level
    )

    return result
