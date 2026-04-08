import os
import logging
from typing import Optional

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient


logger = logging.getLogger(__name__)


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_preference_context(
    reading_level: str,
    response_format: str,
    max_steps: int,
    calm_tone: bool,
    show_only_next_step: bool,
) -> str:
    tone = "calm and supportive" if calm_tone else "neutral"
    steps_rule = f"Do not exceed {max_steps} steps under any circumstance."
    next_step_mode = (
        "CRITICAL: Only return ONE single next action. Do not include multiple steps, summaries, or extra explanations."
        if show_only_next_step
        else "You may provide a short sequence of steps when helpful."
    )
    format_rule = (
        "Return plain text with only one short action."
        if show_only_next_step
        else f"Use the requested response format: {response_format}."
    )

    return f"""
User accessibility preferences:
- Reading level: {reading_level}
- Response format: {response_format}
- Maximum steps: {max_steps}
- Tone: {tone}
- Next-step mode: {next_step_mode}

Rules:
- {steps_rule}
- {format_rule}

Apply these preferences to your response.
Keep the answer easy to process and well structured.
""".strip()


def extract_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text

    parts: list[str] = []

    try:
        for item in getattr(response, "output", []):
            for content in getattr(item, "content", []):
                text_value = getattr(content, "text", None)
                if isinstance(text_value, str):
                    parts.append(text_value)
                elif hasattr(text_value, "value"):
                    parts.append(text_value.value)
    except Exception:
        logger.exception("Error extracting text from response")

    if parts:
        return "\n".join(parts)

    return "No text response was returned by the agent."


class FoundryChatService:
    def __init__(self) -> None:
        self.project_endpoint = require_env("FOUNDRY_PROJECT_ENDPOINT")
        self.agent_name = os.getenv("AGENT_NAME", "cognitive-load-agent")

        logger.info(f"Using Foundry endpoint: {self.project_endpoint}")
        logger.info(f"Using agent: {self.agent_name}")

        self.project_client = AIProjectClient(
            endpoint=self.project_endpoint,
            credential=DefaultAzureCredential(),
        )

        self.openai_client = self.project_client.get_openai_client()

    def create_conversation(self) -> str:
        conversation = self.openai_client.conversations.create()
        return conversation.id

    def send_message(
        self,
        message: str,
        reading_level: str,
        response_format: str,
        max_steps: int,
        calm_tone: bool,
        show_only_next_step: bool,
        conversation_id: Optional[str] = None,
    ) -> tuple[str, str]:

        # Sanitizar input (evita payloads enormes)
        message = message.strip()[:2000]

        if not conversation_id:
            conversation_id = self.create_conversation()

        preference_context = build_preference_context(
            reading_level=reading_level,
            response_format=response_format,
            max_steps=max_steps,
            calm_tone=calm_tone,
            show_only_next_step=show_only_next_step,
        )

        combined_input = f"""
{preference_context}

User message:
{message}
""".strip()

        try:
            response = self.openai_client.responses.create(
                conversation=conversation_id,
                input=combined_input,
                extra_body={
                    "agent_reference": {
                        "name": self.agent_name,
                        "type": "agent_reference",
                    }
                },
            )
        except Exception as e:
            logger.exception("Error calling Foundry service")
            raise RuntimeError("Failed to generate response from AI service") from e

        reply = extract_text(response)

        if not reply:
            logger.warning("Empty response received from Foundry")

        return reply, conversation_id