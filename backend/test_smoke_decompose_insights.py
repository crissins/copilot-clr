"""Smoke test for task decomposer and insights endpoints.

Run with:
  python test_smoke_decompose_insights.py
"""

import asyncio
import os
import sys

os.environ["LOCAL_DEV"] = "true"

from httpx import ASGITransport, AsyncClient  # noqa: E402
from main import app  # noqa: E402


async def main() -> int:
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("[1/2] POST /api/tasks/decompose")
        decompose_resp = await client.post(
            "/api/tasks/decompose",
            json={"goal": "Plan my study schedule for this week", "readingLevel": "5"},
        )
        print(f"status={decompose_resp.status_code}")
        if decompose_resp.status_code != 201:
            print(decompose_resp.text)
            return 1

        decompose_data = decompose_resp.json()
        steps = decompose_data.get("task", {}).get("steps", [])
        print(f"task_id={decompose_data.get('task', {}).get('id', '')}")
        print(f"steps={len(steps)}")

        print("[2/2] GET /api/insights")
        insights_resp = await client.get("/api/insights")
        print(f"status={insights_resp.status_code}")
        if insights_resp.status_code != 200:
            print(insights_resp.text)
            return 1

        insights = insights_resp.json()
        required_keys = [
            "totalTokensUsed",
            "totalAdaptations",
            "wordsSaved",
            "totalMessages",
            "totalTaskPlans",
        ]
        missing = [k for k in required_keys if k not in insights]
        if missing:
            print("Missing keys:", missing)
            return 1

        print("metrics:")
        print(f"  totalMessages={insights['totalMessages']}")
        print(f"  totalTaskPlans={insights['totalTaskPlans']}")
        print(f"  totalTokensUsed={insights['totalTokensUsed']}")
        print(f"  totalAdaptations={insights['totalAdaptations']}")
        print(f"  wordsSaved={insights['wordsSaved']}")

    print("Smoke test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
