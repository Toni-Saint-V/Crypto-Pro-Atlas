from __future__ import annotations

import time
from collections import OrderedDict
from typing import Hashable, Optional, Sequence

from .models import OHLCV


class MarketDataCache:
    """Simple in-memory TTL cache for OHLCV responses."""

    def __init__(self, ttl_seconds: int = 30, max_items: int = 32):
        self.ttl_seconds = ttl_seconds
        self.max_items = max_items
        self._store: "OrderedDict[Hashable, tuple[float, Sequence[OHLCV]]]" = OrderedDict()

    def _purge_expired(self) -> None:
        now = time.time()
        expired_keys = [
            key for key, (ts, _) in self._store.items() if now - ts > self.ttl_seconds
        ]
        for key in expired_keys:
            self._store.pop(key, None)

    def get(self, key: Hashable) -> Optional[Sequence[OHLCV]]:
        self._purge_expired()
        if key not in self._store:
            return None
        ts, value = self._store.pop(key)
        self._store[key] = (ts, value)  # move to end (LRU)
        return value

    def set(self, key: Hashable, value: Sequence[OHLCV]) -> None:
        self._purge_expired()
        if key in self._store:
            self._store.pop(key)
        elif len(self._store) >= self.max_items:
            self._store.popitem(last=False)
        self._store[key] = (time.time(), value)
