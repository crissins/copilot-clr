from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.accessibility import router as accessibility_router
from app.api.immersive_reader import router as immersive_reader_router
from app.api.simplify import router as simplify_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Cognitive Load Reduction Assistant API",
    version="1.0.0",
    description="Backend para simplificación de documentos e integración con Azure Immersive Reader.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simplify_router, prefix="/api/simplify", tags=["Simplify"])
app.include_router(immersive_reader_router, prefix="/api/immersive-reader", tags=["Immersive Reader"])
app.include_router(accessibility_router, prefix="/api/accessibility", tags=["Accessibility"])

@app.get("/")
def root():
    return {
        "message": "Cognitive Load Reduction Assistant API",
        "docs": "/docs",
        "health": "/health",
        "environment": settings.environment,
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "backend",
        "environment": settings.environment,
    }