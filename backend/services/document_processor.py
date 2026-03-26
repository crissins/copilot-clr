"""Document Processing — Azure Document Intelligence + Computer Vision.

Extracts text, tables, and figures from PDFs/images.
Uses Document Intelligence prebuilt-layout for structured extraction
and Computer Vision for image/diagram analysis.
"""

import io
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_LOCAL_DEV = os.environ.get("LOCAL_DEV", "").lower() in ("1", "true", "yes")

_credential = None


def _get_credential():
    """Return a cached DefaultAzureCredential singleton."""
    global _credential
    if _credential is None:
        from azure.identity import DefaultAzureCredential
        _credential = DefaultAzureCredential()
    return _credential


async def analyze_pdf(blob_url: str, file_bytes: bytes | None = None) -> dict[str, Any]:
    """Extract text, tables, figures from a PDF via Document Intelligence.

    Args:
        blob_url: Blob storage URL of the uploaded PDF.
        file_bytes: Raw file bytes (fallback for local dev).

    Returns:
        Dict with text, tables, figures, page_count, source.
    """
    endpoint = os.environ.get("DOC_INTELLIGENCE_ENDPOINT", "")
    if _LOCAL_DEV or not endpoint:
        return _local_pdf_stub(file_bytes)

    try:
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

        client = DocumentIntelligenceClient(
            endpoint=endpoint, credential=_get_credential()
        )
        poller = client.begin_analyze_document(
            "prebuilt-layout",
            AnalyzeDocumentRequest(url_source=blob_url),
        )
        result = poller.result()

        pages_text = []
        for page in result.pages:
            lines = [ln.content for ln in (page.lines or [])]
            pages_text.append("\n".join(lines))

        tables = []
        for tbl in (result.tables or []):
            tables.append({
                "row_count": tbl.row_count,
                "column_count": tbl.column_count,
                "cells": [
                    {"row": c.row_index, "col": c.column_index, "content": c.content}
                    for c in tbl.cells
                ],
            })

        figures = []
        for fig in getattr(result, "figures", None) or []:
            cap = getattr(fig, "caption", None)
            figures.append({
                "caption": cap.content if cap else "",
                "regions": len(fig.bounding_regions) if fig.bounding_regions else 0,
            })

        full_text = "\n\n".join(pages_text)
        logger.info(
            "doc_intelligence_complete pages=%d tables=%d figures=%d chars=%d",
            len(result.pages), len(tables), len(figures), len(full_text),
        )
        return {
            "text": full_text,
            "tables": tables,
            "figures": figures,
            "page_count": len(result.pages),
            "source": "document_intelligence",
        }

    except Exception:
        logger.exception("Document Intelligence analysis failed")
        return _local_pdf_stub(file_bytes)


async def analyze_image(image_bytes: bytes, filename: str = "") -> dict[str, Any]:
    """Analyze an image/diagram using Azure Computer Vision.

    Args:
        image_bytes: Raw image file bytes.
        filename: Original filename for logging.

    Returns:
        Dict with captions, dense_captions, ocr_text, source.
    """
    endpoint = os.environ.get("COMPUTER_VISION_ENDPOINT", "")
    if _LOCAL_DEV or not endpoint:
        return {"captions": [], "dense_captions": [], "ocr_text": "", "source": "stub"}

    try:
        from azure.ai.vision.imageanalysis import ImageAnalysisClient
        from azure.ai.vision.imageanalysis.models import VisualFeatures

        client = ImageAnalysisClient(endpoint=endpoint, credential=_get_credential())
        result = client.analyze(
            image_data=image_bytes,
            visual_features=[VisualFeatures.CAPTION, VisualFeatures.DENSE_CAPTIONS, VisualFeatures.READ],
        )

        captions = [result.caption.text] if result.caption else []
        dense = [
            {"text": dc.text, "confidence": dc.confidence}
            for dc in (result.dense_captions.list if result.dense_captions else [])
        ]
        ocr_lines = []
        if result.read and result.read.blocks:
            for block in result.read.blocks:
                for line in block.lines:
                    ocr_lines.append(line.text)

        logger.info("computer_vision_complete file=%s captions=%d", filename, len(captions))
        return {"captions": captions, "dense_captions": dense, "ocr_text": "\n".join(ocr_lines), "source": "computer_vision"}

    except Exception:
        logger.exception("Computer Vision analysis failed for %s", filename)
        return {"captions": [], "dense_captions": [], "ocr_text": "", "source": "error"}


def _local_pdf_stub(file_bytes: bytes | None) -> dict[str, Any]:
    """Fallback PDF extraction using PyPDF2 for local dev."""
    text, page_count = "", 0
    if file_bytes:
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = [p.extract_text() or "" for p in reader.pages]
            text = "\n\n".join(p for p in pages if p)
            page_count = len(reader.pages)
        except Exception:
            logger.warning("PyPDF2 fallback extraction failed")
    return {"text": text, "tables": [], "figures": [], "page_count": page_count, "source": "pypdf2_fallback"}
