"""
RAG-Pipeline: Qdrant + Gemma 4 für Wartungsanalyse.

Ablauf:
1. Sensor-Frame → Text-Repräsentation
2. Text → Embedding (fastembed)
3. Qdrant-Abfrage → relevantes Wissen
4. Prompt aus Wissen + Sensor-Daten
5. Gemma 4 generiert strukturierte Analyse
6. Rückmeldung des Mechanikers → in Qdrant speichern
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    QueryRequest,
)

QDRANT_HOST       = "localhost"
QDRANT_PORT       = 6333
COLLECTION_NAME   = "aero_sense_knowledge"
FEEDBACK_COLLECTION = "aero_sense_feedback"
VECTOR_SIZE       = 384          # all-MiniLM-L6-v2 Dimension
GEMMA_MODEL       = "google/gemma-4-E4B-it"


# ─── Qdrant-Client ───────────────────────────────────────────────────────────

def get_qdrant() -> QdrantClient:
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)


def ensure_collections() -> None:
    """Erstellt Collections falls sie nicht existieren."""
    client = get_qdrant()
    existing = {c.name for c in client.get_collections().collections}

    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )

    if FEEDBACK_COLLECTION not in existing:
        client.create_collection(
            collection_name=FEEDBACK_COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


# ─── Embedding ───────────────────────────────────────────────────────────────

_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        from fastembed import TextEmbedding
        _embedder = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
    return _embedder


def embed(text: str) -> list[float]:
    embedder = get_embedder()
    return list(next(embedder.embed([text])))


# ─── Wissensbasis befüllen ────────────────────────────────────────────────────

def seed_knowledge_base() -> int:
    """Lädt knowledge_base.py Einträge in Qdrant. Gibt Anzahl zurück."""
    from knowledge_base import FAULT_TREES, MAINTENANCE_INTERVALS

    ensure_collections()
    client = get_qdrant()

    points = []
    for entry in FAULT_TREES + MAINTENANCE_INTERVALS:
        # Text für Embedding: Symptome + Ursachen + Lösungen kombinieren
        symptome  = " ".join(entry.get("symptome", []))
        ursachen  = " ".join(entry.get("mögliche_ursachen", []))
        lösungen  = " ".join(entry.get("lösungen", []))
        tätigkeit = entry.get("tätigkeit", "")
        text = f"{symptome} {ursachen} {lösungen} {tätigkeit}".strip()

        vector = embed(text)
        points.append(PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_DNS, entry["id"])),
            vector=vector,
            payload={**entry, "embedding_text": text, "source": "knowledge_base"},
        ))

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


# ─── Kontext aus Qdrant holen ─────────────────────────────────────────────────

def retrieve_context(query_text: str, top_k: int = 5) -> list[dict]:
    """Holt die top_k relevantesten Einträge aus Qdrant."""
    client  = get_qdrant()
    vector  = embed(query_text)

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=top_k,
        with_payload=True,
        score_threshold=0.25,
    ).points

    # Auch Feedback-Korrekturen einbeziehen
    try:
        feedback_results = client.query_points(
            collection_name=FEEDBACK_COLLECTION,
            query=vector,
            limit=3,
            with_payload=True,
            score_threshold=0.3,
        ).points
        results = list(results) + list(feedback_results)
    except Exception:
        pass

    return [{"score": r.score, **r.payload} for r in results]


# ─── Sensor-Frame → Beschreibung ─────────────────────────────────────────────

def frame_to_text(frame: dict) -> str:
    parts = []
    for key in ("rpm", "temp", "vibration", "energy", "rul"):
        if key in frame:
            v = frame[key]
            label = {"rpm": "Drehzahl", "temp": "Temperatur",
                     "vibration": "Vibration", "energy": "Energie",
                     "rul": "Restlebensdauer"}[key]
            parts.append(f"{label}: {v['value']} {v['unit']} ({v['status']})")

    if frame.get("anomaly"):
        parts.append("ML-Anomalie erkannt")

    tw = frame.get("twin_state", {})
    critical = [k for k, v in tw.items() if v == "critical"]
    warning  = [k for k, v in tw.items() if v == "warn"]
    if critical:
        parts.append(f"Kritische Bauteile: {', '.join(critical)}")
    if warning:
        parts.append(f"Warnung Bauteile: {', '.join(warning)}")

    return ". ".join(parts)


# ─── Gemma 4 laden ───────────────────────────────────────────────────────────

_model = None
_tokenizer = None

def get_gemma():
    global _model, _tokenizer
    if _model is None:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM
        _tokenizer = AutoTokenizer.from_pretrained(GEMMA_MODEL)
        _model = AutoModelForCausalLM.from_pretrained(
            GEMMA_MODEL,
            torch_dtype=torch.bfloat16,
            device_map="auto",
        )
    return _tokenizer, _model


def generate_analysis(frame: dict) -> dict:
    """
    Hauptfunktion: Sensor-Frame → strukturierte Analyse mit Reparaturplan.
    Gibt dict zurück mit: ursache, massnahmen, ersatzteile, priorität, etc.
    """
    sensor_text = frame_to_text(frame)
    context_docs = retrieve_context(sensor_text)

    # Kontext aufbereiten
    context_parts = []
    for doc in context_docs[:4]:
        if doc.get("typ") == "fehler":
            context_parts.append(
                f"Bekannter Fehlerfall [{doc.get('id', '?')}]:\n"
                f"  Symptome: {', '.join(doc.get('symptome', []))}\n"
                f"  Ursachen: {', '.join(doc.get('mögliche_ursachen', []))}\n"
                f"  Lösung: {', '.join(doc.get('lösungen', []))}\n"
                f"  Teile: {', '.join(doc.get('ersatzteile', []) or ['keine'])}"
            )
        elif doc.get("typ") == "wartung":
            context_parts.append(
                f"Wartungsintervall [{doc.get('id', '?')}]:\n"
                f"  Bauteil: {doc.get('bauteil', '?')}\n"
                f"  Tätigkeit: {doc.get('tätigkeit', '?')}"
            )
        elif doc.get("typ") == "mechaniker_korrektur":
            context_parts.append(
                f"Mechaniker-Korrektur (verifiziert):\n"
                f"  Situation: {doc.get('situation', '?')}\n"
                f"  Tatsächliche Lösung: {doc.get('korrekte_lösung', '?')}"
            )

    context_str = "\n\n".join(context_parts) if context_parts else "Keine ähnlichen Fälle gefunden."

    prompt = f"""Du bist ein Wartungsexperte für CNC-Fertigungsanlagen. Analysiere die folgenden Sensordaten und erstelle einen konkreten Reparaturplan.

## Aktuelle Sensordaten
{sensor_text}

## Relevantes Wissen aus der Wartungsdatenbank
{context_str}

## Aufgabe
Erstelle eine strukturierte Analyse mit:
1. Wahrscheinlichste Ursache (1-2 Sätze)
2. Sofortmaßnahmen (nummerierte Liste)
3. Reparaturschritte für den Mechaniker (nummerierte Liste)
4. Benötigte Ersatzteile
5. Geschätzte Reparaturdauer
6. Priorität (kritisch/hoch/mittel/niedrig)

Antworte ausschließlich als JSON in diesem Format:
{{
  "ursache": "...",
  "sofortmassnahmen": ["...", "..."],
  "reparaturschritte": ["...", "..."],
  "ersatzteile": ["...", "..."],
  "reparaturdauer_h": 2,
  "priorität": "kritisch",
  "konfidenz": 0.85,
  "hinweis": "..."
}}"""

    tokenizer, model = get_gemma()
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    import torch
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,
            temperature=0.3,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    response = tokenizer.decode(
        outputs[0][inputs["input_ids"].shape[1]:],
        skip_special_tokens=True
    ).strip()

    # JSON aus Antwort extrahieren
    try:
        start = response.find("{")
        end   = response.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(response[start:end])
        else:
            raise ValueError("Kein JSON gefunden")
    except Exception:
        # Fallback: strukturierte Antwort als Text
        result = {
            "ursache": response[:300] if response else "Analyse nicht verfügbar",
            "sofortmassnahmen": ["Anlage stoppen", "Techniker informieren"],
            "reparaturschritte": ["Manuelle Inspektion durchführen"],
            "ersatzteile": [],
            "reparaturdauer_h": 2,
            "priorität": "hoch",
            "konfidenz": 0.5,
            "hinweis": "Automatische JSON-Extraktion fehlgeschlagen — manuelle Prüfung erforderlich",
        }

    result["sensor_text"] = sensor_text
    result["kontext_ids"] = [d.get("id", "?") for d in context_docs[:4]]
    result["analyse_ts"]  = datetime.utcnow().isoformat() + "Z"
    return result


# ─── Mechaniker-Feedback speichern ───────────────────────────────────────────

def save_feedback(
    analyse_id: str,
    sensor_text: str,
    llm_vorschlag: dict,
    bestätigt: bool,
    korrektur: str | None = None,
    mechaniker: str = "Unbekannt",
) -> str:
    """Speichert Mechaniker-Rückmeldung in Qdrant."""
    ensure_collections()
    client = get_qdrant()

    feedback_text = (
        f"{sensor_text} {korrektur or ''} "
        f"{' '.join(llm_vorschlag.get('reparaturschritte', []))}"
    )
    vector = embed(feedback_text)

    entry_id = str(uuid.uuid4())
    client.upsert(
        collection_name=FEEDBACK_COLLECTION,
        points=[PointStruct(
            id=entry_id,
            vector=vector,
            payload={
                "id": entry_id,
                "typ": "mechaniker_korrektur" if not bestätigt else "bestätigung",
                "analyse_id": analyse_id,
                "situation": sensor_text,
                "llm_vorschlag_ursache": llm_vorschlag.get("ursache", ""),
                "llm_vorschlag_schritte": llm_vorschlag.get("reparaturschritte", []),
                "korrekte_lösung": korrektur or "LLM-Vorschlag war korrekt",
                "bestätigt": bestätigt,
                "mechaniker": mechaniker,
                "ts": datetime.utcnow().isoformat() + "Z",
                "source": "mechaniker_feedback",
            }
        )]
    )
    return entry_id
