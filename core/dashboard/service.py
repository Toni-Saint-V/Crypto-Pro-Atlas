"""
Dashboard snapshot service for CryptoBot Pro.

At this stage the service returns static placeholder values to provide a stable
contract for the frontend. Future iterations should replace the placeholder
logic with real integrations to the trading core (portfolio, analytics,
AI models, etc.).
"""

from __future__ import annotations

from typing import List, Optional, Union

from pydantic import BaseModel


class AISignal(BaseModel):
    """Represents AI recommendation for trading."""

    symbol: str
    side: str  # "buy" / "sell"
    confidence: float  # 0–100 (%)
    entry: float
    target: float
    stop: Optional[float] = None


class Candle(BaseModel):
    """Normalized OHLCV candle."""

    time: Union[float, int, str]
    open: float
    high: float
    low: float
    close: float
    volume: float


class Trade(BaseModel):
    """Represents a trade for display on chart and ticker."""
    
    entry_time: Union[float, int, str]
    entry_price: float
    exit_time: Optional[Union[float, int, str]] = None
    exit_price: Optional[float] = None
    side: str  # "buy" / "sell"
    direction: Optional[str] = None  # "long" / "short"
    size: Optional[float] = None
    pnl: Optional[float] = None
    result_R: Optional[float] = None
    symbol: str


class DashboardSnapshot(BaseModel):
    """Unified snapshot for the dashboard cards and chart."""

    balance: float
    daily_pnl_pct: float

    total_profit: float
    winrate_pct: float
    active_positions: int
    risk_level_pct: float

    symbol: str
    timeframe: str

    candles: List[Candle]
    ai_signals: List[AISignal]
    trades: List[Trade] = []  # Trades for chart markers and ticker


async def get_dashboard_snapshot(
    symbol: str = "BTCUSDT",
    timeframe: str = "15m",
) -> DashboardSnapshot:
    """
    Return the current dashboard snapshot with real market data.
    """
    from core.market_data.service import MarketDataService
    
    # Get real market data
    market_service = MarketDataService()
    candles_data = []
    import logging
    log = logging.getLogger(__name__)
    
    try:
        ohlcv_data = await market_service.get_candles(
            exchange="bybit",
            symbol=symbol,
            timeframe=timeframe,
            limit=500,
            mode="live"
        )
        
        # Validate and convert OHLCV to Candle format
        if ohlcv_data:
            for c in ohlcv_data:
                try:
                    # Validate OHLCV object has required attributes
                    if not hasattr(c, 'time') or not hasattr(c, 'open'):
                        log.warning(f"Skipping invalid candle: missing required attributes")
                        continue
                    
                    candles_data.append(
                        Candle(
                            time=int(c.time),
                            open=float(c.open),
                            high=float(c.high),
                            low=float(c.low),
                            close=float(c.close),
                            volume=float(c.volume) if hasattr(c, 'volume') else 0.0,
                        )
                    )
                except (ValueError, TypeError, AttributeError) as e:
                    log.warning(f"Error converting candle to Candle model: {e}, skipping")
                    continue
        else:
            log.info(f"No OHLCV data returned for {symbol} {timeframe}")
            
    except Exception as e:
        # Fallback to empty candles on error - don't crash the server
        log.error(f"Failed to load real candles for {symbol} {timeframe}: {e}", exc_info=True)
        candles_data = []

    # Generate AI signals (placeholder for now)
    ai_signals: List[AISignal] = [
        AISignal(
            symbol=symbol,
            side="buy",
            confidence=75.0,
            entry=float(candles_data[-1].close) if candles_data else 64000.0,
            target=float(candles_data[-1].close) * 1.02 if candles_data else 65280.0,
            stop=float(candles_data[-1].close) * 0.98 if candles_data else 62720.0,
        )
    ] if candles_data else []

    # Generate sample trades for demonstration (replace with real trades later)
    trades: List[Trade] = []
    if candles_data:
        # Add a few sample trades based on recent candles
        try:
            last_candle = candles_data[-1]
            entry_price = float(last_candle.close)
            
            # Sample trade 1
            trades.append(Trade(
                entry_time=candles_data[-10].time if len(candles_data) >= 10 else candles_data[0].time,
                entry_price=entry_price * 0.99,
                exit_time=last_candle.time,
                exit_price=entry_price,
                side="buy",
                direction="long",
                size=0.1,
                pnl=entry_price * 0.01 * 0.1,
                result_R=1.0,
                symbol=symbol
            ))
        except Exception as e:
            log.warning(f"Error generating sample trades: {e}")

    # Try to get real portfolio data if available
    balance = 10000.0
    daily_pnl_pct = 1.23
    total_profit = 2500.0
    winrate_pct = 62.5
    active_positions = 2
    risk_level_pct = 35.0
    
    # TODO: Integrate with real portfolio manager when available
    # try:
    #     from core.portfolio.portfolio_manager import PortfolioManager
    #     # Get real portfolio metrics
    #     # portfolio = get_portfolio_manager()  # Would need singleton/global instance
    #     # metrics = await portfolio.calculate_metrics()
    #     # balance = metrics.total_value
    #     # active_positions = len([a for a in portfolio.portfolio.values() if a.quantity > 0])
    # except Exception as e:
    #     log.debug(f"Portfolio manager not available, using defaults: {e}")
    
    # Calculate real metrics from candles if available
    if candles_data and len(candles_data) > 1:
        try:
            current_price = float(candles_data[-1].close)
            price_24h_ago = float(candles_data[0].close) if len(candles_data) > 24 else current_price
            daily_pnl_pct = ((current_price - price_24h_ago) / price_24h_ago) * 100 if price_24h_ago > 0 else 0
        except Exception:
            pass  # Keep default if calculation fails

    return DashboardSnapshot(
        balance=balance,
        daily_pnl_pct=daily_pnl_pct,
        total_profit=total_profit,
        winrate_pct=winrate_pct,
        active_positions=active_positions,
        risk_level_pct=risk_level_pct,
        symbol=symbol,
        timeframe=timeframe,
        candles=candles_data,
        ai_signals=ai_signals,
        trades=trades,
    )
