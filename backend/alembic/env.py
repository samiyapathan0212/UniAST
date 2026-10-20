from logging.config import fileConfig
from pathlib import Path
import os
import sys

from alembic import context
from sqlalchemy import pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from backend.app import models  # noqa: E402,F401
from backend.app.database import create_database_engine, get_database_url, DEFAULT_DATABASE_URL  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

target_metadata = SQLModel.metadata

# Allows tests and backup-copy procedures to target an explicit SQLite file.
configured_database_url = (
    os.environ.get("UNIAST_DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
    or DEFAULT_DATABASE_URL
)
database_url = get_database_url(configured_database_url)
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_database_engine(database_url)
    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
                render_as_batch=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
