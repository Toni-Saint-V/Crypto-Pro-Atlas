from __future__ import annotations

import logging
from typing import Dict, List, Sequence

from .bybit_provider import BybitMarketDataProvider
from .cache import MarketDataCache
from .models import OHLCV
from .provider_base import MarketDataProvider

log = logging.getLogger(__name__)

BASE_TIMEFRAME_SECONDS = 60  # 1m raw resolution
BASE_TIMEFRAME_STR = "1m"


def timeframe_to_seconds(value: str) -> int:
    if not value:
        raise ValueError("timeframe is required")

    value = value.strip().lower()
    unit = value[-1]
    amount_str = value[:-1]

    if unit.isdigit():
        # value already in minutes, e.g. "15"
        amount = int(value)
        return amount * 60

    if not amount_str.isdigit():
        raise ValueError(f"Unsupported timeframe: {value}")

    amount = int(amount_str)
    if amount <= 0:
        raise ValueError("timeframe must be positive")

    factors = {
        "s": 1,
        "m": 60,
        "h": 60 * 60,
        "d": 24 * 60 * 60,
    }
    if unit not in factors:
        raise ValueError(f"Unsupported timeframe unit: {unit}")
    return amount * factors[unit]


class MarketDataService:
    """High level service that normalizes market data access."""

    def __init__(
        self,
        cache: MarketDataCache | None = None,
        providers: Dict[str, MarketDataProvider] | None = None,
    ):
        self.cache = cache or MarketDataCache()
        self.providers = providers or {"bybit": BybitMarketDataProvider()}

    def get_provider(self, exchange: str) -> MarketDataProvider:
        try:
            return self.providers[exchange.lower()]
        except KeyError:
            raise ValueError(f"Unsupported exchange: {exchange}")

    async def get_candles(
        self,
        exchange: str,
        symbol: str,
        timeframe: str,
        limit: int = 500,
        mode: str = "live",
        use_native_timeframe: bool = True,
    ) -> list[OHLCV]:
        log.info(
            "MarketDataService.get_candles exchange=%s symbol=%s timeframe=%s limit=%s mode=%s",
            exchange,
            symbol,
            timeframe,
            limit,
            mode,
        )
        provider = self.get_provider(exchange)
        tf_seconds = timeframe_to_seconds(timeframe)

        if tf_seconds < BASE_TIMEFRAME_SECONDS:
            raise ValueError("Requested timeframe is below 1m resolution")

        if use_native_timeframe and provider.supports_timeframe(timeframe):
            candles = await provider.get_ohlcv(symbol=symbol, timeframe=timeframe, limit=limit)
            return list(candles)[-limit:]

        if tf_seconds % BASE_TIMEFRAME_SECONDS != 0:
            raise ValueError("Timeframe must be divisible by 1m for aggregation")

        ratio = tf_seconds // BASE_TIMEFRAME_SECONDS
        raw_limit = min(max(limit * ratio * 2, ratio * 2), 2000)
        cache_key = (exchange.lower(), symbol.upper(), BASE_TIMEFRAME_STR, raw_limit)
        raw = self.cache.get(cache_key)
        if raw is None:
            log.debug(
                "Cache miss for %s %s timeframe=%s limit=%s",
                exchange,
                symbol,
                BASE_TIMEFRAME_STR,
                raw_limit,
            )
            raw = await provider.get_ohlcv(symbol=symbol, timeframe=BASE_TIMEFRAME_STR, limit=raw_limit)
            self.cache.set(cache_key, raw)

        aggregated = self._aggregate(raw, tf_seconds, limit)
        return aggregated

    def _aggregate(self, candles: Sequence[OHLCV], bucket_seconds: int, limit: int) -> list[OHLCV]:
        aggregated: List[OHLCV] = []
        current_bucket_start = None
        current = None

        for candle in sorted(candles, key=lambda c: c.time):
            bucket_start = (candle.time // bucket_seconds) * bucket_seconds

            if current_bucket_start is None:
                current_bucket_start = bucket_start
                current = OHLCV(
                    time=bucket_start,
                    open=candle.open,
                    high=candle.high,
                    low=candle.low,
                    close=candle.close,
                    volume=candle.volume,
                )
                continue

            if bucket_start != current_bucket_start:
                aggregated.append(current)
                current_bucket_start = bucket_start
                current = OHLCV(
                    time=bucket_start,
                    open=candle.open,
                    high=candle.high,
                    low=candle.low,
                    close=candle.close,
                    volume=candle.volume,
                )
                continue

            current.high = max(current.high, candle.high)
            current.low = min(current.low, candle.low)
            current.close = candle.close
            current.volume += candle.volume

        if current is not None:
            aggregated.append(current)

        if len(aggregated) > limit:
            aggregated = aggregated[-limit:]

        return aggregated
