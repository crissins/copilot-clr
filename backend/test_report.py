"""Quick smoke test for POST /api/report endpoint.

Run with:  python test_report.py
Requires:  httpx (already in requirements)
"""

import asyncio
import os
import sys

# Force local-dev mode so auth is bypassed and in-memory storage is used.
os.environ["LOCAL_DEV"] = "true"

from httpx import ASGITransport, AsyncClient  # noqa: E402
from main import app  # noqa: E402

_passed = 0
_failed = 0


async def _run():
    global _passed, _failed
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Successful report
        resp = await client.post(
            "/api/report",
            json={
                "messageId": "msg-001",
                "sessionId": "sess-001",
                "reason": "Inaccurate response",
            },
        )
        _check("report_success: status 201", resp.status_code == 201)
        _check("report_success: has id", "id" in resp.json())
        _check("report_success: status created", resp.json()["status"] == "created")

        # 2. Missing messageId
        resp = await client.post(
            "/api/report",
            json={"sessionId": "sess-001", "reason": "Bad answer"},
        )
        _check("missing_messageId: status 400", resp.status_code == 400)

        # 3. Missing reason
        resp = await client.post(
            "/api/report",
            json={"messageId": "msg-001", "sessionId": "sess-001", "reason": ""},
        )
        _check("missing_reason: status 400", resp.status_code == 400)

        # 4. Reason too long
        resp = await client.post(
            "/api/report",
            json={
                "messageId": "msg-001",
                "sessionId": "sess-001",
                "reason": "x" * 2001,
            },
        )
        _check("reason_too_long: status 400", resp.status_code == 400)


def _check(label: str, condition: bool):
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  PASS  {label}")
    else:
        _failed += 1
        print(f"  FAIL  {label}")


if __name__ == "__main__":
    asyncio.run(_run())
    print(f"\n{_passed} passed, {_failed} failed")
    sys.exit(1 if _failed else 0)
