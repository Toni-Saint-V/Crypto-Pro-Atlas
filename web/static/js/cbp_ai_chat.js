"use strict";

const API_BASE = "/api";

export function initAIChat() {
    // Функция будет вызываться из Alpine.js компонента
    console.log("[CBP AI Chat] Initialized");
}

export async function sendAIMessage(message, context = {}) {
    try {
        const response = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                context: context,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.response || "Извините, не могу обработать запрос.";
    } catch (error) {
        console.error("[CBP AI Chat] Failed to send message:", error);
        return "Ошибка соединения с AI. Попробуйте позже.";
    }
}

export async function getAISignals(symbol = "BTCUSDT") {
    try {
        const response = await fetch(`${API_BASE}/ai/signals?symbol=${symbol}`);
        if (!response.ok) {
            throw new Error(`AI Signals API error: ${response.status}`);
        }

        const data = await response.json();
        return data.signals || [];
    } catch (error) {
        console.error("[CBP AI Chat] Failed to get signals:", error);
        return [];
    }
}

