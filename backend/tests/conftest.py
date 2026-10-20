import pytest
from httpx import ASGITransport, AsyncClient
from alembic import command
from alembic.config import Config
from pathlib import Path

from backend.app.main import create_app


BACKEND_DIR = Path(__file__).resolve().parents[1]


def upgrade_database(database_url: str) -> None:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(config, "head")


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def app(tmp_path):
    database_path = tmp_path / "sessions-test.sqlite3"
    database_url = f"sqlite:///{database_path.as_posix()}"
    upgrade_database(database_url)
    application = create_app(database_url)
    yield application
    application.state.engine.dispose()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as test_client:
        yield test_client
