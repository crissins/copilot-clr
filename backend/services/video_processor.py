"""Video Processing — Azure Video Indexer.

Extracts transcripts, topics, scenes, and OCR from uploaded videos.
"""

import logging
import os
import time
from typing import Any

import requests
from azure.identity import DefaultAzureCredential

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

_VI_ACCOUNT_ID = os.environ.get("VIDEO_INDEXER_ACCOUNT_ID", "")
_VI_LOCATION = os.environ.get("VIDEO_INDEXER_LOCATION", "trial")
_VI_RESOURCE_ID = os.environ.get("VIDEO_INDEXER_RESOURCE_ID", "")


def _get_vi_access_token() -> str:
    """Get an access token for Video Indexer using managed identity."""
    credential = DefaultAzureCredential()
    token = credential.get_token("https://management.azure.com/.default")
    arm_token = token.token

    url = (
        f"https://management.azure.com{_VI_RESOURCE_ID}"
        f"/generateAccessToken?api-version=2024-01-01"
    )
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {arm_token}", "Content-Type": "application/json"},
        json={"permissionType": "Contributor", "scope": "Account"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["accessToken"]


async def analyze_video(blob_url: str, filename: str) -> dict[str, Any]:
    """Upload a video to Video Indexer and extract insights.

    Args:
        blob_url: SAS URL or public URL of the video in blob storage.
        filename: Original filename for naming the video in VI.

    Returns:
        Dict with transcript, topics, scenes, keywords.
    """
    if _LOCAL_DEV or not _VI_ACCOUNT_ID:
        return {
            "transcript": "[Local dev] Video analysis not available.",
            "topics": [],
            "scenes": [],
            "keywords": [],
            "source": "stub",
        }

    try:
        access_token = _get_vi_access_token()
        api_base = f"https://api.videoindexer.ai/{_VI_LOCATION}/Accounts/{_VI_ACCOUNT_ID}"

        # Upload video
        upload_resp = requests.post(
            f"{api_base}/Videos",
            params={
                "accessToken": access_token,
                "name": filename,
                "videoUrl": blob_url,
                "privacy": "Private",
                "language": "auto",
            },
            timeout=60,
        )
        upload_resp.raise_for_status()
        video_id = upload_resp.json()["id"]
        logger.info("video_indexer_upload video_id=%s file=%s", video_id, filename)

        # Poll for completion (max 10 minutes)
        for _ in range(60):
            idx_resp = requests.get(
                f"{api_base}/Videos/{video_id}/Index",
                params={"accessToken": access_token},
                timeout=30,
            )
            idx_resp.raise_for_status()
            state = idx_resp.json().get("state", "")
            if state == "Processed":
                break
            if state == "Failed":
                logger.error("video_indexer_failed video_id=%s", video_id)
                return {"transcript": "", "topics": [], "scenes": [], "keywords": [], "source": "failed"}
            time.sleep(10)

        index_data = idx_resp.json()
        insights = index_data.get("videos", [{}])[0].get("insights", {})

        # Extract transcript
        transcript_parts = []
        for block in insights.get("transcript", []):
            transcript_parts.append(block.get("text", ""))
        transcript = " ".join(transcript_parts)

        # Extract topics
        topics = [t.get("name", "") for t in insights.get("topics", [])]

        # Extract scenes
        scenes = []
        for scene in insights.get("scenes", []):
            scenes.append({
                "start": scene.get("start", ""),
                "end": scene.get("end", ""),
            })

        # Extract keywords
        keywords = [k.get("name", "") for k in insights.get("keywords", [])]

        logger.info(
            "video_indexer_complete video_id=%s transcript_chars=%d topics=%d",
            video_id, len(transcript), len(topics),
        )
        return {
            "transcript": transcript,
            "topics": topics,
            "scenes": scenes,
            "keywords": keywords,
            "source": "video_indexer",
        }

    except Exception:
        logger.exception("Video Indexer analysis failed for %s", filename)
        return {"transcript": "", "topics": [], "scenes": [], "keywords": [], "source": "error"}
