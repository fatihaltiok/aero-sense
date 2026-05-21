"""
Initiale Wissensbasis für AERO-SENSE.
Befüllt Qdrant mit:
- Fehler-Ursachen-Bäumen (Symptom → Ursachen → Lösungen)
- Wartungsintervallen
- Bauteil-Spezifikationen
"""
from __future__ import annotations

COLLECTION_NAME = "aero_sense_knowledge"

# ─── Fehler-Ursachen-Bäume ───────────────────────────────────────────────────

FAULT_TREES: list[dict] = [
    {
        "id": "VIB_HIGH_001",
        "typ": "fehler",
        "symptome": ["Vibration > 4.0g", "Spindel-Status kritisch"],
        "bauteil": "Spindel",
        "mögliche_ursachen": [
            "Lagerabnutzung an Spindelkopf",
            "Unwucht durch Werkzeugverschleiß",
            "Lockere Spindelhalterung",
            "Fremdkörper im Spindelgehäuse"
        ],
        "diagnose_schritte": [
            "Vibrationsmessung an Spindellager durchführen",
            "Werkzeugspannung und Rundlauf prüfen",
            "Spindelbefestigung auf Lockerung prüfen",
            "Sichtprüfung Spindelgehäuse auf Fremdkörper"
        ],
        "lösungen": [
            "Spindellager tauschen (Lagersatz SKF 7008 oder äquivalent)",
            "Werkzeug austauschen und Rundlauf neu messen",
            "Anzugsmomente Spindelbefestigung prüfen (25 Nm)",
            "Spindelgehäuse reinigen und Druckluft durchblasen"
        ],
        "ersatzteile": ["Spindellager SKF 7008", "Dichtungssatz Spindel"],
        "priorität": "kritisch",
        "geschätzte_reparaturzeit_h": 3,
        "tags": ["vibration", "spindel", "lager", "kritisch"]
    },
    {
        "id": "VIB_HIGH_002",
        "typ": "fehler",
        "symptome": ["Vibration > 2.5g", "Zunahme über mehrere Stunden"],
        "bauteil": "Spindel",
        "mögliche_ursachen": [
            "Beginnende Lagerabnutzung",
            "Kühlmittelversorgung unzureichend",
            "Thermische Ausdehnung bei Dauerbetrieb"
        ],
        "diagnose_schritte": [
            "Vibrationstrend über 30 Minuten aufzeichnen",
            "Kühlmittelfluss und -druck messen",
            "Spindeltemperatur prüfen"
        ],
        "lösungen": [
            "Drehzahl um 15% reduzieren bis Wartung",
            "Kühlmitteldruck auf 3.5 bar erhöhen",
            "Wartungstermin innerhalb 48h einplanen"
        ],
        "ersatzteile": [],
        "priorität": "warnung",
        "geschätzte_reparaturzeit_h": 1,
        "tags": ["vibration", "spindel", "warnung", "kühlmittel"]
    },
    {
        "id": "TEMP_HIGH_001",
        "typ": "fehler",
        "symptome": ["Motortemperatur > 85°C", "Kühlmittel-Status kritisch"],
        "bauteil": "Motor",
        "mögliche_ursachen": [
            "Kühlmittelkreislauf verstopft",
            "Kühlmittelpumpe defekt",
            "Überlastbetrieb durch zu hohe Vorschubrate",
            "Lüfter blockiert oder defekt"
        ],
        "diagnose_schritte": [
            "Kühlmittelfluss am Durchflussmesser prüfen (Soll: 4 L/min)",
            "Kühlmittelpumpe auf Betriebsgeräusch prüfen",
            "Lüfterdrehzahl messen",
            "Verstopfungen in Kühlmittelleitungen suchen"
        ],
        "lösungen": [
            "Anlage sofort stoppen — Überhitzungsschutz aktivieren",
            "Kühlmittelleitungen spülen und Sieb reinigen",
            "Kühlmittelpumpe tauschen",
            "Vorschubrate auf 60% reduzieren"
        ],
        "ersatzteile": ["Kühlmittelpumpe KSB Mini-Norm", "Kühlmittelfilter"],
        "priorität": "kritisch",
        "geschätzte_reparaturzeit_h": 2,
        "tags": ["temperatur", "motor", "kühlmittel", "kritisch", "überhitzung"]
    },
    {
        "id": "TEMP_HIGH_002",
        "typ": "fehler",
        "symptome": ["Temperatur > 78°C", "Langsamer Anstieg"],
        "bauteil": "Motor",
        "mögliche_ursachen": [
            "Kühlmittel-Füllstand niedrig",
            "Wärmetauscher verschmutzt",
            "Umgebungstemperatur zu hoch"
        ],
        "diagnose_schritte": [
            "Kühlmittel-Füllstand im Ausgleichsbehälter prüfen",
            "Wärmetauscher-Lamellen auf Verschmutzung prüfen",
            "Raumtemperatur messen (Soll: max. 25°C)"
        ],
        "lösungen": [
            "Kühlmittel auf Sollstand (MAX-Markierung) auffüllen",
            "Wärmetauscher mit Druckluft ausblasen",
            "Belüftung des Maschinenraums verbessern"
        ],
        "ersatzteile": ["Kühlmittel FUCHS Ecocool 2010 (5L)"],
        "priorität": "warnung",
        "geschätzte_reparaturzeit_h": 0.5,
        "tags": ["temperatur", "motor", "warnung", "kühlmittel"]
    },
    {
        "id": "RUL_LOW_001",
        "typ": "fehler",
        "symptome": ["RUL < 20%", "Vibration erhöht", "Langzeitbetrieb"],
        "bauteil": "Lager",
        "mögliche_ursachen": [
            "Lager hat Betriebslebensdauer erreicht",
            "Schmierstoffmangel beschleunigte Abnutzung",
            "Überlastbetrieb in der Vergangenheit"
        ],
        "diagnose_schritte": [
            "Betriebsstunden aus Protokoll entnehmen",
            "Schmierstoffzustand und -menge prüfen",
            "Lagerspiel messen"
        ],
        "lösungen": [
            "Lager innerhalb 8h tauschen — Ausfall droht",
            "Neue Lager mit erhöhter Schmierstoffmenge einbauen",
            "Wartungsprotokoll aktualisieren und Intervall prüfen"
        ],
        "ersatzteile": ["Hauptlager FAG 6308-2RSR", "Schmierfett Klüber Isoflex NBU 15"],
        "priorität": "kritisch",
        "geschätzte_reparaturzeit_h": 4,
        "tags": ["rul", "lager", "verschleiß", "kritisch", "tausch"]
    },
    {
        "id": "VIB_TEMP_COMBO_001",
        "typ": "fehler",
        "symptome": ["Vibration > 3.5g", "Temperatur > 80°C", "gleichzeitig"],
        "bauteil": "Spindel + Motor",
        "mögliche_ursachen": [
            "Spindellager kollabiert — Reibungswärme erzeugt Temperaturanstieg",
            "Kettenfehler: Kühlmittelausfall führt zu Überhitzung und Vibration"
        ],
        "diagnose_schritte": [
            "Anlage sofort stoppen",
            "Spindel von Hand drehen — Widerstand prüfen",
            "Kühlmittelkreislauf auf Leckage prüfen"
        ],
        "lösungen": [
            "Notabschaltung — keine weitere Produktion bis Inspektion",
            "Vollständige Spindelinspektion durch Fachbetrieb",
            "Kühlmittelsystem komplett prüfen"
        ],
        "ersatzteile": ["Spindel-Komplett-Set", "Lagersatz", "Kühlmittelpumpe"],
        "priorität": "kritisch",
        "geschätzte_reparaturzeit_h": 8,
        "tags": ["vibration", "temperatur", "spindel", "motor", "kombifehler", "notfall"]
    },
    {
        "id": "ENERGY_HIGH_001",
        "typ": "fehler",
        "symptome": ["Energieverbrauch > 18 kWh", "keine Leistungserhöhung"],
        "bauteil": "Antrieb",
        "mögliche_ursachen": [
            "Erhöhter Reibungswiderstand durch Verschleiß",
            "Riemen oder Getriebe ineffizient",
            "Motor-Wirkungsgrad gesunken"
        ],
        "diagnose_schritte": [
            "Leistungsaufnahme bei Leerlauf messen",
            "Riemenspannung prüfen",
            "Motortemperatur bei Teillast messen"
        ],
        "lösungen": [
            "Riemenspannung einstellen (Durchbiegung max. 10mm)",
            "Getriebe auf Verschleiß prüfen und ggf. tauschen",
            "Motor-Kennlinie mit Werksangabe vergleichen"
        ],
        "ersatzteile": ["Keilriemen SPZ-1250", "Getriebeöl 5L"],
        "priorität": "info",
        "geschätzte_reparaturzeit_h": 1,
        "tags": ["energie", "antrieb", "effizienz", "info"]
    },
]

# ─── Wartungsintervalle ───────────────────────────────────────────────────────

MAINTENANCE_INTERVALS: list[dict] = [
    {
        "id": "MAINT_001",
        "typ": "wartung",
        "bauteil": "Spindellager",
        "intervall_h": 2000,
        "tätigkeit": "Spindellager prüfen und nachschmieren",
        "beschreibung": "Lagerspiel messen, Schmierfett erneuern, Abdichtungen prüfen",
        "ersatzteile": ["Schmierfett Klüber Isoflex NBU 15 (100g)"],
        "tags": ["spindel", "lager", "schmierung", "wartung"]
    },
    {
        "id": "MAINT_002",
        "typ": "wartung",
        "bauteil": "Kühlmittelsystem",
        "intervall_h": 500,
        "tätigkeit": "Kühlmittel prüfen und ggf. ergänzen",
        "beschreibung": "Füllstand, pH-Wert (Soll: 8.5-9.5) und Konzentration (Soll: 8%) prüfen",
        "ersatzteile": ["Kühlmittel FUCHS Ecocool 2010 (5L)"],
        "tags": ["kühlmittel", "wartung", "regelmäßig"]
    },
    {
        "id": "MAINT_003",
        "typ": "wartung",
        "bauteil": "Hauptlager",
        "intervall_h": 4000,
        "tätigkeit": "Hauptlager tauschen",
        "beschreibung": "Präventiver Austausch nach 4000 Betriebsstunden unabhängig vom Zustand",
        "ersatzteile": ["FAG 6308-2RSR Lager (Satz)", "Schmierfett"],
        "tags": ["lager", "tausch", "präventiv", "wartung"]
    },
    {
        "id": "MAINT_004",
        "typ": "wartung",
        "bauteil": "Keilriemen",
        "intervall_h": 1000,
        "tätigkeit": "Keilriemen auf Verschleiß prüfen",
        "beschreibung": "Risse, Härtung, Flankenabnutzung prüfen. Spannung: max. 10mm Durchbiegung bei 10N",
        "ersatzteile": ["Keilriemen SPZ-1250 (bei Bedarf)"],
        "tags": ["riemen", "antrieb", "wartung"]
    },
    {
        "id": "MAINT_005",
        "typ": "wartung",
        "bauteil": "Filter und Siebe",
        "intervall_h": 250,
        "tätigkeit": "Alle Filter und Siebe reinigen",
        "beschreibung": "Kühlmittelfilter, Luftfilter Motor, Hydraulikfilter reinigen/tauschen",
        "ersatzteile": ["Filterpatronen-Set"],
        "tags": ["filter", "reinigung", "wartung", "regelmäßig"]
    },
]
