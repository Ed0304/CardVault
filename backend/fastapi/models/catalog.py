"""Request and response models for POST /catalog."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Bounds shared with Express's validation (REQ-AI-002 to REQ-AI-004, and the card edit limits).
MAX_SUMMARY_CHARS = 2_000
MAX_SUBJECTS = 5
MAX_KEYWORDS = 15
MAX_LABEL_CHARS = 100
MAX_EXISTING_SUBJECTS = 50

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_LABEL_CHARS)]


class CatalogRequest(BaseModel):
    """What Express sends: only the card's title and source text, plus the owner's existing
    subject headings so new headings stay consistent with the library. Never personal notes,
    collections, tags or account details."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=300)
    text: str = Field(min_length=1, max_length=100_000)
    existing_subjects: list[Label] = Field(default_factory=list, max_length=MAX_EXISTING_SUBJECTS)


class CatalogUsage(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None


class CatalogResponse(BaseModel):
    summary: str = Field(min_length=1, max_length=MAX_SUMMARY_CHARS)
    subjects: list[Label] = Field(min_length=1, max_length=MAX_SUBJECTS)
    keywords: list[Label] = Field(min_length=1, max_length=MAX_KEYWORDS)
    # The model that produced the entry, so the UI can label it.
    model: str
    # True when the source text was cut to the configured input limit before cataloging.
    truncated: bool
    usage: CatalogUsage


class ModelCatalogOutput(BaseModel):
    """The raw JSON the model returns. Normalised into CatalogResponse before it leaves."""

    model_config = ConfigDict(extra="ignore")

    summary: str
    subjects: list[str]
    keywords: list[str]
