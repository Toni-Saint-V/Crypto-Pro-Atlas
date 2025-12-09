"use strict";

const API_BASE = "/api";

export async function fetchDashboardSnapshot({ symbol, timeframe }) {
  const params = new URLSearchParams({
    symbol: symbol || "BTCUSDT",
    timeframe: timeframe || "15m",
  });

  const resp = await fetch(`${API_BASE}/dashboard/snapshot?${params.toString()}`);
  if (!resp.ok) {
    throw new Error(`[CBP API] Failed to load snapshot: ${resp.status}`);
  }
  return await resp.json();
}

