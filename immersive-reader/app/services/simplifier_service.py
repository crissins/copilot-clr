from typing import Optional

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

from core.config import get_settings

settings = get_settings()


class FoundryService:
    """
    Encapsula la conexión con Azure AI Foundry.
    Usa el proyecto para obtener un cliente autenticado de OpenAI.
    Si existe FOUNDRY_AGENT_NAME, intenta usar el agente.
    Si no, cae a respuestas directas con el modelo desplegado.
    """

    def __init__(self) -> None:
        self.endpoint = settings.azure_ai_project_endpoint
        self.model = settings.azure_ai_model_deployment_name
        self.agent_name = settings.foundry_agent_name

    def _get_project_client(self) -> AIProjectClient:
        credential = DefaultAzureCredential()
        return AIProjectClient(endpoint=self.endpoint, credential=credential)

    def generate(self, prompt: str, system_instructions: Optional[str] = None) -> str:
        if not self.endpoint:
            raise ValueError("AZURE_AI_PROJECT_ENDPOINT no está configurado.")
        if not self.model:
            raise ValueError("AZURE_AI_MODEL_DEPLOYMENT_NAME no está configurado.")

        with self._get_project_client() as project_client:
            with project_client.get_openai_client() as openai_client:
                if self.agent_name:
                    conversation = openai_client.conversations.create(
                        items=[
                            {
                                "type": "message",
                                "role": "user",
                                "content": prompt,
                            }
                        ]
                    )

                    response = openai_client.responses.create(
                        conversation=conversation.id,
                        extra_body={
                            "agent_reference": {
                                "name": self.agent_name,
                                "type": "agent_reference",
                            }
                        },
                    )
                    return response.output_text

                combined_input = prompt
                if system_instructions:
                    combined_input = f"{system_instructions}\n\nUsuario:\n{prompt}"

                response = openai_client.responses.create(
                    model=self.model,
                    input=combined_input,
                )
                return response.output_text