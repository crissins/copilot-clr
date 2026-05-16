from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = Field(default="development", alias="ENVIRONMENT")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    cors_allowed_origins: str = Field(
        default="http://localhost:5173",
        alias="CORS_ALLOWED_ORIGINS",
    )

    azure_ai_project_endpoint: str = Field(
        default="",
        alias="AZURE_AI_PROJECT_ENDPOINT",
    )
    azure_ai_model_deployment_name: str = Field(
        default="",
        alias="AZURE_AI_MODEL_DEPLOYMENT_NAME",
    )
    foundry_agent_name: str = Field(
        default="",
        alias="FOUNDRY_AGENT_NAME",
    )

    immersive_reader_subdomain: str = Field(
        default="",
        alias="IMMERSIVE_READER_SUBDOMAIN",
    )
    immersive_reader_tenant_id: str = Field(
        default="",
        alias="IMMERSIVE_READER_TENANT_ID",
    )
    immersive_reader_client_id: str = Field(
        default="",
        alias="IMMERSIVE_READER_CLIENT_ID",
    )
    immersive_reader_client_secret: str = Field(
        default="",
        alias="IMMERSIVE_READER_CLIENT_SECRET",
    )

    simplify_max_chars: int = Field(default=12000, alias="SIMPLIFY_MAX_CHARS")
    default_reading_level: str = Field(default="simple", alias="DEFAULT_READING_LEVEL")
    default_language: str = Field(default="es", alias="DEFAULT_LANGUAGE")

    @property
    def cors_allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()