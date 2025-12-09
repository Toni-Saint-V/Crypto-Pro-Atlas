import { setWsStatus, updateMetrics } from "./cbp_state.js";

const RECONNECT_DELAY = 3000;
const CHANNELS = {
  trades: "/ws/trades",
  ai: "/ws/ai",
  legacy: "/ws"
};

function resolveWsUrl(path) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

function startSocket({ channel, path, onMessage }) {
  let socket;
  let manuallyClosed = false;

  const url = resolveWsUrl(path);

  const connect = () => {
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      setWsStatus(channel, "connected");
    });

    socket.addEventListener("message", (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (err) {
        console.warn(`WS ${channel} JSON parse error`, err);
        return;
      }
      onMessage?.(payload);
    });

    socket.addEventListener("close", () => {
      setWsStatus(channel, "disconnected");
      if (manuallyClosed) {
        return;
      }
      setTimeout(connect, RECONNECT_DELAY);
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  };

  connect();

  return () => {
    manuallyClosed = true;
    socket?.close();
  };
}

export function initWebSockets(handlers = {}) {
  const stopTrades = startSocket({
    channel: "trades",
    path: CHANNELS.trades,
    onMessage: (payload) => {
      if (!payload) return;
      if (payload.type === "trade") {
        handlers.onTrade?.(payload);
      } else if (payload.type === "signal") {
        handlers.onSignal?.(payload);
      } else if (payload.type === "system") {
        handlers.onSystem?.(payload.message ?? "Trade channel system message");
      }
    }
  });

  const stopLegacy = startSocket({
    channel: "legacy",
    path: CHANNELS.legacy,
    onMessage: (payload) => {
      if (!payload) return;
      if (typeof payload.pnl === "number") {
        updateMetrics({ pnlPercent: payload.pnl });
      }
      if (payload.risk) {
        updateMetrics({ riskLevel: payload.risk });
      }
      if (typeof payload.confidence === "number") {
        updateMetrics({ confidence: payload.confidence });
      }
      handlers.onLegacyMetrics?.(payload);
    }
  });

  const stopAi = startSocket({
    channel: "ai",
    path: CHANNELS.ai,
    onMessage: (payload) => {
      if (!payload) return;
      handlers.onAi?.(payload);
    }
  });

  return () => {
    stopTrades();
    stopLegacy();
    stopAi();
  };
}
