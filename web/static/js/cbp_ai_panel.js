"use strict";

/**
 * AI Assistant Panel Module
 * Provides chat interface for AI assistant
 */

const API_BASE = "/api";

export class AIPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.messages = [];
        this.isLoading = false;
        
        if (!this.container) {
            console.warn(`[CBP AI Panel] Container ${containerId} not found`);
            return;
        }
        
        this.init();
    }
    
    init() {
        this.render();
        this.addWelcomeMessage();
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="ai-panel-header mb-1.5 flex-shrink-0">
                <h3 class="text-xs font-semibold">🤖 AI Ассистент</h3>
            </div>
            <div class="ai-chat-messages flex-1 mb-1.5 min-h-0" id="ai-chat-messages"></div>
            <div class="ai-chat-input flex gap-1.5 flex-shrink-0">
                <input 
                    type="text" 
                    id="ai-chat-input" 
                    placeholder="Спросите AI..."
                    class="flex-1 param-input text-xs"
                >
                <button 
                    id="ai-chat-send" 
                    class="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:opacity-90 transition text-xs"
                >
                    ➤
                </button>
            </div>
        `;
        
        this.messagesContainer = document.getElementById('ai-chat-messages');
        this.inputEl = document.getElementById('ai-chat-input');
        this.sendBtn = document.getElementById('ai-chat-send');
        
        // Attach event listeners
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.inputEl) {
            this.inputEl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }
    
    addWelcomeMessage() {
        this.addMessage({
            role: 'ai',
            text: 'Привет! Я AI ассистент CryptoBot Pro. Могу помочь с анализом рынка, стратегиями и сигналами. Что вас интересует?',
            timestamp: new Date()
        });
    }
    
    addMessage(message) {
        this.messages.push({
            ...message,
            timestamp: message.timestamp || new Date()
        });
        this.updateMessagesDisplay();
    }
    
    updateMessagesDisplay() {
        if (!this.messagesContainer) return;
        
        this.messagesContainer.innerHTML = this.messages.map(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const isUser = msg.role === 'user';
            const alignClass = isUser ? 'text-right' : 'text-left';
            const bgClass = isUser ? 'bg-blue-600/30 ml-auto' : 'bg-white/5';
            
            return `
                <div class="${alignClass} mb-1.5">
                    <div class="${bgClass} inline-block p-2 rounded-lg max-w-[85%] text-xs">
                        <div>${this.escapeHtml(msg.text)}</div>
                        <div class="text-xs text-gray-400 mt-0.5">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        requestAnimationFrame(() => {
            if (this.messagesContainer) {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        });
    }
    
    async sendMessage() {
        const input = this.inputEl;
        if (!input || this.isLoading) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        // Clear input
        input.value = '';
        
        // Add user message
        this.addMessage({
            role: 'user',
            text: text,
            timestamp: new Date()
        });
        
        // Show loading
        this.isLoading = true;
        if (this.sendBtn) {
            this.sendBtn.disabled = true;
            this.sendBtn.textContent = '...';
        }
        
        try {
            const response = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    context: {
                        symbol: window.dashboardApp?.chartParams?.symbol || 'BTCUSDT',
                        timeframe: window.dashboardApp?.getTimeframeString?.() || '15m',
                        balance: window.dashboardApp?.balance || 10000
                    }
                })
            });
            
            let aiResponse = 'Извините, не могу обработать запрос.';
            if (response.ok) {
                const data = await response.json();
                aiResponse = data.response || data.message || aiResponse;
            }
            
            this.addMessage({
                role: 'ai',
                text: aiResponse,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('[CBP AI Panel] Error sending message:', error);
            this.addMessage({
                role: 'ai',
                text: 'Ошибка соединения с AI. Попробуйте позже.',
                timestamp: new Date()
            });
        } finally {
            this.isLoading = false;
            if (this.sendBtn) {
                this.sendBtn.disabled = false;
                this.sendBtn.textContent = '➤';
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    clear() {
        this.messages = [];
        this.updateMessagesDisplay();
        this.addWelcomeMessage();
    }
}
