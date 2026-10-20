from datetime import datetime, timezone
import math
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import ConfigDict, StringConstraints, field_serializer, field_validator, model_validator
from sqlmodel import Field, SQLModel


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(SQLModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        allow_inf_nan=False,
        extra="forbid",
    )


class SessionCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    device: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", mode="before")
    @classmethod
    def trim_and_validate_name(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Name must contain at least one non-whitespace character.")
        return value

    @field_validator("device", "notes", mode="before")
    @classmethod
    def trim_optional_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip() or None
        return value


class SessionUpdate(ApiModel):
    """Partial metadata update; null device/notes values clear those fields."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    device: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", mode="before")
    @classmethod
    def trim_and_validate_update_name(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Name cannot be null.")
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Name must contain at least one non-whitespace character.")
        return value

    @field_validator("device", "notes", mode="before")
    @classmethod
    def trim_update_optional_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one session field to update.")
        return self


class SessionRead(ApiModel):
    id: UUID
    name: str
    device: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


class SessionList(ApiModel):
    items: list[SessionRead]
    limit: int
    offset: int
    total: int


class SourceMetadata(ApiModel):
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = Field(default=None, max_length=100)
    file_size: int = Field(gt=0, le=1_073_741_824)
    width: int = Field(gt=0, le=100_000)
    height: int = Field(gt=0, le=100_000)


class RoiValue(ApiModel):
    x: float = Field(ge=0, le=100_000)
    y: float = Field(ge=0, le=100_000)
    width: float = Field(gt=0, le=100_000)
    height: float = Field(gt=0, le=100_000)


def sample_area(roi: RoiValue, source: SourceMetadata) -> int:
    """Mirror the frontend's floor-origin/ceil-size ROI pixel boundaries."""
    left = math.floor(roi.x)
    top = math.floor(roi.y)
    right = left + math.ceil(roi.width)
    bottom = top + math.ceil(roi.height)
    return max(0, min(source.width, right) - left) * max(
        0, min(source.height, bottom) - top
    )


class RgbValue(ApiModel):
    r: float = Field(ge=0, le=255)
    g: float = Field(ge=0, le=255)
    b: float = Field(ge=0, le=255)


class ImageStatistics(ApiModel):
    samples: int = Field(gt=0, le=400_001)
    resampled: bool
    mean_r: float = Field(ge=0, le=255)
    mean_g: float = Field(ge=0, le=255)
    mean_b: float = Field(ge=0, le=255)
    mean_luminance: float = Field(ge=0, le=255)
    luminance_std_dev: float = Field(ge=0, le=255)
    min_luminance: float = Field(ge=0, le=255)
    max_luminance: float = Field(ge=0, le=255)

    @field_validator("max_luminance")
    @classmethod
    def max_not_below_min(cls, value: float, info):
        minimum = info.data.get("min_luminance")
        if minimum is not None and value < minimum:
            raise ValueError("max_luminance must be greater than or equal to min_luminance.")
        return value

    @model_validator(mode="after")
    def luminance_matches_rgb_and_bounds(self):
        expected = 0.2126 * self.mean_r + 0.7152 * self.mean_g + 0.0722 * self.mean_b
        if abs(self.mean_luminance - expected) > 0.15:
            raise ValueError("mean_luminance must agree with the Rec.709 calculation from mean RGB.")
        if not self.min_luminance <= self.mean_luminance <= self.max_luminance:
            raise ValueError("mean_luminance must lie between min_luminance and max_luminance.")
        return self


class ImageAnalysisCreate(ApiModel):
    source_metadata: SourceMetadata
    roi: RoiValue
    statistics: ImageStatistics
    method_version: str = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def roi_within_source(self):
        if self.roi.x + self.roi.width > self.source_metadata.width + 1e-6:
            raise ValueError("ROI extends beyond the source image width.")
        if self.roi.y + self.roi.height > self.source_metadata.height + 1e-6:
            raise ValueError("ROI extends beyond the source image height.")
        area = sample_area(self.roi, self.source_metadata)
        if self.statistics.samples > area:
            raise ValueError("Sample count cannot exceed the number of source pixels in the ROI.")
        if not self.statistics.resampled and self.statistics.samples != area:
            raise ValueError("An unresampled ROI must report one sample per covered source pixel.")
        if self.statistics.resampled and area <= 400_000:
            raise ValueError("A resampled flag requires an ROI larger than the sampling budget.")
        return self


class ImageAnalysisRead(ImageAnalysisCreate):
    id: UUID
    session_id: UUID
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


class CalibrationPatchValue(ApiModel):
    patch_id: str = Field(min_length=1, max_length=64)
    roi: RoiValue
    measured: ImageStatistics
    reference: RgbValue
    standard: str = Field(min_length=1, max_length=120)
    role: Literal["fit", "validation"]


class ChannelFitValue(ApiModel):
    status: Literal["ok", "too-few-points", "degenerate"]
    fit: dict[str, float] | None
    points: int = Field(ge=0, le=200)
    distinct_measured: int = Field(ge=0, le=200)
    residual_rms: float | None = Field(default=None, ge=0, le=255)
    residual_max_abs: float | None = Field(default=None, ge=0, le=255)
    message: str = Field(max_length=500)

    @field_validator("fit")
    @classmethod
    def fit_is_a_finite_affine_pair(cls, value):
        if value is not None:
            if set(value) != {"slope", "intercept"} or any(
                not isinstance(item, (int, float)) or not math.isfinite(item)
                for item in value.values()
            ):
                raise ValueError("fit must contain finite slope and intercept values.")
        return value

    @model_validator(mode="after")
    def status_matches_fit_values(self):
        if self.status == "ok":
            if self.fit is None or self.points < 2 or self.distinct_measured < 2:
                raise ValueError("An ok channel fit requires finite coefficients and at least two distinct points.")
        elif self.fit is not None:
            raise ValueError("A channel fit with a non-ok status cannot include coefficients.")
        return self


class CalibrationModelValue(ApiModel):
    r: ChannelFitValue
    g: ChannelFitValue
    b: ChannelFitValue
    available: bool
    method: str = Field(min_length=1, max_length=1000)
    fit_patch_count: int = Field(ge=0, le=200)


class ErrorSummary(ApiModel):
    count: int = Field(ge=1, le=200)
    rms: RgbValue
    max_abs: RgbValue
    mean_luminance_error: float = Field(ge=0, le=255)


class CalibrationCreate(ApiModel):
    source_metadata: SourceMetadata
    patches: list[CalibrationPatchValue] = Field(min_length=2, max_length=200)
    model: CalibrationModelValue
    fit_error_summary: ErrorSummary | None
    validation_error_summary: ErrorSummary | None
    method_version: str = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def roles_summaries_and_fit_are_separate(self):
        patch_ids = [patch.patch_id for patch in self.patches]
        if len(set(patch_ids)) != len(patch_ids):
            raise ValueError("Calibration patch IDs must be unique within a record.")
        fit_count = sum(patch.role == "fit" for patch in self.patches)
        validation_count = len(self.patches) - fit_count
        if fit_count < 2:
            raise ValueError("At least two fit patches are required.")
        if self.model.fit_patch_count != fit_count:
            raise ValueError("Model fit_patch_count must match the fit-role patch count.")
        expected_fit_summary = fit_count if self.model.available else 0
        expected_validation_summary = validation_count if self.model.available else 0
        if (self.fit_error_summary.count if self.fit_error_summary else 0) != expected_fit_summary:
            raise ValueError("Fit error summary must describe only the fit-role patches.")
        if (self.validation_error_summary.count if self.validation_error_summary else 0) != expected_validation_summary:
            raise ValueError("Validation summary must describe only held-out validation patches.")
        if self.model.available != all(
            getattr(self.model, channel).status == "ok"
            for channel in ("r", "g", "b")
        ):
            raise ValueError("Model availability must agree with the per-channel fit status.")
        if any(
            patch.roi.x + patch.roi.width > self.source_metadata.width + 1e-6
            or patch.roi.y + patch.roi.height > self.source_metadata.height + 1e-6
            for patch in self.patches
        ):
            raise ValueError("A calibration patch ROI extends beyond the source image.")
        for patch in self.patches:
            area = sample_area(patch.roi, self.source_metadata)
            if patch.measured.samples > area:
                raise ValueError("Calibration patch sample count exceeds its ROI pixel area.")
            if not patch.measured.resampled and patch.measured.samples != area:
                raise ValueError("An unresampled calibration patch must report one sample per ROI pixel.")
            if patch.measured.resampled and area <= 400_000:
                raise ValueError("A resampled calibration patch must exceed the sampling budget.")
        return self


class CalibrationRead(CalibrationCreate):
    id: UUID
    session_id: UUID
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


BoundedWarning = Annotated[str, StringConstraints(max_length=1000)]


class KineticObservationValue(ApiModel):
    time_min: float = Field(ge=0, le=10_000_000)
    source: str = Field(min_length=1, max_length=512)
    mean_r: float = Field(ge=0, le=255)
    mean_g: float = Field(ge=0, le=255)
    mean_b: float = Field(ge=0, le=255)
    mean_luminance: float = Field(ge=0, le=255)
    roi: RoiValue | None
    resampled: bool
    calibrated: bool
    warnings: list[BoundedWarning] = Field(max_length=64)
    delta_from_baseline: float = Field(ge=-255, le=255)
    rate_per_minute: float | None = None
    normalized_change: float | None = Field(default=None, ge=-1)

    @model_validator(mode="after")
    def luminance_matches_rgb(self):
        expected = 0.2126 * self.mean_r + 0.7152 * self.mean_g + 0.0722 * self.mean_b
        if abs(self.mean_luminance - expected) > 0.15:
            raise ValueError("mean_luminance must agree with the Rec.709 calculation from mean RGB.")
        return self


class SeriesIssueValue(ApiModel):
    kind: Literal["duplicate-time", "invalid-value", "missing-point", "dimension-mismatch", "unvalidated"]
    message: str = Field(min_length=1, max_length=1000)


class KineticAnalysisCreate(ApiModel):
    source_type: Literal["images", "csv"]
    calibration_choice: Literal["raw", "calibrated", "mixed"]
    observations: list[KineticObservationValue] = Field(min_length=1, max_length=5000)
    baseline_luminance: float = Field(ge=0, le=255)
    issues: list[SeriesIssueValue] = Field(max_length=5000)
    warnings: list[BoundedWarning] = Field(max_length=5000)
    method_version: str = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def baseline_and_times_are_consistent(self):
        times = [observation.time_min for observation in self.observations]
        if times != sorted(times):
            raise ValueError("Observations must be in nondecreasing elapsed-time order.")
        if abs(self.baseline_luminance - self.observations[0].mean_luminance) > 1e-9:
            raise ValueError("Baseline luminance must match the first observation.")
        calibrated = [observation.calibrated for observation in self.observations]
        if self.calibration_choice == "raw" and any(calibrated):
            raise ValueError("Raw calibration choice requires every observation to be uncalibrated.")
        if self.calibration_choice == "calibrated" and not all(calibrated):
            raise ValueError("Calibrated choice requires every observation to be calibrated.")
        if self.calibration_choice == "mixed" and (all(calibrated) or not any(calibrated)):
            raise ValueError("Mixed calibration choice requires both raw and calibrated observations.")
        if self.source_type == "images" and any(observation.roi is None for observation in self.observations):
            raise ValueError("Image-sequence observations must retain ROI coordinates.")
        for observation in self.observations:
            expected_delta = observation.mean_luminance - self.baseline_luminance
            if abs(observation.delta_from_baseline - expected_delta) > 1e-6:
                raise ValueError("Each baseline change must match its observation and baseline luminance.")
            expected_normalized = (
                None if self.baseline_luminance == 0
                else expected_delta / self.baseline_luminance
            )
            if expected_normalized is None:
                if observation.normalized_change is not None:
                    raise ValueError("Normalized changes must be unavailable when baseline luminance is zero.")
            elif observation.normalized_change is None or abs(observation.normalized_change - expected_normalized) > 1e-6:
                raise ValueError("Normalized change must agree with the baseline calculation.")
        return self


class KineticAnalysisRead(KineticAnalysisCreate):
    id: UUID
    session_id: UUID
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


class RecordSummary(ApiModel):
    id: UUID
    created_at: datetime
    method_version: str

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


class RecordSummaryList(ApiModel):
    items: list[RecordSummary]
    limit: int
    offset: int
    total: int
