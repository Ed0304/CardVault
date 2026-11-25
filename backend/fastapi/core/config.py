"""Settings for the CardVault AI service, loaded only from environment variables (REQ-AI-008).

Nothing here is a code constant for a provider model: the model identifier, base URL and
credentials all come from the environment. Missing or invalid settings stop the service at
startup, and error messages name the variable without echoing its value.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Meta Model API. The key never leaves this service: it is not logged or returned.
    model_api_key: SecretStr = Field(alias="MODEL_API_KEY", min_length=1)
    model_api_base_url: str = Field(alias="MODEL_API_BASE_URL", min_length=1)

    # Catalog generation (REQ-AI-002 to REQ-AI-004).
    catalog_model: str = Field(alias="MUSE_CATALOG_MODEL", min_length=1)
    # Cataloging is bounded extraction, not multi-step reasoning, so low effort is enough.
    # The reasoning models reject "none".
    catalog_reasoning_effort: Literal["minimal", "low", "medium", "high"] = Field(
        "low", alias="MUSE_CATALOG_REASONING_EFFORT"
    )
    # Covers reasoning plus the JSON answer.
    catalog_max_output_tokens: int = Field(4000, ge=500, le=32_000, alias="MUSE_CATALOG_MAX_OUTPUT_TOKENS")
    # Longer source text is cut before it is sent, which bounds cost and latency per card.
    catalog_max_input_chars: int = Field(40_000, ge=1_000, le=100_000, alias="CATALOG_MAX_INPUT_CHARS")

    # Per attempt. The SDK retries 429, 5xx, timeouts and connection errors with backoff.
    request_timeout_seconds: float = Field(40, ge=5, le=120, alias="MUSE_TIMEOUT_SECONDS")
    max_retries: int = Field(1, ge=0, le=3, alias="MUSE_MAX_RETRIES")

    # Shared secret that Express sends as a bearer token (decision D-5).
    ai_service_token: SecretStr = Field(alias="AI_SERVICE_TOKEN")

    @field_validator("catalog_model")
    @classmethod
    def reject_contributor_mode(cls, value: str) -> str:
        # Contributor-mode models permit training on submitted content (REQ-AI-014).
        if "contributor" in value.lower():
            raise ValueError("Contributor-mode models must not be used for user content")
        return value

    @field_validator("ai_service_token")
    @classmethod
    def require_long_token(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("must be at least 32 characters")
        return value

    @field_validator("model_api_base_url")
    @classmethod
    def require_https(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("must be an https:// URL")
        return value.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
