// === CryptoBot Pro Backtest Simulation ===
// Version 1.0 — Equity Curve Animator

let backtestChart;
let running = false;
let interval;
const runBtn = document.getElementById("runBacktest");
const pauseBtn = document.getElementById("pauseBacktest");
const resetBtn = document.getElementById("resetBacktest");

const ctx = document.getElementById("backtestChart").getContext("2d");

const data = {
  labels: [],
  datasets: [{
    label: "Equity Curve",
    data: [],
    borderColor: "#00fff9",
    borderWidth: 2,
    fill: false,
    tension: 0.25
  }]
};

const config = {
  type: "line",
  data: data,
  options: {
    responsive: true,
    scales: {
      x: { display: false },
      y: {
        ticks: { color: "#00fff9" },
        grid: { color: "rgba(0,255,249,0.1)" }
      }
    },
    plugins: {
      legend: { display: false }
    }
  }
};

backtestChart = new Chart(ctx, config);

// 🎮 Симуляция данных
let tick = 0;
function simulateTick() {
  if (!running) return;
  tick++;
  const lastValue = data.datasets[0].data.slice(-1)[0] || 100;
  const change = (Math.random() - 0.5) * 2;
  const newValue = lastValue + change;
  data.labels.push(tick);
  data.datasets[0].data.push(newValue);
  if (data.labels.length > 200) {
    data.labels.shift();
    data.datasets[0].data.shift();
  }
  backtestChart.update();
}

// ▶ Запуск
runBtn.onclick = () => {
  if (!running) {
    running = true;
    interval = setInterval(simulateTick, 100);
  }
};

// ⏸ Пауза
pauseBtn.onclick = () => {
  running = false;
  clearInterval(interval);
};

// 🔄 Сброс
resetBtn.onclick = () => {
  running = false;
  clearInterval(interval);
  tick = 0;
  data.labels = [];
  data.datasets[0].data = [];
  backtestChart.update();
};

// 🧠 Автоматический старт
setTimeout(() => runBtn.click(), 1000);
