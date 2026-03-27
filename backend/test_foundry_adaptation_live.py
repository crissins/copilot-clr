import asyncio
import os

from dotenv import load_dotenv

load_dotenv(override=False)
os.environ.pop("LOCAL_DEV", None)

from services.content_adapter import adapt_content  # noqa: E402

SAMPLE_TEXT = """
This document explains how to prepare for an exam. First, gather your notes and identify the most important topics. Then create a short study plan for the week, with one or two subjects per day. Break large topics into smaller sections, take short breaks, and review what you learned at the end of each session.
""".strip()


async def main() -> None:
    result = await adapt_content(
        source_text=SAMPLE_TEXT,
        profile="medium",
        user_prefs={"preferredFormat": "bullet points"},
        content_id="live-foundry-test",
    )
    print("summary:", result.get("summary", ""))
    print("change_summary:", result.get("change_summary", ""))
    print("adapted_text_preview:", result.get("adapted_text", "")[:800])


if __name__ == "__main__":
    asyncio.run(main())
