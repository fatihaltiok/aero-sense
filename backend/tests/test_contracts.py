"""
icontract-Laufzeit-Contract-Tests.
Prüft dass Contracts bei ungültigen Eingaben tatsächlich auslösen
UND bei gültigen Eingaben niemals feuern.
"""
import pytest
import icontract
from hypothesis import given, assume
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
    RPM_MIN, RPM_MAX,
    TEMP_MIN, TEMP_MAX,
    VIB_MIN, VIB_MAX,
    RUL_MIN, RUL_MAX,
)

pct = st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)


# ─── Precondition-Verletzungen müssen ViolationError werfen ──────────────────

def test_clamp_rejects_inverted_bounds() -> None:
    with pytest.raises(icontract.ViolationError):
        clamp(5.0, lo=10.0, hi=1.0)   # lo > hi — ungültig


def test_derive_status_rpm_rejects_out_of_range() -> None:
    with pytest.raises(icontract.ViolationError):
        derive_status_rpm(RPM_MAX + 1.0)

    with pytest.raises(icontract.ViolationError):
        derive_status_rpm(RPM_MIN - 1.0)


def test_derive_status_temp_rejects_out_of_range() -> None:
    with pytest.raises(icontract.ViolationError):
        derive_status_temp(TEMP_MAX + 0.1)


def test_derive_status_vib_rejects_negative() -> None:
    with pytest.raises(icontract.ViolationError):
        derive_status_vib(-0.1)


def test_derive_status_rul_rejects_over_100() -> None:
    with pytest.raises(icontract.ViolationError):
        derive_status_rul(100.1)


def test_derive_twin_state_rejects_invalid_status() -> None:
    with pytest.raises(icontract.ViolationError):
        derive_twin_state("excellent", "ok", 70.0)   # "excellent" kein gültiger Status


def test_compute_impact_rejects_negative_pct() -> None:
    with pytest.raises(icontract.ViolationError):
        compute_impact(-0.1, 0.5, 0.5)


def test_compute_impact_rejects_over_one() -> None:
    with pytest.raises(icontract.ViolationError):
        compute_impact(0.5, 1.1, 0.5)


# ─── Gültige Eingaben dürfen niemals einen Contract feuern ───────────────────

@given(
    rpm=st.floats(min_value=RPM_MIN, max_value=RPM_MAX, allow_nan=False),
)
def test_valid_rpm_never_raises(rpm: float) -> None:
    derive_status_rpm(rpm)   # darf keinen ViolationError werfen


@given(
    temp=st.floats(min_value=TEMP_MIN, max_value=TEMP_MAX, allow_nan=False),
)
def test_valid_temp_never_raises(temp: float) -> None:
    derive_status_temp(temp)


@given(
    vib=st.floats(min_value=VIB_MIN, max_value=VIB_MAX, allow_nan=False),
)
def test_valid_vib_never_raises(vib: float) -> None:
    derive_status_vib(vib)


@given(
    rul=st.floats(min_value=RUL_MIN, max_value=RUL_MAX, allow_nan=False),
)
def test_valid_rul_never_raises(rul: float) -> None:
    derive_status_rul(rul)


@given(
    vib_s=st.sampled_from(["ok", "warn", "critical"]),
    temp_s=st.sampled_from(["ok", "warn", "critical"]),
    temp=st.floats(min_value=TEMP_MIN, max_value=TEMP_MAX, allow_nan=False),
)
def test_valid_twin_state_never_raises(vib_s: str, temp_s: str, temp: float) -> None:
    derive_twin_state(vib_s, temp_s, temp)


@given(rpm_pct=pct, coolant_pct=pct, feed_rate_pct=pct)
def test_valid_impact_never_raises(rpm_pct: float, coolant_pct: float, feed_rate_pct: float) -> None:
    compute_impact(rpm_pct, coolant_pct, feed_rate_pct)


@given(
    value=st.floats(allow_nan=False, allow_infinity=False),
    lo=st.floats(min_value=-1e9, max_value=0,  allow_nan=False, allow_infinity=False),
    hi=st.floats(min_value=0,    max_value=1e9, allow_nan=False, allow_infinity=False),
)
def test_valid_clamp_never_raises(value: float, lo: float, hi: float) -> None:
    assume(lo <= hi)
    clamp(value, lo, hi)
