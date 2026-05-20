"""
Reine Sensor-Logik mit icontract-Contracts.
Contracts laufen bei jedem echten Aufruf — in Tests und in Produktion.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

import icontract

# ─── Grenzwerte ──────────────────────────────────────────────────────────────

RPM_MIN,  RPM_MAX  = 2000.0, 3500.0
TEMP_MIN, TEMP_MAX = 45.0,   110.0
VIB_MIN,  VIB_MAX  = 0.0,    8.0
NRG_MIN,  NRG_MAX  = 8.0,    25.0
RUL_MIN,  RUL_MAX  = 0.0,    100.0

VALID_STATUSES = {"ok", "warn", "critical"}


# ─── Hilfsfunktionen mit Contracts ───────────────────────────────────────────

@icontract.require(lambda lo, hi: lo <= hi)
@icontract.ensure(lambda result, lo, hi: lo <= result <= hi)
def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


@icontract.require(lambda rpm: RPM_MIN <= rpm <= RPM_MAX)
@icontract.ensure(lambda result: result in VALID_STATUSES)
def derive_status_rpm(rpm: float) -> str:
    if rpm >= 3200:
        return "critical"
    if rpm >= 3000:
        return "warn"
    return "ok"


@icontract.require(lambda temp: TEMP_MIN <= temp <= TEMP_MAX)
@icontract.ensure(lambda result: result in VALID_STATUSES)
def derive_status_temp(temp: float) -> str:
    if temp > 90:
        return "critical"
    if temp > 78:
        return "warn"
    return "ok"


@icontract.require(lambda vib: VIB_MIN <= vib <= VIB_MAX)
@icontract.ensure(lambda result: result in VALID_STATUSES)
def derive_status_vib(vib: float) -> str:
    if vib > 4.5:
        return "critical"
    if vib > 2.8:
        return "warn"
    return "ok"


@icontract.require(lambda rul: RUL_MIN <= rul <= RUL_MAX)
@icontract.ensure(lambda result: result in VALID_STATUSES)
def derive_status_rul(rul: float) -> str:
    if rul < 20:
        return "critical"
    if rul < 40:
        return "warn"
    return "ok"


@icontract.require(lambda vib_status:  vib_status  in VALID_STATUSES)
@icontract.require(lambda temp_status: temp_status in VALID_STATUSES)
@icontract.require(lambda temp: TEMP_MIN <= temp <= TEMP_MAX)
@icontract.ensure(lambda result: set(result.keys()) == {"spindle", "motor", "coolant", "frame", "table"})
@icontract.ensure(lambda result: all(v in VALID_STATUSES for v in result.values()))
def derive_twin_state(vib_status: str, temp_status: str, temp: float) -> dict[str, str]:
    severity = {"ok": 0, "warn": 1, "critical": 2}

    def worst(a: str, b: str) -> str:
        return a if severity[a] >= severity[b] else b

    return {
        "spindle": worst(vib_status, "ok"),
        "motor":   temp_status,
        "coolant": "warn" if temp > 75 else "ok",
        "frame":   "ok",
        "table":   vib_status,
    }


@icontract.require(lambda rpm_pct:       0.0 <= rpm_pct       <= 1.0)
@icontract.require(lambda coolant_pct:   0.0 <= coolant_pct   <= 1.0)
@icontract.require(lambda feed_rate_pct: 0.0 <= feed_rate_pct <= 1.0)
@icontract.ensure(lambda result: all(0.0 <= v <= 1.0 for v in result.values()))
@icontract.ensure(lambda result: set(result.keys()) == {"energy_delta", "failure_risk", "temp_delta", "throughput"})
def compute_impact(rpm_pct: float, coolant_pct: float, feed_rate_pct: float) -> dict[str, float]:
    energy_delta = clamp(rpm_pct ** 1.6 * 0.8 - coolant_pct * 0.15, 0.0, 1.0)
    failure_risk = clamp(rpm_pct * 0.4 + (1.0 - coolant_pct) * 0.35 + feed_rate_pct * 0.25, 0.0, 1.0)
    temp_delta   = clamp(rpm_pct * 0.7 - coolant_pct * 0.4, 0.0, 1.0)
    throughput   = clamp((feed_rate_pct * 0.6 + rpm_pct * 0.4) * (0.5 + coolant_pct * 0.5), 0.0, 1.0)

    return {
        "energy_delta": round(energy_delta, 4),
        "failure_risk": round(failure_risk, 4),
        "temp_delta":   round(temp_delta,   4),
        "throughput":   round(throughput,   4),
    }


# ─── Simulatorklasse ─────────────────────────────────────────────────────────

@dataclass
class SensorState:
    t:            float = 0.0
    rpm:          float = 2847.0
    temp:         float = 68.0
    vibration:    float = 1.8
    energy:       float = 14.2
    rul:          float = 73.0
    anomaly:      bool  = False
    _anomaly_ttl: int   = field(default=0, repr=False)

    def tick(self) -> dict:
        self.t += 0.1

        self.rpm       = clamp(self.rpm       + math.sin(self.t * 0.3)  * 8    + random.gauss(0, 12),   RPM_MIN,  RPM_MAX)
        self.temp      = clamp(self.temp      + math.sin(self.t * 0.15) * 0.2  + random.gauss(0, 0.15), TEMP_MIN, TEMP_MAX)
        self.vibration = clamp(self.vibration + math.sin(self.t * 0.5)  * 0.05 + random.gauss(0, 0.08), VIB_MIN,  VIB_MAX)
        self.energy    = clamp(self.energy    + random.gauss(0, 0.06),                                   NRG_MIN,  NRG_MAX)
        self.rul       = clamp(self.rul       - random.uniform(0.002, 0.008),                            RUL_MIN,  RUL_MAX)

        if self._anomaly_ttl <= 0 and random.random() < 0.011:
            self._anomaly_ttl = 15
        if self._anomaly_ttl > 0:
            self.vibration = clamp(self.vibration + random.uniform(0.3, 0.8), VIB_MIN, VIB_MAX)
            self.temp      = clamp(self.temp      + random.uniform(0.5, 1.5), TEMP_MIN, TEMP_MAX)
            self._anomaly_ttl -= 1
            self.anomaly = True
        else:
            self.anomaly = False

        s_rpm  = derive_status_rpm(self.rpm)
        s_temp = derive_status_temp(self.temp)
        s_vib  = derive_status_vib(self.vibration)
        s_rul  = derive_status_rul(self.rul)

        return {
            "rpm":        {"value": round(self.rpm, 1),       "status": s_rpm,  "unit": "RPM"},
            "temp":       {"value": round(self.temp, 1),      "status": s_temp, "unit": "°C"},
            "vibration":  {"value": round(self.vibration, 2), "status": s_vib,  "unit": "g"},
            "energy":     {"value": round(self.energy, 2),    "status": "ok",   "unit": "kWh"},
            "rul":        {"value": round(self.rul, 1),       "status": s_rul,  "unit": "%"},
            "anomaly":    self.anomaly,
            "twin_state": derive_twin_state(s_vib, s_temp, self.temp),
        }
