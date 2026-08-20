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
