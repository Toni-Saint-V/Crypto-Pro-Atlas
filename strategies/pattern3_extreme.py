"""
Three-Candle Swing Pattern with Extremum Strategy

This strategy detects a three-candle structure where:
1. Middle candle is a local swing-low (extremum)
2. Red bearish pierce candle follows
3. Green bullish engulfing reversal candle
4. No Fair Value Gap (FVG) exists
5. Executes 1:4 risk/reward trade
"""

import pandas as pd
from typing import List, Dict, Any
from datetime import datetime


def pattern3_extreme(df: pd.DataFrame, risk_per_trade: float = 100.0, rr_ratio: float = 4.0) -> List[Dict[str, Any]]:
    """
    Detect three-candle swing pattern with extremum detection.
    
    Args:
        df: DataFrame with columns: time, open, high, low, close, volume
        risk_per_trade: Risk amount in USD per trade
        rr_ratio: Risk/Reward ratio (default 4.0 for 1:4)
    
    Returns:
        List of trade dictionaries with entry, stop, tp, and result_R
    """
    if len(df) < 4:
        return []
    
    # Ensure we have the required columns
    required_cols = ['open', 'high', 'low', 'close']
    if not all(col in df.columns for col in required_cols):
        raise ValueError(f"DataFrame must contain columns: {required_cols}")
    
    trades = []
    
    # Convert to list if needed for easier indexing
    if isinstance(df, pd.DataFrame):
        df_list = df.to_dict('records')
    else:
        df_list = df
    
    for i in range(2, len(df_list) - 3):
        # 1️⃣ Detect local swing-low (middle candle has lowest low)
        swing_candle = df_list[i]
        prev_candle = df_list[i-1]
        next_candle = df_list[i+1]
        
        if swing_candle['low'] < prev_candle['low'] and swing_candle['low'] < next_candle['low']:
            swing_low = swing_candle['low']
            
            # 2️⃣ Red "Pierce" Candle
            red = df_list[i+1]
            
            # Check if red candle is bearish and pierces below swing-low
            if red['close'] < red['open'] and red['low'] < swing_low:
                # Ensure no candle between swing-low and red broke that level
                # (This is already satisfied since we're checking consecutive candles)
                
                # 3️⃣ Green "Engulfing" Candle
                green = df_list[i+2]
                nextc = df_list[i+3]
                
                # Check if green is bullish and engulfs red
                if (
                    green['close'] > green['open'] and
                    green['open'] <= red['close'] and
                    green['close'] >= red['open']
                ):
                    # 4️⃣ No Imbalance (FVG) Check
                    # Next candle must overlap with green (no gap)
                    if not (nextc['low'] > green['high'] or nextc['high'] < green['low']):
                        # 5️⃣ Entry & Trade Setup
                        entry = red['open']
                        stop = red['low']
                        tp = entry + rr_ratio * (entry - stop)
                        
                        # Calculate result_R by checking if TP or SL was hit
                        result_R = _calculate_trade_result(df_list, i+2, entry, stop, tp)
                        
                        # Get entry time
                        entry_time = df_list[i+2].get('time', df_list[i+2].get('timestamp', None))
                        if entry_time is None:
                            entry_time = datetime.now().isoformat()
                        elif isinstance(entry_time, (int, float)):
                            # Convert timestamp to ISO format
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
        start_idx: Index where trade starts (after green candle)
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

