const listeners = new Set();

export const dashboardState = {
  mode: "real", // "real" | "test" | "backtest"
  exchange: "bybit",
  symbol: "BTCUSDT",
  timeframe: "15m",
  riskProfile: "normal",
  wsStatus: {
    trades: "disconnected",
    ai: "disconnected",
    legacy: "disconnected"
  },
  metrics: {
    equity: 10000,
    pnlPercent: 0,
    riskLevel: "--",
    confidence: null
  },
  chartContainer: null,
  chart: null,
  series: {
    candles: null,
    volume: null
  },
  tradeMarkers: [],
  aiData: {
    confidence: null,
    risk_level: "Unknown",
    summary: "Ожидание данных AI...",
    action: "",
    strategy_comment: "",
    lastUpdated: null
  },
  // Snapshot fields
  balance: null,
  dailyPnlPct: null,
  totalProfit: null,
  winratePct: null,
  activePositions: null,
  riskLevelPct: null,
  candles: [],
  aiSignals: [],
  setSnapshot(snapshot) {
    this.symbol = snapshot.symbol;
    this.timeframe = snapshot.timeframe;
    this.balance = snapshot.balance;
    this.dailyPnlPct = snapshot.daily_pnl_pct;
    this.totalProfit = snapshot.total_profit;
    this.winratePct = snapshot.winrate_pct;
    this.activePositions = snapshot.active_positions;
    this.riskLevelPct = snapshot.risk_level_pct;
    this.candles = snapshot.candles || [];
    this.aiSignals = snapshot.ai_signals || [];
    notify();
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("cbp:dashboard_update", { detail: { snapshot } })
        );
      } catch (err) {
        console.error("State event dispatch error", err);
      }
    }
  },
  setMode(newMode) {
    if (["real", "test", "backtest"].includes(newMode)) {
      this.mode = newMode;
      notify();
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(
            new CustomEvent("cbp:mode_changed", { detail: { mode: newMode } })
          );
        } catch (err) {
          console.error("Mode change event dispatch error", err);
        }
      }
    }
  }
};

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(dashboardState);
    } catch (err) {
      console.error("State subscriber error", err);
    }
  });
}

export function subscribeToState(listener) {
  listeners.add(listener);
  listener(dashboardState);
  return () => listeners.delete(listener);
}

export function updateDashboardState(patch) {
  if (patch.mode !== undefined) {
    dashboardState.setMode(patch.mode);
    delete patch.mode;
  }
  Object.assign(dashboardState, patch);
  notify();
}

export function setExchange(newExchange) {
  dashboardState.exchange = newExchange;
  console.log("[CBP State] exchange ->", newExchange);
  notify();
}

export function setTimeframe(newTimeframe) {
  dashboardState.timeframe = newTimeframe;
  console.log("[CBP State] timeframe ->", newTimeframe);
  notify();
}

export function setRiskProfile(profile) {
  dashboardState.riskProfile = profile;
  console.log("[CBP State] riskProfile ->", profile);
  notify();
}

export function setMode(mode) {
  dashboardState.setMode(mode);
}

export function updateMetrics(patch) {
  dashboardState.metrics = { ...dashboardState.metrics, ...patch };
  notify();
}

export function updateAiData(patch) {
  dashboardState.aiData = {
    ...dashboardState.aiData,
    ...patch,
    lastUpdated: Date.now()
  };
  notify();
}

export function setWsStatus(channel, status) {
  dashboardState.wsStatus = {
    ...dashboardState.wsStatus,
    [channel]: status
  };
  notify();
}
