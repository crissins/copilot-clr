"""
Create (or update) the CopilotCLR Speech Agent in Azure AI Foundry
with Voice Live configuration stored in agent metadata.

Based on: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
           voice-live-agents-quickstart

Usage:
  1. Set PROJECT_ENDPOINT, SPEECH_AGENT_NAME, SPEECH_MODEL_DEPLOYMENT in .env
  2. az login
  3. python create_speech_agent.py
"""

import json
import os
import sys

from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition

load_dotenv()


# ── Voice Live config chunking (512-char metadata limit) ────────────────────

def chunk_config(config_json: str, limit: int = 512) -> dict:
    """Split config into chunked metadata entries."""
    metadata = {"microsoft.voice-live.configuration": config_json[:limit]}
    remaining = config_json[limit:]
    chunk_num = 1
    while remaining:
        metadata[f"microsoft.voice-live.configuration.{chunk_num}"] = remaining[:limit]
        remaining = remaining[limit:]
        chunk_num += 1
    return metadata


def reassemble_config(metadata: dict) -> str:
    """Reassemble chunked Voice Live configuration."""
    config = metadata.get("microsoft.voice-live.configuration", "")
    chunk_num = 1
    while f"microsoft.voice-live.configuration.{chunk_num}" in metadata:
        config += metadata[f"microsoft.voice-live.configuration.{chunk_num}"]
        chunk_num += 1
    return config


# ── Configuration ───────────────────────────────────────────────────────────

project_endpoint = os.environ.get("PROJECT_ENDPOINT", "")
agent_name = os.environ.get("SPEECH_AGENT_NAME", "CopilotCLR-SpeechAssistant")
model_deployment = os.environ.get("SPEECH_MODEL_DEPLOYMENT", "gpt-4.1-mini")
voice_name = os.environ.get("SPEECH_VOICE_NAME", "en-US-Ava:DragonHDLatestNeural")

if not project_endpoint:
    sys.exit("Set PROJECT_ENDPOINT in your .env file (Foundry project endpoint).")

# ── Agent instructions (calm, neurodiverse-friendly persona) ────────────────

AGENT_INSTRUCTIONS = """You are Copilot CLR Speech Assistant — a calm, warm AI designed to help
neurodiverse users (ADHD, autism, dyslexia) through voice conversation.

Your communication style:
- Use clear, simple, direct language. Prefer short sentences (under 15 words each).
- Break complex ideas into numbered steps.
- Never use urgent or anxiety-inducing language.
- Be patient and encouraging. Acknowledge the user's effort.
- Responses should be concise — optimized for being spoken aloud.
- Limit responses to 3-4 sentences unless the user asks for more detail.

Your responsibilities:
- Simplify complex content so it can be comfortably spoken and understood.
- Answer questions accurately and concisely.
- When you receive transcribed speech input, respond naturally as in conversation.
- Format for spoken delivery — avoid markdown, code blocks, or visual formatting.
- Use natural pauses by inserting commas and periods at logical breaks.

Responsible AI:
- Never produce content that could cause anxiety, distress, or overwhelm.
- Be transparent about what you know and don't know.
- Treat every user with dignity and assume positive intent.
"""

# ── Voice Live session settings (calm delivery) ────────────────────────────

voice_live_config = {
    "session": {
        "voice": {
            "name": voice_name,
            "type": "azure-standard",
            "temperature": 0.5,
        },
        "input_audio_transcription": {
            "model": "azure-speech",
        },
        "turn_detection": {
            "type": "azure_semantic_vad",
            "end_of_utterance_detection": {
                "model": "semantic_detection_v1_multilingual",
            },
        },
        "input_audio_noise_reduction": {"type": "azure_deep_noise_suppression"},
        "input_audio_echo_cancellation": {"type": "server_echo_cancellation"},
    }
}


# ── Create agent ────────────────────────────────────────────────────────────

def main() -> None:
    print(f"Project endpoint: {project_endpoint}")
    print(f"Agent name:       {agent_name}")
    print(f"Model:            {model_deployment}")
    print(f"Voice:            {voice_name}")
    print()

    project_client = AIProjectClient(
        endpoint=project_endpoint,
        credential=DefaultAzureCredential(),
    )

    agent = project_client.agents.create_version(
        agent_name=agent_name,
        definition=PromptAgentDefinition(
            model=model_deployment,
            instructions=AGENT_INSTRUCTIONS,
        ),
        metadata=chunk_config(json.dumps(voice_live_config)),
    )
    print(f"Agent created: {agent.name} (version {agent.version})")

    # Verify Voice Live configuration was stored correctly
    retrieved_agent = project_client.agents.get(agent_name=agent_name)
    stored_metadata = (retrieved_agent.versions or {}).get("latest", {}).get("metadata", {})
    stored_config = reassemble_config(stored_metadata)

    if stored_config:
        print("\nVoice Live configuration stored in agent metadata:")
        print(json.dumps(json.loads(stored_config), indent=2))
    else:
        print("\nVoice Live configuration not found in agent metadata.")


if __name__ == "__main__":
    main()
