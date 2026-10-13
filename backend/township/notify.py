"""Resident notifications: always stored in-app; also pushed to Telegram when configured.

Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (a group/channel residents join).
Optional per-zone groups: TELEGRAM_CHAT_ZONE_A / _ZONE_B / _ZONE_C.
Create a bot in 2 minutes with @BotFather on Telegram.
"""
import json
import os
import threading
import urllib.request
from datetime import datetime

from . import db

LEVEL_ICON = {"NORMAL": "✅", "INFO": "ℹ️", "WASPADA": "🟡", "AMARAN": "🟠", "BAHAYA": "🔴", "WARNING": "🟠", "CRITICAL": "🔴"}


def _chat_for(zone):
    if zone:
        key = "TELEGRAM_CHAT_" + zone.upper().replace(" ", "_")
        if os.environ.get(key):
            return os.environ[key]
    return os.environ.get("TELEGRAM_CHAT_ID")


def _send_telegram(text, chat_id, notif_id):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    status = "sent"
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=8).read()
    except Exception as exc:  # network / bad token — keep the in-app copy regardless
        status = f"failed: {type(exc).__name__}"
    with db.tx() as c:
        c.execute("UPDATE notifications SET delivery=? WHERE id=?", (status, notif_id))


def notify(zone, level, title, body):
    chat = _chat_for(zone)
    channel = "in-app+telegram" if (chat and os.environ.get("TELEGRAM_BOT_TOKEN")) else "in-app"
    with db.tx() as c:
        cur = c.execute(
            "INSERT INTO notifications(zone,level,title,body,channel,delivery,created_at) VALUES(?,?,?,?,?,?,?)",
            (zone, level, title, body, channel, "queued" if channel != "in-app" else "delivered", datetime.now().isoformat()),
        )
        nid = cur.lastrowid
    if channel != "in-app":
        text = f"{LEVEL_ICON.get(level, '')} <b>{title}</b>\n{body}\n<i>NEXORA · {zone or 'All zones'}</i>"
        threading.Thread(target=_send_telegram, args=(text, chat, nid), daemon=True).start()
    return nid


def list_for(zone=None, limit=30):
    if zone:
        return db.q("SELECT * FROM notifications WHERE zone IS NULL OR zone=? ORDER BY id DESC LIMIT ?", (zone, limit))
    return db.q("SELECT * FROM notifications ORDER BY id DESC LIMIT ?", (limit,))
