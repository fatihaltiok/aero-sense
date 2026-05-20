"""
AERO-SENSE FastAPI Backend — Woche 4
WebSocket-Stream, ML-Anomalie-Erkennung, Simulator-Endpunkt.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sensors import SensorState
from ml import detector

app = FastAPI(title="AERO-SENSE API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sim = SensorState()
connected_clients: list[WebSocket] = []


# ─── REST ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "clients": len(connected_clients), "version": "2.0.0"}


@app.get("/snapshot")
async def snapshot() -> dict:
    frame = sim.tick()
    ml_result = detector.predict(
        rpm=sim.rpm, temp=sim.temp, vib=sim.vibration, energy=sim.energy
    )
    frame["ml"] = ml_result
    frame["ts"] = datetime.utcnow().isoformat() + "Z"
    return frame


# ─── Simulator-Endpunkt ───────────────────────────────────────────────────────

class SimulatorInput(BaseModel):
    rpm_pct:        float = Field(ge=0.0, le=1.0)
    coolant_pct:    float = Field(ge=0.0, le=1.0)
    feed_rate_pct:  float = Field(ge=0.0, le=1.0)


@app.post("/simulate")
async def simulate(body: SimulatorInput) -> dict:
    from sensors import compute_impact
    return compute_impact(body.rpm_pct, body.coolant_pct, body.feed_rate_pct)


# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws/sensors")
async def sensor_stream(ws: WebSocket) -> None:
    await ws.accept()
    connected_clients.append(ws)
    try:
        while True:
            frame = sim.tick()
            ml_result = detector.predict(
                rpm=sim.rpm, temp=sim.temp, vib=sim.vibration, energy=sim.energy
            )
            # ML überschreibt Zufalls-Anomalie mit echter Vorhersage
            frame["anomaly"] = ml_result["anomaly"]
            frame["ml"]      = ml_result
            frame["ts"]      = datetime.utcnow().isoformat() + "Z"
            await ws.send_text(json.dumps(frame))
            await asyncio.sleep(0.8)
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.remove(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
