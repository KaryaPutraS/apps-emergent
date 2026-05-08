# SatroAI ChatBot Manager — PRD

## Original Problem Statement
Buat replika pixel-perfect dashboard "SatroAI ChatBot Manager" (WhatsApp AI Chatbot Manager) sebagai aplikasi Full-Stack (FastAPI + React + MongoDB), dengan UI modern dan deployment ke VPS user.

## Tech Stack
- Frontend: React + Tailwind + Shadcn UI (CRA build, served as static via Nginx)
- Backend: FastAPI + Motor (Async MongoDB), uvicorn dijalankan via PM2 di VPS
- Database: MongoDB (lokal di VPS / Atlas)
- Reverse proxy: Nginx (`/api/` → 127.0.0.1:8001, static frontend dari build dir)
- Auth: SHA-256 hashing (hashlib) untuk cross-platform stability
- Integrasi: SatroAI License API (`https://lisensi.satroai.pro/ai-setup`) via backend proxy

## Auth & Defaults
- Login: password-only admin login (default `admin123`)
- Login endpoint: `POST /api/auth/login` body `{username, password}`
- Token bearer disimpan di localStorage frontend

## Key API Endpoints
- `/api/auth/login`, `/api/auth/check`, `/api/auth/logout`, `/api/auth/change-password`
- `/api/dashboard/stats`, `/api/dashboard/chart`
- `/api/rules` (GET/POST/DELETE/PUT toggle)
- `/api/knowledge` (GET/POST/DELETE)
- `/api/templates`, `/api/contacts`, `/api/messages`, `/api/logs`
- `/api/broadcast/check`, `/api/broadcast/send`
- `/api/config`, `/api/config/ai-agent`
- `/api/license` (GET/POST/DELETE) — proxy ke lisensi.satroai.pro
- `/api/ai-setup/chat`
- `/api/test/rule`, `/api/test/knowledge`, `/api/test/full-flow`
- `/api/reset/{config|dashboard|messages|contacts}`

## Data Models (MongoDB)
- `users`: { username, password (SHA-256), role }
- `rules`: aturan trigger chatbot
- `knowledge`: knowledge base entries
- `templates`, `contacts`, `messages`, `logs`, `config`, `license`

## Deployment (VPS)
- Server: `43.133.151.204` (Ubuntu, user `ubuntu`)
- Frontend build: `/home/ubuntu/chatbot-manager/frontend/build`
- Backend: PM2 process `chatbot-backend` listening on `127.0.0.1:8001`
- Nginx config: `/etc/nginx/sites-available/chatbot-manager` (symlinked di sites-enabled)
- Akses publik: `http://43.133.151.204/`

## Status (Implemented)
- [DONE] 15+ halaman React modern
- [DONE] Backend FastAPI + Motor + endpoint lengkap
- [DONE] Integrasi proxy SatroAI License API
- [DONE] Migrasi auth bcrypt → hashlib SHA-256 (auto-migrate hash lama `$2b$`)
- [DONE] Build production di-upload ke VPS, PM2 backend online
- [DONE 2026-02] **Fix Nginx 500 di VPS**: penyebabnya `/home/ubuntu` mode 750 (drwxr-x---) sehingga user `www-data` tidak bisa traverse. Perbaikan: `chmod o+x /home/ubuntu` + reload nginx. Verified: login API, dashboard/stats, rules, knowledge, templates, contacts, config, license semua 200 OK dari IP publik.

## Roadmap / Backlog
P1 — Optional improvements
- HTTPS via Let's Encrypt (certbot) bila domain sudah diarahkan
- Auto-restart hardening: `pm2 startup` & `pm2 save` agar backend auto-start setelah reboot VPS
- Backup MongoDB schedule (cron mongodump)

P2 — Nice to have
- Rotasi log Nginx & PM2
- Monitoring uptime (UptimeRobot / healthcheck endpoint)
- Refactor `/app/backend/server.py` → split per modul (routes/auth, routes/rules, dst.)

## Test Credentials
Lihat `/app/memory/test_credentials.md`
