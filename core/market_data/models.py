from dataclasses import dataclass


@dataclass
class OHLCV:
    """Normalized OHLCV record."""

    time: int  # unix timestamp in seconds
    open: float
    high: float
    low: float
    close: float
    volume: float
