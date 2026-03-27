"""
Content Processing Workflow — Copilot CLR

A multi-agent sequential pipeline using Microsoft Agent Framework
with Azure AI Foundry as the agent provider.

Pipeline stages:
  1. IntakeExecutor        — Load user preferences + validate request
  2. RequestBuilderExecutor — Build / refine ContentRequest from chat or form
  3. ContentAdaptExecutor   — Simplify document to user's reading level
  4. TaskPlanExecutor       — Decompose content into achievable micro-steps
  5. AudiobookExecutor      — Generate TTS narration via Azure Speech

Entry point:
    await run_content_pipeline(request, user_id) -> PipelineOutput

Environment variables:
  PROJECT_ENDPOINT             — Azure AI Foundry project endpoint
  MODEL_DEPLOYMENT_NAME        — Model deployment (default: gpt-4o-mini)
  COSMOS_DB_ENDPOINT / DATABASE
  SPEECH_ENDPOINT / SPEECH_REGION / SPEECH_RESOURCE_ID
  STORAGE_ACCOUNT_NAME

SDK packages (pin these versions):
  agent-framework-azure-ai==1.0.0rc3
  agent-framework-core==1.0.0rc3
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(override=False)

from agent_framework import (
    Executor,
    Message,
    WorkflowBuilder,
    WorkflowContext,
    handler,
)
from agent_framework.azure import AzureAIClient
from azure.identity.aio import DefaultAzureCredential

from agents.agent_tools import (
    get_preferences_container,
    search_documents,
    search_web,
    set_tool_context,
)
from models import (
    AdaptedContent,
    AudiobookOutput,
    AudioNarration,
    AudioScriptChunk,
    ContentRequest,
    NEURODIVERSE_PROFILES,
    PipelineOutput,
    SourceAnalysis,
    TaskDecomposition,
    TaskStep,
    WebCitation,
)

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")


# ============================================================================
# Shared pipeline state
# ============================================================================


@dataclass
class ContentPipelineState:
    """Mutable state carried between pipeline executors."""

    user_id: str = ""
    preferences: dict = field(default_factory=dict)

    # Built / refined by the pipeline
    request: ContentRequest = field(default_factory=ContentRequest)
    source_text: str = ""

    # Stage outputs
    source_analysis: SourceAnalysis = field(default_factory=SourceAnalysis)
    adapted_text: str = ""
    summary: str = ""
    audio_scripts: list = field(default_factory=list)
    web_citations: list = field(default_factory=list)
    task_steps: list = field(default_factory=list)
    audiobook_narrations: list = field(default_factory=list)

    error: str = ""


# ============================================================================
# Agent instructions per stage
# ============================================================================

_ADAPT_INSTRUCTIONS = """\
You are a content accessibility specialist for neurodiverse users.

Your job:
1. Rewrite the source text to the target reading level ({target_grade}).
2. Use {format} format.
3. Maximum {max_words} words per sentence.
4. Preserve ALL essential meaning — do not drop important facts.
5. Add clear section headers.
6. Produce a 2-sentence summary at the very top.
{extra}

Profile: {profile_desc}

Responsible AI:
- Never add anxiety-inducing language.
- Keep tone calm, encouraging, and supportive.
- If the source contains harmful content, note it and exclude it.
"""

_TASK_PLAN_INSTRUCTIONS = """\
You are a task decomposition specialist for neurodiverse users.

Your job:
1. Read the adapted content below.
2. Break it into small, achievable micro-steps.
3. Each step should take 1-15 minutes maximum.
4. Assign priority: must-do, should-do, or nice-to-have.
5. Use simple, direct language.
6. Number the steps sequentially.

Return a JSON array of objects with keys:
  step (int), description (str), estimated_minutes (int), priority (str)

Example:
[
  {{"step": 1, "description": "Read the introduction paragraph", "estimated_minutes": 2, "priority": "must-do"}},
  {{"step": 2, "description": "Highlight key terms", "estimated_minutes": 3, "priority": "should-do"}}
]
"""

_REQUEST_BUILDER_INSTRUCTIONS = """\
You are a helpful assistant that builds a content processing request from
the user's conversation. The user may describe what they want informally.

Extract the following into a JSON object:
- topic: what the content is about
- desired_outputs: array of "adapted_text", "task_plan", "audiobook", "summary", "all"
- target_reading_level: e.g. "Grade 3", "Grade 5", "Grade 8"
- target_format: "bullet points", "numbered list", "paragraphs", or "mixed"
- language: ISO language code (e.g. "en", "es", "pt")
- additional_instructions: any extra requests the user made
- enrich_with_web_search: true if user wants web-sourced info added
- web_search_queries: array of search queries if applicable

If the user uploads a document, they are asking for the document to be processed.
Default desired_outputs to ["all"] if not specified.
Always return valid JSON only.
"""

_AUDIOBOOK_SCRIPT_INSTRUCTIONS = """\
You are an audiobook script writer creating narration for neurodiverse listeners.

Rules:
- Write as if speaking directly to the listener.
- Use a warm, conversational tone.
- Keep sentences under 20 words for natural TTS flow.
- Spell out numbers under 100 as words.
- Avoid abbreviations, symbols, or formatting that TTS can't pronounce.
- Replace bullet lists with flowing prose and natural transitions.
- Add natural pauses between sections (mark with [PAUSE]).
- Each section should be 60-90 seconds of narration (~150-225 words).

Take the adapted content and rewrite it as a narration script.
Return a JSON array of sections:
[
  {{"section_title": "Introduction", "narration_text": "..."}},
  {{"section_title": "Part 1", "narration_text": "..."}}
]
"""


# ============================================================================
# Profile configs (mirrored from content_adapter.py)
# ============================================================================

_PROFILES = {
    "low":      {"target_grade": 2, "max_sentence_words": 8},
    "medium":   {"target_grade": 5, "max_sentence_words": 15},
    "high":     {"target_grade": 8, "max_sentence_words": 25},
    "adhd":     {"target_grade": 5, "max_sentence_words": 10,
                 "extra": ("Break every section into 2-3 sentence chunks. "
                           "Bold the key action in each chunk. "
                           "Add time estimates. Use ✅ checkboxes.")},
    "dyslexia": {"target_grade": 4, "max_sentence_words": 10,
                 "extra": ("Use only common, concrete words. "
                           "Never use more than 2 sentences without a line break. "
                           "Use numbered lists. Avoid italics.")},
}


# ============================================================================
# Stage 1 — IntakeExecutor: load preferences + validate
# ============================================================================


class IntakeExecutor(Executor):
    """Load user preferences from Cosmos DB, merge into the request."""

    @handler
    async def handle(
        self,
        messages: list[Message],
        ctx: WorkflowContext[ContentPipelineState],
    ) -> list[Message]:
        state = ctx.state

        # Load preferences
        try:
            container = get_preferences_container()
            if container:
                doc = container.read_item(
                    item=state.user_id, partition_key=state.user_id
                )
                state.preferences = {
                    k: v for k, v in doc.items() if not k.startswith("_")
                }
        except Exception:
            logger.debug("No saved preferences for user=%s", state.user_id)

        # Apply preference defaults to request if not already set
        prefs = state.preferences
        req = state.request
        if prefs:
            if not req.target_reading_level or req.target_reading_level == "Grade 5":
                req.target_reading_level = prefs.get("readingLevel", "Grade 5")
            if not req.language or req.language == "en":
                req.language = prefs.get("language", "en")
            if req.neurodiverse_profile == "medium":
                # Check for dyslexia or ADHD-specific settings
                if prefs.get("dyslexiaFont"):
                    req.neurodiverse_profile = "dyslexia"
            if not req.target_format or req.target_format == "bullet points":
                req.target_format = prefs.get("preferredFormat", "bullet points")

        state.source_text = req.source_text
        return messages


# ============================================================================
# Stage 2 — RequestBuilderExecutor: refine request via AI (chat path)
# ============================================================================


class RequestBuilderExecutor(Executor):
    """Use the AI agent to build/refine a ContentRequest from chat messages.

    If the request already has source_text (form/upload path), this is a
    pass-through. If it came from chat, the agent extracts the structured
    request from the conversation.
    """

    @handler
    async def handle(
        self,
        messages: list[Message],
        ctx: WorkflowContext[ContentPipelineState],
    ) -> list[Message]:
        state = ctx.state

        # If we already have source text (upload/form), skip the builder
        if state.source_text.strip():
            return messages

        endpoint = os.getenv("PROJECT_ENDPOINT", "")
        if _LOCAL_DEV or not endpoint:
            logger.info("RequestBuilder: local dev mode, using defaults")
            return messages

        credential = DefaultAzureCredential()
        try:
            async with AzureAIClient(
                project_endpoint=endpoint,
                model_deployment_name=os.getenv(
                    "MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"
                ),
                credential=credential,
            ).as_agent(
                name="CopilotCLR-RequestBuilder",
                instructions=_REQUEST_BUILDER_INSTRUCTIONS,
            ) as agent:
                response = await agent.run(messages)
                text = response.text if hasattr(response, "text") else str(response)

                # Parse the structured JSON from the agent
                try:
                    data = json.loads(text)
                    req = state.request
                    if data.get("topic"):
                        req.topic = data["topic"]
                    if data.get("desired_outputs"):
                        req.desired_outputs = data["desired_outputs"]
                    if data.get("target_reading_level"):
                        req.target_reading_level = data["target_reading_level"]
                    if data.get("target_format"):
                        req.target_format = data["target_format"]
                    if data.get("language"):
                        req.language = data["language"]
                    if data.get("additional_instructions"):
                        req.additional_instructions = data["additional_instructions"]
                    if data.get("enrich_with_web_search"):
                        req.enrich_with_web_search = data["enrich_with_web_search"]
                    if data.get("web_search_queries"):
                        req.web_search_queries = data["web_search_queries"]
                except (json.JSONDecodeError, KeyError):
                    logger.warning("RequestBuilder returned non-JSON: %s", text[:200])

        except Exception:
            logger.exception("RequestBuilder agent failed")

        return messages


# ============================================================================
# Stage 3 — ContentAdaptExecutor: simplify + web-enrich via Foundry agent
# ============================================================================


class ContentAdaptExecutor(Executor):
    """Adapt the source content using an AI Foundry agent with optional
    web search tool for enrichment."""

    @handler
    async def handle(
        self,
        messages: list[Message],
        ctx: WorkflowContext[ContentPipelineState],
    ) -> list[Message]:
        state = ctx.state
        req = state.request

        if not state.source_text.strip():
            state.error = "No source content to adapt."
            return messages

        # Analyze source
        state.source_analysis = _analyze_source(state.source_text)

        # Build profile-specific instructions
        profile = _PROFILES.get(req.neurodiverse_profile, _PROFILES["medium"])
        instructions = _ADAPT_INSTRUCTIONS.format(
            target_grade=profile["target_grade"],
            format=req.target_format,
            max_words=profile["max_sentence_words"],
            extra=profile.get("extra", ""),
            profile_desc=NEURODIVERSE_PROFILES.get(
                req.neurodiverse_profile, "Easy"
            ),
        )
        if req.additional_instructions:
            instructions += f"\n\nAdditional user instructions: {req.additional_instructions}"

        endpoint = os.getenv("PROJECT_ENDPOINT", "") or os.getenv("AI_FOUNDRY_ENDPOINT", "")
        if not endpoint:
            state.error = "Azure AI Foundry is required for content adaptation, but no project endpoint is configured."
            return messages

        # Bind tool context for search_documents / search_web
        set_tool_context(state.user_id, "")

        tools = [search_documents]
        if req.enrich_with_web_search:
            tools.append(search_web)

        credential = DefaultAzureCredential()
        try:
            async with AzureAIClient(
                project_endpoint=endpoint,
                model_deployment_name=os.getenv(
                    "MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"
                ),
                credential=credential,
            ).as_agent(
                name="CopilotCLR-ContentAdapter",
                instructions=instructions,
                tools=tools,
            ) as agent:
                prompt = f"Adapt this content:\n\n{state.source_text[:12000]}"

                # Add web search enrichment if requested
                if req.enrich_with_web_search and req.web_search_queries:
                    prompt += (
                        "\n\nAlso enrich with web search results for these queries: "
                        + ", ".join(req.web_search_queries)
                    )

                adapt_messages = [Message(role="user", contents=[prompt])]
                response = await agent.run(adapt_messages)
                adapted = response.text if hasattr(response, "text") else str(response)

                # Split summary from body
                parts = adapted.split("\n\n", 1)
                state.summary = parts[0] if len(parts) > 1 else adapted[:300]
                state.adapted_text = adapted
                state.audio_scripts = _generate_audio_scripts(adapted)

        except Exception:
            logger.exception("ContentAdapt agent failed")
            state.error = "Azure AI Foundry adaptation failed."

        return messages


# ============================================================================
# Stage 4 — TaskPlanExecutor: decompose into micro-steps
# ============================================================================


class TaskPlanExecutor(Executor):
    """Break adapted content into small, achievable task steps."""

    @handler
    async def handle(
        self,
        messages: list[Message],
        ctx: WorkflowContext[ContentPipelineState],
    ) -> list[Message]:
        state = ctx.state
        req = state.request

        wants_tasks = "all" in req.desired_outputs or "task_plan" in req.desired_outputs
        if not wants_tasks or not state.adapted_text:
            return messages

        endpoint = os.getenv("PROJECT_ENDPOINT", "")
        if _LOCAL_DEV or not endpoint:
            state.task_steps = _local_decompose_tasks(state.adapted_text)
            return messages

        credential = DefaultAzureCredential()
        try:
            async with AzureAIClient(
                project_endpoint=endpoint,
                model_deployment_name=os.getenv(
                    "MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"
                ),
                credential=credential,
            ).as_agent(
                name="CopilotCLR-TaskPlanner",
                instructions=_TASK_PLAN_INSTRUCTIONS,
            ) as agent:
                plan_messages = [
                    Message(
                        role="user",
                        content=(
                            f"Decompose this into micro-steps:\n\n"
                            f"{state.adapted_text[:8000]}"
                        ),
                    )
                ]
                response = await agent.run(plan_messages)
                text = response.text if hasattr(response, "text") else str(response)

                try:
                    raw = text
                    # Strip markdown code fence if present
                    if "```" in raw:
                        raw = raw.split("```")[1]
                        if raw.startswith("json"):
                            raw = raw[4:]
                    steps_data = json.loads(raw.strip())
                    state.task_steps = [
                        TaskStep(**s) for s in steps_data
                        if isinstance(s, dict)
                    ]
                except (json.JSONDecodeError, KeyError):
                    logger.warning("TaskPlanner returned non-JSON, using fallback")
                    state.task_steps = _local_decompose_tasks(state.adapted_text)

        except Exception:
            logger.exception("TaskPlan agent failed, using fallback")
            state.task_steps = _local_decompose_tasks(state.adapted_text)

        return messages


# ============================================================================
# Stage 5 — AudiobookExecutor: TTS via Azure Speech
# ============================================================================


class AudiobookExecutor(Executor):
    """Generate audiobook narration using Azure Speech TTS.

    If the Foundry endpoint is available, first rewrites the adapted
    content into a spoken narration script, then synthesizes each
    section with Azure Speech.
    """

    @handler
    async def handle(
        self,
        messages: list[Message],
        ctx: WorkflowContext[ContentPipelineState],
    ) -> list[Message]:
        state = ctx.state
        req = state.request

        wants_audio = "all" in req.desired_outputs or "audiobook" in req.desired_outputs
        if not wants_audio or not state.adapted_text:
            return messages

        # Step 1: Generate narration script via AI
        narration_sections = await self._generate_script(state)

        # Step 2: Synthesize each section with Azure Speech
        if narration_sections:
            state.audiobook_narrations = await self._synthesize_sections(
                narration_sections, state
            )

        return messages

    async def _generate_script(
        self, state: ContentPipelineState
    ) -> list[dict]:
        """Use AI to convert adapted text into spoken narration."""
        endpoint = os.getenv("PROJECT_ENDPOINT", "")
        if _LOCAL_DEV or not endpoint:
            # Fallback: use audio_scripts as narration sections
            return [
                {"section_title": f"Part {s.get('index', i) + 1}", "narration_text": s.get("text", "")}
                for i, s in enumerate(
                    [chunk.__dict__ if hasattr(chunk, "__dict__") else chunk
                     for chunk in state.audio_scripts]
                )
            ] if state.audio_scripts else [
                {"section_title": "Full Narration", "narration_text": state.adapted_text[:3000]}
            ]

        credential = DefaultAzureCredential()
        try:
            async with AzureAIClient(
                project_endpoint=endpoint,
                model_deployment_name=os.getenv(
                    "MODEL_DEPLOYMENT_NAME", "gpt-4o-mini"
                ),
                credential=credential,
            ).as_agent(
                name="CopilotCLR-AudiobookScripter",
                instructions=_AUDIOBOOK_SCRIPT_INSTRUCTIONS,
            ) as agent:
                script_messages = [
                    Message(
                        role="user",
                        content=(
                            f"Convert this adapted content into an audiobook "
                            f"narration script:\n\n{state.adapted_text[:8000]}"
                        ),
                    )
                ]
                response = await agent.run(script_messages)
                text = response.text if hasattr(response, "text") else str(response)

                try:
                    raw = text
                    if "```" in raw:
                        raw = raw.split("```")[1]
                        if raw.startswith("json"):
                            raw = raw[4:]
                    return json.loads(raw.strip())
                except (json.JSONDecodeError, KeyError):
                    logger.warning("AudiobookScripter non-JSON, using chunks")
                    return [
                        {"section_title": "Full Narration", "narration_text": state.adapted_text[:3000]}
                    ]

        except Exception:
            logger.exception("AudiobookScripter agent failed")
            return [
                {"section_title": "Full Narration", "narration_text": state.adapted_text[:3000]}
            ]

    async def _synthesize_sections(
        self,
        sections: list[dict],
        state: ContentPipelineState,
    ) -> list[AudioNarration]:
        """Synthesize each narration section via Azure Speech TTS."""
        from services.speech import synthesize_speech_sync

        prefs = state.preferences
        voice = prefs.get("preferredVoice", "en-US-JennyNeural")
        if voice == "default":
            voice = "en-US-JennyNeural"
        rate = prefs.get("voiceSpeed", "slow")
        if rate == "1.0":
            rate = "slow"

        narrations = []
        for section in sections:
            title = section.get("section_title", "")
            text = section.get("narration_text", "")
            if not text.strip():
                continue

            result = synthesize_speech_sync(
                text=text, voice=voice, style="calm", rate=rate
            )

            audio_bytes = result.get("audio_bytes", b"")
            duration_ms = result.get("durationMs", 0)

            # Upload to blob storage if available
            file_url = ""
            if audio_bytes and not result.get("local_dev"):
                file_url = _upload_audio_blob(
                    audio_bytes,
                    state.user_id,
                    state.request.source_document_id or str(uuid.uuid4()),
                    title,
                )

            narrations.append(AudioNarration(
                section_title=title,
                file_url=file_url,
                duration_seconds=duration_ms / 1000.0,
                voice_id=voice,
                style="calm",
                format="mp3",
                size_bytes=len(audio_bytes),
            ))

        return narrations


# ============================================================================
# Workflow assembly
# ============================================================================

_intake = IntakeExecutor()
_request_builder = RequestBuilderExecutor()
_content_adapt = ContentAdaptExecutor()
_task_plan = TaskPlanExecutor()
_audiobook = AudiobookExecutor()

_content_workflow = (
    WorkflowBuilder(start_executor=_intake)
    .add_edge(_intake, _request_builder)
    .add_edge(_request_builder, _content_adapt)
    .add_edge(_content_adapt, _task_plan)
    .add_edge(_task_plan, _audiobook)
    .build()
)


# ============================================================================
# Public API
# ============================================================================


async def run_content_pipeline(
    request: ContentRequest,
    user_id: str,
) -> PipelineOutput:
    """Execute the full content processing pipeline.

    Args:
        request:  The content request (from form, chat, or document upload).
        user_id:  Authenticated Entra ID OID.

    Returns:
        PipelineOutput with adapted content, task plan, and audiobook.
    """
    content_id = request.source_document_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    state = ContentPipelineState(user_id=user_id, request=request)

    input_messages = [
        Message(
            role="user",
            content=request.source_text[:200] if request.source_text else request.topic,
        )
    ]

    ctx = WorkflowContext(state=state)

    try:
        await _content_workflow.run(input_messages, ctx)
    except Exception:
        logger.exception("Content pipeline failed")
        return PipelineOutput(
            request=request,
            status="failed",
            error=state.error or "Pipeline execution failed.",
            created_at=now,
        )

    if state.error:
        return PipelineOutput(
            request=request,
            status="failed",
            error=state.error,
            created_at=now,
        )

    # Assemble outputs
    adapted = AdaptedContent(
        content_id=content_id,
        profile=request.neurodiverse_profile,
        source_analysis=state.source_analysis,
        adapted_text=state.adapted_text,
        summary=state.summary,
        audio_scripts=[
            AudioScriptChunk(**s) if isinstance(s, dict) else s
            for s in state.audio_scripts
        ],
        tasks=state.task_steps,
        web_citations=state.web_citations,
        created_at=now,
    )

    task_plan = None
    if state.task_steps:
        total_mins = sum(s.estimated_minutes for s in state.task_steps)
        task_plan = TaskDecomposition(
            source_content_id=content_id,
            goal_summary=state.summary[:300],
            total_estimated_minutes=total_mins,
            steps=state.task_steps,
        )

    audiobook = None
    if state.audiobook_narrations:
        total_dur = sum(n.duration_seconds for n in state.audiobook_narrations)
        audiobook = AudiobookOutput(
            content_id=content_id,
            title=request.topic or "Adapted Content",
            narrations=state.audiobook_narrations,
            total_duration_seconds=total_dur,
            voice_id=state.audiobook_narrations[0].voice_id if state.audiobook_narrations else "",
            created_at=now,
        )

    return PipelineOutput(
        request=request,
        adapted=adapted,
        task_plan=task_plan,
        audiobook=audiobook,
        status="completed",
        created_at=now,
    )


async def build_request_from_chat(
    chat_messages: list[dict],
    user_id: str,
) -> ContentRequest:
    """Have the AI agent build a ContentRequest from a chat conversation.

    Used when the user describes what they want via chat instead of a form.
    """
    state = ContentPipelineState(user_id=user_id)

    # Load preferences for defaults
    try:
        container = get_preferences_container()
        if container:
            doc = container.read_item(item=user_id, partition_key=user_id)
            state.preferences = {
                k: v for k, v in doc.items() if not k.startswith("_")
            }
    except Exception:
        pass

    messages = [
        Message(role=m.get("role", "user"), contents=[m.get("content", "")])
        for m in chat_messages
    ]

    ctx = WorkflowContext(state=state)

    # Run only Intake + RequestBuilder stages
    intake_exec = IntakeExecutor()
    builder_exec = RequestBuilderExecutor()

    mini_workflow = (
        WorkflowBuilder(start_executor=intake_exec)
        .add_edge(intake_exec, builder_exec)
        .build()
    )

    await mini_workflow.run(messages, ctx)
    return state.request


# ============================================================================
# Helper functions
# ============================================================================


def _analyze_source(text: str) -> SourceAnalysis:
    """Analyze source text for reading level and structure."""
    import textstat

    word_count = textstat.lexicon_count(text)
    fkgl = textstat.flesch_kincaid_grade(text) if word_count >= 10 else 0.0
    sentence_count = textstat.sentence_count(text)
    has_instructions = any(
        kw in text.lower()
        for kw in [
            "step", "first", "then", "next", "finally",
            "instructions", "procedure", "how to",
        ]
    )
    return SourceAnalysis(
        fkgl=round(fkgl, 1),
        word_count=word_count,
        sentence_count=sentence_count,
        char_count=len(text),
        has_instructions=has_instructions,
    )


def _local_adapt_stub(text: str, profile: dict) -> str:
    """Local dev fallback — return metadata about adaptation."""
    return (
        f"## Adapted Content (Grade {profile['target_grade']})\n\n"
        f"**Profile:** {profile.get('target_grade', 5)}\n\n"
        f"---\n\n{text[:3000]}"
    )


def _generate_audio_scripts(
    adapted_text: str, max_duration_s: int = 30
) -> list[dict]:
    """Split adapted text into ~30-second audio chunks."""
    words_per_chunk = (150 * max_duration_s) // 60  # ~75 words
    sentences = adapted_text.replace("\n", " ").split(". ")
    chunks: list[dict] = []
    current_chunk: list[str] = []
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


def _local_decompose_tasks(text: str) -> list[TaskStep]:
    """Fallback: extract task-like items from text."""
    lines = text.split("\n")
    tasks = []
    step = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
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
            tasks.append(TaskStep(
                step=step,
                description=line.lstrip("0123456789.-*✅ ").strip(),
                estimated_minutes=est_minutes,
                priority="must-do",
            ))
    return tasks


def _upload_audio_blob(
    audio_bytes: bytes,
    user_id: str,
    content_id: str,
    section_title: str,
) -> str:
    """Upload audio bytes to Azure Blob Storage, return URL."""
    storage_account = os.environ.get("STORAGE_ACCOUNT_NAME", "")
    if not storage_account:
        return ""

    try:
        from azure.identity import DefaultAzureCredential as SyncCredential
        from azure.storage.blob import BlobServiceClient

        blob_svc = BlobServiceClient(
            account_url=f"https://{storage_account}.blob.core.windows.net",
            credential=SyncCredential(),
        )
        container_name = "audiobook"
        ctr = blob_svc.get_container_client(container_name)
        try:
            ctr.create_container()
        except Exception:
            pass

        safe_title = "".join(c if c.isalnum() or c in "-_ " else "" for c in section_title)[:50]
        blob_name = f"{user_id}/{content_id}/{safe_title}.mp3"
        ctr.upload_blob(name=blob_name, data=audio_bytes, overwrite=True)
        return f"https://{storage_account}.blob.core.windows.net/{container_name}/{blob_name}"
    except Exception:
        logger.exception("Failed to upload audio blob")
        return ""
