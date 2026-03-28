"""
All-Agent Smoke Test

Invokes all 9 AI agents with the test query: "How to install python?"
Run from the backend/ directory:

    python test_all_agents.py

Requires:
    - Azure CLI login (az login)
    - PROJECT_ENDPOINT set (via .env or environment)
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

TEST_INPUT = "How to install python?"
TEST_USER_ID = "test-user-smoke"
TEST_SESSION_ID = "test-session-smoke"


def header(title: str) -> None:
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def result(name: str, ok: bool, detail: str = "", elapsed_ms: int | None = None) -> bool:
    tag = PASS if ok else FAIL
    timing = f" ({elapsed_ms}ms)" if elapsed_ms is not None else ""
    print(f"  [{tag}] {name}{timing}")
    if detail:
        for line in detail.splitlines()[:5]:
            print(f"         {line}")
    return ok


def skip(name: str, reason: str) -> bool:
    print(f"  [{SKIP}] {name} — {reason}")
    return True


# ── Agent 1: Copilot CLRAssistant (fallback chat) ───────────────────────────

async def test_chat_agent() -> bool:
    header("Agent 1: Copilot CLRAssistant (chat_agent.get_agent_response)")

    try:
        from agents.chat_agent import get_agent_response
    except ImportError as e:
        return result("Copilot CLRAssistant", False, f"Import error: {e}")

    try:
        t0 = time.perf_counter()
        resp = await get_agent_response(TEST_INPUT, TEST_SESSION_ID, TEST_USER_ID)
        ms = int((time.perf_counter() - t0) * 1000)
        text = (resp if isinstance(resp, str) else str(resp))[:300]
        ok = bool(text.strip()) and "error" not in text.lower()[:50]
        return result("Copilot CLRAssistant", ok, f"Response: {text}", elapsed_ms=ms)
    except Exception as e:
        return result("Copilot CLRAssistant", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Agent 2: CopilotCLR-Workflow ─────────────────────────────────────────────

async def test_workflow_agent() -> bool:
    header("Agent 2: CopilotCLR-Workflow (workflow.run_workflow)")

    project_endpoint = os.getenv("PROJECT_ENDPOINT", "")
    if not project_endpoint:
        return skip("CopilotCLR-Workflow", "PROJECT_ENDPOINT not set")

    try:
        from agents.workflow import run_workflow
    except ImportError as e:
        return result("CopilotCLR-Workflow", False, f"Import error: {e}")

    try:
        t0 = time.perf_counter()
        resp = await run_workflow(TEST_INPUT, TEST_SESSION_ID, TEST_USER_ID)
        ms = int((time.perf_counter() - t0) * 1000)
        text = (resp if isinstance(resp, str) else str(resp))[:300]
        ok = bool(text.strip())
        return result("CopilotCLR-Workflow", ok, f"Response: {text}", elapsed_ms=ms)
    except Exception as e:
        return result("CopilotCLR-Workflow", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Agent 3–6: Content Pipeline (RequestBuilder, ContentAdapter, TaskPlanner, AudiobookScripter) ──

async def test_content_pipeline() -> bool:
    header("Agents 3-6: Content Pipeline (content_workflow.run_content_pipeline)")

    project_endpoint = os.getenv("PROJECT_ENDPOINT", "")
    if not project_endpoint:
        return skip("Content Pipeline", "PROJECT_ENDPOINT not set")

    try:
        from agents.content_workflow import run_content_pipeline
        from models import ContentRequest
    except ImportError as e:
        return result("Content Pipeline", False, f"Import error: {e}")

    request = ContentRequest(
        topic="How to install python",
        source_text=(
            "Python is a popular programming language. To install Python, "
            "visit python.org and download the installer for your operating system. "
            "Run the installer and follow the prompts. Make sure to check the box "
            "that says 'Add Python to PATH'. After installation open a terminal "
            "and type python --version to verify."
        ),
        desired_outputs=["all"],
        target_reading_level="Grade 5",
        target_format="bullet points",
        neurodiverse_profile="medium",
    )

    try:
        t0 = time.perf_counter()
        output = await run_content_pipeline(request, TEST_USER_ID)
        ms = int((time.perf_counter() - t0) * 1000)

        # Check each stage
        stages = []
        if output.adapted:
            adapted_preview = (output.adapted.adapted_text or "")[:150]
            stages.append(f"Adapted: {adapted_preview}")
        if output.task_plan:
            steps_count = len(output.task_plan.steps) if output.task_plan.steps else 0
            stages.append(f"TaskPlan: {steps_count} steps")
        if output.audiobook:
            chunks = len(output.audiobook.narrations) if output.audiobook.narrations else 0
            stages.append(f"Audiobook: {chunks} segments")

        detail = "\n".join(stages) if stages else f"Status: {output.status}"
        ok = output.status in ("completed", "partial")
        return result("Content Pipeline (4 agents)", ok, detail, elapsed_ms=ms)
    except Exception as e:
        return result("Content Pipeline", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Agent 7: Copilot-CLR-Task-Decomposer ────────────────────────────────────

async def test_task_decomposer() -> bool:
    header("Agent 7: Copilot-CLR-Task-Decomposer (task_decomposer.decompose_task)")

    project_endpoint = os.getenv("PROJECT_ENDPOINT", "")
    if not project_endpoint:
        return skip("Task Decomposer", "PROJECT_ENDPOINT not set")

    try:
        from agents.task_decomposer import decompose_task
    except ImportError as e:
        return result("Task Decomposer", False, f"Import error: {e}")

    try:
        t0 = time.perf_counter()
        resp = await decompose_task(
            goal=TEST_INPUT,
            user_id=TEST_USER_ID,
            reading_level="Grade 5",
        )
        ms = int((time.perf_counter() - t0) * 1000)
        steps = resp.get("steps", [])
        explanation = resp.get("explanation", "")[:200]
        step_titles = [s.get("title", "") for s in steps[:3]]
        detail = f"Steps: {len(steps)} | First: {step_titles}\nExplanation: {explanation}"
        ok = len(steps) > 0
        return result("Task Decomposer", ok, detail, elapsed_ms=ms)
    except Exception as e:
        return result("Task Decomposer", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Agent 8: CopilotCLR-SpeechAssistant ─────────────────────────────────────

async def test_speech_agent() -> bool:
    header("Agent 8: CopilotCLR-SpeechAssistant (speech_agent.get_speech_agent_response)")

    project_endpoint = os.getenv("PROJECT_ENDPOINT", "")
    if not project_endpoint:
        return skip("Speech Agent", "PROJECT_ENDPOINT not set")

    try:
        from agents.speech_agent import get_speech_agent_response
    except ImportError as e:
        return result("Speech Agent", False, f"Import error: {e}")

    try:
        t0 = time.perf_counter()
        resp = await get_speech_agent_response(TEST_INPUT, TEST_SESSION_ID, TEST_USER_ID)
        ms = int((time.perf_counter() - t0) * 1000)
        text = resp.get("text", "")[:300]
        has_audio = bool(resp.get("audio_base64"))
        detail = f"Text: {text}\nAudio: {'yes' if has_audio else 'no (Speech SDK may not be configured)'}"
        ok = bool(text.strip())
        return result("Speech Agent", ok, detail, elapsed_ms=ms)
    except Exception as e:
        return result("Speech Agent", False, f"{type(e).__name__}: {str(e)[:300]}")


# ── Agent 9: CopilotCLR-Simplifier-{grade} ──────────────────────────────────

async def test_content_simplifier() -> bool:
    header("Agent 9: CopilotCLR-Simplifier (content_adapter.adapt_content)")

    project_endpoint = os.getenv("PROJECT_ENDPOINT", "")
    if not project_endpoint:
        local_dev = os.getenv("LOCAL_DEV", "").lower() in ("1", "true", "yes")
        if not local_dev:
            return skip("Content Simplifier", "PROJECT_ENDPOINT not set and LOCAL_DEV not enabled")

    try:
        from services.content_adapter import adapt_content
    except ImportError as e:
        return result("Content Simplifier", False, f"Import error: {e}")

    source_text = (
        "Python is a high-level, general-purpose programming language known for "
        "its readability and versatility. It supports multiple programming paradigms, "
        "including structured, object-oriented, and functional programming. Python "
        "features dynamic typing and garbage collection. To install Python, navigate "
        "to the official website python.org, download the appropriate installer for "
        "your operating system, and follow the installation wizard instructions."
    )

    profiles_to_test = ["low", "adhd", "dyslexia"]
    all_ok = True

    for profile in profiles_to_test:
        try:
            t0 = time.perf_counter()
            resp = await adapt_content(source_text=source_text, profile=profile)
            ms = int((time.perf_counter() - t0) * 1000)
            adapted = resp.get("adapted_text", "")[:200]
            fkgl = resp.get("source_analysis", {}).get("fkgl", "?")
            ok = bool(adapted.strip())
            all_ok = all_ok and ok
            result(
                f"Simplifier (profile={profile})",
                ok,
                f"FKGL: {fkgl} | Adapted: {adapted}",
                elapsed_ms=ms,
            )
        except Exception as e:
            all_ok = False
            result(f"Simplifier (profile={profile})", False, f"{type(e).__name__}: {str(e)[:200]}")

    return all_ok


# ── Main ─────────────────────────────────────────────────────────────────────

async def run_all() -> None:
    print("\n" + "=" * 70)
    print("  ALL-AGENT SMOKE TEST")
    print(f'  Test input: "{TEST_INPUT}"')
    print("=" * 70)

    tests = [
        ("Agent 1: Copilot CLRAssistant", test_chat_agent),
        ("Agent 2: CopilotCLR-Workflow", test_workflow_agent),
        ("Agents 3-6: Content Pipeline", test_content_pipeline),
        ("Agent 7: Task Decomposer", test_task_decomposer),
        ("Agent 8: Speech Agent", test_speech_agent),
        ("Agent 9: Content Simplifier", test_content_simplifier),
    ]

    results_list: list[tuple[str, bool]] = []

    for name, test_fn in tests:
        try:
            ok = await test_fn()
            results_list.append((name, ok))
        except Exception as e:
            print(f"  [{FAIL}] {name} — unhandled: {e}")
            results_list.append((name, False))

    # Summary
    header("Summary — 9 Agents (6 test groups)")
    passed = sum(1 for _, ok in results_list if ok)
    total = len(results_list)
    for name, ok in results_list:
        tag = PASS if ok else FAIL
        print(f"  [{tag}] {name}")
    print(f"\n  {passed}/{total} test groups passed\n")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    asyncio.run(run_all())
