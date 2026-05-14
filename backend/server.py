from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import time
import json
import csv
import io
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import secrets
import httpx
import hashlib
import bcrypt

ROOT_DIR = Path(__file__).parent

# ── Per-contact async lock (Feature 1: Queue / serial processing per contact) ──
_contact_locks: dict = {}
_ai_semaphore: asyncio.Semaphore = None  # init after event loop starts

def _get_contact_lock(key: str) -> asyncio.Lock:
    if key not in _contact_locks:
        _contact_locks[key] = asyncio.Lock()
    return _contact_locks[key]

# ── Template variable resolver (Feature 4) ──
_DAY_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]
def resolve_template(text: str, contact: dict = None, tz_offset: int = 7) -> str:
    if not text:
        return text
    now_utc = datetime.utcnow()
    now_local = now_utc + timedelta(hours=tz_offset)
    c = contact or {}
    replacements = {
        "{{nama}}": c.get("name", ""),
        "{{no_wa}}": c.get("phone") or re.sub(r'@[\w.]+$', '', c.get("chatId", "")),
        "{{tanggal}}": now_local.strftime("%d/%m/%Y"),
        "{{waktu}}": now_local.strftime("%H:%M"),
        "{{hari}}": _DAY_ID[now_local.weekday() + 1 if now_local.weekday() < 6 else 0],
        "{{bulan}}": now_local.strftime("%B"),
        "{{tahun}}": now_local.strftime("%Y"),
    }
    for k, v in replacements.items():
        text = text.replace(k, str(v))
    return text

# ── WhatsApp owner notification (Feature 6) ──
async def send_owner_wa_notification(cfg: dict, message: str):
    owner_number = cfg.get("ownerWhatsappNumber", "").strip()
    if not owner_number or not cfg.get("ownerNotifyEnabled"):
        return
    waha_url = cfg.get("wahaUrl", "").rstrip("/")
    waha_session = cfg.get("wahaSession", "default") or "default"
    waha_api_key = cfg.get("wahaApiKey", "")
    if not waha_url:
        return
    # Normalise: strip leading +, append @c.us
    number = owner_number.lstrip("+").replace(" ", "")
    owner_chat_id = f"{number}@c.us"
    try:
        await send_waha_text(waha_url, waha_session, waha_api_key, owner_chat_id, message)
    except Exception:
        pass

# ── Working hours check per-day (Feature 5) ──
def is_within_working_hours(cfg: dict, tz_offset: int = 7) -> bool:
    if not cfg.get("workingHoursEnabled"):
        return True
    now = datetime.utcnow() + timedelta(hours=tz_offset)
    weekday = now.weekday()  # 0=Mon … 6=Sun
    day_key = str(weekday)
    schedule_raw = cfg.get("workingHoursSchedule", "")
    if schedule_raw:
        try:
            schedule = json.loads(schedule_raw) if isinstance(schedule_raw, str) else schedule_raw
            # schedule is a list: [{day:0,name:...,enabled:bool,start:HH:MM,end:HH:MM}, ...]
            # Python weekday(): 0=Mon…6=Sun; our list index 0=Sun…6=Sat → map
            # Frontend saves: index 0=Minggu(Sun), 1=Senin(Mon)…6=Sabtu(Sat)
            # Python weekday 0=Mon → our list index 1, …, 6=Sun → index 0
            py_to_list = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}
            list_idx = py_to_list.get(weekday, weekday)
            day_cfg = next((d for d in schedule if d.get("day") == list_idx), None)
            if day_cfg is None:
                # fallback: use index directly
                day_cfg = schedule[list_idx] if list_idx < len(schedule) else None
            if not day_cfg or not day_cfg.get("enabled", True):
                return False
            start = day_cfg.get("start", "00:00")
            end = day_cfg.get("end", "23:59")
        except Exception:
            start = cfg.get("workingHoursStart", "08:00")
            end = cfg.get("workingHoursEnd", "21:00")
    else:
        start = cfg.get("workingHoursStart", "08:00")
        end = cfg.get("workingHoursEnd", "21:00")
    now_t = now.strftime("%H:%M")
    return start <= now_t <= end
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'chatbot_manager')]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================
# MODELS
# ============================================================

class LoginRequest(BaseModel):
    username: str = "admin"
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str
    user: Optional[Dict] = None

class ConfigUpdate(BaseModel):
    updates: Dict[str, Any]

class AIAgentConfig(BaseModel):
    systemPrompt: Optional[str] = None
    businessInfo: Optional[str] = None
    aiTemperature: Optional[float] = None
    aiMaxTokens: Optional[int] = None
    memoryLimit: Optional[int] = None
    memoryTimeoutMinutes: Optional[int] = None
    ruleAiEnabled: Optional[bool] = None

class LicenseActivate(BaseModel):
    licenseKey: str

class RuleModel(BaseModel):
    id: Optional[str] = None
    priority: int = 10
    name: str
    triggerType: str = "contains"
    triggerValue: str
    response: str
    isActive: bool = True
    hitCount: int = 0
    responseMode: str = "direct"
    imageUrl: str = ""
    imageCaption: str = ""

class KnowledgeModel(BaseModel):
    id: Optional[str] = None
    category: str
    keyword: str
    content: str
    isActive: bool = True

class TemplateModel(BaseModel):
    id: Optional[str] = None
    name: str
    content: str
    category: str = "Umum"

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    tag: Optional[str] = None
    note: Optional[str] = None
    isBlocked: Optional[bool] = None

class BroadcastCheck(BaseModel):
    target: str = "all"
    tag: Optional[str] = None
    customNumbers: Optional[str] = None

class BroadcastSend(BaseModel):
    target: str = "all"
    tag: Optional[str] = None
    customNumbers: Optional[str] = None
    message: str

class BroadcastSendOne(BaseModel):
    chatId: str
    message: str

class TestRequest(BaseModel):
    message: str

class ResetRequest(BaseModel):
    confirm: bool = True

class AISetupMessage(BaseModel):
    message: str
    history: List[Dict[str, str]] = []

class UserCreate(BaseModel):
    username: str
    fullName: str
    email: str = ""
    role: str = "operator"
    password: str
    isActive: bool = True

class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    isActive: Optional[bool] = None
    password: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str
    confirmPassword: str

class WebhookPayload(BaseModel):
    data: Optional[Dict] = None

class DocSection(BaseModel):
    type: str = "text"  # text | step | image | heading | video | tip
    content: Optional[str] = ""
    stepNumber: Optional[int] = None
    stepTitle: Optional[str] = ""
    imageUrl: Optional[str] = ""
    imageCaption: Optional[str] = ""
    videoUrl: Optional[str] = ""
    videoCaption: Optional[str] = ""
    level: Optional[int] = 2  # for heading: 2 or 3

class DocPage(BaseModel):
    slug: str
    title: str
    sections: List[DocSection] = []

class CreateDocPage(BaseModel):
    slug: str
    title: str

class ImageUpload(BaseModel):
    dataUrl: str  # base64 data URL

# ============================================================
# AUTH HELPERS
# ============================================================

SESSION_TTL_SECONDS = 6 * 60 * 60
DEFAULT_PASSWORD = "admin123"

# ── Password policy ──
_COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "qwerty123",
    "qwertyuiop", "admin123", "admin1234", "administrator", "letmein123",
    "welcome1", "welcome123", "iloveyou1", "1q2w3e4r5t", "abc123456",
    "passw0rd", "p@ssw0rd", "p@ssword", "changeme", "changeme123",
}

def validate_password_strength(password: str) -> None:
    """Raise HTTPException 400 if password tidak memenuhi kebijakan keamanan."""
    if not password or len(password) < 12:
        raise HTTPException(status_code=400, detail="Password minimal 12 karakter.")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Password maksimal 128 karakter.")
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    categories = sum([has_letter, has_digit, has_special])
    if categories < 2:
        raise HTTPException(
            status_code=400,
            detail="Password harus memiliki minimal 2 dari: huruf, angka, simbol."
        )
    if password.lower() in _COMMON_PASSWORDS:
        raise HTTPException(status_code=400, detail="Password terlalu umum. Pilih yang lebih kuat.")

# ── Data URL image validator ──
_ALLOWED_IMAGE_MIMES = ("data:image/png;", "data:image/jpeg;", "data:image/jpg;", "data:image/webp;", "data:image/gif;")

def validate_image_data_url(data_url: str, label: str = "Gambar") -> None:
    """Tolak data URL non-gambar dan SVG (SVG bisa berisi script)."""
    if not data_url:
        return
    lower = data_url.lower()
    if lower.startswith("data:image/svg"):
        raise HTTPException(status_code=400, detail=f"{label}: format SVG tidak diizinkan karena alasan keamanan.")
    if not any(lower.startswith(prefix) for prefix in _ALLOWED_IMAGE_MIMES):
        raise HTTPException(status_code=400, detail=f"{label}: hanya PNG, JPEG, WEBP, atau GIF yang diizinkan.")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def check_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    try:
        # bcrypt hash (new format)
        if stored_hash.startswith(('$2b$', '$2a$', '$2y$')):
            return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        # Legacy SHA-256 format: {hex_salt}${sha256_hex}
        if "$" in stored_hash:
            parts = stored_hash.split("$", 1)
            if len(parts) == 2:
                salt = parts[0]
                legacy_hash = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
                return f"{salt}${legacy_hash}" == stored_hash
        # Plain text (very old, should not exist in production)
        return secrets.compare_digest(password, stored_hash)
    except Exception:
        return False

async def ensure_admin_password():
    config = await db.config.find_one({"key": "admin_password_hash"})
    if not config:
        hashed = hash_password(DEFAULT_PASSWORD)
        await db.config.insert_one({"key": "admin_password_hash", "value": hashed, "updated_at": datetime.utcnow()})
    else:
        stored = config.get("value", "")
        # Upgrade legacy SHA-256 hash to bcrypt (more secure)
        if stored and not stored.startswith(('$2b$', '$2a$', '$2y$')):
            logger.info("Upgrading legacy password hash to bcrypt...")
            hashed = hash_password(DEFAULT_PASSWORD)
            await db.config.update_one(
                {"key": "admin_password_hash"},
                {"$set": {"value": hashed, "updated_at": datetime.utcnow()}}
            )

async def verify_legacy_password(plain: str) -> bool:
    config = await db.config.find_one({"key": "admin_password_hash"})
    if not config:
        return plain == DEFAULT_PASSWORD
    return check_password(plain, config["value"])

async def create_session(user_id: str = "admin", username: str = "admin", role: str = "admin", full_name: str = "Administrator") -> str:
    token = secrets.token_urlsafe(48)
    await db.sessions.insert_one({
        "token": token,
        "userId": user_id,
        "username": username,
        "role": role,
        "fullName": full_name,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(seconds=SESSION_TTL_SECONDS)
    })
    return token

async def validate_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token tidak valid. Silakan login ulang.")
    token = authorization.replace("Bearer ", "")
    session = await db.sessions.find_one({"token": token, "expires_at": {"$gt": datetime.utcnow()}})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Silakan login ulang.")
    return token

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token tidak valid. Silakan login ulang.")
    token = authorization.replace("Bearer ", "")
    session = await db.sessions.find_one({"token": token, "expires_at": {"$gt": datetime.utcnow()}})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Silakan login ulang.")

    user_id = session.get("userId", "admin")
    # Validasi: user masih ada dan aktif. Bootstrap session (userId="admin")
    # diizinkan agar tidak mengunci diri jika seed gagal.
    if user_id and user_id != "admin":
        user_doc = await db.users.find_one({"id": user_id}, {"isActive": 1, "role": 1})
        if not user_doc:
            await db.sessions.delete_one({"token": token})
            raise HTTPException(status_code=401, detail="Akun tidak ditemukan. Silakan login ulang.")
        if not user_doc.get("isActive", True):
            await db.sessions.delete_many({"userId": user_id})
            raise HTTPException(status_code=403, detail="Akun dinonaktifkan.")

    return {
        "token": token,
        "userId": user_id,
        "username": session.get("username", "admin"),
        "role": session.get("role", "admin"),
        "fullName": session.get("fullName", "Administrator"),
    }

async def require_superadmin(current_user: Dict = Depends(get_current_user)) -> Dict:
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Hanya superadmin yang dapat melakukan operasi ini.")
    return current_user

# ============================================================
# SEED DEFAULT DATA
# ============================================================

async def seed_defaults():
    # ── Selalu dibungkus try/except agar backend tidak crash saat startup ──
    try:
        # Step 1: Migrate old configs without userId → userId=""
        await db.config.update_many({"userId": {"$exists": False}}, {"$set": {"userId": ""}})

        # Step 2: Dedup (key, userId) pairs — keep doc with longest value
        pipeline = [{"$group": {"_id": {"key": "$key", "userId": "$userId"}, "count": {"$sum": 1}, "ids": {"$push": "$_id"}}}]
        async for grp in db.config.aggregate(pipeline):
            if grp["count"] > 1:
                docs = await db.config.find({"_id": {"$in": grp["ids"]}}).to_list(20)
                docs_sorted = sorted(docs, key=lambda d: len(str(d.get("value", "") or "")), reverse=True)
                ids_to_delete = [d["_id"] for d in docs_sorted[1:]]
                await db.config.delete_many({"_id": {"$in": ids_to_delete}})

        # Step 3: Drop old single-key index if exists, then create compound unique index
        for old_idx in ["key_1", "key_1_userId_1"]:
            try:
                await db.config.drop_index(old_idx)
            except Exception:
                pass
        try:
            await db.config.create_index([("key", 1), ("userId", 1)], unique=True, name="key_userId_unique")
        except Exception as e:
            print(f"[seed] WARNING: could not create config index: {e}")

        # Step 4: Ensure global defaults exist (userId="" = global fallback)
        required_defaults = [
            ("wahaUrl", ""), ("wahaSession", "default"), ("wahaApiKey", ""),
            ("backendUrl", ""), ("aiProvider", ""), ("aiModel", ""),
            ("aiApiKey", ""), ("ollamaUrl", ""), ("systemPrompt", ""),
            ("businessInfo", ""), ("aiTemperature", 0.7), ("aiMaxTokens", 500),
            ("memoryLimit", 10), ("memoryTimeoutMinutes", 30),
            ("ruleAiEnabled", False), ("isBotActive", False), ("aiEnabled", True),
            ("messageRetentionDays", 90), ("timezone", "WIB"),
            ("ownerWhatsappNumber", ""), ("ownerNotifyEnabled", False),
            ("autoLabels", "[]"), ("workingHoursSchedule", ""),
        ]
        for key, default_val in required_defaults:
            try:
                await db.config.update_one(
                    {"key": key, "userId": ""},
                    {"$setOnInsert": {"key": key, "userId": "", "value": default_val}},
                    upsert=True,
                )
            except Exception:
                pass

        # Step 5: Legacy cleanup
        await db.config.delete_many({"key": {"$in": ["hasWahaApiKey", "hasAiApiKey"]}})

        # Step 6: Migrate legacy data (no userId) to first regular user
        first_user = await db.users.find_one({"role": {"$ne": "superadmin"}})
        if first_user:
            first_uid = str(first_user["id"])
            for coll in [db.rules, db.knowledge, db.templates, db.contacts, db.messages]:
                try:
                    await coll.update_many({"userId": {"$exists": False}}, {"$set": {"userId": first_uid}})
                except Exception:
                    pass
            # Copy global config to user-specific if user has none yet
            try:
                user_config_count = await db.config.count_documents({"userId": first_uid})
                if user_config_count == 0:
                    global_docs = await db.config.find({"userId": ""}).to_list(200)
                    for doc in global_docs:
                        try:
                            await db.config.insert_one({
                                "key": doc["key"],
                                "userId": first_uid,
                                "value": doc.get("value", ""),
                                "updated_at": datetime.utcnow(),
                            })
                        except Exception:
                            pass
            except Exception:
                pass

        # Step 7: Unique index on processed_msgs for dedup atomicity + TTL 7 hari
        try:
            await db.processed_msgs.create_index("msgId", unique=True, sparse=True)
        except Exception:
            pass
        try:
            await db.processed_msgs.create_index("ts", expireAfterSeconds=7 * 86400)
        except Exception:
            pass

        # Step 8: Backfill phone field for contacts that don't have it yet
        try:
            import re as _re2
            async for contact in db.contacts.find({"phone": {"$exists": False}, "chatId": {"$exists": True}}):
                chat_id = contact.get("chatId", "")
                if not chat_id or "@g.us" in chat_id:
                    continue
                phone_num = _re2.sub(r'@[\w.]+$', '', chat_id)
                phone_display = ('+' + phone_num) if _re2.match(r'^\d{6,}$', phone_num) else phone_num
                await db.contacts.update_one(
                    {"_id": contact["_id"]},
                    {"$set": {"phone": phone_display}}
                )
        except Exception as e:
            print(f"[seed] WARNING: phone backfill failed: {e}")

    except Exception as e:
        print(f"[seed] ERROR in seed_defaults (non-fatal): {e}")


    # Seed default superadmin user in users collection
    if await db.users.count_documents({}) == 0:
        hashed = hash_password(DEFAULT_PASSWORD)
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": "admin",
            "fullName": "Administrator",
            "email": "admin@example.com",
            "role": "superadmin",
            "isActive": True,
            "passwordHash": hashed,
            "webhookToken": secrets.token_urlsafe(16),
            "createdAt": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "lastLogin": None,
        })
    else:
        # Migrate existing admin roles to superadmin
        await db.users.update_many({"role": "admin"}, {"$set": {"role": "superadmin"}})
        await db.users.update_many({"role": {"$in": ["operator", "viewer"]}}, {"$set": {"role": "user"}})
        # Migrate existing users missing webhookToken
        async for u in db.users.find({"webhookToken": {"$exists": False}}):
            await db.users.update_one({"id": u["id"]}, {"$set": {"webhookToken": secrets.token_urlsafe(16)}})

    # Sample rules - removed, use AI Setup to generate data

    # License: per-user isolation
    try:
        # Migrasi: license lama yang tanpa userId (atau userId="") di-copy ke
        # semua user existing yang belum punya license, lalu dibuang.
        legacy = await db.license.find_one({
            "$or": [{"userId": {"$exists": False}}, {"userId": ""}]
        }, {"_id": 0})
        if legacy:
            existing_users = await db.users.find({}, {"id": 1, "_id": 0}).to_list(1000)
            for u in existing_users:
                uid = str(u["id"])
                if not uid:
                    continue
                has_own = await db.license.find_one({"userId": uid})
                if has_own:
                    continue
                payload = {k: v for k, v in legacy.items() if k != "userId"}
                payload["userId"] = uid
                await db.license.insert_one(payload)
            await db.license.delete_many({
                "$or": [{"userId": {"$exists": False}}, {"userId": ""}]
            })
        # Index untuk lookup cepat per-user
        try:
            await db.license.create_index("userId", unique=True, sparse=True, name="license_userId_unique")
        except Exception:
            pass
    except Exception as e:
        print(f"[seed] WARNING: license migration failed: {e}")

    await ensure_admin_password()
    await seed_docs()

async def seed_docs():
    await db.docs.create_index("slug", unique=True)
    if await db.docs.count_documents({}) > 0:
        return
    default_docs = [
        {
            "slug": "dashboard",
            "title": "Dashboard",
            "sections": [
                {"type": "text", "content": "Dashboard menampilkan ringkasan aktivitas chatbot Anda secara real-time."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Total Pesan", "content": "Jumlah pesan masuk dan keluar yang diproses chatbot."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Total Kontak", "content": "Jumlah kontak unik yang pernah berinteraksi dengan chatbot."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Rules Aktif", "content": "Jumlah aturan balasan otomatis yang sedang aktif."},
                {"type": "step", "stepNumber": 4, "stepTitle": "AI Calls", "content": "Jumlah panggilan ke AI dan total token yang digunakan."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Grafik Aktivitas", "content": "Menampilkan tren pesan masuk dan keluar selama 7 hari terakhir."},
                {"type": "step", "stepNumber": 6, "stepTitle": "Status Sistem", "content": "Menampilkan status bot (aktif/nonaktif), uptime, dan rata-rata waktu respons."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "license",
            "title": "Lisensi",
            "sections": [
                {"type": "text", "content": "Halaman Lisensi digunakan untuk mengaktifkan dan mengelola lisensi produk."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Cek Status Lisensi", "content": "Halaman menampilkan status lisensi saat ini: aktif, expired, atau belum diaktifkan."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Aktivasi Lisensi", "content": "Masukkan license key yang diberikan, lalu klik tombol Aktivasi."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Info Lisensi", "content": "Setelah aktif, tampil nama pelanggan, nama paket, tanggal expired, dan maksimal aktivasi."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "connections",
            "title": "Koneksi",
            "sections": [
                {"type": "text", "content": "Halaman Koneksi digunakan untuk menghubungkan chatbot ke WhatsApp melalui WAHA API."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Isi URL WAHA", "content": "Masukkan URL server WAHA Anda, contoh: http://localhost:3000"},
                {"type": "step", "stepNumber": 2, "stepTitle": "Isi API Key", "content": "Masukkan API Key WAHA jika server Anda menggunakan autentikasi."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Nama Session", "content": "Isi nama session WhatsApp (default: 'default'). Satu session = satu nomor WhatsApp."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Simpan & Scan QR", "content": "Klik Simpan lalu scan QR Code yang muncul menggunakan aplikasi WhatsApp di HP Anda."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Status Koneksi", "content": "Setelah scan berhasil, status akan berubah menjadi CONNECTED dengan tanda hijau."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "ai-agent",
            "title": "AI Agent",
            "sections": [
                {"type": "text", "content": "Konfigurasi AI yang digunakan chatbot untuk membalas pesan secara cerdas."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Pilih Provider AI", "content": "Pilih provider: OpenAI, Gemini, atau Ollama (lokal). Setiap provider memiliki model berbeda."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Masukkan API Key", "content": "Isi API Key sesuai provider yang dipilih. API Key tersimpan terenkripsi."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Pilih Model", "content": "Pilih model AI, contoh: gpt-4o, gemini-2.0-flash. Model lebih canggih = lebih akurat tapi lebih mahal."},
                {"type": "step", "stepNumber": 4, "stepTitle": "System Prompt", "content": "Tulis instruksi kepribadian chatbot. Contoh: 'Kamu adalah customer service ramah yang menjawab singkat.'"},
                {"type": "step", "stepNumber": 5, "stepTitle": "Info Bisnis", "content": "Isi informasi bisnis (nama toko, alamat, jam buka) agar AI bisa menjawab pertanyaan tentang bisnis Anda."},
                {"type": "step", "stepNumber": 6, "stepTitle": "Parameter AI", "content": "Temperature: kreativitas jawaban (0=konsisten, 1=kreatif). Max Tokens: panjang maksimal balasan."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "rules",
            "title": "Rules Engine",
            "sections": [
                {"type": "text", "content": "Rules Engine memungkinkan chatbot membalas pesan secara otomatis berdasarkan aturan yang Anda buat tanpa menggunakan AI."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Tambah Rule", "content": "Klik tombol Tambah Rule, isi nama rule, trigger (kata kunci), dan balasan yang diinginkan."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Jenis Trigger", "content": "Contains: pesan mengandung kata kunci. Exact: pesan sama persis. Starts With: pesan diawali kata kunci."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Mode Respons", "content": "Direct: balas langsung dengan teks. AI Enhanced: gunakan AI untuk memperkaya balasan."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Prioritas", "content": "Angka lebih kecil = prioritas lebih tinggi. Rule dengan prioritas tertinggi dicek pertama."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Tambah Gambar", "content": "Opsional: tambahkan URL gambar untuk dikirim bersama balasan teks."},
                {"type": "step", "stepNumber": 6, "stepTitle": "Aktif/Nonaktif", "content": "Toggle switch untuk mengaktifkan atau menonaktifkan rule tanpa menghapusnya."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "knowledge",
            "title": "Knowledge Base",
            "sections": [
                {"type": "text", "content": "Knowledge Base adalah kumpulan pengetahuan yang digunakan AI untuk menjawab pertanyaan spesifik tentang bisnis Anda."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Tambah Entri", "content": "Klik Tambah, isi kategori (contoh: Produk), keyword pencarian, dan isi konten pengetahuan."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Kategori", "content": "Kelompokkan pengetahuan berdasarkan topik: Produk, Layanan, FAQ, Kebijakan, dll."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Keyword", "content": "Kata kunci yang memicu AI menggunakan entri ini. Contoh: 'harga', 'pengiriman', 'garansi'."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Konten", "content": "Isi informasi detail yang ingin diberikan AI saat keyword terdeteksi dalam pertanyaan pelanggan."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Aktif/Nonaktif", "content": "Nonaktifkan entri yang sudah tidak relevan tanpa harus menghapusnya."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "templates",
            "title": "Template",
            "sections": [
                {"type": "text", "content": "Template adalah pesan siap pakai yang bisa digunakan sebagai balasan cepat atau untuk broadcast."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Tambah Template", "content": "Klik Tambah Template, beri nama, pilih kategori, dan tulis isi pesan template."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Kategori", "content": "Kelompokkan template: Sambutan, Promo, Follow-up, Pengingat, dll. untuk memudahkan pencarian."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Gunakan Template", "content": "Template bisa digunakan langsung di fitur Broadcast atau disalin untuk dipakai di aturan."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "contacts",
            "title": "Kontak",
            "sections": [
                {"type": "text", "content": "Halaman Kontak menampilkan semua nomor WhatsApp yang pernah berinteraksi dengan chatbot Anda."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Daftar Kontak", "content": "Semua kontak tersimpan otomatis saat ada pesan masuk. Tampil nama, nomor, dan waktu terakhir chat."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Edit Nama & Tag", "content": "Klik kontak untuk mengedit nama tampilan, menambahkan tag (contoh: VIP, Pelanggan), dan catatan."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Tag & Filter", "content": "Gunakan tag untuk mengelompokkan kontak, memudahkan broadcast ke grup tertentu."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Blokir Kontak", "content": "Blokir kontak agar chatbot tidak membalas pesan dari nomor tersebut."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Cari Kontak", "content": "Gunakan kolom pencarian untuk menemukan kontak berdasarkan nama atau nomor."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "messages",
            "title": "Pesan",
            "sections": [
                {"type": "text", "content": "Halaman Pesan menampilkan riwayat semua pesan yang masuk dan keluar melalui chatbot."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Riwayat Pesan", "content": "Tampil pesan masuk (dari pelanggan) dan pesan keluar (balasan chatbot) secara kronologis."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Filter & Cari", "content": "Filter berdasarkan nomor atau kata kunci untuk menemukan percakapan spesifik."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Retensi Pesan", "content": "Pesan disimpan sesuai pengaturan retensi (default: 90 hari) yang bisa diubah di Settings."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "broadcast",
            "title": "Broadcast",
            "sections": [
                {"type": "text", "content": "Broadcast memungkinkan Anda mengirim pesan massal ke banyak kontak sekaligus."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Pilih Target", "content": "Semua Kontak: kirim ke semua. By Tag: kirim ke kontak dengan tag tertentu. Custom: masukkan nomor manual."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Tulis Pesan", "content": "Tulis pesan broadcast. Bisa menggunakan template yang sudah dibuat sebelumnya."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Cek Sebelum Kirim", "content": "Klik Cek terlebih dahulu untuk melihat jumlah penerima dan preview sebelum kirim."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Kirim Broadcast", "content": "Klik Kirim. Pesan dikirim secara bertahap (batch) untuk menghindari spam detection WhatsApp."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Batas Harian", "content": "Default maksimal 100 pesan/hari dan 10 pesan per batch. Bisa diubah di Settings."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "ai-setup",
            "title": "AI Setup",
            "sections": [
                {"type": "text", "content": "AI Setup membantu Anda mengkonfigurasi chatbot secara otomatis menggunakan AI melalui percakapan natural."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Mulai Chat", "content": "Ceritakan bisnis Anda kepada AI Setup. Contoh: 'Saya punya toko baju online, sering ditanya soal ukuran dan pengiriman.'"},
                {"type": "step", "stepNumber": 2, "stepTitle": "AI Generate Otomatis", "content": "AI akan membuat system prompt, knowledge base, dan rules secara otomatis berdasarkan cerita Anda."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Review & Apply", "content": "Review hasil yang dihasilkan AI, klik Apply untuk menerapkan konfigurasi ke chatbot Anda."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Iterasi", "content": "Lanjutkan percakapan untuk menyempurnakan konfigurasi. Contoh: 'Tambahkan info tentang metode pembayaran.'"},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "test-center",
            "title": "Test Center",
            "sections": [
                {"type": "text", "content": "Test Center memungkinkan Anda menguji chatbot sebelum digunakan pelanggan sungguhan."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Test Rule", "content": "Masukkan pesan untuk mengecek apakah ada rule yang cocok dengan trigger yang dikonfigurasi."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Test Knowledge", "content": "Cek apakah AI bisa menemukan jawaban relevan dari Knowledge Base berdasarkan pertanyaan."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Test Full Flow", "content": "Simulasi alur lengkap: pesan masuk → cek rule → cek knowledge → AI generate balasan."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Baca Hasil", "content": "Hasil test menampilkan: rule yang cocok (jika ada), konteks knowledge yang digunakan, dan balasan final."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "logs",
            "title": "Logs",
            "sections": [
                {"type": "text", "content": "Logs mencatat semua aktivitas sistem chatbot untuk keperluan monitoring dan debug."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Jenis Log", "content": "LOGIN_SUCCESS/FAILED: aktivitas login. MESSAGE_IN/OUT: pesan masuk/keluar. RULE_HIT: rule yang terpicu. AI_CALL: panggilan AI."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Filter Log", "content": "Filter berdasarkan jenis event atau kata kunci untuk menemukan log spesifik."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Retensi Log", "content": "Log tersimpan sesuai pengaturan retensi (default: 30 hari) yang bisa diubah di Settings."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
        {
            "slug": "settings",
            "title": "Setting",
            "sections": [
                {"type": "text", "content": "Halaman Setting berisi pengaturan umum operasional chatbot."},
                {"type": "step", "stepNumber": 1, "stepTitle": "Bot Aktif/Nonaktif", "content": "Toggle utama untuk mengaktifkan atau menonaktifkan chatbot secara keseluruhan."},
                {"type": "step", "stepNumber": 2, "stepTitle": "Jam Kerja", "content": "Aktifkan jam kerja agar bot hanya merespons pada jam yang ditentukan. Di luar jam kerja, kirim pesan offline."},
                {"type": "step", "stepNumber": 3, "stepTitle": "Simulasi Mengetik", "content": "Bot akan menampilkan indikator 'mengetik...' sebelum mengirim balasan agar terasa lebih natural."},
                {"type": "step", "stepNumber": 4, "stepTitle": "Delay Respons", "content": "Atur jeda waktu (ms) sebelum bot mengirim balasan. Default 2000ms (2 detik)."},
                {"type": "step", "stepNumber": 5, "stepTitle": "Rate Limit", "content": "Batasi jumlah balasan per menit per kontak untuk mencegah spam. Default 15 pesan/menit."},
                {"type": "step", "stepNumber": 6, "stepTitle": "Retensi Data", "content": "Atur berapa lama log dan pesan disimpan sebelum dihapus otomatis."},
            ],
            "updatedAt": datetime.utcnow().isoformat(),
        },
    ]
    await db.docs.insert_many(default_docs)

# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup():
    global _ai_semaphore
    _ai_semaphore = asyncio.Semaphore(5)  # max 5 concurrent AI calls
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.users.create_index("username", unique=True)
    await db.conversation_summaries.create_index([("chatId", 1), ("userId", 1)])
    await seed_defaults()
    logger.info("ChatBot Manager backend started")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ============================================================
# AUTH ENDPOINTS
# ============================================================

_login_attempts: dict = {}  # ip -> [timestamp, ...]
_LOGIN_MAX = 10
_LOGIN_WINDOW = 300  # 5 menit

def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    _login_attempts[ip] = [t for t in _login_attempts.get(ip, []) if now - t < _LOGIN_WINDOW]
    return len(_login_attempts.get(ip, [])) >= _LOGIN_MAX

def _record_attempt(ip: str):
    _login_attempts.setdefault(ip, []).append(time.time())

# Generic sliding-window rate limiter per (bucket_key, identifier).
_rate_buckets: dict = {}  # (bucket, key) -> [timestamp, ...]

def rate_limit(bucket: str, key: str, max_attempts: int, window_seconds: int) -> None:
    """Raise 429 jika identifier sudah melebihi max_attempts dalam window_seconds."""
    now = time.time()
    bucket_key = (bucket, key or "unknown")
    arr = [t for t in _rate_buckets.get(bucket_key, []) if now - t < window_seconds]
    if len(arr) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak request untuk {bucket}. Coba lagi dalam {window_seconds // 60} menit."
        )
    arr.append(now)
    _rate_buckets[bucket_key] = arr

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan login. Coba lagi 5 menit.")

    username = req.username.strip().lower() if req.username else "admin"

    # Check users collection first
    user = await db.users.find_one({"username": username, "isActive": True})
    if user:
        if not check_password(req.password, user.get("passwordHash", "")):
            _record_attempt(client_ip)
            await add_log("LOGIN_FAILED", f"Percobaan login gagal untuk user: {username}")
            return LoginResponse(success=False, message="Username atau password salah.")

        # Upgrade hash from legacy SHA-256 to bcrypt if needed
        stored_hash = user.get("passwordHash", "")
        if stored_hash and not stored_hash.startswith(('$2b$', '$2a$', '$2y$')):
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"passwordHash": hash_password(req.password)}}
            )

        token = await create_session(
            user_id=str(user["id"]),
            username=user["username"],
            role=user["role"],
            full_name=user.get("fullName", "")
        )
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"lastLogin": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")}}
        )
        await add_log("LOGIN_SUCCESS", f"User '{username}' login berhasil")
        await log_user_activity(str(user["id"]), username, "LOGIN", "Login berhasil")
        return LoginResponse(
            success=True,
            token=token,
            message="Login berhasil",
            user={
                "userId": str(user["id"]),
                "username": user["username"],
                "role": user["role"],
                "fullName": user.get("fullName", ""),
                "webhookToken": user.get("webhookToken", ""),
            }
        )

    # Fall back to legacy admin password ONLY for bootstrap when users collection
    # is completely empty (defense-in-depth for fresh installs that hit a race
    # condition with seed_defaults). Removed the unconditional backdoor.
    user_count = await db.users.count_documents({})
    if user_count == 0 and username == "admin" and req.password == DEFAULT_PASSWORD:
        token = await create_session(user_id="admin", username="admin", role="superadmin", full_name="Administrator")
        await add_log("LOGIN_SUCCESS", "Admin login berhasil (bootstrap)")
        await log_user_activity("admin", "admin", "LOGIN", "Login berhasil (bootstrap)")
        return LoginResponse(
            success=True,
            token=token,
            message="Login berhasil",
            user={"userId": "admin", "username": "admin", "role": "superadmin", "fullName": "Administrator"}
        )

    _record_attempt(client_ip)
    await add_log("LOGIN_FAILED", f"Percobaan login gagal untuk: {username[:32]}")
    await log_user_activity("unknown", username[:32], "LOGIN_FAILED", "Password salah")
    return LoginResponse(success=False, message="Username atau password salah.")

@api_router.post("/auth/logout")
async def logout(current_user: Dict = Depends(get_current_user)):
    await log_user_activity(current_user["userId"], current_user["username"], "LOGOUT", "Logout")
    await db.sessions.delete_one({"token": current_user["token"]})
    return {"success": True}

@api_router.get("/auth/check")
async def check_session(current_user: Dict = Depends(get_current_user)):
    license_doc = await db.license.find_one({"userId": current_user["userId"]}, {"_id": 0})
    # Fetch webhookToken from users collection
    user_doc = await db.users.find_one({"id": current_user["userId"]})
    webhook_token = user_doc.get("webhookToken", "") if user_doc else ""
    return {
        "valid": True,
        "license": license_doc,
        "user": {
            "userId": current_user["userId"],
            "username": current_user["username"],
            "role": current_user["role"],
            "fullName": current_user["fullName"],
            "webhookToken": webhook_token,
        }
    }

# ============================================================
# USER MANAGEMENT (admin only)
# ============================================================

@api_router.get("/users")
async def get_users(admin: Dict = Depends(require_superadmin)):
    users = await db.users.find({}, {"_id": 0, "passwordHash": 0}).to_list(200)
    return users

@api_router.get("/users/stats")
async def get_user_stats(admin: Dict = Depends(require_superadmin)):
    total = await db.users.count_documents({})
    active = await db.users.count_documents({"isActive": True})
    superadmins = await db.users.count_documents({"role": "superadmin"})
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "admins": superadmins,
        "superadmins": superadmins,
    }

@api_router.post("/users")
async def create_user(req: UserCreate, admin: Dict = Depends(require_superadmin)):
    try:
        validate_password_strength(req.password)

        username = req.username.strip().lower()
        if not username:
            raise HTTPException(status_code=400, detail="Username tidak boleh kosong.")

        if req.role not in ("superadmin", "user"):
            raise HTTPException(status_code=400, detail="Role tidak valid. Pilih: superadmin atau user.")

        existing = await db.users.find_one({"username": username})
        if existing:
            raise HTTPException(status_code=400, detail=f"Username '{username}' sudah digunakan.")

        hashed = hash_password(req.password)
        user_doc = {
            "id": str(uuid.uuid4()),
            "username": username,
            "fullName": req.fullName.strip(),
            "email": req.email.strip() if req.email else "",
            "role": req.role,
            "isActive": req.isActive,
            "passwordHash": hashed,
            "webhookToken": secrets.token_urlsafe(16),
            "createdAt": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "lastLogin": None,
        }
        await db.users.insert_one(user_doc)
        await add_log("USER_CREATED", f"User '{username}' ({req.role}) dibuat oleh '{admin['username']}'")
        await log_user_activity(admin["userId"], admin["username"], "USER_CREATED", f"Membuat user '{username}' ({req.role})")

        user_doc.pop("_id", None)
        user_doc.pop("passwordHash", None)
        return {"success": True, "user": user_doc}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal membuat user: {str(e)}")

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, req: UserUpdate, admin: Dict = Depends(require_superadmin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    # Prevent removing the last superadmin
    if req.role and req.role != "superadmin" and user.get("role") == "superadmin":
        sa_count = await db.users.count_documents({"role": "superadmin", "isActive": True})
        if sa_count <= 1:
            raise HTTPException(status_code=400, detail="Tidak bisa mengubah role superadmin terakhir.")

    update_dict = {}
    if req.fullName is not None:
        update_dict["fullName"] = req.fullName.strip()
    if req.email is not None:
        update_dict["email"] = req.email.strip()
    if req.role is not None:
        if req.role not in ("superadmin", "user"):
            raise HTTPException(status_code=400, detail="Role tidak valid.")
        update_dict["role"] = req.role
    if req.isActive is not None:
        if not req.isActive and user.get("role") == "superadmin":
            sa_count = await db.users.count_documents({"role": "superadmin", "isActive": True})
            if sa_count <= 1:
                raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan superadmin terakhir.")
        update_dict["isActive"] = req.isActive
    if req.password is not None:
        validate_password_strength(req.password)
        update_dict["passwordHash"] = hash_password(req.password)

    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})

    await add_log("USER_UPDATED", f"User '{user['username']}' diupdate oleh '{admin['username']}'")
    await log_user_activity(admin["userId"], admin["username"], "USER_UPDATED", f"Update user '{user['username']}'")
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "passwordHash": 0})
    return {"success": True, "user": updated}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: Dict = Depends(require_superadmin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    if user.get("role") == "superadmin":
        sa_count = await db.users.count_documents({"role": "superadmin"})
        if sa_count <= 1:
            raise HTTPException(status_code=400, detail="Tidak bisa menghapus superadmin terakhir.")

    if user_id == admin["userId"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri.")

    await db.users.delete_one({"id": user_id})
    await db.sessions.delete_many({"userId": user_id})
    await add_log("USER_DELETED", f"User '{user['username']}' dihapus oleh '{admin['username']}'")
    await log_user_activity(admin["userId"], admin["username"], "USER_DELETED", f"Menghapus user '{user['username']}'")
    return {"success": True}

@api_router.put("/users/{user_id}/toggle")
async def toggle_user(user_id: str, admin: Dict = Depends(require_superadmin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    new_status = not user.get("isActive", True)

    if not new_status and user.get("role") == "superadmin":
        sa_count = await db.users.count_documents({"role": "superadmin", "isActive": True})
        if sa_count <= 1:
            raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan superadmin terakhir.")

    await db.users.update_one({"id": user_id}, {"$set": {"isActive": new_status}})
    if not new_status:
        await db.sessions.delete_many({"userId": user_id})
    status_label = "diaktifkan" if new_status else "dinonaktifkan"
    await add_log("USER_TOGGLED", f"User '{user['username']}' {status_label}")
    await log_user_activity(admin["userId"], admin["username"], "USER_TOGGLED", f"User '{user['username']}' {status_label}")
    return {"success": True, "isActive": new_status}

# ============================================================
# DASHBOARD
# ============================================================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    total_messages = await db.messages.count_documents({"userId": uid})
    total_contacts = await db.contacts.count_documents({"userId": uid})
    active_rules = await db.rules.count_documents({"userId": uid, "isActive": True})

    pipeline = [
        {"$match": {"userId": uid}},
        {"$group": {"_id": None,
            "totalTokens": {"$sum": "$tokensUsed"},
            "aiCalls":    {"$sum": {"$cond": [{"$in": ["$responseType", ["ai", "combo"]]}, 1, 0]}},
            "ruleCalls":  {"$sum": {"$cond": [{"$eq": ["$responseType", "rule"]},   1, 0]}},
            "comboCalls": {"$sum": {"$cond": [{"$eq": ["$responseType", "combo"]},  1, 0]}},
            "incomingCount": {"$sum": {"$cond": [{"$eq": ["$direction", "incoming"]}, 1, 0]}},
            "outgoingCount": {"$sum": {"$cond": [{"$eq": ["$direction", "outgoing"]}, 1, 0]}},
        }}
    ]
    agg = await db.messages.aggregate(pipeline).to_list(1)
    agg0 = agg[0] if agg else {}
    tokens_used    = agg0.get("totalTokens", 0)
    ai_calls       = agg0.get("aiCalls", 0)
    rule_calls     = agg0.get("ruleCalls", 0)
    combo_calls    = agg0.get("comboCalls", 0)
    incoming_count = agg0.get("incomingCount", 0)
    outgoing_count = agg0.get("outgoingCount", 0)

    # Top rules by hit count
    top_rules = await db.rules.find({"userId": uid}, {"_id": 0, "name": 1, "hitCount": 1}).sort("hitCount", -1).to_list(5)

    cfg = await _get_user_config(uid)
    bot_active = cfg.get("isBotActive", False)
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"isActive": True})

    return {
        "totalMessages": total_messages,
        "totalContacts": total_contacts,
        "activeRules": active_rules,
        "aiCalls": ai_calls,
        "ruleCalls": rule_calls,
        "comboCalls": combo_calls,
        "tokensUsed": tokens_used,
        "incomingCount": incoming_count,
        "outgoingCount": outgoing_count,
        "botActive": bot_active,
        "topRules": top_rules,
        "uptime": "99.8%",
        "avgResponseTime": "1.2s",
        "totalUsers": total_users,
        "activeUsers": active_users,
    }

@api_router.get("/dashboard/chart")
async def get_dashboard_chart(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    chart_data = []
    for i in range(6, -1, -1):
        date = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        messages_in = await db.messages.count_documents({
            "userId": uid, "direction": "incoming",
            "timestamp": {"$regex": f"^{date}"}
        })
        messages_out = await db.messages.count_documents({
            "userId": uid, "direction": "outgoing",
            "timestamp": {"$regex": f"^{date}"}
        })
        chart_data.append({
            "date": date,
            "messagesIn": messages_in,
            "messagesOut": messages_out,
            "rulesMatched": 0,
            "aiCalls": 0,
        })
    return chart_data

# ============================================================
# CONFIG
# ============================================================

async def _get_user_config(user_id: str) -> dict:
    """Load config for a user. Each user is fully isolated — no global fallback.
    Branding (siteName/favicon/logo) is handled via a separate endpoint.
    """
    if not user_id:
        return {}
    docs = await db.config.find(
        {"key": {"$ne": "admin_password_hash"}, "userId": user_id},
        {"_id": 0}
    ).to_list(400)
    result: dict = {}
    for c in docs:
        key = c["key"]
        val = c.get("value", "")
        # Keep the first non-empty value (defensive against duplicates)
        if key not in result or (not result[key] and val):
            result[key] = val
    return result

@api_router.get("/config")
async def get_config(current_user: Dict = Depends(get_current_user)):
    return await _get_user_config(current_user["userId"])

@api_router.put("/config")
async def update_config(req: ConfigUpdate, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    for key, value in req.updates.items():
        if key == "admin_password_hash":
            continue
        await db.config.update_one(
            {"key": key, "userId": uid},
            {"$set": {"key": key, "userId": uid, "value": value, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    await add_log("CONFIG_UPDATE", f"[{current_user['username']}] Config updated: {', '.join(req.updates.keys())}")
    await log_user_activity(uid, current_user["username"], "CONFIG_UPDATE", f"Update config: {', '.join(req.updates.keys())}")
    return {"success": True}

@api_router.get("/config/ai-agent")
async def get_ai_agent_config(current_user: Dict = Depends(get_current_user)):
    keys = ["systemPrompt", "businessInfo", "aiTemperature", "aiMaxTokens", "memoryLimit", "memoryTimeoutMinutes", "ruleAiEnabled"]
    cfg = await _get_user_config(current_user["userId"])
    return {k: cfg.get(k, "") for k in keys}

@api_router.put("/config/ai-agent")
async def update_ai_agent_config(req: AIAgentConfig, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    updates = req.dict(exclude_none=True)
    for key, value in updates.items():
        await db.config.update_one(
            {"key": key, "userId": uid},
            {"$set": {"key": key, "userId": uid, "value": value, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    await add_log("AI_AGENT_UPDATE", f"[{current_user['username']}] AI Agent config updated: {', '.join(updates.keys())}")
    await log_user_activity(uid, current_user["username"], "AI_AGENT_UPDATE", f"Update AI Agent config")
    return {"success": True, "updated_keys": list(updates.keys())}

# ============================================================
# LICENSE
# ============================================================

@api_router.get("/license")
async def get_license(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    doc = await db.license.find_one({"userId": uid}, {"_id": 0})
    return doc or {"valid": False, "status": "missing"}

@api_router.post("/license/activate")
async def activate_license(req: LicenseActivate, current_user: Dict = Depends(get_current_user)):
    rate_limit("license_activate", current_user["userId"], max_attempts=10, window_seconds=600)
    uid = current_user["userId"]
    license_data = {
        "userId": uid,
        "valid": True,
        "status": "active",
        "licenseKey": req.licenseKey,
        "customerName": "Customer",
        "planName": "Professional",
        "expiresAt": (datetime.utcnow() + timedelta(days=365)).strftime("%Y-%m-%d"),
        "maxActivations": 3,
        "instanceId": str(uuid.uuid4()),
    }
    await db.license.update_one({"userId": uid}, {"$set": license_data}, upsert=True)
    await add_log("LICENSE_ACTIVATED", f"[{current_user['username']}] Lisensi diaktifkan: {req.licenseKey}", uid)
    await log_user_activity(uid, current_user["username"], "LICENSE_ACTIVATED", f"Lisensi diaktifkan: {req.licenseKey}")
    return license_data

@api_router.delete("/license")
async def clear_license(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    await db.license.update_one(
        {"userId": uid},
        {"$set": {
            "userId": uid,
            "valid": False, "status": "missing", "licenseKey": "",
            "customerName": "", "planName": "", "expiresAt": ""
        }},
        upsert=True
    )
    await add_log("LICENSE_CLEARED", f"[{current_user['username']}] Lisensi dihapus", uid)
    await log_user_activity(uid, current_user["username"], "LICENSE_CLEARED", "Lisensi dihapus")
    return {"success": True}

# ============================================================
# RULES
# ============================================================

@api_router.get("/rules")
async def get_rules(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    rules = await db.rules.find({"userId": uid}, {"_id": 0}).sort("priority", 1).to_list(200)
    return rules

@api_router.post("/rules")
async def save_rule(rule: RuleModel, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    rule_dict = rule.dict()
    if not rule_dict.get("id"):
        rule_dict["id"] = str(uuid.uuid4())
    rule_dict["userId"] = uid
    rule_dict["created_at"] = datetime.utcnow()

    existing = await db.rules.find_one({"id": rule_dict["id"], "userId": uid})
    if existing:
        await db.rules.update_one({"id": rule_dict["id"], "userId": uid}, {"$set": rule_dict})
        action = "RULE_UPDATED"
    else:
        await db.rules.insert_one(rule_dict)
        action = "RULE_CREATED"

    await add_log("RULE_SAVED", f"[{current_user['username']}] Rule '{rule_dict['name']}' disimpan")
    await log_user_activity(uid, current_user["username"], action, f"Rule '{rule_dict['name']}'")
    rule_dict.pop("_id", None)
    return {"success": True, "rule": rule_dict}

@api_router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    rule = await db.rules.find_one({"id": rule_id, "userId": uid})
    result = await db.rules.delete_one({"id": rule_id, "userId": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule tidak ditemukan")
    await add_log("RULE_DELETED", f"[{current_user['username']}] Rule '{rule.get('name', rule_id)}' dihapus")
    await log_user_activity(uid, current_user["username"], "RULE_DELETED", f"Rule '{rule.get('name', rule_id)}' dihapus")
    return {"success": True}

@api_router.put("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    rule = await db.rules.find_one({"id": rule_id, "userId": uid})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule tidak ditemukan")
    new_status = not rule.get("isActive", True)
    await db.rules.update_one({"id": rule_id, "userId": uid}, {"$set": {"isActive": new_status}})
    return {"success": True, "isActive": new_status}

# ============================================================
# KNOWLEDGE
# ============================================================

@api_router.get("/knowledge")
async def get_knowledge(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    items = await db.knowledge.find({"userId": uid}, {"_id": 0}).to_list(200)
    return items

@api_router.post("/knowledge")
async def save_knowledge(item: KnowledgeModel, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    item_dict = item.dict()
    if not item_dict.get("id"):
        item_dict["id"] = str(uuid.uuid4())
    item_dict["userId"] = uid
    item_dict["created_at"] = datetime.utcnow()

    existing = await db.knowledge.find_one({"id": item_dict["id"], "userId": uid})
    if existing:
        await db.knowledge.update_one({"id": item_dict["id"], "userId": uid}, {"$set": item_dict})
        action = "KNOWLEDGE_UPDATED"
    else:
        await db.knowledge.insert_one(item_dict)
        action = "KNOWLEDGE_CREATED"

    await add_log("KNOWLEDGE_SAVED", f"[{current_user['username']}] Knowledge '{item_dict['category']}' disimpan")
    await log_user_activity(uid, current_user["username"], action, f"Knowledge '{item_dict['keyword']}' ({item_dict['category']})")
    item_dict.pop("_id", None)
    return {"success": True, "item": item_dict}

@api_router.delete("/knowledge/{item_id}")
async def delete_knowledge(item_id: str, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    item = await db.knowledge.find_one({"id": item_id, "userId": uid})
    result = await db.knowledge.delete_one({"id": item_id, "userId": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Knowledge tidak ditemukan")
    await add_log("KNOWLEDGE_DELETED", f"[{current_user['username']}] Knowledge '{item.get('keyword', item_id)}' dihapus")
    await log_user_activity(uid, current_user["username"], "KNOWLEDGE_DELETED", f"Knowledge '{item.get('keyword', item_id)}' dihapus")
    return {"success": True}

# ============================================================
# TEMPLATES
# ============================================================

@api_router.get("/templates")
async def get_templates(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    items = await db.templates.find({"userId": uid}, {"_id": 0}).to_list(200)
    return items

@api_router.post("/templates")
async def save_template(item: TemplateModel, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    item_dict = item.dict()
    if not item_dict.get("id"):
        item_dict["id"] = str(uuid.uuid4())
    item_dict["userId"] = uid
    item_dict["created_at"] = datetime.utcnow()

    existing = await db.templates.find_one({"id": item_dict["id"], "userId": uid})
    if existing:
        await db.templates.update_one({"id": item_dict["id"], "userId": uid}, {"$set": item_dict})
    else:
        await db.templates.insert_one(item_dict)

    await add_log("TEMPLATE_SAVED", f"[{current_user['username']}] Template '{item_dict['name']}' disimpan")
    item_dict.pop("_id", None)
    return {"success": True, "item": item_dict}

@api_router.delete("/templates/{item_id}")
async def delete_template(item_id: str, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    result = await db.templates.delete_one({"id": item_id, "userId": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    await add_log("TEMPLATE_DELETED", f"[{current_user['username']}] Template {item_id} dihapus")
    return {"success": True}

# ============================================================
# CONTACTS
# ============================================================

@api_router.get("/contacts")
async def get_contacts(search: str = "", current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    query: dict = {"userId": uid}
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"chatId": {"$regex": escaped}},
            {"tag": {"$regex": escaped, "$options": "i"}},
        ]
    contacts = await db.contacts.find(query, {"_id": 0}).sort("lastSeen", -1).to_list(500)
    return contacts

@api_router.put("/contacts/{chat_id}")
async def update_contact(chat_id: str, update: ContactUpdate, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if not update_dict:
        return {"success": True}
    result = await db.contacts.update_one({"chatId": chat_id, "userId": uid}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kontak tidak ditemukan")
    return {"success": True}

@api_router.delete("/contacts/{chat_id}")
async def delete_contact(chat_id: str, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    result = await db.contacts.delete_one({"chatId": chat_id, "userId": uid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kontak tidak ditemukan")
    await add_log("CONTACT_DELETED", f"[{current_user['username']}] Kontak {chat_id[:10]}... dihapus")
    return {"success": True}

# ============================================================
# MESSAGES
# ============================================================

@api_router.get("/messages")
async def get_messages(limit: int = 50, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    messages = await db.messages.find({"userId": uid}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return messages

# ============================================================
# BROADCAST
# ============================================================

@api_router.post("/broadcast/check")
async def check_broadcast(req: BroadcastCheck, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    if req.target == "all":
        count = await db.contacts.count_documents({"userId": uid, "isBlocked": {"$ne": True}})
    elif req.target == "tag" and req.tag:
        tags = [re.escape(t.strip()) for t in req.tag.split(",")]
        query = {"userId": uid, "isBlocked": {"$ne": True}, "$or": [{"tag": {"$regex": t, "$options": "i"}} for t in tags]}
        count = await db.contacts.count_documents(query)
    elif req.target == "custom" and req.customNumbers:
        count = len([n for n in req.customNumbers.split("\n") if n.strip()])
    else:
        count = 0
    return {"count": count}

@api_router.post("/broadcast/send")
async def send_broadcast(req: BroadcastSend, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")

    if req.target == "all":
        contacts = await db.contacts.find({"userId": uid, "isBlocked": {"$ne": True}}, {"chatId": 1}).to_list(500)
    elif req.target == "tag" and req.tag:
        tags = [re.escape(t.strip()) for t in req.tag.split(",")]
        contacts = await db.contacts.find(
            {"userId": uid, "isBlocked": {"$ne": True}, "$or": [{"tag": {"$regex": t, "$options": "i"}} for t in tags]},
            {"chatId": 1}
        ).to_list(500)
    elif req.target == "custom" and req.customNumbers:
        numbers = [n.strip() for n in req.customNumbers.split("\n") if n.strip()]
        contacts = [{"chatId": f"{n}@c.us"} for n in numbers]
    else:
        contacts = []

    count = len(contacts)
    await add_log("BROADCAST_SENT", f"[{current_user['username']}] Broadcast dikirim ke {count} kontak")

    cfg = await _get_user_config(uid)
    tz_offset = {"WIB": 7, "WITA": 8, "WIT": 9}.get(cfg.get("timezone", "WIB"), 7)

    for c in contacts:
        chat_id = c.get("chatId", "unknown")
        contact_doc = await db.contacts.find_one({"chatId": chat_id, "userId": uid}) or {}
        resolved_msg = resolve_template(req.message, contact_doc, tz_offset)
        await db.messages.insert_one({
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "chatId": chat_id,
            "userId": uid,
            "direction": "outgoing",
            "message": resolved_msg[:200],
            "responseType": "broadcast",
            "tokensUsed": 0
        })

    await log_user_activity(uid, current_user["username"], "BROADCAST_SENT", f"Broadcast ke {count} kontak")
    return {"success": True, "sent": count}

@api_router.post("/broadcast/send-one")
async def send_broadcast_one(req: BroadcastSendOne, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")
    if not req.chatId:
        raise HTTPException(status_code=400, detail="chatId diperlukan")

    cfg = await _get_user_config(uid)
    waha_url = cfg.get("wahaUrl", "").rstrip("/")
    waha_session = cfg.get("wahaSession", "default") or "default"
    waha_api_key = cfg.get("wahaApiKey", "")
    tz_offset = {"WIB": 7, "WITA": 8, "WIT": 9}.get(cfg.get("timezone", "WIB"), 7)

    contact_doc = await db.contacts.find_one({"chatId": req.chatId, "userId": uid}) or {}
    resolved_msg = resolve_template(req.message, contact_doc, tz_offset)

    # Actually send via WAHA
    if waha_url:
        try:
            await send_waha_text(waha_url, waha_session, waha_api_key, req.chatId, resolved_msg)
        except Exception as _e:
            raise HTTPException(status_code=502, detail=f"Gagal kirim via WAHA: {_e}")

    await db.messages.insert_one({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "chatId": req.chatId,
        "userId": uid,
        "direction": "outgoing",
        "message": resolved_msg[:500],
        "responseType": "broadcast",
        "tokensUsed": 0,
    })
    return {"success": True, "chatId": req.chatId}

# ============================================================
# EXPORT (Feature 3)
# ============================================================

@api_router.get("/export/contacts")
async def export_contacts(fmt: str = "csv", current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    contacts = await db.contacts.find({"userId": uid}, {"_id": 0}).to_list(10000)
    if fmt == "json":
        return contacts
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["chatId","name","phone","tag","note","isBlocked","lastSeen","messageCount","createdAt"])
    for c in contacts:
        w.writerow([c.get("chatId",""), c.get("name",""), c.get("phone",""), c.get("tag",""),
                    c.get("note",""), c.get("isBlocked",False), c.get("lastSeen",""),
                    c.get("messageCount",0), c.get("createdAt","")])
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"})

@api_router.get("/export/messages")
async def export_messages(fmt: str = "csv", current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    messages = await db.messages.find({"userId": uid}, {"_id": 0}).sort("timestamp", -1).to_list(10000)
    if fmt == "json":
        return messages
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["timestamp","chatId","direction","message","responseType","tokensUsed"])
    for m in messages:
        w.writerow([m.get("timestamp",""), m.get("chatId",""), m.get("direction",""),
                    m.get("message",""), m.get("responseType",""), m.get("tokensUsed",0)])
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=messages.csv"})

@api_router.get("/export/rules")
async def export_rules(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    rules = await db.rules.find({"userId": uid}, {"_id": 0}).to_list(1000)
    return rules

@api_router.get("/export/knowledge")
async def export_knowledge(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    items = await db.knowledge.find({"userId": uid}, {"_id": 0}).to_list(1000)
    return items

# ============================================================
# LOGS
# ============================================================

@api_router.get("/logs")
async def get_logs(limit: int = 50, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    # superadmin melihat semua log; user biasa hanya log miliknya
    query: dict = {} if current_user.get("role") == "superadmin" else {"userId": uid}
    logs = await db.logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

async def add_log(log_type: str, message: str, user_id: str = ""):
    await db.logs.insert_one({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "type": log_type,
        "message": message,
        "userId": user_id,
    })

# ── Realtime workflow event stream ──────────────────────────────────────────
# One asyncio.Queue per user. SSE clients consume from their queue.
_workflow_queues: dict[str, asyncio.Queue] = {}

def _get_wf_queue(uid: str) -> asyncio.Queue:
    if uid not in _workflow_queues:
        _workflow_queues[uid] = asyncio.Queue(maxsize=200)
    return _workflow_queues[uid]

async def emit_workflow(uid: str, event_type: str, data: dict):
    try:
        q = _get_wf_queue(uid)
        payload = {"type": event_type, "ts": datetime.utcnow().isoformat(), **data}
        q.put_nowait(payload)
    except (asyncio.QueueFull, Exception):
        pass  # no active SSE listener — silently drop

async def log_user_activity(user_id: str, username: str, action: str, detail: str = ""):
    await db.user_activity.insert_one({
        "userId": user_id,
        "username": username,
        "action": action,
        "detail": detail,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    })

# ============================================================
# TEST CENTER
# ============================================================

@api_router.post("/test/rule")
async def test_rule(req: TestRequest, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    msg = req.message.lower()
    rules = await db.rules.find({"userId": uid, "isActive": True}, {"_id": 0}).sort("priority", 1).to_list(100)

    for rule in rules:
        trigger = rule.get("triggerValue", "")
        trigger_type = rule.get("triggerType", "contains")

        if trigger_type == "contains":
            keywords = [k.strip().lower() for k in trigger.split("|")]
            if any(kw in msg for kw in keywords):
                return {"type": "Rule Match", "status": "success", "detail": f'Rule "{rule["name"]}" cocok! Trigger: {trigger_type} "{trigger}", Response: {rule["response"][:100]}...'}
        elif trigger_type == "exact":
            if msg == trigger.lower():
                return {"type": "Rule Match", "status": "success", "detail": f'Rule "{rule["name"]}" exact match!'}

    return {"type": "Rule Match", "status": "no_match", "detail": "Tidak ada rule yang cocok dengan pesan tersebut."}

@api_router.post("/test/knowledge")
async def test_knowledge(req: TestRequest, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    msg = req.message.lower()
    items = await db.knowledge.find({"userId": uid, "isActive": True}, {"_id": 0}).to_list(100)

    for item in items:
        keywords = [k.strip().lower() for k in item.get("keyword", "").split("|")]
        if any(kw in msg for kw in keywords):
            return {"type": "Knowledge Match", "status": "success", "detail": f'Knowledge "{item["category"]}" cocok! Keyword: {item["keyword"]}, Content: {item["content"][:100]}...'}

    return {"type": "Knowledge Match", "status": "no_match", "detail": "Tidak ada knowledge yang cocok."}

@api_router.post("/test/full-flow")
async def test_full_flow(req: TestRequest, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    msg = req.message.lower()

    rules = await db.rules.find({"userId": uid, "isActive": True}, {"_id": 0}).sort("priority", 1).to_list(100)
    for rule in rules:
        keywords = [k.strip().lower() for k in rule.get("triggerValue", "").split("|")]
        if any(kw in msg for kw in keywords):
            return {"type": "Full Flow", "status": "success", "detail": f'Flow: Rule "{rule["name"]}" matched → Mode: {rule.get("responseMode", "direct")} → Response: "{rule["response"][:150]}"'}

    items = await db.knowledge.find({"userId": uid, "isActive": True}, {"_id": 0}).to_list(100)
    for item in items:
        keywords = [k.strip().lower() for k in item.get("keyword", "").split("|")]
        if any(kw in msg for kw in keywords):
            return {"type": "Full Flow", "status": "success", "detail": f'Flow: Knowledge "{item["category"]}" matched → AI context → Response berdasarkan: {item["content"][:100]}...'}

    return {"type": "Full Flow", "status": "success", "detail": "Flow: No rule/knowledge match → AI full response → Bot akan merespon dengan AI berdasarkan system prompt."}

@api_router.post("/test/ai")
async def test_ai(req: TestRequest, current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")

    cfg = await _get_user_config(uid)
    provider = cfg.get("aiProvider", "").upper()
    model = cfg.get("aiModel", "")
    api_key = cfg.get("aiApiKey", "")
    ollama_url = cfg.get("ollamaUrl", "")
    system_prompt = cfg.get("systemPrompt", "") or "Kamu adalah asisten virtual yang membantu dan ramah."
    temperature = float(cfg.get("aiTemperature") or 0.7)
    max_tokens = int(cfg.get("aiMaxTokens") or 500)

    if not provider:
        return {"type": "Test AI", "status": "error", "detail": "Provider AI belum dikonfigurasi. Atur di halaman Koneksi."}
    if not api_key and provider not in ("OLLAMA",):
        return {"type": "Test AI", "status": "error", "detail": f"API key {provider} belum diisi. Atur di halaman Koneksi."}

    import time as _time
    t0 = _time.time()
    reply, tokens = await call_ai(
        provider, model, api_key, system_prompt,
        [{"role": "user", "content": req.message}],
        temperature, max_tokens, ollama_url
    )
    elapsed = round(_time.time() - t0, 2)

    if not reply:
        return {"type": "Test AI", "status": "error", "detail": f"AI ({provider}/{model}) tidak mengembalikan respons. Cek API key dan model di halaman Koneksi, lalu lihat Logs untuk detail error."}

    return {
        "type": "Test AI",
        "status": "success",
        "detail": reply,
        "meta": f"Provider: {provider} | Model: {model} | Tokens: {tokens} | Waktu: {elapsed}s",
    }

@app.websocket("/ws/workflow")
async def workflow_ws(websocket: WebSocket, token: str = ""):
    # Authenticate via query parameter (WebSocket can't use custom headers easily)
    if not token:
        await websocket.close(code=4001)
        return
    session = await db.sessions.find_one({"token": token, "expires_at": {"$gt": datetime.utcnow()}})
    if not session:
        await websocket.close(code=4001)
        return
    uid = session["userId"]
    await websocket.accept()
    q = _get_wf_queue(uid)
    # Drain stale events
    while not q.empty():
        try: q.get_nowait()
        except Exception: break
    # Send connected
    try:
        await websocket.send_json({"type": "connected", "ts": datetime.utcnow().isoformat()})
    except Exception:
        return
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=20)
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except (WebSocketDisconnect, Exception):
        pass


# ============================================================
# RESET
# ============================================================

@api_router.post("/reset/config")
async def reset_config(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    await db.rules.delete_many({"userId": uid})
    await db.knowledge.delete_many({"userId": uid})
    await db.templates.delete_many({"userId": uid})
    # Reset AI agent config. We need to clear BOTH:
    #  1. User-specific entries (userId=uid)
    #  2. Global entries (userId="") — legacy data from single-user version
    #     may live here and leak through _get_user_config fallback even after
    #     user-specific is cleared.
    # We delete user-specific, then force global to factory defaults.
    ai_keys = [
        "systemPrompt", "businessInfo",
        "aiProvider", "aiModel", "aiApiKey", "ollamaUrl",
        "aiTemperature", "aiMaxTokens",
        "memoryLimit", "memoryTimeoutMinutes",
        "ruleAiEnabled",
    ]
    factory_defaults = {
        "systemPrompt": "", "businessInfo": "",
        "aiProvider": "", "aiModel": "", "aiApiKey": "", "ollamaUrl": "",
        "aiTemperature": 0.7, "aiMaxTokens": 500,
        "memoryLimit": 10, "memoryTimeoutMinutes": 30,
        "ruleAiEnabled": False,
    }
    await db.config.delete_many({"key": {"$in": ai_keys}, "userId": uid})
    for key, default_val in factory_defaults.items():
        await db.config.update_one(
            {"key": key, "userId": ""},
            {"$set": {"key": key, "userId": "", "value": default_val, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    await add_log("RESET_CONFIG", f"[{current_user['username']}] Konfigurasi BOT direset (Rules, Knowledge, Template, AI Agent)", uid)
    return {"success": True, "message": "Konfigurasi BOT berhasil direset. Rules, Knowledge, Template, dan AI Agent dikosongkan."}

@api_router.post("/reset/dashboard")
async def reset_dashboard(current_user: Dict = Depends(get_current_user)):
    await add_log("RESET_DASHBOARD", f"[{current_user['username']}] Data dashboard direset", current_user["userId"])
    return {"success": True, "message": "Data dashboard berhasil direset."}

@api_router.post("/reset/messages")
async def reset_messages(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    result = await db.messages.delete_many({"userId": uid})
    await add_log("RESET_MESSAGES", f"[{current_user['username']}] Data pesan direset ({result.deleted_count} pesan dihapus)", uid)
    return {"success": True, "message": f"Data pesan berhasil direset. {result.deleted_count} pesan dihapus."}

@api_router.post("/reset/contacts")
async def reset_contacts(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    result = await db.contacts.delete_many({"userId": uid})
    await add_log("RESET_CONTACTS", f"[{current_user['username']}] Data kontak direset ({result.deleted_count} kontak dihapus)", uid)
    return {"success": True, "message": f"Data kontak berhasil direset. {result.deleted_count} kontak dihapus."}

@api_router.post("/reset/logs")
async def reset_logs(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    result = await db.logs.delete_many({"userId": uid})
    await add_log("RESET_LOGS", f"[{current_user['username']}] Data log direset ({result.deleted_count} entri dihapus)", uid)
    return {"success": True, "message": f"Data log berhasil direset. {result.deleted_count} entri dihapus."}

# ============================================================
# PASSWORD CHANGE
# ============================================================

@api_router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, current_user: Dict = Depends(get_current_user)):
    rate_limit("change_password", current_user["userId"], max_attempts=5, window_seconds=600)
    if not req.currentPassword or not req.newPassword:
        raise HTTPException(status_code=400, detail="Password lama dan baru wajib diisi.")
    if req.newPassword != req.confirmPassword:
        raise HTTPException(status_code=400, detail="Konfirmasi password tidak cocok.")
    if req.currentPassword == req.newPassword:
        raise HTTPException(status_code=400, detail="Password baru harus berbeda dari password lama.")
    validate_password_strength(req.newPassword)

    user_id = current_user["userId"]

    # Check in users collection first
    user = await db.users.find_one({"id": user_id})
    if user:
        if not check_password(req.currentPassword, user.get("passwordHash", "")):
            raise HTTPException(status_code=400, detail="Password lama salah.")
        hashed = hash_password(req.newPassword)
        await db.users.update_one({"id": user_id}, {"$set": {"passwordHash": hashed}})
        await db.sessions.delete_many({"userId": user_id})
        new_token = await create_session(
            user_id=user_id,
            username=current_user["username"],
            role=current_user["role"],
            full_name=current_user["fullName"]
        )
        await add_log("PASSWORD_CHANGED", f"Password user '{current_user['username']}' berhasil diganti")
        return {"success": True, "token": new_token, "message": "Password berhasil diganti."}

    # User tidak ditemukan di koleksi users — sesi tidak valid lagi.
    raise HTTPException(status_code=401, detail="Akun tidak ditemukan. Silakan login ulang.")

# ============================================================
# AI SETUP (menggunakan AI Terpusat - dikelola superadmin)
# ============================================================

AI_SETUP_PRODUCT_CODE = "adminpintar_chatbot_manager"

AI_SETUP_SYSTEM_PROMPT = (
    "Anda adalah AI Setup Assistant untuk AdminPintar.id (manajemen chatbot WhatsApp). "
    "Tugas Anda: membantu admin mengonfigurasi chatbot lewat percakapan natural. "
    "Anda dapat menyiapkan draft data untuk: Rules Engine, Knowledge Base, Template Pesan, "
    "Kontak, System Prompt AI Agent, Informasi Bisnis, Jam Operasional, dan parameter AI Agent. "
    "Jangan pernah meminta atau mengubah API key, WAHA URL, license key, atau password. "
    "Jika user meminta itu, jelaskan bahwa setting tersebut hanya bisa diubah lewat menu khusus. "
    "Jawab dalam bahasa Indonesia, singkat, sopan, dan ramah."
)

def _estimate_tokens(text: str) -> int:
    return max(1, len(text or "") // 4)

async def _call_ai_provider(provider: str, model: str, api_key: str, base_url: str,
                             messages: list, temperature: float, max_tokens: int) -> dict:
    """Call AI provider, returns dict with: reply, prompt_tokens, completion_tokens, total_tokens.
    Raises Exception on failure."""
    provider = (provider or "").upper()
    timeout = httpx.Timeout(60.0, connect=10.0)

    if provider == "GEMINI":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        contents = []
        system_text = None
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_text = content
                continue
            contents.append({
                "role": "user" if role == "user" else "model",
                "parts": [{"text": content}],
            })
        payload = {
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        }
        if system_text:
            payload["systemInstruction"] = {"parts": [{"text": system_text}]}
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        if resp.status_code != 200:
            raise Exception(f"Gemini error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        candidates = data.get("candidates") or []
        reply = ""
        if candidates:
            parts = ((candidates[0].get("content") or {}).get("parts")) or []
            reply = "".join(p.get("text", "") for p in parts)
        usage = data.get("usageMetadata") or {}
        prompt_t = int(usage.get("promptTokenCount") or 0)
        completion_t = int(usage.get("candidatesTokenCount") or 0)
        total_t = int(usage.get("totalTokenCount") or (prompt_t + completion_t))
        return {"reply": reply, "prompt_tokens": prompt_t, "completion_tokens": completion_t, "total_tokens": total_t}

    if provider in ("OPENAI", "DEEPSEEK", "GROQ", "OPENROUTER"):
        base_map = {
            "OPENAI": "https://api.openai.com/v1",
            "DEEPSEEK": "https://api.deepseek.com/v1",
            "GROQ": "https://api.groq.com/openai/v1",
            "OPENROUTER": "https://openrouter.ai/api/v1",
        }
        api_base = (base_url or base_map[provider]).rstrip("/")
        url = f"{api_base}/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            raise Exception(f"{provider} error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        choices = data.get("choices") or []
        reply = (choices[0].get("message") or {}).get("content", "") if choices else ""
        usage = data.get("usage") or {}
        return {
            "reply": reply,
            "prompt_tokens": int(usage.get("prompt_tokens") or 0),
            "completion_tokens": int(usage.get("completion_tokens") or 0),
            "total_tokens": int(usage.get("total_tokens") or 0),
        }

    if provider == "OLLAMA":
        if not base_url:
            raise Exception("Base URL wajib diisi untuk Ollama.")
        url = f"{base_url.rstrip('/')}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise Exception(f"Ollama error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        reply = ((data.get("message") or {}).get("content")) or ""
        prompt_t = int(data.get("prompt_eval_count") or 0)
        completion_t = int(data.get("eval_count") or 0)
        if prompt_t == 0:
            prompt_t = sum(_estimate_tokens(m.get("content", "")) for m in messages)
        if completion_t == 0:
            completion_t = _estimate_tokens(reply)
        return {
            "reply": reply,
            "prompt_tokens": prompt_t,
            "completion_tokens": completion_t,
            "total_tokens": prompt_t + completion_t,
        }

    raise Exception(f"Provider {provider} belum didukung.")

@api_router.post("/ai-setup/chat")
async def ai_setup_chat(req: AISetupMessage, current_user: Dict = Depends(get_current_user)):
    rate_limit("ai_setup", current_user["userId"], max_attempts=30, window_seconds=600)
    license_doc = await db.license.find_one({"userId": current_user["userId"]}, {"_id": 0})
    if not license_doc or not license_doc.get("valid"):
        raise HTTPException(status_code=400, detail="Lisensi belum aktif. Aktifkan lisensi terlebih dahulu di menu Lisensi.")

    license_key = license_doc.get("licenseKey", "") or ""
    instance_id = license_doc.get("instanceId", "") or str(uuid.uuid4())

    settings = await get_ai_settings_doc()
    if not settings.get("api_key") and not (settings.get("provider") == "OLLAMA" and settings.get("base_url")):
        raise HTTPException(status_code=503, detail="AI Terpusat belum dikonfigurasi oleh superadmin.")

    # Daily token limit check
    daily_limit = int(settings.get("daily_token_limit") or 0)
    if daily_limit > 0:
        from datetime import timezone
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_docs = await db.ai_usage_logs.aggregate([
            {"$match": {"created_at": {"$gte": today_start}}},
            {"$group": {"_id": None, "tokens": {"$sum": "$total_tokens"}}}
        ]).to_list(1)
        used_today = int((today_docs[0]["tokens"] if today_docs else 0) or 0)
        if used_today >= daily_limit:
            raise HTTPException(status_code=429, detail=f"Batas token harian AI Terpusat tercapai ({used_today}/{daily_limit}).")

    # Build message array
    messages = [{"role": "system", "content": AI_SETUP_SYSTEM_PROMPT}]
    for h in (req.history or [])[-12:]:
        role = h.get("role", "user")
        content = (h.get("content") or "")[:2000]
        if not content:
            continue
        if role not in ("user", "assistant"):
            role = "user"
        messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.message})

    temperature = float(settings.get("temperature") or 0.2)
    max_tokens = int(settings.get("max_tokens") or 1200)

    # Try primary, then fallback
    last_error = None
    used_source = "primary"
    result = None
    try:
        result = await _call_ai_provider(
            settings.get("provider"), settings.get("model"),
            settings.get("api_key"), settings.get("base_url"),
            messages, temperature, max_tokens,
        )
    except Exception as e:
        last_error = str(e)
        logger.warning(f"AI primary failed: {last_error}")
        # Log failed primary attempt
        try:
            await db.ai_usage_logs.insert_one({
                "license_key": license_key,
                "product_code": AI_SETUP_PRODUCT_CODE,
                "instance_id": instance_id,
                "user_id": current_user["userId"],
                "ai_source": "primary",
                "provider": (settings.get("provider") or "").upper(),
                "model": settings.get("model") or "",
                "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
                "success": False, "error_message": last_error[:500],
                "created_at": datetime.utcnow(),
            })
        except Exception:
            pass

    if result is None and settings.get("fallback_enabled"):
        if settings.get("fallback_api_key") or (settings.get("fallback_provider") == "OLLAMA" and settings.get("fallback_base_url")):
            try:
                result = await _call_ai_provider(
                    settings.get("fallback_provider"), settings.get("fallback_model"),
                    settings.get("fallback_api_key"), settings.get("fallback_base_url"),
                    messages, temperature, max_tokens,
                )
                used_source = "fallback"
            except Exception as e:
                last_error = str(e)
                logger.error(f"AI fallback failed: {last_error}")

    if result is None:
        raise HTTPException(status_code=502, detail=f"AI Terpusat gagal: {last_error or 'tidak ada response'}")

    # Log success
    try:
        await db.ai_usage_logs.insert_one({
            "license_key": license_key,
            "product_code": AI_SETUP_PRODUCT_CODE,
            "instance_id": instance_id,
            "user_id": current_user["userId"],
            "ai_source": used_source,
            "provider": (settings.get("provider") if used_source == "primary" else settings.get("fallback_provider") or "").upper(),
            "model": settings.get("model") if used_source == "primary" else settings.get("fallback_model"),
            "prompt_tokens": result["prompt_tokens"],
            "completion_tokens": result["completion_tokens"],
            "total_tokens": result["total_tokens"],
            "success": True,
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        logger.warning(f"Failed to log AI usage: {e}")

    await add_log("AI_SETUP_CALL", f"AI Setup ({used_source}): tokens={result['total_tokens']}")

    return {
        "success": True,
        "reply": result["reply"],
        "need_more_info": False,
        "drafts": [],
    }

# ============================================================
# DOCUMENTATION
# ============================================================

@api_router.get("/docs")
async def get_all_docs(token: str = Depends(validate_token)):
    docs = await db.docs.find({}, {"_id": 0, "sections": 0}).sort("slug", 1).to_list(100)
    return docs

@api_router.get("/docs/{slug}")
async def get_doc(slug: str, token: str = Depends(validate_token)):
    doc = await db.docs.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumentasi tidak ditemukan.")
    return doc

@api_router.put("/docs/{slug}")
async def update_doc(slug: str, req: DocPage, admin: Dict = Depends(require_superadmin)):
    sections = [s.model_dump() for s in req.sections]
    result = await db.docs.update_one(
        {"slug": slug},
        {"$set": {
            "title": req.title,
            "sections": sections,
            "updatedAt": datetime.utcnow().isoformat(),
            "updatedBy": admin["username"],
        }},
        upsert=True
    )
    return {"success": True}

@api_router.post("/docs")
async def create_doc(req: CreateDocPage, admin: Dict = Depends(require_superadmin)):
    slug = req.slug.strip().lower().replace(" ", "-")
    if not slug:
        raise HTTPException(status_code=400, detail="Slug tidak boleh kosong.")
    existing = await db.docs.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=409, detail="Halaman dengan slug ini sudah ada.")
    now = datetime.utcnow().isoformat()
    await db.docs.insert_one({
        "slug": slug,
        "title": req.title,
        "sections": [],
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": admin["username"],
    })
    return {"success": True, "slug": slug}

@api_router.delete("/docs/{slug}")
async def delete_doc(slug: str, admin: Dict = Depends(require_superadmin)):
    result = await db.docs.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Halaman tidak ditemukan.")
    return {"success": True}

@api_router.post("/docs/upload-image")
async def upload_doc_image(req: ImageUpload, admin: Dict = Depends(require_superadmin)):
    validate_image_data_url(req.dataUrl, "Gambar")
    if len(req.dataUrl) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 5MB.")
    image_id = str(uuid.uuid4())
    await db.doc_images.insert_one({"id": image_id, "dataUrl": req.dataUrl, "createdAt": datetime.utcnow().isoformat()})
    return {"success": True, "imageId": image_id, "dataUrl": req.dataUrl}

# ============================================================
# BRANDING (global, superadmin-only edit)
# ============================================================

class BrandingUpdate(BaseModel):
    siteName: Optional[str] = None
    faviconDataUrl: Optional[str] = None  # data:image/... base64
    logoDataUrl: Optional[str] = None  # data:image/... base64 — sidebar/login logo

@api_router.get("/branding")
async def get_branding():
    """Public: returns global site name, favicon, and dashboard logo."""
    name_doc = await db.config.find_one({"key": "siteName", "userId": ""})
    fav_doc = await db.config.find_one({"key": "faviconDataUrl", "userId": ""})
    logo_doc = await db.config.find_one({"key": "logoDataUrl", "userId": ""})
    return {
        "siteName": (name_doc or {}).get("value") or "adminpintar.id",
        "faviconDataUrl": (fav_doc or {}).get("value") or "",
        "logoDataUrl": (logo_doc or {}).get("value") or "",
    }

@api_router.put("/branding")
async def update_branding(req: BrandingUpdate, admin: Dict = Depends(require_superadmin)):
    now = datetime.utcnow()
    if req.siteName is not None:
        name = req.siteName.strip()[:60] or "adminpintar.id"
        await db.config.update_one(
            {"key": "siteName", "userId": ""},
            {"$set": {"key": "siteName", "userId": "", "value": name, "updated_at": now}},
            upsert=True,
        )
    for field, key, max_bytes, label in (
        ("faviconDataUrl", "faviconDataUrl", 1 * 1024 * 1024, "Favicon"),
        ("logoDataUrl", "logoDataUrl", 2 * 1024 * 1024, "Logo"),
    ):
        val = getattr(req, field)
        if val is None:
            continue
        if val:
            validate_image_data_url(val, label)
        if len(val) > max_bytes:
            raise HTTPException(status_code=400, detail=f"Ukuran {label} maksimal {max_bytes // (1024*1024)}MB.")
        await db.config.update_one(
            {"key": key, "userId": ""},
            {"$set": {"key": key, "userId": "", "value": val, "updated_at": now}},
            upsert=True,
        )
    await add_log("BRANDING_UPDATE", f"[{admin['username']}] Branding global diperbarui")
    return await get_branding()

# ============================================================
# WEBHOOK TOKEN & USER ACTIVITY
# ============================================================

@api_router.post("/users/{user_id}/regenerate-token")
async def regenerate_webhook_token(user_id: str, admin: Dict = Depends(require_superadmin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    new_token = secrets.token_urlsafe(16)
    await db.users.update_one({"id": user_id}, {"$set": {"webhookToken": new_token}})
    await log_user_activity(admin["userId"], admin["username"], "TOKEN_REGENERATED", f"Webhook token user '{user['username']}' diperbarui")
    return {"success": True, "webhookToken": new_token}

@api_router.get("/admin/user-activity")
async def get_all_user_activity(limit: int = 100, user_id: str = None, admin: Dict = Depends(require_superadmin)):
    query = {}
    if user_id:
        query["userId"] = user_id
    activities = await db.user_activity.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return activities

@api_router.get("/admin/user-activity/{user_id}")
async def get_user_activity(user_id: str, limit: int = 50, admin: Dict = Depends(require_superadmin)):
    activities = await db.user_activity.find({"userId": user_id}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return activities

@app.post("/webhook/{token}")
async def receive_webhook(token: str, request: Request):
    user = await db.users.find_one({"webhookToken": token, "isActive": True}, {"_id": 0, "passwordHash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Webhook token tidak valid.")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    event = payload.get("event", "")
    msg_payload = payload.get("payload", {})

    # Only process incoming message events — message.any also fires for bot's own replies
    if event != "message":
        return {"success": True, "processed": False, "reason": "event_ignored"}

    # fromMe detection: WAHA v1 has payload.fromMe, WAHA v2 has payload.key.fromMe
    from_me = (
        msg_payload.get("fromMe", False)
        or msg_payload.get("key", {}).get("fromMe", False)
        or msg_payload.get("_data", {}).get("id", {}).get("fromMe", False)
    )
    if from_me:
        return {"success": True, "processed": False, "reason": "from_me"}

    chat_id = msg_payload.get("from") or msg_payload.get("chatId", "")
    body = (msg_payload.get("body") or msg_payload.get("text") or "").strip()
    msg_type = msg_payload.get("type", "chat")

    # Normalize msg_id to string for reliable deduplication
    raw_id = msg_payload.get("id", "")
    if isinstance(raw_id, dict):
        msg_id = raw_id.get("_serialized") or raw_id.get("id") or str(raw_id)
    else:
        msg_id = str(raw_id) if raw_id else ""

    # Atomic deduplication using unique index — prevents race condition on concurrent webhooks
    if msg_id:
        try:
            await db.processed_msgs.insert_one({"msgId": msg_id, "ts": datetime.utcnow()})
        except Exception:
            # DuplicateKeyError = already processed
            return {"success": True, "processed": False, "reason": "duplicate"}

    # Store raw payload for debug inspection (keep last 20, TTL-style trim)
    if chat_id and "@lid" in chat_id:
        try:
            await db.debug_webhooks.insert_one({
                "chat_id": chat_id, "ts": datetime.utcnow(),
                "payload": payload, "msg_payload": msg_payload,
            })
            await db.debug_webhooks.delete_many({
                "_id": {"$nin": [d["_id"] async for d in db.debug_webhooks.find({}, {"_id": 1}).sort("ts", -1).limit(20)]}
            })
        except Exception:
            pass

    await add_log("WEBHOOK_IN", f"[{user['username']}] event={event} type={msg_type} fromMe={from_me} from={chat_id}")

    if not chat_id or not body:
        await add_log("WEBHOOK_SKIP", f"[{user['username']}] Pesan dilewati: chat_id='{chat_id}' body='{body[:50]}' type={msg_type}")
        return {"success": True, "processed": False, "reason": "no_text"}

    if msg_type not in ("chat", "text"):
        await add_log("WEBHOOK_SKIP", f"[{user['username']}] Tipe pesan tidak didukung: {msg_type} dari {chat_id}")
        return {"success": True, "processed": False, "reason": f"unsupported_type:{msg_type}"}

    uid = str(user.get("id", ""))

    # Feature 1: per-contact serial processing lock
    contact_lock_key = f"{uid}:{chat_id}"
    contact_lock = _get_contact_lock(contact_lock_key)

    async with contact_lock:
        try:
            return await _process_webhook_inner(user, uid, payload, msg_payload, chat_id, body, msg_type, event)
        except Exception as _exc:
            logger.exception(f"[webhook] Unhandled exception in _process_webhook_inner for {chat_id}: {_exc}")
            await add_log("SYSTEM_ERROR", f"[{user.get('username','?')}] ❌ Error tidak tertangani saat memproses pesan dari {chat_id}: {_exc}", uid)
            return {"success": False, "error": str(_exc)}


async def _process_webhook_inner(user, uid, payload, msg_payload, chat_id, body, msg_type, event):
    # Load user-specific config (with fallback to global defaults)
    cfg = await _get_user_config(uid)

    waha_url = cfg.get("wahaUrl", "").rstrip("/")
    waha_session = cfg.get("wahaSession", "default") or "default"
    waha_api_key = cfg.get("wahaApiKey", "")

    # Filter by WAHA session — only handle messages from the user's configured session
    waha_event_session = payload.get("session", "")
    if waha_event_session and waha_session and waha_event_session != waha_session:
        return {"success": True, "processed": False, "reason": f"session_mismatch:{waha_event_session}!={waha_session}"}

    # Check if bot is active (per-user)
    bot_is_active = cfg.get("isBotActive", False)
    if not bot_is_active:
        await add_log("WEBHOOK_SKIP", f"[{user['username']}] Bot tidak aktif — aktifkan di menu Setting → Bot Aktif", uid)
        return {"success": True, "processed": False, "reason": "bot_inactive"}

    # Check if contact is blocked
    contact = await db.contacts.find_one({"chatId": chat_id, "userId": uid})
    if contact and contact.get("isBlocked"):
        await add_log("WEBHOOK_SKIP", f"[{user['username']}] Kontak {chat_id} diblokir", uid)
        return {"success": True, "processed": False, "reason": "blocked"}

    # Feature 5: per-day working hours check
    tz_map = {"WIB": 7, "WITA": 8, "WIT": 9}
    tz_offset = tz_map.get(cfg.get("timezone", "WIB"), 7)
    if not is_within_working_hours(cfg, tz_offset):
        offline_msg = cfg.get("offlineMessage", "")
        if offline_msg:
            offline_resolved = resolve_template(offline_msg, contact or {}, tz_offset)
            if waha_url:
                await send_waha_text(waha_url, waha_session, waha_api_key, chat_id, offline_resolved)
        await add_log("WEBHOOK_SKIP", f"[{user['username']}] Di luar jam operasional — pesan offline dikirim", uid)
        return {"success": True, "processed": False, "reason": "outside_working_hours"}

    await add_log("MESSAGE_IN", f"[{user['username']}] Pesan dari {chat_id}: '{body[:80]}'", uid)
    await emit_workflow(uid, "message_in", {"chat": chat_id, "preview": body[:60]})

    # Store incoming message
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    await db.messages.insert_one({
        "timestamp": now_str,
        "chatId": chat_id,
        "userId": uid,
        "direction": "incoming",
        "message": body[:500],
        "responseType": "incoming",
        "tokensUsed": 0,
    })

    # ── Comprehensive phone/chatId extraction (GAS-inspired multi-field scoring) ──
    import re as _re
    from urllib.parse import quote as _url_quote

    def _is_lid(val: str) -> bool:
        return bool(val) and (val.endswith("@lid") or (val.isdigit() and len(val) > 15))

    def _looks_like_indonesian_phone(digits: str) -> bool:
        d = _re.sub(r'\D', '', digits)
        if d.startswith('62'):
            return 10 <= len(d) <= 15
        if d.startswith('08'):
            return 10 <= len(d) <= 14
        if d.startswith('8'):
            return 9 <= len(d) <= 13
        return False

    def _digits_to_indonesia(digits: str) -> str:
        d = _re.sub(r'\D', '', digits)
        if d.startswith('0'):
            return '62' + d[1:]
        if d.startswith('8'):
            return '62' + d
        return d

    def _score_candidate(cand: str) -> int:
        """Higher score = better candidate for phone/chatId."""
        if not cand:
            return -1
        score = 0
        if "@c.us" in cand:
            score += 10
        if "@lid" in cand:
            score -= 5
        digits = _re.sub(r'@[\w.]+$', '', cand)
        if _looks_like_indonesian_phone(digits):
            score += 8
        elif _re.match(r'^\d{6,}$', digits):
            score += 4
        return score

    def _extract_all_candidates(obj, _depth=0) -> list:
        """Deep-scan any dict/list for @c.us or phone-like values."""
        candidates = []
        if _depth > 5:
            return candidates
        if isinstance(obj, dict):
            for v in obj.values():
                candidates.extend(_extract_all_candidates(v, _depth + 1))
        elif isinstance(obj, list):
            for item in obj:
                candidates.extend(_extract_all_candidates(item, _depth + 1))
        elif isinstance(obj, str):
            if "@c.us" in obj:
                candidates.append(obj)
            elif _re.match(r'^\+?62\d{7,13}$', obj):
                candidates.append(obj)
        return candidates

    # Collect candidates from known fields first
    _top_fields = [
        msg_payload.get("from", ""),
        msg_payload.get("author", ""),
        msg_payload.get("participant", ""),
        msg_payload.get("chatId", ""),
        (msg_payload.get("sender") or {}).get("id", ""),
        (msg_payload.get("sender") or {}).get("_serialized", ""),
        (msg_payload.get("sender") or {}).get("phone", ""),
        msg_payload.get("_data", {}).get("from", ""),
        msg_payload.get("_data", {}).get("author", ""),
        (msg_payload.get("_data", {}).get("id") or {}).get("remote", ""),
        (msg_payload.get("_data", {}).get("sender") or {}).get("id", ""),
        (msg_payload.get("key") or {}).get("remoteJid", ""),
        (msg_payload.get("chat") or {}).get("id", ""),
        (msg_payload.get("chat") or {}).get("id", {}).get("_serialized", "") if isinstance((msg_payload.get("chat") or {}).get("id"), dict) else "",
    ]
    # Deep scan for any other @c.us strings
    _deep_candidates = _extract_all_candidates(msg_payload)

    _all_candidates = [c for c in _top_fields + _deep_candidates if c and isinstance(c, str)]

    # Pick best @c.us candidate by score
    _best_cus = max(
        (c for c in _all_candidates if "@c.us" in c and not "@g.us" in c),
        key=_score_candidate,
        default="",
    )

    # If we found a better @c.us candidate than the current chat_id (which may be @lid), use it
    if _best_cus and not _is_lid(_best_cus):
        _resolved_chat_id = _best_cus
    else:
        _resolved_chat_id = chat_id

    # Extract raw digit string from the best resolved id
    phone_num = _re.sub(r'@[\w.]+$', '', _resolved_chat_id).lstrip("+")

    # ── If still @lid, try WAHA API resolution ───────────────────────────────
    if _is_lid(chat_id) and not _best_cus:
        _waha_headers = {"X-Api-Key": waha_api_key} if waha_api_key else {}
        _resolved_phone = ""

        # Strategy A (priority): WAHA Plus LID→PN mapping endpoint
        # GOWS engine + PLUS tier returns: {"lid":"X@lid","pn":"6285...@c.us"}
        if waha_url:
            try:
                _lid_digits = chat_id.replace("@lid", "")
                async with httpx.AsyncClient(timeout=6) as _wc:
                    for _ep in (f"/api/{waha_session}/lids/{_lid_digits}",
                                f"/api/{waha_session}/lid/{_lid_digits}"):
                        try:
                            _resp = await _wc.get(f"{waha_url}{_ep}", headers=_waha_headers)
                            if _resp.status_code == 200:
                                _cd = _resp.json()
                                # Prefer explicit 'pn' field (WAHA Plus shape)
                                _pn = _cd.get("pn", "") if isinstance(_cd, dict) else ""
                                _m = _re.search(r'(\d{10,15})@c\.us', str(_pn) or json.dumps(_cd))
                                if _m:
                                    _resolved_phone = _m.group(1)
                                    await add_log("SYSTEM", f"[lid-A] {_ep} pn={_pn} → phone={_resolved_phone}", uid)
                                    break
                                else:
                                    await add_log("SYSTEM", f"[lid-A] {_ep} body={json.dumps(_cd)[:200]} → no @c.us match", uid)
                        except Exception:
                            continue
            except Exception as _e:
                await add_log("SYSTEM", f"[lid-A] error: {_e}", uid)

        # Strategy B (fallback): WAHA contacts endpoint
        if not _resolved_phone and waha_url:
            try:
                _encoded_id = _url_quote(chat_id, safe='')
                async with httpx.AsyncClient(timeout=6) as _wc:
                    _resp = await _wc.get(
                        f"{waha_url}/api/{waha_session}/contacts/{_encoded_id}",
                        headers=_waha_headers,
                    )
                    _cd = {}
                    if _resp.status_code == 200:
                        _cd = _resp.json()
                        _raw = (
                            _cd.get("number") or _cd.get("phone") or
                            _cd.get("phoneNumber") or _cd.get("pushphone") or ""
                        )
                        if not _raw:
                            _rid = _cd.get("id", "")
                            if _rid and "@c.us" in _rid:
                                _raw = _rid.replace("@c.us", "").lstrip("+")
                        if _raw and _re.match(r'^\d{6,}$', str(_raw).lstrip("+")):
                            _resolved_phone = str(_raw).lstrip("+")
                    await add_log("SYSTEM", f"[lid-B] status={_resp.status_code} → phone={_resolved_phone or 'none'}", uid)
            except Exception as _e:
                await add_log("SYSTEM", f"[lid-B] error: {_e}", uid)

        if _resolved_phone and _re.match(r'^\d{6,}$', _resolved_phone):
            phone_num = _resolved_phone

    # Normalize to Indonesian format if valid Indonesian number
    if _looks_like_indonesian_phone(phone_num):
        phone_num = _digits_to_indonesia(phone_num)

    # Build display phone — only trust the number if it came from @c.us OR looks like a valid Indonesian phone
    _phone_is_real = bool(_best_cus) or _looks_like_indonesian_phone(phone_num) or (not _is_lid(chat_id) and bool(_re.match(r'^\d{6,15}$', phone_num)))
    if _phone_is_real and phone_num:
        phone_display = ('+' + phone_num) if _re.match(r'^\d{6,}$', phone_num) else phone_num
    else:
        phone_display = ""

    # Extract contact name from every possible webhook field
    contact_name = (
        msg_payload.get("notifyName") or
        msg_payload.get("pushName") or
        msg_payload.get("notifyname") or
        (msg_payload.get("sender") or {}).get("name") or
        (msg_payload.get("sender") or {}).get("pushName") or
        (msg_payload.get("sender") or {}).get("verifiedName") or
        msg_payload.get("_data", {}).get("notifyName") or
        msg_payload.get("_data", {}).get("pushName") or
        (msg_payload.get("_data", {}).get("sender") or {}).get("name") or
        phone_display or
        f"WA-{_re.sub(r'@[\w.]+$', '', chat_id)[-6:]}"
    )

    # Update/create contact — only overwrite phone if we have a real number
    _contact_set = {"chatId": chat_id, "userId": uid, "lastSeen": now_str, "name": contact_name}
    if phone_display:
        _contact_set["phone"] = phone_display
    # $setOnInsert must NOT include 'phone' when $set already has it (MongoDB conflict)
    _set_on_insert = {"isBlocked": False, "tag": "", "note": "", "createdAt": now_str}
    if not phone_display:
        _set_on_insert["phone"] = ""
    await db.contacts.update_one(
        {"chatId": chat_id, "userId": uid},
        {
            "$set": _contact_set,
            "$inc": {"messageCount": 1},
            "$setOnInsert": _set_on_insert,
        },
        upsert=True
    )
    # Reload contact after upsert for auto-labeling
    contact_doc = await db.contacts.find_one({"chatId": chat_id, "userId": uid}) or {}

    # ── Step 1: Rules engine ──────────────────────────────────
    reply_text = None
    response_type = "ai"
    tokens_used = 0
    msg_lower = body.lower()  # defined here so auto-labeling and rules both have access

    # Feature 8: Auto-labeling based on keywords
    try:
        auto_labels_raw = cfg.get("autoLabels", "[]")
        auto_labels = json.loads(auto_labels_raw) if isinstance(auto_labels_raw, str) else auto_labels_raw
        if auto_labels:
            current_tags = set(t.strip() for t in (contact_doc.get("tag") or "").split(",") if t.strip())
            new_tags = set(current_tags)
            for rule_label in auto_labels:
                kw = rule_label.get("keyword", "").lower().strip()
                tag = rule_label.get("tag", "").strip()
                if kw and tag and kw in msg_lower:
                    new_tags.add(tag)
            if new_tags != current_tags:
                await db.contacts.update_one(
                    {"chatId": chat_id, "userId": uid},
                    {"$set": {"tag": ",".join(sorted(new_tags))}}
                )
                contact_doc["tag"] = ",".join(sorted(new_tags))
    except Exception:
        pass
    default_mode = cfg.get("defaultRuleResponseMode", "ai_context")  # direct / ai_polish / ai_context

    rules = await db.rules.find({"userId": uid, "isActive": True}, {"_id": 0}).sort("priority", 1).to_list(100)
    await emit_workflow(uid, "rules_scan", {"count": len(rules)})
    rule_text = None   # teks dari rule yang cocok (sebelum diputuskan modenya)
    rule_matched_name = None
    for rule in rules:
        trigger = rule.get("triggerValue", "").strip()
        trigger_type = rule.get("triggerType", "contains")
        matched = False

        if trigger_type == "contains":
            keywords = [k.strip().lower() for k in trigger.split("|") if k.strip()]
            matched = any(kw in msg_lower for kw in keywords)
        elif trigger_type == "exact":
            matched = msg_lower == trigger.lower()
        elif trigger_type == "startswith":
            keywords = [k.strip().lower() for k in trigger.split("|") if k.strip()]
            matched = any(msg_lower.startswith(kw) for kw in keywords)

        if matched:
            rule_text = rule.get("response", "")
            rule_matched_name = rule.get("name", "?")
            # Only use rule's responseMode if it's a valid known value; otherwise fall back to global default
            _rm = rule.get("responseMode", "")
            rule_mode = _rm if _rm in ("direct", "ai_polish", "ai_context") else default_mode
            # Feature 7: increment hit counter
            await db.rules.update_one({"id": rule.get("id"), "userId": uid}, {"$inc": {"hitCount": 1}})
            # Feature 4: resolve template variables in rule response
            rule_text = resolve_template(rule_text, contact_doc, tz_offset)
            if rule_mode == "direct":
                reply_text = rule_text
                response_type = "rule"
                await add_log("RULE_HIT", f"[{user['username']}] ✅ Rule COCOK: '{rule_matched_name}' → mode=LANGSUNG, balasan dari rule", uid)
                await emit_workflow(uid, "rule_match", {"name": rule_matched_name, "mode": "direct"})
            else:
                await add_log("RULE_HIT", f"[{user['username']}] ✅ Rule COCOK: '{rule_matched_name}' → mode={rule_mode}, lanjut ke AI", uid)
            await emit_workflow(uid, "rule_match", {"name": rule_matched_name, "mode": rule_mode})
            break

    if rule_text is None:
        await add_log("RULE_HIT", f"[{user['username']}] ❌ Tidak ada rule yang cocok dari {len(rules)} rule aktif — lanjut cek Knowledge Base", uid)
        await emit_workflow(uid, "rule_no_match", {"count": len(rules)})

    # ── Step 2: Knowledge base context ───────────────────────
    knowledge_context = ""
    matched_items = []
    if not reply_text:
        items = await db.knowledge.find({"userId": uid, "isActive": True}, {"_id": 0}).to_list(100)
        await emit_workflow(uid, "knowledge_scan", {"count": len(items)})
        for item in items:
            keywords = [k.strip().lower() for k in item.get("keyword", "").split("|") if k.strip()]
            if any(kw in msg_lower for kw in keywords):
                matched_items.append(item)
        if matched_items:
            knowledge_context = "\n".join(
                f"[{i['category']}]: {i['content']}" for i in matched_items[:3]
            )
            kb_names = ", ".join(f"'{i.get('category','?')}'" for i in matched_items[:3])
            await add_log("KNOWLEDGE_MATCH", f"[{user['username']}] ✅ Knowledge Base COCOK: {kb_names} — konteks dikirim ke AI", uid)
            await emit_workflow(uid, "knowledge_match", {"categories": kb_names, "count": len(matched_items)})
        else:
            await add_log("KNOWLEDGE_MATCH", f"[{user['username']}] ❌ Tidak ada Knowledge Base yang cocok dari {len(items)} item aktif", uid)
            await emit_workflow(uid, "knowledge_no_match", {"count": len(items)})

    # ── Step 3: AI call (atau fallback langsung jika mode=direct / AI tidak dikonfigurasi) ──
    provider = cfg.get("aiProvider", "").upper()
    model = cfg.get("aiModel", "")
    ai_api_key = cfg.get("aiApiKey", "")
    ai_enabled = cfg.get("aiEnabled", True)
    ai_ready = bool(ai_enabled and provider and (ai_api_key or provider == "OLLAMA"))

    if not reply_text:
        # Mode LANGSUNG: jawab dari KB tanpa AI, atau skip jika tidak ada konten
        if default_mode == "direct":
            if knowledge_context:
                reply_text = "\n\n".join(f"{i['content']}" for i in matched_items[:3])
                response_type = "rule"
                await add_log("KNOWLEDGE_MATCH", f"[{user['username']}] 📖 Jawaban langsung dari Knowledge Base (mode=direct)", uid)
            else:
                await add_log("RULE_HIT", f"[{user['username']}] ⚠️ Mode LANGSUNG: tidak ada rule/KB yang cocok, tidak ada balasan", uid)
                return {"success": True, "processed": False, "reason": "no_match_direct_mode"}

        # Mode AI / AI_POLISH: panggil AI
        else:
            system_prompt = cfg.get("systemPrompt", "") or "Kamu adalah asisten virtual yang membantu dan ramah."
            business_info = cfg.get("businessInfo", "")
            temperature = float(cfg.get("aiTemperature") or 0.7)
            max_tokens = int(cfg.get("aiMaxTokens") or 500)
            memory_limit = int(cfg.get("memoryLimit") or 10)

            if business_info:
                system_prompt += f"\n\nInformasi bisnis:\n{business_info}"
            if knowledge_context:
                system_prompt += f"\n\nGunakan informasi berikut untuk menjawab:\n{knowledge_context}"
            if rule_text:
                system_prompt += f"\n\nJawaban referensi (poles menjadi lebih natural):\n{rule_text}"

            if not ai_ready:
                # AI tidak terkonfigurasi — fallback ke rule/KB langsung
                if rule_text:
                    reply_text = rule_text
                    response_type = "rule"
                    await add_log("AI_ERROR", f"[{user['username']}] ⚠️ AI tidak dikonfigurasi — fallback ke teks rule langsung", uid)
                elif knowledge_context:
                    reply_text = "\n\n".join(f"{i['content']}" for i in matched_items[:3])
                    response_type = "rule"
                    await add_log("AI_ERROR", f"[{user['username']}] ⚠️ AI tidak dikonfigurasi — fallback ke Knowledge Base langsung", uid)
                else:
                    await add_log("AI_ERROR", f"[{user['username']}] ✗ AI tidak dikonfigurasi dan tidak ada rule/KB — tidak ada balasan", uid)
                    # Feature 6: WA owner notif
                    await send_owner_wa_notification(
                        cfg,
                        f"⚠️ Pesan tidak terjawab\nDari: {contact_doc.get('name','?')} ({chat_id})\nPesan: {body[:200]}"
                    )
                    return {"success": True, "processed": False, "reason": "ai_not_configured_no_fallback"}
            else:
                # Feature 2: Summarization — ambil ringkasan percakapan lama jika ada
                total_hist = await db.messages.count_documents({"chatId": chat_id, "userId": uid})
                conv_summary = ""
                if total_hist > memory_limit * 3:
                    sum_doc = await db.conversation_summaries.find_one({"chatId": chat_id, "userId": uid})
                    if sum_doc:
                        conv_summary = sum_doc.get("summary", "")
                    else:
                        # Buat ringkasan dari pesan lama
                        old_docs = await db.messages.find(
                            {"chatId": chat_id, "userId": uid, "direction": {"$in": ["incoming","outgoing"]}}
                        ).sort("timestamp", 1).to_list(memory_limit * 3)
                        old_text = "\n".join(
                            f"{'User' if d['direction']=='incoming' else 'Bot'}: {d['message'][:100]}"
                            for d in old_docs[:memory_limit * 2]
                        )
                        sum_prompt = [{"role": "user", "content": f"Ringkas percakapan berikut dalam 2-3 kalimat:\n\n{old_text}"}]
                        sum_result, _ = await call_ai(provider, model, ai_api_key,
                            "Kamu adalah asisten ringkasan percakapan.", sum_prompt, 0.3, 200, cfg.get("ollamaUrl",""))
                        if sum_result:
                            conv_summary = sum_result
                            await db.conversation_summaries.update_one(
                                {"chatId": chat_id, "userId": uid},
                                {"$set": {"summary": sum_result, "updatedAt": datetime.utcnow().isoformat()}},
                                upsert=True
                            )
                if conv_summary:
                    system_prompt += f"\n\nRingkasan percakapan sebelumnya:\n{conv_summary}"

                history_docs = await db.messages.find(
                    {"chatId": chat_id, "userId": uid, "direction": {"$in": ["incoming", "outgoing"]}}
                ).sort("timestamp", -1).to_list(memory_limit * 2)
                history_docs.reverse()

                # Build AI messages, merging consecutive same-role messages.
                # Gemini and Anthropic reject requests with consecutive messages of the same role.
                # When the bot fails to reply, the history accumulates consecutive user messages.
                merged: list = []
                for h in history_docs[:-1]:  # exclude the current message (last/newest)
                    role = "user" if h["direction"] == "incoming" else "assistant"
                    content = (h.get("message") or "").strip()
                    if not content:
                        continue
                    if merged and merged[-1]["role"] == role:
                        merged[-1]["content"] += "\n" + content  # merge into previous
                    else:
                        merged.append({"role": role, "content": content})

                # Append current user message, merging if previous is also user
                if merged and merged[-1]["role"] == "user":
                    merged[-1]["content"] += "\n" + body
                else:
                    merged.append({"role": "user", "content": body})

                ai_messages = merged

                kb_info = f" + KB ({len(matched_items)} item)" if knowledge_context else ""
                rule_info = f" + Rule" if rule_text else ""
                await add_log("AI_CALL", f"[{user['username']}] 🤖 AI dipanggil: {provider}/{model}{kb_info}{rule_info} | {len(ai_messages)} pesan riwayat", uid)
                await emit_workflow(uid, "ai_call", {"provider": provider, "model": model, "has_kb": bool(knowledge_context), "has_rule": bool(rule_text)})

                ai_reply, tokens_used = await call_ai(provider, model, ai_api_key, system_prompt, ai_messages, temperature, max_tokens, cfg.get("ollamaUrl", ""))
                if ai_reply:
                    reply_text = ai_reply
                    response_type = "combo" if rule_text else "ai"
                    await add_log("AI_CALL", f"[{user['username']}] ✅ AI menjawab ({len(ai_reply)} karakter, {tokens_used} token)", uid)
                    await emit_workflow(uid, "ai_response", {"chars": len(ai_reply), "tokens": tokens_used})
                else:
                    await add_log("AI_ERROR", f"[{user['username']}] ⚠️ AI mengembalikan balasan kosong (provider={provider}, model={model}). Cek API key & kuota.", uid)
                    if rule_text:
                        reply_text = rule_text
                        response_type = "rule"
                        await add_log("AI_ERROR", f"[{user['username']}] ↩ Fallback ke teks rule", uid)
                    elif knowledge_context:
                        reply_text = "\n\n".join(f"{i['content']}" for i in matched_items[:3])
                        response_type = "rule"
                        await add_log("AI_ERROR", f"[{user['username']}] ↩ Fallback ke Knowledge Base", uid)

    # Mode ai_polish: rule teks sudah di-set, tapi perlu dipoles AI
    if reply_text and response_type == "rule" and rule_text and default_mode == "ai_polish" and ai_ready and reply_text == rule_text:
        system_prompt = (cfg.get("systemPrompt", "") or "Kamu adalah asisten virtual yang membantu dan ramah.")
        polish_messages = [{"role": "user", "content": f"Poles kalimat ini agar lebih natural dan ramah, jangan ubah informasinya:\n\n{rule_text}"}]
        polished, t = await call_ai(provider, model, ai_api_key, system_prompt, polish_messages,
                                     float(cfg.get("aiTemperature") or 0.7), int(cfg.get("aiMaxTokens") or 500), cfg.get("ollamaUrl", ""))
        if polished:
            reply_text = polished
            tokens_used = t
            response_type = "combo"
            await add_log("AI_CALL", f"[{user['username']}] ✨ Rule dipoles AI ({tokens_used} token) → combo", uid)

    if not reply_text:
        await add_log("AI_ERROR", f"[{user['username']}] Tidak ada balasan yang dihasilkan untuk {chat_id}", uid)
        # Feature 6: WA owner notif when no answer
        await send_owner_wa_notification(
            cfg,
            f"⚠️ Pesan tidak terjawab\nDari: {contact_doc.get('name','?')} ({chat_id})\nPesan: {body[:200]}"
        )
        return {"success": True, "processed": False, "reason": "no_reply_generated"}

    # ── Step 4: Send reply via WAHA ──────────────────────────
    await emit_workflow(uid, "reply_sending", {"chat": chat_id, "preview": reply_text[:60], "type": response_type})
    if waha_url:
        await send_waha_text(waha_url, waha_session, waha_api_key, chat_id, reply_text)
        await emit_workflow(uid, "reply_sent", {"chat": chat_id, "type": response_type})
    else:
        await add_log("WAHA_ERROR", f"[{user['username']}] WAHA URL kosong, balasan tidak terkirim!", uid)
        await emit_workflow(uid, "reply_error", {"reason": "waha_url_empty"})

    # Store outgoing message with actual token count
    await db.messages.insert_one({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "chatId": chat_id,
        "userId": uid,
        "direction": "outgoing",
        "message": reply_text[:500],
        "responseType": response_type,
        "tokensUsed": tokens_used,
    })

    await add_log("MESSAGE_OUT", f"[{user['username']}] Balas ke {chat_id}: [{response_type}] '{reply_text[:80]}'", uid)
    return {"success": True, "processed": True, "responseType": response_type}


async def send_waha_text(waha_url: str, session: str, api_key: str, chat_id: str, text: str):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-Api-Key"] = api_key
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{waha_url}/api/sendText",
                json={"chatId": chat_id, "text": text, "session": session},
                headers=headers,
            )
            if r.status_code in (200, 201):
                return
            primary_status = r.status_code
            primary_body = r.text[:200]
            r2 = await client.post(
                f"{waha_url}/api/{session}/messages/send",
                json={"chatId": chat_id, "body": text},
                headers=headers,
            )
            if r2.status_code in (200, 201):
                return
            await add_log("WAHA_SEND_ERROR", f"Gagal kirim ke {chat_id}: sendText={primary_status} body={primary_body} | fallback={r2.status_code} body={r2.text[:200]}")
    except Exception as e:
        await add_log("WAHA_SEND_ERROR", f"Exception kirim ke {chat_id}: {str(e)}")


async def call_ai(provider: str, model: str, api_key: str, system_prompt: str,
                  messages: list, temperature: float = 0.7, max_tokens: int = 500,
                  ollama_url: str = "") -> tuple:
    """Returns (reply_text: str, tokens_used: int)"""
    try:
        if provider == "GEMINI":
            return await _call_gemini(model or "gemini-2.0-flash", api_key, system_prompt, messages, temperature, max_tokens)
        elif provider in ("OPENAI", "GROQ", "OPENROUTER", "DEEPSEEK"):
            base_urls = {
                "OPENAI": "https://api.openai.com/v1",
                "GROQ": "https://api.groq.com/openai/v1",
                "OPENROUTER": "https://openrouter.ai/api/v1",
                "DEEPSEEK": "https://api.deepseek.com/v1",
            }
            return await _call_openai_compat(base_urls[provider], model, api_key, system_prompt, messages, temperature, max_tokens)
        elif provider == "ANTHROPIC":
            return await _call_anthropic(model or "claude-3-5-haiku-20241022", api_key, system_prompt, messages, max_tokens)
        elif provider == "OLLAMA":
            return await _call_openai_compat(f"{ollama_url.rstrip('/')}/v1", model, "", system_prompt, messages, temperature, max_tokens)
        else:
            await add_log("AI_ERROR", f"Provider tidak dikenal: {provider}")
            return ("", 0)
    except Exception as e:
        logger.error(f"AI call exception ({provider}/{model}): {e}")
        await add_log("AI_ERROR", f"❌ AI gagal ({provider}/{model}): {str(e)[:300]}")
        return ("", 0)


async def _call_openai_compat(base_url: str, model: str, api_key: str, system_prompt: str,
                               messages: list, temperature: float, max_tokens: int) -> tuple:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_url}/chat/completions", json=body, headers=headers)
        r.raise_for_status()
        data = r.json()
        text = data["choices"][0]["message"]["content"].strip()
        tokens = data.get("usage", {}).get("total_tokens", 0)
        return (text, tokens)


async def _call_gemini(model: str, api_key: str, system_prompt: str,
                       messages: list, temperature: float, max_tokens: int) -> tuple:
    # Pass API key as URL query param — most reliable across all Google API versions
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Build contents, converting role names (assistant→model for Gemini)
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        text_content = (m.get("content") or "").strip()
        if text_content:
            contents.append({"role": role, "parts": [{"text": text_content}]})

    # Gemini REQUIRES conversation to start with role "user".
    while contents and contents[0]["role"] != "user":
        contents.pop(0)

    # Merge consecutive same-role messages
    merged_contents = []
    for c in contents:
        if merged_contents and merged_contents[-1]["role"] == c["role"]:
            merged_contents[-1]["parts"][0]["text"] += "\n" + c["parts"][0]["text"]
        else:
            merged_contents.append(c)
    contents = merged_contents

    if not contents:
        await add_log("AI_ERROR", "Gemini: contents kosong setelah normalisasi")
        return ("", 0)

    if contents[-1]["role"] != "user":
        await add_log("AI_ERROR", f"Gemini: pesan terakhir bukan user (role={contents[-1]['role']})")
        return ("", 0)

    safe_max_tokens = max(50, int(max_tokens or 500))

    body = {
        "systemInstruction": {"parts": [{"text": system_prompt or "Kamu adalah asisten yang membantu."}]},
        "contents": contents,
        "generationConfig": {
            "temperature": float(temperature),
            "maxOutputTokens": safe_max_tokens,
        },
    }

    await add_log("AI_CALL", f"Gemini → model={model} tokens={safe_max_tokens} turns={len(contents)}")

    async with httpx.AsyncClient(timeout=45) as client:
        r = await client.post(url, json=body, headers={"Content-Type": "application/json"})
        if r.status_code != 200:
            await add_log("AI_ERROR", f"Gemini HTTP {r.status_code}: {r.text[:500]}")
            r.raise_for_status()

        data = r.json()
        candidates = data.get("candidates", [])
        if not candidates:
            block_reason = data.get("promptFeedback", {}).get("blockReason", "")
            await add_log("AI_ERROR", f"Gemini: 0 candidates. blockReason={block_reason or 'none'}. keys={list(data.keys())}")
            return ("", 0)

        candidate = candidates[0]
        # Accept both camelCase and upper-case variants across Gemini API versions
        finish_reason = (candidate.get("finishReason") or candidate.get("finish_reason") or "UNKNOWN").upper()
        if finish_reason not in ("STOP", "MAX_TOKENS"):
            await add_log("AI_ERROR", f"Gemini: finishReason={finish_reason} safety={candidate.get('safetyRatings', [])}")
            return ("", 0)

        parts = candidate.get("content", {}).get("parts", [])
        if not parts:
            await add_log("AI_ERROR", f"Gemini: parts kosong (finishReason={finish_reason})")
            return ("", 0)

        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            await add_log("AI_ERROR", f"Gemini: teks kosong setelah join parts (finishReason={finish_reason})")
            return ("", 0)

        tokens = data.get("usageMetadata", {}).get("totalTokenCount", 0)
        return (text, tokens)


async def _call_anthropic(model: str, api_key: str, system_prompt: str,
                           messages: list, max_tokens: int) -> tuple:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": messages,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
        r.raise_for_status()
        data = r.json()
        text = data["content"][0]["text"].strip()
        usage = data.get("usage", {})
        tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        return (text, tokens)

# ============================================================
# WAHA PROXY
# ============================================================

async def get_waha_config(uid: str = ""):
    cfg = await _get_user_config(uid) if uid else {}
    url = cfg.get("wahaUrl", "").rstrip("/")
    session = cfg.get("wahaSession", "default") or "default"
    api_key = cfg.get("wahaApiKey", "")
    if not url:
        raise HTTPException(status_code=400, detail="WAHA URL belum dikonfigurasi.")
    return url, session, api_key

def waha_headers(api_key: str) -> dict:
    h = {"Content-Type": "application/json"}
    if api_key:
        h["X-Api-Key"] = api_key
    return h

@api_router.get("/waha/status")
async def waha_status(current_user: Dict = Depends(get_current_user)):
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{waha_url}/api/sessions/{session}", headers=waha_headers(api_key))
            if r.status_code == 404:
                return {"status": "STOPPED", "session": session}
            r.raise_for_status()
            data = r.json()
            return {
                "status": data.get("status", "UNKNOWN"),
                "session": session,
                "me": data.get("me"),
            }
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/waha/qr")
async def waha_qr(current_user: Dict = Depends(get_current_user)):
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{waha_url}/api/{session}/auth/qr",
                headers={**waha_headers(api_key), "Accept": "application/json"},
            )
            if r.status_code == 404:
                return {"qr": None, "message": "Session belum dimulai."}
            r.raise_for_status()
            data = r.json()
            qr_value = data.get("value") or data.get("qr") or data.get("data")
            return {"qr": qr_value}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.post("/waha/start")
async def waha_start(current_user: Dict = Depends(get_current_user)):
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{waha_url}/api/sessions/{session}/start",
                headers=waha_headers(api_key),
            )
            if r.status_code == 404:
                r2 = await client.post(
                    f"{waha_url}/api/sessions",
                    json={"name": session, "start": True},
                    headers=waha_headers(api_key),
                )
                r2.raise_for_status()
            elif r.status_code not in (200, 201):
                r.raise_for_status()
        return {"success": True, "message": "Session dimulai."}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.post("/waha/stop")
async def waha_stop(current_user: Dict = Depends(get_current_user)):
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{waha_url}/api/sessions/{session}/stop",
                headers=waha_headers(api_key),
            )
            if r.status_code not in (200, 201, 404):
                r.raise_for_status()
        return {"success": True, "message": "Session dihentikan."}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/waha/webhook")
async def waha_get_webhook(current_user: Dict = Depends(get_current_user)):
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{waha_url}/api/sessions/{session}", headers=waha_headers(api_key))
            if r.status_code == 200:
                data = r.json()
                webhooks = data.get("config", {}).get("webhooks", [])
                if webhooks:
                    return {"success": True, "webhooks": webhooks}
            r2 = await client.get(f"{waha_url}/api/{session}/webhook", headers=waha_headers(api_key))
            if r2.status_code == 200:
                return {"success": True, "webhooks": [r2.json()]}
        return {"success": True, "webhooks": []}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/waha/debug")
async def waha_debug(current_user: Dict = Depends(get_current_user)):
    """Return raw WAHA session info and available routes for debugging."""
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    results = {}
    endpoints_to_probe = [
        ("GET", f"/api/sessions/{session}"),
        ("GET", f"/api/sessions"),
        ("GET", f"/api/{session}/webhook"),
        ("GET", f"/api/version"),
        ("GET", f"/api/server/version"),
        ("GET", f"/api/swagger.json"),
    ]
    async with httpx.AsyncClient(timeout=8) as client:
        for method, path in endpoints_to_probe:
            try:
                r = await client.request(method, f"{waha_url}{path}", headers=waha_headers(api_key))
                try:
                    body = r.json()
                except Exception:
                    body = r.text[:300]
                results[f"{method} {path}"] = {"status": r.status_code, "body": body}
            except Exception as e:
                results[f"{method} {path}"] = {"error": str(e)}
    return results

@api_router.get("/waha/contact-debug/{chat_id:path}")
async def waha_contact_debug(chat_id: str, current_user: Dict = Depends(get_current_user)):
    """Debug: fetch raw WAHA response for a specific chatId (useful for @lid resolution)."""
    from urllib.parse import quote as _uq
    waha_url, session, api_key = await get_waha_config(current_user["userId"])
    if not waha_url:
        return {"error": "WAHA URL not configured"}
    results = {}
    encoded = _uq(chat_id, safe='')
    endpoints = [
        f"/api/{session}/contacts/{encoded}",
        f"/api/{session}/chats/{encoded}",
        f"/api/{session}/contacts?contactId={encoded}",
    ]
    async with httpx.AsyncClient(timeout=8) as client:
        for ep in endpoints:
            try:
                r = await client.get(f"{waha_url}{ep}", headers=waha_headers(api_key))
                try:
                    body = r.json()
                except Exception:
                    body = r.text[:500]
                results[ep] = {"status": r.status_code, "body": body}
            except Exception as e:
                results[ep] = {"error": str(e)}
    # Also check last stored webhook payload for this chatId
    last_wh = await db.debug_webhooks.find_one({"chat_id": chat_id}, sort=[("ts", -1)])
    if last_wh:
        last_wh.pop("_id", None)
        results["last_webhook_payload"] = last_wh
    return results


@api_router.post("/waha/webhook")
async def waha_set_webhook(current_user: Dict = Depends(get_current_user)):
    uid = current_user["userId"]
    waha_url, session, api_key = await get_waha_config(uid)

    # Get user's webhook token
    user = await db.users.find_one({"id": uid})
    if not user or not user.get("webhookToken"):
        raise HTTPException(status_code=400, detail="Token webhook user tidak ditemukan.")

    # Get backend public URL from user-specific config
    cfg = await _get_user_config(uid)
    backend_url = cfg.get("backendUrl", "").rstrip("/")
    if not backend_url:
        raise HTTPException(status_code=400, detail="Backend URL belum dikonfigurasi.")

    webhook_url = f"{backend_url}/webhook/{user['webhookToken']}"
    events = ["message", "message.any", "session.status", "message.reaction"]

    errors = []
    webhook_body_v1 = {"config": {"webhooks": [{"url": webhook_url, "events": events}]}}
    webhook_body_v2 = {"url": webhook_url, "events": events}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 1. PATCH /api/sessions/{session}  (WAHA Plus new)
            r = await client.patch(f"{waha_url}/api/sessions/{session}", json=webhook_body_v1, headers=waha_headers(api_key))
            if r.status_code in (200, 201): return {"success": True, "webhookUrl": webhook_url}
            errors.append(f"PATCH sessions: {r.status_code}")

            # 2. PUT /api/sessions/{session}  (WAHA Plus alt)
            r = await client.put(f"{waha_url}/api/sessions/{session}", json=webhook_body_v1, headers=waha_headers(api_key))
            if r.status_code in (200, 201): return {"success": True, "webhookUrl": webhook_url}
            errors.append(f"PUT sessions: {r.status_code}")

            # 3. PUT /api/{session}/webhook
            r = await client.put(f"{waha_url}/api/{session}/webhook", json=webhook_body_v2, headers=waha_headers(api_key))
            if r.status_code in (200, 201): return {"success": True, "webhookUrl": webhook_url}
            errors.append(f"PUT {session}/webhook: {r.status_code}")

            # 4. POST /api/{session}/webhook
            r = await client.post(f"{waha_url}/api/{session}/webhook", json=webhook_body_v2, headers=waha_headers(api_key))
            if r.status_code in (200, 201): return {"success": True, "webhookUrl": webhook_url}
            errors.append(f"POST {session}/webhook: {r.status_code}")

            # 5. POST /api/sessions/{session}/config/webhook
            r = await client.post(f"{waha_url}/api/sessions/{session}/config/webhook", json=webhook_body_v2, headers=waha_headers(api_key))
            if r.status_code in (200, 201): return {"success": True, "webhookUrl": webhook_url}
            errors.append(f"POST sessions config/webhook: {r.status_code}")

            # 6. Re-create session with webhook embedded (stop → create with webhook)
            # First stop
            await client.post(f"{waha_url}/api/sessions/{session}/stop", headers=waha_headers(api_key))
            await client.delete(f"{waha_url}/api/sessions/{session}", headers=waha_headers(api_key))
            # Create with webhook
            r = await client.post(
                f"{waha_url}/api/sessions",
                json={"name": session, "start": True, "config": {"webhooks": [{"url": webhook_url, "events": events}]}},
                headers=waha_headers(api_key),
            )
            if r.status_code in (200, 201): return {"success": True, "webhookUrl": webhook_url, "note": "Session dibuat ulang dengan webhook. Scan ulang QR jika diminta."}
            errors.append(f"POST sessions (recreate): {r.status_code}")

        raise HTTPException(status_code=502, detail=f"WAHA tidak mendukung endpoint webhook: {'; '.join(errors)}. Coba cek /api/waha/debug untuk info lebih lanjut.")
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

# ============================================================
# LANDING PAGE CONTENT
# ============================================================

LP_DEFAULTS = {
    "branding": {
        "page_title": "AdminPintar.id — Asisten WhatsApp Otomatis untuk Bisnis Anda",
        "brand_name": "AdminPintar",
        "brand_suffix": ".id",
        "favicon_url": "",
        "logo_url": "",
        "template": "default",
    },
    "promo_bar": "PROMO LAUNCHING — Hemat 50% · Rp 99.000 → <strong>Rp 49.000/bulan</strong>",
    "hero": {
        "eyebrow": "Chatbot WhatsApp · UMKM Indonesia",
        "headline": ["Chatbot WhatsApp", "yang <span class=\"accent italic\">atur diri</span>", "sendiri."],
        "sub": "Cukup ceritakan bisnis Anda — AI yang menyusun <strong>Rules, Knowledge Base, Template, dan Persona</strong> chatbot. Tugas Anda: koreksi &amp; approve. Setup hanya 5 menit.",
        "price_amount": "49",
        "price_period": ".000/bln",
        "price_old": "Rp 99.000",
        "price_discount": "Hemat 50%",
        "cta_primary": "Aktifkan Rp 49rb/bln",
        "cta_secondary": "Lihat cara kerjanya",
        "features": [
            "Koneksi WAHA included",
            "AI Agent — 7 Provider",
            "AI Setup Assistant",
            "Broadcast Anti-Banned",
        ],
    },
    "pricing": {
        "amount": "49.000",
        "old": "99.000",
        "period": "/bulan",
        "name": "Paket Lengkap",
        "tag": "Semua fitur · WAHA included · AI 7 provider",
        "features": [
            "Koneksi WAHA included",
            "AI Agent — 7 provider (OpenAI, Gemini, Claude, dst)",
            "Rules Engine + Knowledge Base unlimited",
            "AI Setup Assistant (setup 5 menit)",
            "Broadcast anti-banned + Auto-tag kontak",
            "Dashboard real-time + Logs detail",
            "Update gratis selamanya",
            "Support via WhatsApp",
        ],
        "cta": "Aktivasi Sekarang",
        "note": "Setelah kuota promo habis, harga balik ke Rp 99.000/bulan.",
    },
    "faq": [
        {"q": "Apa beda 3 mode (Rules / Rules+AI / Full AI)?", "a": "<strong>Rules</strong> = balasan teks template, 0 token AI, cocok untuk FAQ. <strong>Rules+AI</strong> = rule trigger, lalu AI poles biar natural, hemat token. <strong>Full AI</strong> = AI yang handle semua, paling pinter untuk percakapan kompleks. Anda bisa mix per-rule sesuai kebutuhan."},
        {"q": "Saya gaptek, beneran bisa setup sendiri?", "a": "Bisa banget. AI Setup Assistant menyusun semuanya dari deskripsi bisnis Anda. Tugas Anda cuma: ceritakan bisnis, cek hasilnya, klik Approve. Selesai."},
        {"q": "Rp 49rb/bulan itu termasuk apa saja?", "a": "Termasuk <strong>akses penuh dashboard, koneksi WAHA, semua fitur</strong> (Rules, AI Agent, Knowledge, Broadcast, dll), dan AI Setup Assistant. Untuk biaya pemakaian AI, pakai API key provider pilihan Anda — atau pakai Ollama lokal gratis."},
        {"q": "Berapa biaya AI rata-rata per bulan?", "a": "Tergantung volume chat. Rata-rata pengguna mode Rules+AI habis <strong>Rp 30–100rb/bulan</strong> karena 80% chat dijawab Rules. Mau Rp 0? Pakai Ollama lokal di komputer Anda."},
        {"q": "Aman dari banned WhatsApp?", "a": "Aman. Kami pakai WAHA dengan delay acak 3–7 detik, batch limit, dan kontrol broadcast harian. Risiko banned jauh lebih kecil dibanding tool blast biasa."},
        {"q": "Kalau saya berhenti langganan, data hilang?", "a": "Tidak. Semua data (kontak, chat history, template) bisa <strong>diekspor ke CSV/JSON</strong> kapan saja. Tanpa lock-in."},
        {"q": "Promo Rp 49rb berlaku selamanya untuk akun saya?", "a": "Ya. Selama Anda aktivasi di periode promo, <strong>harga Rp 49rb terkunci</strong> untuk perpanjangan berikutnya. Pelanggan baru setelah promo habis bayar Rp 99rb."},
    ],
    "links": {
        "whatsapp": "https://wa.me/6281234567890",
        "activation": "#",
        "final_h1": "Saatnya bisnis Anda",
        "final_h2": "kerja <span class=\"italic\">24 jam</span>.",
        "final_sub": "Setiap menit chat tidak terbalas = calon transaksi yang hilang.<br>Dengan Rp 1.633/hari, AdminPintar.id jadi tim CS Anda — bekerja tanpa libur, hemat, dan aman.",
        "final_cta_primary": "Aktivasi Lisensi — Rp 49.000/bln",
        "final_cta_secondary": "Tanya dulu via WhatsApp",
    },
}

@api_router.get("/lp-content")
async def get_lp_content():
    """Public: returns landing page editable content."""
    doc = await db.lp_content.find_one({"_id": "main"})
    if not doc:
        return LP_DEFAULTS
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/lp-content")
async def update_lp_content(content: dict, admin: Dict = Depends(require_superadmin)):
    """Superadmin: update landing page content."""
    content.pop("_id", None)
    await db.lp_content.replace_one(
        {"_id": "main"},
        {"_id": "main", **content},
        upsert=True,
    )
    return {"ok": True}

# ============================================================
# LANDING PAGE ANALYTICS
# ============================================================

class LPEvent(BaseModel):
    session_id: str
    event_type: str            # pageview | heartbeat | click | scroll | unload
    template: Optional[str] = ""
    path: Optional[str] = "/"
    referrer: Optional[str] = ""
    target: Optional[str] = "" # click target: activation | whatsapp | faq:N | nav:fitur
    scroll_pct: Optional[int] = None
    viewport_w: Optional[int] = None
    viewport_h: Optional[int] = None
    device: Optional[str] = "" # mobile | tablet | desktop
    duration_ms: Optional[int] = None

def _parse_browser(ua: str) -> str:
    ua = (ua or "").lower()
    if "edg/" in ua: return "Edge"
    if "chrome/" in ua and "chromium" not in ua: return "Chrome"
    if "firefox/" in ua: return "Firefox"
    if "safari/" in ua and "chrome" not in ua: return "Safari"
    if "opera" in ua or "opr/" in ua: return "Opera"
    return "Other"

def _parse_os(ua: str) -> str:
    ua = (ua or "").lower()
    if "android" in ua: return "Android"
    if "iphone" in ua or "ipad" in ua or "ipod" in ua: return "iOS"
    if "mac os" in ua: return "macOS"
    if "windows" in ua: return "Windows"
    if "linux" in ua: return "Linux"
    return "Other"

@api_router.post("/lp-track")
async def lp_track(ev: LPEvent, request: Request):
    """Public: record landing page analytics event."""
    ua = request.headers.get("user-agent", "")[:300]
    ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "")
    country = request.headers.get("cf-ipcountry", "") or ""
    doc = {
        "session_id": ev.session_id,
        "event_type": ev.event_type,
        "template": ev.template or "default",
        "path": ev.path or "/",
        "referrer": (ev.referrer or "")[:500],
        "target": ev.target or "",
        "scroll_pct": ev.scroll_pct,
        "viewport_w": ev.viewport_w,
        "viewport_h": ev.viewport_h,
        "device": ev.device or "",
        "duration_ms": ev.duration_ms,
        "ip": ip,
        "country": country,
        "ua": ua,
        "browser": _parse_browser(ua),
        "os": _parse_os(ua),
        "ts": datetime.utcnow(),
    }
    await db.lp_events.insert_one(doc)
    return {"ok": True}

@api_router.get("/admin/lp-analytics")
async def lp_analytics(days: int = 7, admin: Dict = Depends(require_superadmin)):
    """Superadmin: aggregated LP analytics for last N days."""
    days = max(1, min(90, int(days)))
    since = datetime.utcnow() - timedelta(days=days)
    coll = db.lp_events

    total_events = await coll.count_documents({"ts": {"$gte": since}})
    total_views = await coll.count_documents({"ts": {"$gte": since}, "event_type": "pageview"})

    unique_sessions = await coll.distinct("session_id", {"ts": {"$gte": since}})
    unique_count = len(unique_sessions)

    # Sessions with at least 1 click → conversions
    conv_sessions = await coll.distinct("session_id", {"ts": {"$gte": since}, "event_type": "click", "target": {"$in": ["activation", "whatsapp"]}})
    conv_count = len(conv_sessions)
    conv_rate = round((conv_count / unique_count * 100), 2) if unique_count else 0.0

    # Avg duration: max(ts) - min(ts) per session
    duration_pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": "$session_id", "min_ts": {"$min": "$ts"}, "max_ts": {"$max": "$ts"}, "evt_count": {"$sum": 1}}},
        {"$project": {"dur_ms": {"$subtract": ["$max_ts", "$min_ts"]}, "evt_count": 1}},
    ]
    sessions_meta = await coll.aggregate(duration_pipeline).to_list(length=None)
    durations = [s["dur_ms"] for s in sessions_meta if s["dur_ms"] > 0]
    avg_duration_ms = int(sum(durations) / len(durations)) if durations else 0
    median_duration_ms = int(sorted(durations)[len(durations)//2]) if durations else 0
    bounce_sessions = sum(1 for s in sessions_meta if s["evt_count"] <= 1)
    bounce_rate = round((bounce_sessions / unique_count * 100), 2) if unique_count else 0.0

    async def _group_count(field, extra_match=None, limit=10):
        match = {"ts": {"$gte": since}}
        if extra_match: match.update(extra_match)
        pipeline = [
            {"$match": match},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        rows = await coll.aggregate(pipeline).to_list(length=limit)
        return [{"key": r["_id"] or "(unknown)", "count": r["count"]} for r in rows]

    top_referrers = await _group_count("referrer", {"event_type": "pageview"})
    top_countries = await _group_count("country", {"event_type": "pageview"})
    top_browsers = await _group_count("browser", {"event_type": "pageview"})
    top_os = await _group_count("os", {"event_type": "pageview"})
    top_devices = await _group_count("device", {"event_type": "pageview"})
    top_targets = await _group_count("target", {"event_type": "click"}, 20)
    top_templates = await _group_count("template", {"event_type": "pageview"})

    # Per-template performance (views, unique sessions, conv rate)
    tpl_pipeline = [
        {"$match": {"ts": {"$gte": since}, "event_type": {"$in": ["pageview", "click"]}}},
        {"$group": {
            "_id": {"tpl": "$template", "sid": "$session_id"},
            "has_click": {"$max": {"$cond": [{"$eq": ["$event_type", "click"]}, 1, 0]}},
        }},
        {"$group": {
            "_id": "$_id.tpl",
            "sessions": {"$sum": 1},
            "converted": {"$sum": "$has_click"},
        }},
        {"$sort": {"sessions": -1}},
    ]
    tpl_perf_raw = await coll.aggregate(tpl_pipeline).to_list(length=None)
    template_performance = [
        {
            "template": r["_id"] or "default",
            "sessions": r["sessions"],
            "converted": r["converted"],
            "conv_rate": round((r["converted"] / r["sessions"] * 100), 2) if r["sessions"] else 0.0,
        }
        for r in tpl_perf_raw
    ]

    # Scroll depth distribution (max scroll pct per session)
    scroll_pipeline = [
        {"$match": {"ts": {"$gte": since}, "event_type": "scroll"}},
        {"$group": {"_id": "$session_id", "max_pct": {"$max": "$scroll_pct"}}},
        {"$bucket": {
            "groupBy": "$max_pct",
            "boundaries": [0, 25, 50, 75, 100, 101],
            "default": "other",
            "output": {"count": {"$sum": 1}},
        }},
    ]
    scroll_buckets = await coll.aggregate(scroll_pipeline).to_list(length=None)
    scroll_distribution = [{"bucket": r["_id"], "count": r["count"]} for r in scroll_buckets]

    # Timeline: views per day
    timeline_pipeline = [
        {"$match": {"ts": {"$gte": since}, "event_type": "pageview"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}},
            "views": {"$sum": 1},
            "sessions": {"$addToSet": "$session_id"},
        }},
        {"$project": {"date": "$_id", "views": 1, "unique": {"$size": "$sessions"}, "_id": 0}},
        {"$sort": {"date": 1}},
    ]
    timeline = await coll.aggregate(timeline_pipeline).to_list(length=None)

    # Recent events (last 50)
    recent_raw = await coll.find(
        {"ts": {"$gte": since}},
        {"_id": 0, "session_id": 1, "event_type": 1, "target": 1, "country": 1, "browser": 1, "os": 1, "device": 1, "referrer": 1, "template": 1, "ts": 1, "scroll_pct": 1},
    ).sort("ts", -1).limit(50).to_list(length=50)
    for r in recent_raw:
        if isinstance(r.get("ts"), datetime):
            r["ts"] = r["ts"].isoformat()

    return {
        "range_days": days,
        "summary": {
            "total_events": total_events,
            "total_views": total_views,
            "unique_visitors": unique_count,
            "conversions": conv_count,
            "conv_rate": conv_rate,
            "avg_duration_ms": avg_duration_ms,
            "median_duration_ms": median_duration_ms,
            "bounce_rate": bounce_rate,
            "bounce_sessions": bounce_sessions,
        },
        "timeline": timeline,
        "top_referrers": top_referrers,
        "top_countries": top_countries,
        "top_browsers": top_browsers,
        "top_os": top_os,
        "top_devices": top_devices,
        "top_targets": top_targets,
        "top_templates": top_templates,
        "template_performance": template_performance,
        "scroll_distribution": scroll_distribution,
        "recent_events": recent_raw,
    }

# ============================================================
# CENTRAL AI SETUP (Superadmin)
# ============================================================

AI_SETTINGS_KEY = "central_ai_settings"

AI_SETTINGS_DEFAULTS = {
    "provider": "GEMINI",
    "model": "gemini-2.0-flash",
    "api_key": "",
    "base_url": "",
    "temperature": 0.2,
    "max_tokens": 1200,
    "daily_token_limit": 50000,
    "fallback_enabled": True,
    "fallback_provider": "GEMINI",
    "fallback_model": "gemini-2.0-flash",
    "fallback_api_key": "",
    "fallback_base_url": "",
}

AI_PROVIDERS = ["GEMINI", "OPENAI", "DEEPSEEK", "GROQ", "OPENROUTER", "OLLAMA"]

async def get_ai_settings_doc() -> dict:
    doc = await db.central_ai_settings.find_one({"_id": AI_SETTINGS_KEY})
    if not doc:
        return {**AI_SETTINGS_DEFAULTS}
    out = {**AI_SETTINGS_DEFAULTS}
    for k in AI_SETTINGS_DEFAULTS:
        if k in doc:
            out[k] = doc[k]
    return out

@api_router.get("/superadmin/ai-setup")
async def get_central_ai_settings(admin: Dict = Depends(require_superadmin)):
    settings = await get_ai_settings_doc()
    return settings

@api_router.put("/superadmin/ai-setup")
async def update_central_ai_settings(body: dict, admin: Dict = Depends(require_superadmin)):
    allowed = set(AI_SETTINGS_DEFAULTS.keys())
    update_data: dict = {}
    for k, v in body.items():
        if k in allowed:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="Tidak ada field valid untuk diupdate.")
    await db.central_ai_settings.update_one(
        {"_id": AI_SETTINGS_KEY},
        {"$set": update_data},
        upsert=True,
    )
    return {"success": True, "message": "Pengaturan AI terpusat berhasil disimpan."}

@api_router.get("/superadmin/ai-usage")
async def get_ai_usage_stats(days: int = 30, admin: Dict = Depends(require_superadmin)):
    from datetime import timezone
    since = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline_summary = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {
            "_id": None,
            "total_tokens": {"$sum": "$total_tokens"},
            "total_requests": {"$sum": 1},
            "prompt_tokens": {"$sum": "$prompt_tokens"},
            "completion_tokens": {"$sum": "$completion_tokens"},
        }}
    ]
    summary_docs = await db.ai_usage_logs.aggregate(pipeline_summary).to_list(1)
    summary = summary_docs[0] if summary_docs else {"total_tokens": 0, "total_requests": 0, "prompt_tokens": 0, "completion_tokens": 0}
    summary.pop("_id", None)

    # Today stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_docs = await db.ai_usage_logs.aggregate([
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "tokens": {"$sum": "$total_tokens"}, "requests": {"$sum": 1}}}
    ]).to_list(1)
    today = today_docs[0] if today_docs else {"tokens": 0, "requests": 0}
    today.pop("_id", None)

    # Per-license top usage
    per_license = await db.ai_usage_logs.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$license_key", "tokens": {"$sum": "$total_tokens"}, "requests": {"$sum": 1}}},
        {"$sort": {"tokens": -1}},
        {"$limit": 20},
    ]).to_list(20)
    for d in per_license:
        if "_id" in d:
            d["license_key"] = d.pop("_id") or "-"

    # Provider breakdown
    by_provider = await db.ai_usage_logs.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$provider", "tokens": {"$sum": "$total_tokens"}, "requests": {"$sum": 1}}},
        {"$sort": {"tokens": -1}},
    ]).to_list(20)
    for d in by_provider:
        if "_id" in d:
            d["provider"] = d.pop("_id") or "Unknown"

    # Timeline (daily)
    timeline = await db.ai_usage_logs.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "tokens": {"$sum": "$total_tokens"},
            "requests": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(100)
    for d in timeline:
        if "_id" in d:
            d["date"] = d.pop("_id")

    # Per-user top usage
    per_user_raw = await db.ai_usage_logs.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$user_id", "tokens": {"$sum": "$total_tokens"}, "requests": {"$sum": 1}}},
        {"$sort": {"tokens": -1}},
        {"$limit": 20},
    ]).to_list(20)
    per_user = []
    for d in per_user_raw:
        uid = d.get("_id") or "-"
        username = str(uid)
        if uid and uid != "-":
            try:
                from bson import ObjectId as _ObjId
                user_doc = await db.users.find_one({"_id": _ObjId(str(uid))}, {"username": 1, "name": 1})
                if user_doc:
                    username = user_doc.get("username") or user_doc.get("name") or str(uid)
            except Exception:
                pass
        per_user.append({"user_id": str(uid), "username": username, "tokens": d.get("tokens", 0), "requests": d.get("requests", 0)})

    # Recent logs
    recent_cursor = db.ai_usage_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    recent = await recent_cursor.to_list(50)
    for r in recent:
        if "created_at" in r and hasattr(r["created_at"], "isoformat"):
            r["created_at"] = r["created_at"].isoformat()

    return {
        "summary": summary,
        "today": today,
        "per_license": per_license,
        "by_provider": by_provider,
        "per_user": per_user,
        "timeline": timeline,
        "recent": recent,
    }

# ============================================================
# CHATBOT LISENSI (Superadmin)
# ============================================================

def _license_to_json(doc: dict) -> dict:
    doc = {**doc}
    doc.pop("_id", None)
    if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
        doc["created_at"] = doc["created_at"].isoformat()
    if "updated_at" in doc and hasattr(doc["updated_at"], "isoformat"):
        doc["updated_at"] = doc["updated_at"].isoformat()
    if "expires_at" in doc and hasattr(doc["expires_at"], "isoformat"):
        doc["expires_at"] = doc["expires_at"].isoformat()
    return doc

def _generate_license_key(product_code: str) -> str:
    import secrets, string
    chars = string.ascii_uppercase + string.digits
    seg1 = ''.join(secrets.choice(chars) for _ in range(4))
    seg2 = ''.join(secrets.choice(chars) for _ in range(4))
    seg3 = ''.join(secrets.choice(chars) for _ in range(4))
    prefix = (product_code[:4].upper() if product_code else "SATO")
    return f"{prefix}-{seg1}-{seg2}-{seg3}"

@api_router.get("/superadmin/licenses")
async def list_chatbot_licenses(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin: Dict = Depends(require_superadmin),
):
    query: dict = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"license_key": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"customer_email": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * limit
    total = await db.chatbot_licenses.count_documents(query)
    cursor = db.chatbot_licenses.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [_license_to_json(d) for d in docs],
    }

class ChatbotLicenseCreate(BaseModel):
    product_code: str
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    customer_email: Optional[str] = ""
    plan_name: Optional[str] = "standard"
    max_activations: Optional[int] = 1
    expires_at: Optional[str] = None  # ISO date string or empty = no expiry
    notes: Optional[str] = ""

class ChatbotLicenseUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    plan_name: Optional[str] = None
    status: Optional[str] = None
    max_activations: Optional[int] = None
    expires_at: Optional[str] = None
    notes: Optional[str] = None

@api_router.post("/superadmin/licenses")
async def create_chatbot_license(req: ChatbotLicenseCreate, admin: Dict = Depends(require_superadmin)):
    key = _generate_license_key(req.product_code)
    # Ensure uniqueness
    while await db.chatbot_licenses.find_one({"license_key": key}):
        key = _generate_license_key(req.product_code)

    expires_dt = None
    if req.expires_at:
        try:
            expires_dt = datetime.fromisoformat(req.expires_at.replace("Z", "+00:00"))
        except Exception:
            pass

    now = datetime.utcnow()
    doc = {
        "license_key": key,
        "product_code": req.product_code,
        "customer_name": req.customer_name or "",
        "customer_phone": req.customer_phone or "",
        "customer_email": req.customer_email or "",
        "plan_name": req.plan_name or "standard",
        "status": "active",
        "max_activations": req.max_activations or 1,
        "activations_used": 0,
        "expires_at": expires_dt,
        "notes": req.notes or "",
        "created_at": now,
        "updated_at": now,
        "created_by": admin.get("username", ""),
    }
    await db.chatbot_licenses.insert_one(doc)
    return {"success": True, "license_key": key, "data": _license_to_json(doc)}

@api_router.get("/superadmin/licenses/{license_key}")
async def get_chatbot_license(license_key: str, admin: Dict = Depends(require_superadmin)):
    doc = await db.chatbot_licenses.find_one({"license_key": license_key.upper()})
    if not doc:
        raise HTTPException(status_code=404, detail="Lisensi tidak ditemukan.")
    return _license_to_json(doc)

@api_router.put("/superadmin/licenses/{license_key}")
async def update_chatbot_license(license_key: str, req: ChatbotLicenseUpdate, admin: Dict = Depends(require_superadmin)):
    doc = await db.chatbot_licenses.find_one({"license_key": license_key.upper()})
    if not doc:
        raise HTTPException(status_code=404, detail="Lisensi tidak ditemukan.")

    update_fields: dict = {"updated_at": datetime.utcnow()}
    if req.customer_name is not None:
        update_fields["customer_name"] = req.customer_name
    if req.customer_phone is not None:
        update_fields["customer_phone"] = req.customer_phone
    if req.customer_email is not None:
        update_fields["customer_email"] = req.customer_email
    if req.plan_name is not None:
        update_fields["plan_name"] = req.plan_name
    if req.status is not None:
        allowed_statuses = {"active", "trial", "expired", "suspended"}
        if req.status not in allowed_statuses:
            raise HTTPException(status_code=400, detail=f"Status tidak valid. Pilihan: {allowed_statuses}")
        update_fields["status"] = req.status
    if req.max_activations is not None:
        update_fields["max_activations"] = req.max_activations
    if req.expires_at is not None:
        if req.expires_at == "":
            update_fields["expires_at"] = None
        else:
            try:
                update_fields["expires_at"] = datetime.fromisoformat(req.expires_at.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(status_code=400, detail="Format tanggal tidak valid.")
    if req.notes is not None:
        update_fields["notes"] = req.notes

    await db.chatbot_licenses.update_one({"license_key": license_key.upper()}, {"$set": update_fields})
    updated = await db.chatbot_licenses.find_one({"license_key": license_key.upper()})
    return {"success": True, "data": _license_to_json(updated)}

@api_router.delete("/superadmin/licenses/{license_key}")
async def delete_chatbot_license(license_key: str, admin: Dict = Depends(require_superadmin)):
    result = await db.chatbot_licenses.delete_one({"license_key": license_key.upper()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lisensi tidak ditemukan.")
    return {"success": True, "message": "Lisensi berhasil dihapus."}

@api_router.post("/superadmin/licenses/{license_key}/send-waha")
async def send_license_via_waha(license_key: str, admin: Dict = Depends(require_superadmin)):
    doc = await db.chatbot_licenses.find_one({"license_key": license_key.upper()})
    if not doc:
        raise HTTPException(status_code=404, detail="Lisensi tidak ditemukan.")

    waha_cfg_doc = await db.waha_settings.find_one({"_id": "waha_config"})
    if not waha_cfg_doc:
        raise HTTPException(status_code=400, detail="Konfigurasi WAHA belum diatur.")

    waha_url = (waha_cfg_doc.get("waha_url") or "").rstrip("/")
    waha_session = waha_cfg_doc.get("waha_session") or "default"
    waha_api_key = waha_cfg_doc.get("waha_api_key") or ""
    template = waha_cfg_doc.get("license_message_template") or "{license_key}"

    phone = (doc.get("customer_phone") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Nomor HP customer belum diisi.")

    # Normalize phone
    phone_digits = ''.join(c for c in phone if c.isdigit())
    if phone_digits.startswith("0"):
        phone_digits = "62" + phone_digits[1:]
    elif not phone_digits.startswith("62"):
        phone_digits = "62" + phone_digits

    expires_str = ""
    if doc.get("expires_at"):
        try:
            expires_str = doc["expires_at"].strftime("%d %B %Y")
        except Exception:
            expires_str = str(doc["expires_at"])

    message = template
    replacements = {
        "{customer_name}": doc.get("customer_name") or "-",
        "{license_key}": doc.get("license_key") or "",
        "{product_code}": doc.get("product_code") or "-",
        "{plan_name}": doc.get("plan_name") or "standard",
        "{expires_at}": expires_str or "Tidak ada expiry",
        "{customer_phone}": phone,
        "{customer_email}": doc.get("customer_email") or "-",
    }
    for placeholder, value in replacements.items():
        message = message.replace(placeholder, value)

    if not waha_url:
        raise HTTPException(status_code=400, detail="WAHA URL belum diatur.")

    import httpx
    chat_id = f"{phone_digits}@c.us"
    payload = {"session": waha_session, "chatId": chat_id, "text": message}
    headers = {"Content-Type": "application/json"}
    if waha_api_key:
        headers["X-Api-Key"] = waha_api_key

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{waha_url}/api/sendText", json=payload, headers=headers)
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"WAHA error {resp.status_code}: {resp.text[:200]}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi WAHA: {exc}")

    return {"success": True, "message": f"Lisensi berhasil dikirim ke {phone_digits}"}

@api_router.get("/superadmin/license-stats")
async def get_license_stats(admin: Dict = Depends(require_superadmin)):
    total = await db.chatbot_licenses.count_documents({})
    active = await db.chatbot_licenses.count_documents({"status": "active"})
    trial = await db.chatbot_licenses.count_documents({"status": "trial"})
    expired = await db.chatbot_licenses.count_documents({"status": "expired"})
    suspended = await db.chatbot_licenses.count_documents({"status": "suspended"})
    return {"total": total, "active": active, "trial": trial, "expired": expired, "suspended": suspended}

# ============================================================
# WAHA CONFIGURATION (Superadmin)
# ============================================================

WAHA_SETTINGS_DEFAULTS = {
    "waha_url": "",
    "waha_session": "default",
    "waha_api_key": "",
    "license_message_template": (
        "Halo kak {customer_name}, berikut lisensi ChatBot Anda:\n\n"
        "🔑 License Key:\n{license_key}\n\n"
        "📦 Produk:\n{product_code}\n\n"
        "💎 Plan:\n{plan_name}\n\n"
        "📅 Berlaku hingga:\n{expires_at}\n\n"
        "Silakan simpan license key ini dengan baik. Terima kasih 🙏"
    ),
}

@api_router.get("/superadmin/waha-config")
async def get_waha_config(admin: Dict = Depends(require_superadmin)):
    doc = await db.waha_settings.find_one({"_id": "waha_config"})
    out = {**WAHA_SETTINGS_DEFAULTS}
    if doc:
        for k in WAHA_SETTINGS_DEFAULTS:
            if k in doc:
                out[k] = doc[k]
    return out

@api_router.put("/superadmin/waha-config")
async def update_waha_config(body: dict, admin: Dict = Depends(require_superadmin)):
    allowed = set(WAHA_SETTINGS_DEFAULTS.keys())
    update_data: dict = {}
    for k, v in body.items():
        if k in allowed:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="Tidak ada field valid untuk diupdate.")
    await db.waha_settings.update_one(
        {"_id": "waha_config"},
        {"$set": update_data},
        upsert=True,
    )
    return {"success": True, "message": "Konfigurasi WAHA berhasil disimpan."}

@api_router.post("/superadmin/waha-test")
async def test_waha_connection(body: dict, admin: Dict = Depends(require_superadmin)):
    waha_url = (body.get("waha_url") or "").rstrip("/")
    waha_api_key = body.get("waha_api_key") or ""
    waha_session = body.get("waha_session") or "default"
    test_phone = body.get("test_phone") or ""

    if not waha_url:
        raise HTTPException(status_code=400, detail="WAHA URL wajib diisi.")

    import httpx
    headers = {"Content-Type": "application/json"}
    if waha_api_key:
        headers["X-Api-Key"] = waha_api_key

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Check session status
            resp = await client.get(f"{waha_url}/api/sessions/{waha_session}", headers=headers)

        if resp.status_code == 200:
            session_data = resp.json()
            status = session_data.get("status") or session_data.get("engine", {}).get("state") or "unknown"
            return {"success": True, "message": f"Koneksi berhasil. Status session: {status}", "session": session_data}
        elif resp.status_code == 401:
            raise HTTPException(status_code=400, detail="API Key WAHA tidak valid.")
        elif resp.status_code == 404:
            return {"success": False, "message": f"Session '{waha_session}' tidak ditemukan di WAHA."}
        else:
            return {"success": False, "message": f"WAHA merespons dengan kode {resp.status_code}"}
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi WAHA: {exc}")

# ============================================================
# HEALTH CHECK
# ============================================================

@api_router.get("/")
async def root():
    return {"message": "ChatBot Manager API v1.2.0", "status": "running"}

# Include router and middleware
app.include_router(api_router)

# CORS — baca dari env var ALLOWED_ORIGINS (pisah koma)
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_app_env = os.environ.get("APP_ENV", "development").lower()

if not _allowed_origins:
    if _app_env == "production":
        # Fail-fast: jangan diam-diam izinkan semua origin di produksi.
        raise RuntimeError(
            "ALLOWED_ORIGINS wajib diisi di produksi. "
            "Set env var ALLOWED_ORIGINS=https://domain1.com,https://domain2.com"
        )
    # Development only: izinkan wildcard. allow_credentials harus False bersamanya
    # karena spek CORS melarang kombinasi "*" + credentials.
    _allowed_origins = ["*"]
    _allow_credentials = False
    logger.warning("ALLOWED_ORIGINS kosong — fallback ke '*' (mode development).")
else:
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_allow_credentials,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Api-Key"],
)

# Security headers
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse as _JSONResponse

# CSP: izinkan inline style (banyak komponen Radix/Tailwind pakai inline style),
# data: untuk gambar base64 branding/favicon, dan https: untuk gambar pihak ketiga.
_CSP = (
    "default-src 'self'; "
    "img-src 'self' data: https:; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; "
    "font-src 'self' data:; "
    "connect-src 'self' https:; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = _CSP
        # HSTS hanya saat HTTPS (di balik reverse proxy, cek X-Forwarded-Proto)
        if _app_env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    MAX_BODY = 5 * 1024 * 1024  # 5 MB
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_BODY:
            return _JSONResponse(status_code=413, content={"detail": "Payload terlalu besar (maks 5MB)"})
        return await call_next(request)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
