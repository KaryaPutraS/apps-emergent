from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import secrets
import httpx
import hashlib

ROOT_DIR = Path(__file__).parent
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

def hash_password(password: str, salt: str = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}${hashed}"

def check_password(password: str, stored_hash: str) -> bool:
    if "$" not in stored_hash:
        return password == stored_hash
    parts = stored_hash.split("$", 1)
    if len(parts) != 2:
        return password == stored_hash
    salt = parts[0]
    expected = hash_password(password, salt)
    return expected == stored_hash

async def ensure_admin_password():
    config = await db.config.find_one({"key": "admin_password_hash"})
    if not config:
        hashed = hash_password(DEFAULT_PASSWORD)
        await db.config.insert_one({"key": "admin_password_hash", "value": hashed, "updated_at": datetime.utcnow()})
    else:
        stored = config.get("value", "")
        if stored.startswith("$2b$") or stored.startswith("$2a$"):
            logger.info("Migrating password hash from bcrypt to SHA-256...")
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
    return {
        "token": token,
        "userId": session.get("userId", "admin"),
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
    # Config defaults
    config_count = await db.config.count_documents({"key": {"$nin": ["admin_password_hash"]}})
    if config_count == 0:
        defaults = [
            {"key": "wahaUrl", "value": ""},
            {"key": "wahaSession", "value": "default"},
            {"key": "wahaApiKey", "value": ""},
            {"key": "backendUrl", "value": ""},
            {"key": "aiProvider", "value": ""},
            {"key": "aiModel", "value": ""},
            {"key": "hasAiApiKey", "value": False},
            {"key": "ollamaUrl", "value": ""},
            {"key": "systemPrompt", "value": ""},
            {"key": "businessInfo", "value": ""},
            {"key": "aiTemperature", "value": 0.7},
            {"key": "aiMaxTokens", "value": 500},
            {"key": "memoryLimit", "value": 10},
            {"key": "memoryTimeoutMinutes", "value": 30},
            {"key": "ruleAiEnabled", "value": False},
            {"key": "isBotActive", "value": False},
            {"key": "workingHoursEnabled", "value": False},
            {"key": "workingHoursStart", "value": "08:00"},
            {"key": "workingHoursEnd", "value": "17:00"},
            {"key": "offlineMessage", "value": ""},
            {"key": "typingSimulation", "value": False},
            {"key": "responseDelayMs", "value": 0},
            {"key": "rateLimitPerMinute", "value": 15},
            {"key": "maxIncomingMessageChars", "value": 2000},
            {"key": "broadcastDailyLimit", "value": 100},
            {"key": "broadcastBatchSize", "value": 10},
            {"key": "defaultRuleResponseMode", "value": "direct"},
            {"key": "logRetentionDays", "value": 30},
            {"key": "messageRetentionDays", "value": 90},
        ]
        for d in defaults:
            d["updated_at"] = datetime.utcnow()
        await db.config.insert_many(defaults)

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

    # License default
    if await db.license.count_documents({}) == 0:
        await db.license.insert_one({
            "valid": False,
            "status": "missing",
            "licenseKey": "",
            "customerName": "",
            "planName": "",
            "expiresAt": "",
            "maxActivations": 0,
            "instanceId": str(uuid.uuid4()),
        })

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
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.users.create_index("username", unique=True)
    await seed_defaults()
    logger.info("ChatBot Manager backend started")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ============================================================
# AUTH ENDPOINTS
# ============================================================

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    username = req.username.strip().lower() if req.username else "admin"

    # Check users collection first
    user = await db.users.find_one({"username": username, "isActive": True})
    if user:
        if not check_password(req.password, user.get("passwordHash", "")):
            await add_log("LOGIN_FAILED", f"Percobaan login gagal untuk user: {username}")
            return LoginResponse(success=False, message="Username atau password salah.")

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
            }
        )

    # Fall back to legacy admin password for backward compatibility
    if username == "admin" and await verify_legacy_password(req.password):
        token = await create_session(user_id="admin", username="admin", role="superadmin", full_name="Administrator")
        await add_log("LOGIN_SUCCESS", "Admin login berhasil (legacy)")
        await log_user_activity("admin", "admin", "LOGIN", "Login berhasil")
        return LoginResponse(
            success=True,
            token=token,
            message="Login berhasil",
            user={"userId": "admin", "username": "admin", "role": "superadmin", "fullName": "Administrator"}
        )

    await add_log("LOGIN_FAILED", f"Percobaan login gagal untuk: {username}")
    await log_user_activity("unknown", username, "LOGIN_FAILED", "Password salah")
    return LoginResponse(success=False, message="Username atau password salah.")

@api_router.post("/auth/logout")
async def logout(current_user: Dict = Depends(get_current_user)):
    await log_user_activity(current_user["userId"], current_user["username"], "LOGOUT", "Logout")
    await db.sessions.delete_one({"token": current_user["token"]})
    return {"success": True}

@api_router.get("/auth/check")
async def check_session(current_user: Dict = Depends(get_current_user)):
    license_doc = await db.license.find_one({}, {"_id": 0})
    return {
        "valid": True,
        "license": license_doc,
        "user": {
            "userId": current_user["userId"],
            "username": current_user["username"],
            "role": current_user["role"],
            "fullName": current_user["fullName"],
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
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password minimal 8 karakter.")

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
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password minimal 8 karakter.")
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
async def get_dashboard_stats(token: str = Depends(validate_token)):
    total_messages = await db.messages.count_documents({})
    total_contacts = await db.contacts.count_documents({})
    active_rules = await db.rules.count_documents({"isActive": True})

    pipeline = [{"$group": {"_id": None, "totalTokens": {"$sum": "$tokensUsed"}, "aiCalls": {"$sum": {"$cond": [{"$gt": ["$tokensUsed", 0]}, 1, 0]}}}}]
    agg = await db.messages.aggregate(pipeline).to_list(1)
    tokens_used = agg[0]["totalTokens"] if agg else 0
    ai_calls = agg[0]["aiCalls"] if agg else 0

    bot_active_doc = await db.config.find_one({"key": "isBotActive"})
    bot_active = bot_active_doc["value"] if bot_active_doc else True

    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"isActive": True})

    return {
        "totalMessages": total_messages,
        "totalContacts": total_contacts,
        "activeRules": active_rules,
        "aiCalls": ai_calls,
        "tokensUsed": tokens_used,
        "botActive": bot_active,
        "uptime": "99.8%",
        "avgResponseTime": "1.2s",
        "totalUsers": total_users,
        "activeUsers": active_users,
    }

@api_router.get("/dashboard/chart")
async def get_dashboard_chart(token: str = Depends(validate_token)):
    chart_data = []
    for i in range(6, -1, -1):
        date = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        messages_in = await db.messages.count_documents({
            "direction": "incoming",
            "timestamp": {"$regex": f"^{date}"}
        })
        messages_out = await db.messages.count_documents({
            "direction": "outgoing",
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

@api_router.get("/config")
async def get_config(token: str = Depends(validate_token)):
    configs = await db.config.find({"key": {"$ne": "admin_password_hash"}}, {"_id": 0}).to_list(100)
    result = {}
    for c in configs:
        result[c["key"]] = c.get("value", "")
    return result

@api_router.put("/config")
async def update_config(req: ConfigUpdate, current_user: Dict = Depends(get_current_user)):
    for key, value in req.updates.items():
        if key == "admin_password_hash":
            continue
        await db.config.update_one(
            {"key": key},
            {"$set": {"value": value, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    await add_log("CONFIG_UPDATE", f"Config updated: {', '.join(req.updates.keys())}")
    await log_user_activity(current_user["userId"], current_user["username"], "CONFIG_UPDATE", f"Update config: {', '.join(req.updates.keys())}")
    return {"success": True}

@api_router.get("/config/ai-agent")
async def get_ai_agent_config(token: str = Depends(validate_token)):
    keys = ["systemPrompt", "businessInfo", "aiTemperature", "aiMaxTokens", "memoryLimit", "memoryTimeoutMinutes", "ruleAiEnabled"]
    result = {}
    for key in keys:
        doc = await db.config.find_one({"key": key})
        result[key] = doc["value"] if doc else ""
    return result

@api_router.put("/config/ai-agent")
async def update_ai_agent_config(req: AIAgentConfig, current_user: Dict = Depends(get_current_user)):
    updates = req.dict(exclude_none=True)
    for key, value in updates.items():
        await db.config.update_one(
            {"key": key},
            {"$set": {"value": value, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    await add_log("AI_AGENT_UPDATE", f"AI Agent config updated: {', '.join(updates.keys())}")
    await log_user_activity(current_user["userId"], current_user["username"], "AI_AGENT_UPDATE", f"Update AI Agent config")
    return {"success": True, "updated_keys": list(updates.keys())}

# ============================================================
# LICENSE
# ============================================================

@api_router.get("/license")
async def get_license(token: str = Depends(validate_token)):
    doc = await db.license.find_one({}, {"_id": 0})
    return doc or {"valid": False, "status": "missing"}

@api_router.post("/license/activate")
async def activate_license(req: LicenseActivate, token: str = Depends(validate_token)):
    license_data = {
        "valid": True,
        "status": "active",
        "licenseKey": req.licenseKey,
        "customerName": "Customer",
        "planName": "Professional",
        "expiresAt": (datetime.utcnow() + timedelta(days=365)).strftime("%Y-%m-%d"),
        "maxActivations": 3,
        "instanceId": str(uuid.uuid4()),
    }
    await db.license.update_one({}, {"$set": license_data}, upsert=True)
    await add_log("LICENSE_ACTIVATED", f"Lisensi diaktifkan: {req.licenseKey}")
    return license_data

@api_router.delete("/license")
async def clear_license(token: str = Depends(validate_token)):
    await db.license.update_one({}, {"$set": {
        "valid": False, "status": "missing", "licenseKey": "",
        "customerName": "", "planName": "", "expiresAt": ""
    }}, upsert=True)
    await add_log("LICENSE_CLEARED", "Lisensi dihapus")
    return {"success": True}

# ============================================================
# RULES
# ============================================================

@api_router.get("/rules")
async def get_rules(token: str = Depends(validate_token)):
    rules = await db.rules.find({}, {"_id": 0}).sort("priority", 1).to_list(200)
    return rules

@api_router.post("/rules")
async def save_rule(rule: RuleModel, current_user: Dict = Depends(get_current_user)):
    rule_dict = rule.dict()
    if not rule_dict.get("id"):
        rule_dict["id"] = str(uuid.uuid4())
    rule_dict["created_at"] = datetime.utcnow()

    existing = await db.rules.find_one({"id": rule_dict["id"]})
    if existing:
        await db.rules.update_one({"id": rule_dict["id"]}, {"$set": rule_dict})
        action = "RULE_UPDATED"
    else:
        await db.rules.insert_one(rule_dict)
        action = "RULE_CREATED"

    await add_log("RULE_SAVED", f"Rule '{rule_dict['name']}' disimpan")
    await log_user_activity(current_user["userId"], current_user["username"], action, f"Rule '{rule_dict['name']}'")
    rule_dict.pop("_id", None)
    return {"success": True, "rule": rule_dict}

@api_router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, current_user: Dict = Depends(get_current_user)):
    rule = await db.rules.find_one({"id": rule_id})
    result = await db.rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule tidak ditemukan")
    await add_log("RULE_DELETED", f"Rule {rule_id} dihapus")
    await log_user_activity(current_user["userId"], current_user["username"], "RULE_DELETED", f"Rule '{rule.get('name', rule_id)}' dihapus")
    return {"success": True}

@api_router.put("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, token: str = Depends(validate_token)):
    rule = await db.rules.find_one({"id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule tidak ditemukan")
    new_status = not rule.get("isActive", True)
    await db.rules.update_one({"id": rule_id}, {"$set": {"isActive": new_status}})
    return {"success": True, "isActive": new_status}

# ============================================================
# KNOWLEDGE
# ============================================================

@api_router.get("/knowledge")
async def get_knowledge(token: str = Depends(validate_token)):
    items = await db.knowledge.find({}, {"_id": 0}).to_list(200)
    return items

@api_router.post("/knowledge")
async def save_knowledge(item: KnowledgeModel, current_user: Dict = Depends(get_current_user)):
    item_dict = item.dict()
    if not item_dict.get("id"):
        item_dict["id"] = str(uuid.uuid4())
    item_dict["created_at"] = datetime.utcnow()

    existing = await db.knowledge.find_one({"id": item_dict["id"]})
    if existing:
        await db.knowledge.update_one({"id": item_dict["id"]}, {"$set": item_dict})
        action = "KNOWLEDGE_UPDATED"
    else:
        await db.knowledge.insert_one(item_dict)
        action = "KNOWLEDGE_CREATED"

    await add_log("KNOWLEDGE_SAVED", f"Knowledge '{item_dict['category']}' disimpan")
    await log_user_activity(current_user["userId"], current_user["username"], action, f"Knowledge '{item_dict['keyword']}' ({item_dict['category']})")
    item_dict.pop("_id", None)
    return {"success": True, "item": item_dict}

@api_router.delete("/knowledge/{item_id}")
async def delete_knowledge(item_id: str, current_user: Dict = Depends(get_current_user)):
    item = await db.knowledge.find_one({"id": item_id})
    result = await db.knowledge.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Knowledge tidak ditemukan")
    await add_log("KNOWLEDGE_DELETED", f"Knowledge {item_id} dihapus")
    await log_user_activity(current_user["userId"], current_user["username"], "KNOWLEDGE_DELETED", f"Knowledge '{item.get('keyword', item_id)}' dihapus")
    return {"success": True}

# ============================================================
# TEMPLATES
# ============================================================

@api_router.get("/templates")
async def get_templates(token: str = Depends(validate_token)):
    items = await db.templates.find({}, {"_id": 0}).to_list(200)
    return items

@api_router.post("/templates")
async def save_template(item: TemplateModel, token: str = Depends(validate_token)):
    item_dict = item.dict()
    if not item_dict.get("id"):
        item_dict["id"] = str(uuid.uuid4())
    item_dict["created_at"] = datetime.utcnow()

    existing = await db.templates.find_one({"id": item_dict["id"]})
    if existing:
        await db.templates.update_one({"id": item_dict["id"]}, {"$set": item_dict})
    else:
        await db.templates.insert_one(item_dict)

    await add_log("TEMPLATE_SAVED", f"Template '{item_dict['name']}' disimpan")
    item_dict.pop("_id", None)
    return {"success": True, "item": item_dict}

@api_router.delete("/templates/{item_id}")
async def delete_template(item_id: str, token: str = Depends(validate_token)):
    result = await db.templates.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    await add_log("TEMPLATE_DELETED", f"Template {item_id} dihapus")
    return {"success": True}

# ============================================================
# CONTACTS
# ============================================================

@api_router.get("/contacts")
async def get_contacts(search: str = "", token: str = Depends(validate_token)):
    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}},
            {"tag": {"$regex": search, "$options": "i"}},
        ]}
    contacts = await db.contacts.find(query, {"_id": 0}).sort("lastInteraction", -1).to_list(500)
    return contacts

@api_router.put("/contacts/{chat_id}")
async def update_contact(chat_id: str, update: ContactUpdate, token: str = Depends(validate_token)):
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if not update_dict:
        return {"success": True}
    result = await db.contacts.update_one({"chatId": chat_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kontak tidak ditemukan")
    return {"success": True}

@api_router.delete("/contacts/{chat_id}")
async def delete_contact(chat_id: str, token: str = Depends(validate_token)):
    result = await db.contacts.delete_one({"chatId": chat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kontak tidak ditemukan")
    await add_log("CONTACT_DELETED", f"Kontak {chat_id[:10]}... dihapus")
    return {"success": True}

# ============================================================
# MESSAGES
# ============================================================

@api_router.get("/messages")
async def get_messages(limit: int = 50, token: str = Depends(validate_token)):
    messages = await db.messages.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return messages

# ============================================================
# BROADCAST
# ============================================================

@api_router.post("/broadcast/check")
async def check_broadcast(req: BroadcastCheck, token: str = Depends(validate_token)):
    if req.target == "all":
        count = await db.contacts.count_documents({"isBlocked": {"$ne": True}})
    elif req.target == "tag" and req.tag:
        tags = [t.strip() for t in req.tag.split(",")]
        query = {"isBlocked": {"$ne": True}, "$or": [{"tag": {"$regex": t, "$options": "i"}} for t in tags]}
        count = await db.contacts.count_documents(query)
    elif req.target == "custom" and req.customNumbers:
        count = len([n for n in req.customNumbers.split("\n") if n.strip()])
    else:
        count = 0
    return {"count": count}

@api_router.post("/broadcast/send")
async def send_broadcast(req: BroadcastSend, current_user: Dict = Depends(get_current_user)):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")

    if req.target == "all":
        contacts = await db.contacts.find({"isBlocked": {"$ne": True}}, {"chatId": 1}).to_list(500)
    elif req.target == "tag" and req.tag:
        tags = [t.strip() for t in req.tag.split(",")]
        contacts = await db.contacts.find(
            {"isBlocked": {"$ne": True}, "$or": [{"tag": {"$regex": t, "$options": "i"}} for t in tags]},
            {"chatId": 1}
        ).to_list(500)
    elif req.target == "custom" and req.customNumbers:
        numbers = [n.strip() for n in req.customNumbers.split("\n") if n.strip()]
        contacts = [{"chatId": f"{n}@c.us"} for n in numbers]
    else:
        contacts = []

    count = len(contacts)
    await add_log("BROADCAST_SENT", f"Broadcast dikirim ke {count} kontak")

    for c in contacts:
        await db.messages.insert_one({
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "chatId": c.get("chatId", "unknown"),
            "direction": "outgoing",
            "message": req.message[:200],
            "responseType": "broadcast",
            "tokensUsed": 0
        })

    await log_user_activity(current_user["userId"], current_user["username"], "BROADCAST_SENT", f"Broadcast ke {count} kontak")
    return {"success": True, "sent": count}

# ============================================================
# LOGS
# ============================================================

@api_router.get("/logs")
async def get_logs(limit: int = 50, token: str = Depends(validate_token)):
    logs = await db.logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

async def add_log(log_type: str, message: str):
    await db.logs.insert_one({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "type": log_type,
        "message": message
    })

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
async def test_rule(req: TestRequest, token: str = Depends(validate_token)):
    msg = req.message.lower()
    rules = await db.rules.find({"isActive": True}, {"_id": 0}).sort("priority", 1).to_list(100)

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
async def test_knowledge(req: TestRequest, token: str = Depends(validate_token)):
    msg = req.message.lower()
    items = await db.knowledge.find({"isActive": True}, {"_id": 0}).to_list(100)

    for item in items:
        keywords = [k.strip().lower() for k in item.get("keyword", "").split("|")]
        if any(kw in msg for kw in keywords):
            return {"type": "Knowledge Match", "status": "success", "detail": f'Knowledge "{item["category"]}" cocok! Keyword: {item["keyword"]}, Content: {item["content"][:100]}...'}

    return {"type": "Knowledge Match", "status": "no_match", "detail": "Tidak ada knowledge yang cocok."}

@api_router.post("/test/full-flow")
async def test_full_flow(req: TestRequest, token: str = Depends(validate_token)):
    msg = req.message.lower()

    rules = await db.rules.find({"isActive": True}, {"_id": 0}).sort("priority", 1).to_list(100)
    for rule in rules:
        keywords = [k.strip().lower() for k in rule.get("triggerValue", "").split("|")]
        if any(kw in msg for kw in keywords):
            return {"type": "Full Flow", "status": "success", "detail": f'Flow: Rule "{rule["name"]}" matched → Mode: {rule.get("responseMode", "direct")} → Response: "{rule["response"][:150]}"'}

    items = await db.knowledge.find({"isActive": True}, {"_id": 0}).to_list(100)
    for item in items:
        keywords = [k.strip().lower() for k in item.get("keyword", "").split("|")]
        if any(kw in msg for kw in keywords):
            return {"type": "Full Flow", "status": "success", "detail": f'Flow: Knowledge "{item["category"]}" matched → AI context → Response berdasarkan: {item["content"][:100]}...'}

    return {"type": "Full Flow", "status": "success", "detail": "Flow: No rule/knowledge match → AI full response → Bot akan merespon dengan AI berdasarkan system prompt."}

# ============================================================
# RESET
# ============================================================

@api_router.post("/reset/config")
async def reset_config(token: str = Depends(validate_token)):
    await db.rules.delete_many({})
    await db.knowledge.delete_many({})
    await db.templates.delete_many({})
    ai_keys = ["systemPrompt", "businessInfo", "aiTemperature", "aiMaxTokens", "memoryLimit", "memoryTimeoutMinutes", "ruleAiEnabled"]
    for key in ai_keys:
        await db.config.update_one({"key": key}, {"$set": {"value": ""}}, upsert=True)
    await add_log("RESET_CONFIG", "Konfigurasi BOT direset")
    return {"success": True, "message": "Konfigurasi BOT berhasil direset. Rules, Knowledge, Template dikosongkan."}

@api_router.post("/reset/dashboard")
async def reset_dashboard(token: str = Depends(validate_token)):
    await add_log("RESET_DASHBOARD", "Data dashboard direset")
    return {"success": True, "message": "Data dashboard berhasil direset."}

@api_router.post("/reset/messages")
async def reset_messages(token: str = Depends(validate_token)):
    result = await db.messages.delete_many({})
    await add_log("RESET_MESSAGES", f"Data pesan direset ({result.deleted_count} pesan dihapus)")
    return {"success": True, "message": f"Data pesan berhasil direset. {result.deleted_count} pesan dihapus."}

@api_router.post("/reset/contacts")
async def reset_contacts(token: str = Depends(validate_token)):
    result = await db.contacts.delete_many({})
    await add_log("RESET_CONTACTS", f"Data kontak direset ({result.deleted_count} kontak dihapus)")
    return {"success": True, "message": f"Data kontak berhasil direset. {result.deleted_count} kontak dihapus."}

# ============================================================
# PASSWORD CHANGE
# ============================================================

@api_router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, current_user: Dict = Depends(get_current_user)):
    if not req.currentPassword or not req.newPassword:
        raise HTTPException(status_code=400, detail="Password lama dan baru wajib diisi.")
    if len(req.newPassword) < 8:
        raise HTTPException(status_code=400, detail="Password baru minimal 8 karakter.")
    if req.newPassword != req.confirmPassword:
        raise HTTPException(status_code=400, detail="Konfirmasi password tidak cocok.")

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

    # Legacy admin fallback
    if not await verify_legacy_password(req.currentPassword):
        raise HTTPException(status_code=400, detail="Password lama salah.")
    hashed = hash_password(req.newPassword)
    await db.config.update_one(
        {"key": "admin_password_hash"},
        {"$set": {"value": hashed, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    await db.sessions.delete_many({})
    new_token = await create_session()
    await add_log("PASSWORD_CHANGED", "Password admin berhasil diganti")
    return {"success": True, "token": new_token, "message": "Password berhasil diganti."}

# ============================================================
# AI SETUP (proxy to SatroAI API)
# ============================================================

AI_SETUP_URL = "https://lisensi.satroai.pro/ai-setup"
AI_SETUP_PRODUCT_CODE = "satroai_chatbot_manager"
AI_SETUP_APP_VERSION = "1.1.0-secure"

@api_router.post("/ai-setup/chat")
async def ai_setup_chat(req: AISetupMessage, token: str = Depends(validate_token)):
    license_doc = await db.license.find_one({}, {"_id": 0})
    if not license_doc or not license_doc.get("valid"):
        raise HTTPException(status_code=400, detail="Lisensi belum aktif. Aktifkan lisensi terlebih dahulu di menu Lisensi.")

    license_key = license_doc.get("licenseKey", "")
    instance_id = license_doc.get("instanceId", str(uuid.uuid4()))

    if not license_key:
        raise HTTPException(status_code=400, detail="License key tidak ditemukan. Aktifkan lisensi di menu Lisensi.")

    payload = {
        "license_key": license_key,
        "product_code": AI_SETUP_PRODUCT_CODE,
        "instance_id": instance_id,
        "app_version": AI_SETUP_APP_VERSION,
        "message": req.message,
        "history": req.history,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                AI_SETUP_URL,
                json=payload,
                headers={"Content-Type": "application/json"}
            )

        try:
            data = response.json()
        except Exception:
            data = None

        if response.status_code != 200:
            logger.warning(f"AI Setup API status {response.status_code}: {response.text[:500]}")
            if data and isinstance(data, dict):
                error_msg = data.get("message") or data.get("error") or data.get("reply") or f"API error {response.status_code}"
                return {"success": False, "reply": error_msg, "need_more_info": False, "drafts": []}
            raise HTTPException(status_code=502, detail=f"AI Setup API merespon dengan status {response.status_code}. Coba lagi nanti.")

        if not data:
            raise HTTPException(status_code=502, detail="AI Setup API mengembalikan response kosong.")

        await add_log("AI_SETUP_CALL", f"AI Setup chat: '{req.message[:50]}...' -> success={data.get('success', False)}")
        return data

    except httpx.TimeoutException:
        logger.error("AI Setup API timeout")
        raise HTTPException(status_code=504, detail="AI Setup API timeout. Coba lagi nanti.")
    except httpx.RequestError as e:
        logger.error(f"AI Setup API connection error: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Gagal terhubung ke AI Setup API: {str(e)}")
    except Exception as e:
        logger.error(f"AI Setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

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
    if not req.dataUrl.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Format gambar tidak valid.")
    if len(req.dataUrl) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 5MB.")
    image_id = str(uuid.uuid4())
    await db.doc_images.insert_one({"id": image_id, "dataUrl": req.dataUrl, "createdAt": datetime.utcnow().isoformat()})
    return {"success": True, "imageId": image_id, "dataUrl": req.dataUrl}

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
async def receive_webhook(token: str, payload: Dict = None):
    user = await db.users.find_one({"webhookToken": token, "isActive": True}, {"_id": 0, "passwordHash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Webhook token tidak valid.")
    await log_user_activity(user["id"], user["username"], "WEBHOOK_RECEIVED", f"Webhook diterima")
    await add_log("WEBHOOK_IN", f"Webhook masuk untuk user '{user['username']}'")
    return {"success": True, "userId": user["id"], "username": user["username"]}

# ============================================================
# WAHA PROXY
# ============================================================

async def get_waha_config():
    keys = ["wahaUrl", "wahaSession", "wahaApiKey"]
    result = {}
    for key in keys:
        doc = await db.config.find_one({"key": key})
        result[key] = doc["value"] if doc else ""
    url = result.get("wahaUrl", "").rstrip("/")
    session = result.get("wahaSession", "default") or "default"
    api_key = result.get("wahaApiKey", "")
    if not url:
        raise HTTPException(status_code=400, detail="WAHA URL belum dikonfigurasi.")
    return url, session, api_key

def waha_headers(api_key: str) -> dict:
    h = {"Content-Type": "application/json"}
    if api_key:
        h["X-Api-Key"] = api_key
    return h

@api_router.get("/waha/status")
async def waha_status(token: str = Depends(validate_token)):
    waha_url, session, api_key = await get_waha_config()
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
async def waha_qr(token: str = Depends(validate_token)):
    waha_url, session, api_key = await get_waha_config()
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
async def waha_start(token: str = Depends(validate_token)):
    waha_url, session, api_key = await get_waha_config()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Try to start existing session first
            r = await client.post(
                f"{waha_url}/api/sessions/{session}/start",
                headers=waha_headers(api_key),
            )
            if r.status_code == 404:
                # Session doesn't exist, create it
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
async def waha_stop(token: str = Depends(validate_token)):
    waha_url, session, api_key = await get_waha_config()
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
    waha_url, session, api_key = await get_waha_config()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Try WAHA Plus style first: GET /api/sessions/{session}
            r = await client.get(f"{waha_url}/api/sessions/{session}", headers=waha_headers(api_key))
            if r.status_code == 200:
                data = r.json()
                webhooks = data.get("config", {}).get("webhooks", [])
                if webhooks:
                    return {"success": True, "webhooks": webhooks}
            # Fallback: GET /api/{session}/webhook
            r2 = await client.get(f"{waha_url}/api/{session}/webhook", headers=waha_headers(api_key))
            if r2.status_code == 200:
                return {"success": True, "webhooks": [r2.json()]}
        return {"success": True, "webhooks": []}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Tidak bisa terhubung ke WAHA server.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/waha/debug")
async def waha_debug(token: str = Depends(validate_token)):
    """Return raw WAHA session info and available routes for debugging."""
    waha_url, session, api_key = await get_waha_config()
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

@api_router.post("/waha/webhook")
async def waha_set_webhook(current_user: Dict = Depends(get_current_user)):
    waha_url, session, api_key = await get_waha_config()

    # Get user's webhook token
    user = await db.users.find_one({"id": current_user["userId"]})
    if not user or not user.get("webhookToken"):
        raise HTTPException(status_code=400, detail="Token webhook user tidak ditemukan.")

    # Get backend public URL
    backend_url_doc = await db.config.find_one({"key": "backendUrl"})
    backend_url = (backend_url_doc["value"] if backend_url_doc else "").rstrip("/")
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
# HEALTH CHECK
# ============================================================

@api_router.get("/")
async def root():
    return {"message": "ChatBot Manager API v1.2.0", "status": "running"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
