"""Role-based login: resident / operator / manager. PBKDF2 hashes + opaque session tokens."""
import hashlib
import hmac
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException

from . import config, db


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"pbkdf2${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt).split("$")[2], digest)


def seed_users():
    for email, name, role, zone, unit in config.DEMO_USERS:
        if not db.q1("SELECT id FROM users WHERE email=?", (email,)):
            with db.tx() as c:
                c.execute(
                    "INSERT INTO users(email,name,role,zone,unit,password_hash,created_at) VALUES(?,?,?,?,?,?,?)",
                    (email, name, role, zone, unit, hash_password(config.DEMO_PASSWORD), datetime.now().isoformat()),
                )


def public_user(u):
    return {k: u[k] for k in ("id", "email", "name", "role", "zone", "unit")}


def login(email: str, password: str):
    u = db.q1("SELECT * FROM users WHERE lower(email)=lower(?)", (email.strip(),))
    if not u or not verify_password(password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = secrets.token_urlsafe(32)
    with db.tx() as c:
        c.execute("INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)", (token, u["id"], datetime.now().isoformat()))
    return {"token": token, "user": public_user(u)}


def register_resident(email, name, password, zone, unit):
    if zone not in config.ZONES:
        raise HTTPException(400, "Unknown zone")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.q1("SELECT id FROM users WHERE lower(email)=lower(?)", (email,)):
        raise HTTPException(409, "Email already registered")
    with db.tx() as c:
        c.execute(
            "INSERT INTO users(email,name,role,zone,unit,password_hash,created_at) VALUES(?,?,?,?,?,?,?)",
            (email.strip(), name.strip(), "resident", zone, unit, hash_password(password), datetime.now().isoformat()),
        )
    return login(email, password)


def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Login required")
    token = authorization.split(" ", 1)[1]
    row = db.q1("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?", (token,))
    if not row:
        raise HTTPException(401, "Session expired — log in again")
    return row


def optional_user(authorization: str | None = Header(default=None)):
    try:
        return current_user(authorization)
    except HTTPException:
        return None


def require(*roles):
    def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user
    return dep


def logout(token: str):
    with db.tx() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (token,))
