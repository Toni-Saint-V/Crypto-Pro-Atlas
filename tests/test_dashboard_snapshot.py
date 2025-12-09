import pytest
from fastapi.testclient import TestClient

from core.dashboard.service import (
    DashboardSnapshot,
    get_dashboard_snapshot,
)
from server import app


client = TestClient(app)


@pytest.mark.asyncio
async def test_get_dashboard_snapshot_returns_model():
    snapshot = await get_dashboard_snapshot()
    assert isinstance(snapshot, DashboardSnapshot)
    assert isinstance(snapshot.balance, float)
    assert isinstance(snapshot.total_profit, float)
    assert isinstance(snapshot.winrate_pct, float)
    assert isinstance(snapshot.active_positions, int)
    assert isinstance(snapshot.risk_level_pct, float)
    assert isinstance(snapshot.candles, list)
    assert isinstance(snapshot.ai_signals, list)


def test_dashboard_snapshot_endpoint_ok():
    response = client.get("/api/dashboard/snapshot")
    assert response.status_code == 200
    data = response.json()
    for key in [
        "balance",
        "daily_pnl_pct",
        "total_profit",
        "winrate_pct",
        "active_positions",
        "risk_level_pct",
        "symbol",
        "timeframe",
        "candles",
        "ai_signals",
    ]:
        assert key in data
