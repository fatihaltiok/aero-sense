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
CONDA_PYTHON      = "/home/fatih-ubuntu/miniconda3/envs/pkc/bin/python3"


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
    if isinstance(tw, list):
        tw = {}
    critical = [k for k, v in tw.items() if v == "critical"]
    warning  = [k for k, v in tw.items() if v == "warn"]
    if critical:
        parts.append(f"Kritische Bauteile: {', '.join(critical)}")
    if warning:
        parts.append(f"Warnung Bauteile: {', '.join(warning)}")

    return ". ".join(parts)


# ─── Gemma 4 via pkc-conda-env (4-bit quantisiert) ───────────────────────────

def _build_context(context_docs: list[dict]) -> str:
    parts = []
    for doc in context_docs[:4]:
        if doc.get("typ") == "fehler":
            parts.append(
                f"Bekannter Fehlerfall [{doc.get('id','?')}]:\n"
                f"  Symptome: {', '.join(doc.get('symptome',[]))}\n"
                f"  Ursachen: {', '.join(doc.get('mögliche_ursachen',[]))}\n"
                f"  Lösung: {', '.join(doc.get('lösungen',[]))}\n"
                f"  Teile: {', '.join(doc.get('ersatzteile',[]) or ['keine'])}"
            )
        elif doc.get("typ") == "wartung":
            parts.append(
                f"Wartungsintervall [{doc.get('id','?')}]:\n"
                f"  Bauteil: {doc.get('bauteil','?')}\n"
                f"  Tätigkeit: {doc.get('tätigkeit','?')}"
            )
        elif doc.get("typ") == "mechaniker_korrektur":
            parts.append(
                f"Mechaniker-Korrektur (verifiziert):\n"
                f"  Situation: {doc.get('situation','?')}\n"
                f"  Tatsächliche Lösung: {doc.get('korrekte_lösung','?')}"
            )
    return "\n\n".join(parts) if parts else "Keine ähnlichen Fälle gefunden."


def _call_gemma_subprocess(prompt: str) -> str:
    """
    Ruft Gemma 4 im pkc-conda-env als Subprocess auf.
    Dieses Env hat torch nightly + bitsandbytes 0.49.2 — einzige funktionierende Kombination.
    """
    import subprocess, sys, tempfile, os

    script = f"""
import json, sys, os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

model_id = {repr(GEMMA_MODEL)}
quant = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
)
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=quant,
    device_map="cuda" if torch.cuda.is_available() else "cpu",
)

messages = [{{"role": "user", "content": {repr(prompt)}}}]
prompt_text = tokenizer.apply_chat_template(
    messages, tokenize=False, add_generation_prompt=True
)
inputs = tokenizer(prompt_text, return_tensors="pt").to(model.device)

with torch.no_grad():
    out = model.generate(
        **inputs,
        max_new_tokens=512,
        temperature=0.3,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )

response = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
print(response.strip())
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(script)
        tmp = f.name

    try:
        result = subprocess.run(
            [CONDA_PYTHON, tmp],
            capture_output=True, text=True, timeout=180
        )
        return result.stdout.strip()
    finally:
        os.unlink(tmp)


def generate_analysis(frame: dict) -> dict:
    """Sensor-Frame → strukturierte Analyse mit Reparaturplan via Gemma 4."""
    sensor_text  = frame_to_text(frame)
    context_docs = retrieve_context(sensor_text)
    context_str  = _build_context(context_docs)

    prompt = f"""Du bist ein Wartungsexperte für CNC-Fertigungsanlagen. Analysiere die Sensordaten und erstelle einen konkreten Reparaturplan.

## Aktuelle Sensordaten
{sensor_text}

## Relevantes Wissen aus der Wartungsdatenbank
{context_str}

## Aufgabe
Antworte NUR als JSON (kein Text davor oder danach):
{{
  "ursache": "Wahrscheinlichste Ursache in 1-2 Sätzen",
  "sofortmassnahmen": ["Schritt 1", "Schritt 2"],
  "reparaturschritte": ["Schritt 1", "Schritt 2", "Schritt 3"],
  "ersatzteile": ["Teil 1", "Teil 2"],
  "reparaturdauer_h": 2,
  "priorität": "kritisch",
  "konfidenz": 0.85,
  "hinweis": "Optionaler Hinweis"
}}"""

    try:
        response = _call_gemma_subprocess(prompt)
        start = response.find("{")
        end   = response.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(response[start:end])
        else:
            raise ValueError("Kein JSON in Antwort")
    except Exception as e:
        result = {
            "ursache":           f"Analyse-Fehler: {str(e)[:100]}",
            "sofortmassnahmen":  ["Anlage stoppen", "Techniker informieren"],
            "reparaturschritte": ["Manuelle Inspektion durchführen"],
            "ersatzteile":       [],
            "reparaturdauer_h":  2,
            "priorität":         "hoch",
            "konfidenz":         0.5,
            "hinweis":           "Gemma-Subprocess fehlgeschlagen — manuelle Prüfung",
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
