"""
Momentum ML v2 Strategy (Beta)
Simple momentum-based strategy using technical indicators.

This is a simplified version that uses:
- RSI for momentum detection
- Moving averages for trend confirmation
- Volume for signal strength

Note: The "ML" in the name refers to future ML integration, currently uses traditional indicators.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any
from datetime import datetime


def momentum_ml_v2(df: pd.DataFrame, risk_per_trade: float = 100.0, rr_ratio: float = 4.0) -> List[Dict[str, Any]]:
    """
    Momentum-based strategy using RSI and moving averages.
    
    Entry conditions:
    - RSI < 40 (oversold) for long entries
    - Price above short MA and short MA above long MA (uptrend)
    - Volume above average (confirmation)
    
    Args:
        df: DataFrame with columns: time, open, high, low, close, volume
        risk_per_trade: Risk amount in USD per trade
        rr_ratio: Risk/Reward ratio (default 4.0)
        
    Returns:
        List of trade dictionaries with entry, stop, tp, and result_R
    """
    if len(df) < 50:
        return []
    
    # Ensure required columns
    required_cols = ['open', 'high', 'low', 'close']
    if not all(col in df.columns for col in required_cols):
        raise ValueError(f"DataFrame must contain columns: {required_cols}")
    
    trades = []
    df_list = df.to_dict('records')
    
    # Calculate indicators
    closes = np.array([c['close'] for c in df_list])
    highs = np.array([c['high'] for c in df_list])
    lows = np.array([c['low'] for c in df_list])
    volumes = np.array([c.get('volume', 0) for c in df_list])
    
    # Moving averages
    ma_short = 20
    ma_long = 50
    
    # RSI calculation
    def calculate_rsi(prices, period=14):
        """Calculate RSI indicator"""
        if len(prices) < period + 1:
            return 50.0
        
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        
        if avg_loss == 0:
            return 100.0 if avg_gain > 0 else 50.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    # Check for signals starting from index where we have enough data
    for i in range(ma_long, len(df_list) - 3):
        # Get recent data for indicators
        recent_closes = closes[i-ma_long:i+1]
        recent_highs = highs[i-ma_long:i+1]
        recent_lows = lows[i-ma_long:i+1]
        recent_volumes = volumes[i-ma_long:i+1]
        
        # Calculate indicators
        current_price = closes[i]
        ma_short_value = np.mean(recent_closes[-ma_short:])
        ma_long_value = np.mean(recent_closes[-ma_long:])
        rsi = calculate_rsi(recent_closes[-15:])
        avg_volume = np.mean(recent_volumes[-20:])
        current_volume = recent_volumes[-1]
        
        # Find swing low for stop loss
        lookback = min(20, i)
        swing_low = min(recent_lows[-lookback:])
        
        # Entry conditions for LONG
        is_uptrend = ma_short_value > ma_long_value
        is_oversold = rsi < 40
        volume_confirmation = current_volume > avg_volume * 1.2
        price_above_ma = current_price > ma_short_value
        
        if is_uptrend and is_oversold and volume_confirmation and price_above_ma:
            # Entry setup
            entry = current_price
            stop = swing_low * 0.999  # Slightly below swing low
            tp = entry + rr_ratio * (entry - stop)
            
            # Calculate result_R by checking if TP or SL was hit
            result_R = _calculate_trade_result(df_list, i+1, entry, stop, tp)
            
            # Get entry time
            entry_time = df_list[i].get('time', df_list[i].get('timestamp', None))
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
                'direction': 'long',  # This strategy only trades long positions
                'side': 'buy'
            })
    
    return trades


def _calculate_trade_result(df_list: List[Dict], start_idx: int, entry: float, stop: float, tp: float) -> float:
    """
    Calculate trade result in R units.
    
    Args:
        df_list: List of candle dictionaries
        start_idx: Index where trade starts
        entry: Entry price
        stop: Stop loss price
        tp: Take profit price
        
    Returns:
        Result in R units (positive for win, negative for loss)
    """
    # Check subsequent candles to see if TP or SL was hit first
    for j in range(start_idx, len(df_list)):
        candle = df_list[j]
        high = candle.get('high', candle.get('close', entry))
        low = candle.get('low', candle.get('close', entry))
        
        # Check if stop loss was hit (takes precedence)
        if low <= stop:
            return -1.0  # Loss: -1R
        
        # Check if take profit was hit
        if high >= tp:
            # Calculate actual R based on TP hit
            risk = entry - stop
            if risk > 0:
                reward = tp - entry
                return reward / risk  # Actual R achieved
            return 4.0  # Default 4R if calculation fails
    
    # If neither hit, close at last price
    if len(df_list) > start_idx:
        last_candle = df_list[-1]
        last_price = last_candle.get('close', entry)
        
        if last_price <= stop:
            return -1.0
        elif last_price >= tp:
            risk = entry - stop
            if risk > 0:
                reward = tp - entry
                return reward / risk
            return 4.0
        else:
            # Partial result based on current price
            risk = entry - stop
            if risk > 0:
                pnl = last_price - entry
                return pnl / risk
    
    return 0.0  # No result

