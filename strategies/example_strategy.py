"""
Example Strategy Template
This is a simple template showing how to implement a new strategy.
"""

import pandas as pd
from typing import List, Dict, Any
from datetime import datetime
from core.strategies.types import StrategyConfig, Trade


def example_strategy(df: pd.DataFrame, risk_per_trade: float = 100.0, rr_ratio: float = 4.0) -> List[Dict[str, Any]]:
    """
    Example strategy template.
    
    This is a simple template that demonstrates the structure of a strategy.
    Replace the logic with your own trading rules.
    
    Args:
        df: DataFrame with columns: time, open, high, low, close, volume
        risk_per_trade: Risk amount in USD per trade
        rr_ratio: Risk/Reward ratio
        
    Returns:
        List of trade dictionaries
    """
    if len(df) < 20:
        return []
    
    trades = []
    df_list = df.to_dict('records')
    
    # Example: Simple moving average crossover
    # Calculate SMA
    closes = [c['close'] for c in df_list]
    sma_short = sum(closes[-10:]) / 10 if len(closes) >= 10 else closes[-1]
    sma_long = sum(closes[-20:]) / 20 if len(closes) >= 20 else closes[-1]
    
    # Example signal: Buy when short MA crosses above long MA
    if sma_short > sma_long and len(df_list) > 0:
        current_candle = df_list[-1]
        entry = current_candle['close']
        stop = entry * 0.98  # 2% stop loss
        tp = entry + rr_ratio * (entry - stop)
        
        # Calculate result (simplified - in real backtest this would check future candles)
        result_R = 0.0  # Would be calculated during backtest
        
        entry_time = current_candle.get('time', current_candle.get('timestamp', None))
        if entry_time is None:
            entry_time = datetime.now().isoformat()
        elif isinstance(entry_time, (int, float)):
            entry_time = datetime.fromtimestamp(entry_time).isoformat()
        
        trades.append({
            'entry_time': entry_time,
            'entry_price': entry,
            'stop': stop,
            'tp': tp,
            'result_R': result_R,
            'risk_usd': risk_per_trade,
            'rr_ratio': rr_ratio,
            'direction': 'long',  # This example strategy trades long positions
            'side': 'buy'
        })
    
    return trades

