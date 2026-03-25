import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import ChatRequest, ChatResponse
from app.foundry_client import FoundryChatService

app = FastAPI(title="Cognitive Load Assistant API")


allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_service = FoundryChatService()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        reply, conversation_id = chat_service.send_message(
            message=request.message,
            reading_level=request.preferences.readingLevel,
            response_format=request.preferences.responseFormat,
            max_steps=request.preferences.maxSteps,
            calm_tone=request.preferences.calmTone,
            show_only_next_step=request.preferences.showOnlyNextStep,
            conversation_id=request.conversationId,
        )

        return ChatResponse(reply=reply, conversationId=conversation_id)

    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex)) from ex