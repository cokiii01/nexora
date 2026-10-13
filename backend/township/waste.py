"""Fill-level based waste collection with route optimisation (no AI).

Only bins at/above the threshold are collected. The visiting order is solved as a
Travelling Salesman Problem: nearest-neighbour construction + 2-opt improvement,
starting and ending at the depot. Distances are haversine × road circuity.

Baseline for the savings figure = the *same* optimiser visiting every bin
(today's fixed schedule) — so the comparison is conservative.
"""
import math
from datetime import datetime

from . import config, db


def haversine_km(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def road_km(a, b):
    return haversine_km(a, b) * config.ROAD_CIRCUITY


def tour_length(points, order):
    return sum(road_km(points[order[i]], points[order[i + 1]]) for i in range(len(order) - 1))


def solve_tsp(points):
    """points[0] is the depot. Returns closed tour [0, ..., 0]."""
    n = len(points)
    if n <= 1:
        return [0, 0]
    unvisited = set(range(1, n))
    order = [0]
    while unvisited:
        last = order[-1]
        nxt = min(unvisited, key=lambda j: road_km(points[last], points[j]))
        order.append(nxt)
        unvisited.remove(nxt)
    order.append(0)
    improved = True
    while improved:
        improved = False
        for i in range(1, len(order) - 2):
            for k in range(i + 1, len(order) - 1):
                a, b, c, d = order[i - 1], order[i], order[k], order[k + 1]
                delta = (road_km(points[a], points[c]) + road_km(points[b], points[d])
                         - road_km(points[a], points[b]) - road_km(points[c], points[d]))
                if delta < -1e-9:
                    order[i:k + 1] = reversed(order[i:k + 1])
                    improved = True
    return order


def depot_latlng():
    return config.to_latlng(config.DEPOT["x"], config.DEPOT["y"])


def plan(threshold=None):
    threshold = config.BIN_COLLECT_THRESHOLD if threshold is None else threshold
    bins = db.q("SELECT device_id, zone, lat, lng, last_value, meta FROM devices WHERE kind='bin' ORDER BY device_id")
    depot = depot_latlng()
    due = [b for b in bins if (b["last_value"] or 0) >= threshold]

    pts = [depot] + [(b["lat"], b["lng"]) for b in due]
    order = solve_tsp(pts)
    route_km = tour_length(pts, order)

    all_pts = [depot] + [(b["lat"], b["lng"]) for b in bins]
    base_order = solve_tsp(all_pts)
    baseline_km = tour_length(all_pts, base_order)

    saved_km = max(0.0, baseline_km - route_km)
    fuel_saved = saved_km * config.TRUCK_L_PER_KM
    return {
        "threshold": threshold,
        "depot": {"name": config.DEPOT["name"], "lat": depot[0], "lng": depot[1], "x": config.DEPOT["x"], "y": config.DEPOT["y"]},
        "bins": bins,
        "due": [b["device_id"] for b in due],
        "route": [("DEPOT" if i == 0 else due[i - 1]["device_id"]) for i in order],
        "route_km": round(route_km, 2),
        "baseline_km": round(baseline_km, 2),
        "saved_km": round(saved_km, 2),
        "saved_pct": round(saved_km / baseline_km * 100, 1) if baseline_km else 0,
        "fuel_saved_l": round(fuel_saved, 2),
        "co2_saved_kg": round(fuel_saved * config.DIESEL_CO2_KG_PER_L, 2),
        "assumptions": {
            "road_circuity": config.ROAD_CIRCUITY,
            "truck_l_per_km": config.TRUCK_L_PER_KM,
            "diesel_co2_kg_per_l": config.DIESEL_CO2_KG_PER_L,
            "algorithm": "Nearest-neighbour + 2-opt TSP",
        },
    }


def record_collection(p):
    with db.tx() as c:
        c.execute(
            "INSERT INTO collections(ts,bins,route_km,baseline_km,fuel_saved_l,co2_saved_kg) VALUES(?,?,?,?,?,?)",
            (datetime.now().isoformat(), len(p["due"]), p["route_km"], p["baseline_km"], p["fuel_saved_l"], p["co2_saved_kg"]),
        )


def history(limit=30):
    rows = db.q("SELECT * FROM collections ORDER BY id DESC LIMIT ?", (limit,))
    tot = db.q1("SELECT COUNT(*) n, COALESCE(SUM(route_km),0) km, COALESCE(SUM(baseline_km),0) base, "
                "COALESCE(SUM(fuel_saved_l),0) fuel, COALESCE(SUM(co2_saved_kg),0) co2 FROM collections")
    return {"runs": rows, "totals": tot}
