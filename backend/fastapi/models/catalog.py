"""Request and response models for POST /catalog."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Bounds shared with Express's validation (REQ-AI-002 to REQ-AI-004, REQ-AI-017, and the card
# edit limits).
MAX_TITLE_CHARS = 200
MAX_SUMMARY_CHARS = 2_000
MAX_SUBJECTS = 5
MAX_KEYWORDS = 15
MAX_LABEL_CHARS = 100
MAX_EXISTING_SUBJECTS = 50
MAX_FACTS = 8
MAX_FACT_LABEL_CHARS = 60
MAX_FACT_VALUE_CHARS = 200
MAX_RELATED = 8
MAX_RELATION_CHARS = 60

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


class Fact(BaseModel):
    """One factual attribute stated in the source, e.g. {"label": "Author", "value": "Jane Doe"}.
    Labels are free text, so the same shape fits any subject domain."""

    label: str = Field(min_length=1, max_length=MAX_FACT_LABEL_CHARS)
    value: str = Field(min_length=1, max_length=MAX_FACT_VALUE_CHARS)


class RelatedConcept(BaseModel):
    """A concept the source connects to the subject, e.g. {"name": "X", "relation": "Successor"}."""

    name: str = Field(min_length=1, max_length=MAX_LABEL_CHARS)
    relation: str = Field(min_length=1, max_length=MAX_RELATION_CHARS)


class CatalogResponse(BaseModel):
    # The name of the entry's subject, e.g. "Marie Curie". None when no usable title was found;
    # the card then keeps showing its source title.
    title: str | None = Field(default=None, max_length=MAX_TITLE_CHARS)
    summary: str = Field(min_length=1, max_length=MAX_SUMMARY_CHARS)
    facts: list[Fact] = Field(default_factory=list, max_length=MAX_FACTS)
    subjects: list[Label] = Field(min_length=1, max_length=MAX_SUBJECTS)
    keywords: list[Label] = Field(min_length=1, max_length=MAX_KEYWORDS)
    related: list[RelatedConcept] = Field(default_factory=list, max_length=MAX_RELATED)
    # The model that produced the entry, so the UI can label it.
    model: str
    # True when the source text was cut to the configured input limit before cataloging.
    truncated: bool
    usage: CatalogUsage


class ModelCatalogOutput(BaseModel):
    """The raw JSON the model returns. Normalised into CatalogResponse before it leaves.
    New fields default to empty, so an answer in the older shape still parses."""

    model_config = ConfigDict(extra="ignore")

    title: str = ""
    summary: str
    # "Label | Value" / "Name | Relation" strings (the schema's format); objects are accepted too.
    facts: list[str | dict] = Field(default_factory=list)
    subjects: list[str]
    keywords: list[str]
    related: list[str | dict] = Field(default_factory=list)
