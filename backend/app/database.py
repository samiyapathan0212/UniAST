from pathlib import Path

from fastapi import Request
from sqlalchemy import event
from sqlmodel import Session, create_engine
from sqlalchemy.engine import Engine


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_PATH = BACKEND_DIR / "data" / "uniast.sqlite3"
DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"


def create_database_engine(database_url: str | None = None) -> Engine:
    url = database_url or DEFAULT_DATABASE_URL
    if url.startswith("sqlite:///") and ":memory:" not in url:
        sqlite_path = Path(url.removeprefix("sqlite:///"))
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
    )
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def enable_sqlite_foreign_keys(connection, _record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return engine


def get_session(request: Request):
    with Session(request.app.state.engine) as session:
        yield session
