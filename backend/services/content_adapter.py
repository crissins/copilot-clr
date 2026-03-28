"""Content Adaptation — Multi-Agent Workflow.

Orchestrates specialized agents via Microsoft Agent Framework to
transform extracted content into adapted versions for neurodiverse users.
Agents: Analyzer, Simplifier, TaskDecomposer, ContentFormatter.
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import markdown
import textstat

from agents.content_workflow import AzureAIClient, DefaultAzureCredential, Message

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
            "Avoid walls of text — white space is critical. "
            "Use Markdown headers (###) for sections. "
            "DO NOT use raw JSON keys like 'header' or 'content' in the final text."
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
        "profile_description": profile_config["description"],
        "source_analysis": analysis,
        "adapted_text": adapted["adapted_text"],
        "summary": adapted.get("summary", ""),
        "change_summary": adapted.get("change_summary", _default_change_summary(profile_config)),
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
        "fkgl": round(float(fkgl), 1),
        "word_count": int(word_count),
        "sentence_count": int(sentence_count),
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

    Uses Azure AI Foundry Agent Framework and raises when Foundry is not
    available instead of returning a local placeholder.
    """
    endpoint = os.environ.get("PROJECT_ENDPOINT", "") or os.environ.get("AI_FOUNDRY_ENDPOINT", "")
    if not endpoint:
        if _LOCAL_DEV:
            logger.warning("No PROJECT_ENDPOINT configured — using local fallback adaptation")
            return _local_fallback_adaptation(source_text, profile, analysis)
        raise RuntimeError(
            "Azure AI Foundry is required for content adaptation, but no project endpoint is configured. "
            "Set PROJECT_ENDPOINT or AI_FOUNDRY_ENDPOINT environment variable."
        )

    try:
        # Azure AI Foundry Agent SDK

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
            f"Also produce a 2-sentence summary at the top.\n"
            f"Return valid JSON only with keys: summary, adapted_text, change_summary.\n"
            f"The change_summary must be one sentence describing what changed for the target readers."
        )

        credential = DefaultAzureCredential()
        try:
            async with AzureAIClient(
                project_endpoint=endpoint,
                model_deployment_name=os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"),
                credential=credential,
            ).as_agent(
                name=f"CopilotCLR-Simplifier-{profile.get('target_grade', 5)}",
                instructions=instructions,
            ) as agent:
                prompt = (
                    "Adapt this content for accessibility. Preserve meaning and return JSON only.\n\n"
                    f"Source content:\n{source_text}"
                )
                response = await agent.run([Message(role="user", contents=[prompt])])
                raw_text = response.text if hasattr(response, "text") else str(response)
        finally:
            await credential.close()

        data = _parse_adaptation_payload(raw_text)
        adapted_text = data.get("adapted_text", "").strip()
        summary = data.get("summary", "").strip()
        change_summary = data.get("change_summary", "").strip()

        if not adapted_text:
            raise RuntimeError("Azure AI Foundry returned an empty adaptation result.")

        if not summary:
            parts = adapted_text.split("\n\n", 1)
            summary = str(parts[0]) if len(parts) > 1 else adapted_text[:200]

        if not change_summary:
            change_summary = _default_change_summary(profile)

        return {
            "adapted_text": adapted_text,
            "summary": summary,
            "change_summary": change_summary,
        }

    except Exception as exc:
        logger.exception("Agent adaptation failed")
        raise RuntimeError("Azure AI Foundry adaptation failed.") from exc


def _parse_adaptation_payload(raw_text: str) -> dict[str, str]:
    """Parse the agent JSON response, handling markdown code fences."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Simplifier returned non-JSON payload; using plain text fallback")
        return {"adapted_text": text, "summary": "", "change_summary": ""}

    return {
        "adapted_text": str(data.get("adapted_text", "")),
        "summary": str(data.get("summary", "")),
        "change_summary": str(data.get("change_summary", "")),
    }


def _default_change_summary(profile: dict) -> str:
    """Return a readable default change explanation for the selected profile."""
    return (
        f"Content rewritten for {profile['description']} readers — vocabulary simplified, "
        f"sentences shortened, and structure improved for clarity."
    )


def build_change_metrics(source_text: str, adapted_text: str, profile: str, profile_description: str) -> dict[str, Any]:
    """Build word-count and explanation metadata for the adapted result."""
    original_word_count = len(source_text.split())
    adapted_word_count = len(adapted_text.split())
    reduction_percent = max(
        0,
        round((1 - adapted_word_count / max(1, original_word_count)) * 100),
    )
    change_summary = (
        f"Original: {original_word_count} words -> Adapted: {adapted_word_count} words "
        f"({reduction_percent}% reduction). Content rewritten for {profile_description} readers "
        f"- vocabulary simplified, sentences shortened, and structure improved for clarity."
    )
    return {
        "profile": profile,
        "originalWordCount": original_word_count,
        "adaptedWordCount": adapted_word_count,
        "reductionPercent": reduction_percent,
        "changeSummary": change_summary,
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
            est_duration = round(float(current_word_count) / 150 * 60, 1)
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
        est_duration = round(float(current_word_count) / 150 * 60, 1)
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


def _local_fallback_adaptation(
    source_text: str,
    profile: dict,
    analysis: dict,
) -> dict[str, str]:
    """Simple local text adaptation when AI Foundry is not available."""
    sentences = source_text.replace("\n", " ").split(". ")
    max_words = profile.get("max_sentence_words", 15)
    adapted_sentences = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        words = s.split()
        if len(words) > max_words:
            adapted_sentences.append(" ".join(words[:max_words]) + "...")
        else:
            adapted_sentences.append(s)
    adapted_text = ".\n\n".join(adapted_sentences)
    if adapted_text and not adapted_text.endswith("."):
        adapted_text += "."
    summary = adapted_sentences[0] if adapted_sentences else source_text[:200]
    return {
        "adapted_text": adapted_text,
        "summary": summary,
        "change_summary": _default_change_summary(profile),
    }


def format_and_clean_content(text: str) -> str:
    """Clean the adapted text from 'header'/'content' keys and ensure clean Markdown."""
    text = text.strip()

    # Handle the specific case where AI returns pseudo-JSON structure in strings
    # e.g. section_1: { header: '...', content: '...' }
    if "section_" in text and ("header" in text.lower() or "content" in text.lower()):
        # Try to parse as JSON if it's already a JSON string
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                lines = []
                for _, section in data.items():
                    if isinstance(section, dict):
                        h = section.get("header", section.get("title", ""))
                        c = section.get("content", section.get("body", ""))
                        if h:
                            lines.append(f"### {h}")
                        if c:
                            lines.append(c)
                        lines.append("")
                if lines:
                    return "\n".join(lines).strip()
        except json.JSONDecodeError:
            pass

        # If not standard JSON, or parse failed, do some regex/string cleaning
        # Remove section keys like 'section_1': {
        text = re.sub(r"['\"]?section_\d+['\"]?:\s*\{", "", text)
        # Convert 'header': '...' to ### ...
        text = re.sub(r"['\"]?header['\"]?:\s*['\"](.*?)['\"]", r"### \1", text)
        # Remove 'content': '...'
        text = re.sub(r"['\"]?content['\"]?:\s*['\"](.*?)['\"]", r"\1", text)
        # Remove trailing braces
        text = text.replace("}", "")
        # Clean up extra quotes/commas that might be left over from broken JSON
        text = text.replace("',", "").replace('",', "").strip("'").strip('"')

    return text.strip()


def generate_html_email(title: str, markdown_content: str, profile_label: str) -> str:
    """Wrap Markdown content in a premium-styled HTML email template."""
    html_body = markdown.markdown(markdown_content)

    # Use brand colors: #0078d4 (Microsoft Blue/Brand), #f3f2f1 (Background)
    # Styles for a "premium" feel: glassmorphism-inspired borders, typography.
    template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #323130; background-color: #faf9f8; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #edebe9; }}
            .header {{ background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); padding: 32px 24px; color: white; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 600; }}
            .badge {{ display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 20px; font-size: 12px; margin-top: 8px; }}
            .content {{ padding: 32px 24px; font-size: 16px; }}
            .content h2, .content h3 {{ color: #0078d4; margin-top: 24px; }}
            .content p {{ margin-bottom: 16px; }}
            .content ul {{ padding-left: 20px; }}
            .content li {{ margin-bottom: 8px; }}
            .footer {{ background: #f3f2f1; padding: 20px 24px; text-align: center; font-size: 12px; color: #605e5c; border-top: 1px solid #edebe9; }}
            .action-box {{ background: #eff6fc; border-left: 4px solid #0078d4; padding: 16px; margin: 24px 0; border-radius: 4px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{title}</h1>
                <div class="badge">Adapted for: {profile_label}</div>
            </div>
            <div class="content">
                {html_body}
            </div>
            <div class="footer">
                <p>Sent via Base Innovation AI Content Adapter</p>
                <p>&copy; 2026 Base Innovation. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return template
