from typing import Literal, Optional
from pydantic import BaseModel, Field


ReadingLevel = Literal["simple", "standard", "beginner"]
ResponseFormat = Literal["steps", "summary", "checklist"]


class AccessibilityPreferences(BaseModel):
    readingLevel: ReadingLevel = "simple"
    responseFormat: ResponseFormat = "steps"
    maxSteps: int = Field(default=5, ge=1, le=10)
    calmTone: bool = True
    showOnlyNextStep: bool = False


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    preferences: AccessibilityPreferences = AccessibilityPreferences()
    conversationId: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    conversationId: str