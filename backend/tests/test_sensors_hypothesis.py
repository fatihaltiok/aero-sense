"""
Hypothesis-Tests für sensors.py — property-based.
Hypothesis generiert automatisch Hunderte von Eingaben und sucht Gegenbeispiele.
"""
import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sensors import (
    clamp,
    derive_status_rpm,
    derive_status_temp,
    derive_status_vib,
    derive_status_rul,
    derive_twin_state,
    compute_impact,
    SensorState,
    RPM_MIN, RPM_MAX,
    TEMP_MIN, TEMP_MAX,
    VIB_MIN, VIB_MAX,
    RUL_MIN, RUL_MAX,
)

VALID_STATUSES = {"ok", "warn", "critical"}
Status = str
pct = st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)


# ─── clamp ───────────────────────────────────────────────────────────────────

@given(
    value=st.floats(allow_nan=False, allow_infinity=False),
    lo=st.floats(min_value=-1e9, max_value=0,   allow_nan=False, allow_infinity=False),
    hi=st.floats(min_value=0,    max_value=1e9,  allow_nan=False, allow_infinity=False),
)
def test_clamp_stays_in_bounds(value: float, lo: float, hi: float) -> None:
    assume(lo <= hi)
    result = clamp(value, lo, hi)
    assert lo <= result <= hi


@given(value=st.floats(min_value=-100, max_value=100, allow_nan=False))
def test_clamp_idempotent(value: float) -> None:
    """Zweimaliges Clamp gibt dasselbe Ergebnis wie einmaliges."""
    once  = clamp(value, -50.0, 50.0)
    twice = clamp(once,  -50.0, 50.0)
    assert once == twice


@given(v=st.floats(min_value=0, max_value=100, allow_nan=False))
def test_clamp_identity_when_in_range(v: float) -> None:
    assert clamp(v, 0.0, 100.0) == v


# ─── Status-Ableitungen ───────────────────────────────────────────────────────

@given(rpm=st.floats(min_value=RPM_MIN, max_value=RPM_MAX, allow_nan=False))
def test_derive_status_rpm_valid(rpm: float) -> None:
    assert derive_status_rpm(rpm) in VALID_STATUSES


@given(temp=st.floats(min_value=TEMP_MIN, max_value=TEMP_MAX, allow_nan=False))
def test_derive_status_temp_valid(temp: float) -> None:
    assert derive_status_temp(temp) in VALID_STATUSES


@given(vib=st.floats(min_value=VIB_MIN, max_value=VIB_MAX, allow_nan=False))
def test_derive_status_vib_valid(vib: float) -> None:
    assert derive_status_vib(vib) in VALID_STATUSES


@given(rul=st.floats(min_value=RUL_MIN, max_value=RUL_MAX, allow_nan=False))
def test_derive_status_rul_valid(rul: float) -> None:
    assert derive_status_rul(rul) in VALID_STATUSES


def test_status_rpm_thresholds() -> None:
    """Grenzwert-Monotonie: höhere RPM → mindestens gleich schlimmer."""
    assert derive_status_rpm(2999) == "ok"
    assert derive_status_rpm(3001) == "warn"
    assert derive_status_rpm(3201) == "critical"


def test_status_temp_thresholds() -> None:
    assert derive_status_temp(70) == "ok"
    assert derive_status_temp(80) == "warn"
    assert derive_status_temp(91) == "critical"


def test_status_rul_thresholds() -> None:
    assert derive_status_rul(50) == "ok"
    assert derive_status_rul(30) == "warn"
    assert derive_status_rul(10) == "critical"


# ─── derive_twin_state ────────────────────────────────────────────────────────

@given(
    vib_s=st.sampled_from(["ok", "warn", "critical"]),
    temp_s=st.sampled_from(["ok", "warn", "critical"]),
    temp=st.floats(min_value=TEMP_MIN, max_value=TEMP_MAX, allow_nan=False),
)
def test_twin_state_keys_and_values(vib_s: Status, temp_s: Status, temp: float) -> None:
    state = derive_twin_state(vib_s, temp_s, temp)
    assert set(state.keys()) == {"spindle", "motor", "coolant", "frame", "table"}
    assert all(v in VALID_STATUSES for v in state.values())


@given(temp=st.floats(min_value=TEMP_MIN, max_value=75.0, allow_nan=False))
def test_twin_coolant_ok_when_temp_low(temp: float) -> None:
    state = derive_twin_state("ok", "ok", temp)
    assert state["coolant"] == "ok"


@given(temp=st.floats(min_value=75.01, max_value=TEMP_MAX, allow_nan=False))
def test_twin_coolant_warn_when_temp_high(temp: float) -> None:
    state = derive_twin_state("ok", "ok", temp)
    assert state["coolant"] == "warn"


def test_twin_frame_always_ok() -> None:
    """Der Rahmen hat keine eigenen Sensoren — immer ok."""
    for vib_s in ("ok", "warn", "critical"):
        for temp_s in ("ok", "warn", "critical"):
            state = derive_twin_state(vib_s, temp_s, 70.0)  # type: ignore[arg-type]
            assert state["frame"] == "ok"


# ─── compute_impact ──────────────────────────────────────────────────────────

@given(rpm_pct=pct, coolant_pct=pct, feed_rate_pct=pct)
def test_compute_impact_all_in_unit_interval(
    rpm_pct: float, coolant_pct: float, feed_rate_pct: float
) -> None:
    result = compute_impact(rpm_pct, coolant_pct, feed_rate_pct)
    for key in ("energy_delta", "failure_risk", "temp_delta", "throughput"):
        assert key in result
        assert 0.0 <= result[key] <= 1.0, f"{key} = {result[key]} außerhalb [0,1]"


@given(rpm_pct=pct, feed_rate_pct=pct)
def test_compute_impact_more_coolant_reduces_risk(
    rpm_pct: float, feed_rate_pct: float
) -> None:
    """Mehr Kühlmittel sollte Ausfallrisiko nie erhöhen (bei sonst gleichen Parametern)."""
    low  = compute_impact(rpm_pct, 0.1, feed_rate_pct)["failure_risk"]
    high = compute_impact(rpm_pct, 0.9, feed_rate_pct)["failure_risk"]
    assert high <= low + 1e-9   # Toleranz für Fließkomma-Rundung


@given(coolant_pct=pct, feed_rate_pct=pct)
def test_compute_impact_higher_rpm_increases_energy(
    coolant_pct: float, feed_rate_pct: float
) -> None:
    """Höhere Drehzahl sollte mehr Energie verbrauchen."""
    low  = compute_impact(0.1, coolant_pct, feed_rate_pct)["energy_delta"]
    high = compute_impact(0.9, coolant_pct, feed_rate_pct)["energy_delta"]
    assert high >= low - 1e-9


# ─── SensorState.tick() ───────────────────────────────────────────────────────

@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(steps=st.integers(min_value=1, max_value=500))
def test_sensor_state_values_stay_in_range(steps: int) -> None:
    state = SensorState()
    for _ in range(steps):
        frame = state.tick()
        assert RPM_MIN  <= state.rpm       <= RPM_MAX,  f"RPM={state.rpm}"
        assert TEMP_MIN <= state.temp      <= TEMP_MAX, f"Temp={state.temp}"
        assert VIB_MIN  <= state.vibration <= VIB_MAX,  f"Vib={state.vibration}"
        assert RUL_MIN  <= state.rul       <= RUL_MAX,  f"RUL={state.rul}"
        assert frame["anomaly"] in (True, False)


@settings(max_examples=50)
@given(steps=st.integers(min_value=1, max_value=100))
def test_sensor_frame_has_required_keys(steps: int) -> None:
    state = SensorState()
    for _ in range(steps):
        frame = state.tick()
        for key in ("rpm", "temp", "vibration", "energy", "rul", "anomaly", "twin_state"):
            assert key in frame, f"Schlüssel '{key}' fehlt im Frame"
