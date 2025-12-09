// CryptoBot Pro – AI Panel (ES-module, без новомодного синтаксиса)
'use strict';

let aiPanel = {
  initialized: false,
  logPrefix: '[CBP AI]'
};

function qs(sel) {
  return document.querySelector(sel);
}

function log(msg) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.log(aiPanel.logPrefix + ' ' + msg, args);
}

export function initAiPanel() {
  if (aiPanel.initialized) return;
  aiPanel.initialized = true;

  aiPanel.container = qs('#cbp-ai-panel');
  aiPanel.input     = qs('#cbp-ai-input');
  aiPanel.sendBtn   = qs('#cbp-ai-send');
  aiPanel.output    = qs('#cbp-ai-output');

  if (!aiPanel.container) {
    log('AI panel container not found, skip init');
    return;
  }

  if (aiPanel.sendBtn) {
    aiPanel.sendBtn.addEventListener('click', function () {
      if (!aiPanel.input) return;
      const text = aiPanel.input.value.trim();
      if (!text) return;
      aiPanel.input.value = '';
      processAiMessage(text);
    });
  }

  if (aiPanel.input) {
    aiPanel.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = aiPanel.input.value.trim();
        if (!text) return;
        aiPanel.input.value = '';
        processAiMessage(text);
      }
    });
  }

  log('AI panel initialized');
}

function appendMessage(role, text) {
  if (!aiPanel.output) return;
  const el = document.createElement('div');
  el.className = 'cbp-ai-message cbp-ai-' + role;
  el.textContent = text;
  aiPanel.output.appendChild(el);
  aiPanel.output.scrollTop = aiPanel.output.scrollHeight;
}

// Временный обработчик AI — потом заменим на реальный запрос к бэкенду
export function processAiMessage(text) {
  appendMessage('user', text);

  setTimeout(function () {
    appendMessage('bot', 'AI-ответ (временный): ' + text);
  }, 300);
}

// На всякий случай автоинициализация по DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
  initAiPanel();
});
