"""Work orders: resident complaints + sensor-raised jobs, with SLA tracking."""
from datetime import datetime, timedelta

from fastapi import HTTPException

from . import config, db

_resolve_hooks = []


def on_resolve(fn):
    _resolve_hooks.append(fn)
    return fn


def _next_ref():
    prefix = "NX-" + datetime.now().strftime("%y%m") + "-"
    row = db.q1("SELECT ref FROM work_orders WHERE ref GLOB ? ORDER BY ref DESC LIMIT 1", (prefix + "[0-9][0-9][0-9][0-9]",))
    n = int(row["ref"].split("-")[-1]) + 1 if row else 1
    return f"{prefix}{n:04d}"


def sla_view(wo, now=None):
    now = now or datetime.now()
    due = datetime.fromisoformat(wo["due_at"])
    end = datetime.fromisoformat(wo["resolved_at"]) if wo.get("resolved_at") else now
    created = datetime.fromisoformat(wo["created_at"])
    remaining_h = (due - end).total_seconds() / 3600
    used = (end - created).total_seconds() / 3600
    breached = end > due
    state = "met" if wo.get("resolved_at") and not breached else "breached" if breached else ("at_risk" if remaining_h < wo["sla_hours"] * 0.25 else "on_track")
    return {
        "remaining_hours": round(remaining_h, 2),
        "elapsed_hours": round(used, 2),
        "pct_used": round(min(100, used / wo["sla_hours"] * 100), 1) if wo["sla_hours"] else 0,
        "state": state,
    }


def _decorate(wo):
    wo["category_label"] = config.CATEGORY_LABEL.get(wo["category"], wo["category"])
    wo["sla"] = sla_view(wo)
    wo["awaiting_approval"] = wo.get("approval") == "pending"
    return wo


def create(category, title, description, zone, source, reporter_id=None, location=None, lat=None, lng=None, photo=None, priority=None, actor="system"):
    if category not in config.SLA:
        raise HTTPException(400, f"Unknown category '{category}'")
    if zone not in config.ZONES:
        raise HTTPException(400, f"Unknown zone '{zone}'")
    sla_h, default_pri = config.SLA[category]
    now = datetime.now()
    team = config.CATEGORY_TEAM.get(category)
    # Governance: a sensor rule may open the job, but a person approves sending the crew.
    needs_approval = config.REQUIRE_APPROVAL and source == "sensor" and category in config.APPROVAL_CATEGORIES
    status = "ASSIGNED" if source == "sensor" and not needs_approval else "SUBMITTED"
    with db.tx() as c:
        ref = _next_ref()
        cur = c.execute(
            """INSERT INTO work_orders(ref,category,title,description,zone,location,lat,lng,priority,status,source,
               reporter_id,team,photo,sla_hours,due_at,created_at,updated_at,approval,recommended_team)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (ref, category, title.strip()[:140], (description or "").strip()[:2000], zone, location, lat, lng,
             priority or default_pri, status, source, reporter_id, team if status == "ASSIGNED" else None, photo,
             sla_h, (now + timedelta(hours=sla_h)).isoformat(), now.isoformat(), now.isoformat(),
             "pending" if needs_approval else None, team if needs_approval else None),
        )
        wid = cur.lastrowid
        c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                  (wid, now.isoformat(), "SUBMITTED", "Report received" if source == "resident" else "Raised automatically by sensor rule", actor))
        if needs_approval:
            c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                      (wid, now.isoformat(), "SUBMITTED", f"Awaiting dispatch approval — recommended: {team}", "system"))
        elif status == "ASSIGNED":
            c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                      (wid, now.isoformat(), "ASSIGNED", f"Auto-assigned to {team}", "system"))
    return get(wid)


def approve(wid, actor, team=None, note=None):
    """A person authorises the crew dispatch. Until then the job cannot be assigned or started."""
    wo = get(wid)
    if wo.get("approval") != "pending":
        raise HTTPException(400, "This job is not awaiting approval")
    team = team or wo.get("recommended_team") or config.CATEGORY_TEAM.get(wo["category"])
    if team not in config.TEAMS:
        raise HTTPException(400, f"Unknown team '{team}'")
    now = datetime.now().isoformat()
    with db.tx() as c:
        c.execute("UPDATE work_orders SET approval='approved', approved_by=?, approved_at=?, team=?, status='ASSIGNED', updated_at=? WHERE id=?",
                  (actor, now, team, now, wid))
        c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                  (wid, now, "ASSIGNED", note or f"Dispatch approved — {team} assigned", actor))
    return get(wid)


def get(wid=None, ref=None):
    wo = db.q1("SELECT w.*, u.name AS reporter_name, u.unit AS reporter_unit FROM work_orders w LEFT JOIN users u ON u.id=w.reporter_id WHERE "
               + ("w.id=?" if wid else "w.ref=?"), (wid or ref,))
    if not wo:
        raise HTTPException(404, "Work order not found")
    wo["events"] = db.q("SELECT ts,status,note,actor FROM wo_events WHERE wo_id=? ORDER BY id", (wo["id"],))
    return _decorate(wo)


def list_(status=None, zone=None, category=None, reporter_id=None, open_only=False, limit=200):
    sql = "SELECT * FROM work_orders WHERE 1=1"
    p = []
    if status:
        sql += " AND status=?"; p.append(status)
    if zone:
        sql += " AND zone=?"; p.append(zone)
    if category:
        sql += " AND category=?"; p.append(category)
    if reporter_id:
        sql += " AND reporter_id=?"; p.append(reporter_id)
    if open_only:
        sql += " AND status NOT IN ('RESOLVED','CLOSED')"
    sql += " ORDER BY CASE WHEN status IN ('RESOLVED','CLOSED') THEN 1 ELSE 0 END, due_at LIMIT ?"
    p.append(limit)
    return [_decorate(w) for w in db.q(sql, p)]


def update(wid, actor, status=None, team=None, note=None):
    wo = get(wid)
    now = datetime.now().isoformat()
    if wo.get("approval") == "pending" and (status or team):
        raise HTTPException(409, "Dispatch approval required before this job can be assigned or started")
    if status and status not in config.WO_STATUSES:
        raise HTTPException(400, "Bad status")
    if status and config.WO_STATUSES.index(status) < config.WO_STATUSES.index(wo["status"]) and status != "IN_PROGRESS":
        raise HTTPException(400, f"Cannot move from {wo['status']} back to {status}")
    with db.tx() as c:
        if team and team != wo["team"]:
            c.execute("UPDATE work_orders SET team=?, updated_at=? WHERE id=?", (team, now, wid))
            if not status and wo["status"] == "SUBMITTED":
                status = "ASSIGNED"
            c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                      (wid, now, status or wo["status"], f"Assigned to {team}", actor))
        if status and status != wo["status"]:
            if status in ("RESOLVED", "CLOSED"):
                resolved = wo["resolved_at"] or now
            else:
                resolved = None  # re-opened
            c.execute("UPDATE work_orders SET status=?, resolved_at=?, updated_at=? WHERE id=?", (status, resolved, now, wid))
            c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                      (wid, now, status, note or status.replace("_", " ").title(), actor))
        elif note:
            c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)", (wid, now, wo["status"], note, actor))
    fresh = get(wid)
    if status in ("RESOLVED", "CLOSED") and wo["status"] not in ("RESOLVED", "CLOSED"):
        for fn in _resolve_hooks:
            fn(fresh)
    return fresh


def rate(wid, reporter_id, rating):
    wo = get(wid)
    if wo["reporter_id"] != reporter_id:
        raise HTTPException(403, "Only the reporter can rate this job")
    if wo["status"] not in ("RESOLVED", "CLOSED"):
        raise HTTPException(400, "Job is not resolved yet")
    with db.tx() as c:
        c.execute("UPDATE work_orders SET rating=?, status='CLOSED', updated_at=? WHERE id=?", (int(rating), datetime.now().isoformat(), wid))
        c.execute("INSERT INTO wo_events(wo_id,ts,status,note,actor) VALUES(?,?,?,?,?)",
                  (wid, datetime.now().isoformat(), "CLOSED", f"Resident rated {int(rating)}/5", "resident"))
    return get(wid)


def open_for(category, zone):
    return db.q1("SELECT * FROM work_orders WHERE category=? AND zone=? AND source='sensor' AND status NOT IN ('RESOLVED','CLOSED')",
                 (category, zone))


def stats(days=30):
    since = (datetime.now() - timedelta(days=days)).isoformat()
    rows = [_decorate(w) for w in db.q("SELECT * FROM work_orders WHERE created_at>=?", (since,))]
    resolved = [w for w in rows if w["resolved_at"]]
    met = [w for w in resolved if w["sla"]["state"] == "met"]
    open_ = [w for w in rows if w["status"] not in ("RESOLVED", "CLOSED")]
    hours = [w["sla"]["elapsed_hours"] for w in resolved]
    by_cat = {}
    for w in rows:
        by_cat.setdefault(w["category_label"], 0)
        by_cat[w["category_label"]] += 1
    ratings = [w["rating"] for w in rows if w["rating"]]
    return {
        "days": days,
        "total": len(rows),
        "open": len(open_),
        "breached_open": sum(1 for w in open_ if w["sla"]["state"] == "breached"),
        "resolved": len(resolved),
        "sla_met_pct": round(len(met) / len(resolved) * 100, 1) if resolved else None,
        "avg_resolution_h": round(sum(hours) / len(hours), 1) if hours else None,
        "by_category": by_cat,
        "from_sensors": sum(1 for w in rows if w["source"] == "sensor"),
        "from_residents": sum(1 for w in rows if w["source"] == "resident"),
        "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
    }
