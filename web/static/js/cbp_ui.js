import {
  dashboardState,
  subscribeToState,
  updateDashboardState,
  setExchange,
  setTimeframe,
  setRiskProfile
} from "./cbp_state.js";

let signalCounter = 0;

export function initUI() {
  const symbolSelect =
    document.getElementById("cbp-symbol-select") ||
    document.getElementById("symbol-select");
  if (symbolSelect) {
    symbolSelect.value = dashboardState.symbol;
    symbolSelect.addEventListener("change", (event) => {
      updateDashboardState({ symbol: event.target.value });
    });
  }

  const exchangeSelect =
    document.getElementById("cbp-exchange-select") ||
    document.getElementById("exchange-select");
  if (exchangeSelect) {
    exchangeSelect.value = dashboardState.exchange;
    exchangeSelect.addEventListener("change", (event) => {
      setExchange(event.target.value);
    });
  }

  const timeframeSelect =
    document.getElementById("cbp-timeframe-select") ||
    document.getElementById("timeframe-select");
  if (timeframeSelect) {
    timeframeSelect.value = dashboardState.timeframe;
    timeframeSelect.addEventListener("change", (event) => {
      setTimeframe(event.target.value);
    });
  }

  const riskSelect =
    document.getElementById("cbp-risk-select") ||
    document.getElementById("risk-select");
  if (riskSelect) {
    riskSelect.value = dashboardState.riskProfile;
    riskSelect.addEventListener("change", (event) => {
      setRiskProfile(event.target.value);
    });
  }

  const modeToggle = document.getElementById("mode-toggle");
  modeToggle?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    updateDashboardState({ mode: button.dataset.mode });
  });

  const quickTf = document.getElementById("quick-timeframe");
  quickTf?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tf]");
    if (!button) return;
    setTimeframe(button.dataset.tf);
    if (timeframeSelect) {
      timeframeSelect.value = button.dataset.tf;
    }
  });

  subscribeToState(render);
}

function render(state) {
  setText("mode-label", capitalize(state.mode));
  setText("chart-subtitle", `${state.exchange?.toUpperCase() ?? ""} · ${state.symbol} · ${state.timeframe}`);
  setText("ai-mode-label", capitalize(state.mode));
  const equityText = `${formatNumber(state.metrics.equity)} USDT`;
  setText("cbp-equity-value", equityText);
  setText("equity-value", equityText);
  const pnlText = formatPercent(state.metrics.pnlPercent);
  setText("cbp-pnl-value", pnlText);
  setText("pnl-value", pnlText);
  const confidenceText = formatPercent(state.metrics.confidence, true);
  setText("cbp-confidence-value", confidenceText);
  setText("confidence-value", confidenceText);
  setText("risk-value", state.metrics.riskLevel ?? "--");
  setText("ai-confidence", formatPercent(state.aiData.confidence, true));
  setText("ai-summary", state.aiData.summary ?? "");
  setText("ai-action", state.aiData.action ?? "");
  setText("ai-comment", state.aiData.strategy_comment ?? "");

  setText("ws-status", formatWsStatus(state.wsStatus));
  setText("trade-stream-status", state.wsStatus.trades === "connected" ? "online" : "offline");

  highlightButtons("[data-mode]", state.mode, "data-mode", "cbp-mode-btn--active");
  highlightButtons("[data-tf]", state.timeframe, "data-tf", "cbp-tf-btn--active");

  const exchangeSelect =
    document.getElementById("cbp-exchange-select") ||
    document.getElementById("exchange-select");
  if (exchangeSelect && exchangeSelect.value !== state.exchange) {
    exchangeSelect.value = state.exchange;
  }
  const timeframeSelect =
    document.getElementById("cbp-timeframe-select") ||
    document.getElementById("timeframe-select");
  if (timeframeSelect && timeframeSelect.value !== state.timeframe) {
    timeframeSelect.value = state.timeframe;
  }
  const riskSelect =
    document.getElementById("cbp-risk-select") ||
    document.getElementById("risk-select");
  if (riskSelect && riskSelect.value !== state.riskProfile) {
    riskSelect.value = state.riskProfile;
  }
}

function highlightButtons(selector, activeValue, attr, activeClass) {
  document.querySelectorAll(selector).forEach((button) => {
    if (button.getAttribute(attr) === activeValue) {
      button.classList.add(activeClass);
    } else {
      button.classList.remove(activeClass);
    }
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && typeof value !== "undefined" && value !== null) {
    el.textContent = value;
  }
}

function capitalize(value = "") {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPercent(value, allowNull = false) {
  if (value === null || typeof value === "undefined") {
    return allowNull ? "--%" : "0.00%";
  }
  const formatted = Number(value).toFixed(2);
  return `${formatted}%`;
}

function formatNumber(value) {
  const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  return formatter.format(Math.max(0, Number(value) || 0));
}

function formatWsStatus(status = {}) {
  return Object.entries(status)
    .map(([key, value]) => `${key}: ${value === "connected" ? "ok" : "off"}`)
    .join(" · ");
}

export function pushSignal(entry) {
  const container = document.getElementById("signals-feed");
  if (!container) return;
  if (signalCounter === 0) {
    container.innerHTML = "";
  }
  signalCounter += 1;
  setText("signal-count", String(signalCounter));

  const node = document.createElement("div");
  node.className = "cbp-signal-item";
  node.innerHTML = `
    <strong>${entry.title ?? "Signal"}</strong>
    <div class="cbp-signal-meta">${entry.meta ?? ""}</div>
  `;
  container.prepend(node);
  trimChildren(container, 10);
}

export function pushSystemLog(message) {
  const container = document.getElementById("system-log");
  if (!container) return;
  if (container.textContent?.includes("Журнал пуст")) {
    container.innerHTML = "";
  }
  const entry = document.createElement("div");
  entry.className = "cbp-log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  container.prepend(entry);
  trimChildren(container, 15);
}

function trimChildren(container, max) {
  while (container.children.length > max) {
    container.removeChild(container.lastChild);
  }
}
