let chart = null;
let candleSeries = null;

function ensureChart() {
    const root = document.getElementById("chart-root");
    if (!root) return;

    root.innerHTML = "";

    chart = LightweightCharts.createChart(root, {
        width: root.clientWidth,
        height: root.clientHeight,
        layout: { background: { color: "#0f0f0f" }, textColor: "#ddd" },
        grid: { vertLines: { color: "#181818" }, horzLines: { color: "#181818" } }
    });

    candleSeries = chart.addCandlestickSeries();
}

async function loadCandles() {
    const symbol = document.getElementById("symbol").value;
    const tf = document.getElementById("tf").value;

    const r = await fetch(`/api/candles?symbol=${symbol}&tf=${tf}`);
    const j = await r.json();
    const data = j.data.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
    }));

    candleSeries.setData(data);
}

window.addEventListener("load", () => {
    ensureChart();
    loadCandles();
});
