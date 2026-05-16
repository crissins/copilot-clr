import os
from pathlib import Path

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.identity import DefaultAzureCredential


def load_env_file(env_path: str = ".env") -> None:
    path = Path(env_path)
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    load_env_file()

    project_endpoint = (
        os.getenv("AZURE_AI_PROJECT_ENDPOINT")
        or os.getenv("FOUNDRY_PROJECT_ENDPOINT")
    )
    model_deployment = os.getenv("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4.1-mini")
    agent_name = os.getenv("FOUNDRY_AGENT_NAME", "document-simplifier-agent")

    if not project_endpoint:
        raise ValueError(
            "Falta AZURE_AI_PROJECT_ENDPOINT o FOUNDRY_PROJECT_ENDPOINT en .env o variables de entorno."
        )

    credential = DefaultAzureCredential()

    project_client = AIProjectClient(
        endpoint=project_endpoint,
        credential=credential,
    )

    instructions = """
Eres un asistente especializado en reducir carga cognitiva.
Debes:
- simplificar documentos densos
- resumir con lenguaje claro
- dividir instrucciones en pasos pequeños
- usar tono calmado y accesible
- evitar párrafos largos
- priorizar claridad para usuarios con dislexia, TDAH y autismo
Responde en español salvo que se indique otro idioma.
""".strip()

    with project_client:
        agent = project_client.agents.create_version(
            agent_name=agent_name,
            definition=PromptAgentDefinition(
                model=model_deployment,
                instructions=instructions,
            ),
        )

    print("Agent created successfully.")
    print(f"FOUNDRY_AGENT_NAME={agent.name}")
    print(f"FOUNDRY_AGENT_ID={agent.id}")
    print(f"FOUNDRY_AGENT_VERSION={agent.version}")


if __name__ == "__main__":
    main()