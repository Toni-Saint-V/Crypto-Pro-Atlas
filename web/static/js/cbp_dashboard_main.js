"use strict";

import { fetchDashboardSnapshot } from "./cbp_api.js";
import { dashboardState, setMode } from "./cbp_state.js";
import { initDashboardRealtime } from "./cbp_realtime.js";
import { initChart, updateChart } from "./cbp_charts.js";
import { TradeTicker } from "./cbp_ticker.js";
import { ParamsPanel } from "./cbp_params_panel.js";
import { AIPanel } from "./cbp_ai_panel.js";

let ticker = null;
let paramsPanel = null;
let aiPanel = null;
let bootstrapStarted = false;

if (typeof window !== "undefined") {
  window.__cbp_main_module_present = true;
}

function bindStaticUI() {
  const els = {
    balance: document.querySelector("[data-cbp='balance']"),
    dailyPnl: document.querySelector("[data-cbp='daily-pnl']"),
    totalProfit: document.querySelector("[data-cbp='total-profit']"),
    winrate: document.querySelector("[data-cbp='winrate']"),
    activePositions: document.querySelector("[data-cbp='active-positions']"),
    riskLevel: document.querySelector("[data-cbp='risk-level']"),
  };

  function renderSnapshot() {
    const s = dashboardState;
    if (els.balance && s.balance != null) {
      els.balance.textContent = `$${s.balance.toFixed(2)}`;
    }
    if (els.dailyPnl && s.dailyPnlPct != null) {
      const sign = s.dailyPnlPct >= 0 ? "+" : "";
      els.dailyPnl.textContent = `${sign}${s.dailyPnlPct.toFixed(2)}%`;
      if (s.dailyPnlPct >= 0) {
        els.dailyPnl.classList.remove("text-red-400");
        els.dailyPnl.classList.add("text-green-400");
      } else {
        els.dailyPnl.classList.remove("text-green-400");
        els.dailyPnl.classList.add("text-red-400");
      }
    }
    if (els.totalProfit && s.totalProfit != null) {
      els.totalProfit.textContent = `$${s.totalProfit.toFixed(2)}`;
    }
    if (els.winrate && s.winratePct != null) {
      els.winrate.textContent = `${s.winratePct.toFixed(1)}%`;
    }
    if (els.activePositions) {
      els.activePositions.textContent = String(s.activePositions ?? 0);
    }
    if (els.riskLevel && s.riskLevelPct != null) {
      els.riskLevel.textContent = `${s.riskLevelPct.toFixed(0)}%`;
      els.riskLevel.classList.remove("text-red-400", "text-yellow-400", "text-green-400");
      if (s.riskLevelPct > 70) {
        els.riskLevel.classList.add("text-red-400");
      } else if (s.riskLevelPct > 40) {
        els.riskLevel.classList.add("text-yellow-400");
      } else {
        els.riskLevel.classList.add("text-green-400");
      }
    }
  }

  renderSnapshot();
  window.addEventListener("cbp:dashboard_update", renderSnapshot);
  
  // Listen to mode changes
  window.addEventListener("cbp:mode_changed", (event) => {
    const mode = event.detail?.mode;
    if (mode) {
      dashboardState.setMode(mode);
    }
  });
}

async function bootstrap() {
  if (bootstrapStarted) {
    console.warn("[CBP] bootstrap already started");
    return;
  }
  bootstrapStarted = true;
  console.log("[CBP] Initializing dashboard...");
  
  try {
    // Initialize UI bindings
    bindStaticUI();
    
    // Initialize ticker
    ticker =
      (typeof window !== "undefined" && window.__cbp_fallback_ticker) ||
      new TradeTicker("trade-ticker");
    
    // Initialize params panel
    paramsPanel =
      (typeof window !== "undefined" && window.__cbp_fallback_params_panel) ||
      new ParamsPanel("params-panel");
    if (!paramsPanel.__cbp_dashboard_main_bound) {
      paramsPanel.__cbp_dashboard_main_bound = true;
      paramsPanel.onChange((key, value, allValues) => {
        console.log(`[CBP] Param changed: ${key} = ${value}`);
        // Update chart when params change
        const symbol = allValues.symbol || "BTCUSDT";
        const timeframe = allValues.timeframe || "15m";
        const exchange = allValues.exchange || "bybit";

        // Update dashboardState
        dashboardState.symbol = symbol;
        dashboardState.timeframe = timeframe;
        dashboardState.exchange = exchange;

        updateChart({
          symbol,
          timeframe,
          exchange,
        });

        // Reload dashboard data
        loadDashboardData(symbol, timeframe);
      });
    }
    
    // Initialize AI panel
    aiPanel =
      (typeof window !== "undefined" && window.__cbp_fallback_ai_panel) ||
      new AIPanel("ai-panel");
    publishGlobals();
    
    // Load initial data
    const symbol = paramsPanel.getValue('symbol') || 'BTCUSDT';
    const timeframe = paramsPanel.getValue('timeframe') || '15m';
    await loadDashboardData(symbol, timeframe);
    
    // Initialize chart
    setTimeout(() => {
      initChart();
      const symbol = paramsPanel.getValue('symbol') || 'BTCUSDT';
      const timeframe = paramsPanel.getValue('timeframe') || '15m';
      const exchange = paramsPanel.getValue('exchange') || 'bybit';
      updateChart({ symbol, timeframe, exchange });
    }, 200);
    
    // Setup WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;
    initDashboardRealtime({ wsUrl });
    
    // Periodic updates
    setInterval(async () => {
      const symbol = paramsPanel?.getValue('symbol') || 'BTCUSDT';
      const timeframe = paramsPanel?.getValue('timeframe') || '15m';
      await loadDashboardData(symbol, timeframe);
    }, 5000);
    
    console.log("[CBP] Dashboard initialized successfully");
    window.__cbp_main_bootstrapped = true;
    notifyReady();
  } catch (error) {
    console.error("[CBP] Failed to initialize dashboard:", error);
  }
}

async function loadDashboardData(symbol, timeframe) {
  try {
    const snapshot = await fetchDashboardSnapshot({ symbol, timeframe });
    dashboardState.setSnapshot(snapshot);
    
    // Update ticker with trades if available
    if (snapshot.trades && ticker) {
      ticker.setTrades(snapshot.trades);
    }
    
    console.log(`[CBP] Dashboard data loaded for ${symbol} ${timeframe}`);
  } catch (error) {
    console.error("[CBP] Failed to load dashboard data:", error);
  }
}

// Export for global access
function publishGlobals() {
  window.cbpDashboard = {
    get ticker() {
      return ticker;
    },
    get paramsPanel() {
      return paramsPanel;
    },
    get aiPanel() {
      return aiPanel;
    },
    loadDashboardData,
    initChart,
    updateChart,
  };
}
publishGlobals();

function notifyReady() {
  try {
    window.dispatchEvent(
      new CustomEvent("cbp:dashboard_ready", {
        detail: { ticker, paramsPanel, aiPanel },
      })
    );
  } catch (err) {
    console.error("[CBP] Failed to dispatch ready event", err);
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
