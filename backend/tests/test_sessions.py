from datetime import datetime
from uuid import UUID

import pytest


async def make_session(client, name, **extra):
    return await client.post(
        "/api/v1/sessions",
        json={"name": name, **extra},
    )


@pytest.mark.anyio
async def test_create_session_returns_valid_record(client):
    response = await make_session(
        client,
        "  Panel run  ",
        device=" Pixel 8 ",
        notes=" Initial observations ",
    )

    assert response.status_code == 201
    record = response.json()
    assert UUID(record["id"])
    assert record["name"] == "Panel run"
    assert record["device"] == "Pixel 8"
    assert record["notes"] == "Initial observations"
    created_at = datetime.fromisoformat(record["createdAt"])
    updated_at = datetime.fromisoformat(record["updatedAt"])
    assert created_at.tzinfo is not None
    assert updated_at.tzinfo is not None
    assert updated_at == created_at


@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"name": "Valid name", "device": "x" * 121},
        {"name": "Valid name", "notes": "x" * 2001},
        {"name": 7},
    ],
)
@pytest.mark.anyio
async def test_create_rejects_invalid_fields(client, payload):
    response = await client.post("/api/v1/sessions", json=payload)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_create_allows_optional_device_and_notes(client):
    response = await make_session(client, "Local session")
    assert response.status_code == 201
    assert response.json()["device"] is None
    assert response.json()["notes"] is None


@pytest.mark.anyio
async def test_list_orders_newest_first_and_reports_total(client):
    first = (await make_session(client, "First run")).json()
    second = (await make_session(client, "Second run")).json()

    response = await client.get("/api/v1/sessions")
    assert response.status_code == 200
    result = response.json()
    assert result["total"] == 2
    assert result["limit"] == 50
    assert result["offset"] == 0
    assert [item["id"] for item in result["items"]] == [second["id"], first["id"]]


@pytest.mark.anyio
async def test_list_pagination_and_bounds(client):
    for name in ("Run one", "Run two", "Run three"):
        assert (await make_session(client, name)).status_code == 201

    page = await client.get("/api/v1/sessions?limit=1&offset=1")
    assert page.status_code == 200
    assert len(page.json()["items"]) == 1
    assert page.json()["total"] == 3
    assert (await client.get("/api/v1/sessions?limit=0")).status_code == 422
    assert (await client.get("/api/v1/sessions?limit=101")).status_code == 422
    assert (await client.get("/api/v1/sessions?offset=100001")).status_code == 422


@pytest.mark.anyio
async def test_retrieve_session_and_return_404(client):
    created = (await make_session(client, "Retrievable run")).json()

    response = await client.get(f"/api/v1/sessions/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created

    missing = await client.get("/api/v1/sessions/00000000-0000-0000-0000-000000000001")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Research session not found."


@pytest.mark.anyio
async def test_record_persists_across_database_sessions(client):
    created = (await make_session(
        client,
        "Persistent record",
        device="Test device",
        notes="Temporary database test",
    )).json()

    # A second HTTP request uses a new SQLModel Session against the same file.
    retrieved = await client.get(f"/api/v1/sessions/{created['id']}")
    assert retrieved.status_code == 200
    assert retrieved.json()["name"] == "Persistent record"
    assert retrieved.json()["notes"] == "Temporary database test"
