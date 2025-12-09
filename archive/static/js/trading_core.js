/**
 * CryptoBot Pro v8.0 - Trading Core Frontend
 * Lightweight Charts integration with candlesticks, strategy overlays, and AI chat
 */

// ============================================
// Global State
// ============================================

let chart = null;
let candlestickSeries = null;
let equitySeries = null;
let confidenceSeries = null;
let wsAI = null;
let wsTrades = null;
let isRunning = false;
let isLiveMode = false;
let currentStrategy = 'pattern3_extreme';

// Strategy name mapping (frontend -> backend)
const strategyNameMap = {
  'momentum-ml-v2': 'momentum_ml_v2',
  'reversion-alpha': 'reversion_alpha',
  'ensemble-beta': 'ensemble_beta',
  'pattern3-extreme': 'pattern3_extreme',
  'pattern3_extreme': 'pattern3_extreme',
};
let currentSymbol = 'BTCUSDT';
let currentTimeframe = '60';
let currentExchange = 'bybit';
let candlesData = [];
let backtestTrades = [];
let strategiesList = [];

// ============================================
// Chart Initialization (Lightweight Charts)
// ============================================

function initializeChart() {
  const chartContainer = document.getElementById('mainChart');
  
  // Create chart
  chart = LightweightCharts.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    layout: {
      background: { color: '#0a0a1a' },
      textColor: '#a0a0c0',
    },
    grid: {
      vertLines: { color: '#1a1a35' },
      horzLines: { color: '#1a1a35' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: '#1a1a35',
    },
    timeScale: {
      borderColor: '#1a1a35',
      timeVisible: true,
    },
  });

  // Create candlestick series
  candlestickSeries = chart.addCandlestickSeries({
    upColor: '#00ff88',
    downColor: '#ff3366',
    borderVisible: false,
    wickUpColor: '#00ff88',
    wickDownColor: '#ff3366',
  });

  // Create equity curve series (on separate pane)
  equitySeries = chart.addLineSeries({
    color: '#5af3ff',
    lineWidth: 2,
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01,
    },
    priceScaleId: 'equity',
    title: 'Equity',
  });

  // Create confidence overlay (area series)
  confidenceSeries = chart.addAreaSeries({
    color: 'rgba(170, 85, 255, 0.2)',
    lineColor: '#aa55ff',
    lineWidth: 1,
    priceScaleId: 'confidence',
    title: 'AI Confidence',
  });

  // Configure price scales
  chart.priceScale('equity').applyOptions({
    scaleMargins: {
      top: 0.1,
      bottom: 0.1,
    },
  });

  chart.priceScale('confidence').applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0.1,
    },
  });

  // Handle resize
  window.addEventListener('resize', () => {
    chart.applyOptions({
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
    });
  });

  // Load initial data
  loadCandles();
  loadStrategies();
}

// ============================================
// Data Loading
// ============================================

async function loadCandles() {
  try {
    const response = await fetch(`/api/candles?symbol=${currentSymbol}&interval=${currentTimeframe}&limit=500&exchange=${currentExchange}`);
    const data = await response.json();
    
    if (data.candles && data.candles.length > 0) {
      candlesData = data.candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      
      candlestickSeries.setData(candlesData);
      chart.timeScale().fitContent();
    }
  } catch (error) {
    console.error('Error loading candles:', error);
    addChatMessage('system', `Error loading candles: ${error.message}`);
  }
}

async function loadStrategies() {
  try {
    const response = await fetch('/api/strategies');
    const data = await response.json();
    
    if (data.strategies) {
      strategiesList = data.strategies;
      updateStrategiesUI();
    }
  } catch (error) {
    console.error('Error loading strategies:', error);
  }
}

function updateStrategiesUI() {
  const strategiesListEl = document.getElementById('strategies-list');
  const strategySelect = document.getElementById('strategy-select');
  
  // Clear existing
  strategiesListEl.innerHTML = '';
  strategySelect.innerHTML = '';
  
  // Add strategies
  Object.entries(strategiesList).forEach(([key, strategy]) => {
    // Add to sidebar list
    const li = document.createElement('li');
    li.className = `strategy-item ${key === currentStrategy ? 'active' : ''}`;
    li.dataset.strategy = key;
    li.innerHTML = `
      <div class="strategy-info">
        <span class="strategy-name">${strategy.name}</span>
        <span class="strategy-status" title="${strategy.available ? 'Available' : 'Not implemented'}">
          ${strategy.available ? '●' : '○'}
        </span>
      </div>
      <div class="strategy-actions">
        <button class="strategy-btn backtest" data-strategy="${key}" title="Run Backtest">📊</button>
        <button class="strategy-btn compare" data-strategy="${key}" title="Compare">📈</button>
      </div>
    `;
    
    // Add tooltip
    if (strategy.description) {
      li.setAttribute('title', strategy.description);
    }
    
    strategiesListEl.appendChild(li);
    
    // Add to select dropdown
    const option = document.createElement('option');
    option.value = key;
    option.textContent = strategy.name;
    if (key === currentStrategy) {
      option.selected = true;
    }
    strategySelect.appendChild(option);
  });
  
  // Add event listeners
  document.querySelectorAll('.strategy-item').forEach(item => {
    item.addEventListener('click', () => {
      const strategyKey = item.dataset.strategy;
      selectStrategy(strategyKey);
    });
  });
  
  document.querySelectorAll('.strategy-btn.backtest').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const strategyKey = btn.dataset.strategy;
      runBacktest(strategyKey);
    });
  });
}

// ============================================
// Backtest Functions
// ============================================

async function runBacktest(strategy = null) {
  const strategyToUse = strategy || currentStrategy;
  // Map frontend strategy name to backend name
  const backendStrategy = strategyNameMap[strategyToUse] || strategyToUse;
  const riskPerTrade = parseFloat(document.getElementById('risk-usd').value) || 100;
  const rrRatio = parseFloat(document.getElementById('rr-ratio').value) || 4.0;
  
  addChatMessage('system', `Running backtest for ${strategiesList[strategyToUse]?.name || strategyToUse}...`);
  
  try {
    const params = new URLSearchParams({
      symbol: currentSymbol,
      interval: currentTimeframe,
      strategy: backendStrategy,
      risk_per_trade: riskPerTrade,
      rr_ratio: rrRatio,
      limit: 500,
    });
    
    const response = await fetch(`/api/backtest/run?${params}`);
    const result = await response.json();
    
    if (result.error) {
      addChatMessage('system', `Backtest error: ${result.error}`);
      return;
    }
    
    // Store trades
    backtestTrades = result.trades || [];
    
    // Update chart with trades
    updateChartWithTrades(backtestTrades);
    
    // Update equity curve
    if (result.equity_curve) {
      updateEquityCurve(result.equity_curve);
    }
    
    // Display statistics
    displayBacktestStats(result.summary || {});
    
    // Display trades table
    displayTradesTable(backtestTrades);
    
    // Add signals for trades
    backtestTrades.forEach(trade => {
      addSignal('bt', `Trade: ${trade.result_R > 0 ? 'WIN' : 'LOSS'} ${trade.result_R.toFixed(2)}R @ ${trade.entry_price?.toFixed(2) || 'N/A'}`);
    });
    
    addChatMessage('ai', `Backtest completed! Total trades: ${backtestTrades.length}, Return: ${result.summary?.pnl_% || 0}%`);
    
  } catch (error) {
    console.error('Backtest error:', error);
    addChatMessage('system', `Backtest failed: ${error.message}`);
  }
}

function updateChartWithTrades(trades) {
  if (!candlestickSeries || !trades || trades.length === 0) return;
  
  // Add markers for entry, stop, and take profit
  const markers = [];
  
  trades.forEach(trade => {
    const entryTime = parseTime(trade.entry_time);
    if (!entryTime) return;
    
    // Entry marker
    markers.push({
      time: entryTime,
      position: 'belowBar',
      color: trade.result_R > 0 ? '#00ff88' : '#ff3366',
      shape: 'arrowUp',
      text: `Entry ${trade.entry_price?.toFixed(2) || ''}`,
    });
    
    // Stop loss line (horizontal)
    if (trade.stop) {
      candlestickSeries.createPriceLine({
        price: trade.stop,
        color: '#ff3366',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Stop',
      });
    }
    
    // Take profit line (horizontal)
    if (trade.tp) {
      candlestickSeries.createPriceLine({
        price: trade.tp,
        color: '#00ff88',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'TP',
      });
    }
  });
  
  candlestickSeries.setMarkers(markers);
}

function updateEquityCurve(equityCurve) {
  if (!equitySeries || !equityCurve || equityCurve.length === 0) return;
  
  const initialEquity = equityCurve[0];
  const equityData = equityCurve.map((equity, index) => {
    // Use corresponding candle time if available
    const time = candlesData[index]?.time || (Date.now() / 1000) + index;
    return {
      time: time,
      value: equity,
    };
  });
  
  equitySeries.setData(equityData);
}

function displayBacktestStats(summary) {
  const statsEl = document.getElementById('chart-stats');
  
  if (!summary || Object.keys(summary).length === 0) {
    statsEl.innerHTML = '';
    return;
  }
  
  // Calculate additional metrics
  const winRate = summary.winrate || 0;
  const totalTrades = summary.total_trades || 0;
  const winningTrades = summary.winning_trades || 0;
  const losingTrades = summary.losing_trades || 0;
  const avgR = summary.avg_R || 0;
  const maxDD = summary.max_dd || 0;
  const pnlPct = summary.pnl_% || 0;
  const sharpe = summary.sharpe || 0;
  const totalPnlUsd = summary.total_pnl_usd || 0;
  
  statsEl.innerHTML = `
    <div class="stat-card">
      <h4>📊 Key Metrics</h4>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-label" title="Total return percentage">Total Return:</span>
          <span class="stat-value ${pnlPct >= 0 ? 'positive' : 'negative'}">
            ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Total P&L in USD">Total P&L:</span>
          <span class="stat-value ${totalPnlUsd >= 0 ? 'positive' : 'negative'}">
            ${totalPnlUsd >= 0 ? '+' : ''}$${totalPnlUsd.toFixed(2)}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Total number of trades">Total Trades:</span>
          <span class="stat-value">${totalTrades}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Percentage of winning trades">Win Rate:</span>
          <span class="stat-value">${winRate.toFixed(1)}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Winning trades count">Wins:</span>
          <span class="stat-value positive">${winningTrades}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Losing trades count">Losses:</span>
          <span class="stat-value negative">${losingTrades}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Average R-multiple per trade">Avg R:</span>
          <span class="stat-value ${avgR >= 0 ? 'positive' : 'negative'}">
            ${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Maximum drawdown percentage">Max Drawdown:</span>
          <span class="stat-value negative">${maxDD.toFixed(2)}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label" title="Sharpe ratio (risk-adjusted return)">Sharpe Ratio:</span>
          <span class="stat-value">${sharpe.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}

function displayTradesTable(trades) {
  const tradesContent = document.getElementById('trades-content');
  
  if (!trades || trades.length === 0) {
    tradesContent.innerHTML = '<p class="no-trades">No trades yet. Run a backtest to see trades.</p>';
    return;
  }
  
  // Sort trades by entry time (newest first)
  const sortedTrades = [...trades].sort((a, b) => {
    const timeA = parseTime(a.entry_time) || 0;
    const timeB = parseTime(b.entry_time) || 0;
    return timeB - timeA;
  });
  
  const tableHTML = `
    <table class="trades-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Entry</th>
          <th>SL</th>
          <th>TP</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${sortedTrades.map(trade => {
          const entryTime = trade.entry_time ? new Date(trade.entry_time).toLocaleString() : 'N/A';
          const resultR = trade.result_R || 0;
          const resultClass = resultR > 0 ? 'positive' : resultR < 0 ? 'negative' : '';
          const resultText = resultR > 0 ? `+${resultR.toFixed(2)}R` : `${resultR.toFixed(2)}R`;
          
          return `
            <tr class="trade-row ${resultClass}" data-entry-time="${trade.entry_time}">
              <td>${entryTime}</td>
              <td>${trade.entry_price?.toFixed(2) || 'N/A'}</td>
              <td>${trade.stop?.toFixed(2) || 'N/A'}</td>
              <td>${trade.tp?.toFixed(2) || 'N/A'}</td>
              <td class="${resultClass}">${resultText}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  tradesContent.innerHTML = tableHTML;
  
  // Add hover effect to highlight trades on chart
  document.querySelectorAll('.trade-row').forEach(row => {
    row.addEventListener('mouseenter', () => {
      const entryTime = row.dataset.entryTime;
      // Could highlight corresponding marker on chart here
    });
  });
}

function parseTime(timeValue) {
  if (!timeValue) return null;
  
  // If it's a number (timestamp)
  if (typeof timeValue === 'number') {
    return timeValue;
  }
  
  // If it's a string ISO format
  if (typeof timeValue === 'string') {
    const date = new Date(timeValue);
    return Math.floor(date.getTime() / 1000);
  }
  
  return null;
}

// ============================================
// Strategy Selection
// ============================================

function selectStrategy(strategyKey) {
  currentStrategy = strategyKey;
  
  // Update UI
  document.querySelectorAll('.strategy-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.strategy === strategyKey) {
      item.classList.add('active');
    }
  });
  
  // Update select
  const strategySelect = document.getElementById('strategy-select');
  strategySelect.value = strategyKey;
  
  // Update header
  const strategyName = strategiesList[strategyKey]?.name || strategyKey;
  document.getElementById('current-strategy').textContent = strategyName;
  
  addChatMessage('system', `Strategy changed to: ${strategyName}`);
}

// ============================================
// WebSocket Connections
// ============================================

function connectWebSockets() {
  connectAIWebSocket();
  connectTradesWebSocket();
}

function connectAIWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/ai`;
  
  wsAI = new WebSocket(wsUrl);
  
  wsAI.onopen = () => {
    console.log('✅ AI WebSocket connected');
    updateConnectionStatus(true);
    addChatMessage('system', 'Toni AI connected. Ready to chat.');
  };
  
  wsAI.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleAIMessage(data);
    } catch (error) {
      console.error('Error parsing AI message:', error);
    }
  };
  
  wsAI.onerror = (error) => {
    console.error('AI WebSocket error:', error);
    addChatMessage('system', 'WebSocket error occurred.');
  };
  
  wsAI.onclose = () => {
    console.log('🔴 AI WebSocket disconnected');
    updateConnectionStatus(false);
    addChatMessage('system', 'AI WebSocket disconnected. Reconnecting...');
    setTimeout(connectAIWebSocket, 3000);
  };
}

function connectTradesWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/trades`;
  
  wsTrades = new WebSocket(wsUrl);
  
  wsTrades.onopen = () => {
    console.log('✅ Trades WebSocket connected');
    updateConnectionStatus(true);
  };
  
  wsTrades.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleTradeSignal(data);
    } catch (error) {
      console.error('Error parsing trade message:', error);
    }
  };
  
  wsTrades.onerror = (error) => {
    console.error('Trades WebSocket error:', error);
  };
  
  wsTrades.onclose = () => {
    console.log('🔴 Trades WebSocket disconnected');
    setTimeout(connectTradesWebSocket, 3000);
  };
}

// ============================================
// Message Handlers
// ============================================

function handleAIMessage(data) {
  if (data.type === 'message' || data.type === 'response') {
    addChatMessage('ai', data.message || data.text || JSON.stringify(data));
  } else if (data.type === 'data' || data.type === 'update') {
    if (data.payload) {
      updateMetrics(data.payload);
      updateMLConfidence(data.payload.confidence);
    }
  } else if (data.type === 'system') {
    addChatMessage('system', data.message || data.text);
  }
}

function handleTradeSignal(data) {
  if (data.type === 'trade' || data.side) {
    addSignal('trade', `[TRADE] ${data.side?.toUpperCase()} ${data.symbol || 'BTCUSDT'} @ ${data.price?.toFixed(2) || 'N/A'}`);
    
    // Update equity if provided
    if (data.equity !== undefined) {
      updateEquity(data.equity);
    }
  } else if (data.type === 'signal') {
    addSignal('new', data.message || JSON.stringify(data));
  }
}

function updateMLConfidence(confidence) {
  if (!confidenceSeries || confidence === undefined) return;
  
  // Update confidence overlay (simplified - would need time series in production)
  const currentTime = Math.floor(Date.now() / 1000);
  confidenceSeries.update({
    time: currentTime,
    value: confidence,
  });
}

// ============================================
// UI Updates
// ============================================

function updateConnectionStatus(connected) {
  const statusIndicator = document.getElementById('connection-status');
  const statusText = statusIndicator.querySelector('.status-text');
  
  if (connected) {
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Connected';
  } else {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected';
  }
}

function updateMetrics(payload) {
  if (payload.pnl !== undefined) {
    const pnlElement = document.getElementById('current-pnl');
    const pnlValue = payload.pnl;
    pnlElement.textContent = `${pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)}%`;
    pnlElement.className = `info-value pnl ${pnlValue >= 0 ? 'positive' : 'negative'}`;
  }
}

function updateEquity(newEquity) {
  // Update equity curve if needed
  if (equitySeries) {
    const currentTime = Math.floor(Date.now() / 1000);
    equitySeries.update({
      time: currentTime,
      value: newEquity,
    });
  }
}

function addSignal(type, message) {
  const signalsList = document.getElementById('signals-list');
  const signalCount = document.getElementById('signal-count');
  
  const signalItem = document.createElement('div');
  signalItem.className = `signal-item ${type}`;
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  signalItem.innerHTML = `
    <div class="signal-header">
      <span class="signal-type">${type.toUpperCase()}</span>
      <span class="signal-time">${timeStr}</span>
    </div>
    <div class="signal-text">${message}</div>
  `;
  
  signalsList.insertBefore(signalItem, signalsList.firstChild);
  
  // Update count
  const count = signalsList.children.length;
  signalCount.textContent = count;
  
  // Limit to 20 signals
  if (signalsList.children.length > 20) {
    signalsList.removeChild(signalsList.lastChild);
  }
  
  // Auto-scroll
  signalsList.scrollTop = 0;
}

function addChatMessage(author, text) {
  const chatLog = document.getElementById('chat-log');
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${author}`;
  messageDiv.innerHTML = `
    <span class="chat-time">${timeStr}</span>
    <span class="chat-author">${author === 'user' ? 'You' : author === 'ai' ? 'Toni' : 'System'}:</span>
    <span class="chat-text">${text}</span>
  `;
  
  chatLog.appendChild(messageDiv);
  
  // Remove old messages (keep last 50)
  while (chatLog.children.length > 50) {
    chatLog.removeChild(chatLog.firstChild);
  }
  
  // Auto-scroll
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ============================================
// Event Handlers
// ============================================

function setupEventHandlers() {
  // Run/Pause buttons
  document.getElementById('run-btn').addEventListener('click', () => {
    isRunning = true;
    document.getElementById('run-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;
    addChatMessage('system', 'Trading started.');
  });
  
  document.getElementById('pause-btn').addEventListener('click', () => {
    isRunning = false;
    document.getElementById('run-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    addChatMessage('system', 'Trading paused.');
  });
  
  // Chart controls
  document.getElementById('symbol-select').addEventListener('change', (e) => {
    currentSymbol = e.target.value;
    document.getElementById('current-symbol').textContent = currentSymbol;
    loadCandles();
    addChatMessage('system', `Symbol changed to: ${currentSymbol}`);
  });
  
  document.getElementById('timeframe-select').addEventListener('change', (e) => {
    currentTimeframe = e.target.value;
    document.getElementById('current-timeframe').textContent = `${currentTimeframe}m`;
    loadCandles();
    addChatMessage('system', `Timeframe changed to: ${currentTimeframe}m`);
  });
  
  document.getElementById('strategy-select').addEventListener('change', (e) => {
    selectStrategy(e.target.value);
  });
  
  // Data source selector
  document.getElementById('data-source-select').addEventListener('change', (e) => {
    const source = e.target.value;
    const exchangeGroup = document.getElementById('exchange-group');
    const csvGroup = document.getElementById('csv-group');
    
    if (source === 'csv') {
      exchangeGroup.style.display = 'none';
      csvGroup.style.display = 'block';
    } else {
      exchangeGroup.style.display = 'block';
      csvGroup.style.display = 'none';
    }
  });
  
  // Exchange selector
  document.getElementById('exchange-select').addEventListener('change', (e) => {
    currentExchange = e.target.value;
    loadCandles(); // Reload candles with new exchange
    addChatMessage('system', `Exchange changed to: ${currentExchange}`);
  });
  
  // CSV upload
  document.getElementById('upload-csv-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
      addChatMessage('system', 'Please select a CSV file first');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      addChatMessage('system', 'Uploading CSV file...');
      const response = await fetch('/api/data/upload-csv', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.message) {
        addChatMessage('system', `${data.message} (${data.rows} rows)`);
        loadCandles(); // Reload with CSV data
      } else {
        addChatMessage('system', `Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      addChatMessage('system', 'Failed to upload CSV file');
    }
  });
  
  document.getElementById('mode-select').addEventListener('change', (e) => {
    isLiveMode = e.target.value === 'live';
    document.getElementById('current-mode').textContent = isLiveMode ? 'Live' : 'Backtest';
    addChatMessage('system', `Mode changed to: ${isLiveMode ? 'Live (Testnet)' : 'Backtest'}`);
  });
  
  // Run backtest button
  document.getElementById('run-backtest-btn').addEventListener('click', () => {
    runBacktest();
  });
  
  // Signals panel
  document.getElementById('close-signals-btn').addEventListener('click', () => {
    document.getElementById('signals-panel').style.display = 'none';
    document.querySelector('.grid-container').style.gridTemplateColumns = '260px 1fr';
  });
  
  document.getElementById('clear-signals-btn').addEventListener('click', () => {
    document.getElementById('signals-list').innerHTML = '';
    document.getElementById('signal-count').textContent = '0';
  });
  
  // AI Chat
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  
  async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addChatMessage('user', message);
    
    // Build context
    const context = {
      strategy: currentStrategy,
      symbol: currentSymbol,
      timeframe: currentTimeframe,
      is_live_mode: isLiveMode,
      last_backtest: backtestTrades.length > 0 ? {
        trades_count: backtestTrades.length,
        summary: {} // Will be populated from last backtest result
      } : null
    };
    
    // Try WebSocket first, fallback to REST API
    if (wsAI && wsAI.readyState === WebSocket.OPEN) {
      // Send to WebSocket with context
      wsAI.send(JSON.stringify({
        type: 'message',
        text: message,
        strategy: currentStrategy,
        symbol: currentSymbol,
        timeframe: currentTimeframe,
        mode: isLiveMode ? 'live' : 'backtest',
        timestamp: Date.now()
      }));
    } else {
      // Fallback to REST API
      try {
        addChatMessage('system', 'Toni is thinking...');
        const response = await fetch('/api/toni/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: message,
            context: context
          })
        });
        
        const data = await response.json();
        if (data.answer) {
          addChatMessage('ai', data.answer);
        } else {
          addChatMessage('system', 'Toni is currently unavailable. Please try again later.');
        }
      } catch (error) {
        console.error('Error asking Toni:', error);
        addChatMessage('system', 'Failed to get response from Toni. Please try again.');
      }
    }
    
    chatInput.value = '';
  }
  
  sendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
  
  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    addChatMessage('system', 'Settings panel (coming soon)');
  });
  
  // New strategy button
  document.getElementById('new-strategy-btn').addEventListener('click', () => {
    addChatMessage('system', 'New strategy creation (coming soon)');
  });
  
  // Resume trading button
  document.getElementById('resume-trading-btn').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/risk/resume', { method: 'POST' });
      const data = await response.json();
      if (data.message) {
        addChatMessage('system', data.message);
        updateRiskStatus(data.status);
      }
    } catch (error) {
      console.error('Error resuming trading:', error);
      addChatMessage('system', 'Failed to resume trading');
    }
  });
  
  // Load risk status on init
  loadRiskStatus();
  setInterval(loadRiskStatus, 5000); // Update every 5 seconds
}

async function loadRiskStatus() {
  try {
    const response = await fetch('/api/risk/status');
    const status = await response.json();
    updateRiskStatus(status);
  } catch (error) {
    console.error('Error loading risk status:', error);
  }
}

function updateRiskStatus(status) {
  const statusValue = document.getElementById('risk-status-value');
  const positions = document.getElementById('risk-positions');
  const drawdown = document.getElementById('risk-drawdown');
  const dailyLoss = document.getElementById('risk-daily-loss');
  const resumeBtn = document.getElementById('resume-trading-btn');
  
  if (!status) return;
  
  // Update status
  statusValue.textContent = status.status || 'Safe';
  statusValue.className = `risk-value risk-${status.status || 'safe'}`;
  
  // Update positions
  positions.textContent = `${status.open_positions || 0}/${status.max_positions || 5}`;
  
  // Update drawdown
  drawdown.textContent = `${status.current_drawdown?.toFixed(2) || '0.00'}%`;
  drawdown.className = `risk-value ${status.current_drawdown > 15 ? 'risk-warning' : ''}`;
  
  // Update daily loss
  dailyLoss.textContent = `${status.daily_loss_percent?.toFixed(2) || '0.00'}%`;
  dailyLoss.className = `risk-value ${status.daily_loss_percent > 3 ? 'risk-warning' : ''}`;
  
  // Show resume button if trading is paused
  if (status.is_trading_paused) {
    resumeBtn.style.display = 'block';
  } else {
    resumeBtn.style.display = 'none';
  }
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 CryptoBot Pro v8.0 - Trading Core initializing...');
  
  initializeChart();
  setupEventHandlers();
  connectWebSockets();
  
  // Initial pause state
  document.getElementById('pause-btn').disabled = true;
  
  console.log('✅ Trading Core initialized');
});
