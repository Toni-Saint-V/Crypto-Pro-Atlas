"use strict";

import { dashboardState } from "./cbp_state.js";

export function initDashboardRealtime({ wsUrl }) {
  let socket;

  try {
    socket = new WebSocket(wsUrl);
  } catch (e) {
    console.error("[CBP RT] Failed to create WebSocket", e);
    return;
  }

  socket.onopen = () => {
    console.log("[CBP RT] WS connected");
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "dashboard_update" && msg.payload) {
        dashboardState.setSnapshot(msg.payload);
        window.dispatchEvent(new CustomEvent("cbp:dashboard_update"));
      }
    } catch (e) {
      console.error("[CBP RT] Failed to parse message", e);
    }
  };

  socket.onclose = () => {
    console.log("[CBP RT] WS closed");
    // TODO: reconnect strategy (по желанию)
  };

  socket.onerror = (error) => {
    console.error("[CBP RT] WebSocket error", error);
  };
}

