FROM python:3.12-slim

WORKDIR /app

# Abhängigkeiten zuerst cachen
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Render setzt $PORT dynamisch — Fallback auf 8000 für lokalen Betrieb
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
