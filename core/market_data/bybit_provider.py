from __future__ import annotations

from typing import Sequence

from web.bybit_client import INTERVAL_MAP, fetch_ohlcv

from .models import OHLCV
from .provider_base import MarketDataProvider


class BybitMarketDataProvider(MarketDataProvider):
    """MarketDataProvider implementation backed by the existing Bybit client."""

    native_timeframes = frozenset(INTERVAL_MAP.keys())

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 500,
        since: int | None = None,
    ) -> Sequence[OHLCV]:
        """Fetch OHLCV using the async Bybit client wrapper."""
        candles = await fetch_ohlcv(symbol=symbol, interval=timeframe, limit=limit)

        if not candles:
            return []

        normalized = self.normalize_payload(candles)

        if since is not None:
            normalized = [c for c in normalized if c.time >= since]

        return normalized
