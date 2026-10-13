"""Static township configuration: zones, devices, thresholds and engineering constants.

Every number used by the rule engines lives here so judges (and you) can see
exactly where it comes from and change it for a real township.
"""
import os

# ---------------------------------------------------------------- zones
ZONES = {
    "Zone A": {"type": "Residential", "residents": 542, "properties": 155, "bbox": [0.00, 0.00, 0.40, 1.00]},
    "Zone B": {"type": "Commercial", "residents": 186, "properties": 42, "bbox": [0.40, 0.00, 0.62, 1.00]},
    "Zone C": {"type": "Residential", "residents": 556, "properties": 159, "bbox": [0.62, 0.00, 1.00, 1.00]},
}

# Township reference point (fictional site — replace with the real township centroid).
ORIGIN = (3.1300, 101.5200)
SPAN_LAT = 0.0160   # ~1.8 km north-south
SPAN_LNG = 0.0220   # ~2.4 km east-west


def to_latlng(x, y):
    """Map a normalised (x 0..1 west→east, y 0..1 north→south) point to lat/lng."""
    return (round(ORIGIN[0] + SPAN_LAT / 2 - y * SPAN_LAT, 6), round(ORIGIN[1] - SPAN_LNG / 2 + x * SPAN_LNG, 6))


# ---------------------------------------------------------------- water (DMA)
# One bulk inlet meter per zone = one District Metered Area.
WATER_PER_CAPITA_LPD = float(os.environ.get("NEXORA_LPCD", 220))          # litres / person / day
NIGHT_USE_L_PER_PROP_H = float(os.environ.get("NEXORA_NIGHT_USE", 1.7))   # legitimate night use per property
NIGHT_WINDOW = (2, 4)                                                      # 02:00–04:00 local
HOUR_DAY_FACTOR = 20.0     # converts night leakage rate → daily volume (pressure is higher at night)
LEAK_MARGIN_M3H = 0.15     # tolerance above (legit use + background) before we flag a burst
BACKGROUND_LEAK_L_PER_PROP_H = 1.0  # unavoidable background leakage allowance
WATER_TARIFF_RM_M3 = float(os.environ.get("NEXORA_WATER_TARIFF", 2.00))   # configurable — verify local tariff

# Diurnal demand profile (multiplier of average hourly demand), index = hour 0..23
DIURNAL = [0.20, 0.08, 0.05, 0.05, 0.12, 0.55, 1.55, 1.95, 1.60, 1.15, 1.00, 0.98,
           1.05, 1.00, 0.92, 0.95, 1.10, 1.45, 1.80, 1.70, 1.35, 1.00, 0.70, 0.40]
COMMERCIAL_DIURNAL = [0.10, 0.05, 0.04, 0.04, 0.06, 0.20, 0.60, 1.10, 1.50, 1.60, 1.60, 1.70,
                      1.75, 1.60, 1.50, 1.50, 1.45, 1.30, 1.20, 1.10, 0.90, 0.60, 0.35, 0.18]

# ---------------------------------------------------------------- flood (JPS-style stages)
FLOOD_LEVELS = ["NORMAL", "WASPADA", "AMARAN", "BAHAYA"]

# ---------------------------------------------------------------- waste
DEPOT = {"name": "Township depot", "x": 0.50, "y": 1.05}
BIN_COLLECT_THRESHOLD = 80        # % full
ROAD_CIRCUITY = 1.3               # straight-line → road distance factor
TRUCK_L_PER_KM = 0.40             # refuse compactor diesel use (~2.5 km/L)
DIESEL_CO2_KG_PER_L = 2.68        # combustion emission factor for diesel
BIN_CAPACITY_L = 660

# ---------------------------------------------------------------- work order SLA (hours)
SLA = {
    "flood": (2, "P1"),
    "water_leak": (4, "P1"),
    "water_supply": (8, "P2"),
    "waste": (24, "P2"),
    "streetlight": (48, "P3"),
    "road": (72, "P3"),
    "drain": (24, "P2"),
    "sensor_fault": (24, "P2"),
    "other": (72, "P3"),
}
CATEGORY_LABEL = {
    "flood": "Flooding", "water_leak": "Water leak", "water_supply": "No water supply", "waste": "Waste / bin",
    "streetlight": "Streetlight", "road": "Road / pothole", "drain": "Blocked drain", "sensor_fault": "Sensor fault",
    "other": "Other",
}
CATEGORY_TEAM = {
    "flood": "Drainage Team 01", "drain": "Drainage Team 01", "water_leak": "Utility Response 02",
    "water_supply": "Utility Response 02", "waste": "Waste Crew 04", "streetlight": "Electrical Team 03",
    "road": "Civil Works 01", "sensor_fault": "IoT Maintenance 05", "other": "Facilities Desk",
}
TEAMS = ["Utility Response 02", "Drainage Team 01", "Electrical Team 03", "Civil Works 01", "Waste Crew 04",
         "IoT Maintenance 05", "Facilities Desk"]
WO_STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]

# ---------------------------------------------------------------- governance
# Sensor-raised jobs in these categories wait for a human to approve the dispatch (set NEXORA_REQUIRE_APPROVAL=0 to
# auto-assign again). Resident alerts for flooding are NOT held back — only the crew dispatch is.
REQUIRE_APPROVAL = os.environ.get("NEXORA_REQUIRE_APPROVAL", "1") != "0"
APPROVAL_CATEGORIES = {"water_leak", "flood"}

# ---------------------------------------------------------------- sensor health
# A reading outside these limits is physically implausible → the sensor, not the township, has the problem.
FAULT_RANGE = {"flow": (0.0, 60.0), "pressure": (0.0, 8.0), "rain": (0.0, 250.0), "bin": (0.0, 100.0)}  # level uses 1.5 × depth
FAULT_SPIKE = {"flow": 88.0, "pressure": 9.9, "rain": 400.0, "bin": 140.0}   # what a failed sensor looks like in the simulator
# Flatline: N identical readings in a row. Real water levels move with rain, so a level sensor is only judged while
# the rain gauge reports at least FAULT_FLATLINE_MIN_RAIN_MM_H (a still pond in dry weather is normal).
# 8 readings ≈ 24 s at the 3 s simulator tick — raise it (e.g. 60+) for a node that reports every minute.
FAULT_FLATLINE_N = int(os.environ.get("NEXORA_FLATLINE_N", 8))
FAULT_FLATLINE_MIN_RAIN_MM_H = 5.0
FLATLINE_KINDS = ("flow", "pressure", "level")

# ---------------------------------------------------------------- devices
# kind: flow (m³/h), pressure (bar), level (m), rain (mm/h), bin (% full)
DEVICES = [
    {"device_id": "FM-A", "kind": "flow", "name": "Zone A inlet meter", "zone": "Zone A", "unit": "m³/h", "xy": (0.22, 0.08)},
    {"device_id": "FM-B", "kind": "flow", "name": "Zone B inlet meter", "zone": "Zone B", "unit": "m³/h", "xy": (0.51, 0.08)},
    {"device_id": "FM-C", "kind": "flow", "name": "Zone C inlet meter", "zone": "Zone C", "unit": "m³/h", "xy": (0.80, 0.08)},
    {"device_id": "WT-04", "kind": "pressure", "name": "Zone C pressure", "zone": "Zone C", "unit": "bar", "xy": (0.78, 0.40)},
    {"device_id": "RG-01", "kind": "rain", "name": "Rain gauge", "zone": "Zone B", "unit": "mm/h", "xy": (0.50, 0.30)},
    {"device_id": "DL-A1", "kind": "level", "name": "Zone A monsoon drain", "zone": "Zone A", "unit": "m", "xy": (0.12, 0.86),
     "meta": {"depth": 1.8, "thresholds": {"WASPADA": 0.9, "AMARAN": 1.2, "BAHAYA": 1.5}}},
    {"device_id": "DL-B1", "kind": "level", "name": "Zone B culvert", "zone": "Zone B", "unit": "m", "xy": (0.50, 0.92),
     "meta": {"depth": 1.5, "thresholds": {"WASPADA": 0.7, "AMARAN": 1.0, "BAHAYA": 1.25}}},
    {"device_id": "DL-C1", "kind": "level", "name": "Zone C retention pond", "zone": "Zone C", "unit": "m", "xy": (0.88, 0.80),
     "meta": {"depth": 3.0, "thresholds": {"WASPADA": 1.8, "AMARAN": 2.2, "BAHAYA": 2.6}}},
]
_BINS = [
    ("BIN-01", "Zone A", 0.08, 0.20), ("BIN-02", "Zone A", 0.30, 0.25), ("BIN-03", "Zone A", 0.15, 0.55),
    ("BIN-04", "Zone A", 0.32, 0.70), ("BIN-05", "Zone B", 0.46, 0.20), ("BIN-06", "Zone B", 0.56, 0.45),
    ("BIN-07", "Zone B", 0.47, 0.75), ("BIN-08", "Zone C", 0.70, 0.18), ("BIN-09", "Zone C", 0.92, 0.25),
    ("BIN-10", "Zone C", 0.75, 0.52), ("BIN-11", "Zone C", 0.95, 0.60), ("BIN-12", "Zone C", 0.70, 0.88),
]
for _id, _z, _x, _y in _BINS:
    DEVICES.append({"device_id": _id, "kind": "bin", "name": f"{_z} bin {_id[-2:]}", "zone": _z, "unit": "%", "xy": (_x, _y)})

DEMO_USERS = [
    ("resident@nexora.demo", "Aina Rahman", "resident", "Zone C", "C-12-03"),
    ("operator@nexora.demo", "Ops Command", "operator", None, None),
    ("manager@nexora.demo", "Township Manager", "manager", None, None),
]
DEMO_PASSWORD = os.environ.get("NEXORA_DEMO_PASSWORD", "nexora123")
DEVICE_KEY_DEFAULT = os.environ.get("NEXORA_DEVICE_KEY", "nexora-dev-key")
