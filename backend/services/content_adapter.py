"""Content Adaptation — Multi-Agent Workflow.

Orchestrates specialized agents via Microsoft Agent Framework to
transform extracted content into adapted versions for neurodiverse users.
Agents: Analyzer, Simplifier, TaskDecomposer, ContentFormatter.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import textstat

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

# Neurodiverse profile presets
PROFILES = {
    "low": {
        "target_grade": 2,
        "description": "Very Easy — short sentences, common words, maximum bullet points",
        "max_sentence_words": 8,
    },
    "medium": {
        "target_grade": 5,
        "description": "Easy — clear language, structured sections, moderate detail",
        "max_sentence_words": 15,
    },
    "high": {
        "target_grade": 8,
        "description": "Standard — full detail with clear structure",
        "max_sentence_words": 25,
    },
    "adhd": {
        "target_grade": 5,
        "description": "ADHD-optimized — ultra-short chunks, bold key actions, time estimates",
        "max_sentence_words": 10,
        "extra_instructions": (
            "Break every section into chunks of 2-3 sentences max. "
            "Bold the single most important action in each chunk. "
            "Add a time estimate (e.g., ‘~2 min’) to each chunk. "
            "Use ✅ checkboxes for actionable items. "
            "Avoid walls of text — white space is critical."
        ),
    },
    "dyslexia": {
        "target_grade": 4,
        "description": "Dyslexia-friendly — simple vocabulary, sans-serif implied, no dense paragraphs",
        "max_sentence_words": 10,
        "extra_instructions": (
            "Use only common, concrete words. Avoid homophones and abstract terms. "
            "Never use more than 2 sentences in a row without a line break. "
            "Use numbered lists instead of long paragraphs. "
            "Avoid italics. Use bold sparingly for key terms only."
        ),
    },
}


async def adapt_content(
    source_text: str,
    profile: str = "medium",
    user_prefs: dict | None = None,
    content_id: str = "",
) -> dict[str, Any]:
    """Run the multi-agent content adaptation workflow.

    Args:
        source_text: Extracted text from the source document.
        profile: Reading level profile (low, medium, high, adhd, dyslexia).
        user_prefs: User accessibility preferences from Cosmos DB.
        content_id: Source content document ID.

    Returns:
        Dict with adapted_text, audio_scripts, metadata.
    """
    if not source_text.strip():
        return {"error": "No source text to adapt", "adapted_text": "", "audio_scripts": []}

    profile_config = PROFILES.get(profile, PROFILES["medium"])

    # Step 1: Analyze source
    analysis = _analyze_source(source_text)

    # Step 2: Build adaptation prompt
    adapted = await _run_adaptation(source_text, profile_config, analysis, user_prefs)

    # Step 3: Generate audio script chunks (30s max each)
    audio_scripts = _generate_audio_scripts(adapted["adapted_text"])

    # Step 4: Generate task decomposition if content has instructions
    tasks = []
    if analysis.get("has_instructions"):
        tasks = _decompose_tasks(adapted["adapted_text"])

    result = {
        "content_id": content_id or str(uuid.uuid4()),
        "profile": profile,
        "source_analysis": analysis,
        "adapted_text": adapted["adapted_text"],
        "summary": adapted.get("summary", ""),
        "audio_scripts": audio_scripts,
        "tasks": tasks,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info(
        "content_adapted profile=%s source_grade=%.1f target_grade=%d audio_chunks=%d",
        profile, analysis["fkgl"], profile_config["target_grade"], len(audio_scripts),
    )
    return result


def _analyze_source(text: str) -> dict[str, Any]:
    """Analyze source text for reading level, structure, and key concepts."""
    word_count = textstat.lexicon_count(text)
    fkgl = textstat.flesch_kincaid_grade(text) if word_count >= 10 else 0.0
    sentence_count = textstat.sentence_count(text)
    has_instructions = any(
        kw in text.lower()
        for kw in ["step", "first", "then", "next", "finally", "instructions", "procedure", "how to"]
    )
    return {
        "fkgl": round(fkgl, 1),
        "word_count": word_count,
        "sentence_count": sentence_count,
        "has_instructions": has_instructions,
        "char_count": len(text),
    }


async def _run_adaptation(
    source_text: str,
    profile: dict,
    analysis: dict,
    user_prefs: dict | None,
) -> dict[str, str]:
    """Call the AI agent to adapt the content.

    Uses AI Foundry Agent Service when available, falls back to
    returning structured prompt metadata for local dev.
    """
    endpoint = os.environ.get("PROJECT_ENDPOINT", "") or os.environ.get("AI_FOUNDRY_ENDPOINT", "")
    if _LOCAL_DEV or not endpoint:
        return _local_adaptation_stub(source_text, profile, analysis)

    try:
        from azure.ai.projects import AIProjectClient
        from azure.identity import DefaultAzureCredential

        client = AIProjectClient(
            endpoint=endpoint, credential=DefaultAzureCredential()
        )

        extra = profile.get("extra_instructions", "")
        pref_format = "bullet points"
        if user_prefs:
            pref_format = user_prefs.get("preferredFormat", "bullet points")

        instructions = (
            f"You are a content accessibility specialist. "
            f"Rewrite the following text to Grade {profile['target_grade']} reading level. "
            f"Use {pref_format} format. "
            f"Maximum {profile['max_sentence_words']} words per sentence. "
            f"{extra}\n"
            f"Preserve all essential meaning. Add section headers.\n"
            f"Also produce a 2-sentence summary at the top."
        )

        agent = client.agents.create_agent(
            model="gpt-4o-mini",
            name=f"simplifier-{profile.get('target_grade', 5)}",
            instructions=instructions,
        )
        thread = client.agents.create_thread()
        client.agents.create_message(
            thread_id=thread.id, role="user",
            content=f"Adapt this content:\n\n{source_text[:8000]}",
        )
        run = client.agents.create_and_process_run(
            thread_id=thread.id, agent_id=agent.id,
        )

        if run.status == "failed":
            logger.error("Adaptation agent run failed: %s", run.last_error)
            return _local_adaptation_stub(source_text, profile, analysis)

        messages = client.agents.list_messages(thread_id=thread.id)
        for msg in messages.data:
            if msg.role in ("assistant", "agent"):
                for block in msg.content:
                    if hasattr(block, "text"):
                        adapted_text = block.text.value
                        # Extract summary (first paragraph)
                        parts = adapted_text.split("\n\n", 1)
                        summary = parts[0] if len(parts) > 1 else adapted_text[:200]
                        return {"adapted_text": adapted_text, "summary": summary}

        return _local_adaptation_stub(source_text, profile, analysis)

    except Exception:
        logger.exception("Agent adaptation failed, using fallback")
        return _local_adaptation_stub(source_text, profile, analysis)


def _local_adaptation_stub(text: str, profile: dict, analysis: dict) -> dict[str, str]:
    """Local dev fallback: return metadata about what would be adapted."""
    return {
        "adapted_text": (
            f"## Adapted Content (Grade {profile['target_grade']})\n\n"
            f"**Profile:** {profile['description']}\n\n"
            f"**Source Stats:** {analysis['word_count']} words, "
            f"FKGL {analysis['fkgl']}, {analysis['sentence_count']} sentences\n\n"
            f"---\n\n{text[:3000]}\n\n"
            f"*[Local dev mode — full AI adaptation requires AI Foundry connection]*"
        ),
        "summary": f"Document with {analysis['word_count']} words adapted to Grade {profile['target_grade']}.",
    }


def _generate_audio_scripts(adapted_text: str, max_duration_s: int = 30) -> list[dict]:
    """Split adapted text into audio script chunks of ~30 seconds.

    Assumes ~150 words per minute speaking rate, so ~75 words per 30s chunk.

    Args:
        adapted_text: The adapted text to split.
        max_duration_s: Maximum seconds per audio chunk.

    Returns:
        List of dicts with index, text, estimated_duration_s.
    """
    words_per_chunk = (150 * max_duration_s) // 60  # ~75 words
    sentences = adapted_text.replace("\n", " ").split(". ")
    chunks = []
    current_chunk = []
    current_word_count = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        s_words = len(sentence.split())
        if current_word_count + s_words > words_per_chunk and current_chunk:
            chunk_text = ". ".join(current_chunk) + "."
            est_duration = round(current_word_count / 150 * 60, 1)
            chunks.append({
                "index": len(chunks),
                "text": chunk_text,
                "word_count": current_word_count,
                "estimated_duration_s": min(est_duration, float(max_duration_s)),
            })
            current_chunk = [sentence]
            current_word_count = s_words
        else:
            current_chunk.append(sentence)
            current_word_count += s_words

    if current_chunk:
        chunk_text = ". ".join(current_chunk)
        if not chunk_text.endswith("."):
            chunk_text += "."
        est_duration = round(current_word_count / 150 * 60, 1)
        chunks.append({
            "index": len(chunks),
            "text": chunk_text,
            "word_count": current_word_count,
            "estimated_duration_s": min(est_duration, float(max_duration_s)),
        })

    return chunks


def _decompose_tasks(text: str) -> list[dict]:
    """Extract task-like items from adapted text into structured steps."""
    lines = text.split("\n")
    tasks = []
    step = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Detect numbered items, bullet points, checkboxes
        is_task = (
            line[:1].isdigit()
            or line.startswith("- ")
            or line.startswith("* ")
            or line.startswith("✅")
            or line.lower().startswith("step")
        )
        if is_task:
            step += 1
            word_count = len(line.split())
            est_minutes = max(1, word_count // 10)
            tasks.append({
                "step": step,
                "description": line.lstrip("0123456789.-*✅ ").strip(),
                "estimated_minutes": est_minutes,
                "priority": "must-do",
            })
    return tasks
