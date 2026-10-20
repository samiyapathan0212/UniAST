from uuid import UUID
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from backend.app.models import ImageAnalysisRecord, ResearchSession


async def create_session(client, name="Analysis session"):
    response = await client.post("/api/v1/sessions", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def image_stats(red=100, green=100, blue=100):
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return {
        "samples": 4,
        "resampled": False,
        "meanR": red,
        "meanG": green,
        "meanB": blue,
        "meanLuminance": luminance,
        "luminanceStdDev": 1.5,
        "minLuminance": luminance - 1,
        "maxLuminance": luminance + 1,
    }


def source_metadata():
    return {
        "fileName": "panel-test.png",
        "mimeType": "image/png",
        "fileSize": 2048,
        "width": 100,
        "height": 80,
    }


def image_analysis_payload():
    return {
        "sourceMetadata": source_metadata(),
        "roi": {"x": 5, "y": 6, "width": 2, "height": 2},
        "statistics": image_stats(),
        "methodVersion": "roi-rec709-v1",
    }


def calibration_payload():
    patches = []
    for patch_id, role, value in (("fit-a", "fit", 50), ("fit-b", "fit", 150), ("heldout", "validation", 100)):
        patches.append({
            "patchId": patch_id,
            "roi": {"x": value / 10, "y": 5, "width": 2, "height": 2},
            "measured": image_stats(value, value, value),
            "reference": {"r": value, "g": value, "b": value},
            "standard": f"patch {patch_id}",
            "role": role,
        })
    report = {
        "status": "ok",
        "fit": {"slope": 1, "intercept": 0},
        "points": 2,
        "distinctMeasured": 2,
        "residualRms": 0,
        "residualMaxAbs": 0,
        "message": "Fitted.",
    }
    return {
        "sourceMetadata": source_metadata(),
        "patches": patches,
        "model": {"r": report, "g": report, "b": report, "available": True, "method": "test fit", "fitPatchCount": 2},
        "fitErrorSummary": {
            "count": 2,
            "rms": {"r": 0, "g": 0, "b": 0},
            "maxAbs": {"r": 0, "g": 0, "b": 0},
            "meanLuminanceError": 0,
        },
        "validationErrorSummary": {
            "count": 1,
            "rms": {"r": 0, "g": 0, "b": 0},
            "maxAbs": {"r": 0, "g": 0, "b": 0},
            "meanLuminanceError": 0,
        },
        "methodVersion": "affine-ls-v1",
    }


def kinetic_payload():
    observation = {
        "timeMin": 0,
        "source": "row 1",
        "meanR": 100,
        "meanG": 100,
        "meanB": 100,
        "meanLuminance": 100,
        "roi": None,
        "resampled": False,
        "calibrated": False,
        "warnings": [],
        "deltaFromBaseline": 0,
        "ratePerMinute": None,
        "normalizedChange": 0,
    }
    return {
        "sourceType": "csv",
        "calibrationChoice": "raw",
        "observations": [observation],
        "baselineLuminance": 100,
        "issues": [],
        "warnings": ["Metadata only; source CSV remains local."],
        "methodVersion": "optical-series-v1",
    }


@pytest.mark.anyio
async def test_image_analysis_create_list_and_retrieve_persisted_json(client):
    session_id = await create_session(client)
    created = await client.post(
        f"/api/v1/sessions/{session_id}/image-analyses", json=image_analysis_payload()
    )
    assert created.status_code == 201
    record = created.json()
    assert UUID(record["id"])
    assert record["sessionId"] == session_id
    assert record["sourceMetadata"]["fileName"] == "panel-test.png"
    assert record["statistics"]["meanLuminance"] == pytest.approx(100)

    summaries = await client.get(f"/api/v1/sessions/{session_id}/image-analyses")
    assert summaries.status_code == 200
    assert summaries.json()["total"] == 1
    assert summaries.json()["items"][0]["id"] == record["id"]
    loaded = await client.get(f"/api/v1/sessions/{session_id}/image-analyses/{record['id']}")
    assert loaded.status_code == 200
    assert loaded.json() == record


@pytest.mark.anyio
async def test_varied_and_black_image_statistics_save_and_retrieve(client):
    session_id = await create_session(client)
    fixtures = [
        [(34, 177, 76), (20, 100, 200), (255, 20, 0)],
        [(0, 0, 0), (0, 0, 0)],
    ]
    for index, pixels in enumerate(fixtures):
        luminances = [0.2126 * red + 0.7152 * green + 0.0722 * blue for red, green, blue in pixels]
        stats = {
            "samples": len(pixels),
            "resampled": False,
            "meanR": sum(pixel[0] for pixel in pixels) / len(pixels),
            "meanG": sum(pixel[1] for pixel in pixels) / len(pixels),
            "meanB": sum(pixel[2] for pixel in pixels) / len(pixels),
            "meanLuminance": sum(luminances) / len(luminances),
            "luminanceStdDev": 0,
            "minLuminance": min(luminances),
            "maxLuminance": max(luminances),
        }
        payload = {
            "sourceMetadata": source_metadata(),
            "roi": {"x": 0, "y": 0, "width": len(pixels), "height": 1},
            "statistics": stats,
            "methodVersion": "roi-rec709-v1",
        }
        created = await client.post(
            f"/api/v1/sessions/{session_id}/image-analyses", json=payload
        )
        assert created.status_code == 201, created.text
        loaded = await client.get(
            f"/api/v1/sessions/{session_id}/image-analyses/{created.json()['id']}"
        )
        assert loaded.status_code == 200
        assert loaded.json()["statistics"] == stats
        assert stats["minLuminance"] <= stats["meanLuminance"] <= stats["maxLuminance"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update(roi={"x": -1, "y": 0, "width": 10, "height": 10}),
        lambda p: p.update(roi={"x": 95, "y": 0, "width": 10, "height": 10}),
        lambda p: p["statistics"].update(meanLuminance=255),
        lambda p: p["statistics"].update(samples=0),
        lambda p: p["statistics"].update(samples=5),
        lambda p: p["sourceMetadata"].update(fileSize=0),
        lambda p: p.update(unexpectedResultField=12),
    ],
)
async def test_image_analysis_rejects_invalid_ranges_and_relationships(client, mutate):
    session_id = await create_session(client)
    payload = image_analysis_payload()
    mutate(payload)
    response = await client.post(f"/api/v1/sessions/{session_id}/image-analyses", json=payload)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_malformed_json_and_oversized_request_are_rejected_safely(client):
    malformed = await client.post(
        "/api/v1/sessions", content=b'{"name":', headers={"content-type": "application/json"}
    )
    assert malformed.status_code == 422

    oversized_body = b'{"name":"' + b"x" * (5 * 1024 * 1024) + b'"}'
    oversized = await client.post(
        "/api/v1/sessions", content=oversized_body, headers={"content-type": "application/json"}
    )
    assert oversized.status_code == 413


@pytest.mark.anyio
async def test_analysis_endpoints_reject_unknown_or_mismatched_session(client):
    real_session = await create_session(client)
    unknown = "00000000-0000-0000-0000-000000000001"
    response = await client.post(
        f"/api/v1/sessions/{unknown}/image-analyses", json=image_analysis_payload()
    )
    assert response.status_code == 404
    assert (await client.get(f"/api/v1/sessions/{unknown}/calibrations")).status_code == 404
    assert (await client.post(f"/api/v1/sessions/{unknown}/calibrations", json=calibration_payload())).status_code == 404
    assert (await client.post(f"/api/v1/sessions/{unknown}/kinetic-analyses", json=kinetic_payload())).status_code == 404
    created = await client.post(
        f"/api/v1/sessions/{real_session}/image-analyses", json=image_analysis_payload()
    )
    other_session = await create_session(client, "Different session")
    record_id = created.json()["id"]
    assert (await client.get(f"/api/v1/sessions/{other_session}/image-analyses/{record_id}")).status_code == 404
    calibration = await client.post(
        f"/api/v1/sessions/{real_session}/calibrations", json=calibration_payload()
    )
    kinetic = await client.post(
        f"/api/v1/sessions/{real_session}/kinetic-analyses", json=kinetic_payload()
    )
    assert calibration.status_code == 201
    assert kinetic.status_code == 201
    assert (await client.get(f"/api/v1/sessions/{other_session}/calibrations/{calibration.json()['id']}")).status_code == 404
    assert (await client.get(f"/api/v1/sessions/{other_session}/kinetic-analyses/{kinetic.json()['id']}")).status_code == 404


@pytest.mark.anyio
async def test_fresh_database_enforces_foreign_keys_and_relationships(client, app):
    session_id = await create_session(client)
    created = await client.post(
        f"/api/v1/sessions/{session_id}/image-analyses", json=image_analysis_payload()
    )
    assert created.status_code == 201

    with app.state.engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
    with Session(app.state.engine) as db:
        parent = db.get(ResearchSession, UUID(session_id))
        assert parent is not None
        assert [record.id for record in parent.image_analyses] == [UUID(created.json()["id"])]

    with Session(app.state.engine) as db:
        db.add(ImageAnalysisRecord(
            session_id=uuid4(), source_metadata={}, roi={}, statistics={}, method_version="test"
        ))
        with pytest.raises(IntegrityError):
            db.commit()


@pytest.mark.anyio
async def test_calibration_persists_fit_and_held_out_validation_separately(client):
    session_id = await create_session(client)
    payload = calibration_payload()
    response = await client.post(f"/api/v1/sessions/{session_id}/calibrations", json=payload)
    assert response.status_code == 201, response.text
    record = response.json()
    assert [patch["role"] for patch in record["patches"]] == ["fit", "fit", "validation"]
    assert record["model"]["fitPatchCount"] == 2
    assert record["fitErrorSummary"]["count"] == 2
    assert record["validationErrorSummary"]["count"] == 1
    loaded = await client.get(f"/api/v1/sessions/{session_id}/calibrations/{record['id']}")
    assert loaded.status_code == 200
    assert loaded.json() == record


@pytest.mark.anyio
async def test_calibration_rejects_duplicate_patch_ids(client):
    session_id = await create_session(client)
    payload = calibration_payload()
    payload["patches"][1]["patchId"] = payload["patches"][0]["patchId"]
    response = await client.post(f"/api/v1/sessions/{session_id}/calibrations", json=payload)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_calibration_rejects_fit_summary_that_includes_held_out_patch(client):
    session_id = await create_session(client)
    payload = calibration_payload()
    payload["fitErrorSummary"]["count"] = 3
    response = await client.post(f"/api/v1/sessions/{session_id}/calibrations", json=payload)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_calibration_patch_array_has_a_bounded_size(client):
    session_id = await create_session(client)
    payload = calibration_payload()
    payload["patches"] = payload["patches"] * 67
    response = await client.post(f"/api/v1/sessions/{session_id}/calibrations", json=payload)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_kinetic_analysis_persists_derived_series_and_enforces_order(client):
    session_id = await create_session(client)
    response = await client.post(
        f"/api/v1/sessions/{session_id}/kinetic-analyses", json=kinetic_payload()
    )
    assert response.status_code == 201, response.text
    record = response.json()
    assert record["sourceType"] == "csv"
    assert record["observations"][0]["deltaFromBaseline"] == 0
    loaded = await client.get(f"/api/v1/sessions/{session_id}/kinetic-analyses/{record['id']}")
    assert loaded.status_code == 200
    assert loaded.json() == record

    invalid = kinetic_payload()
    invalid["baselineLuminance"] = 101
    assert (await client.post(f"/api/v1/sessions/{session_id}/kinetic-analyses", json=invalid)).status_code == 422

    unsorted = kinetic_payload()
    second = dict(unsorted["observations"][0], timeMin=2, source="row 2", meanR=90, meanG=90, meanB=90,
                  meanLuminance=90, deltaFromBaseline=-5, ratePerMinute=-5, normalizedChange=-5 / 95)
    first = dict(unsorted["observations"][0], timeMin=3, source="row 3", meanR=95, meanG=95, meanB=95,
                 meanLuminance=95, deltaFromBaseline=0, ratePerMinute=None, normalizedChange=0)
    unsorted["observations"] = [first, second]
    unsorted["baselineLuminance"] = 95
    assert (await client.post(f"/api/v1/sessions/{session_id}/kinetic-analyses", json=unsorted)).status_code == 422


@pytest.mark.anyio
async def test_zero_baseline_requires_unavailable_normalized_changes(client):
    session_id = await create_session(client)
    payload = kinetic_payload()
    observation = payload["observations"][0]
    observation.update(meanR=0, meanG=0, meanB=0, meanLuminance=0, normalizedChange=None)
    payload["baselineLuminance"] = 0
    created = await client.post(f"/api/v1/sessions/{session_id}/kinetic-analyses", json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["observations"][0]["normalizedChange"] is None


@pytest.mark.anyio
async def test_kinetic_duplicate_warning_order_and_method_version_round_trip(client):
    session_id = await create_session(client)
    payload = kinetic_payload()
    warning = "row 2: duplicate elapsed time 0 min."
    first = payload["observations"][0]
    second = dict(first, source="row 2", warnings=[warning])
    payload["observations"] = [first, second]
    payload["issues"] = [{"kind": "duplicate-time", "message": warning}]
    payload["warnings"] = [warning]
    payload["methodVersion"] = "optical-series-audit-test-v2"

    created = await client.post(
        f"/api/v1/sessions/{session_id}/kinetic-analyses", json=payload
    )
    assert created.status_code == 201, created.text
    record_id = created.json()["id"]
    loaded = await client.get(f"/api/v1/sessions/{session_id}/kinetic-analyses/{record_id}")
    record = loaded.json()
    assert [row["source"] for row in record["observations"]] == ["row 1", "row 2"]
    assert record["observations"][1]["warnings"] == [warning]
    assert record["issues"] == payload["issues"]
    assert record["baselineLuminance"] == 100
    assert record["methodVersion"] == "optical-series-audit-test-v2"


@pytest.mark.anyio
async def test_analysis_records_survive_new_database_sessions(client):
    session_id = await create_session(client)
    payload = kinetic_payload()
    created = await client.post(
        f"/api/v1/sessions/{session_id}/kinetic-analyses", json=payload
    )
    assert created.status_code == 201
    record_id = created.json()["id"]
    retrieved = await client.get(f"/api/v1/sessions/{session_id}/kinetic-analyses/{record_id}")
    assert retrieved.status_code == 200
    assert retrieved.json()["observations"] == payload["observations"]


@pytest.mark.anyio
async def test_analysis_records_can_only_be_deleted_through_their_owning_session(client):
    owner_id = await create_session(client, "Delete test owner")
    unrelated_id = await create_session(client, "Unrelated session")
    records = [
        ("image-analyses", image_analysis_payload()),
        ("calibrations", calibration_payload()),
        ("kinetic-analyses", kinetic_payload()),
    ]
    created_records = []
    for route, payload in records:
        created = await client.post(f"/api/v1/sessions/{owner_id}/{route}", json=payload)
        assert created.status_code == 201, created.text
        created_records.append((route, created.json()["id"]))

    for route, record_id in created_records:
        wrong_owner = await client.delete(
            f"/api/v1/sessions/{unrelated_id}/{route}/{record_id}"
        )
        assert wrong_owner.status_code == 404
        assert (await client.get(
            f"/api/v1/sessions/{owner_id}/{route}/{record_id}"
        )).status_code == 200

        deleted = await client.delete(
            f"/api/v1/sessions/{owner_id}/{route}/{record_id}"
        )
        assert deleted.status_code == 204
        assert deleted.content == b""
        assert (await client.get(
            f"/api/v1/sessions/{owner_id}/{route}/{record_id}"
        )).status_code == 404

    assert (await client.get(f"/api/v1/sessions/{owner_id}")).status_code == 200
    assert (await client.get(f"/api/v1/sessions/{unrelated_id}")).status_code == 200


@pytest.mark.anyio
async def test_delete_session_cleans_linked_records_without_affecting_other_session(client):
    owner_id = await create_session(client, "Session with children")
    unrelated_id = await create_session(client, "Session to preserve")
    for route, payload in (
        ("image-analyses", image_analysis_payload()),
        ("calibrations", calibration_payload()),
        ("kinetic-analyses", kinetic_payload()),
    ):
        created = await client.post(f"/api/v1/sessions/{owner_id}/{route}", json=payload)
        assert created.status_code == 201, created.text

    deleted = await client.delete(f"/api/v1/sessions/{owner_id}")
    assert deleted.status_code == 204
    assert (await client.get(f"/api/v1/sessions/{owner_id}")).status_code == 404
    assert (await client.get(f"/api/v1/sessions/{unrelated_id}")).status_code == 200
    for route in ("image-analyses", "calibrations", "kinetic-analyses"):
        response = await client.get(f"/api/v1/sessions/{unrelated_id}/{route}")
        assert response.status_code == 200
        assert response.json()["items"] == []
