from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterable, Sequence, Set

from .models import OHLCV


class MarketDataProvider(ABC):
    """Abstract provider for fetching raw OHLCV candles."""

    native_timeframes: Set[str] = frozenset({"1m"})

    @abstractmethod
    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 500,
        since: int | None = None,
    ) -> Sequence[OHLCV]:
        """
        Fetch OHLCV candles for the requested timeframe.

        Providers should return ascending candles (oldest -> newest).
        """

    def supports_timeframe(self, timeframe: str) -> bool:
        """Return True if provider can natively serve the timeframe."""
        return timeframe in self.native_timeframes

    @staticmethod
    def normalize_payload(payload: Iterable[dict]) -> list[OHLCV]:
        """
        Normalize payload to OHLCV format with validation.
        Handles various input formats safely.
        """
        candles: list[OHLCV] = []
        import logging
        log = logging.getLogger(__name__)
        
        if not payload:
            return []
        
        for idx, row in enumerate(payload):
            try:
                # Validate row is a dict
                if not isinstance(row, dict):
                    log.warning(f"normalize_payload: row {idx} is not a dict, skipping: {type(row)}")
                    continue
                
                # Extract and validate required fields
                time_val = row.get("time")
                if time_val is None:
                    log.warning(f"normalize_payload: row {idx} missing 'time' field, skipping")
                    continue
                
                # Convert time to int (handle both int and string timestamps)
                if isinstance(time_val, str):
                    try:
                        time_val = int(float(time_val))
                    except (ValueError, TypeError):
                        log.warning(f"normalize_payload: row {idx} invalid time format: {time_val}")
                        continue
                else:
                    time_val = int(time_val)
                
                # Extract OHLCV values with safe defaults
                open_val = float(row.get("open", 0))
                high_val = float(row.get("high", 0))
                low_val = float(row.get("low", 0))
                close_val = float(row.get("close", 0))
                volume_val = float(row.get("volume", 0.0))
                
                # Validate values are finite
                if not all(
                    isinstance(v, (int, float)) and 
                    (v == v) and  # Check for NaN
                    abs(v) != float('inf')
                    for v in [open_val, high_val, low_val, close_val, volume_val]
                ):
                    log.warning(f"normalize_payload: row {idx} contains invalid numeric values, skipping")
                    continue
                
                candles.append(
                    OHLCV(
                        time=time_val,
                        open=open_val,
                        high=high_val,
                        low=low_val,
                        close=close_val,
                        volume=max(0.0, volume_val),  # Ensure non-negative volume
                    )
                )
            except (KeyError, ValueError, TypeError) as e:
                log.warning(f"normalize_payload: error processing row {idx}: {e}, skipping")
                continue
        
        if candles:
            candles.sort(key=lambda c: c.time)
        else:
            log.warning("normalize_payload: no valid candles after normalization")
        
        return candles
