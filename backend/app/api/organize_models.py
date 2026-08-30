from __future__ import annotations

from pydantic import BaseModel, field_validator


class MergeRequest(BaseModel):
    input_paths: list[str]

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("input_paths must not be empty")
        return value


class MergeResponse(BaseModel):
    output_path: str


class ConvertResponse(BaseModel):
    output_path: str


class MultiOutputResponse(BaseModel):
    output_paths: list[str]


class CompressRequest(BaseModel):
    input_paths: list[str]
    preset: str = "balanced"

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("compress expects exactly one input PDF")
        return value


class DuplicateRequest(BaseModel):
    input_paths: list[str]
    pages: str

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("duplicate-pages expects exactly one input PDF")
        return value


class ReverseRequest(BaseModel):
    input_paths: list[str]

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("reverse-pages expects exactly one input PDF")
        return value


class PageNumbersRequest(BaseModel):
    input_paths: list[str]
    pages: str = ""
    position: str = "bottom-right"
    size: float = 12.0
    opacity: float = 0.7
    color: str = "#b02730"
    prefix: str = ""
    suffix: str = ""
    start: int = 1

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("page-numbers expects exactly one input PDF")
        return value


class CropRequest(BaseModel):
    input_paths: list[str]
    pages: str = ""
    left: float = 0.0
    top: float = 0.0
    right: float = 0.0
    bottom: float = 0.0

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("crop-pdf expects exactly one input PDF")
        return value


class MetadataRequest(BaseModel):
    input_paths: list[str]
    title: str = ""
    author: str = ""
    subject: str = ""
    keywords: str = ""
    creator: str = ""
    producer: str = ""
    remove_all: bool = False

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("metadata expects exactly one input PDF")
        return value


class RedactionRegion(BaseModel):
    page: int
    x: float
    y: float
    width: float
    height: float


class RedactRequest(BaseModel):
    input_paths: list[str]
    regions: list[RedactionRegion]
    color: str = "#000000"

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("redact-pdf expects exactly one input PDF")
        return value

    @field_validator("regions")
    @classmethod
    def has_regions(cls, value: list[RedactionRegion]) -> list[RedactionRegion]:
        if not value:
            raise ValueError("at least one redaction region is required")
        return value


class HighlightRequest(BaseModel):
    input_paths: list[str]
    regions: list[RedactionRegion]
    color: str = "#f2cd53"
    opacity: float = 0.34

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("highlight-pdf expects exactly one input PDF")
        return value

    @field_validator("regions")
    @classmethod
    def has_regions(cls, value: list[RedactionRegion]) -> list[RedactionRegion]:
        if not value:
            raise ValueError("at least one highlight region is required")
        return value


class DrawPoint(BaseModel):
    x: float
    y: float


class DrawStroke(BaseModel):
    page: int
    points: list[DrawPoint]

    @field_validator("points")
    @classmethod
    def enough_points(cls, value: list[DrawPoint]) -> list[DrawPoint]:
        if len(value) < 2:
            raise ValueError("each stroke must have at least two points")
        return value


class DrawRequest(BaseModel):
    input_paths: list[str]
    strokes: list[DrawStroke]
    color: str = "#b02730"
    opacity: float = 0.92
    thickness: float = 3.0

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("draw-pdf expects exactly one input PDF")
        return value

    @field_validator("strokes")
    @classmethod
    def has_strokes(cls, value: list[DrawStroke]) -> list[DrawStroke]:
        if not value:
            raise ValueError("at least one drawing stroke is required")
        return value


class SearchRequest(BaseModel):
    input_paths: list[str]
    query: str

    @field_validator("input_paths")
    @classmethod
    def single_pdf(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("search-text expects exactly one input PDF")
        return value

    @field_validator("query")
    @classmethod
    def non_empty_query(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("search query must not be empty")
        return value


class OcrRequest(BaseModel):
    input_paths: list[str]
    lang: str = "eng"

    @field_validator("input_paths")
    @classmethod
    def single_pdf(cls, value: list[str]) -> list[str]:
        if len(value) != 1:
            raise ValueError("OCR expects exactly one input PDF")
        return value

    @field_validator("lang")
    @classmethod
    def non_empty_lang(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("OCR language must not be empty")
        return value


class SignatureField(BaseModel):
    name: str
    signed: bool
    issues: list[str]
    filter: str
    subfilter: str


class SignatureReport(BaseModel):
    status: str
    document_signed: bool
    signature_count: int
    fields: list[SignatureField]


class SearchMatch(BaseModel):
    page: int
    count: int
    snippet: str


class SearchResponse(BaseModel):
    query: str
    matches: list[SearchMatch]
    pages_with_matches: int
    total_matches: int


class OcrTextResponse(BaseModel):
    output_path: str
    text: str
    page_count: int


class OcrLanguagesResponse(BaseModel):
    languages: list[str]


class PreviewPage(BaseModel):
    page: int
    width: float
    height: float
    image: str


class PreviewResponse(BaseModel):
    pages: list[PreviewPage]


class PreviewPageResponse(BaseModel):
    page: PreviewPage


class PreviewManifestResponse(BaseModel):
    preview_id: str
    pages: list[PreviewPage]


class JobAcceptedResponse(BaseModel):
    job_id: str
