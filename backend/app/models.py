from datetime import datetime, timezone
from uuid import UUID, uuid4

from typing import Any

from sqlalchemy import JSON
from sqlmodel import Field, Relationship, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ResearchSession(SQLModel, table=True):
    """A research session and its persisted analysis metadata/results."""

    __tablename__ = "research_sessions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=120, index=True)
    device: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    updated_at: datetime = Field(default_factory=utc_now)
    image_analyses: list["ImageAnalysisRecord"] = Relationship(back_populates="session")
    calibrations: list["CalibrationRecord"] = Relationship(back_populates="session")
    kinetic_analyses: list["KineticAnalysisRecord"] = Relationship(back_populates="session")


class ImageAnalysisRecord(SQLModel, table=True):
    __tablename__ = "image_analysis_records"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="research_sessions.id", index=True)
    source_metadata: dict[str, Any] = Field(sa_type=JSON)
    roi: dict[str, Any] = Field(sa_type=JSON)
    statistics: dict[str, Any] = Field(sa_type=JSON)
    method_version: str = Field(max_length=64)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    session: ResearchSession = Relationship(back_populates="image_analyses")


class CalibrationRecord(SQLModel, table=True):
    __tablename__ = "calibration_records"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="research_sessions.id", index=True)
    source_metadata: dict[str, Any] = Field(sa_type=JSON)
    patches: list[dict[str, Any]] = Field(sa_type=JSON)
    model: dict[str, Any] = Field(sa_type=JSON)
    fit_error_summary: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    validation_error_summary: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    method_version: str = Field(max_length=64)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    session: ResearchSession = Relationship(back_populates="calibrations")


class KineticAnalysisRecord(SQLModel, table=True):
    __tablename__ = "kinetic_analysis_records"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="research_sessions.id", index=True)
    source_type: str = Field(max_length=16)
    calibration_choice: str = Field(max_length=16)
    observations: list[dict[str, Any]] = Field(sa_type=JSON)
    baseline_luminance: float | None = Field(default=None, ge=0, le=255)
    issues: list[dict[str, Any]] = Field(sa_type=JSON)
    warnings: list[str] = Field(sa_type=JSON)
    method_version: str = Field(max_length=64)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    session: ResearchSession = Relationship(back_populates="kinetic_analyses")
