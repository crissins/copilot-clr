from fastapi import APIRouter, HTTPException

from app.models.immersive_reader_models import (
    ImmersiveReaderLaunchRequest,
    ImmersiveReaderLaunchResponse,
    ImmersiveReaderTokenResponse,
)
from app.services.immersive_reader_service import ImmersiveReaderService

router = APIRouter()
immersive_reader_service = ImmersiveReaderService()


@router.get("/token", response_model=ImmersiveReaderTokenResponse)
def get_immersive_reader_token():
    try:
        return immersive_reader_service.get_access_token()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/launch", response_model=ImmersiveReaderLaunchResponse)
def build_immersive_reader_launch(payload: ImmersiveReaderLaunchRequest):
    try:
        return immersive_reader_service.build_launch_payload(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc