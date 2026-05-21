"""
AERO-SENSE FastAPI Backend
WebSocket-Stream, ML-Anomalie-Erkennung, Simulator, RAG-Analyse.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sensors import SensorState
from ml import detector

app = FastAPI(title="AERO-SENSE API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sim = SensorState()
connected_clients: list[WebSocket] = []

# Laufende Analysen (analyse_id → Ergebnis)
_analyses: dict[str, dict] = {}


# ─── Startup: Wissensbasis laden ─────────────────────────────────────────────

@app.on_event("startup")
async def startup_event() -> None:
    try:
        from rag import seed_knowledge_base, ensure_collections
        ensure_collections()
        n = seed_knowledge_base()
        print(f"[RAG] Wissensbasis geladen: {n} Einträge in Qdrant")
    except Exception as e:
        print(f"[RAG] Wissensbasis konnte nicht geladen werden: {e}")


# ─── REST Basis ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "clients": len(connected_clients), "version": "3.0.0"}


@app.get("/snapshot")
async def snapshot() -> dict:
    frame = sim.tick()
    ml_result = detector.predict(
        rpm=sim.rpm, temp=sim.temp, vib=sim.vibration, energy=sim.energy
    )
    frame["ml"] = ml_result
    frame["ts"] = datetime.utcnow().isoformat() + "Z"
    return frame


# ─── Simulator ───────────────────────────────────────────────────────────────

class SimulatorInput(BaseModel):
    rpm_pct:       float = Field(ge=0.0, le=1.0)
    coolant_pct:   float = Field(ge=0.0, le=1.0)
    feed_rate_pct: float = Field(ge=0.0, le=1.0)


@app.post("/simulate")
async def simulate(body: SimulatorInput) -> dict:
    from sensors import compute_impact
    return compute_impact(body.rpm_pct, body.coolant_pct, body.feed_rate_pct)


# ─── RAG-Analyse ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    frame: dict                  # aktueller Sensor-Frame


class FeedbackRequest(BaseModel):
    analyse_id:  str
    bestätigt:   bool
    korrektur:   str | None = None
    mechaniker:  str = "Mechaniker"


def _run_analysis(analyse_id: str, frame: dict) -> None:
    """Läuft im Hintergrund — lädt Gemma und generiert Analyse."""
    try:
        from rag import generate_analysis
        _analyses[analyse_id]["status"] = "running"
        result = generate_analysis(frame)
        _analyses[analyse_id].update({
            "status": "done",
            "result": result,
        })
    except Exception as e:
        _analyses[analyse_id].update({
            "status": "error",
            "error": str(e),
        })


@app.post("/analyze")
async def analyze(body: AnalyzeRequest, bg: BackgroundTasks) -> dict:
    """
    Startet eine RAG-Analyse im Hintergrund.
    Gibt sofort eine analyse_id zurück — Ergebnis per GET /analyze/{id} abfragen.
    """
    analyse_id = str(uuid.uuid4())
    _analyses[analyse_id] = {
        "status":   "queued",
        "ts":       datetime.utcnow().isoformat() + "Z",
        "frame_ts": body.frame.get("ts", ""),
    }
    bg.add_task(_run_analysis, analyse_id, body.frame)
    return {"analyse_id": analyse_id, "status": "queued"}


@app.get("/analyze/{analyse_id}")
async def get_analysis(analyse_id: str) -> dict:
    """Gibt den Status/das Ergebnis einer laufenden Analyse zurück."""
    if analyse_id not in _analyses:
        return {"status": "not_found"}
    return _analyses[analyse_id]


@app.post("/repair/feedback")
async def repair_feedback(body: FeedbackRequest) -> dict:
    """Mechaniker bestätigt oder korrigiert den LLM-Vorschlag."""
    if body.analyse_id not in _analyses:
        return {"status": "error", "detail": "Analyse nicht gefunden"}

    analyse = _analyses.get(body.analyse_id, {})
    result  = analyse.get("result", {})

    try:
        from rag import save_feedback
        entry_id = save_feedback(
            analyse_id   = body.analyse_id,
            sensor_text  = result.get("sensor_text", ""),
            llm_vorschlag= result,
            bestätigt    = body.bestätigt,
            korrektur    = body.korrektur,
            mechaniker   = body.mechaniker,
        )
        return {
            "status":   "gespeichert",
            "entry_id": entry_id,
            "nachricht": "Korrektur in Wissensbasis aufgenommen" if not body.bestätigt
                         else "Bestätigung gespeichert — Lösung als verifiziert markiert",
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


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
