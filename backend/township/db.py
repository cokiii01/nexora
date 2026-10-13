"""SQLite persistence for NEXORA township services (no external DB needed).

The file lives next to the backend as `nexora.db`. Set NEXORA_DB to move it
(e.g. a Render persistent disk). Swap for PostgreSQL later by replacing this
module — every service talks to it through `connect()` only.
"""
import os
import sqlite3
import threading
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("NEXORA_DB", os.path.join(BASE_DIR, "nexora.db"))
UPLOAD_DIR = os.environ.get("NEXORA_UPLOADS", os.path.join(BASE_DIR, "uploads"))

_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('resident','operator','manager')),
  zone TEXT,
  unit TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  unit TEXT NOT NULL,
  lat REAL, lng REAL,
  api_key TEXT NOT NULL,
  meta TEXT,
  last_value REAL,
  last_seen TEXT,
  rssi INTEGER,
  battery REAL,
  source TEXT,
  readings_count INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  value REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'sim'
);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings(device_id, ts);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  device_id TEXT,
  zone TEXT,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  value REAL,
  created_at TEXT NOT NULL,
  cleared_at TEXT,
  work_order_ref TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone TEXT,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivery TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  zone TEXT NOT NULL,
  location TEXT,
  lat REAL, lng REAL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  reporter_id INTEGER REFERENCES users(id),
  team TEXT,
  photo TEXT,
  sla_hours REAL NOT NULL,
  due_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  rating INTEGER,
  approval TEXT,
  recommended_team TEXT,
  approved_by TEXT,
  approved_at TEXT
);
CREATE TABLE IF NOT EXISTS wo_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wo_id INTEGER NOT NULL REFERENCES work_orders(id),
  ts TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  actor TEXT
);
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  bins INTEGER NOT NULL,
  route_km REAL NOT NULL,
  baseline_km REAL NOT NULL,
  fuel_saved_l REAL NOT NULL,
  co2_saved_kg REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

_conn = None


def connect():
    global _conn
    if _conn is None:
        os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        _conn.executescript(SCHEMA)
        _migrate(_conn)
    return _conn


def _migrate(conn):
    """Add columns introduced after a database file was first created (keeps an existing nexora.db usable)."""
    have = {r["name"] for r in conn.execute("PRAGMA table_info(work_orders)").fetchall()}
    for col in ("approval", "recommended_team", "approved_by", "approved_at"):
        if col not in have:
            conn.execute(f"ALTER TABLE work_orders ADD COLUMN {col} TEXT")


@contextmanager
def tx():
    """Serialised write transaction."""
    conn = connect()
    with _lock:
        conn.execute("BEGIN")
        try:
            yield conn
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise


def q(sql, params=()):
    with _lock:
        return [dict(r) for r in connect().execute(sql, params).fetchall()]


def q1(sql, params=()):
    rows = q(sql, params)
    return rows[0] if rows else None


def get_setting(key, default=None):
    row = q1("SELECT value FROM settings WHERE key=?", (key,))
    return row["value"] if row else default


def set_setting(key, value):
    with tx() as c:
        c.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
