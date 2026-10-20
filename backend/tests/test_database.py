from sqlalchemy.engine import make_url

from backend.app.database import get_database_url


def test_database_url_uses_environment_for_postgresql_without_connecting(monkeypatch):
    database_url = (
        "postgresql://uniast:test-password@ep.example.neon.tech/uniast"
        "?sslmode=require&channel_binding=require"
    )
    monkeypatch.setenv("UNIAST_DATABASE_URL", database_url)

    resolved = get_database_url()
    parsed = make_url(resolved)

    assert resolved == database_url
    assert parsed.get_backend_name() == "postgresql"
    assert parsed.host == "ep.example.neon.tech"
    assert parsed.database == "uniast"
    assert parsed.query["sslmode"] == "require"
    assert parsed.query["channel_binding"] == "require"


def test_legacy_postgres_scheme_is_normalized(monkeypatch):
    monkeypatch.setenv("UNIAST_DATABASE_URL", "postgres://user:pass@db.example/uniast")

    assert get_database_url() == "postgresql://user:pass@db.example/uniast"
    assert make_url(get_database_url()).get_backend_name() == "postgresql"


def test_sqlite_environment_url_remains_supported(monkeypatch):
    database_url = "sqlite:////tmp/uniast-test.sqlite3"
    monkeypatch.setenv("UNIAST_DATABASE_URL", database_url)

    assert get_database_url() == database_url
    assert make_url(get_database_url()).get_backend_name() == "sqlite"


def test_explicit_database_url_takes_precedence_over_environment(monkeypatch):
    monkeypatch.setenv("UNIAST_DATABASE_URL", "sqlite:///:memory:")

    assert get_database_url("postgresql://test/db") == "postgresql://test/db"
