from fastapi import APIRouter, HTTPException, Query

from app.models.accessibility_models import AccessibilityPresetName
from app.models.simplify_models import SimplifyRequest, SimplifyResponse
from app.services.simplifier_service import SimplifierService

router = APIRouter()
simplifier_service = SimplifierService()


@router.post("", response_model=SimplifyResponse)
def simplify_document(
    payload: SimplifyRequest,
    accessibility_preset: AccessibilityPresetName = Query(default="default"),
):
    try:
        return simplifier_service.simplify(
            payload=payload,
            accessibility_preset=accessibility_preset,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc