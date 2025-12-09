"use strict";

/**
 * AI Predictor Module
 * Provides market predictions and analysis
 */

const API_BASE = "/api";

export class AIPredictor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentSymbol = "BTCUSDT";
        this.currentTimeframe = "15m";
        this.prediction = null;
        
        if (!this.container) {
            console.warn(`[CBP AI Predictor] Container ${containerId} not found`);
            return;
        }
        
        this.init();
    }
    
    init() {
        this.loadPrediction();
        // Auto-refresh every 30 seconds
        setInterval(() => this.loadPrediction(), 30000);
    }
    
    setSymbol(symbol) {
        this.currentSymbol = symbol;
        this.loadPrediction();
    }
    
    setTimeframe(timeframe) {
        this.currentTimeframe = timeframe;
        this.loadPrediction();
    }
    
    async loadPrediction() {
        try {
            const response = await fetch(
                `${API_BASE}/ai/predict?symbol=${this.currentSymbol}&timeframe=${this.currentTimeframe}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.prediction = data;
            this.updateDisplay();
        } catch (error) {
            console.error("[CBP AI Predictor] Failed to load prediction:", error);
            // Show placeholder
            this.prediction = {
                price_target: null,
                price_change: null,
                signal_strength: 0,
                sentiment: "Ожидание данных...",
                support: null,
                resistance: null
            };
            this.updateDisplay();
        }
    }
    
    updateDisplay() {
        if (!this.container || !this.prediction) return;
        
        // Display will be handled by Alpine.js in the template
        // This module just loads the data
    }
    
    getPrediction() {
        return this.prediction;
    }
}

