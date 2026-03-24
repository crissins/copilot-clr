"""Pydantic models — Copilot CLR.

Model groups:
  1. User Preferences     — accessibility & neurodiverse settings
  2. Content Request      — user request for document processing / generation
  3. Task Decomposition   — breaking content/goals into manageable steps
  4. Adapted Content      — easy-to-digest output from the content pipeline
  5. Audio / Audiobook    — Azure Speech TTS narration output
  6. Pipeline Output      — combined result of the full agent workflow
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ────────────────────────────────────────────────────────────────────
# 1. User Preferences
# ────────────────────────────────────────────────────────────────────

NEURODIVERSE_PROFILES = {
    "low":      "Very Easy — short sentences, common words, maximum bullet points",
    "medium":   "Easy — clear language, structured sections, moderate detail",
    "high":     "Standard — full detail with clear structure",
    "adhd":     "ADHD-optimized — ultra-short chunks, bold key actions, time estimates",
    "dyslexia": "Dyslexia-friendly — simple vocabulary, no dense paragraphs",
}

OUTPUT_FORMATS = {
    "adapted_text":  "Simplified / adapted text",
    "task_plan":     "Development task plan with step-by-step breakdown",
    "audiobook":     "Azure Speech TTS narration (audiobook-style)",
    "summary":       "Executive summary",
    "all":           "All of the above",
}


class UserPreferences(BaseModel):
    """Accessibility & display preferences stored in Cosmos DB."""

    user_id: str
    display_name: str = ""
    email: str = ""

    # Reading & comprehension
    reading_level: str = "Grade 5"
    preferred_format: Literal[
        "bullet points", "numbered list", "paragraphs", "mixed"
    ] = "bullet points"
    response_length_preference: Literal["short", "medium", "long"] = "medium"
    language: str = "en"

    # Visual / display
    font_size: Literal["small", "medium", "large", "x-large"] = "medium"
    font_family: str = "default"
    high_contrast: bool = False
    theme: Literal["light", "dark", "system"] = "system"
    dyslexia_font: bool = False
    color_overlay: str = "none"
    text_alignment: Literal["left", "center", "right"] = "left"
    line_spacing: Literal["compact", "normal", "relaxed"] = "normal"
    reduced_motion: bool = False

    # Voice & audio
    voice_speed: str = "1.0"
    auto_read_responses: bool = False
    preferred_voice: str = "default"

    # Focus & productivity
    focus_timer_minutes: int = Field(default=25, ge=1, le=120)
    break_reminder_minutes: int = Field(default=5, ge=1, le=60)
    notification_style: Literal["calm", "standard", "minimal"] = "calm"

    # Neurodiverse profile shortcut
    neurodiverse_profile: str = "medium"


class UserPreferencesUpdate(BaseModel):
    """Partial update payload — every field is optional."""

    reading_level: Optional[str] = None
    preferred_format: Optional[str] = None
    response_length_preference: Optional[str] = None
    language: Optional[str] = None
    font_size: Optional[str] = None
    font_family: Optional[str] = None
    high_contrast: Optional[bool] = None
    theme: Optional[str] = None
    dyslexia_font: Optional[bool] = None
    color_overlay: Optional[str] = None
    text_alignment: Optional[str] = None
    line_spacing: Optional[str] = None
    reduced_motion: Optional[bool] = None
    voice_speed: Optional[str] = None
    auto_read_responses: Optional[bool] = None
    preferred_voice: Optional[str] = None
    focus_timer_minutes: Optional[int] = None
    break_reminder_minutes: Optional[int] = None
    notification_style: Optional[str] = None
    neurodiverse_profile: Optional[str] = None


# ────────────────────────────────────────────────────────────────────
# 2. Content Request  (built from form, chat, or document upload)
# ────────────────────────────────────────────────────────────────────

class ContentRequest(BaseModel):
    """What the user wants done — built by the RequestBuilder agent
    from a form submission, a chat conversation, or a document upload."""

    topic: str = ""                  # Subject / title
    source_text: str = ""            # Extracted text from uploaded document
    source_document_id: str = ""     # Blob reference for original file
    source_filename: str = ""

    # What should the pipeline produce?
    desired_outputs: List[Literal[
        "adapted_text", "task_plan", "audiobook", "summary", "all"
    ]] = ["all"]

    # Reader context — copied from UserPreferences at request time
    target_reading_level: str = "Grade 5"
    target_format: Literal[
        "bullet points", "numbered list", "paragraphs", "mixed"
    ] = "bullet points"
    language: str = "en"
    neurodiverse_profile: str = "medium"

    # Extra instructions the user typed ("make it shorter", etc.)
    additional_instructions: str = ""

    # Web search enrichment
    enrich_with_web_search: bool = False
    web_search_queries: List[str] = []


class ContentRequestUpdate(BaseModel):
    """Partial update — used when the chat agent refines the request."""

    topic: Optional[str] = None
    desired_outputs: Optional[List[str]] = None
    target_reading_level: Optional[str] = None
    target_format: Optional[str] = None
    language: Optional[str] = None
    neurodiverse_profile: Optional[str] = None
    additional_instructions: Optional[str] = None
    enrich_with_web_search: Optional[bool] = None
    web_search_queries: Optional[List[str]] = None


# ────────────────────────────────────────────────────────────────────
# 3. Task Decomposition
# ────────────────────────────────────────────────────────────────────

class TaskStep(BaseModel):
    """A single micro-step within a decomposed task."""

    step: int
    description: str
    estimated_minutes: int = Field(default=1, ge=1)
    priority: Literal["must-do", "should-do", "nice-to-have"] = "must-do"
    is_completed: bool = False


class Task(BaseModel):
    """A user task (standalone or generated from content)."""

    id: str
    user_id: str
    title: str
    description: str = ""
    priority: Literal["low", "medium", "high"] = "medium"
    status: Literal["pending", "in_progress", "completed", "cancelled"] = "pending"
    due_date: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class TaskDecomposition(BaseModel):
    """Result of breaking a goal or document into small, achievable steps."""

    source_content_id: str = ""
    goal_summary: str = ""
    total_estimated_minutes: int = 0
    steps: List[TaskStep] = []


class Reminder(BaseModel):
    """A scheduled reminder linked to a task or standalone."""

    id: str
    user_id: str
    title: str
    description: str = ""
    scheduled_time: str          # ISO 8601
    channel: Literal["email", "sms", "push"] = "push"
    recurring: Optional[Literal["daily", "weekly", "monthly"]] = None
    status: Literal["active", "completed", "snoozed"] = "active"
    created_at: str = ""
    updated_at: str = ""


# ────────────────────────────────────────────────────────────────────
# 4. Adapted Content (easy-to-digest output)
# ────────────────────────────────────────────────────────────────────

class SourceAnalysis(BaseModel):
    """Reading-level analysis of the original source text."""

    fkgl: float = 0.0                # Flesch-Kincaid Grade Level
    word_count: int = 0
    sentence_count: int = 0
    char_count: int = 0
    has_instructions: bool = False


class AudioScriptChunk(BaseModel):
    """A ~30-second chunk of adapted text for TTS narration."""

    index: int = 0
    text: str = ""
    word_count: int = 0
    estimated_duration_s: float = 0.0


class WebCitation(BaseModel):
    """A URL citation from Bing / web search grounding."""

    title: str = ""
    url: str = ""
    snippet: str = ""


class AdaptedContent(BaseModel):
    """Full output of the content adaptation pipeline."""

    content_id: str
    profile: str = "medium"          # one of NEURODIVERSE_PROFILES keys
    source_analysis: SourceAnalysis = SourceAnalysis()
    adapted_text: str = ""
    summary: str = ""
    audio_scripts: List[AudioScriptChunk] = []
    tasks: List[TaskStep] = []       # task decomposition if source has instructions
    web_citations: List[WebCitation] = []
    created_at: str = ""


# ────────────────────────────────────────────────────────────────────
# 5. Audio / Audiobook output
# ────────────────────────────────────────────────────────────────────

class AudioNarration(BaseModel):
    """TTS audio narration for a single section (Azure Speech)."""

    section_title: str = ""
    file_url: str = ""               # Blob URL to the audio file
    duration_seconds: float = 0.0
    voice_id: str = ""               # Azure Speech voice name used
    style: str = "calm"              # SSML express-as style
    format: str = "mp3"
    size_bytes: int = 0


class AudiobookOutput(BaseModel):
    """Complete audiobook — one narration per content section."""

    content_id: str
    title: str = ""
    narrations: List[AudioNarration] = []
    total_duration_seconds: float = 0.0
    voice_id: str = ""
    created_at: str = ""


# ────────────────────────────────────────────────────────────────────
# 6. Pipeline Output — combined result of the full agent workflow
# ────────────────────────────────────────────────────────────────────

class PipelineOutput(BaseModel):
    """End-to-end result returned by the content processing workflow.

    Mirrors BookOutput from the reference project but tailored to
    neurodiverse content adaptation."""

    request: ContentRequest
    adapted: Optional[AdaptedContent] = None
    task_plan: Optional[TaskDecomposition] = None
    audiobook: Optional[AudiobookOutput] = None
    status: Literal["pending", "processing", "completed", "failed"] = "pending"
    error: str = ""
    created_at: str = ""


# ────────────────────────────────────────────────────────────────────
# Chat / session models (convenience wrappers)
# ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str = ""


class ChatSession(BaseModel):
    id: str
    user_id: str
    title: str = ""
    created_at: str = ""
    updated_at: str = ""


class ChatResponse(BaseModel):
    session_id: str
    message: ChatMessage
