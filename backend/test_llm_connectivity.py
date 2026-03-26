"""
LLM Connectivity Test Suite

Tests that Azure OpenAI and Agent Framework endpoints are reachable
and can generate completions. Run from the backend/ directory:

    python test_llm_connectivity.py

Requires:
    - Azure CLI login (az login)
    - backend/.env with PROJECT_ENDPOINT and AZURE_OPENAI_ENDPOINT
"""

import asyncio
import os
import sys
import time

from dotenv import load_dotenv

load_dotenv(override=False)

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"


def header(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def result(name: str, ok: bool, detail: str = "", elapsed_ms: int | None = None) -> bool:
    tag = PASS if ok else FAIL
    timing = f" ({elapsed_ms}ms)" if elapsed_ms is not None else ""
    print(f"  [{tag}] {name}{timing}")
    if detail:
        for line in detail.splitlines():
            print(f"         {line}")
    return ok


def skip(name: str, reason: str) -> bool:
    print(f"  [{SKIP}] {name} — {reason}")
    return True  # skips don't count as failures


# ── Test 1: Azure OpenAI direct completion ──────────────────────────────────

def test_azure_openai() -> bool:
    header("Test 1: Azure OpenAI Direct Completion")

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    if not endpoint:
        return skip("Azure OpenAI", "AZURE_OPENAI_ENDPOINT not set")

    try:
        from openai import AzureOpenAI
        from azure.identity import AzureCliCredential, get_bearer_token_provider
    except ImportError as e:
        return result("Azure OpenAI", False, f"Missing package: {e}")

    token_provider = get_bearer_token_provider(
        AzureCliCredential(), "https://cognitiveservices.azure.com/.default"
    )

    # Try known deployment names in order of preference
    deployments = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"]
    client = AzureOpenAI(
        azure_endpoint=endpoint,
        azure_ad_token_provider=token_provider,
        api_version="2024-12-01-preview",
    )

    for deploy in deployments:
        try:
            t0 = time.perf_counter()
            resp = client.chat.completions.create(
                model=deploy,
                messages=[{"role": "user", "content": "Say 'hello' and nothing else."}],
                max_tokens=10,
            )
            ms = int((time.perf_counter() - t0) * 1000)
            text = resp.choices[0].message.content.strip()
            return result(
                f"Azure OpenAI ({deploy})",
                True,
                f"Response: {text}",
                elapsed_ms=ms,
            )
        except Exception as e:
            err = str(e)[:200]
            # If deployment not found, try next
            if "DeploymentNotFound" in err or "does not exist" in err:
                print(f"    (deployment '{deploy}' not found, trying next...)")
                continue
            return result(f"Azure OpenAI ({deploy})", False, err)

    return result("Azure OpenAI", False, f"No working deployment found. Tried: {deployments}")


# ── Test 2: Agent Framework (AzureAIClient) ─────────────────────────────────

async def _test_agent_framework() -> bool:
    header("Test 2: Agent Framework (AzureAIClient)")

    project_endpoint = os.getenv("PROJECT_ENDPOINT", "")
    if not project_endpoint:
        return skip("Agent Framework", "PROJECT_ENDPOINT not set")

    try:
        from agent_framework import Message
        from agent_framework.azure import AzureAIClient
        from azure.identity.aio import DefaultAzureCredential
    except ImportError as e:
        return result("Agent Framework", False, f"Missing package: {e}")

    deploy = os.getenv("MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")
    credential = DefaultAzureCredential()

    try:
        t0 = time.perf_counter()
        async with AzureAIClient(
            project_endpoint=project_endpoint,
            model_deployment_name=deploy,
            credential=credential,
        ).as_agent(
            name="ConnectivityTest",
            instructions="You are a test agent. Reply with exactly: OK",
        ) as agent:
            msgs = [Message(role="user", contents=["Say OK"])]
            resp = await agent.run(msgs)
            text = resp.text if hasattr(resp, "text") else str(resp)
        ms = int((time.perf_counter() - t0) * 1000)
        return result(
            f"Agent Framework ({deploy})",
            True,
            f"Response: {text[:200]}",
            elapsed_ms=ms,
        )
    except Exception as e:
        return result(f"Agent Framework ({deploy})", False, f"{type(e).__name__}: {str(e)[:300]}")
    finally:
        await credential.close()


def test_agent_framework() -> bool:
    return asyncio.run(_test_agent_framework())


# ── Test 3: Cosmos DB connectivity ──────────────────────────────────────────

def test_cosmos() -> bool:
    header("Test 3: Cosmos DB Connectivity")

    endpoint = os.getenv("COSMOS_DB_ENDPOINT", "")
    db_name = os.getenv("COSMOS_DB_DATABASE", "ChatApp")
    if not endpoint:
        return skip("Cosmos DB", "COSMOS_DB_ENDPOINT not set")

    try:
        from azure.cosmos import CosmosClient
        from azure.identity import AzureCliCredential
    except ImportError as e:
        return result("Cosmos DB", False, f"Missing package: {e}")

    try:
        t0 = time.perf_counter()
        client = CosmosClient(endpoint, credential=AzureCliCredential())
        db = client.get_database_client(db_name)
        containers = [c["id"] for c in db.list_containers()]
        ms = int((time.perf_counter() - t0) * 1000)
        return result(
            "Cosmos DB",
            True,
            f"Database: {db_name}, Containers: {', '.join(containers)}",
            elapsed_ms=ms,
        )
    except Exception as e:
        return result("Cosmos DB", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Test 4: Azure AI Search ─────────────────────────────────────────────────

def test_search() -> bool:
    header("Test 4: Azure AI Search")

    endpoint = os.getenv("AZURE_SEARCH_ENDPOINT", "")
    if not endpoint:
        return skip("AI Search", "AZURE_SEARCH_ENDPOINT not set")

    try:
        from azure.search.documents import SearchClient
        from azure.identity import AzureCliCredential
    except ImportError as e:
        return result("AI Search", False, f"Missing package: {e}")

    index_name = os.getenv("AZURE_SEARCH_INDEX", "documents")
    try:
        t0 = time.perf_counter()
        client = SearchClient(
            endpoint=endpoint,
            index_name=index_name,
            credential=AzureCliCredential(),
        )
        results = list(client.search("test", top=1))
        ms = int((time.perf_counter() - t0) * 1000)
        count = len(results)
        return result(
            f"AI Search ({index_name})",
            True,
            f"Query returned {count} result(s)",
            elapsed_ms=ms,
        )
    except Exception as e:
        return result(f"AI Search ({index_name})", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Test 5: Speech Service ──────────────────────────────────────────────────

def test_speech() -> bool:
    header("Test 5: Azure Speech Service")

    region = os.getenv("SPEECH_REGION", "")
    if not region:
        return skip("Speech", "SPEECH_REGION not set")

    try:
        from azure.identity import AzureCliCredential
        import urllib.request
        import json
    except ImportError as e:
        return result("Speech", False, f"Missing package: {e}")

    # Get a token to verify the Speech endpoint is reachable
    try:
        t0 = time.perf_counter()
        cred = AzureCliCredential()
        token = cred.get_token("https://cognitiveservices.azure.com/.default")

        speech_endpoint = os.getenv("SPEECH_ENDPOINT", f"https://{region}.api.cognitive.microsoft.com")
        # Use the speech endpoint's token exchange
        url = f"{speech_endpoint.rstrip('/')}/sts/v1.0/issueToken"
        req = urllib.request.Request(
            url,
            method="POST",
            headers={"Authorization": f"Bearer {token.token}", "Content-Length": "0"},
            data=b"",
        )
        resp = urllib.request.urlopen(req, timeout=10)
        ms = int((time.perf_counter() - t0) * 1000)
        return result("Speech token exchange", resp.status == 200, f"Region: {region}", elapsed_ms=ms)
    except Exception as e:
        return result("Speech", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Test 6: Backend /api/chat endpoint (integration) ────────────────────────

def test_chat_endpoint() -> bool:
    header("Test 6: Backend /api/chat Endpoint")

    import urllib.request
    import json

    url = "http://localhost:8000/api/chat"
    payload = json.dumps({"message": "Say hello"}).encode()

    try:
        t0 = time.perf_counter()
        req = urllib.request.Request(
            url,
            method="POST",
            headers={"Content-Type": "application/json"},
            data=payload,
        )
        resp = urllib.request.urlopen(req, timeout=30)
        body = json.loads(resp.read().decode())
        ms = int((time.perf_counter() - t0) * 1000)
        msg = body.get("message", {})
        content = (msg.get("content", "") if isinstance(msg, dict) else str(msg))[:200]

        # Check it's not the fallback error message
        is_fallback = "little trouble" in content.lower() or "try again" in content.lower()
        return result(
            "/api/chat",
            not is_fallback,
            f"Response: {content}" + (" (FALLBACK ERROR)" if is_fallback else ""),
            elapsed_ms=ms,
        )
    except Exception as e:
        return result("/api/chat", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    print("\nLLM & Service Connectivity Test Suite")
    print("=" * 60)

    tests = [
        test_azure_openai,
        test_agent_framework,
        test_cosmos,
        test_search,
        test_speech,
        test_chat_endpoint,
    ]

    results = []
    for test_fn in tests:
        try:
            ok = test_fn()
            results.append((test_fn.__name__, ok))
        except Exception as e:
            print(f"  [{FAIL}] {test_fn.__name__} — unhandled: {e}")
            results.append((test_fn.__name__, False))

    # Summary
    header("Summary")
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    for name, ok in results:
        tag = PASS if ok else FAIL
        print(f"  [{tag}] {name}")
    print(f"\n  {passed}/{total} passed\n")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
