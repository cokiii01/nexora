"""/api/v2 — township services: auth, ingest, water, flood, waste, work orders, reports."""
import csv
import io
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import auth, config, db, engine, notify, waste, water, workorders

router = APIRouter(prefix="/api/v2", tags=["township"])
STAFF = ("operator", "manager")


# ------------------------------------------------------------------ auth
class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    email: str
    name: str
    password: str
    zone: str
    unit: str | None = None


@router.post("/auth/login")
def login(body: LoginIn):
    return auth.login(body.email, body.password)


@router.post("/auth/register")
def register(body: RegisterIn):
    return auth.register_resident(body.email, body.name, body.password, body.zone, body.unit)


@router.get("/auth/me")
def me(user=Depends(auth.current_user)):
    return auth.public_user(user)


@router.post("/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and " " in authorization:
        auth.logout(authorization.split(" ", 1)[1])
    return {"ok": True}


@router.get("/meta")
def meta():
    return {
        "zones": config.ZONES,
        "categories": [{"key": k, "label": config.CATEGORY_LABEL[k], "sla_hours": v[0], "priority": v[1]}
                       for k, v in config.SLA.items() if k != "sensor_fault"],   # sensor jobs are raised by the engine only
        "teams": config.TEAMS,
        "statuses": config.WO_STATUSES,
        "demo_accounts": [{"email": e, "role": r} for e, _, r, _, _ in config.DEMO_USERS],
    }


# ------------------------------------------------------------------ ingest (what the ESP32 calls)
class ReadingIn(BaseModel):
    device_id: str
    value: float
    rssi: int | None = None
    battery: float | None = Field(default=None, ge=0, le=100)


class BatchIn(BaseModel):
    readings: list[ReadingIn]


def _check_key(device_id, key):
    dev = db.q1("SELECT api_key FROM devices WHERE device_id=?", (device_id,))
    if not dev:
        raise HTTPException(404, f"Unknown device {device_id}")
    if not key or not secrets.compare_digest(dev["api_key"], key):
        raise HTTPException(401, "Bad device key")


@router.post("/ingest")
def ingest(body: ReadingIn | BatchIn, x_device_key: str | None = Header(default=None)):
    items = body.readings if isinstance(body, BatchIn) else [body]
    out = []
    for r in items:
        _check_key(r.device_id, x_device_key)
        out.append(engine.ingest(r.device_id, r.value, source="device", rssi=r.rssi, battery=r.battery))
    return {"accepted": len(out), "results": out, "server_time": datetime.now().isoformat()}


# ------------------------------------------------------------------ devices + simulator controls
@router.get("/devices")
def devices():
    return {"devices": engine.list_devices(), "sim_enabled": engine.state["sim_enabled"], "leak": engine.state["leak"],
            "rain_target": engine.state["rain_target"]}


@router.get("/devices/{device_id}/series")
def device_series(device_id: str, hours: int = 24):
    return {"device_id": device_id, "points": water.series(device_id, min(hours, 24 * 7))}


class OverrideIn(BaseModel):
    value: float | None = None


@router.post("/sim/override/{device_id}")
def sim_override(device_id: str, body: OverrideIn, _=Depends(auth.require(*STAFF))):
    if body.value is None:
        engine.state["overrides"].pop(device_id, None)
    else:
        engine.state["overrides"][device_id] = body.value
        engine.ingest(device_id, body.value, source="sim", force_persist=True)
    return {"overrides": engine.state["overrides"]}


class LeakIn(BaseModel):
    zone: str
    m3h: float = Field(ge=0, le=20)


@router.post("/sim/leak")
def sim_leak(body: LeakIn, _=Depends(auth.require(*STAFF))):
    if body.zone not in config.ZONES:
        raise HTTPException(400, "Unknown zone")
    engine.set_leak(body.zone, body.m3h)
    return {"leak": engine.state["leak"]}


@router.post("/sim/reset")
def sim_reset(user=Depends(auth.require(*STAFF))):
    """Calm the township (rain off, sensors repaired, demo jobs closed). Used by the guided demo before and after a run."""
    return engine.reset_demo(user["name"])


class FaultIn(BaseModel):
    device_id: str
    mode: str | None = None   # "stuck" | "spike" | null (repair)


@router.post("/sim/fault")
def sim_fault(body: FaultIn, _=Depends(auth.require(*STAFF))):
    if not db.q1("SELECT 1 FROM devices WHERE device_id=?", (body.device_id,)):
        raise HTTPException(404, f"Unknown device {body.device_id}")
    if body.mode not in (None, "stuck", "spike"):
        raise HTTPException(400, "mode must be 'stuck', 'spike' or null")
    engine.set_sensor_fault(body.device_id, body.mode)
    return {"faults": engine.state["faults"]}


class RainIn(BaseModel):
    mm_per_h: float = Field(ge=0, le=150)


@router.post("/sim/rain")
def sim_rain(body: RainIn, _=Depends(auth.require(*STAFF))):
    engine.state["rain_target"] = body.mm_per_h
    return {"rain_target": body.mm_per_h}


class SimToggle(BaseModel):
    enabled: bool


@router.post("/sim/enabled")
def sim_enabled(body: SimToggle, _=Depends(auth.require(*STAFF))):
    engine.state["sim_enabled"] = body.enabled
    return {"sim_enabled": body.enabled}


# ------------------------------------------------------------------ water
@router.get("/water")
def water_summary():
    return water.summary(engine.live_values())


@router.get("/water/{zone_key}/series")
def water_series(zone_key: str, hours: int = 24):
    zone = f"Zone {zone_key.upper()[-1]}"
    if zone not in config.ZONES:
        raise HTTPException(404, "Unknown zone")
    pts = water.series(water.FLOW_METER[zone], min(hours, 168))
    for p in pts:
        p["expected"] = round(water.expected_flow(zone, datetime.fromisoformat(p["ts"])), 3)
    return {"zone": zone, "points": pts}


# ------------------------------------------------------------------ flood
@router.get("/flood")
def flood():
    devs = [d for d in engine.list_devices() if d["kind"] in ("level", "rain")]
    out = []
    for d in devs:
        if d["kind"] == "level":
            d["stage"] = engine.state["flood_stage"].get(d["device_id"], "NORMAL")
            prev = db.q1("SELECT value FROM readings WHERE device_id=? AND ts<=? ORDER BY ts DESC LIMIT 1",
                         (d["device_id"], (datetime.now() - timedelta(minutes=10)).isoformat()))
            d["rise_cm_per_10min"] = round(((d["last_value"] or 0) - prev["value"]) * 100, 1) if prev else None
        out.append(d)
    return {
        "stages": config.FLOOD_LEVELS,
        "sensors": out,
        "alerts": db.q("SELECT * FROM alerts WHERE kind='flood' ORDER BY id DESC LIMIT 20"),
        "notifications": notify.list_for(None, 20),
        "telegram": bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID")),
    }


# ------------------------------------------------------------------ waste
@router.get("/waste")
def waste_plan(threshold: int = config.BIN_COLLECT_THRESHOLD):
    p = waste.plan(max(10, min(100, threshold)))
    p["history"] = waste.history(10)
    return p


class CollectIn(BaseModel):
    threshold: int = config.BIN_COLLECT_THRESHOLD


@router.post("/waste/collect")
def waste_collect(body: CollectIn, _=Depends(auth.require(*STAFF))):
    p = waste.plan(body.threshold)
    if not p["due"]:
        raise HTTPException(400, "No bins above threshold")
    waste.record_collection(p)
    engine.collect_bins(p["due"])
    return {"collected": p["due"], "route_km": p["route_km"], "saved_km": p["saved_km"]}


# ------------------------------------------------------------------ alerts / notifications
@router.get("/alerts")
def alerts(active: bool = True):
    sql = "SELECT * FROM alerts" + (" WHERE cleared_at IS NULL" if active else "") + " ORDER BY id DESC LIMIT 50"
    return db.q(sql)


@router.get("/notifications")
def my_notifications(user=Depends(auth.current_user)):
    return notify.list_for(user["zone"] if user["role"] == "resident" else None)


# ------------------------------------------------------------------ work orders
@router.get("/work-orders")
def wo_list(status: str | None = None, zone: str | None = None, category: str | None = None, open_only: bool = False,
            user=Depends(auth.current_user)):
    reporter = user["id"] if user["role"] == "resident" else None
    return workorders.list_(status, zone, category, reporter, open_only)


@router.post("/work-orders")
async def wo_create(
    category: str = Form(...), title: str = Form(...), description: str = Form(""), zone: str | None = Form(None),
    location: str = Form(""), lat: float | None = Form(None), lng: float | None = Form(None),
    photo: UploadFile | None = File(None), user=Depends(auth.current_user),
):
    zone = zone or user["zone"]
    if not zone:
        raise HTTPException(400, "Zone is required")
    photo_name = None
    if photo and photo.filename:
        ext = os.path.splitext(photo.filename)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".heic"):
            raise HTTPException(400, "Photo must be JPG, PNG, WEBP or HEIC")
        data = await photo.read()
        if len(data) > 8 * 1024 * 1024:
            raise HTTPException(400, "Photo larger than 8 MB")
        photo_name = secrets.token_hex(8) + ext
        with open(os.path.join(db.UPLOAD_DIR, photo_name), "wb") as f:
            f.write(data)
    src = "resident" if user["role"] == "resident" else "staff"
    return workorders.create(category, title, description, zone, src, reporter_id=user["id"] if src == "resident" else None,
                             location=location or (user["unit"] if src == "resident" else None), lat=lat, lng=lng,
                             photo=photo_name, actor=user["name"])


@router.get("/work-orders/track/{ref}")
def wo_track(ref: str):
    """Public tracking by reference — hides reporter details."""
    wo = workorders.get(ref=ref.upper())
    for k in ("reporter_id", "reporter_name", "reporter_unit", "lat", "lng"):
        wo.pop(k, None)
    return wo


@router.get("/work-orders/{wid}")
def wo_get(wid: int, user=Depends(auth.current_user)):
    wo = workorders.get(wid)
    if user["role"] == "resident" and wo["reporter_id"] != user["id"]:
        raise HTTPException(403, "Not your report")
    return wo


class WoUpdate(BaseModel):
    status: str | None = None
    team: str | None = None
    note: str | None = None


@router.patch("/work-orders/{wid}")
def wo_update(wid: int, body: WoUpdate, user=Depends(auth.require(*STAFF))):
    return workorders.update(wid, user["name"], body.status, body.team, body.note)


class ApproveIn(BaseModel):
    team: str | None = None
    note: str | None = None


@router.post("/work-orders/{wid}/approve")
def wo_approve(wid: int, body: ApproveIn, user=Depends(auth.require(*STAFF))):
    return workorders.approve(wid, user["name"], body.team, body.note)


class RateIn(BaseModel):
    rating: int = Field(ge=1, le=5)


@router.post("/work-orders/{wid}/rate")
def wo_rate(wid: int, body: RateIn, user=Depends(auth.require("resident"))):
    return workorders.rate(wid, user["id"], body.rating)


@router.get("/uploads/{name}")
def upload(name: str):
    path = os.path.join(db.UPLOAD_DIR, os.path.basename(name))
    if not os.path.exists(path):
        raise HTTPException(404, "Not found")
    return FileResponse(path)


# ------------------------------------------------------------------ overview + reports
@router.get("/summary")
def summary():
    w = water.summary(engine.live_values())
    wo_open = workorders.list_(open_only=True)
    stages = engine.state["flood_stage"]
    worst = max(stages.values(), key=config.FLOOD_LEVELS.index, default="NORMAL")
    plan = waste.plan()
    return {
        "work_orders_open": len(wo_open),
        "work_orders_breached": sum(1 for x in wo_open if x["sla"]["state"] == "breached"),
        "open_list": wo_open[:6],
        "water_loss_m3_day": w["total_loss_m3_day"],
        "water_loss_rm_year": w["total_loss_rm_year"],
        "leaking_zones": [z["zone"] for z in w["zones"] if z["leak_suspected"]],
        "flood_stage": worst,
        "bins_due": len(plan["due"]),
        "route_saving_pct": plan["saved_pct"],
        "active_alerts": db.q("SELECT * FROM alerts WHERE cleared_at IS NULL ORDER BY id DESC LIMIT 10"),
        "devices_online": sum(1 for d in engine.list_devices() if d["online"]),
        "sensor_faults": sorted(engine.state["fault_reason"]),
        "awaiting_approval": sum(1 for x in wo_open if x["awaiting_approval"]),
        "devices_total": len(config.DEVICES),
        "stats": workorders.stats(30),
    }


@router.get("/reports/monthly")
def monthly_report(days: int = 30, _=Depends(auth.require(*STAFF))):
    w = water.summary(engine.live_values())
    hist = waste.history(200)
    since = (datetime.now() - timedelta(days=days)).isoformat()
    flood_alerts = db.q("SELECT level, COUNT(*) n FROM alerts WHERE kind='flood' AND created_at>=? GROUP BY level", (since,))
    return {
        "generated_at": datetime.now().isoformat(),
        "period_days": days,
        "work_orders": workorders.stats(days),
        "water": {"zones": [{k: z[k] for k in ("zone", "leak_suspected", "leak_since", "latest_mnf_m3h", "expected_night_m3h",
                                                 "loss_m3_per_day", "loss_rm_per_year")} for z in w["zones"]],
                  "total_loss_m3_day": w["total_loss_m3_day"], "assumptions": w["assumptions"]},
        "waste": hist["totals"],
        "flood": {"alerts_by_level": flood_alerts,
                  "notifications_sent": db.q1("SELECT COUNT(*) n FROM notifications WHERE created_at>=?", (since,))["n"]},
    }


def _minutes_between(a, b):
    try:
        return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 60
    except (TypeError, ValueError):
        return None


@router.get("/reports/resilience")
def resilience_report(days: int = 30, _=Depends(auth.require(*STAFF))):
    """Climate-resilience report: how early water problems were caught, how fast people acted, where the risk sits.

    Everything is computed from stored alerts / jobs / sensor state. Anything that is an assumption is labelled as one.
    """
    days = max(1, min(days, 365))
    since = (datetime.now() - timedelta(days=days)).isoformat()
    w = water.summary(engine.live_values())

    # --- flood exposure by sensor (high-risk assets)
    fl = db.q("SELECT device_id, zone, level, created_at FROM alerts WHERE kind='flood' AND created_at>=?", (since,))
    names = {d["device_id"]: d["name"] for d in db.q("SELECT device_id, name FROM devices")}
    risk = {}
    for a in fl:
        r = risk.setdefault(a["device_id"], {"device_id": a["device_id"], "name": names.get(a["device_id"], a["device_id"]),
                                             "zone": a["zone"], "alerts": 0, "worst": "NORMAL"})
        r["alerts"] += 1
        if a["level"] in config.FLOOD_LEVELS and config.FLOOD_LEVELS.index(a["level"]) > config.FLOOD_LEVELS.index(r["worst"]):
            r["worst"] = a["level"]
    high_risk = sorted(risk.values(), key=lambda r: (config.FLOOD_LEVELS.index(r["worst"]), r["alerts"]), reverse=True)
    by_level = {lvl: sum(1 for a in fl if a["level"] == lvl) for lvl in config.FLOOD_LEVELS[1:]}

    # --- response: sensor-raised flood / leak jobs, creation -> human approval -> resolution
    jobs = db.q("SELECT * FROM work_orders WHERE source='sensor' AND category IN ('flood','water_leak') AND created_at>=?", (since,))
    appr = [m for m in (_minutes_between(j["created_at"], j["approved_at"]) for j in jobs if j["approved_at"]) if m is not None]
    done = [(_minutes_between(j["created_at"], j["resolved_at"]) or 0) / 60 for j in jobs if j["resolved_at"]]
    pending = sum(1 for j in jobs if j["approval"] == "pending")

    # --- sensor health
    live = [d for d in engine.list_devices() if d["kind"] != "bin"]
    faulty = [d["device_id"] for d in live if d.get("fault")]
    fault_alerts = db.q("SELECT device_id, created_at, cleared_at FROM alerts WHERE kind='sensor_fault' AND created_at>=?", (since,))
    fixed = [m for m in (_minutes_between(a["created_at"], a["cleared_at"]) for a in fault_alerts if a["cleared_at"]) if m is not None]
    availability = round((len(live) - len(faulty)) / len(live) * 100, 1) if live else None

    # --- water
    leak_alerts = db.q1("SELECT COUNT(*) n FROM alerts WHERE kind IN ('mnf','leak') AND created_at>=?", (since,))["n"]
    recovery = 0.7   # assumption: share of the detected loss that is recovered once repaired
    m3_year = round(w["total_loss_m3_day"] * recovery * 365)
    return {
        "generated_at": datetime.now().isoformat(),
        "period_days": days,
        "alignment": "Supports SDP's Climate Resilience pillar: climate adaptation and resilience plans for high-risk assets.",
        "flood": {"alerts_by_level": by_level, "alerts_total": len(fl), "high_risk": high_risk[:5],
                  "notifications_sent": db.q1("SELECT COUNT(*) n FROM notifications WHERE created_at>=?", (since,))["n"]},
        "response": {"jobs": len(jobs), "awaiting_approval": pending,
                     "avg_minutes_to_approval": round(sum(appr) / len(appr), 1) if appr else None,
                     "avg_hours_to_resolution": round(sum(done) / len(done), 1) if done else None},
        "sensors": {"monitored": len(live), "faulty_now": faulty, "faults_in_period": len(fault_alerts),
                    "avg_minutes_to_repair": round(sum(fixed) / len(fixed), 1) if fixed else None,
                    "availability_pct": availability},
        "water": {"leak_alerts": leak_alerts, "loss_m3_day": w["total_loss_m3_day"], "loss_rm_year": w["total_loss_rm_year"],
                  "leaking_zones": [z["zone"] for z in w["zones"] if z["leak_suspected"]],
                  "recoverable_m3_year": m3_year, "recovery_assumption_pct": int(recovery * 100),
                  "tariff_rm_m3": config.WATER_TARIFF_RM_M3},
        "notes": ["Counts come from this system's own alert and job history; a new deployment starts at zero.",
                  "Recoverable water is an estimate: detected loss x recovery assumption x 365 days.",
                  "Flood stages follow the JPS-style Alert / Warning / Danger levels set in config."],
    }


@router.get("/reports/work-orders.csv")
def export_wo(token: str | None = None, authorization: str | None = Header(default=None)):
    # allow ?token= so a plain <a href> download works
    user = auth.current_user(authorization or (f"Bearer {token}" if token else None))
    if user["role"] not in STAFF:
        raise HTTPException(403, "Staff only")
    rows = workorders.list_(limit=5000)
    buf = io.StringIO()
    wr = csv.writer(buf)
    wr.writerow(["ref", "category", "title", "zone", "priority", "status", "source", "team", "created_at", "due_at",
                 "resolved_at", "sla_hours", "elapsed_hours", "sla_state", "rating"])
    for r in rows:
        wr.writerow([r["ref"], r["category_label"], r["title"], r["zone"], r["priority"], r["status"], r["source"], r["team"] or "",
                     r["created_at"], r["due_at"], r["resolved_at"] or "", r["sla_hours"], r["sla"]["elapsed_hours"],
                     r["sla"]["state"], r["rating"] or ""])
    buf.seek(0)
    name = f"nexora-work-orders-{datetime.now():%Y%m%d}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/reports/readings.csv")
def export_readings(device_id: str, hours: int = 168, token: str | None = None, authorization: str | None = Header(default=None)):
    auth.current_user(authorization or (f"Bearer {token}" if token else None))
    pts = water.series(device_id, min(hours, 24 * 14))
    buf = io.StringIO()
    wr = csv.writer(buf)
    wr.writerow(["ts", "device_id", "value"])
    for p in pts:
        wr.writerow([p["ts"], device_id, p["value"]])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{device_id}-readings.csv"'})


# ------------------------------------------------------------------ startup
def startup():
    db.connect()
    auth.seed_users()
    engine.seed_devices()
    engine.backfill()
    engine.seed_history()
