import pytest
from httpx import ASGITransport, AsyncClient


PRODUCTION_ORIGIN = "https://uni-ast-five.vercel.app"


@pytest.mark.anyio
async def test_production_frontend_origin_is_allowed(client):
    response = await client.get(
        "/api/v1/sessions",
        headers={"Origin": PRODUCTION_ORIGIN},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PRODUCTION_ORIGIN
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize(
    "origin",
    ["http://localhost:5173", "http://127.0.0.1:5173"],
)
@pytest.mark.anyio
async def test_local_development_origins_remain_allowed(client, origin):
    response = await client.get("/api/v1/sessions", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.anyio
async def test_preflight_allows_production_origin_and_required_methods_and_headers(client):
    response = await client.options(
        "/api/v1/sessions?limit=50&offset=0",
        headers={
            "Origin": PRODUCTION_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PRODUCTION_ORIGIN
    allowed_methods = response.headers["access-control-allow-methods"]
    for method in ("GET", "POST", "PATCH", "DELETE", "OPTIONS"):
        assert method in allowed_methods
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers


@pytest.mark.anyio
async def test_unrelated_origin_is_not_allowed(client):
    response = await client.get(
        "/api/v1/sessions",
        headers={"Origin": "https://unrelated.example"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.anyio
async def test_cors_headers_are_present_on_error_responses(app):
    async def raise_server_error():
        raise RuntimeError("test server error")

    # Add a test-only route on the wrapped FastAPI app to exercise the outer
    # CORS layer around Starlette's generated 500 response.
    app.app.add_api_route("/test-server-error", raise_server_error, methods=["GET"])
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/test-server-error",
            headers={"Origin": PRODUCTION_ORIGIN},
        )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == PRODUCTION_ORIGIN
