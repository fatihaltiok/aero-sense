"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface SensorValue {
  value: number;
  status: "ok" | "warn" | "critical";
  unit: string;
}

export interface TwinState {
  spindle:  "ok" | "warn" | "critical";
  motor:    "ok" | "warn" | "critical";
  coolant:  "ok" | "warn" | "critical";
  frame:    "ok" | "warn" | "critical";
  table:    "ok" | "warn" | "critical";
}

export interface SensorFrame {
  ts:         string;
  rpm:        SensorValue;
  temp:       SensorValue;
  vibration:  SensorValue;
  energy:     SensorValue;
  rul:        SensorValue;
  anomaly:    boolean;
  twin_state: TwinState;
}

type ConnectionState = "connecting" | "open" | "closed" | "error";

const WS_URL = `${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000"}/ws/sensors`;

const FALLBACK_FRAME: SensorFrame = {
  ts: new Date().toISOString(),
  rpm:       { value: 2847, status: "ok",  unit: "RPM" },
  temp:      { value: 68.4, status: "warn", unit: "°C" },
  vibration: { value: 1.82, status: "ok",  unit: "g"   },
  energy:    { value: 14.2, status: "ok",  unit: "kWh" },
  rul:       { value: 73,   status: "ok",  unit: "%"   },
  anomaly:   false,
  twin_state: { spindle: "ok", motor: "warn", coolant: "ok", frame: "ok", table: "ok" },
};

export function useSensorStream() {
  const [frame, setFrame] = useState<SensorFrame>(FALLBACK_FRAME);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const wsRef   = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setConnection("connecting");

    ws.onopen  = () => setConnection("open");
    ws.onclose = () => {
      setConnection("closed");
      retryRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      setConnection("error");
      ws.close();
    };
    ws.onmessage = (ev) => {
      try {
        setFrame(JSON.parse(ev.data) as SensorFrame);
      } catch { /* ignore malformed frames */ }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { frame, connection };
}
