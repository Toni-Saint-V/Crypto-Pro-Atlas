"use strict";

/**
 * Ticker module for displaying scrolling trades/deals
 */
export class TradeTicker {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.trades = [];
        this.animationId = null;
        this.scrollPosition = 0;
        
        if (!this.container) {
            console.warn(`[CBP Ticker] Container ${containerId} not found`);
            return;
        }
        
        this.init();
    }
    
    init() {
        this.container.innerHTML = '<div class="ticker-content"></div>';
        this.contentEl = this.container.querySelector('.ticker-content');
        this.updateDisplay();
    }
    
    setTrades(trades) {
        this.trades = Array.isArray(trades) ? trades : [];
        this.updateDisplay();
    }
    
    addTrade(trade) {
        this.trades.push(trade);
        // Keep only last 50 trades
        if (this.trades.length > 50) {
            this.trades.shift();
        }
        this.updateDisplay();
    }
    
    formatTrade(trade) {
        const time = trade.entry_time || trade.time || Date.now();
        const timeStr = typeof time === 'number' 
            ? new Date(time * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            : new Date(time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        const symbol = trade.symbol || 'N/A';
        const side = trade.side || trade.direction || 'N/A';
        const sideLabel = side === 'buy' || side === 'long' ? '🔼 LONG' : '🔽 SHORT';
        const sideColor = side === 'buy' || side === 'long' ? '#22c55e' : '#ef4444';
        
        const size = trade.size || trade.quantity || 'N/A';
        const price = trade.entry_price || trade.price || 0;
        const priceStr = typeof price === 'number' ? `$${price.toFixed(2)}` : price;
        
        let pnlStr = '';
        if (trade.pnl !== undefined) {
            const pnl = parseFloat(trade.pnl);
            pnlStr = ` | P/L: <span style="color: ${pnl >= 0 ? '#22c55e' : '#ef4444'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>`;
        } else if (trade.result_R !== undefined) {
            const r = parseFloat(trade.result_R);
            pnlStr = ` | R: <span style="color: ${r >= 0 ? '#22c55e' : '#ef4444'}">${r >= 0 ? '+' : ''}${r.toFixed(2)}</span>`;
        }
        
        return `<span style="color: #8b949e">[${timeStr}]</span> <span style="font-weight: 600">${symbol}</span> <span style="color: ${sideColor}">${sideLabel}</span> Size: ${size} @ ${priceStr}${pnlStr}`;
    }
    
    updateDisplay() {
        if (!this.contentEl) return;
        
        if (this.trades.length === 0) {
            this.contentEl.innerHTML = '<span style="color: #8b949e">Ожидание сделок...</span>';
            return;
        }
        
        const items = this.trades.map(t => this.formatTrade(t)).join(' &nbsp;&nbsp; • &nbsp;&nbsp; ');
        this.contentEl.innerHTML = items;
        
        // Restart animation
        this.startAnimation();
    }
    
    startAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        const animate = () => {
            if (!this.contentEl) return;
            
            const containerWidth = this.container.offsetWidth;
            const contentWidth = this.contentEl.scrollWidth;
            
            if (contentWidth <= containerWidth) {
                // Content fits, no need to scroll
                this.contentEl.style.transform = 'translateX(0)';
                return;
            }
            
            this.scrollPosition -= 0.5; // Scroll speed
            
            // Reset when scrolled past content
            if (Math.abs(this.scrollPosition) >= contentWidth + containerWidth) {
                this.scrollPosition = containerWidth;
            }
            
            this.contentEl.style.transform = `translateX(${this.scrollPosition}px)`;
            this.contentEl.style.transition = 'none';
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        // Initial position
        this.scrollPosition = this.container.offsetWidth;
        this.animationId = requestAnimationFrame(animate);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

