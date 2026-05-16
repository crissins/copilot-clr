import math
import re

from app.core.config import get_settings
from app.models.accessibility_models import AccessibilityPresetName
from app.models.simplify_models import SimplifyRequest, SimplifyResponse
from app.services.foundry_service import FoundryService

settings = get_settings()


class SimplifierService:
    def __init__(self) -> None:
        self.foundry_service = FoundryService()

    def simplify(
        self,
        payload: SimplifyRequest,
        accessibility_preset: AccessibilityPresetName = "default",
    ) -> SimplifyResponse:
        text = payload.text[: settings.simplify_max_chars]

        prompt = self._build_prompt(
            text=text,
            mode=payload.mode,
            reading_level=payload.reading_level,
            language=payload.language,
            accessibility_preset=accessibility_preset,
            title=payload.title,
        )

        simplified_text = self.foundry_service.generate(prompt=prompt)
        plain_text = self._to_plain_text(simplified_text)

        return SimplifyResponse(
            title=payload.title or self._default_title(payload.mode),
            original_text=text,
            simplified_text=simplified_text.strip(),
            plain_text=plain_text,
            mode=payload.mode,
            reading_level=payload.reading_level,
            language=payload.language,
            bullets_count=self._count_bullets(simplified_text),
            estimated_reading_minutes=max(1, math.ceil(len(plain_text.split()) / 180)),
        )

    def _build_prompt(
        self,
        text: str,
        mode: str,
        reading_level: str,
        language: str,
        accessibility_preset: str,
        title: str | None,
    ) -> str:
        return f"""
Eres un asistente especializado en reducir carga cognitiva.
Devuelve SIEMPRE la salida en {language}.
No uses párrafos largos.
Usa encabezados cortos.
Usa pasos claros y numerados cuando aplique.
Evita jerga innecesaria.
Reading level: {reading_level}.
Mode: {mode}.
Accessibility preset: {accessibility_preset}.
Title: {title or "Sin título"}.

Instrucciones adicionales:
- Si el preset es dyslexia_friendly, usa frases cortas, vocabulario simple y bloques pequeños.
- Si el modo es summary, resume lo esencial.
- Si el modo es plan, conviértelo en pasos accionables.
- Si el modo es instructions, explica qué hacer claramente.
- Si el modo es breakdown, divide el contenido en partes pequeñas y comprensibles.

Texto original:
{text}
""".strip()

    def _to_plain_text(self, content: str) -> str:
        text = re.sub(r"^```[a-zA-Z]*\n?", "", content.strip())
        text = re.sub(r"```$", "", text)
        text = re.sub(r"[#>*_`-]", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _count_bullets(self, content: str) -> int:
        return len(re.findall(r"(^|\n)\s*([-*]|\d+\.)\s+", content))

    def _default_title(self, mode: str) -> str:
        titles = {
            "summary": "Resumen simplificado",
            "plan": "Plan paso a paso",
            "instructions": "Instrucciones simplificadas",
            "breakdown": "Desglose del contenido",
        }
        return titles.get(mode, "Contenido simplificado")