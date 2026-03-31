from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

MimeType = Literal["text/plain", "text/html", "application/mathml+xml"]


class ImmersiveReaderChunk(BaseModel):
    content: str
    mimeType: MimeType = "text/plain"
    lang: Optional[str] = "es"


class ImmersiveReaderOptions(BaseModel):
    ui_lang: str = Field(default="es", alias="uiLang")
    timeout: int = 15000
    cookie_policy_url: Optional[str] = Field(default=None, alias="cookiePolicyUrl")


class ImmersiveReaderLaunchRequest(BaseModel):
    title: str = Field(default="Simplified document")
    chunks: List[ImmersiveReaderChunk]
    ui_lang: str = Field(default="es")
    locale: str = Field(default="es-MX")


class ImmersiveReaderTokenResponse(BaseModel):
    token: str
    subdomain: str
    expires_on: Optional[str] = None


class ImmersiveReaderLaunchResponse(BaseModel):
    token: str
    subdomain: str
    content: Dict[str, Any]
    options: Dict[str, Any]