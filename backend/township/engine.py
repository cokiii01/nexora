"""Device registry, ingest, ESP32 simulator and the alert rules.

Real hardware and the simulator take the SAME path: `ingest()`.
- A real ESP32 POSTs to /api/v2/ingest with its X-Device-Key.
- The simulator generates readings for any device that has not reported for 2 min.
So plugging in a real sensor later needs no code change.
"""
import asyncio
import json
import math
import random
from collections import deque
from datetime import datetime, timedelta

from . import config, db, notify, water, workorders

TICK_S = 3
PERSIST_EVERY_S = 60
REAL_DEVICE_GRACE_S = 120

state = {
    "sim_enabled": True,
    "leak": {"Zone A": 0.0, "Zone B": 0.0, "Zone C": config.SEED_HIDDEN_LEAK_M3H},
    "rain_target": 0.0,
    "overrides": {},
    "flood_stage": {},
    "leak_counter": {},
    "pressure_level": "NORMAL",
    "last_persist": {},
    "real_seen": {},
    "battery": {},
    "bin_rate": {},
    "started": None,
    # sensor health
    "faults": {},          # simulator only: device_id -> "stuck" | "spike"
    "frozen": {},          # value a "stuck" simulated sensor keeps reporting
    "recent": {},          # device_id -> last N readings (flatline check)
    "fault_reason": {},    # device_id -> why the engine distrusts it right now
    "fault_val": {},       # reading seen when the fault was detected
}

PRESSURE_WARN, PRESSURE_CRIT = 2.5, 2.0


# ------------------------------------------------------------------ registry
def seed_devices():
    for d in config.DEVICES:
        if db.q1("SELECT 1 FROM devices WHERE device_id=?", (d["device_id"],)):
            continue
        lat, lng = config.to_latlng(*d["xy"])
        meta = dict(d.get("meta", {}))
        meta["x"], meta["y"] = d["xy"]
        with db.tx() as c:
            c.execute(
                "INSERT INTO devices(device_id,kind,name,zone,unit,lat,lng,api_key,meta,source) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (d["device_id"], d["kind"], d["name"], d["zone"], d["unit"], lat, lng, config.DEVICE_KEY_DEFAULT, json.dumps(meta), "sim"),
            )
    # fault state is held in memory, so a restart starts clean: any sensor still broken is detected again
    with db.tx() as c:
        c.execute("UPDATE alerts SET cleared_at=? WHERE kind='sensor_fault' AND cleared_at IS NULL", (datetime.now().isoformat(),))
    saved = db.get_setting("sim_leak")
    if saved:
        state["leak"].update(json.loads(saved))


def device_meta(dev):
    return json.loads(dev["meta"] or "{}")


def list_devices():
    out = []
    now = datetime.now()
    for d in db.q("SELECT device_id,kind,name,zone,unit,lat,lng,meta,last_value,last_seen,rssi,battery,source,readings_count FROM devices ORDER BY kind, device_id"):
        d["meta"] = device_meta(d)
        age = (now - datetime.fromisoformat(d["last_seen"])).total_seconds() if d["last_seen"] else None
        d["age_s"] = round(age) if age is not None else None
        d["online"] = age is not None and age < 300
        d["override"] = state["overrides"].get(d["device_id"])
        d["fault"] = state["fault_reason"].get(d["device_id"])
        d["sim_fault"] = state["faults"].get(d["device_id"])
        out.append(d)
    return out


def live_values():
    return {d["device_id"]: d["last_value"] for d in db.q("SELECT device_id,last_value FROM devices")}


# ------------------------------------------------------------------ ingest (shared by hardware + simulator)
def ingest(device_id, value, source="sim", rssi=None, battery=None, ts=None, force_persist=False):
    dev = db.q1("SELECT * FROM devices WHERE device_id=?", (device_id,))
    if not dev:
        raise KeyError(device_id)
    now = datetime.now()
    ts = ts or now.isoformat()
    value = float(value)
    dev = dict(dev)
    # Sensor health comes first: a broken sensor must never raise a flood or leak alarm.
    fault_kind, reason = check_fault(dev, value)
    if not reason and device_id in state["fault_reason"] and value == state["fault_val"].get(device_id):
        fault_kind, reason = "flatline", state["fault_reason"][device_id]  # still frozen — stay distrusted until it moves
    if reason:
        _on_fault(dev, value, fault_kind, reason, ts, rssi, battery, source)
        if source == "device":
            state["real_seen"][device_id] = now
        return {"device_id": device_id, "value": value, "stored": False, "fault": reason}
    _maybe_recover(dev, value)
    last_p = state["last_persist"].get(device_id)
    persist = force_persist or source == "device" or not last_p or (now - last_p).total_seconds() >= PERSIST_EVERY_S
    with db.tx() as c:
        c.execute(
            "UPDATE devices SET last_value=?, last_seen=?, rssi=COALESCE(?,rssi), battery=COALESCE(?,battery), source=?, "
            "readings_count=readings_count+? WHERE device_id=?",
            (value, ts, rssi, battery, source, 1 if persist else 0, device_id),
        )
        if persist:
            c.execute("INSERT INTO readings(device_id,ts,value,source) VALUES(?,?,?,?)", (device_id, ts, value, source))
    if persist:
        state["last_persist"][device_id] = now
    if source == "device":
        state["real_seen"][device_id] = now
    evaluate(dict(dev), value)
    return {"device_id": device_id, "value": value, "stored": persist}


# ------------------------------------------------------------------ sensor health
def _plausible(dev):
    if dev["kind"] == "level":
        return 0.0, device_meta(dev)["depth"] * 1.5   # an overflowing channel still reads above its wall height
    return config.FAULT_RANGE[dev["kind"]]


def _rain_now():
    row = db.q1("SELECT last_value FROM devices WHERE kind='rain' LIMIT 1")
    return (row or {}).get("last_value") or 0.0


def check_fault(dev, value):
    """Return (kind, reason) when the reading says the SENSOR is wrong, else (None, None).

    - range:    physically impossible value (open/shorted wire, sensor head blocked)
    - flatline: N identical readings in a row while the real world is clearly moving
    """
    did, kind = dev["device_id"], dev["kind"]
    lo, hi = _plausible(dev)
    if value != value or value < lo or value > hi:
        return "range", f"Reading {value:g} {dev['unit']} is outside the plausible range {lo:g}–{hi:g} {dev['unit']}"
    if kind not in config.FLATLINE_KINDS or did in state["overrides"]:
        return None, None
    rec = state["recent"].setdefault(did, deque(maxlen=config.FAULT_FLATLINE_N))
    if kind == "level" and _rain_now() < config.FAULT_FLATLINE_MIN_RAIN_MM_H:
        return None, None  # still water in dry weather is normal — cannot judge
    rec.append(round(value, 3))
    if len(rec) == rec.maxlen and len(set(rec)) == 1:
        why = " while the rain gauge reports rain" if kind == "level" else ""
        return "flatline", f"{rec.maxlen} identical readings in a row ({value:g} {dev['unit']}){why} — sensor looks frozen"
    return None, None


def _on_fault(dev, value, fault_kind, reason, ts, rssi, battery, source):
    did = dev["device_id"]
    # Keep the last GOOD value for display when the new one is impossible; a frozen value is plausible so it stays.
    with db.tx() as c:
        c.execute("UPDATE devices SET last_seen=?, rssi=COALESCE(?,rssi), battery=COALESCE(?,battery), source=?, "
                  "last_value=CASE WHEN ?='flatline' THEN ? ELSE last_value END WHERE device_id=?",
                  (ts, rssi, battery, source, fault_kind, value, did))
    first = did not in state["fault_reason"]
    state["fault_reason"][did] = reason
    state["fault_val"][did] = value
    if not first and _active_alert("sensor_fault", did):
        return
    aid = _raise_alert("sensor_fault", dev, "WARNING", f"Sensor fault — {dev['name']}", reason, value)
    existing = workorders.open_for("sensor_fault", dev["zone"])
    if existing:
        _link_wo(aid, existing["ref"])
    else:
        wo = workorders.create(
            "sensor_fault", f"Check sensor {did} — {dev['name']}",
            f"{reason}. Its readings are excluded from alerts until it is repaired, so this zone is partly blind. "
            "Inspect wiring, power and the sensor head; swap the node if needed.",
            dev["zone"], "sensor", location=dev["name"], lat=dev["lat"], lng=dev["lng"])
        _link_wo(aid, wo["ref"])


def _maybe_recover(dev, value):
    did = dev["device_id"]
    if did in state["fault_reason"] and value != state["fault_val"].get(did):
        _clear_fault(did)


def _clear_fault(did):
    state["fault_reason"].pop(did, None)
    state["fault_val"].pop(did, None)
    state["recent"].pop(did, None)
    _clear_alert("sensor_fault", did)


# ------------------------------------------------------------------ rules
def _active_alert(kind, device_id):
    return db.q1("SELECT * FROM alerts WHERE kind=? AND device_id=? AND cleared_at IS NULL", (kind, device_id))


def _raise_alert(kind, dev, level, title, detail, value):
    now = datetime.now().isoformat()
    existing = _active_alert(kind, dev["device_id"])
    with db.tx() as c:
        if existing:
            # keep the peak severity for reporting; detail/value track the latest reading
            order = ["NORMAL", "INFO", "WASPADA", "WARNING", "AMARAN", "BAHAYA", "CRITICAL"]
            if order.index(level) < order.index(existing["level"]):
                level, title = existing["level"], existing["title"]
            c.execute("UPDATE alerts SET level=?, title=?, detail=?, value=? WHERE id=?", (level, title, detail, value, existing["id"]))
            return existing["id"]
        cur = c.execute(
            "INSERT INTO alerts(kind,device_id,zone,level,title,detail,value,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (kind, dev["device_id"], dev["zone"], level, title, detail, value, now),
        )
        return cur.lastrowid


def _clear_alert(kind, device_id):
    with db.tx() as c:
        c.execute("UPDATE alerts SET cleared_at=? WHERE kind=? AND device_id=? AND cleared_at IS NULL",
                  (datetime.now().isoformat(), kind, device_id))


def _link_wo(alert_id, ref):
    with db.tx() as c:
        c.execute("UPDATE alerts SET work_order_ref=? WHERE id=?", (ref, alert_id))


def flood_stage(dev, value, current="NORMAL"):
    th = device_meta(dev)["thresholds"]
    stage = "NORMAL"
    for name in ("WASPADA", "AMARAN", "BAHAYA"):
        if value >= th[name]:
            stage = name
    # hysteresis: only step down once 5 cm below the current stage's threshold
    if config.FLOOD_LEVELS.index(stage) < config.FLOOD_LEVELS.index(current) and current != "NORMAL":
        if value > th[current] - 0.05:
            return current
    return stage


# Internal codes are the JPS Malay stage names; residents and staff see the English labels.
STAGE_EN = {"NORMAL": "Normal", "WASPADA": "Alert", "AMARAN": "Warning", "BAHAYA": "Danger"}
FLOOD_MSG = {
    "WASPADA": ("Water level ALERT", "Water at {name} is rising ({v:.2f} m). Keep watch and stay away from drains."),
    "AMARAN": ("Flood WARNING", "Water at {name} has reached {v:.2f} m. Move vehicles out of low-lying parts of {zone}. The drainage team is on the way."),
    "BAHAYA": ("DANGER — flash flood", "Water at {name} is {v:.2f} m and still rising. Keep away from drains and ponds and follow management instructions. Emergency line: 999."),
}


def evaluate(dev, value):
    did, kind, zone = dev["device_id"], dev["kind"], dev["zone"]

    if kind == "level":
        prev = state["flood_stage"].get(did, "NORMAL")
        stage = flood_stage(dev, value, prev)
        if stage == prev:
            return
        state["flood_stage"][did] = stage
        if stage == "NORMAL":
            _clear_alert("flood", did)
            notify.notify(zone, "NORMAL", "Water level back to normal", f"{dev['name']}: {value:.2f} m. Thank you for your cooperation.")
            return
        title, body = FLOOD_MSG[stage]
        aid = _raise_alert("flood", dev, stage, f"{STAGE_EN[stage]}: {dev['name']}", f"Water level {value:.2f} m", value)
        if config.FLOOD_LEVELS.index(stage) > config.FLOOD_LEVELS.index(prev):
            notify.notify(zone, stage, title, body.format(name=dev["name"], v=value, zone=zone))
        existing = workorders.open_for("flood", zone)
        if existing:
            _link_wo(aid, existing["ref"])
        elif stage in ("AMARAN", "BAHAYA"):
            wo = workorders.create("flood", f"Rising water at {dev['name']}", f"{did} reported {value:.2f} m ({STAGE_EN[stage]}). "
                                   "Inspect drain inlet, clear debris, deploy barriers if needed.", zone, "sensor",
                                   location=dev["name"], lat=dev["lat"], lng=dev["lng"])
            _link_wo(aid, wo["ref"])

    elif kind == "flow":
        exp = water.expected_flow(zone, datetime.now())
        excess = value - exp
        hit = excess > 0.4 and excess / exp > 0.35
        n = state["leak_counter"].get(zone, 0) + 1 if hit else 0
        state["leak_counter"][zone] = n
        if n == 5:
            aid = _raise_alert("leak", dev, "WARNING", f"Flow above profile — {zone}",
                               f"Inlet {value:.2f} m³/h vs expected {exp:.2f} m³/h (+{excess:.2f})", value)
            existing = workorders.open_for("water_leak", zone)
            if existing:
                _link_wo(aid, existing["ref"])
            else:
                wo = workorders.create("water_leak", f"Possible burst main — {zone}",
                                       f"{did} inlet flow {value:.2f} m³/h is {excess:.2f} m³/h above the demand profile for "
                                       f"this hour for 5 consecutive readings. Check for surface water, step-test valves.",
                                       zone, "sensor", location=dev["name"], lat=dev["lat"], lng=dev["lng"])
                _link_wo(aid, wo["ref"])
        elif n == 0 and _active_alert("leak", did) and state["leak"].get(zone, 0) < 0.3:
            _clear_alert("leak", did)

    elif kind == "pressure":
        level = "CRITICAL" if value < PRESSURE_CRIT else "WARNING" if value < PRESSURE_WARN else "NORMAL"
        if level == state["pressure_level"]:
            return
        state["pressure_level"] = level
        if level == "NORMAL":
            _clear_alert("pressure", did)
        else:
            _raise_alert("pressure", dev, level, f"Low pressure {did}", f"{value:.2f} bar (warn < {PRESSURE_WARN}, critical < {PRESSURE_CRIT})", value)
            if level == "CRITICAL":
                notify.notify(zone, "WARNING", "Low water pressure", f"Water supply in {zone} may be weak while our team inspects the pipes. Sorry for the inconvenience.")


def check_mnf():
    """Raise a work order for any zone the nightly MNF analysis flags."""
    lv = live_values()
    for zone in config.ZONES:
        a = water.analyse(zone, lv.get(water.FLOW_METER[zone]))
        dev = db.q1("SELECT * FROM devices WHERE device_id=?", (water.FLOW_METER[zone],))
        if a["leak_suspected"]:
            aid = _raise_alert("mnf", dev, "WARNING", f"Night-flow leak — {zone}",
                               f"MNF {a['latest_mnf_m3h']} m³/h vs expected {a['expected_night_m3h']} m³/h since {a['leak_since']}; "
                               f"≈{a['loss_m3_per_day']} m³/day lost", a["latest_mnf_m3h"])
            existing = workorders.open_for("water_leak", zone)
            if existing:
                _link_wo(aid, existing["ref"])
            else:
                wo = workorders.create("water_leak", f"Hidden leak (night flow) — {zone}",
                                       f"Minimum night flow has been {a['excess_m3h']} m³/h above expected since {a['leak_since']}. "
                                       f"Estimated loss {a['loss_m3_per_day']} m³/day (RM {a['loss_rm_per_day']}/day). "
                                       "Run a step test to localise the leak.", zone, "sensor",
                                       location=dev["name"], lat=dev["lat"], lng=dev["lng"])
                _link_wo(aid, wo["ref"])


@workorders.on_resolve
def _repair_closes_sim_leak(wo):
    """In simulation, resolving a leak job 'repairs' the pipe so the dashboard closes the loop."""
    if wo["category"] == "water_leak" and state["leak"].get(wo["zone"], 0) > 0:
        state["leak"][wo["zone"]] = 0.0
        db.set_setting("sim_leak", json.dumps(state["leak"]))
        state["leak_counter"][wo["zone"]] = 0
        for d in db.q("SELECT device_id FROM devices WHERE zone=? AND kind IN ('flow','pressure')", (wo["zone"],)):
            for k in ("leak", "pressure"):
                _clear_alert(k, d["device_id"])
    if wo["category"] == "water_leak":
        for d in db.q("SELECT device_id FROM devices WHERE zone=? AND kind='flow'", (wo["zone"],)):
            _clear_alert("mnf", d["device_id"])


# ------------------------------------------------------------------ simulator
def _noise(scale):
    return random.gauss(0, scale)


def sim_value(dev, now, prev, leak=None, rain=None):
    did, kind, zone = dev["device_id"], dev["kind"], dev["zone"]
    if did in state["overrides"]:
        return state["overrides"][did]
    mode = state["faults"].get(did)
    if mode == "stuck":
        return state["frozen"].get(did, prev)
    if mode == "spike":
        return device_meta(dev)["depth"] * 2.2 if kind == "level" else config.FAULT_SPIKE.get(kind, 999.0)
    leak = state["leak"] if leak is None else leak
    if kind == "flow":
        return max(0.0, round(water.expected_flow(zone, now) * (1 + _noise(0.05)) + leak.get(zone, 0), 3))
    if kind == "pressure":
        avg = water.avg_demand_m3h("Zone C")
        dem = water.expected_flow("Zone C", now)
        p = 3.3 - 0.35 * (dem / avg - 1) - leak.get("Zone C", 0) * 0.55 + _noise(0.03)
        return round(max(0.3, p), 2)
    if kind == "rain":
        target = state["rain_target"] if rain is None else rain
        cur = prev if prev is not None else 0.0
        return round(max(0.0, cur + (target - cur) * 0.15 + (_noise(1.5) if target > 0 else 0)), 1)
    if kind == "level":
        meta = device_meta(dev)
        base = meta["depth"] * (0.40 if did == "DL-C1" else 0.12)
        r = state.get("_rain_now", 0.0) if rain is None else rain
        # a full channel overflows: the reading levels off a little above the wall instead of rising for ever
        target = min(base + min(r, 120) * meta["depth"] * 0.9 / 80, meta["depth"] * 1.25)
        cur = prev if prev is not None else base
        return round(max(0.0, cur + (target - cur) * 0.045 + _noise(0.004)), 3)
    if kind == "bin":
        rate = state["bin_rate"].setdefault(did, random.uniform(0.008, 0.05))
        cur = prev if prev is not None else random.uniform(15, 70)
        return round(min(100.0, cur + rate * random.uniform(0.6, 1.4)), 1)
    return prev


def backfill(days=7):
    """Generate a week of 15-minute history (clearly sourced 'sim') so night-flow analysis has data on first run.
    Zone C carries a hidden leak (NEXORA_SEED_LEAK_M3H, default none) that began 3 nights ago."""
    if db.q1("SELECT 1 FROM readings LIMIT 1"):
        return
    devs = [d for d in db.q("SELECT * FROM devices") if d["kind"] in ("flow", "pressure", "rain", "level")]
    now = datetime.now().replace(second=0, microsecond=0)
    t = now - timedelta(days=days)
    leak_start = (now - timedelta(days=3)).replace(hour=0, minute=0)
    prev = {}
    rows = []
    showers = [(now - timedelta(days=5, hours=-15), 2.5, 35), (now - timedelta(days=2, hours=-17), 1.5, 22)]
    while t <= now:
        leak = {"Zone A": 0.0, "Zone B": 0.0, "Zone C": config.SEED_HIDDEN_LEAK_M3H if t >= leak_start else 0.0}
        rain = 0.0
        for start, dur_h, peak in showers:
            dt = (t - start).total_seconds() / 3600
            if 0 <= dt <= dur_h:
                rain = peak * math.sin(math.pi * dt / dur_h)
        for d in devs:
            if d["kind"] == "level":
                # 15-min step: approach target faster than the 3 s live tick
                meta = device_meta(d)
                base = meta["depth"] * (0.40 if d["device_id"] == "DL-C1" else 0.12)
                target = base + rain * meta["depth"] * 0.9 / 80
                cur = prev.get(d["device_id"], base)
                v = round(cur + (target - cur) * 0.6, 3)
            elif d["kind"] == "rain":
                v = round(max(0.0, rain + (_noise(0.8) if rain > 0 else 0)), 1)
            else:
                v = sim_value(d, t, prev.get(d["device_id"]), leak=leak, rain=rain)
            prev[d["device_id"]] = v
            rows.append((d["device_id"], t.isoformat(), v, "sim"))
        t += timedelta(minutes=15)
    with db.tx() as c:
        c.executemany("INSERT INTO readings(device_id,ts,value,source) VALUES(?,?,?,?)", rows)
        for did, v in prev.items():
            c.execute("UPDATE devices SET last_value=?, last_seen=? WHERE device_id=?", (v, now.isoformat(), did))


def seed_history():
    """A month of plausible past jobs + collection runs so reports aren't empty on day one (marked actor='seed')."""
    if db.get_setting("seeded"):
        return
    rnd = random.Random(7)
    now = datetime.now()
    samples = [
        ("streetlight", "Streetlight not working", "Zone B", 30), ("road", "Pothole near surau", "Zone A", 64),
        ("waste", "Bin overflowing at playground", "Zone C", 18), ("drain", "Drain blocked with leaves", "Zone A", 20),
        ("water_supply", "Low water pressure upstairs", "Zone C", 6), ("streetlight", "Flickering lamp post", "Zone A", 40),
        ("waste", "Bulky waste not collected", "Zone B", 30), ("road", "Uneven pedestrian crossing", "Zone C", 80),
        ("drain", "Stagnant water — mosquito risk", "Zone C", 16), ("other", "Broken bench at park", "Zone A", 50),
        ("water_leak", "Water bubbling from pavement", "Zone A", 3), ("streetlight", "Dark stretch near bus stop", "Zone C", 36),
    ]
    resident = db.q1("SELECT id FROM users WHERE role='resident'")
    for i, (cat, title, zone, hours) in enumerate(samples):
        created = now - timedelta(days=rnd.uniform(3, 28))
        sla_h, pri = config.SLA[cat]
        resolved = created + timedelta(hours=hours * rnd.uniform(0.7, 1.15))
        with db.tx() as c:
            ref = f"NX-{created:%y%m}-S{i + 1:03d}"
            cur = c.execute(
                """INSERT INTO work_orders(ref,category,title,description,zone,priority,status,source,reporter_id,team,
                   sla_hours,due_at,created_at,updated_at,resolved_at,rating) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (ref, cat, title, "", zone, pri, "CLOSED", "resident" if cat != "water_leak" else "sensor",
                 resident["id"] if resident and cat != "water_leak" else None, config.CATEGORY_TEAM[cat], sla_h,
                 (created + timedelta(hours=sla_h)).isoformat(), created.isoformat(), resolved.isoformat(), resolved.isoformat(),
                 rnd.choice([4, 5, 5, 3, 4]) if cat != "water_leak" else None),
            )
            for st, ts in (("SUBMITTED", created), ("ASSIGNED", created + timedelta(minutes=20)), ("RESOLVED", resolved), ("CLOSED", resolved)):
                c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)", (cur.lastrowid, ts.isoformat(), st, st.title(), "seed"))
    for d in range(10):
        base = rnd.uniform(9.5, 10.5)
        route = base * rnd.uniform(0.45, 0.7)
        saved = (base - route) * config.TRUCK_L_PER_KM
        with db.tx() as c:
            c.execute("INSERT INTO collections(ts,bins,route_km,baseline_km,fuel_saved_l,co2_saved_kg) VALUES(?,?,?,?,?,?)",
                      ((now - timedelta(days=d * 2 + 1)).isoformat(), rnd.randint(5, 8), round(route, 2), round(base, 2),
                       round(saved, 2), round(saved * config.DIESEL_CO2_KG_PER_L, 2)))
    db.set_setting("seeded", "1")


async def run_simulator():
    state["started"] = datetime.now()
    mnf_check_at = datetime.min
    prune_at = datetime.min
    while True:
        try:
            now = datetime.now()
            if state["sim_enabled"]:
                devs = db.q("SELECT * FROM devices")
                rain_dev = next((d for d in devs if d["kind"] == "rain"), None)
                if rain_dev:
                    state["_rain_now"] = rain_dev["last_value"] or 0.0
                for d in devs:
                    seen = state["real_seen"].get(d["device_id"])
                    if seen and (now - seen).total_seconds() < REAL_DEVICE_GRACE_S:
                        continue  # a real ESP32 owns this device right now
                    v = sim_value(d, now, d["last_value"])
                    if v is None:
                        continue
                    b = state["battery"].get(d["device_id"], random.uniform(78, 100))
                    state["battery"][d["device_id"]] = max(5, b - 0.0005)
                    ingest(d["device_id"], v, source="sim", rssi=int(random.gauss(-67, 6)), battery=round(b, 1))
            if now >= mnf_check_at:
                check_mnf()
                mnf_check_at = now + timedelta(seconds=60)
            if now >= prune_at:
                with db.tx() as c:
                    c.execute("DELETE FROM readings WHERE ts < ?", ((now - timedelta(days=14)).isoformat(),))
                prune_at = now + timedelta(hours=1)
        except Exception as exc:  # keep the loop alive; surface the error in logs
            print("[nexora-sim] error:", repr(exc))
        await asyncio.sleep(TICK_S)


@workorders.on_resolve
def _repair_sensor(wo):
    """In simulation, closing a sensor-fault job means the technician fixed or swapped the node."""
    if wo["category"] != "sensor_fault":
        return
    for a in db.q("SELECT DISTINCT device_id FROM alerts WHERE kind='sensor_fault' AND work_order_ref=?", (wo["ref"],)):
        state["faults"].pop(a["device_id"], None)
        state["frozen"].pop(a["device_id"], None)
        _clear_fault(a["device_id"])


def set_sensor_fault(device_id, mode):
    """Simulator only: make a virtual sensor fail ('stuck' or 'spike'), or repair it with mode=None."""
    if mode is None:
        state["faults"].pop(device_id, None)
        state["frozen"].pop(device_id, None)
        return
    dev = db.q1("SELECT last_value FROM devices WHERE device_id=?", (device_id,))
    state["faults"][device_id] = mode
    state["frozen"][device_id] = (dev or {}).get("last_value")


def reset_demo(actor):
    """Put the township back to calm so the guided demo can be replayed.

    Nothing is deleted: sensor-raised flood / sensor-fault jobs that are still open are CLOSED with a note, so the
    audit trail shows what happened. Jobs raised by residents and the hidden-leak job are left alone."""
    now = datetime.now().isoformat()
    state["rain_target"] = 0.0
    state["overrides"].clear()
    state["flood_stage"].clear()
    for did in list(state["faults"]):
        set_sensor_fault(did, None)
    for did in list(state["fault_reason"]):
        _clear_fault(did)
    state["recent"].clear()
    # remove a simulated burst; a seeded hidden leak (if the deployment has one) stays
    for zone in list(state["leak"]):
        state["leak"][zone] = config.SEED_HIDDEN_LEAK_M3H if zone == "Zone C" else 0.0
    state["leak_counter"].clear()
    db.set_setting("sim_leak", json.dumps(state["leak"]))
    cats = ("flood", "sensor_fault") if config.SEED_HIDDEN_LEAK_M3H > 0 else ("flood", "sensor_fault", "water_leak")
    marks = ",".join("?" * len(cats))
    closed = 0
    with db.tx() as c:
        for w in c.execute("SELECT id FROM work_orders WHERE source='sensor' AND category IN (" + marks + ") "
                           "AND status NOT IN ('RESOLVED','CLOSED')", cats).fetchall():
            c.execute("UPDATE work_orders SET status='CLOSED', resolved_at=?, updated_at=?, "
                      "approval=CASE WHEN approval='pending' THEN 'cancelled' ELSE approval END WHERE id=?", (now, now, w["id"]))
            c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                      (w["id"], now, "CLOSED", "Closed by demo reset", actor))
            closed += 1
        kinds = ("flood", "sensor_fault") if config.SEED_HIDDEN_LEAK_M3H > 0 else ("flood", "sensor_fault", "leak")
        c.execute("UPDATE alerts SET cleared_at=? WHERE kind IN (" + ",".join("?" * len(kinds)) + ") AND cleared_at IS NULL", (now, *kinds))
        # calm water levels and rain straight away instead of waiting for them to recede
        for d in c.execute("SELECT device_id,kind,meta FROM devices WHERE kind IN ('level','rain')").fetchall():
            if d["kind"] == "rain":
                base = 0.0
            else:
                base = json.loads(d["meta"])["depth"] * (0.40 if d["device_id"] == "DL-C1" else 0.12)
            c.execute("UPDATE devices SET last_value=? WHERE device_id=?", (round(base, 3), d["device_id"]))
    return {"closed_jobs": closed}


def set_leak(zone, m3h):
    state["leak"][zone] = max(0.0, float(m3h))
    db.set_setting("sim_leak", json.dumps(state["leak"]))


def collect_bins(device_ids):
    for did in device_ids:
        state["overrides"].pop(did, None)
        ingest(did, round(random.uniform(2, 8), 1), source="sim", force_persist=True)
