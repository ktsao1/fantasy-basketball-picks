"""Phase 2: projections, start/sit and pickups. Runs inside the pipeline.

Until Phase 2 lands, recommend() returns empty recommendations so the JSON shape
(and the dashboard) can be built against the final schema.
"""

from __future__ import annotations

from typing import Any


def recommend(data: dict[str, Any]) -> dict[str, Any]:
    """Takes the pipeline's JSON (minus recommendations) and returns the recommendations block.

    Every lineup slot, change and pickup carries a `reason` and a
    `confidence` {"level": "high"|"medium"|"low", "basis": str}.
    """
    return {
        "engine_version": "stub",
        "lineup": [],
        "changes": [],
        "pickups": [],
        "matchup_projection": None,
    }
