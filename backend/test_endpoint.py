"""Test different endpoint formats for AIProjectClient."""
from azure.ai.projects import AIProjectClient
from azure.identity import AzureCliCredential
import logging, sys

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# Try the workspace path WITHOUT the /agents/v1.0 prefix
endpoint = (
    "https://eastus2.api.azureml.ms/subscriptions/edd0e1f4-aaca-4046-888f-dbd0c67914a0"
    "/resourceGroups/rg-chatapp-prod/providers/Microsoft.MachineLearningServices"
    "/workspaces/ai-project-kvhky"
)

print(f"Trying endpoint: {endpoint}")
client = AIProjectClient(endpoint=endpoint, credential=AzureCliCredential())

try:
    agents = list(client.agents.list())
    print(f"SUCCESS! Agents: {len(agents)}")
    for a in agents:
        print(f"  Agent: {a}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {str(e)[:800]}")
