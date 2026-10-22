import os
import random

import joblib
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


# NEXORA PREDICTIVE MAINTENANCE ENGINE
# Prototype model trained using synthetic sensor data.

random.seed(42)
np.random.seed(42)


SAMPLE_COUNT = 6000

FEATURE_NAMES = [
    "pressure",
    "flow_rate",
    "vibration",
    "temperature",
    "pressure_drop_rate",
    "anomaly_count",
]


X = []
y = []


for _ in range(SAMPLE_COUNT):

    # Water pressure in bar
    pressure = np.random.uniform(1.4, 4.2)

    # Water flow in L/min
    flow_rate = np.random.uniform(80, 170)

    # Simulated equipment vibration index
    vibration = np.random.uniform(0.05, 1.0)

    # Equipment / pipe environment temperature
    temperature = np.random.uniform(22, 55)

    # Pressure loss rate in bar/min
    pressure_drop_rate = np.random.uniform(0.0, 0.35)

    # Recent anomaly events
    anomaly_count = np.random.randint(0, 11)

    # SYNTHETIC FAILURE LOGIC
    #
    # This generates labels for prototype training data.
    # Higher score = more dangerous sensor condition.

    risk_score = 0.0

    # Pressure
    if pressure < 2.0:
        risk_score += 3.5
    elif pressure < 2.4:
        risk_score += 2.4
    elif pressure < 2.8:
        risk_score += 1.1

    # Flow rate
    if flow_rate < 95:
        risk_score += 1.4
    elif flow_rate < 110:
        risk_score += 0.7

    # Vibration
    if vibration > 0.80:
        risk_score += 2.0
    elif vibration > 0.60:
        risk_score += 1.0

    # Temperature
    if temperature > 47:
        risk_score += 1.3
    elif temperature > 40:
        risk_score += 0.6

    # Pressure drop
    if pressure_drop_rate > 0.25:
        risk_score += 2.2
    elif pressure_drop_rate > 0.15:
        risk_score += 1.2

    # Recent anomaly history
    if anomaly_count >= 8:
        risk_score += 1.8
    elif anomaly_count >= 5:
        risk_score += 0.9

    # Add small random variation so model does not simply
    # memorize a perfectly deterministic rule.
    risk_score += np.random.normal(0, 0.65)

    failure = 1 if risk_score >= 5.0 else 0

    X.append(
        [
            pressure,
            flow_rate,
            vibration,
            temperature,
            pressure_drop_rate,
            anomaly_count,
        ]
    )

    y.append(failure)


X = np.array(X)
y = np.array(y)


X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)


model = RandomForestClassifier(
    n_estimators=250,
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)


model.fit(X_train, y_train)


predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions,
)


print()
print("=" * 60)
print("NEXORA PREDICTIVE MAINTENANCE ENGINE")
print("=" * 60)

print(
    f"Training samples : {len(X_train)}"
)

print(
    f"Testing samples  : {len(X_test)}"
)

print(
    f"Model accuracy   : {accuracy * 100:.2f}%"
)

print(
    f"Failure samples  : {int(y.sum())}"
)

print(
    f"Normal samples   : {len(y) - int(y.sum())}"
)


print()
print("FEATURE IMPORTANCE")
print("-" * 60)

importance_pairs = sorted(
    zip(
        FEATURE_NAMES,
        model.feature_importances_,
    ),
    key=lambda item: item[1],
    reverse=True,
)

for feature, importance in importance_pairs:
    print(
        f"{feature:<22} {importance * 100:>6.2f}%"
    )


os.makedirs(
    "models",
    exist_ok=True,
)

model_path = os.path.join(
    "models",
    "water_failure_model.joblib",
)

joblib.dump(
    {
        "model": model,
        "features": FEATURE_NAMES,
        "model_type": "RandomForestClassifier",
        "training_source": "Synthetic NEXORA sensor dataset",
        "sample_count": SAMPLE_COUNT,
        "accuracy": accuracy,
    },
    model_path,
)


print()
print("=" * 60)

print(
    f"MODEL SAVED → {model_path}"
)

print("=" * 60)
print()


wt04_example = np.array(
    [
        [
            1.8,   # pressure
            91,    # flow rate
            0.84,  # vibration
            46,    # temperature
            0.29,  # pressure drop rate
            8,     # anomaly count
        ]
    ]
)


probability = model.predict_proba(
    wt04_example
)[0][1]


print(
    "WT-04 TEST FAILURE PROBABILITY:"
)

print(
    f"{probability * 100:.1f}%"
)

print()