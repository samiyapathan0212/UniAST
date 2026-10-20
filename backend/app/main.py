from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlmodel import Session, desc, select

from .database import create_database_engine, get_session
from .middleware import MaxRequestBodySizeMiddleware
from .models import (
    CalibrationRecord,
    ImageAnalysisRecord,
    KineticAnalysisRecord,
    ResearchSession,
)
from .schemas import (
    CalibrationCreate,
    CalibrationRead,
    ImageAnalysisCreate,
    ImageAnalysisRead,
    KineticAnalysisCreate,
    KineticAnalysisRead,
    RecordSummary,
    RecordSummaryList,
    SessionCreate,
    SessionList,
    SessionRead,
)


def create_app(database_url: str | None = None) -> CORSMiddleware:
    engine = create_database_engine(database_url)

    application = FastAPI(
        title="UniAST Research Session API",
        version="0.1.0",
        description="Local persistence for research-session metadata and analysis records. Original files are never uploaded.",
    )
    application.state.engine = engine
    application.add_middleware(MaxRequestBodySizeMiddleware)

    @application.post(
        "/api/v1/sessions",
        response_model=SessionRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_session(
        payload: SessionCreate,
        session: Session = Depends(get_session),
    ) -> ResearchSession:
        record = ResearchSession(
            name=payload.name,
            device=payload.device,
            notes=payload.notes,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record

    @application.get("/api/v1/sessions", response_model=SessionList)
    def list_sessions(
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100_000),
        session: Session = Depends(get_session),
    ) -> SessionList:
        total = session.exec(select(func.count()).select_from(ResearchSession)).one()
        statement = (
            select(ResearchSession)
            .order_by(desc(ResearchSession.created_at), desc(ResearchSession.id))
            .offset(offset)
            .limit(limit)
        )
        records = session.exec(statement).all()
        return SessionList(items=records, limit=limit, offset=offset, total=total)

    @application.get(
        "/api/v1/sessions/{session_id}",
        response_model=SessionRead,
    )
    def get_saved_session(
        session_id: UUID,
        session: Session = Depends(get_session),
    ) -> ResearchSession:
        record = session.get(ResearchSession, session_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Research session not found.",
            )
        return record

    def require_session(session_id: UUID, session: Session) -> ResearchSession:
        record = session.get(ResearchSession, session_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Research session not found.")
        return record

    @application.post(
        "/api/v1/sessions/{session_id}/image-analyses",
        response_model=ImageAnalysisRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_image_analysis(
        session_id: UUID,
        payload: ImageAnalysisCreate,
        session: Session = Depends(get_session),
    ) -> ImageAnalysisRecord:
        require_session(session_id, session)
        record = ImageAnalysisRecord(
            session_id=session_id,
            source_metadata=payload.source_metadata.model_dump(),
            roi=payload.roi.model_dump(),
            statistics=payload.statistics.model_dump(),
            method_version=payload.method_version,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record

    @application.get(
        "/api/v1/sessions/{session_id}/image-analyses",
        response_model=RecordSummaryList,
    )
    def list_image_analyses(
        session_id: UUID,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100_000),
        session: Session = Depends(get_session),
    ) -> RecordSummaryList:
        require_session(session_id, session)
        total = session.exec(
            select(func.count()).select_from(ImageAnalysisRecord).where(ImageAnalysisRecord.session_id == session_id)
        ).one()
        records = session.exec(
            select(ImageAnalysisRecord)
            .where(ImageAnalysisRecord.session_id == session_id)
            .order_by(desc(ImageAnalysisRecord.created_at), desc(ImageAnalysisRecord.id))
            .offset(offset)
            .limit(limit)
        ).all()
        return RecordSummaryList(
            items=[RecordSummary(id=row.id, created_at=row.created_at, method_version=row.method_version) for row in records],
            limit=limit,
            offset=offset,
            total=total,
        )

    @application.get(
        "/api/v1/sessions/{session_id}/image-analyses/{record_id}",
        response_model=ImageAnalysisRead,
    )
    def get_image_analysis(
        session_id: UUID,
        record_id: UUID,
        session: Session = Depends(get_session),
    ) -> ImageAnalysisRecord:
        require_session(session_id, session)
        record = session.get(ImageAnalysisRecord, record_id)
        if record is None or record.session_id != session_id:
            raise HTTPException(status_code=404, detail="Image analysis record not found.")
        return record

    @application.post(
        "/api/v1/sessions/{session_id}/calibrations",
        response_model=CalibrationRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_calibration(
        session_id: UUID,
        payload: CalibrationCreate,
        session: Session = Depends(get_session),
    ) -> CalibrationRecord:
        require_session(session_id, session)
        record = CalibrationRecord(
            session_id=session_id,
            source_metadata=payload.source_metadata.model_dump(),
            patches=[patch.model_dump() for patch in payload.patches],
            model=payload.model.model_dump(),
            fit_error_summary=payload.fit_error_summary.model_dump() if payload.fit_error_summary else None,
            validation_error_summary=payload.validation_error_summary.model_dump() if payload.validation_error_summary else None,
            method_version=payload.method_version,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record

    @application.get(
        "/api/v1/sessions/{session_id}/calibrations",
        response_model=RecordSummaryList,
    )
    def list_calibrations(
        session_id: UUID,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100_000),
        session: Session = Depends(get_session),
    ) -> RecordSummaryList:
        require_session(session_id, session)
        total = session.exec(
            select(func.count()).select_from(CalibrationRecord).where(CalibrationRecord.session_id == session_id)
        ).one()
        records = session.exec(
            select(CalibrationRecord)
            .where(CalibrationRecord.session_id == session_id)
            .order_by(desc(CalibrationRecord.created_at), desc(CalibrationRecord.id))
            .offset(offset)
            .limit(limit)
        ).all()
        return RecordSummaryList(
            items=[RecordSummary(id=row.id, created_at=row.created_at, method_version=row.method_version) for row in records],
            limit=limit,
            offset=offset,
            total=total,
        )

    @application.get(
        "/api/v1/sessions/{session_id}/calibrations/{record_id}",
        response_model=CalibrationRead,
    )
    def get_calibration(
        session_id: UUID,
        record_id: UUID,
        session: Session = Depends(get_session),
    ) -> CalibrationRecord:
        require_session(session_id, session)
        record = session.get(CalibrationRecord, record_id)
        if record is None or record.session_id != session_id:
            raise HTTPException(status_code=404, detail="Calibration record not found.")
        return record

    @application.post(
        "/api/v1/sessions/{session_id}/kinetic-analyses",
        response_model=KineticAnalysisRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_kinetic_analysis(
        session_id: UUID,
        payload: KineticAnalysisCreate,
        session: Session = Depends(get_session),
    ) -> KineticAnalysisRecord:
        require_session(session_id, session)
        record = KineticAnalysisRecord(
            session_id=session_id,
            source_type=payload.source_type,
            calibration_choice=payload.calibration_choice,
            observations=[row.model_dump() for row in payload.observations],
            baseline_luminance=payload.baseline_luminance,
            issues=[issue.model_dump() for issue in payload.issues],
            warnings=payload.warnings,
            method_version=payload.method_version,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record

    @application.get(
        "/api/v1/sessions/{session_id}/kinetic-analyses",
        response_model=RecordSummaryList,
    )
    def list_kinetic_analyses(
        session_id: UUID,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=100_000),
        session: Session = Depends(get_session),
    ) -> RecordSummaryList:
        require_session(session_id, session)
        total = session.exec(
            select(func.count()).select_from(KineticAnalysisRecord).where(KineticAnalysisRecord.session_id == session_id)
        ).one()
        records = session.exec(
            select(KineticAnalysisRecord)
            .where(KineticAnalysisRecord.session_id == session_id)
            .order_by(desc(KineticAnalysisRecord.created_at), desc(KineticAnalysisRecord.id))
            .offset(offset)
            .limit(limit)
        ).all()
        return RecordSummaryList(
            items=[RecordSummary(id=row.id, created_at=row.created_at, method_version=row.method_version) for row in records],
            limit=limit,
            offset=offset,
            total=total,
        )

    @application.get(
        "/api/v1/sessions/{session_id}/kinetic-analyses/{record_id}",
        response_model=KineticAnalysisRead,
    )
    def get_kinetic_analysis(
        session_id: UUID,
        record_id: UUID,
        session: Session = Depends(get_session),
    ) -> KineticAnalysisRecord:
        require_session(session_id, session)
        record = session.get(KineticAnalysisRecord, record_id)
        if record is None or record.session_id != session_id:
            raise HTTPException(status_code=404, detail="Kinetic analysis record not found.")
        return record

    # Wrap the complete FastAPI app so CORS headers are also applied to
    # framework-generated error responses (including unhandled 500s).
    cors_application = CORSMiddleware(
        app=application,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://uni-ast-five.vercel.app",
        ],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Authorization", "Content-Type"],
    )
    # Preserve the existing create_app(...).state.engine access used by tests
    # and local lifecycle code while exposing the outer CORS ASGI application.
    cors_application.state = application.state
    return cors_application


app = create_app()
