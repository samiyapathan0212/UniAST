import shutil
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlmodel import Session, SQLModel

from backend.app.database import create_database_engine
from backend.app.models import ResearchSession


BACKEND_DIR = Path(__file__).resolve().parents[1]
REVISION = "ea1e553a094a"
EXPECTED_TABLES = {
    "research_sessions",
    "image_analysis_records",
    "calibration_records",
    "kinetic_analysis_records",
}


def alembic_config(database_path: Path) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    database_url = f"sqlite:///{database_path.as_posix()}"
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def assert_schema(database_path: Path) -> None:
    engine = create_database_engine(f"sqlite:///{database_path.as_posix()}")
    try:
        inspector = inspect(engine)
        assert set(inspector.get_table_names()) - {"alembic_version"} == EXPECTED_TABLES
        for table in EXPECTED_TABLES - {"research_sessions"}:
            assert inspector.get_foreign_keys(table)[0]["referred_table"] == "research_sessions"
            assert f"ix_{table}_session_id" in {index['name'] for index in inspector.get_indexes(table)}
            assert f"ix_{table}_created_at" in {index['name'] for index in inspector.get_indexes(table)}
        with engine.connect() as connection:
            assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
    finally:
        engine.dispose()


def test_alembic_upgrade_builds_fresh_database(tmp_path):
    database_path = tmp_path / "fresh.sqlite3"
    config = alembic_config(database_path)
    command.upgrade(config, "head")
    command.check(config)

    assert_schema(database_path)
    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == REVISION
    finally:
        engine.dispose()


def test_existing_unversioned_schema_can_be_stamped_and_upgraded_on_a_copy(tmp_path):
    # Model the prior application: tables were initialized with SQLModel.create_all
    # and contain data, but have no Alembic version marker.
    original_path = tmp_path / "legacy.sqlite3"
    original_engine = create_engine(f"sqlite:///{original_path.as_posix()}")
    SQLModel.metadata.create_all(original_engine)
    with Session(original_engine) as session:
        session.add(ResearchSession(name="Preserved baseline data"))
        session.commit()
    original_engine.dispose()

    # Baseline procedure is tested only on a copy; never touch the user's DB.
    copied_path = tmp_path / "legacy-copy.sqlite3"
    shutil.copy2(original_path, copied_path)
    assert_schema(copied_path)
    config = alembic_config(copied_path)
    command.stamp(config, "head")
    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{copied_path.as_posix()}")
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT name FROM research_sessions")).scalar_one() == "Preserved baseline data"
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == REVISION
    finally:
        engine.dispose()
    assert_schema(copied_path)
