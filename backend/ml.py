"""
ML-Modul: Isolation Forest für Anomalie-Erkennung.
Trainiert beim Start auf synthetischen Normaldaten.
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


# Feature-Reihenfolge muss mit predict() übereinstimmen
FEATURE_NAMES = ["rpm", "temp", "vibration", "energy"]


def _generate_normal_data(n: int = 2000) -> np.ndarray:
    rng = np.random.default_rng(42)
    return np.column_stack([
        rng.normal(2800, 80,   n),   # rpm
        rng.normal(67,   3.5,  n),   # temp
        rng.normal(1.9,  0.3,  n),   # vibration
        rng.normal(14.2, 0.4,  n),   # energy
    ])


class AnomalyDetector:
    def __init__(self) -> None:
        X_train = _generate_normal_data()
        self._scaler = StandardScaler().fit(X_train)
        X_scaled = self._scaler.transform(X_train)
        self._model = IsolationForest(
            n_estimators=120,
            contamination=0.05,
            random_state=42,
        ).fit(X_scaled)

    def predict(self, rpm: float, temp: float, vib: float, energy: float) -> dict:
        """
        pre: 1000 <= rpm    <= 4000
        pre: 20   <= temp   <= 120
        pre: 0    <= vib    <= 10
        pre: 0    <= energy <= 30
        post: __return__["label"] in (-1, 1)
        post: 0.0 <= __return__["score"] <= 1.0
        """
        x = np.array([[rpm, temp, vib, energy]], dtype=float)
        x_scaled = self._scaler.transform(x)

        label = int(self._model.predict(x_scaled)[0])          # -1 anomal / 1 normal
        raw_score = float(self._model.score_samples(x_scaled)[0])

        # score_samples liefert negative Werte — in [0,1] normieren
        normalized_score = float(np.clip(1.0 + raw_score / 0.5, 0.0, 1.0))

        return {
            "label":   label,          # -1 = Anomalie, 1 = Normal
            "score":   round(normalized_score, 4),
            "anomaly": label == -1,
        }


# Singleton — einmalig beim Import trainiert
detector = AnomalyDetector()
