"""Leak detection for District Metered Areas — rule-based, no AI.

1. Minimum Night Flow (MNF): between 02:00 and 04:00 almost nobody uses water,
   so the inlet flow ≈ legitimate night use + leakage. If the measured night flow
   is clearly above the expected night use, the zone is leaking.
       expected_night = properties × (night use + background allowance)
       excess         = MNF − expected_night
       daily loss     ≈ excess × hour-day factor (pressure is higher at night)
2. Live profile check: inlet flow vs the zone's demand profile for this hour —
   catches a burst immediately instead of waiting for the night.
"""
from datetime import datetime, timedelta
from statistics import mean, median

from . import config, db

FLOW_METER = {"Zone A": "FM-A", "Zone B": "FM-B", "Zone C": "FM-C"}


def avg_demand_m3h(zone):
    return config.ZONES[zone]["residents"] * config.WATER_PER_CAPITA_LPD / 1000 / 24


def profile(zone):
    return config.COMMERCIAL_DIURNAL if config.ZONES[zone]["type"] == "Commercial" else config.DIURNAL


def background_m3h(zone):
    return config.ZONES[zone]["properties"] * config.BACKGROUND_LEAK_L_PER_PROP_H / 1000


def expected_flow(zone, when: datetime):
    """Demand model for a healthy zone at a given time (m³/h)."""
    prof = profile(zone)
    h = when.hour + when.minute / 60
    a, b = prof[int(h) % 24], prof[(int(h) + 1) % 24]
    mult = a + (b - a) * (h - int(h))
    return avg_demand_m3h(zone) * mult + background_m3h(zone)


def expected_night(zone):
    p = config.ZONES[zone]["properties"]
    return p * (config.NIGHT_USE_L_PER_PROP_H + config.BACKGROUND_LEAK_L_PER_PROP_H) / 1000


def night_flows(zone, nights=7, now=None):
    now = now or datetime.now()
    dev = FLOW_METER[zone]
    out = []
    # the most recent completed night window
    last = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if now.hour < config.NIGHT_WINDOW[1]:
        last -= timedelta(days=1)
    for i in range(nights - 1, -1, -1):
        day = last - timedelta(days=i)
        start = day.replace(hour=config.NIGHT_WINDOW[0])
        end = day.replace(hour=config.NIGHT_WINDOW[1])
        rows = db.q("SELECT value FROM readings WHERE device_id=? AND ts>=? AND ts<?", (dev, start.isoformat(), end.isoformat()))
        vals = [r["value"] for r in rows]
        out.append({
            "night": day.strftime("%Y-%m-%d"),
            "label": day.strftime("%a %d"),
            "mnf": round(mean(vals), 3) if vals else None,
            "min": round(min(vals), 3) if vals else None,
            "samples": len(vals),
        })
    return out


def analyse(zone, live_value=None):
    exp_night = expected_night(zone)
    nights = night_flows(zone)
    flagged_nights = []
    for n in nights:
        if n["mnf"] is None:
            n["excess"] = None
            n["leak"] = False
            continue
        n["excess"] = round(n["mnf"] - exp_night, 3)
        n["leak"] = n["excess"] > config.LEAK_MARGIN_M3H
        if n["leak"]:
            flagged_nights.append(n)
    latest = next((n for n in reversed(nights) if n["mnf"] is not None), None)

    # when did the current run of leaking nights start?
    since = None
    for n in reversed(nights):
        if n.get("leak"):
            since = n["night"]
        elif n["mnf"] is not None:
            break

    excess = max(0.0, latest["excess"]) if latest and latest["mnf"] is not None else 0.0
    leaking = bool(latest and latest.get("leak"))

    # A leak job resolved after the last analysed night = repaired; tonight's MNF verifies the fix.
    repaired_at = None
    if leaking and latest:
        window_end = datetime.fromisoformat(latest["night"]).replace(hour=config.NIGHT_WINDOW[1])
        row = db.q1("SELECT resolved_at FROM work_orders WHERE category='water_leak' AND zone=? AND resolved_at>=? "
                    "ORDER BY resolved_at DESC LIMIT 1", (zone, window_end.isoformat()))
        if row:
            repaired_at = row["resolved_at"]
            leaking = False
    loss_m3_day = round(excess * config.HOUR_DAY_FACTOR, 2) if leaking else 0.0

    now = datetime.now()
    live_exp = expected_flow(zone, now)
    dev_pct = None
    if live_value is not None and live_exp > 0:
        dev_pct = round((live_value - live_exp) / live_exp * 100, 1)

    baseline = [n["mnf"] for n in nights if n["mnf"] is not None and not n["leak"]]
    return {
        "zone": zone,
        "meter": FLOW_METER[zone],
        "properties": config.ZONES[zone]["properties"],
        "expected_night_m3h": round(exp_night, 3),
        "healthy_mnf_median": round(median(baseline), 3) if baseline else None,
        "latest_mnf_m3h": latest["mnf"] if latest else None,
        "excess_m3h": round(excess, 3),
        "leak_suspected": leaking,
        "leak_since": since,
        "repaired_at": repaired_at,
        "verification_pending": bool(repaired_at),
        "loss_m3_per_day": loss_m3_day,
        "loss_rm_per_day": round(loss_m3_day * config.WATER_TARIFF_RM_M3, 2),
        "loss_rm_per_year": round(loss_m3_day * config.WATER_TARIFF_RM_M3 * 365),
        "nights": nights,
        "live": {
            "flow_m3h": live_value,
            "expected_m3h": round(live_exp, 3),
            "deviation_pct": dev_pct,
        },
    }


def summary(live_values):
    zones = [analyse(z, live_values.get(FLOW_METER[z])) for z in config.ZONES]
    return {
        "method": "Minimum Night Flow (02:00–04:00) + live demand-profile check",
        "assumptions": {
            "night_use_l_per_property_h": config.NIGHT_USE_L_PER_PROP_H,
            "background_l_per_property_h": config.BACKGROUND_LEAK_L_PER_PROP_H,
            "hour_day_factor": config.HOUR_DAY_FACTOR,
            "leak_margin_m3h": config.LEAK_MARGIN_M3H,
            "tariff_rm_m3": config.WATER_TARIFF_RM_M3,
            "per_capita_lpd": config.WATER_PER_CAPITA_LPD,
        },
        "zones": zones,
        "total_loss_m3_day": round(sum(z["loss_m3_per_day"] for z in zones), 2),
        "total_loss_rm_year": sum(z["loss_rm_per_year"] for z in zones),
    }


def series(device_id, hours=24):
    since = (datetime.now() - timedelta(hours=hours)).isoformat()
    rows = db.q("SELECT ts, value FROM readings WHERE device_id=? AND ts>=? ORDER BY ts", (device_id, since))
    return rows
