"""Content Routes — Upload, process, adapt, and retrieve content.

Endpoints:
  POST   /api/upload               — Upload PDF/video → Blob → process → index
  POST   /api/adapt/{id}           — Adapt content for a neurodiverse profile
  GET    /api/content/{id}         — Retrieve adapted content
  GET    /api/content              — List user's uploaded content
  GET    /api/audio/{id}/{idx}     — Get audio snippet metadata
  POST   /api/audio/{id}/generate  — Generate TTS audio for content
  POST   /api/content/process      — Full agent pipeline (adapt + tasks + audiobook)
  POST   /api/content/build-request — Build ContentRequest from chat conversation
"""

import io
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["content"])

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

# These will be injected by main.py at startup
_content_container = None
_adapted_container = None
_audio_container = None
_get_user_id = None
_check_content_safety = None

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".mp4", ".mov", ".avi", ".mkv", ".webm"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def init_routes(content_ctr, adapted_ctr, audio_ctr, get_user_fn, safety_fn):
    """Wire storage containers and auth helper into this router module."""
    global _content_container, _adapted_container, _audio_container
    global _get_user_id, _check_content_safety
    _content_container = content_ctr
    _adapted_container = adapted_ctr
    _audio_container = audio_ctr
    _get_user_id = get_user_fn
    _check_content_safety = safety_fn


@router.post("/content/upload")
async def upload_content(req: Request, file: UploadFile = File(...)) -> JSONResponse:
    """Upload a PDF or video for processing and indexing."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    if not file.filename:
        return JSONResponse({"error": "No file provided."}, status_code=400)

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return JSONResponse(
            {"error": f"Unsupported file type. Allowed: {sorted(ALLOWED_EXTENSIONS)}"},
            status_code=400,
        )

    content_bytes = await file.read()
    if len(content_bytes) > MAX_FILE_SIZE:
        return JSONResponse({"error": "File must be under 100 MB."}, status_code=400)

    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    is_video = ext in VIDEO_EXTENSIONS

    # Upload to Blob Storage
    blob_url = ""
    storage_account = os.environ.get("STORAGE_ACCOUNT_NAME", "")
    if storage_account and not _LOCAL_DEV:
        try:
            from azure.identity import DefaultAzureCredential
            from azure.storage.blob import BlobServiceClient

            blob_svc = BlobServiceClient(
                account_url=f"https://{storage_account}.blob.core.windows.net",
                credential=DefaultAzureCredential(),
            )
            container_name = "uploaded"
            ctr = blob_svc.get_container_client(container_name)
            try:
                ctr.create_container()
            except Exception:
                pass
            blob_name = f"{user_id}/{doc_id}/{file.filename}"
            ctr.upload_blob(name=blob_name, data=content_bytes, overwrite=True)
            blob_url = f"https://{storage_account}.blob.core.windows.net/{container_name}/{blob_name}"
            logger.info("blob_uploaded user=%s blob=%s size=%d", user_id, blob_name, len(content_bytes))
        except Exception:
            logger.warning("Blob upload failed — continuing with local processing")

    # Process document
    start = time.monotonic()
    try:
        if is_video:
            from services.video_processor import analyze_video
            extraction = await analyze_video(blob_url, file.filename)
            extracted_text = extraction.get("transcript", "")
        else:
            from services.document_processor import analyze_pdf
            extraction = await analyze_pdf(blob_url, content_bytes)
            extracted_text = extraction.get("text", "")
    except Exception:
        logger.exception("Document processing failed for %s", file.filename)
        extraction = {"text": "", "tables": [], "figures": [], "page_count": 0, "source": "error"}
        extracted_text = ""

    process_ms = int((time.monotonic() - start) * 1000)

    # Chunk and index in AI Search
    chunks = _chunk_text(extracted_text)
    search_endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT", "")
    if search_endpoint and not _LOCAL_DEV and extracted_text:
        try:
            from azure.identity import DefaultAzureCredential
            from azure.search.documents import SearchClient

            index_name = os.environ.get("AZURE_SEARCH_INDEX_NAME", "documents")
            search_client = SearchClient(
                endpoint=search_endpoint,
                index_name=index_name,
                credential=DefaultAzureCredential(),
            )
            documents = []
            for i, chunk in enumerate(chunks):
                documents.append({
                    "id": f"{doc_id}-{i}",
                    "content": chunk,
                    "title": file.filename,
                    "source": file.filename,
                    "documentId": doc_id,
                    "chunkIndex": i,
                    "userId": user_id,
                    "uploadedAt": now,
                })
            search_client.upload_documents(documents=documents)
            logger.info("search_indexed doc=%s chunks=%d", doc_id, len(documents))
        except Exception:
            logger.warning("AI Search indexing failed")

    # Store content metadata
    content_doc = {
        "id": doc_id,
        "userId": user_id,
        "filename": file.filename,
        "fileType": "video" if is_video else "document",
        "extension": ext,
        "sizeBytes": len(content_bytes),
        "blobUrl": blob_url,
        "extractedText": extracted_text[:5000],  # Store preview only
        "chunkCount": len(chunks),
        "extraction": {
            "source": extraction.get("source", "unknown"),
            "pageCount": extraction.get("page_count", 0),
            "tableCount": len(extraction.get("tables", [])),
            "figureCount": len(extraction.get("figures", [])),
        },
        "processingMs": process_ms,
        "status": "indexed",
        "createdAt": now,
    }
    try:
        _content_container.upsert_item(content_doc)
    except Exception:
        logger.exception("Failed to store content metadata for doc=%s", doc_id)
        return JSONResponse({"error": "Failed to save upload metadata."}, status_code=500)

    return JSONResponse({
        "contentId": doc_id,
        "filename": file.filename,
        "fileType": content_doc["fileType"],
        "chunks": len(chunks),
        "processingMs": process_ms,
        "status": "indexed",
    }, status_code=201)


@router.post("/content/{content_id}/adapt")
async def adapt_content_endpoint(content_id: str, req: Request) -> JSONResponse:
    """Adapt indexed content for a specific neurodiverse profile."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        body = {}

    profile = body.get("profile", "medium")

    # Retrieve source content
    try:
        content_doc = _content_container.read_item(item=content_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Content not found."}, status_code=404)

    source_text = content_doc.get("extractedText", "")
    if not source_text:
        return JSONResponse({"error": "No extracted text available."}, status_code=400)

    start = time.monotonic()
    from services.content_adapter import adapt_content
    result = await adapt_content(
        source_text=source_text,
        profile=profile,
        content_id=content_id,
    )
    adapt_ms = int((time.monotonic() - start) * 1000)

    # Store adapted version
    adapted_id = str(uuid.uuid4())
    adapted_doc = {
        "id": adapted_id,
        "userId": user_id,
        "sourceContentId": content_id,
        "profile": profile,
        "adaptedText": result.get("adapted_text", ""),
        "summary": result.get("summary", ""),
        "audioScripts": result.get("audio_scripts", []),
        "tasks": result.get("tasks", []),
        "sourceAnalysis": result.get("source_analysis", {}),
        "adaptationMs": adapt_ms,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _adapted_container.upsert_item(adapted_doc)

    logger.info("content_adapted id=%s profile=%s ms=%d", adapted_id, profile, adapt_ms)
    return JSONResponse({
        "adaptedContentId": adapted_id,
        "profile": profile,
        "summary": result.get("summary", ""),
        "audioChunks": len(result.get("audio_scripts", [])),
        "tasks": len(result.get("tasks", [])),
        "adaptationMs": adapt_ms,
    }, status_code=201)


@router.post("/content/{content_id}/analyze-video")
async def analyze_video_endpoint(content_id: str, req: Request) -> JSONResponse:
    """Run Video Indexer analysis on an uploaded video."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        content_doc = _content_container.read_item(item=content_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Content not found."}, status_code=404)

    if content_doc.get("fileType") != "video":
        return JSONResponse({"error": "Content is not a video."}, status_code=400)

    blob_url = content_doc.get("blobUrl", "")
    if not blob_url:
        return JSONResponse({"error": "No blob URL for this video."}, status_code=400)

    try:
        from services.video_processor import analyze_video
        result = await analyze_video(blob_url, content_doc.get("filename", "video"))
    except Exception:
        logger.exception("Video analysis failed for content_id=%s", content_id)
        return JSONResponse({"error": "Video analysis failed."}, status_code=500)

    return JSONResponse(result)


@router.get("/content")
def list_content(req: Request) -> JSONResponse:
    """List all uploaded content for the authenticated user."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    items = list(_content_container.query_items(
        query="SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC",
        parameters=[{"name": "@userId", "value": user_id}],
        enable_cross_partition_query=False,
    ))
    return JSONResponse({"content": [
        {
            "id": item["id"],
            "filename": item.get("filename", ""),
            "fileType": item.get("fileType", ""),
            "status": item.get("status", ""),
            "chunkCount": item.get("chunkCount", 0),
            "createdAt": item.get("createdAt", ""),
        }
        for item in items
    ]})


@router.get("/content/{content_id}")
def get_content(content_id: str, req: Request) -> JSONResponse:
    """Get content details and its adapted versions."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        content_doc = _content_container.read_item(item=content_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Content not found."}, status_code=404)

    # Get adapted versions
    adapted_items = list(_adapted_container.query_items(
        query="SELECT * FROM c WHERE c.sourceContentId = @cid AND c.userId = @userId",
        parameters=[
            {"name": "@cid", "value": content_id},
            {"name": "@userId", "value": user_id},
        ],
        enable_cross_partition_query=False,
    ))

    return JSONResponse({
        "content": {k: v for k, v in content_doc.items() if not k.startswith("_")},
        "adaptations": [
            {
                "id": a["id"],
                "profile": a.get("profile", ""),
                "summary": a.get("summary", ""),
                "adaptedText": a.get("adaptedText", ""),
                "audioScripts": a.get("audioScripts", []),
                "tasks": a.get("tasks", []),
                "createdAt": a.get("createdAt", ""),
            }
            for a in adapted_items
        ],
    })


@router.get("/content/{content_id}/adapted/{adapted_id}")
def get_adapted_content(content_id: str, adapted_id: str, req: Request) -> JSONResponse:
    """Get a specific adapted version with full text and audio scripts."""
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        adapted_doc = _adapted_container.read_item(item=adapted_id, partition_key=user_id)
    except Exception:
        return JSONResponse({"error": "Adapted content not found."}, status_code=404)

    return JSONResponse({k: v for k, v in adapted_doc.items() if not k.startswith("_")})


def _chunk_text(text: str, max_chunk_size: int = 1000) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks, current = [], ""
    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chunk_size and current:
            chunks.append(current.strip())
            current = para
        else:
            current = current + "\n\n" + para if current else para
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text[:max_chunk_size]]


# ════════════════════════════════════════════════════════════════════
# Content Processing Pipeline (Agent Framework workflow)
# ════════════════════════════════════════════════════════════════════


@router.post("/content/process")
async def process_content(req: Request) -> JSONResponse:
    """Run the full content processing pipeline.

    Accepts JSON body with ContentRequest fields,
    or multipart form with a file + optional JSON fields.

    Returns PipelineOutput with adapted content, task plan, and audiobook.
    """
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    from models import ContentRequest as ContentRequestModel

    content_type = req.headers.get("content-type", "")

    # Parse request - JSON body or form data
    if "multipart/form-data" in content_type:
        # File upload + optional metadata
        form = await req.form()
        file = form.get("file")
        if not file:
            return JSONResponse({"error": "No file provided."}, status_code=400)

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return JSONResponse(
                {"error": f"Unsupported file type. Allowed: {sorted(ALLOWED_EXTENSIONS)}"},
                status_code=400,
            )
        content_bytes = await file.read()
        if len(content_bytes) > MAX_FILE_SIZE:
            return JSONResponse({"error": "File must be under 100 MB."}, status_code=400)

        # Extract text from PDF
        source_text = ""
        if ext == ".pdf":
            source_text = _extract_pdf_text(content_bytes)
        elif ext == ".docx":
            source_text = _extract_docx_text(content_bytes)

        if not source_text.strip():
            return JSONResponse(
                {"error": "Could not extract text from the uploaded file."},
                status_code=400,
            )

        # Build request from form fields + extracted text
        metadata_json = form.get("metadata", "{}")
        try:
            metadata = json.loads(metadata_json) if isinstance(metadata_json, str) else {}
        except json.JSONDecodeError:
            metadata = {}

        request = ContentRequestModel(
            topic=metadata.get("topic", file.filename or "Uploaded Document"),
            source_text=source_text,
            source_filename=file.filename or "",
            desired_outputs=metadata.get("desired_outputs", ["all"]),
            target_reading_level=metadata.get("target_reading_level", "Grade 5"),
            target_format=metadata.get("target_format", "bullet points"),
            language=metadata.get("language", "en"),
            neurodiverse_profile=metadata.get("neurodiverse_profile", "medium"),
            additional_instructions=metadata.get("additional_instructions", ""),
            enrich_with_web_search=metadata.get("enrich_with_web_search", False),
            web_search_queries=metadata.get("web_search_queries", []),
        )

    else:
        # JSON body
        try:
            body = await req.json()
        except Exception:
            return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

        request = ContentRequestModel(**body)

    if not request.source_text.strip() and not request.topic.strip():
        return JSONResponse(
            {"error": "Provide source_text or a topic."},
            status_code=400,
        )

    # Content safety check
    if _check_content_safety and request.source_text:
        safety_result = _check_content_safety(request.source_text[:5000])
        if safety_result and safety_result.get("blocked"):
            return JSONResponse(
                {"error": "Content flagged by safety policy.", "details": safety_result},
                status_code=422,
            )

    # Run the pipeline
    from agents.content_workflow import run_content_pipeline

    output = await run_content_pipeline(request=request, user_id=user_id)

    return JSONResponse(output.model_dump(), status_code=200)


@router.post("/content/build-request")
async def build_request_from_chat(req: Request) -> JSONResponse:
    """Build a ContentRequest from a chat conversation.

    Body: { "messages": [{"role": "user", "content": "..."}, ...] }

    Returns the structured ContentRequest for the frontend to review/edit.
    """
    from auth.entra import AuthError
    try:
        user_id = _get_user_id(req.headers.get("Authorization"))
    except AuthError as e:
        return JSONResponse({"error": str(e)}, status_code=401)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

    chat_messages = body.get("messages", [])
    if not chat_messages:
        return JSONResponse({"error": "No messages provided."}, status_code=400)

    from agents.content_workflow import build_request_from_chat as build_req

    request = await build_req(chat_messages=chat_messages, user_id=user_id)

    return JSONResponse(request.model_dump(), status_code=200)


# ── Text extraction helpers ──────────────────────────────────────────


def _extract_pdf_text(content_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        import io
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(content_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)
    except Exception:
        logger.exception("PDF text extraction failed")
        return ""


def _extract_docx_text(content_bytes: bytes) -> str:
    """Extract text from a DOCX file (basic zip/xml parse)."""
    try:
        import io
        import zipfile
        import xml.etree.ElementTree as ET

        with zipfile.ZipFile(io.BytesIO(content_bytes)) as zf:
            with zf.open("word/document.xml") as f:
                tree = ET.parse(f)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = []
        for p in tree.iter(f"{{{ns['w']}}}p"):
            texts = [t.text for t in p.iter(f"{{{ns['w']}}}t") if t.text]
            if texts:
                paragraphs.append("".join(texts))
        return "\n\n".join(paragraphs)
    except Exception:
        logger.exception("DOCX text extraction failed")
        return ""
