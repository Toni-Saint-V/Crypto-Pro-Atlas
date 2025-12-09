"use strict";

import { dashboardState } from "./cbp_state.js";

let chart = null;
let candleSeries = null;
let volumeSeries = null;
let tradeMarkers = [];
let tooltipElement = null;

const API_BASE = "/api";

// Топ 10 криптовалют
export const TOP_CRYPTOS = [
    { value: "BTCUSDT", label: "BTC/USDT" },
    { value: "ETHUSDT", label: "ETH/USDT" },
    { value: "BNBUSDT", label: "BNB/USDT" },
    { value: "SOLUSDT", label: "SOL/USDT" },
    { value: "XRPUSDT", label: "XRP/USDT" },
    { value: "ADAUSDT", label: "ADA/USDT" },
    { value: "DOGEUSDT", label: "DOGE/USDT" },
    { value: "TRXUSDT", label: "TRX/USDT" },
    { value: "DOTUSDT", label: "DOT/USDT" },
    { value: "MATICUSDT", label: "MATIC/USDT" }
];

export function initAdvancedChart() {
    const chartElement = document.getElementById("main-chart");
    if (!chartElement) {
        console.error("[CBP Advanced Chart] Chart element not found");
        return;
    }

    tooltipElement = document.getElementById("trade-tooltip");
    if (!tooltipElement) {
        console.error("[CBP Advanced Chart] Tooltip element not found");
    }

    chart = LightweightCharts.createChart(chartElement, {
        layout: {
            background: { type: 'solid', color: '#050811' },
            textColor: '#d0d4e4',
            fontSize: 12,
        },
        grid: {
            vertLines: { 
                color: 'rgba(255, 255, 255, 0.05)',
                style: 1,
            },
            horzLines: { 
                color: 'rgba(255, 255, 255, 0.05)',
                style: 1,
            },
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            timeVisible: true,
            secondsVisible: false,
        },
        crosshair: {
            mode: 1,
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
    });

    volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });

    // Обработка наведения на маркеры сделок
    chart.subscribeCrosshairMove((param) => {
        if (!tooltipElement) return;
        
        if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
            tooltipElement.classList.remove('visible');
            return;
        }

        // Найти ближайший маркер сделки
        const trade = findNearestTrade(param.time);
        if (trade) {
            showTradeTooltip(trade, param.point.x, param.point.y);
        } else {
            tooltipElement.classList.remove('visible');
        }
    });

    // Загрузка начальных данных
    loadChartData();
}

async function loadChartData(symbol = "BTCUSDT", timeframe = "15m", exchange = "bybit") {
    try {
        // Получаем свечи с бэкенда
        const params = new URLSearchParams({
            symbol: symbol,
            timeframe: timeframe,
            exchange: exchange,
            limit: "500"
        });

        const response = await fetch(`${API_BASE}/candles?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Failed to load candles: ${response.status}`);
        }

        const data = await response.json();
        const candles = data.candles || [];

        if (candles.length === 0) {
            console.warn("[CBP Advanced Chart] No candles received");
            return;
        }

        // Конвертируем данные для Lightweight Charts
        const chartData = candles.map(c => ({
            time: normalizeTime(c.time),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
        }));

        const volumeData = candles.map(c => ({
            time: normalizeTime(c.time),
            value: parseFloat(c.volume || 0),
            color: parseFloat(c.close) >= parseFloat(c.open) ? '#22c55e80' : '#ef444480',
        }));

        candleSeries.setData(chartData);
        volumeSeries.setData(volumeData);
        chart.timeScale().fitContent();

        // Загружаем сделки для отображения маркеров
        await loadTrades(symbol, timeframe);

        console.log(`[CBP Advanced Chart] Loaded ${chartData.length} candles`);
    } catch (error) {
        console.error("[CBP Advanced Chart] Failed to load chart data:", error);
        // Fallback: используем тестовые данные
        loadTestData();
    }
}

async function loadTrades(symbol, timeframe) {
    try {
        // Получаем сделки из бэктеста или реальных данных
        const response = await fetch(`${API_BASE}/dashboard/snapshot?symbol=${symbol}&timeframe=${timeframe}`);
        if (!response.ok) return;

        const snapshot = await response.json();
        const trades = snapshot.trades || [];

        // Очищаем старые маркеры
        clearTradeMarkers();

        // Добавляем маркеры для каждой сделки
        trades.forEach(trade => {
            addTradeMarker(trade);
        });
    } catch (error) {
        console.error("[CBP Advanced Chart] Failed to load trades:", error);
    }
}

function addTradeMarker(trade) {
    if (!candleSeries) return;

    const entryTime = normalizeTime(trade.entry_time || trade.time || trade.entry_timestamp);
    const exitTime = trade.exit_time ? normalizeTime(trade.exit_time) : null;
    const entryPrice = parseFloat(trade.entry_price || trade.price || trade.entry);
    const exitPrice = trade.exit_price ? parseFloat(trade.exit_price) : null;
    const side = (trade.side || trade.type || '').toLowerCase();

    // Маркер входа
    const entryMarker = {
        time: entryTime,
        position: side === 'buy' || side === 'long' ? 'belowBar' : 'aboveBar',
        color: side === 'buy' || side === 'long' ? '#22c55e' : '#ef4444',
        shape: side === 'buy' || side === 'long' ? 'arrowUp' : 'arrowDown',
        text: side === 'buy' || side === 'long' ? 'BUY' : 'SELL',
        size: 2,
    };

    tradeMarkers.push({ ...entryMarker, trade, type: 'entry' });

    // Маркер выхода (если есть)
    if (exitTime && exitPrice) {
        const exitMarker = {
            time: exitTime,
            position: side === 'buy' || side === 'long' ? 'aboveBar' : 'belowBar',
            color: side === 'buy' || side === 'long' ? '#10b981' : '#f59e0b',
            shape: side === 'buy' || side === 'long' ? 'arrowDown' : 'arrowUp',
            text: 'EXIT',
            size: 2,
        };
        tradeMarkers.push({ ...exitMarker, trade, type: 'exit' });
    }

    // Обновляем все маркеры на графике
    const markers = tradeMarkers.map(m => ({
        time: m.time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
        size: m.size,
    }));
    candleSeries.setMarkers(markers);
}

function clearTradeMarkers() {
    tradeMarkers = [];
    if (candleSeries) {
        candleSeries.setMarkers([]);
    }
}

function findNearestTrade(time) {
    if (!time || tradeMarkers.length === 0) return null;

    let nearest = null;
    let minDiff = Infinity;

    tradeMarkers.forEach(marker => {
        const diff = Math.abs(marker.time - time);
        if (diff < minDiff && diff < 900) { // В пределах 15 минут
            minDiff = diff;
            nearest = marker.trade;
        }
    });

    return nearest;
}

function showTradeTooltip(trade, x, y) {
    if (!tooltipElement) return;

    const side = (trade.side || trade.type || '').toLowerCase();
    const entryPrice = parseFloat(trade.entry_price || trade.price || trade.entry || 0);
    const exitPrice = trade.exit_price ? parseFloat(trade.exit_price) : null;
    
    // Вычисляем P/L
    let pnl = 0;
    let pnlPercent = 0;
    if (trade.pnl !== undefined) {
        pnl = parseFloat(trade.pnl);
    } else if (trade.result_R !== undefined) {
        // Если есть result_R, это результат в R-мультипликаторах
        pnl = parseFloat(trade.result_R) * (trade.risk_per_trade || 100);
    } else if (exitPrice && entryPrice) {
        const multiplier = side === 'buy' || side === 'long' ? 1 : -1;
        pnl = (exitPrice - entryPrice) * multiplier * (trade.size || 1);
        pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * multiplier;
    }

    const resultR = trade.result_R !== undefined ? parseFloat(trade.result_R).toFixed(2) : 'N/A';

    tooltipElement.innerHTML = `
        <div class="font-semibold mb-2">
            <span class="${side === 'buy' || side === 'long' ? 'text-green-400' : 'text-red-400'}">
                ${side === 'buy' || side === 'long' ? '🔼 ПОКУПКА' : '🔽 ПРОДАЖА'}
            </span>
        </div>
        <div class="text-xs space-y-1">
            <div><span class="text-gray-400">Вход:</span> <span class="font-semibold">$${entryPrice.toFixed(2)}</span></div>
            ${exitPrice ? `<div><span class="text-gray-400">Выход:</span> <span class="font-semibold">$${exitPrice.toFixed(2)}</span></div>` : ''}
            <div>
                <span class="text-gray-400">P/L:</span> 
                <span class="font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
                    ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} ${pnlPercent !== 0 ? `(${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)` : ''}
                </span>
            </div>
            <div><span class="text-gray-400">R:</span> <span class="font-semibold ${resultR >= 0 ? 'text-green-400' : 'text-red-400'}">${resultR}</span></div>
            ${trade.size ? `<div><span class="text-gray-400">Размер:</span> <span class="font-semibold">${trade.size}</span></div>` : ''}
            ${trade.entry_time ? `<div><span class="text-gray-400">Время входа:</span> <span class="font-semibold">${new Date(trade.entry_time * 1000).toLocaleString('ru-RU')}</span></div>` : ''}
            ${trade.exit_time ? `<div><span class="text-gray-400">Время выхода:</span> <span class="font-semibold">${new Date(trade.exit_time * 1000).toLocaleString('ru-RU')}</span></div>` : ''}
        </div>
    `;

    // Позиционирование тултипа
    const rect = tooltipElement.getBoundingClientRect();
    const chartRect = document.getElementById("main-chart").getBoundingClientRect();
    
    let tooltipX = x + chartRect.left;
    let tooltipY = y + chartRect.top - rect.height - 10;

    // Проверка границ
    if (tooltipX + rect.width > window.innerWidth) {
        tooltipX = window.innerWidth - rect.width - 10;
    }
    if (tooltipY < 0) {
        tooltipY = y + chartRect.top + 20;
    }

    tooltipElement.style.left = `${tooltipX}px`;
    tooltipElement.style.top = `${tooltipY}px`;
    tooltipElement.classList.add('visible');
}

function normalizeTime(time) {
    if (!time) {
        return Math.floor(Date.now() / 1000);
    }
    
    if (typeof time === 'string') {
        // ISO string or other date string
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
            return Math.floor(date.getTime() / 1000);
        }
        // Try parsing as timestamp string
        const num = parseFloat(time);
        if (!isNaN(num)) {
            return normalizeTime(num);
        }
    }
    
    if (typeof time === 'number') {
        // Если время в миллисекундах
        if (time > 1e12) {
            return Math.floor(time / 1000);
        }
        // Если время в секундах
        return time;
    }
    
    return Math.floor(Date.now() / 1000);
}

function loadTestData() {
    // Генерируем тестовые данные
    const data = [];
    const volumeData = [];
    let time = Math.floor(Date.now() / 1000) - 500 * 900;
    let price = 64000;

    for (let i = 0; i < 500; i++) {
        const change = (Math.random() - 0.5) * 200;
        price += change;
        const high = price + Math.random() * 100;
        const low = price - Math.random() * 100;
        const open = low + Math.random() * (high - low);
        const close = low + Math.random() * (high - low);

        data.push({
            time: time + i * 900,
            open,
            high,
            low,
            close
        });

        volumeData.push({
            time: time + i * 900,
            value: Math.random() * 1000,
            color: close >= open ? '#22c55e80' : '#ef444480',
        });
    }

    candleSeries.setData(data);
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();
}

// Экспортируем функцию для обновления графика
export async function updateChart(params) {
    if (!chart || !candleSeries) {
        initAdvancedChart();
        return;
    }

    const symbol = params?.symbol || dashboardState.symbol || "BTCUSDT";
    const timeframe = params?.timeframe || dashboardState.timeframe || "15m";
    const exchange = params?.exchange || dashboardState.exchange || "bybit";

    await loadChartData(symbol, timeframe, exchange);
    
    // Если переданы сделки из бэктеста, добавляем их на график
    if (params?.trades && Array.isArray(params.trades)) {
        clearTradeMarkers();
        params.trades.forEach(trade => {
            addTradeMarker(trade);
        });
    }
}

// Обработка изменения размера окна
window.addEventListener('resize', () => {
    if (chart) {
        chart.applyOptions({ width: document.getElementById("main-chart").clientWidth });
    }
});

// Инициализация при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdvancedChart);
} else {
    initAdvancedChart();
}

