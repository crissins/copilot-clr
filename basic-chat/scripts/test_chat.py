import os
import sys

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def extract_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text

    try:
        parts = []
        for item in getattr(response, "output", []):
            for content in getattr(item, "content", []):
                text_value = getattr(content, "text", None)
                if isinstance(text_value, str):
                    parts.append(text_value)
                elif hasattr(text_value, "value"):
                    parts.append(text_value.value)
        if parts:
            return "\n".join(parts)
    except Exception:
        pass

    return "No text response was returned by the agent."


def main() -> None:
    project_endpoint = require_env("FOUNDRY_PROJECT_ENDPOINT")
    agent_name = os.getenv("AGENT_NAME", "cognitive-load-agent")

    project_client = AIProjectClient(
        endpoint=project_endpoint,
        credential=DefaultAzureCredential(),
    )

    openai_client = project_client.get_openai_client()

    print(f"Using agent: {agent_name}")
    print("Creating conversation...")

    conversation = openai_client.conversations.create()
    conversation_id = conversation.id

    print(f"Conversation created: {conversation_id}")
    print("Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ").strip()

        if not user_input:
            continue

        if user_input.lower() in {"exit", "quit"}:
            print("Ending chat.")
            break

        try:
            response = openai_client.responses.create(
                conversation=conversation_id,
                input=user_input,
                extra_body={
                    "agent_reference": {
                        "name": agent_name,
                        "type": "agent_reference",
                    }
                },
            )

            reply = extract_text(response)
            print(f"\nAssistant: {reply}\n")

        except Exception as ex:
            print(
                "\nAssistant: Sorry — I’m having trouble responding right now. "
                "Please try again in a moment.\n"
            )
            print(f"[DEBUG] {ex}", file=sys.stderr)


if __name__ == "__main__":
    main()