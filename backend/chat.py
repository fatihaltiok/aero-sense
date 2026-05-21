"""
Chat-Modul: Konversation mit Gemma 4.
Kontext: aktueller Maschinenzustand + Qdrant-Wissensbasis + Gesprächsverlauf.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
import os
from datetime import datetime

from rag import (
    CONDA_PYTHON, GEMMA_MODEL,
    retrieve_context, frame_to_text,
)


def _call_gemma_chat(messages: list[dict]) -> str:
    """
    Sendet einen Gesprächsverlauf an Gemma 4 (pkc-conda-env).
    messages: Liste von {"role": "user"|"assistant"|"system", "content": "..."}
    """
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json",
                                     delete=False, encoding="utf-8") as pf:
        json.dump({"messages": messages, "model_id": GEMMA_MODEL}, pf, ensure_ascii=False)
        prompt_file = pf.name

    script = """
import json, sys, os, torch
os.environ["TOKENIZERS_PARALLELISM"] = "false"
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

data     = json.load(open(sys.argv[1], encoding="utf-8"))
messages = data["messages"]
model_id = data["model_id"]

quant = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
)
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id, quantization_config=quant,
    device_map="cuda" if torch.cuda.is_available() else "cpu",
)

prompt_text = tokenizer.apply_chat_template(
    messages, tokenize=False, add_generation_prompt=True
)
inputs = tokenizer(prompt_text, return_tensors="pt").to(model.device)

with torch.no_grad():
    out = model.generate(
        **inputs, max_new_tokens=600,
        temperature=0.6, do_sample=True,
        top_p=0.9,
        pad_token_id=tokenizer.eos_token_id,
    )

response = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
print(response.strip())
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py",
                                     delete=False, encoding="utf-8") as sf:
        sf.write(script)
        script_file = sf.name

    try:
        result = subprocess.run(
            [CONDA_PYTHON, script_file, prompt_file],
            capture_output=True, text=True, timeout=180, encoding="utf-8"
        )
        if result.returncode != 0 and not result.stdout.strip():
            raise RuntimeError(result.stderr[-400:] if result.stderr else "Subprocess-Fehler")
        return result.stdout.strip()
    finally:
        os.unlink(script_file)
        os.unlink(prompt_file)


def build_system_prompt(frame: dict | None) -> str:
    """Erstellt den System-Prompt mit aktuellem Maschinenzustand."""
    base = (
        "Du bist AERO, ein KI-Wartungsassistent für CNC-Fertigungsanlagen. "
        "Du antwortest auf Deutsch, präzise und fachkundig. "
        "Du kennst den aktuellen Zustand der Anlage und die Wartungsdatenbank. "
        "Wenn du dir nicht sicher bist, sagst du das ehrlich."
    )

    if not frame:
        return base

    sensor_text = frame_to_text(frame)
    twin = frame.get("twin_state", {})
    if isinstance(twin, list):
        twin = {}

    kritisch = [k for k, v in twin.items() if v == "critical"]
    warnung  = [k for k, v in twin.items() if v == "warn"]

    status_lines = []
    if kritisch:
        status_lines.append(f"KRITISCH: {', '.join(kritisch)}")
    if warnung:
        status_lines.append(f"Warnung: {', '.join(warnung)}")
    if frame.get("anomaly"):
        status_lines.append("ML-Anomalie aktiv")

    status_str = " | ".join(status_lines) if status_lines else "Alle Systeme normal"

    return (
        f"{base}\n\n"
        f"## Aktueller Maschinenzustand ({datetime.utcnow().strftime('%H:%M:%S')} UTC)\n"
        f"{sensor_text}\n"
        f"Status: {status_str}"
    )


def chat_with_context(
    user_message: str,
    history: list[dict],
    frame: dict | None = None,
) -> str:
    """
    Hauptfunktion: Nachricht + Verlauf + Maschinenzustand → Antwort von Gemma 4.

    history: [{"role": "user"|"assistant", "content": "..."}]
    """
    # Qdrant-Kontext für die aktuelle Frage holen
    query = user_message
    if frame:
        query = f"{frame_to_text(frame)} {user_message}"

    context_docs = retrieve_context(query, top_k=3)
    context_snippets = []
    for doc in context_docs:
        if doc.get("typ") == "fehler" and doc.get("score", 0) > 0.4:
            context_snippets.append(
                f"[Wissen: {doc.get('id','?')} — {doc.get('bauteil','?')}] "
                f"{', '.join(doc.get('lösungen', [])[:2])}"
            )
        elif doc.get("typ") == "wartung" and doc.get("score", 0) > 0.4:
            context_snippets.append(
                f"[Wartung: {doc.get('bauteil','?')}] {doc.get('tätigkeit','')}"
            )

    system_content = build_system_prompt(frame)
    if context_snippets:
        system_content += "\n\n## Relevantes Wissen\n" + "\n".join(context_snippets)

    # Nachrichtenverlauf aufbauen (max. letzte 6 Nachrichten für Kontext)
    messages = [{"role": "system", "content": system_content}]
    messages += history[-6:]
    messages.append({"role": "user", "content": user_message})

    return _call_gemma_chat(messages)
