"""Holy Baptism of Daimon – tiny Flask API.

The website itself is plain HTML in ./docs (deploy that folder to GitHub Pages).
This server only stores the data:
  /api/godparents   ninong/ninang registrations (list/delete need ?key=ADMIN_KEY)
  /api/photos       guest photos (5 per guest)
  /photos/<id>.jpg  the photo files

For local testing it also serves ./docs, so  python app.py  -> http://localhost:5000
Set ALLOWED_ORIGIN to your GitHub Pages origin in production (default: any).
"""
import json
import os
import secrets
import threading
import time
import uuid
from pathlib import Path

from flask import (Flask, abort, jsonify, make_response, request,
                   send_from_directory)

BASE = Path(__file__).resolve().parent
DOCS = BASE / "docs"
DATA = BASE / "data"
PHOTOS = DATA / "photos"
GODPARENTS_FILE = DATA / "godparents.json"
PHOTOS_FILE = DATA / "photos.json"
KEY_FILE = DATA / "admin_key.txt"
PHOTOS.mkdir(parents=True, exist_ok=True)

MAX_PHOTOS_PER_GUEST = 5
MAX_PHOTO_BYTES = 4 * 1024 * 1024

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
lock = threading.Lock()
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


@app.after_request
def cors(resp):
    if request.path.startswith(("/api/", "/photos/")):
        resp.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Guest"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return resp


# ---------- tiny JSON store ----------
def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return []


def save(path, rows):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def admin_key():
    key = os.environ.get("ADMIN_KEY")
    if key:
        return key
    if not KEY_FILE.exists():
        KEY_FILE.write_text(secrets.token_urlsafe(9), encoding="utf-8")
    return KEY_FILE.read_text(encoding="utf-8").strip()


ADMIN_KEY = admin_key()


def is_admin():
    return secrets.compare_digest(request.args.get("key", ""), ADMIN_KEY)


@app.errorhandler(Exception)
def on_error(e):
    """API errors come back as JSON (the page shows the message) and the traceback goes to the server log."""
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        if request.path.startswith(("/api/", "/photos/")):
            return jsonify(error=e.description), e.code
        return e
    app.logger.exception("Unhandled error on %s %s", request.method, request.path)
    return jsonify(error=f"Server error ({type(e).__name__}: {e})"), 500


# ---------- local preview of the static site ----------
@app.get("/")
def home():
    return send_from_directory(DOCS, "index.html")


@app.get("/godparent")
@app.get("/gallery")
def pretty_pages():
    return send_from_directory(DOCS, request.path.strip("/") + ".html")


@app.get("/<path:path>")
def site_files(path):
    return send_from_directory(DOCS, path)


# ---------- godparent API ----------
FIELDS = {"role": 10, "fullName": 120, "phone": 30, "email": 120,
          "relation": 40, "catholic": 20, "attend": 60, "message": 600}
ROLES = {"Ninong", "Ninang"}


@app.post("/api/godparents")
def godparent_save():
    body = request.get_json(silent=True) or {}
    rec = {k: str(body.get(k, "")).strip()[:n] for k, n in FIELDS.items()}
    if not rec["fullName"]:
        return jsonify(error="Please write your full name."), 400
    if rec["role"] not in ROLES:
        return jsonify(error="Please choose Ninong or Ninang."), 400
    if not rec["phone"]:
        return jsonify(error="Please add your mobile number."), 400
    if not rec["relation"] or not rec["catholic"] or not rec["attend"]:
        return jsonify(error="Please fill in every blank."), 400

    with lock:
        rows = load(GODPARENTS_FILE)
        existing = next((r for r in rows if r["id"] == str(body.get("id", ""))), None)
        if existing:
            existing.update(rec, updatedAt=time.time())
            rec_id = existing["id"]
        else:
            rec_id = uuid.uuid4().hex
            rows.append({"id": rec_id, **rec, "submittedAt": time.time()})
        save(GODPARENTS_FILE, rows)
    return jsonify(id=rec_id)


@app.get("/api/godparents/<gid>")
def godparent_mine(gid):
    """Lets a guest reload their own pledge (the id is a secret kept in their browser)."""
    row = next((r for r in load(GODPARENTS_FILE) if r["id"] == gid), None)
    if not row:
        abort(404)
    return jsonify({k: row.get(k, "") for k in FIELDS})


@app.get("/api/godparents")
def godparent_list():
    if not is_admin():
        return jsonify(error="forbidden"), 403
    return jsonify(godparents=load(GODPARENTS_FILE))


@app.delete("/api/godparents/<gid>")
def godparent_delete(gid):
    if not is_admin():
        return jsonify(error="forbidden"), 403
    with lock:
        rows = load(GODPARENTS_FILE)
        save(GODPARENTS_FILE, [r for r in rows if r["id"] != gid])
    return jsonify(ok=True)


# ---------- gallery API ----------
def guest_id():
    """One anonymous id per browser, sent by the page in the X-Guest header."""
    gid = request.headers.get("X-Guest", "")
    if 8 <= len(gid) <= 64 and gid.isalnum():
        return gid, False
    return uuid.uuid4().hex, True      # no/invalid id: treat as a throwaway guest


def with_guest_cookie(resp, gid, is_new):
    return resp


def public(p):
    return {"id": p["id"], "url": f"/photos/{p['id']}.jpg", "ts": p["ts"], "name": p.get("name", "")}


@app.get("/api/photos")
def photos_list():
    gid, new = guest_id()
    rows = load(PHOTOS_FILE)
    mine = sum(1 for p in rows if p["guest"] == gid)
    resp = jsonify(photos=[public(p) for p in reversed(rows)],
                   remaining=max(0, MAX_PHOTOS_PER_GUEST - mine),
                   limit=MAX_PHOTOS_PER_GUEST,
                   admin=is_admin() if request.args.get("key") else False)
    return with_guest_cookie(resp, gid, new)


@app.post("/api/photos")
def photos_upload():
    gid, new = guest_id()
    files = request.files.getlist("photos")
    name = " ".join(request.form.get("name", "").split())[:60]
    if not name:
        return jsonify(error="Please type your name first."), 400
    if not files:
        return jsonify(error="No photos received."), 400
    with lock:
        rows = load(PHOTOS_FILE)
        mine = sum(1 for p in rows if p["guest"] == gid)
        room = MAX_PHOTOS_PER_GUEST - mine
        if room <= 0:
            return with_guest_cookie(
                make_response(jsonify(error="You've already used all 5 of your photos."), 403), gid, new)
        added = []
        for f in files[:room]:
            data = f.read(MAX_PHOTO_BYTES + 1)
            if len(data) > MAX_PHOTO_BYTES or not data.startswith(b"\xff\xd8\xff"):
                continue  # only real JPEGs, size-capped
            pid = uuid.uuid4().hex
            (PHOTOS / f"{pid}.jpg").write_bytes(data)
            rec = {"id": pid, "guest": gid, "name": name, "ts": time.time()}
            rows.append(rec)
            added.append(public(rec))
        if not added:
            return with_guest_cookie(
                make_response(jsonify(error="Those files weren't valid photos."), 400), gid, new)
        save(PHOTOS_FILE, rows)
    resp = jsonify(photos=added, remaining=room - len(added))
    return with_guest_cookie(resp, gid, new)


@app.delete("/api/photos/<pid>")
def photo_delete(pid):
    if not is_admin():
        return jsonify(error="forbidden"), 403
    with lock:
        rows = load(PHOTOS_FILE)
        save(PHOTOS_FILE, [p for p in rows if p["id"] != pid])
    if pid.isalnum():
        (PHOTOS / f"{pid}.jpg").unlink(missing_ok=True)
    return jsonify(ok=True)


@app.get("/photos/<name>")
def photo_file(name):
    resp = send_from_directory(PHOTOS, name, mimetype="image/jpeg")
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5069))
    print(f"\n  Parents' key (open /godparent?key=KEY and /gallery?key=KEY): {ADMIN_KEY}\n")
    # Phones only allow the camera on https:// or localhost. HTTPS=1 serves a self-signed
    # cert (needs:  pip install cryptography) so guests on your Wi-Fi can use the camera.
    ssl = "adhoc" if os.environ.get("HTTPS") == "1" else None
    app.run(host="0.0.0.0", port=port, ssl_context=ssl, threaded=True)
