# Projektbericht — AERO-SENSE
## Predictive Maintenance & Live Process Twin

**Autor:** Fatih Altiok  
**GitHub:** https://github.com/fatihaltiok/aero-sense  
**Live-Demo:** https://aero-sense-ashy.vercel.app  
**Projektdauer:** 6 Wochen  

---

## 1. Ausgangslage und Zielsetzung

### 1.1 Warum dieses Projekt?

Das Projekt entstand aus dem Wunsch, ein Portfolio-Projekt zu entwickeln, das drei Anforderungen gleichzeitig erfüllt:

1. **Technische Tiefe** — Full-Stack-Kompetenz von der Datenpipeline bis zum Frontend muss erkennbar sein
2. **Industrie-Relevanz** — Predictive Maintenance und Digital Twins sind aktuell die gefragtesten Use-Cases in der Industrie 4.0
3. **Visueller Impact** — Das Ergebnis soll im Portfolio sofort ins Auge springen und sich von Standard-Admin-Panels abheben

Die Idee: Ein Echtzeit-Dashboard, das den Zustand einer simulierten CNC-Fertigungslinie abbildet, Anomalien per Machine-Learning vorhersagt und dem Nutzer interaktive Optimierungswerkzeuge bietet.

### 1.2 Anforderungen

Folgende Features wurden zu Projektbeginn definiert:

| Feature | Beschreibung |
|---|---|
| Live Digital Twin | 3D-Modell der Anlage, das Bauteil-Zustände in Echtzeit farblich darstellt |
| Predictive Alerts | ML-basierte Anomalie-Erkennung mit Alert-Feed |
| Remaining Useful Life | Echtzeit-Gauge für die geschätzte Restlebensdauer |
| Was-wäre-wenn-Simulator | Schieberegler für Prozessparameter mit sofortiger Impact-Vorschau |
| Prozess-Heatmap | Farbcodierte Engpass-Visualisierung nach Stationen |
| Live-Charts | Zeitreihen-Darstellung der Sensordaten mit Metrik-Auswahl |
| Modernes SaaS-Design | Dark-Luxury-Glassmorphism-Design, kein Standard-Admin-Panel |
| Vollständige Tests | Property-based Tests + Laufzeit-Contracts |
| Deployment | Öffentlich erreichbar, One-Command-Setup mit Docker |

---

## 2. Umsetzungsfahrplan — 6 Wochen

Das Projekt wurde in sechs aufeinander aufbauende Wochen unterteilt:

### Woche 1 — Design-System & Frontend-Foundation
Aufbau des visuellen Fundaments: Next.js 15 mit TypeScript, Tailwind CSS v4 und das komplette Design-System wurden eingerichtet. Sidebar, Topbar und die ersten Dashboard-Komponenten (KPI-Cards, Alert-Feed, RUL-Gauge) entstanden als statische Shell mit simulierten Daten.

### Woche 2 — Datenpipeline & Backend
FastAPI-Backend mit WebSocket-Endpunkt, Python-Sensor-Simulator mit physikalisch plausiblen Sinuswellen und Gauss-Rauschen, TimescaleDB-Schema-Planung.

### Woche 3 — 3D Digital Twin & WebSocket-Anbindung
Die wichtigste Woche: React Three Fiber wurde integriert und eine prozedurale 3D-CNC-Maschine mit fünf Bauteilen (Spindel, Motor, Tisch, Kühlmittel, Rahmen) gebaut. Jedes Bauteil ändert Farbe und Leuchtintensität in Echtzeit basierend auf den Sensordaten. Der WebSocket-Hook mit Auto-Reconnect ersetzte die simulierten Frontend-Daten.

### Woche 4 — ML-Modul, Simulator & Tests
Isolation Forest für Anomalie-Erkennung, Was-wäre-wenn-Simulator als neuer API-Endpunkt und Frontend-Komponente. Vollständige Test-Suite mit Hypothesis (property-based) und icontract (Laufzeit-Contracts).

### Woche 5 — Deployment-Infrastruktur & Performance
Docker Compose für One-Command-Setup, Dockerfiles für Frontend (3-Stage-Build) und Backend, `React.memo` für Performance-kritische Komponenten, Environment-Variable-Konfiguration.

### Woche 6 — Git, GitHub & Deployment
Erster Commit, GitHub-Repository, Vercel-Deployment. Frontend und Backend sind öffentlich erreichbar.

---

## 3. Architektur

### 3.1 Gesamtübersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│   Dashboard (Next.js)                                           │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │3D Twin   │  │KPI Cards │  │Live Chart│  │Simulator │      │
│   │(Three.js)│  │(Framer)  │  │(SVG)     │  │Panel     │      │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│          ↑              ↑                          ↑            │
│          └──────────────┴─── useSensorStream ──────┘            │
│                              (WebSocket Hook)                   │
└──────────────────────────────────┬──────────────────────────────┘
                                   │  WebSocket (ws://)
                                   │  HTTP POST /simulate
                    ───────────────▼───────────────
┌─────────────────────────────────────────────────────────────────┐
│  Backend — FastAPI                                              │
│                                                                 │
│   ┌──────────────────┐     ┌─────────────────────────────┐     │
│   │  WS /ws/sensors  │     │  POST /simulate             │     │
│   │  (1.25 Hz Stream)│     │  compute_impact()           │     │
│   └────────┬─────────┘     └─────────────────────────────┘     │
│            │                                                    │
│   ┌────────▼─────────┐     ┌─────────────────────────────┐     │
│   │  SensorState     │────▶│  AnomalyDetector             │     │
│   │  (Physik-Sim.)   │     │  (Isolation Forest)          │     │
│   └──────────────────┘     └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Frontend-Architektur

Das Frontend folgt dem **Component-per-Feature**-Prinzip. Jede Dashboard-Sektion ist eine eigenständige Komponente:

```
src/
├── app/
│   ├── layout.tsx          — Fonts, Dark-Mode, globale HTML-Struktur
│   ├── page.tsx            — Dashboard-Seite, orchestriert alle Komponenten
│   └── globals.css         — Design-System (Farben, Glassmorphism, Glow-Effects)
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx     — Kollapsierbare Navigation
│   │   └── Topbar.tsx      — Anlage-Selector, Live-Clock, Status-Badge
│   │
│   └── dashboard/
│       ├── DigitalTwin.tsx — Three.js Canvas mit prozeduraler CNC-Maschine
│       ├── KpiCard.tsx     — Animierte Kennzahl-Karten mit Sparkline
│       ├── LiveChart.tsx   — SVG-Zeitreihen-Chart mit 3 Metriken
│       ├── AlertFeed.tsx   — Animierter Echtzeit-Alert-Stream
│       ├── RulGauge.tsx    — SVG-Kreisbogen-Gauge für Restlebensdauer
│       └── SimulatorPanel.tsx — Schieberegler + Impact-Vorschau
│
└── hooks/
    └── useSensorStream.ts  — WebSocket-Verbindung mit Auto-Reconnect
```

**Datenfluss im Frontend:**
1. `useSensorStream` öffnet eine WebSocket-Verbindung zum Backend
2. Jeder eingehende Frame (ca. 800ms) enthält alle Sensorwerte + ML-Ergebnis + Twin-Zustand
3. `page.tsx` verteilt den Frame an alle Kindkomponenten via Props
4. Komponenten mit `React.memo` re-rendern nur, wenn sich ihre Props tatsächlich ändern

### 3.3 Backend-Architektur

Das Backend ist in drei klar getrennte Module aufgeteilt:

**`sensors.py` — Physik-Simulation + Contracts**
Enthält ausschließlich reine Funktionen ohne FastAPI-Abhängigkeiten. Jede Funktion ist mit `@icontract.require` (Vorbedingung) und `@icontract.ensure` (Nachbedingung) annotiert — diese Contracts laufen bei jedem Aufruf mit, sowohl in Tests als auch im laufenden Betrieb.

```python
@icontract.require(lambda rpm: RPM_MIN <= rpm <= RPM_MAX)
@icontract.ensure(lambda result: result in {"ok", "warn", "critical"})
def derive_status_rpm(rpm: float) -> str:
    ...
```

**`ml.py` — Anomalie-Erkennung**
Trainiert beim Serverstart einen Isolation Forest auf 2.000 synthetischen Normaldaten. Der Algorithmus lernt, was „normaler" Betrieb ist, und schlägt Alarm wenn ein eingehender Sensor-Frame zu weit vom Normalbereich abweicht.

**`main.py` — FastAPI-Endpunkte**
Drei Endpunkte:
- `GET /health` — Dienst-Status (wird von Docker für Health-Checks genutzt)
- `WS /ws/sensors` — WebSocket-Stream, sendet jeden Tick einen JSON-Frame
- `POST /simulate` — berechnet den Impact von Parameteränderungen

### 3.4 Kommunikationsprotokoll

Jeder WebSocket-Frame hat folgende Struktur:

```json
{
  "ts": "2026-05-20T09:30:27Z",
  "rpm":       { "value": 2864.0, "status": "ok",      "unit": "RPM" },
  "temp":      { "value": 71.2,   "status": "warn",     "unit": "°C"  },
  "vibration": { "value": 1.78,   "status": "ok",       "unit": "g"   },
  "energy":    { "value": 14.34,  "status": "ok",       "unit": "kWh" },
  "rul":       { "value": 72.8,   "status": "ok",       "unit": "%"   },
  "anomaly":   false,
  "ml":        { "label": 1, "score": 0.202, "anomaly": false },
  "twin_state": {
    "spindle": "ok", "motor": "warn",
    "coolant": "ok", "frame": "ok", "table": "ok"
  }
}
```

Das Frontend liest `twin_state` direkt aus, um die Materialfarben im 3D-Modell zu steuern — kein zusätzlicher API-Aufruf nötig.

---

## 4. Design-System

### 4.1 Philosophie: „Dark Luxury Industrial"

Das Ziel war ein Interface, das wie eine Fusion aus **Vercel Dashboard**, **Linear.app** und einer **Aerospace Control Console** aussieht — nicht wie ein generisches Admin-Panel.

### 4.2 Farbpalette

| Token | Hex | Verwendung |
|---|---|---|
| Background | `#050508` | Seitenhintergrund |
| Surface | `#0D0D1A` | Karten-Hintergrund |
| Border | `#1E1E3A` | Trennlinien |
| Indigo | `#6366F1` | Primärakzent, aktive Elemente |
| Cyan | `#06B6D4` | Live-Indikatoren, Temperatur |
| Green | `#10B981` | Status OK, Durchsatz |
| Yellow | `#F59E0B` | Warnungen |
| Red | `#EF4444` | Kritische Zustände, Alarme |

### 4.3 Glassmorphism-Effekt

Alle Karten verwenden `backdrop-filter: blur(16px)` mit einem semi-transparenten Hintergrund und einem schwach leuchtenden Indigo-Border. Bei kritischen Zuständen wechselt der Border zu Rot mit einem `box-shadow`-Glow-Effekt.

### 4.4 Typografie

Drei Schriftarten werden bewusst kombiniert:
- **Space Grotesk** — Headlines, KPI-Zahlen (futuristisch, geometrisch)
- **Inter** — Fließtext, Labels (maximal lesbar)
- **JetBrains Mono** — Sensorwerte, Zeitstempel (technisch präzise)

---

## 5. Technologieentscheidungen

### 5.1 Next.js 15 statt Vite/React

Next.js wurde gewählt, weil es Server-Side-Rendering, automatisches Code-Splitting und optimierte Font-Einbindung mitbringt. Die App nutzt den App Router mit ausschließlich Client Components (`"use client"`), da alle Daten live vom WebSocket kommen — kein Server-State nötig.

### 5.2 React Three Fiber statt Plain Three.js

React Three Fiber ist ein React-Renderer für Three.js. Statt imperativer Three.js-API kann die 3D-Szene deklarativ als React-Komponenten-Baum beschrieben werden. Das ermöglicht es, denselben State-Management-Ansatz für 2D- und 3D-Elemente zu verwenden.

### 5.3 Framer Motion für Animationen

Framer Motion bietet Spring-Interpolation für Zahlen-Updates (KPI-Werte "gleiten" sanft zum neuen Wert) und `AnimatePresence` für das Ein- und Ausblenden der Alert-Cards ohne manuelle CSS-Transitions.

### 5.4 icontract statt CrossHair

Ursprünglich wurde CrossHair (symbolische Ausführung mit Z3-Solver) für Contract-Checking ausprobiert. Es wurde durch `icontract` ersetzt, weil:

- CrossHair prüft Contracts nur **abstrakt** — mit dem Z3-Solver werden Eingaben symbolisch dargestellt, nie konkrete Werte verwendet
- `icontract` führt Contracts bei **jedem echten Aufruf** aus — sowohl in Tests als auch im laufenden Server
- Eine symbolisch bewiesene Eigenschaft gibt keine Garantie für konkretes Laufzeitverhalten
- `icontract`-Fehlermeldungen zeigen genau welche Bedingung mit welchem konkreten Wert fehlschlug

### 5.5 Hypothesis für Tests

Hypothesis ist eine Python-Bibliothek für **property-based testing**: Statt konkrete Beispiele zu schreiben, werden mathematische Eigenschaften beschrieben. Hypothesis generiert dann automatisch Hunderte von Eingaben und sucht systematisch nach Gegenbeispielen.

Beispiel: Statt `assert clamp(150, 0, 100) == 100` zu schreiben, wird die allgemeine Eigenschaft beschrieben:
> *Für alle gültigen Eingaben gilt: das Ergebnis liegt immer zwischen `lo` und `hi`.*

Hypothesis findet Randfälle, an die man beim manuellen Schreiben nicht denkt (negative Nullen, sehr große Floats, Grenzwerte).

---

## 6. Was ist Vercel — und warum Vercel?

### 6.1 Was ist Vercel?

Vercel ist eine Cloud-Plattform, die speziell für das Deployment von Frontend-Anwendungen optimiert ist. Das Unternehmen wurde von den Entwicklern von Next.js gegründet und ist daher die natürliche Heimat für Next.js-Projekte.

Vercel übernimmt automatisch:
- **Build** — `npm run build` wird in der Cloud ausgeführt
- **CDN** — die gebaute Anwendung wird global auf Servern in über 30 Rechenzentren verteilt
- **SSL** — HTTPS-Zertifikat wird automatisch ausgestellt und erneuert
- **Preview Deployments** — jeder Git-Push erzeugt automatisch eine eigene Vorschau-URL
- **Monitoring** — Laufzeitmessungen und Error-Tracking sind eingebaut

### 6.2 Wie funktioniert das Deployment?

```
Git Push  →  GitHub  →  Vercel erkennt Änderung
                              ↓
                        npm run build
                              ↓
                    Statische Seiten + JS-Bundles
                              ↓
                    Verteilung auf globales CDN
                              ↓
                    Neue URL ist sofort live
```

Jeder `git push` triggert automatisch ein neues Deployment — ohne manuelle Server-Administration.

### 6.3 Warum Vercel für AERO-SENSE?

| Kriterium | Vercel | Alternativen |
|---|---|---|
| Next.js-Support | Nativ, vom selben Team | Netlify, AWS Amplify: Konfigurationsaufwand |
| Deployment-Geschwindigkeit | ~45 Sekunden | Eigener Server: Minuten bis Stunden |
| SSL & Domain | Automatisch | Eigener Server: manuell |
| Skalierung | Automatisch bei Traffic-Spitzen | Eigener Server: manuelle Konfiguration |
| Kosteneinstieg | Kostenloser Hobby-Plan | Eigener Server: monatliche Kosten |
| Portfolio-Sichtbarkeit | Öffentliche URL sofort | Eigener Server: Port-Freigabe, DNS nötig |

Für ein Portfolio-Projekt ist Vercel ideal, weil die Live-Demo mit einer einzigen URL geteilt werden kann, ohne dass der eigene Rechner laufen muss.

### 6.4 Besonderheit: Fullstack auf Vercel

Vercel hat beim Deployment automatisch erkannt, dass das Repository sowohl ein Next.js-Frontend als auch ein FastAPI-Backend enthält. Beide wurden gemeinsam deployed:

- **Frontend:** `https://aero-sense-ashy.vercel.app`
- **Backend:** `https://aero-sense-ashy.vercel.app/_/backend/health`

Das bedeutet: kein separater Server, keine CORS-Probleme durch unterschiedliche Domains, ein einziges Deployment für die gesamte Anwendung.

---

## 7. Projektergebnis

### 7.1 Kennzahlen

| Metrik | Wert |
|---|---|
| Frontend-Dateien (TypeScript/TSX) | 13 |
| Backend-Dateien (Python) | 5 |
| Test-Dateien | 2 |
| Automatisierte Tests | 34 (alle grün) |
| Backend-Codezeilen | 622 |
| Git-Commits | 3 |
| Deployment-Plattform | Vercel (Frontend + Backend) |
| Docker-Images | 2 (Frontend + Backend) |

### 7.2 Implementierte Features

- **Live Digital Twin** — prozedurale 3D-CNC-Maschine mit 5 animierten Bauteilen, Puls-Effekten bei Warnungen und rotem Partikelsystem bei Anomalien
- **Echtzeit-KPI-Karten** — Spring-animierte Zahlen, Sparklines, Status-Indikatoren
- **Live-Chart** — SVG-Zeitreihen für Vibration, Temperatur und Energie, umschaltbar
- **ML-Anomalie-Erkennung** — Isolation Forest, trainiert auf 2.000 Normaldatenpunkten
- **RUL-Gauge** — SVG-Kreisbogen, Farbe wechselt grün → gelb → rot
- **Alert-Feed** — animierter Echtzeit-Stream, Alerts aus echten Backend-Daten generiert
- **Was-wäre-wenn-Simulator** — drei Schieberegler mit sofortiger Backend-Berechnung, Fallback lokal
- **Prozess-Heatmap** — Engpassvisualisierung nach Stationen und Metriken
- **Kollapsierbare Sidebar** — smooth animiert mit Framer Motion
- **Connection-Badge** — zeigt WebSocket-Status (verbunden / getrennt / fehler)

### 7.3 Test-Strategie

Das Backend wurde auf zwei Ebenen getestet:

**Hypothesis (property-based testing):**
Anstatt Einzelfälle zu testen, wurden allgemeine mathematische Eigenschaften formuliert. Hypothesis generiert automatisch Hunderte konkreter Eingaben und sucht Gegenbeispiele. Getestet wurden u.a.:
- `clamp()` bleibt immer in Bounds, ist idempotent
- Alle Status-Ableitungen geben nur gültige Werte zurück
- `compute_impact()` liegt immer in `[0.0, 1.0]`
- Sensor-Werte verlassen nach 500 Simulationsschritten nie die definierten Grenzen
- Monotonie: mehr Kühlmittel senkt nie das Ausfallrisiko; höhere Drehzahl erhöht nie weniger Energie

**icontract (Laufzeit-Contracts):**
Jede kritische Funktion ist mit `@require`- und `@ensure`-Decorators versehen. Diese feuern bei jedem Aufruf — sowohl in Tests als auch wenn der Server unter Last läuft. Ein `ViolationError` zeigt sofort welche Bedingung mit welchem konkreten Wert verletzt wurde.

---

## 8. Lokales Setup

```bash
# Repository klonen
git clone https://github.com/fatihaltiok/aero-sense.git
cd aero-sense

# Option A: Docker (empfohlen)
docker compose up --build
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:8000

# Option B: Manuell
# Terminal 1 — Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
npm install && npm run dev

# Tests
cd backend && pytest tests/ -v
```

---

*Projektbericht erstellt am 20. Mai 2026*  
*Fatih Altiok — fatihaltiok@outlook.com*  
*https://github.com/fatihaltiok/aero-sense*
