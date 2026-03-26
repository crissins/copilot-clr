from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

SimplifyMode = Literal["summary", "plan", "instructions", "breakdown"]
ReadingLevel = Literal["simple", "standard", "very_simple"]


class SimplifyRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Texto a simplificar")
    mode: SimplifyMode = Field(default="summary")
    reading_level: ReadingLevel = Field(default="simple")
    language: str = Field(default="es")
    title: Optional[str] = Field(default=None, max_length=200)
    use_accessibility_profile: bool = Field(default=True)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("El texto no puede estar vacío.")
        return cleaned


class SimplifyResponse(BaseModel):
    title: str
    original_text: str
    simplified_text: str
    plain_text: str
    mode: SimplifyMode
    reading_level: ReadingLevel
    language: str
    bullets_count: int
    estimated_reading_minutes: int
    source: str = "azure-ai-foundry"