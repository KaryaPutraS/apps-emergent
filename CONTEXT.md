# Apps Emergent — Catatan Sesi & Konteks Hand-off

> Dokumentasi ringkas untuk memudahkan melanjutkan pengerjaan di sesi mendatang.
> **Update terakhir**: 2026-05-16 · **Branch**: `claude/security-audit-0uGQh` · **PR**: #10

---

## 1. Tentang Aplikasi

**ChatBot Manager** — dashboard SaaS untuk UMKM Indonesia mengelola chatbot WhatsApp berbasis AI.

- **Backend**: FastAPI (Python ≥ 3.12) + MongoDB (motor async)
- **Frontend**: React 19 + CRA (craco) + Tailwind + shadcn-ui
- **Landing page**: HTML statis (`lp/index.html`) di-serve langsung oleh Nginx
- **Integrasi**: WAHA (WhatsApp HTTP API) per-user
- **AI provider yang didukung**: OpenAI, Gemini, Anthropic, DeepSeek, Groq, OpenRouter, Ollama

---

## 2. Arsitektur Deployment (VPS Production)

```
Internet
  ↓ (Cloudflare proxy)
Nginx  ──────  /var/www/lp/           ← adminpintar.id (landing)
  │
  └── /api/ → 127.0.0.1:8001 (uvicorn, user=chatbot)
        ↓
      MongoDB 127.0.0.1:27017 (bindIp lokal)
```

- VPS: Ubuntu, domain `adminpintar.id` (di belakang Cloudflare)
- **Dua server-block Nginx** (`/etc/nginx/sites-enabled/adminpintar.id`):
  - `adminpintar.id` + `www.adminpintar.id` → landing page (`/var/www/lp`)
  - `apps.adminpintar.id` → dashboard React (`/var/www/chatbot/frontend/build`) + API + WebSocket + Webhook proxy ke `127.0.0.1:8001`
- Backend: uvicorn `--workers 2`, port 8001, systemd unit `chatbot-backend`, run as user `chatbot` (uid=999, non-root)
- MongoDB: localhost only (`bindIp: 127.0.0.1`), tidak di-expose
- Repo lokal: `/var/www/chatbot`, owner `chatbot:chatbot`

---

## 3. Yang Dikerjakan di Sesi Ini (PR #10)

### 🔒 Security hardening
| | |
|---|---|
| Hapus literal `admin/admin123` di seed | Password awal dari env `INITIAL_ADMIN_PASSWORD` atau random 18-char (dicetak log sekali) |
| Flag `mustChangePassword` | Banner amber di halaman **Setting**, paksa ganti pada login pertama |
| LP content sanitizer | HTML allowlist (server-side) + URL safety → cegah stored-XSS dari LP Editor |
| WebSocket `/ws/workflow` | Auth via **first-frame** (`{"type":"auth","token":"..."}`) — token tidak di URL |
| Rate-limit persistent | Mongo collection `rate_limits` + TTL — tahan restart & multi-worker |
| Demo-register limit | 3 per phone / jam **+** 5 per IP / hari |
| TTL 90 hari pada `lp_events` | Cegah storage exhaustion |
| Strict `Authorization` parser | Partition + scheme check (`Bearer ` only) |
| `TRUST_PROXY` env | Baca IP klien dari `X-Forwarded-For` saat di belakang reverse proxy |

### 🎨 LP & Dashboard
- Tombol hero **"Aktifkan Rp 49rb/bln"** (class `lp-buy-link`) langsung mengikuti `links.activation` — tidak buka popup demo
- Tombol lain (Mulai Gratis 14 Hari, sticky, dll) tetap buka modal demo
- LP favicon baca dari **upload Dashboard Branding** (`/api/branding.faviconDataUrl`) sebagai prioritas; fallback ke `lp-content.branding.favicon_url`
- **Tab baru "🦶 Footer"** di LP Editor dengan:
  - Deskripsi brand (HTML)
  - Kolom dinamis (tambah/hapus/urutkan ↑↓, edit judul + link per-kolom)
  - Copyright (HTML)
  - Link legal (label + URL, tambah/hapus)
- Fix: `data:image/*` di `favicon_url` & `logo_url` diizinkan kembali (regresi dari URL sanitizer)

### 🛠 Infrastruktur
- 6 security headers di Nginx untuk landing page (sebelumnya kosong)
- `.env` chmod 600
- Systemd unit `chatbot-backend` `User=chatbot` (non-root)
- Script helper `/usr/local/bin/chatbot-update` untuk update VPS dalam satu perintah

---

## 4. Branch & PR

- **Branch dev**: `claude/security-audit-0uGQh`
- **Pull Request**: #10 — https://github.com/KaryaPutraS/apps-emergent/pull/10
- **Status**: belum di-merge ke `main`
- Komit-komit utama:
  - `a2a6739` — Security hardening (password, sanitizer, WS, rate-limit, dll)
  - `579f76f` — LP hero CTA + favicon dari upload Dashboard
  - `f09fbed` — Tab Footer di LP Editor
  - `ec95f5e` — Fix data:image/* di favicon/logo
  - (+ commit dokumentasi ini)

---

## 5. Environment Variables

File: `/var/www/chatbot/backend/.env` (chmod 600, owner `chatbot`)

```env
# MongoDB
MONGO_URL=mongodb://...
DB_NAME=...

# Production hardening
APP_ENV=production
ALLOWED_ORIGINS=https://adminpintar.id,https://apps.adminpintar.id
TRUST_PROXY=1

# Initial seed (hanya berlaku saat first-run / DB kosong)
INITIAL_ADMIN_PASSWORD=<password-kuat-Anda>
```

---

## 6. Update VPS (Cheat Sheet)

**Cara cepat** — pakai helper yang sudah dipasang:
```bash
sudo chatbot-update
```

**Manual** — kalau perlu kontrol per-step:
```bash
cd /var/www/chatbot
git fetch origin claude/security-audit-0uGQh
git reset --hard origin/claude/security-audit-0uGQh

cd /var/www/chatbot/frontend
npm install --legacy-peer-deps
npm run build

sudo cp /var/www/chatbot/lp/index.html /var/www/lp/index.html
sudo chown -R chatbot:chatbot /var/www/chatbot
sudo chmod 600 /var/www/chatbot/backend/.env
sudo systemctl restart chatbot-backend
sudo systemctl status chatbot-backend --no-pager | head -5
```

---

## 7. Verifikasi Pasca-Update

```bash
# Health
curl -s https://apps.adminpintar.id/api/
# expect: {"message":"ChatBot Manager API v1.2.0","status":"running"}

# Security headers backend
curl -sI https://apps.adminpintar.id/api/ \
  | grep -iE "strict-transport|x-frame|content-security|permissions-policy"
# expect: 6 header

# Security headers landing page
curl -sI https://adminpintar.id/ \
  | grep -iE "strict-transport|x-frame|content-security|permissions-policy"
# expect: 6 header (CSP lebih permissive)

# Backend tidak jalan sebagai root
ps -ef | grep "[u]vicorn"
# expect: user "chatbot" pada kolom pertama

# Test default password ditolak
curl -s -X POST https://apps.adminpintar.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# expect: {"success":false,"message":"Username atau password salah.",...}
```

---

## 8. File Penting yang Sering Disentuh

| Path | Isi |
|---|---|
| `backend/server.py` | Semua endpoint API, sanitizer, rate-limit, seed |
| `backend/.env` | Env var (chmod 600, owner chatbot) |
| `lp/index.html` | Landing page (deploy ke `/var/www/lp/`) |
| `frontend/src/pages/LPEditor.jsx` | UI editor LP (7 tabs) |
| `frontend/src/components/WorkflowCanvas.jsx` | WebSocket client untuk live workflow |
| `frontend/src/App.js` | Context, login flow, `mustChangePassword` handling |
| `frontend/src/pages/Settings.jsx` | Halaman Setting + form ganti password |
| `/etc/systemd/system/chatbot-backend.service` | Unit systemd (`User=chatbot`) |
| `/etc/nginx/sites-enabled/adminpintar.id` | Nginx (2 server block, security headers) |
| `/usr/local/bin/chatbot-update` | Helper script update VPS |

---

## 9. Endpoint API Penting

### Auth
- `POST /api/auth/login` — `{username, password}` → token + `user.mustChangePassword`
- `POST /api/auth/logout` — invalidate session
- `GET /api/auth/check` — validate token + return user
- `POST /api/auth/change-password` — clear `mustChangePassword`

### Public
- `POST /api/public/demo-register` — buat akun demo 14 hari (rate-limited)
- `GET /api/lp-content` — konten landing page (untuk LP)
- `GET /api/branding` — siteName + favicon/logo (dataUrl)
- `POST /api/lp-track` — analytics event LP

### Admin / Superadmin
- `PUT /api/admin/lp-content` — update konten LP (sanitized)
- `GET /api/admin/lp-analytics?days=N` — agregat event LP
- `GET/POST/PUT/DELETE /api/users` — user management
- `GET/POST /api/superadmin/licenses` — license management

### WebSocket
- `/ws/workflow` — live workflow events; auth via first-frame `{"type":"auth","token":"..."}`

### Webhook
- `POST /webhook/{token}` — terima event WAHA (token = `users.webhookToken`)

---

## 10. Yang Belum Dikerjakan (Opsional / Low Priority)

Tidak ada item kritis. Sisa hanya nice-to-have:

- **Migrasi build frontend ke Vite** — hilangkan 28 npm vulnerabilities di ecosystem `react-scripts 5`. Refactor major, manfaat moderate.
- **Tighten CSP landing page** — hilangkan `'unsafe-inline'` di `script-src` dengan nonces/hashes. Perlu refactor inline-script di `lp/index.html`. Manfaat marginal (XSS sudah dicegah server-side).
- **Backup strategy MongoDB** — operasional, di luar scope kode.
- **Monitoring/alerting** — Prometheus, healthcheck endpoint, Uptime Robot, dll.

---

## 11. Untuk Konteks Sesi Berikutnya

Kalau membuka sesi baru dengan asisten AI, cukup tunjukkan:

> "Saya melanjutkan dari sesi sebelumnya pada repo apps-emergent.
> Baca `CONTEXT.md` di root + PR #10 untuk konteks lengkap.
> Branch dev saya: `claude/security-audit-0uGQh`."

**Ringkasan satu kalimat:**
ChatBot WhatsApp manager (FastAPI + React + Mongo) deployed di VPS `adminpintar.id`, sudah lengkap security-hardened + tambah editor footer LP + backend non-root user. Branch `claude/security-audit-0uGQh` siap merge ke `main`.

---

## 12. Troubleshooting Cepat

| Gejala | Penyebab umum | Fix |
|---|---|---|
| Backend gagal start, log: `ALLOWED_ORIGINS wajib diisi di produksi` | `.env` tidak ada `ALLOWED_ORIGINS` saat `APP_ENV=production` | Isi env, restart |
| `Permission denied` saat backend baca `.env` | Pemilik bukan `chatbot` | `sudo chown chatbot:chatbot /var/www/chatbot/backend/.env` |
| `git pull` error: "dubious ownership" | File milik `chatbot`, git dijalankan sebagai root | `git config --global --add safe.directory /var/www/chatbot` (sudah dipasang) |
| Frontend build OK tapi UI tidak update | Browser cache | Ctrl+Shift+R (hard refresh) atau cek `ls /var/www/chatbot/frontend/build/static/js/` untuk timestamp file |
| LP tidak update setelah git pull | Lupa copy `lp/index.html` ke `/var/www/lp/` | `sudo cp /var/www/chatbot/lp/index.html /var/www/lp/index.html` (atau pakai `sudo chatbot-update`) |
| Webhook tidak dipicu | Bot tidak aktif untuk user, atau WAHA session mismatch | Cek dashboard menu **Setting → Bot Aktif** + **Connections** |
| Login `admin/admin123` masih bisa | Database lama belum reset, password masih literal `admin123` | Login dengan password lama → **Setting → Ganti Password** |

---

_Generated by Claude Code session pada 2026-05-16_
