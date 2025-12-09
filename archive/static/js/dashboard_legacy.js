// === CryptoBot Pro Dashboard Engine ===
// Version 1.0 — Neural Dashboard System

let socket;
const statusEl = document.getElementById("status");
const pnlEl = document.getElementById("pnl");
const riskEl = document.getElementById("risk");
const confEl = document.getElementById("confidence");
const timeEl = document.getElementById("time");
const logEl = document.getElementById("log");

// 🕒 Обновление времени
setInterval(() => {
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString();
}, 1000);

// 🔗 Подключение к WebSocket
function initWebSocket() {
  socket = new WebSocket("ws://localhost:8000/ws");
  socket.onopen = () => {
    statusEl.textContent = "🟢 Connected";
    log("Connection established");
  };
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      updateDashboard(data);
    } catch {
      log(event.data);
    }
  };
  socket.onclose = () => {
    statusEl.textContent = "🔴 Disconnected";
    log("Connection lost, retrying...");
    setTimeout(initWebSocket, 3000);
  };
}

function updateDashboard(data) {
  if (data.pnl !== undefined) pnlEl.textContent = `${data.pnl.toFixed(2)}%`;
  if (data.risk) riskEl.textContent = data.risk;
  if (data.confidence) confEl.textContent = `${data.confidence}%`;
}

function log(message) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.prepend(line);
}

// 🌈 Эффект “живого интерфейса” — плавная подсветка панелей
function initPanelGlow() {
  const panels = document.querySelectorAll(".panel");
  panels.forEach((panel) => {
    panel.addEventListener("mousemove", (e) => {
      const rect = panel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      panel.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(0,255,249,0.15), rgba(255,255,255,0.05))`;
    });
    panel.addEventListener("mouseleave", () => {
      panel.style.background = "rgba(255,255,255,0.07)";
    });
  });
}

// 🚀 Запуск
window.onload = () => {
  initWebSocket();
  initPanelGlow();
  log("Dashboard initialized");
};
