// CryptoBot Pro — стабильный график (Lightweight Charts)
"use strict";

import { dashboardState } from "./cbp_state.js";
import { fetchDashboardSnapshot } from "./cbp_api.js";

const API_BASE = "/api";

let chart = null;
let candleSeries = null;
let chartContainer = null;
let resizeObserver = null;
let lastErrorText = "";
let isInitializing = false;

/**
 * Инициализация основного графика.
 * containerElement — div, куда рисуем график.
 */
export function initMainChart(containerElement) {
  console.log("[CBP Charts] initMainChart, container =", containerElement);

  if (!containerElement) {
    console.error("[CBP Charts] containerElement is null/undefined");
    return;
  }

  const LW = window.LightweightCharts;
  if (!LW || typeof LW.createChart !== "function") {
    console.error(
      "[CBP Charts] LightweightCharts.createChart is not available",
      window.LightweightCharts
    );
    containerElement.innerText = "Ошибка: библиотека графика не загрузилась";
    return;
  }

  // Очищаем контейнер на всякий случай
  containerElement.innerHTML = "";
  chartContainer = containerElement;

  // Создаём график
  const rect = containerElement.getBoundingClientRect();
  const width = rect.width || containerElement.clientWidth || 900;
  const height = rect.height || containerElement.clientHeight || 400;
  
  chart = LW.createChart(containerElement, {
    width: width,
    height: height,
    layout: {
      background: { type: "solid", color: "#050816" },
      textColor: "#d1d5db",
      fontSize: 12,
    },
    grid: {
      vertLines: { color: "rgba(255,255,255,0.04)" },
      horzLines: { color: "rgba(255,255,255,0.04)" },
    },
    rightPriceScale: {
      borderColor: "rgba(197,203,206,0.4)",
    },
    timeScale: {
      borderColor: "rgba(197,203,206,0.4)",
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: LW.CrosshairMode.Normal,
    },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: "#25C26E",
    downColor: "#FF5B5B",
    borderUpColor: "#25C26E",
    borderDownColor: "#FF5B5B",
    wickUpColor: "#25C26E",
    wickDownColor: "#FF5B5B",
  });

  // Setup resize observer for better performance
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  
  resizeObserver = new ResizeObserver((entries) => {
    if (!chart || !chartContainer) return;
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({
          width: width,
          height: height,
        });
      }
    }
  });
  
  resizeObserver.observe(containerElement);

  console.log("[CBP Charts] chart initialized OK");
}

/**
 * Автоинициализация графика по контейнеру #main-chart и загрузка данных.
 */
export function initChart() {
  if (isInitializing) {
    console.warn("[CBP Charts] Already initializing, skipping");
    return;
  }
  
  const container = document.getElementById("main-chart");
  if (!container) {
    console.error("[CBP Charts] #main-chart not found in DOM");
    return;
  }

  // Если график уже создан для этого контейнера, просто обновляем данные
  if (chart && candleSeries && chartContainer === container) {
    console.log("[CBP Charts] Chart already initialized, updating data");
    updateChart({
      symbol: dashboardState.symbol || "BTCUSDT",
      timeframe: dashboardState.timeframe || "15m",
      exchange: dashboardState.exchange || "bybit",
    }).catch((err) => {
      console.error("[CBP Charts] failed to bootstrap chart", err);
    });
    return;
  }

  isInitializing = true;
  
  try {
    initMainChart(container);
    
    // Wait a bit for chart to render, then load data
    setTimeout(() => {
      updateChart({
        symbol: dashboardState.symbol || "BTCUSDT",
        timeframe: dashboardState.timeframe || "15m",
        exchange: dashboardState.exchange || "bybit",
      }).catch((err) => {
        console.error("[CBP Charts] failed to bootstrap chart", err);
      }).finally(() => {
        isInitializing = false;
      });
    }, 100);
  } catch (error) {
    console.error("[CBP Charts] Error during initialization:", error);
    isInitializing = false;
  }
}

/**
 * Загрузка и обновление графика реальными свечами.
 * params: { symbol, timeframe, exchange, mode?, trades? }
 */
export async function updateChart(params = {}) {
  if (!chart || !candleSeries) {
    console.warn("[CBP Charts] Chart not initialized, calling initChart");
    initChart();
    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!chart || !candleSeries) {
      console.error("[CBP Charts] Chart still not initialized after retry");
      return;
    }
  }

  const symbol = params.symbol || dashboardState.symbol || "BTCUSDT";
  const timeframe = params.timeframe || dashboardState.timeframe || "15m";
  const exchange = params.exchange || dashboardState.exchange || "bybit";
  let trades = Array.isArray(params.trades) ? params.trades : [];

  try {
    let candles = normalizeCandles(dashboardState.candles);

    // Пытаемся взять свечи из снапшота, если их нет в состоянии
    if (!candles.length) {
      const snapshot = await tryLoadSnapshot(symbol, timeframe);
      if (snapshot) {
        candles = normalizeCandles(snapshot.candles);
        if (!trades.length && Array.isArray(snapshot.trades)) {
          trades = snapshot.trades;
        }
      }
    }

    // Если из снапшота не получили - грузим напрямую из /api/candles
    if (!candles.length) {
      candles = await fetchCandles({ symbol, timeframe, exchange });
    }

    if (!candles.length) {
      console.warn("[CBP Charts] No candles available, falling back to demo");
      candleSeries.setData(generateDemoCandles());
      candleSeries.setMarkers([]);
      renderError("");
      return;
    }

    candleSeries.setData(candles);
    chart.timeScale().fitContent();
    applyTradeMarkers(trades);
    renderError("");
    
    console.log(`[CBP Charts] Updated with ${candles.length} candles for ${symbol} ${timeframe}`);
  } catch (error) {
    console.error("[CBP Charts] Failed to update chart", error);
    renderError("Не удалось загрузить данные графика");
    // Fallback to demo data
    try {
      candleSeries.setData(generateDemoCandles());
      candleSeries.setMarkers([]);
    } catch (e) {
      console.error("[CBP Charts] Failed to set demo data", e);
    }
  }
}

async function tryLoadSnapshot(symbol, timeframe) {
  try {
    const snapshot = await fetchDashboardSnapshot({ symbol, timeframe });
    if (snapshot) {
      dashboardState.setSnapshot(snapshot);
    }
    return snapshot;
  } catch (error) {
    console.warn("[CBP Charts] snapshot request failed", error);
    return null;
  }
}

async function fetchCandles({ symbol, timeframe, exchange, limit = 500 }) {
  const params = new URLSearchParams({
    symbol: symbol || "BTCUSDT",
    timeframe: timeframe || "15m",
    exchange: exchange || "bybit",
    limit: String(limit),
  });

  const resp = await fetch(`${API_BASE}/candles?${params.toString()}`);
  if (!resp.ok) {
    throw new Error(`[CBP Charts] candles request failed: ${resp.status}`);
  }

  const data = await resp.json();
  return normalizeCandles(data?.candles || data || []);
}

function applyTradeMarkers(trades = []) {
  if (!candleSeries || !Array.isArray(trades) || !trades.length) {
    candleSeries?.setMarkers([]);
    return;
  }

  const markers = trades
    .map((trade) => {
      const side = (trade.side || trade.type || trade.direction || "").toLowerCase();
      const time = normalizeTime(
        trade.entry_time ??
          trade.time ??
          trade.timestamp ??
          trade.entry_timestamp
      );
      const isSell = side === "sell" || side === "short";
      if (!time) return null;
      return {
        time,
        position: isSell ? "aboveBar" : "belowBar",
        color: isSell ? "#f87171" : "#34d399",
        shape: isSell ? "arrowDown" : "arrowUp",
        text: isSell ? "SELL" : "BUY",
        size: 1,
      };
    })
    .filter(Boolean);

  candleSeries.setMarkers(markers);
}

function renderError(message) {
  if (!chartContainer) return;
  if (message === lastErrorText) return;
  lastErrorText = message || "";

  let node = chartContainer.querySelector("[data-cbp='chart-error']");
  if (!message) {
    node?.remove();
    return;
  }

  if (!node) {
    node = document.createElement("div");
    node.setAttribute("data-cbp", "chart-error");
    node.style.cssText = `
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 5;
      padding: 6px 10px;
      border-radius: 6px;
      background: rgba(239, 68, 68, 0.14);
      color: #fecdd3;
      font-size: 12px;
      pointer-events: none;
    `;
    chartContainer.appendChild(node);
  }

  node.textContent = message;
}

function normalizeCandles(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const open = toNumber(c.open);
      const high = toNumber(c.high);
      const low = toNumber(c.low);
      const close = toNumber(c.close);
      const time = normalizeTime(c.time);
      if (
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        time === null
      ) {
        return null;
      }
      return { time, open, high, low, close };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function normalizeTime(value) {
  if (value == null) return null;

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return normalizeTime(parsed);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : Math.floor(date.getTime() / 1000);
  }

  if (typeof value === "number") {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }

  return null;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Генерация демо-свечей (50 штук) чтобы график не был пустым.
 */
function generateDemoCandles() {
  const result = [];
  const now = Math.floor(Date.now() / 1000);
  let price = 40000;

  for (let i = 0; i < 50; i++) {
    const open = price;
    const delta = (Math.random() - 0.5) * 500;
    const close = open + delta;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;

    result.push({
      time: now - (50 - i) * 60, // шаг 1 мин
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
    });

    price = close;
  }

  return result;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}
