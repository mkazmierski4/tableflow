"""The committed `openapi.json` is the frontend's source of truth; it must track the API."""

import json
from pathlib import Path

from src.cli import main, render_openapi

COMMITTED = Path(__file__).resolve().parents[2] / "openapi.json"


def test_committed_schema_is_up_to_date() -> None:
    assert COMMITTED.read_text(encoding="utf-8") == render_openapi(), (
        "openapi.json is stale. Regenerate: `python -m src.cli export-openapi` in backend/, "
        "then `npm run api:types` in frontend/."
    )


def test_export_command_writes_valid_json(tmp_path: Path) -> None:
    target = tmp_path / "schema.json"
    assert main(["export-openapi", "--output", str(target)]) == 0
    schema = json.loads(target.read_text(encoding="utf-8"))
    assert "/api/v1/restaurants/cities" in schema["paths"]
    assert "city" in schema["components"]["schemas"]["RestaurantRead"]["properties"]
